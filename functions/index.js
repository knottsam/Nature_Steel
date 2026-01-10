// Square Payment Processing Functions
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {onSchedule} = require("firebase-functions/v2/scheduler");
// Using direct HTTPS calls to Square to avoid SDK auth inconsistencies
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const {initializeApp, getApps} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
let adminInitialized = false;

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";
// Prefer env var; fall back to functions config for backward compatibility
const REQUIRE_APP_CHECK = process.env.REQUIRE_APP_CHECK === "1";

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
const squareApplicationId = defineSecret("SQUARE_APPLICATION_ID");
const squareLocationId = defineSecret("SQUARE_LOCATION_ID");
const squareEnvironment = defineSecret("SQUARE_ENVIRONMENT");
const squareWebhookSecret = defineSecret("SQUARE_WEBHOOK_SECRET");

// Admin configuration
const adminEmails = defineSecret("ADMIN_EMAILS");

// Static artists data (mirrored from client-side)
const ARTISTS = [
  {
    id: 'a1',
    name: '@lets_have_a_skeg',
    feePence: 15000,
  }
];

// Site settings for pricing calculations
const SITE_SETTINGS = {
  markupPercent: 0.5, // 50% markup on artist fees
};

function readSecret(secret, envKey) {
  try {
    const fromSecret = (typeof secret.value === "function") ? secret.value() : undefined;
    const fromEnv = envKey ? process.env[envKey] : undefined;
    const raw = (fromSecret != null && String(fromSecret).trim() !== "") ? fromSecret : fromEnv;
    if (!raw) return "";
    return String(raw).trim().replace(/^"+|"+$/g, "");
  } catch {
    const fromEnv = envKey ? process.env[envKey] : undefined;
    return fromEnv ? String(fromEnv).trim() : "";
}
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function resolveBodyBuffer(req) {
  const raw = req && req.rawBody;
  if (raw != null) {
    if (Buffer.isBuffer(raw)) return raw;
    if (raw instanceof Uint8Array) return Buffer.from(raw);
    if (typeof raw === "string") return Buffer.from(raw, "utf8");
  }
  const fallback = req && req.body != null ? JSON.stringify(req.body) : "";
  return Buffer.from(fallback, "utf8");
}

function normalizeSquareRequest(req, fallbackPath = "/squareWebhook") {
  const headers = req && req.headers ? req.headers : {};
  const signatureHeader = firstHeaderValue(headers["x-square-hmacsha256-signature"]);
  const signatureVersion = String(firstHeaderValue(headers["x-square-signature-version"]) || "1");
  const sentAt = firstHeaderValue(headers["x-square-sent-at"]) || "";
  const urlHeader = firstHeaderValue(headers["x-square-request-url"]);

  const forwardedProtoRaw = typeof req.get === "function" ? req.get("x-forwarded-proto") : undefined;
  const forwardedProto = typeof forwardedProtoRaw === "string" && forwardedProtoRaw.trim() !== "" ?
    forwardedProtoRaw.split(",")[0].trim() :
    undefined;
  const protocol = forwardedProto || req.protocol || "https";
  const host = typeof req.get === "function" ? req.get("host") : (req && req.host) || "";
  const pathFromRequest =
    (typeof req.originalUrl === "string" && req.originalUrl.length > 0) ? req.originalUrl :
    (typeof req.url === "string" && req.url.length > 0) ? req.url :
    (typeof req.path === "string" && req.path.length > 0) ? req.path :
    "/";
  const normalizedPath = (typeof pathFromRequest === "string" && pathFromRequest !== "/") ?
    pathFromRequest :
    fallbackPath;
  const requestUrl = (typeof urlHeader === "string" && urlHeader.trim() !== "") ?
    urlHeader.trim() :
    `${protocol}://${host}${normalizedPath}`;

  const bodyBuffer = resolveBodyBuffer(req);
  const bodyString = bodyBuffer.toString("utf8");

  return {
    signatureHeader,
    signatureVersion,
    sentAt,
    urlHeader,
    requestUrl,
    normalizedPath,
    pathFromRequest,
    bodyString,
    rawBodyType: req.rawBody ? Object.prototype.toString.call(req.rawBody) : null,
    rawBodyIsBuffer: Boolean(req.rawBody && Buffer.isBuffer(req.rawBody)),
  };
}

function validateSquareSignature(req, secret, options = {}) {
  const fallbackPath = options.fallbackPath || "/squareWebhook";
  const context = normalizeSquareRequest(req, fallbackPath);
  const {signatureHeader, signatureVersion, sentAt, requestUrl, bodyString} = context;

  if (!signatureHeader) {
    return {valid: false, code: "missing-signature", message: "Missing signature header"};
  }

  const payloadToSign = (signatureVersion === "2" && sentAt) ?
    `${sentAt}${requestUrl}${bodyString}` :
    `${requestUrl}${bodyString}`;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadToSign);
  const expectedSignature = hmac.digest("base64");

  let providedBuffer;
  let expectedBuffer;
  try {
    providedBuffer = Buffer.from(signatureHeader, "base64");
    expectedBuffer = Buffer.from(expectedSignature, "base64");
  } catch (convertErr) {
    return {
      valid: false,
      code: "invalid-encoding",
      message: "Invalid signature encoding",
      error: convertErr,
      context: {...context, payloadToSign, expectedSignature},
    };
  }

  const signaturesMatch =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!signaturesMatch) {
    return {
      valid: false,
      code: "mismatch",
      message: "Invalid signature",
      context: {...context, payloadToSign, expectedSignature},
    };
  }

  return {
    valid: true,
    context: {...context, payloadToSign, expectedSignature},
  };
}

