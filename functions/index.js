const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const stripeLib = require("stripe");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const admin = require("firebase-admin");
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

  const {amount, currency = "gbp", mode, itemsSummary, userEmail, userName} = request.data || {};

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {enabled: true},
      // Ask Stripe to email a receipt to the customer (free from Stripe)
      receipt_email: userEmail || undefined,
      metadata: {
        items: itemsSummary || "",
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
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp();
    }
    adminInitialized = true;
    // eslint-disable-next-line no-console
    console.log("[stripeWebhook] Firebase Admin initialized");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[stripeWebhook] Failed to initialize Firebase Admin:", e);
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
      const db = admin.firestore();
      const charge = (pi.charges && pi.charges.data && pi.charges.data[0]) || {};
      const billing = charge.billing_details || {};
      const shipping = pi.shipping || {};
      const email = billing.email || (pi.metadata && pi.metadata.userEmail) || null;
      const name = shipping.name || billing.name || (pi.metadata && pi.metadata.userName) || null;
      const items = (pi.metadata && pi.metadata.items) || "";
      const addr = shipping.address || billing.address || {};

      const order = {
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        created: admin.firestore.Timestamp.fromMillis((pi.created || Math.floor(Date.now()/1000)) * 1000),
        itemsSummary: items,
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
    }

    res.status(200).send({received: true});
  } catch (err) {
    console.error("webhook error:", err);
    res.status(400).send(`Webhook Error: ${err.message || "unknown"}`);
  }
});
