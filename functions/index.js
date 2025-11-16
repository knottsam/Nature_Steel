// Square Payment Processing Functions
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
// Using direct HTTPS calls to Square to avoid SDK auth inconsistencies
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
let adminInitialized = false;

// Load local env for emulator: prefer .env.local then .env
try {
  const envLocal = path.join(__dirname, ".env.local");
  const envDefault = path.join(__dirname, ".env");
  if (fs.existsSync(envLocal)) {
    dotenv.config({path: envLocal, override: true});
  } else if (fs.existsSync(envDefault)) {
    dotenv.config({path: envDefault, override: true});
  }
} catch {}

const squareAccessToken = defineSecret("SQUARE_ACCESS_TOKEN");

// Safely obtain and sanitize the Square access token (trim whitespace/quotes)
function getSquareAccessToken() {
  try {
    const fromSecret = (typeof squareAccessToken.value === "function") ? squareAccessToken.value() : undefined;
    const fromEnv = process.env.SQUARE_ACCESS_TOKEN;
    // Prefer secret when available (prod); fallback to env (emulator/local)
    const raw = (fromSecret != null && String(fromSecret).trim() !== "") ? fromSecret : fromEnv;
    if (!raw) return "";
    // Convert to string, trim whitespace/newlines, and strip surrounding quotes if any
    const cleaned = String(raw).trim().replace(/^"+|"+$/g, "");
    return cleaned;
  } catch {
    return "";
  }
}

exports.createPayment = onCall({secrets: [squareAccessToken]}, async (request) => {
  try {
    // Validate Square access token
    const accessToken = getSquareAccessToken();
    if (!accessToken) {
      throw new HttpsError(
          "failed-precondition",
          "Square access token not configured",
          {hint: "Set SQUARE_ACCESS_TOKEN as a Functions secret in Firebase."},
      );
    }

    const {amount, currency = "gbp", locationId, itemsSummary,
      itemsJson, userEmail, userName} = request.data || {};

    // Validate locationId
    if (!locationId) {
      throw new HttpsError(
          "invalid-argument",
          "Location ID required",
          {details: "Square requires a location ID for payments."},
      );
    }

    // Validate amount (integer, minor units e.g., pence)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpsError(
          "invalid-argument",
          "Invalid amount",
          {details: "Amount must be a positive integer in minor units (e.g., pence)."},
      );
    }

    // Parse and validate items for stock availability BEFORE creating the PaymentIntent
    let cartItems = [];
    try {
      cartItems = itemsJson ? JSON.parse(itemsJson) : [];
    } catch (e) {
      throw new HttpsError(
          "invalid-argument",
          "Invalid itemsJson",
          {details: "itemsJson must be a JSON-encoded array of { productId, qty }."},
      );
    }
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      throw new HttpsError(
          "invalid-argument",
          "No items to purchase",
          {details: "Your cart appears to be empty."},
      );
    }
    // Ensure each item has proper shape
    for (const line of cartItems) {
      const qty = Number(line && line.qty);
      const pid = line && (line.productId != null ? String(line.productId) : null);
      if (!pid || !Number.isInteger(qty) || qty <= 0) {
        throw new HttpsError(
            "invalid-argument",
            "Invalid cart item",
            {details: `Each item must have productId and positive integer qty.`},
        );
      }
    }

  // Check stock in Firestore. If a product document exists and has a numeric 'stock' field,
  // require stock >= requested qty. If the product doc is missing, treat as unavailable.
  // If the product has no numeric 'stock', treat it as a one-of-a-kind item with stock=1
  // and require qty <= 1.
    initAdmin();
    const db = getFirestore();
    const errors = [];

    // Fetch all product docs in parallel
    await Promise.all(cartItems.map(async (line) => {
      const productId = String(line.productId);
      const qty = Number(line.qty);
      try {
        const ref = db.collection("furniture").doc(productId);
        const snap = await ref.get();
        if (!snap.exists) {
          errors.push({productId, reason: "not-found"});
          return;
        }
        const data = snap.data() || {};
        const name = data.name || null;
        if (typeof data.stock === "number") {
          if (data.stock < qty) {
            errors.push({productId, name, reason: "insufficient", available: data.stock, requested: qty});
          }
        } else {
          // Untracked stock => assume stock=1; require qty <= 1
          if (qty > 1) {
            errors.push({productId, name, reason: "insufficient", available: 1, requested: qty});
          }
        }
      } catch (e) {
        errors.push({productId, reason: "check-failed", message: e && e.message});
      }
    }));

    if (errors.length > 0) {
      // Build a readable error message
      const msg = errors.map((e) => {
        if (e.reason === "not-found") return `Product ${e.productId} is unavailable.`;
        if (e.reason === "insufficient") return `${e.name || e.productId} only has ${e.available} in stock (you requested ${e.requested}).`;
        return `Could not verify stock for ${e.productId}.`;
      }).join(" ");
      throw new HttpsError(
          "failed-precondition",
          "Out of stock",
          {details: msg, items: errors},
      );
    }

    // Return the amount and currency - client will tokenize the card and complete payment
    return {
      amount,
      currency: currency.toUpperCase(),
      locationId,
      itemsSummary,
      itemsJson,
      userEmail,
      userName,
    };
  } catch (err) {
    console.error("createPayment error:", err);
    // If we purposely threw an HttpsError above, pass it through
    if (err instanceof HttpsError) throw err;
    // Extract error details
    const msg = (err && err.message) || "Failed to prepare payment";
    const detail = {
      message: msg,
      errors: err && err.errors || undefined,
    };
    // Send generic error code but include details for the client to display
    throw new HttpsError("internal", "Payment preparation failed", detail);
  }
});