function sanitizeOriginUrl(origin) {
  if (typeof origin !== "string") return "";
  const trimmed = origin.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (!/^https?:$/.test(url.protocol)) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function isAllowedSquareRedirect(url) {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Allow HTTPS URLs in production
  if (trimmed.startsWith("https://")) return true;

  // Allow localhost HTTP URLs for development (updated)
  if (trimmed.startsWith("http://localhost")) return true;

  return false;
}

function appendParamsToUrl(base, params = {}) {
  if (typeof base !== "string" || !base.trim()) return "";
  try {
    const url = new URL(base.trim());
    Object.entries(params).forEach(([key, value]) => {
      if (value == null) return;
      const stringValue = String(value).trim();
      if (!stringValue) return;
      url.searchParams.set(key, stringValue);
    });
    return url.toString();
  } catch {
    return "";
  }
}

function parseCartItemsPayload(rawItems) {
  if (rawItems == null) {
    throw new HttpsError(
        "invalid-argument",
        "No items to purchase",
        {details: "Cart is empty."},
    );
  }
  let parsed;
  try {
    parsed = typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems;
  } catch (err) {
    throw new HttpsError(
        "invalid-argument",
        "Invalid itemsJson",
        {details: "itemsJson must be a JSON-encoded array of { productId, qty }."},
    );
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new HttpsError(
        "invalid-argument",
        "No items to purchase",
        {details: "Your cart appears to be empty."},
    );
  }

  const normalized = parsed.map((entry) => {
    const productId = entry && (entry.productId != null ? String(entry.productId) : null);
    const artistId = entry && (entry.artistId != null ? String(entry.artistId) : null);
    const material = entry && (entry.material != null ? String(entry.material) : null);
    const qty = Number(entry && entry.qty);
    if (!productId || !Number.isInteger(qty) || qty <= 0) {
      throw new HttpsError(
          "invalid-argument",
          "Invalid cart item",
          {details: "Each item must include productId and positive integer qty."},
      );
    }
    return {productId, artistId, material, qty};
  });

  return normalized;
}

function buildItemsSummary(details) {
  if (!Array.isArray(details) || !details.length) return "";
  return details.map((item) => {
    const label = item.name || item.productId;
    const customizations = [];
    if (item.material && item.material !== 'default') {
      customizations.push(`Material: ${item.material}`);
    }
    if (item.artistId) {
      const artist = ARTISTS.find(a => a.id === item.artistId);
      if (artist) {
        customizations.push(`Artist: ${artist.name}`);
      }
    }
    const customizationText = customizations.length > 0 ? ` (${customizations.join(', ')})` : '';
    return `${label}${customizationText}×${item.qty}`;
  }).join(", ");
}

function computeCatalogTotal(details) {
  if (!Array.isArray(details)) return 0;
  return details.reduce((total, item) => {
    const unit = Number.isFinite(item && item.unitPrice) ? Number(item.unitPrice) : 0;
    return total + (unit * Number(item && item.qty || 0));
  }, 0);
}

async function fetchCartDetails(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return {items: [], total: 0};
  }

  initAdmin();
  const db = getFirestore();
  const errors = [];
  const details = [];

  await Promise.all(cartItems.map(async (line) => {
    const productId = String(line.productId);
    const artistId = line.artistId || null;
    const material = line.material || null;
    const qty = Number(line.qty);
    try {
      const ref = db.collection("furniture").doc(productId);
      const snap = await ref.get();
      if (!snap.exists) {
        errors.push({productId, reason: "not-found"});
        return;
      }
      const data = snap.data() || {};
      let itemPrice = (typeof data.price === "number" && Number.isFinite(data.price)) ? Number(data.price) : null;
      const deliveryCost = (typeof data.deliveryCost === "number" && Number.isFinite(data.deliveryCost)) ? Number(data.deliveryCost) : 0;
      
      // Add artist fee and markup if artist is selected
      if (artistId && itemPrice != null) {
        const artist = ARTISTS.find(a => a.id === artistId);
        if (artist) {
          const artistFee = artist.feePence;
          const markup = Math.round(artistFee * SITE_SETTINGS.markupPercent);
          itemPrice = itemPrice + artistFee + markup;
        }
      }
      
      // Keep delivery cost separate for itemized billing
      const unitPrice = itemPrice != null ? itemPrice + deliveryCost : null;
      
      const name = typeof data.name === "string" && data.name ? data.name : productId;
      const normalizedImages = (() => {
        if (Array.isArray(data.images)) {
          return data.images
              .map((url) => (typeof url === "string" ? url.trim() : ""))
              .filter((url) => url)
              .slice(0, 10);
        }
        return [];
      })();
      const fallbackImage = typeof data.imageUrl === "string" && data.imageUrl.trim() ? data.imageUrl.trim() : null;
      const storedCoverImage = typeof data.coverImage === "string" && data.coverImage.trim() ? data.coverImage.trim() : null;
      let mergedImages = normalizedImages;
      if (storedCoverImage) {
        if (mergedImages.includes(storedCoverImage)) {
          mergedImages = [storedCoverImage, ...mergedImages.filter((img) => img !== storedCoverImage)];
        } else {
          mergedImages = [storedCoverImage, ...mergedImages];
        }
      }
      if (mergedImages.length === 0 && fallbackImage) {
        mergedImages = [fallbackImage];
      }
      mergedImages = mergedImages.slice(0, 10);
      const primaryImage = mergedImages.length > 0 ? mergedImages[0] : fallbackImage;
      if (typeof data.stock === "number") {
        if (data.stock < qty) {
          errors.push({
            productId,
            name,
            reason: "insufficient",
            available: data.stock,
            requested: qty,
          });
          return;
        }
      } else if (qty > 1) {
        errors.push({
          productId,
          name,
          reason: "insufficient",
          available: 1,
          requested: qty,
        });
        return;
      }

      details.push({
        productId,
        artistId,
        material,
        qty,
        name,
        unitPrice, // Total price including delivery
        itemPrice, // Base item price without delivery
        deliveryCost, // Delivery cost per item
        image: primaryImage,
        coverImage: mergedImages.length > 0 ? mergedImages[0] : null,
        images: mergedImages,
        slug: data.slug || null,
      });
    } catch (err) {
      errors.push({productId, reason: "check-failed", message: err && err.message});
    }
  }));

  if (errors.length > 0) {
    const msg = errors.map((e) => {
      if (e.reason === "not-found") return `Product ${e.productId} is unavailable.`;
      if (e.reason === "insufficient") return `${e.name || e.productId} only has ${e.available} available (requested ${e.requested}).`;
      return `Could not verify stock for ${e.productId}.`;
    }).join(" ");
    throw new HttpsError(
        "failed-precondition",
        "Out of stock",
        {details: msg, items: errors},
    );
  }

  return {
    items: details,
    total: computeCatalogTotal(details),
    summary: buildItemsSummary(details),
  };
}

