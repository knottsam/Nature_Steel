const functions = require("firebase-functions");
const stripeLib = require("stripe");
require("dotenv").config();

const stripe = stripeLib(process.env.STRIPE_SECRET_KEY);

exports.createPaymentIntent = functions.https.onCall(
    async (data, context) => {
      const {amount, currency = "gbp"} = data;
      if (!amount) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Amount required",
        );
      }
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
        });
        return {clientSecret: paymentIntent.client_secret};
      } catch (err) {
        throw new functions.https.HttpsError(
            "internal",
            err.message,
        );
      }
    },
);