// Initialize Admin SDK once
function initAdmin() {
  if (adminInitialized) return;
  try {
    if (!getApps().length) {
      initializeApp();
    }
    adminInitialized = true;
    // eslint-disable-next-line no-console
    console.log("[functions] Firebase Admin initialized");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[functions] Failed to initialize Firebase Admin:", e);
  }
}

// Process Square payment after client tokenizes the card
exports.processSquarePayment = onCall({secrets: [squareAccessToken]}, async (request) => {
  try {
    // Initialize Square client
  const accessToken = getSquareAccessToken();
    if (!accessToken) {
      throw new HttpsError(
          "failed-precondition",
          "Square access token not configured",
      );
    }

    const environment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

    const {sourceId, amount, currency, locationId, itemsSummary,
      itemsJson, userEmail, userName, verificationToken,
      address, city, postcode, countryCode} = request.data || {};

    if (!sourceId || !amount || !locationId) {
      throw new HttpsError(
          "invalid-argument",
          "Missing required payment parameters",
      );
    }

    // Create the payment
    const base = environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
    const idempotencyKey = crypto.randomUUID();
    const body = {
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      amount_money: {
        amount: Number(amount),
        currency: String(currency || "GBP").toUpperCase(),
      },
      location_id: locationId,
      note: itemsSummary || undefined,
      buyer_email_address: userEmail || undefined,
    };
    // Include shipping address if provided
    if (address || city || postcode || countryCode) {
      body.shipping_address = {
        address_line_1: address || undefined,
        locality: city || undefined,
        postal_code: postcode || undefined,
        country: (countryCode || "").toUpperCase() || undefined,
      };
    }
    if (verificationToken) body.verification_token = verificationToken;

    const res = await fetch(`${base}/v2/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Square payments API error ${res.status}: ${text}`);
    }
    const paymentResult = await res.json();
    const payment = paymentResult && paymentResult.payment;
    if (!payment) {
      throw new Error("Square payment response missing payment");
    }

    // Save order to Firestore
    initAdmin();
    const db = getFirestore();

    const order = {
      id: payment.id,
      amount: Number(payment.amount_money && payment.amount_money.amount),
      currency: payment.amount_money && payment.amount_money.currency,
      status: payment.status,
      created: Timestamp.now(),
      itemsSummary: itemsSummary || "",
      items: (() => {
        try {
          return itemsJson ? JSON.parse(itemsJson) : [];
        } catch (e) {
          return [];
        }
      })(),
      customer: {
        name: userName || null,
        email: userEmail || null,
        address: address || null,
        city: city || null,
        postcode: postcode || null,
        countryCode: countryCode || null,
      },
      squarePaymentId: payment.id,
      squareOrderId: payment.order_id || null,
      squareReceiptUrl: payment.receipt_url || null,
    };

    await db.collection("orders").doc(payment.id).set(order, {merge: true});
    console.log("[processSquarePayment] Order saved:", payment.id);

    // Decrement stock levels for each item
    const parsedItems = order.items || [];
    for (const line of parsedItems) {
      try {
        const ref = db.collection("furniture").doc(String(line.productId));
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const data = snap.data() || {};
          if (typeof data.stock === "number") {
            const current = data.stock;
            const next = Math.max(0, current - Number(line.qty || 0));
            tx.update(ref, {stock: next});
          } else {
            // One-of-a-kind: remove from catalog
            tx.delete(ref);
          }
        });
        console.log("[processSquarePayment] Inventory updated for", line.productId, "qty", line.qty);
      } catch (e) {
        console.error("[processSquarePayment] Failed to update stock for", line && line.productId, e);
      }
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      receiptUrl: payment.receipt_url || null,
    };
  } catch (err) {
    console.error("processSquarePayment error:", err);
    if (err instanceof HttpsError) throw err;
    const msg = (err && err.message) || "Failed to process payment";
    throw new HttpsError("internal", "Payment processing failed", {message: msg});
  }
});