async function adjustInventoryForOrder(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  initAdmin();
  const db = getFirestore();
  for (const line of items) {
    try {
      const productId = String(line && line.productId);
      const qty = Number(line && line.qty);
      if (!productId || !Number.isInteger(qty) || qty <= 0) continue;
      const ref = db.collection("furniture").doc(productId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data() || {};
        if (typeof data.stock === "number") {
          const next = Math.max(0, data.stock - qty);
          tx.update(ref, {stock: next});
        } else {
          tx.delete(ref);
        }
      });
      console.log("[inventory] Updated stock for", productId, "qty", qty);
    } catch (err) {
      console.error("[inventory] Failed to update stock for", line && line.productId, err);
    }
  }
}

function getSquarePublicConfig() {
  const applicationId = readSecret(squareApplicationId, "SQUARE_APPLICATION_ID");
  const locationId = readSecret(squareLocationId, "SQUARE_LOCATION_ID");
  const environmentRaw = readSecret(squareEnvironment, "SQUARE_ENVIRONMENT") || "sandbox";
  const environment = environmentRaw.toLowerCase() === "production" ? "production" : "sandbox";
  return {applicationId, locationId, environment};
}

function getSquareEnvironment() {
  const envRaw = readSecret(squareEnvironment, "SQUARE_ENVIRONMENT") || process.env.SQUARE_ENVIRONMENT || "sandbox";
  return String(envRaw).toLowerCase() === "production" ? "production" : "sandbox";
}

exports.getSquarePublicConfig = onCall({
  secrets: [squareApplicationId, squareLocationId, squareEnvironment],
}, async (request) => {
  try {
    assertAppCheck(request);
    const cfg = getSquarePublicConfig();
    if (!cfg.applicationId || !cfg.locationId) {
      throw new HttpsError(
          "failed-precondition",
          "Square configuration missing",
          {
            hasApplicationId: Boolean(cfg.applicationId),
            hasLocationId: Boolean(cfg.locationId),
            hint: "Set SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID, and SQUARE_ENVIRONMENT secrets or env vars.",
          },
      );
    }
    return cfg;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Failed to load Square configuration", {message: err && err.message});
  }
});

