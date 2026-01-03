"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const {
  _validateSquareSignature: validateSquareSignature,
} = require("../index");

const DEFAULT_HOST = "us-central1-nature-and-steel.cloudfunctions.net";
const DEFAULT_FALLBACK_PATH = "/squareWebhook";

function buildReq({
  body = {type: "payment.created"},
  headers = {},
  host = DEFAULT_HOST,
  path = "/",
  protocol = "https",
  forwardedProto,
  rawBody,
} = {}) {
  const json = rawBody ? rawBody.toString("utf8") : JSON.stringify(body);
  const resolvedRawBody = rawBody || Buffer.from(json, "utf8");
  const headerMap = {...headers};
  return {
    headers: headerMap,
    rawBody: resolvedRawBody,
    body,
    protocol,
    originalUrl: path,
    url: path,
    path,
    get: (header) => {
      const lower = (header || "").toLowerCase();
      if (lower === "host") return host;
      if (lower === "x-forwarded-proto") return forwardedProto;
      return undefined;
    },
  };
}

test("signature version 1 validates with normalized fallback path", () => {
  const secret = "test-secret";
  const body = {hello: "world"};
  const req = buildReq({body, path: "/"});

  const requestUrl = `https://${DEFAULT_HOST}${DEFAULT_FALLBACK_PATH}`;
  const payload = `${requestUrl}${JSON.stringify(body)}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64");
  req.headers["x-square-hmacsha256-signature"] = signature;

  const result = validateSquareSignature(req, secret, {fallbackPath: DEFAULT_FALLBACK_PATH});
  assert.ok(result.valid, "expected signature to validate");
  assert.equal(result.context.requestUrl, requestUrl);
  assert.equal(result.context.normalizedPath, DEFAULT_FALLBACK_PATH);
});

test("signature version 2 includes sent-at header in payload", () => {
  const secret = "another-secret";
  const body = {type: "payment.updated"};
  const sentAt = "2026-01-03T21:15:00Z";
  const req = buildReq({
    body,
    headers: {
      "x-square-signature-version": "2",
      "x-square-sent-at": sentAt,
    },
    path: "/squareWebhook",
  });

  const requestUrl = `https://${DEFAULT_HOST}/squareWebhook`;
  const payload = `${sentAt}${requestUrl}${JSON.stringify(body)}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64");
  req.headers["x-square-hmacsha256-signature"] = signature;

  const result = validateSquareSignature(req, secret, {fallbackPath: DEFAULT_FALLBACK_PATH});
  assert.ok(result.valid, "version 2 signature should validate");
  assert.equal(result.context.requestUrl, requestUrl);
  assert.equal(result.context.signatureVersion, "2");
});

test("mismatched signature fails when request URL is missing path", () => {
  const secret = "mismatch-secret";
  const body = {type: "payment.created"};
  const req = buildReq({body, path: "/"});

  // Simulate legacy signature that omitted the /squareWebhook suffix.
  const incorrectUrl = `https://${DEFAULT_HOST}/`;
  const incorrectPayload = `${incorrectUrl}${JSON.stringify(body)}`;
  const badSignature = crypto.createHmac("sha256", secret).update(incorrectPayload).digest("base64");
  req.headers["x-square-hmacsha256-signature"] = badSignature;

  const result = validateSquareSignature(req, secret, {fallbackPath: DEFAULT_FALLBACK_PATH});
  assert.equal(result.valid, false, "signature should fail when payload differs");
  assert.equal(result.code, "mismatch");
  assert.equal(result.context.normalizedPath, DEFAULT_FALLBACK_PATH);
  assert.equal(result.context.requestUrl, `https://${DEFAULT_HOST}${DEFAULT_FALLBACK_PATH}`);
});