// Square webhook to handle payment events
exports.squareWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  try {
    // Note: Webhook signature verification is optional for sandbox testing
    // In production, configure SQUARE_WEBHOOK_SECRET for security
    const whSecret = process.env.SQUARE_WEBHOOK_SECRET;

    // Verify webhook signature if configured
    if (whSecret) {
      const signature = req.headers["x-square-hmacsha256-signature"];
      const url = req.headers["x-square-requesturl"] || "";
      const body = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

      const hmac = crypto.createHmac("sha256", whSecret);
      hmac.update(url + body.toString());
      const hash = hmac.digest("base64");

      if (signature !== hash) {
        console.error("[squareWebhook] Invalid signature");
        res.status(400).send("Invalid signature");
        return;
      }
    } else {
      console.warn("[squareWebhook] No webhook secret configured - " +
          "signature verification disabled");
    }

    const event = req.body;

    // Handle payment.created or payment.updated events
    if (event.type === "payment.created" || event.type === "payment.updated") {
      const payment = event.data.object.payment;

      // Only process completed payments
      if (payment.status !== "COMPLETED") {
        res.status(200).send({received: true});
        return;
      }

      initAdmin();
      const db = getFirestore();

      // Check if order already exists
      const orderRef = db.collection("orders").doc(payment.id);
      const orderSnap = await orderRef.get();

      if (orderSnap.exists) {
        console.log("[squareWebhook] Order already processed:", payment.id);
        res.status(200).send({received: true});
        return;
      }

      // Create order record
      const order = {
        id: payment.id,
        amount: Number(payment.amount_money.amount),
        currency: payment.amount_money.currency,
        status: payment.status,
        created: Timestamp.now(),
        itemsSummary: payment.note || "",
        customer: {
          email: payment.buyer_email_address || null,
        },
        squarePaymentId: payment.id,
        squareOrderId: payment.order_id || null,
        squareReceiptUrl: payment.receipt_url || null,
      };

      await orderRef.set(order, {merge: true});
      console.log("[squareWebhook] Order saved:", payment.id);
    }

    res.status(200).send({received: true});
  } catch (err) {
    console.error("[squareWebhook] error:", err);
    res.status(400).send(`Webhook Error: ${err.message || "unknown"}`);
  }
});

// Diagnostics: list merchant and locations using current Square access token
exports.squareDiagnostics = onCall({secrets: [squareAccessToken]}, async () => {
  try {
    const secretCandidate = (typeof squareAccessToken.value === "function") ? squareAccessToken.value() : undefined;
    const fromEnv = !(secretCandidate && String(secretCandidate).trim() !== "");
    const accessToken = getSquareAccessToken();
    if (!accessToken) {
      throw new HttpsError("failed-precondition", "Square access token not configured");
    }
    // Determine target env for normal use
    const environment = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

    // Simple token preview for debugging (mask value)
    const tokenStr = String(accessToken);
    let tokenPreview;
    if (tokenStr.length >= 12) {
      tokenPreview = `${tokenStr.substring(0, 6)}...${tokenStr.substring(tokenStr.length - 4)}`;
    } else {
      tokenPreview = `${tokenStr.substring(0, 3)}...`;
    }

    // Perform direct HTTP calls (bypassing SDK) from within the function
    const directCall = async (path) => {
      const base = environment === "sandbox" ?
        "https://connect.squareupsandbox.com" :
        "https://connect.squareup.com";
      const url = `${base}${path}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      });
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {}
      return { status: res.status, ok: res.ok, body: bodyText && bodyText.substring(0, 500) };
    };

    let directMerchants;
    let directLocations;
    try {
      directMerchants = await directCall("/v2/merchants");
    } catch (e) {
      directMerchants = { error: e && (e.message || "direct merchants failed") };
    }
    try {
      directLocations = await directCall("/v2/locations");
    } catch (e) {
      directLocations = { error: e && (e.message || "direct locations failed") };
    }

    // Opposite environment direct calls
    const directCallOpp = async (path) => {
      const base = environment === "sandbox" ?
        "https://connect.squareup.com" :
        "https://connect.squareupsandbox.com";
      const url = `${base}${path}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      });
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {}
      return { status: res.status, ok: res.ok, body: bodyText && bodyText.substring(0, 500) };
    };
    let directMerchantsOpp;
    let directLocationsOpp;
    try {
      directMerchantsOpp = await directCallOpp("/v2/merchants");
    } catch (e) {
      directMerchantsOpp = { error: e && (e.message || "direct merchants opp failed") };
    }
    try {
      directLocationsOpp = await directCallOpp("/v2/locations");
    } catch (e) {
      directLocationsOpp = { error: e && (e.message || "direct locations opp failed") };
    }

    return {
      environment: process.env.SQUARE_ENVIRONMENT || "sandbox",
      tokenSource: fromEnv ? "env" : "secret",
      tokenLength: tokenStr.length,
      tokenPreview,
      oppositeEnvironment: environment === "sandbox" ? "production" : "sandbox",
      merchantsOpposite: [directMerchantsOpp],
      locationsOpposite: [directLocationsOpp],
      direct: {
        merchants: directMerchants,
        locations: directLocations,
      },
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Diagnostics failed", { message: err && err.message });
  }
});

// (adminAddItem removed after use for security)