// Enforce App Check for callable functions (skipped on emulator)
function assertAppCheck(request) {
  if (IS_EMULATOR || !REQUIRE_APP_CHECK) return;
  if (!request.app) {
    throw new HttpsError(
        "failed-precondition",
        "App Check token is required. Please refresh the page and try again.",
    );
  }
}

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
    assertAppCheck(request);
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

    // Parse cart items and verify availability
    const cartItems = parseCartItemsPayload(itemsJson);
    const cartDetails = await fetchCartDetails(cartItems);
    const normalizedItemsSummary = (typeof itemsSummary === "string" && itemsSummary.trim()) ?
      itemsSummary.trim() :
      cartDetails.summary;
    const normalizedItemsJson = JSON.stringify(cartItems).slice(0, 450);
    const currencyCode = String(currency || "GBP").toUpperCase();

    // Return the amount and currency - client will tokenize the card and complete payment
    return {
      amount,
      currency: currencyCode,
      locationId,
      itemsSummary: normalizedItemsSummary,
      itemsJson: normalizedItemsJson,
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

exports.createSquareCheckoutLink = onCall({
  secrets: [squareAccessToken, squareEnvironment, squareLocationId, squareApplicationId],
}, async (request) => {
  try {
    assertAppCheck(request);

    const accessToken = getSquareAccessToken();
    if (!accessToken) {
      throw new HttpsError(
          "failed-precondition",
          "Square access token not configured",
          {hint: "Set SQUARE_ACCESS_TOKEN as a Functions secret in Firebase."},
      );
    }

    const environment = getSquareEnvironment();
    const {locationId} = getSquarePublicConfig();
    if (!locationId) {
      throw new HttpsError(
          "failed-precondition",
          "Square location not configured",
          {hint: "Set SQUARE_LOCATION_ID as a Functions secret in Firebase."},
      );
    }

    const {
      amount,
      currency = "GBP",
      itemsSummary,
      itemsJson,
      userEmail,
      userName,
      address,
      city,
      postcode,
      countryCode,
      origin,
    } = request.data || {};

    const cartItems = parseCartItemsPayload(itemsJson);
    const cartDetails = await fetchCartDetails(cartItems);

    let totalAmount = Number(amount);
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
      totalAmount = cartDetails.total;
    }
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
      throw new HttpsError(
          "invalid-argument",
          "Invalid amount",
          {details: "Cart total is invalid."},
      );
    }

    const currencyCode = String(currency || "GBP").toUpperCase();
    const summary = (typeof itemsSummary === "string" && itemsSummary.trim()) ?
      itemsSummary.trim() :
      cartDetails.summary;
    const sanitizedItemsJson = JSON.stringify(cartItems).slice(0, 2000);
    const sanitizedOrigin = sanitizeOriginUrl(origin);
    const originBase = sanitizedOrigin ? sanitizedOrigin.replace(/\/$/, "") : "";
    const originReturn = originBase ? `${originBase}/checkout/return` : "";
    const envReturn = process.env.SQUARE_CHECKOUT_RETURN_URL || process.env.SQUARE_CHECKOUT_SUCCESS_URL || "";
    const returnBase = isAllowedSquareRedirect(originReturn) ?
      originReturn :
      (isAllowedSquareRedirect(envReturn) ? envReturn.trim() : "");

    const base = environment === "production" ?
      "https://connect.squareup.com" :
      "https://connect.squareupsandbox.com";
    const idempotencyKey = crypto.randomUUID();
    const redirectUrl = returnBase ? appendParamsToUrl(returnBase, {
      token: idempotencyKey,
      source: "square",
    }) : "";
    const cancelUrl = returnBase ? appendParamsToUrl(returnBase, {
      token: idempotencyKey,
      source: "square",
      state: "cancelled",
    }) : "";

    console.log("Square checkout URLs:", {
      origin,
      originReturn,
      envReturn,
      returnBase,
      redirectUrl,
      cancelUrl: null, // Not using cancel_url
      isEmulator: IS_EMULATOR
    });

    // For localhost development, use HTTPS URLs to satisfy Square's requirements
    let finalRedirectUrl = redirectUrl;
    
    if (!redirectUrl && originReturn && originReturn.startsWith("http://localhost")) {
      // Convert localhost HTTP to HTTPS for Square (won't actually redirect but enables proper checkout)
      const httpsBase = originReturn.replace("http://", "https://");
      finalRedirectUrl = appendParamsToUrl(httpsBase, {
        token: idempotencyKey,
        source: "square",
      });
      console.log("Using HTTPS localhost URL for Square:", { finalRedirectUrl });
    } else if (!redirectUrl) {
      // Use dummy HTTPS URL for other cases
      const dummyBase = "https://example.com/checkout";
      finalRedirectUrl = appendParamsToUrl(dummyBase, {
        token: idempotencyKey,
        source: "square",
      });
      console.log("Using dummy URL:", { finalRedirectUrl });
    }

    // For localhost development, use HTTPS URLs to satisfy Square's requirements
    if (!redirectUrl && originReturn && originReturn.startsWith("http://localhost")) {
      // Convert localhost HTTP to HTTPS for Square (won't actually redirect but enables proper checkout)
      const httpsBase = originReturn.replace("http://", "https://");
      finalRedirectUrl = appendParamsToUrl(httpsBase, {
        token: idempotencyKey,
        source: "square",
      });
      console.log("Using HTTPS localhost URL for Square:", { finalRedirectUrl });
    } else if (!redirectUrl) {
      // Use dummy HTTPS URLs for other cases
      const dummyBase = "https://example.com/checkout";
      finalRedirectUrl = appendParamsToUrl(dummyBase, {
        token: idempotencyKey,
        source: "square",
      });
      console.log("Using dummy URL:", { finalRedirectUrl });
    }

    const canUseDetailedItems = cartDetails.items.every(
        (item) => Number.isInteger(item.itemPrice) && item.itemPrice > 0,
    );
    
    const lineItems = [];
    
    if (canUseDetailedItems) {
      // Add product line items
      cartDetails.items.forEach((item) => {
        lineItems.push({
          name: item.name || item.productId,
          quantity: String(item.qty),
          base_price_money: {
            amount: Number(item.itemPrice),
            currency: currencyCode,
          },
          note: item.productId,
        });
      });
      
      // Add delivery line items (grouped by delivery cost)
      const deliveryGroups = {};
      cartDetails.items.forEach((item) => {
        if (item.deliveryCost > 0) {
          const key = `delivery_${item.deliveryCost}`;
          if (!deliveryGroups[key]) {
            deliveryGroups[key] = {
              cost: item.deliveryCost,
              quantity: 0,
              name: "Delivery"
            };
          }
          deliveryGroups[key].quantity += item.qty;
        }
      });
      
      Object.values(deliveryGroups).forEach((delivery) => {
        lineItems.push({
          name: delivery.name,
          quantity: String(delivery.quantity),
          base_price_money: {
            amount: Number(delivery.cost),
            currency: currencyCode,
          },
          note: "shipping",
        });
      });
    } else {
      // Fallback to single total line item
      lineItems.push({
        name: summary || "Nature & Steel Order",
        quantity: "1",
        base_price_money: {
          amount: totalAmount,
          currency: currencyCode,
        },
      });
    }

    const orderPayload = {
      location_id: locationId,
      reference_id: idempotencyKey,
      line_items: lineItems,
    };
    if (summary) {
      orderPayload.note = summary.slice(0, 500);
    }

    const checkoutOptions = {
      allow_tipping: false,
      ask_for_shipping_address: true, // Ensure Square collects a shipping address for fulfilment
    };
  if (finalRedirectUrl) checkoutOptions.redirect_url = finalRedirectUrl;
  // Remove cancel_url to test if Square shows default cancel button
  // if (finalCancelUrl) checkoutOptions.cancel_url = finalCancelUrl;

    const normalizedCountry = typeof countryCode === "string" && countryCode.trim() ? countryCode.trim().toUpperCase() : undefined;
    const prePopulated = {};
    if (userEmail) prePopulated.buyer_email = String(userEmail).trim();
    if (address || city || postcode || normalizedCountry) {
      const shippingAddress = {
        address_line_1: address || undefined,
        locality: city || undefined,
        postal_code: postcode || undefined,
        country: normalizedCountry || undefined,
      };
      prePopulated.buyer_address = shippingAddress;
      prePopulated.shipping_address = shippingAddress;
    }

    const requestBody = {
      idempotency_key: idempotencyKey,
      order: orderPayload,
      checkout_options: checkoutOptions,
    };
    if (Object.keys(prePopulated).length > 0) {
      requestBody.pre_populated_data = prePopulated;
    }

    console.log("Square API request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${base}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(`Square payment link API error ${response.status}: ${text}`);
      error.status = response.status;
      error.responseBody = text;
      throw error;
    }

    const payload = await response.json();
    console.log("Square API response:", JSON.stringify(payload, null, 2));
    
    const link = payload && payload.payment_link;
    if (!link || !link.url) {
      throw new Error("Square payment link response missing url");
    }

    const orderId = link.order_id || null;
    const paymentLinkId = link.id || null;
    const docId = orderId || paymentLinkId || idempotencyKey;

    initAdmin();
    const db = getFirestore();
    const storedItems = cartDetails.items.map((item) => ({
      productId: item.productId,
      artistId: item.artistId || null,
      material: item.material || null,
      name: item.name || null,
      qty: item.qty,
      unitPrice: Number.isInteger(item.unitPrice) ? Number(item.unitPrice) : null,
      image: item.image || null,
      images: Array.isArray(item.images) ? item.images.slice(0, 10) : [],
    }));

    const orderRecord = {
      id: docId,
      status: "PENDING",
      created: Timestamp.now(),
      amount: totalAmount,
      catalogAmount: cartDetails.total || null,
      currency: currencyCode,
      itemsSummary: summary,
      items: storedItems,
      itemsJson: sanitizedItemsJson,
      customer: {
        name: typeof userName === "string" ? userName.trim() : null,
        email: userEmail || null,
        address: address || null,
        city: city || null,
        postcode: postcode || null,
        countryCode: normalizedCountry || null,
      },
      paymentLinkId: paymentLinkId,
      paymentLinkUrl: link.url,
      squareOrderId: orderId,
      squareLocationId: locationId,
      environment,
      idempotencyKey,
      quickPay: !canUseDetailedItems,
      returnUrl: finalRedirectUrl || null,
      cancelUrl: null, // Not using cancel_url parameter
      source: "square-payment-link",
    };

    await db.collection("orders").doc(docId).set(orderRecord, {merge: true});

    return {
      checkoutUrl: link.url,
      paymentLinkId,
      orderId,
      expiresAt: link.expires_at || null,
      redirectConfigured: Boolean(finalRedirectUrl),
      returnToken: idempotencyKey,
    };
  } catch (err) {
    console.error("createSquareCheckoutLink error:", err);
    if (err instanceof HttpsError) throw err;
    const message = err && err.message ? err.message : "Failed to create Square checkout";
    const status = typeof err?.status === "number" ? err.status : undefined;
    const code = (() => {
      if (status === 400) return "invalid-argument";
      if (status === 401) return "unauthenticated";
      if (status === 403) return "permission-denied";
      if (status === 404) return "not-found";
      if (status === 429) return "resource-exhausted";
      if (status && status >= 500) return "internal";
      return "internal";
    })();
    const details = {message};
    if (status != null) details.status = status;
    if (err && typeof err.responseBody === "string" && err.responseBody) {
      details.response = err.responseBody.slice(0, 2000);
    }
    throw new HttpsError(code, message, details);
  }
});

