const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const stripeLib = require("stripe");
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
    dotenv.config({path: envLocal});
  } else if (fs.existsSync(envDefault)) {
    dotenv.config({path: envDefault});
  }
} catch {}

const stripeSecret = defineSecret("STRIPE_SECRET_KEY");
const webhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

exports.createPaymentIntent = onCall({secrets: [stripeSecret]}, async (request) => {
  try {
    // Initialize Stripe with secret (read at runtime so secrets work in prod)
    const secret = process.env.STRIPE_SECRET_KEY || (typeof stripeSecret.value === "function" ? stripeSecret.value() : undefined);
    if (!secret) {
      throw new HttpsError(
          "failed-precondition",
          "Stripe secret not configured",
          {hint: "Set STRIPE_SECRET_KEY as a Functions secret (sk_test_...) in Firebase."},
      );
    }
    const stripe = stripeLib(secret);

    const {amount, currency = "gbp", mode, itemsSummary, itemsJson, userEmail, userName} = request.data || {};

    // Optional: prevent common key mismatches (client test vs server live)
    const isServerLive = /^sk_live_/.test(secret);
    const isServerTest = /^sk_test_/.test(secret);
    if (mode === "test" && isServerLive) {
      throw new HttpsError(
          "failed-precondition",
          "Key mode mismatch",
          {details: "Client uses TEST (pk_test_…) but server secret is LIVE (sk_live_…). Set STRIPE_SECRET_KEY to a sk_test_ key from the same Stripe account as your publishable key."},
      );
    }
    if (mode === "live" && isServerTest) {
      throw new HttpsError(
          "failed-precondition",
          "Key mode mismatch",
          {details: "Client uses LIVE (pk_live_…) but server secret is TEST (sk_test_…). Set STRIPE_SECRET_KEY to a sk_live_ key from the same Stripe account as your publishable key."},
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

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {enabled: true},
      // Ask Stripe to email a receipt to the customer (free from Stripe)
      receipt_email: userEmail || undefined,
      metadata: {
        items: itemsSummary || "",
        itemsJson: (itemsJson && String(itemsJson).slice(0, 450)) || "",
        userEmail: userEmail || "",
        userName: userName || "",
      },
      // Optional: add metadata to help reconcile in dashboard
      // metadata: { userId: request.auth?.uid || 'anon' }
    });
    return {clientSecret: paymentIntent.client_secret, id: paymentIntent.id};
  } catch (err) {
    console.error("createPaymentIntent error:", err);
    // If we purposely threw an HttpsError above, pass it through
    if (err instanceof HttpsError) throw err;
    // Extract rich details from Stripe or other errors
    const msg = (err && (err.raw && err.raw.message)) || (err && err.message) || "Failed to create payment intent";
    const detail = {
      message: msg,
      type: err && (err.type || (err.raw && err.raw.type)) || undefined,
      code: err && (err.code || (err.raw && err.raw.code)) || undefined,
      requestId: err && err.raw && err.raw.requestId || undefined,
    };
    // Send generic error code but include details for the client to display
    throw new HttpsError("internal", "Payment intent failed", detail);
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

// Stripe webhook to persist orders and send confirmations
exports.stripeWebhook = onRequest({secrets: [webhookSecret, stripeSecret]}, async (req, res) => {
  if (req.method !== "POST") {
    // Respond OK to GET/HEAD probes to avoid noisy errors in Stripe UI
    res.status(200).send("ok");
    return;
  }
  const sig = req.headers["stripe-signature"]; // header name is lowercase in Node
  if (!sig) {
    res.status(400).send("Missing Stripe-Signature header");
    return;
  }
  try {
    const secret = process.env.STRIPE_SECRET_KEY || (typeof stripeSecret.value === "function" ? stripeSecret.value() : undefined);
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET || (typeof webhookSecret.value === "function" ? webhookSecret.value() : undefined);
    if (!whSecret) {
      res.status(500).send("Webhook secret not configured");
      return;
    }

    // Verify the event with raw body
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const event = stripeLib(secret || "").webhooks.constructEvent(raw, sig, whSecret);

    if (event.type === "payment_intent.succeeded") {
  initAdmin();
  const pi = event.data.object;
  const db = getFirestore();
      const charge = (pi.charges && pi.charges.data && pi.charges.data[0]) || {};
      const billing = charge.billing_details || {};
      const shipping = pi.shipping || {};
      const email = billing.email || (pi.metadata && pi.metadata.userEmail) || null;
      const name = shipping.name || billing.name || (pi.metadata && pi.metadata.userName) || null;
      const items = (pi.metadata && pi.metadata.items) || "";
      const itemsJson = (pi.metadata && pi.metadata.itemsJson) || "";
      const addr = shipping.address || billing.address || {};

      const order = {
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
  created: Timestamp.fromMillis((pi.created || Math.floor(Date.now()/1000)) * 1000),
        itemsSummary: items,
        items: (() => {
          try {
            return itemsJson ? JSON.parse(itemsJson) : [];
          } catch (e) {
            return [];
          }
        })(),
        customer: {
          name: name || null,
          email: email || null,
          address: {
            line1: addr.line1 || null,
            line2: addr.line2 || null,
            city: addr.city || null,
            postal_code: addr.postal_code || null,
            country: addr.country || null,
          },
        },
      };

      try {
        await db.collection("orders").doc(pi.id).set(order, {merge: true});
        // eslint-disable-next-line no-console
        console.log("[stripeWebhook] Order saved:", pi.id);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[stripeWebhook] Failed to save order:", pi.id, e);
      }

      // Decrement stock levels for each item. If the product has a numeric 'stock' field, decrement.
      // If the product has no numeric 'stock', treat as a one-of-a-kind and delete the document.
      const parsedItems = order.items || [];
      for (const line of parsedItems) {
        try {
          if (!line || !line.productId || !line.qty) continue;
          const ref = db.collection("furniture").doc(String(line.productId));
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return; // no product, skip
            const data = snap.data() || {};
            if (typeof data.stock === "number") {
              const current = data.stock;
              const next = Math.max(0, current - Number(line.qty || 0));
              tx.update(ref, {stock: next});
            } else {
              // One-of-a-kind (no numeric stock): remove the product from the catalog
              tx.delete(ref);
            }
          });
          // eslint-disable-next-line no-console
          console.log("[stripeWebhook] Inventory updated for", line.productId, "qty", line.qty);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[stripeWebhook] Failed to decrement stock for", line && line.productId, e);
        }
      }
    }

    res.status(200).send({received: true});
  } catch (err) {
    console.error("webhook error:", err);
    res.status(400).send(`Webhook Error: ${err.message || "unknown"}`);
  }
});