// Initialize Admin SDK once
function initAdmin() {
  if (adminInitialized) return;
  try {
    console.log("[functions] Checking Firebase Admin apps:", getApps().length);
    console.log("[functions] App names:", getApps().map(app => app.name));
    
    // Try to get the default app first
    try {
      getApp(); // This will throw if no default app exists
      console.log("[functions] Default Firebase Admin app already exists");
    } catch (e) {
      console.log("[functions] Default app doesn't exist, initializing...");
      // Initialize with credentials for functions environment
      initializeApp({
        projectId: process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : undefined,
      });
      console.log("[functions] Firebase Admin app initialized");
    }
    
    adminInitialized = true;
    console.log("[functions] Firebase Admin initialization complete");
  } catch (e) {
    console.error("[functions] Failed to initialize Firebase Admin:", e);
    console.error("[functions] Environment check:", {
      hasFirebaseConfig: !!process.env.FIREBASE_CONFIG,
      firebaseConfig: process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : 'parse-error',
      functionsEmulator: IS_EMULATOR,
      appsLength: getApps().length,
      appNames: getApps().map(app => app.name)
    });
    throw e;
  }
}

// Process Square payment after client tokenizes the card
exports.processSquarePayment = onCall({secrets: [squareAccessToken, squareEnvironment]}, async (request) => {
  try {
    assertAppCheck(request);
    // Initialize Square client
  const accessToken = getSquareAccessToken();
    if (!accessToken) {
      throw new HttpsError(
          "failed-precondition",
          "Square access token not configured",
      );
    }

  const environment = getSquareEnvironment();

    const {sourceId, amount, currency, locationId, itemsSummary,
      itemsJson, userEmail, userName, verificationToken,
      address, city, postcode, countryCode} = request.data || {};

    if (!sourceId || !amount || !locationId) {
      throw new HttpsError(
          "invalid-argument",
          "Missing required payment parameters",
      );
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpsError(
          "invalid-argument",
          "Invalid amount",
          {details: "Amount must be a positive integer in minor units (e.g., pence)."},
      );
    }

    if (currency && typeof currency !== "string") {
      throw new HttpsError("invalid-argument", "Currency must be a string");
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
    await adjustInventoryForOrder(parsedItems);

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
exports.squareWebhook = onRequest({
  cors: true,
  secrets: [squareWebhookSecret],
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  try {
    const whSecret = readSecret(squareWebhookSecret, "SQUARE_WEBHOOK_SECRET");

    if (!whSecret) {
      console.error("[squareWebhook] Missing SQUARE_WEBHOOK_SECRET");
      res.status(400).send("Webhook secret not configured");
      return;
    }

    const fallbackPath = process.env.SQUARE_WEBHOOK_PATH || "/squareWebhook";
    const validation = validateSquareSignature(req, whSecret, {fallbackPath});

    if (!validation.valid) {
      if (validation.code === "missing-signature") {
        console.error("[squareWebhook] Missing signature header");
        res.status(400).send("Missing signature");
        return;
      }

      if (validation.code === "invalid-encoding") {
        console.error("[squareWebhook] Failed to decode signatures", validation.error);
        res.status(400).send("Invalid signature encoding");
        return;
      }

      if (validation.code === "mismatch") {
        const ctx = validation.context;
        console.error("[squareWebhook] Invalid signature", {
          signatureHeader: ctx.signatureHeader.slice(0, 8),
          expectedPreview: ctx.expectedSignature.slice(0, 8),
          requestUrl: ctx.requestUrl,
          signatureVersion: ctx.signatureVersion,
          sentAtPreview: ctx.sentAt.slice(0, 8),
          urlHeaderPreview: typeof ctx.urlHeader === "string" ? ctx.urlHeader.slice(0, 32) : null,
          derivedPath: ctx.pathFromRequest,
          normalizedPath: ctx.normalizedPath,
          rawBodyType: ctx.rawBodyType,
          rawBodyIsBuffer: ctx.rawBodyIsBuffer,
        });
        res.status(400).send("Invalid signature");
        return;
      }

      res.status(400).send(validation.message || "Invalid signature");
      return;
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

      const orderId = payment.order_id || null;
      const paymentLinkId = payment.payment_link_id || null;
      const candidates = Array.from(new Set([
        orderId,
        paymentLinkId,
        payment.id,
      ].filter(Boolean)));

      let orderRef = null;
      let orderSnap = null;
      for (const candidate of candidates) {
        const ref = db.collection("orders").doc(candidate);
        const snap = await ref.get();
        if (snap.exists) {
          orderRef = ref;
          orderSnap = snap;
          break;
        }
        if (!orderRef) {
          orderRef = ref;
          orderSnap = snap;
        }
      }
      if (!orderRef) {
        orderRef = db.collection("orders").doc(payment.id);
        orderSnap = await orderRef.get();
      }

      const existing = orderSnap && orderSnap.exists ? orderSnap.data() : null;
      const customer = Object.assign({}, existing && existing.customer ? existing.customer : {});
      if (payment.buyer_email_address) {
        customer.email = payment.buyer_email_address;
      }

      // Capture buyer name if available from Square payment
      if (payment.billing_address && payment.billing_address.first_name) {
        const firstName = payment.billing_address.first_name;
        const lastName = payment.billing_address.last_name || '';
        customer.name = `${firstName} ${lastName}`.trim();
      }

      // Also check shipping address for name
      if (!customer.name && payment.shipping_address && payment.shipping_address.first_name) {
        const firstName = payment.shipping_address.first_name;
        const lastName = payment.shipping_address.last_name || '';
        customer.name = `${firstName} ${lastName}`.trim();
      }

      const orderUpdate = {
        id: orderRef.id,
        amount: Number(payment.amount_money.amount),
        currency: payment.amount_money.currency,
        status: payment.status,
        completed: Timestamp.now(),
        itemsSummary: payment.note || (existing && existing.itemsSummary) || "",
        customer,
        squarePaymentId: payment.id,
        squareOrderId: payment.order_id || (existing && existing.squareOrderId) || null,
        squareReceiptUrl: payment.receipt_url || (existing && existing.squareReceiptUrl) || null,
        paymentLinkId: existing && existing.paymentLinkId ? existing.paymentLinkId : paymentLinkId || null,
      };

      if (!orderSnap || !orderSnap.exists) {
        orderUpdate.created = Timestamp.now();
      }

      await orderRef.set(orderUpdate, {merge: true});
      console.log("[squareWebhook] Order stored/updated:", orderRef.id);

      const storedItems = (existing && Array.isArray(existing.items)) ? existing.items : (() => {
        try {
          if (existing && typeof existing.itemsJson === "string") {
            const parsed = JSON.parse(existing.itemsJson);
            if (Array.isArray(parsed)) return parsed;
          }
          if (payment && payment.order && Array.isArray(payment.order.line_items)) {
            return payment.order.line_items.map((line) => ({
              productId: line.note || null,
              qty: Number(line.quantity) || 0,
            })).filter((line) => line.productId && line.qty > 0);
          }
        } catch {}
        return [];
      })();

      const stockAlreadyAdjusted = existing && existing.stockAdjusted;
      if (!stockAlreadyAdjusted && storedItems.length > 0) {
        await adjustInventoryForOrder(storedItems);
        await orderRef.set({stockAdjusted: true}, {merge: true});
      }
    }

    res.status(200).send({received: true});
  } catch (err) {
    console.error("[squareWebhook] error:", err);
    res.status(400).send(`Webhook Error: ${err.message || "unknown"}`);
  }
});

// Diagnostics: list merchant and locations using current Square access token
exports.squareDiagnostics = onCall({secrets: [squareAccessToken, squareEnvironment]}, async (request) => {
  try {
    assertAppCheck(request);
    const secretCandidate = (typeof squareAccessToken.value === "function") ? squareAccessToken.value() : undefined;
    const fromEnv = !(secretCandidate && String(secretCandidate).trim() !== "");
    const accessToken = getSquareAccessToken();
    if (!accessToken) {
      throw new HttpsError("failed-precondition", "Square access token not configured");
    }
    // Determine target env for normal use
  const environment = getSquareEnvironment();

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
  environment: getSquareEnvironment(),
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

exports.getOrderStatus = onCall({}, async (request) => {
  try {
    assertAppCheck(request);
    const {orderId: rawOrderId, token: rawToken} = request.data || {};
    const orderId = typeof rawOrderId === "string" ? rawOrderId.trim() : "";
    const token = typeof rawToken === "string" ? rawToken.trim() : "";

    if (!orderId && !token) {
      throw new HttpsError(
          "invalid-argument",
          "Either orderId or token is required to look up an order.",
      );
    }

    initAdmin();
    const db = getFirestore();
    let docSnap = null;

    if (orderId) {
      const docRef = db.collection("orders").doc(orderId);
      const candidate = await docRef.get();
      if (candidate.exists) {
        docSnap = candidate;
      }
    }

    if (!docSnap && token) {
      const querySnap = await db.collection("orders")
          .where("idempotencyKey", "==", token)
          .limit(1)
          .get();
      if (!querySnap.empty) {
        docSnap = querySnap.docs[0];
      }
    }

    if (!docSnap) {
      return {status: "NOT_FOUND"};
    }

    const data = docSnap.data() || {};
    return {
      orderId: docSnap.id,
      status: data.status || null,
      amount: data.amount ?? null,
      currency: data.currency || null,
      paymentId: data.squarePaymentId || null,
      paymentLinkId: data.paymentLinkId || null,
      squareOrderId: data.squareOrderId || null,
      receiptUrl: data.squareReceiptUrl || null,
      environment: data.environment || null,
      token: data.idempotencyKey || null,
      createdAt: data.created ? data.created.toDate().toISOString() : null,
      updatedAt: data.completed ? data.completed.toDate().toISOString() : null,
    };
  } catch (err) {
    console.error("getOrderStatus error:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Failed to load order status", {message: err && err.message});
  }
});

// Helper function to check if an email is an admin
async function isUserAdmin(userEmail) {
  // Get admin emails from secret
  const adminEmailsList = adminEmails.value().split(',').map(email => email.trim().toLowerCase());
  
  // Check if user is in secret list
  const isInSecret = adminEmailsList.includes(userEmail.toLowerCase());
  
  // Also check Firestore document if it exists
  let isInDocument = false;
  try {
    initAdmin();
    const db = getFirestore();
    const configSnap = await db.collection('config').doc('adminEmails').get();
    if (configSnap.exists) {
      const docEmails = configSnap.data().emails || [];
      isInDocument = docEmails.includes(userEmail.toLowerCase());
    }
  } catch (err) {
    console.warn("Failed to check admin document:", err);
  }
  
  return isInSecret || isInDocument;
}

exports.checkAdminStatus = onCall({secrets: [adminEmails]}, async (request) => {
  if (IS_EMULATOR || !REQUIRE_APP_CHECK) {
    // Skip App Check in emulator or when disabled
  } else {
    // Verify App Check token
    try {
      await getAppCheck().verifyToken(request.appCheckToken);
    } catch (err) {
      console.warn("App Check verification failed:", err);
      throw new HttpsError("unauthenticated", "Invalid app check token");
    }
  }

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const userEmail = request.auth.token.email;
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "User email not available");
  }

  const isAdmin = await isUserAdmin(userEmail);
  
  return { isAdmin };
});

exports.getAdminEmails = onCall({secrets: [adminEmails]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const userEmail = request.auth.token.email;
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "User email not available");
  }

  // Get admin emails from secret
  const adminEmailsList = adminEmails.value().split(',').map(email => email.trim().toLowerCase());
  
  // Check if user is in secret list
  if (!adminEmailsList.includes(userEmail.toLowerCase())) {
    throw new HttpsError("permission-denied", "Only admins can view admin emails");
  }
  
  // Try to get emails from Firestore, fall back to secret if it fails
  let currentEmails = adminEmailsList;
  try {
    initAdmin();
    const db = getFirestore();
    const configSnap = await db.collection('config').doc('adminEmails').get();
    if (configSnap.exists && configSnap.data().emails) {
      currentEmails = configSnap.data().emails;
    }
  } catch (err) {
    console.warn("Failed to get admin emails from Firestore, using secret:", err.message);
    // Continue with secret emails
  }
  
  return { 
    success: true, 
    emails: currentEmails
  };
});

exports.initializeAdminConfig = onCall({secrets: [adminEmails]}, async (request) => {
  if (IS_EMULATOR || !REQUIRE_APP_CHECK) {
    // Skip App Check in emulator or when disabled
  } else {
    // Verify App Check token
    try {
      await getAppCheck().verifyToken(request.appCheckToken);
    } catch (err) {
      console.warn("App Check verification failed:", err);
      throw new HttpsError("unauthenticated", "Invalid app check token");
    }
  }

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  // Allow initialization if user is in secret list OR if config doesn't exist yet (first-time setup)
  const userEmail = request.auth.token.email;
  const adminEmailsList = adminEmails.value().split(',').map(email => email.trim().toLowerCase());
  const isInSecretList = adminEmailsList.includes(userEmail.toLowerCase());
  
  try {
    initAdmin();
    
    // Check if config already exists
    const db = getFirestore();
    const configRef = db.collection('config').doc('adminEmails');
    const configSnap = await configRef.get();
    const configExists = configSnap.exists;
    
    if (!isInSecretList && configExists) {
      throw new HttpsError("permission-denied", "Only admins can initialize admin config");
    }
    
    // Get current admin config or initialize with secret emails
    let currentEmails = [];
    if (configExists) {
      currentEmails = configSnap.data().emails || [];
    } else {
      // Initialize with the secret emails
      currentEmails = adminEmailsList;
    }

    // Add any additional emails from request
    const hasAdditionalEmails = request.data && request.data.additionalEmails && Array.isArray(request.data.additionalEmails) && request.data.additionalEmails.length > 0;
    let emailsChanged = false;
    
    if (hasAdditionalEmails) {
      const newEmails = request.data.additionalEmails
        .map(email => email.trim().toLowerCase())
        .filter(email => email && email.includes('@') && !currentEmails.includes(email));
      if (newEmails.length > 0) {
        currentEmails = [...currentEmails, ...newEmails];
        emailsChanged = true;
      }
    }

    // Only update the document if there are changes or if we're initializing for the first time
    if (!configExists || emailsChanged) {
      await configRef.set({
        emails: currentEmails,
        lastModified: Timestamp.now(),
        lastModifiedBy: userEmail
      }, { merge: true });
    }
    
    return { 
      success: true, 
      message: 'Admin configuration updated',
      emails: currentEmails
    };
  } catch (err) {
    console.error("initializeAdminConfig error:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Failed to update admin config");
  }
});

exports.addAdminEmail = onCall({secrets: [adminEmails]}, async (request) => {
  const userEmail = request.auth?.token?.email;
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    initAdmin();
    const db = getFirestore();
    
    // Check if the requesting user is an admin
    const isAdmin = await isUserAdmin(userEmail);
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Only admins can add new admin emails");
    }

    const newEmail = request.data?.email?.trim()?.toLowerCase();
    if (!newEmail || !newEmail.includes('@')) {
      throw new HttpsError("invalid-argument", "Valid email address required");
    }

    // Get current admin config
    const configRef = db.collection('config').doc('adminEmails');
    const configSnap = await configRef.get();
    
    let currentEmails = [];
    if (configSnap.exists) {
      currentEmails = configSnap.data().emails || [];
    }

    // Check if email already exists
    if (currentEmails.includes(newEmail)) {
      throw new HttpsError("already-exists", "Email is already an admin");
    }

    // Add the new email
    currentEmails.push(newEmail);

    // Update the document
    await configRef.set({
      emails: currentEmails,
      lastModified: Timestamp.now(),
      lastModifiedBy: userEmail
    }, { merge: true });
    
    return { 
      success: true, 
      message: `Added ${newEmail} as admin`,
      emails: currentEmails
    };
  } catch (err) {
    console.error("addAdminEmail error:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Failed to add admin email");
  }
});

exports.removeAdminEmail = onCall({secrets: [adminEmails]}, async (request) => {
  const userEmail = request.auth?.token?.email;
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    initAdmin();
    const db = getFirestore();
    
    // Check if the requesting user is an admin
    const isAdmin = await isUserAdmin(userEmail);
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Only admins can remove admin emails");
    }

    const emailToRemove = request.data?.email?.trim()?.toLowerCase();
    if (!emailToRemove || !emailToRemove.includes('@')) {
      throw new HttpsError("invalid-argument", "Valid email address required");
    }

    // Prevent removing your own email
    if (emailToRemove === userEmail) {
      throw new HttpsError("invalid-argument", "Cannot remove your own admin email");
    }

    // Get current admin config
    const configRef = db.collection('config').doc('adminEmails');
    const configSnap = await configRef.get();
    
    let currentEmails = [];
    if (configSnap.exists) {
      currentEmails = configSnap.data().emails || [];
    }

    // Check if email exists
    if (!currentEmails.includes(emailToRemove)) {
      throw new HttpsError("not-found", "Email is not an admin");
    }

    // Remove the email
    currentEmails = currentEmails.filter(email => email !== emailToRemove);

    // Update the document
    await configRef.set({
      emails: currentEmails,
      lastModified: Timestamp.now(),
      lastModifiedBy: userEmail
    }, { merge: true });
    
    return { 
      success: true, 
      message: `Removed ${emailToRemove} from admins`,
      emails: currentEmails
    };
  } catch (err) {
    console.error("removeAdminEmail error:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Failed to remove admin email");
  }
});

exports.cleanupPendingOrders = onSchedule("every 24 hours", async () => {
  try {
    initAdmin();
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(Date.now() - 48 * 60 * 60 * 1000);
    const snapshot = await db.collection("orders")
      .where("status", "==", "PENDING")
      .where("created", "<", cutoff)
      .limit(200)
      .get();
    if (snapshot.empty) {
      console.log("[cleanupPendingOrders] nothing to remove");
      return;
    }

    // Restore inventory for each order before deleting
    for (const doc of snapshot.docs) {
      const orderData = doc.data();
      if (orderData.items && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          try {
            const productId = String(item?.productId);
            const qty = Number(item?.qty);
            if (!productId || !Number.isInteger(qty) || qty <= 0) continue;
            
            await db.runTransaction(async (tx) => {
              const productRef = db.collection("furniture").doc(productId);
              const productSnap = await tx.get(productRef);
              if (!productSnap.exists) return;
              
              const productData = productSnap.data() || {};
              if (typeof productData.stock === 'number') {
                const newStock = productData.stock + qty;
                tx.update(productRef, { stock: newStock });
              }
            });
            
            console.log(`[cleanupPendingOrders] Restored stock for ${productId}: +${qty}`);
          } catch (err) {
            console.error(`[cleanupPendingOrders] Failed to restore stock for ${item?.productId}:`, err);
          }
        }
      }
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`[cleanupPendingOrders] deleted ${snapshot.size} pending orders older than 48h`);
  } catch (err) {
    console.error("[cleanupPendingOrders] error:", err);
  }
});

// (adminAddItem removed after use for security)

exports._normalizeSquareRequest = normalizeSquareRequest;
exports._validateSquareSignature = validateSquareSignature;
