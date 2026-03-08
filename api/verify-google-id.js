/**
 * Serverless endpoint: verify Google ID token (JWT) and return the email.
 * POST body: { credential: "<jwt>" }
 * Returns: 200 { email } or 401.
 * Set GOOGLE_CLIENT_ID in the deployment env to validate aud.
 */

import crypto from "node:crypto";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(base64UrlDecode(parts[0])),
      payload: JSON.parse(base64UrlDecode(parts[1])),
      raw: { header: parts[0], payload: parts[1], signature: parts[2] },
    };
  } catch {
    return null;
  }
}

async function getSigningKey(kid) {
  const res = await fetch(JWKS_URL);
  const jwks = await res.json();
  const key = jwks.keys?.find((k) => k.kid === kid);
  return key || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
  const credential =
    typeof req.body?.credential === "string"
      ? req.body.credential
      : req.body && typeof req.body === "object" && "credential" in req.body
        ? req.body.credential
        : null;

  if (!credential) {
    res.status(400).json({ error: "Missing credential" });
    return;
  }

  const jwt = parseJwt(credential);
  if (!jwt) {
    res.status(401).json({ error: "Invalid token format" });
    return;
  }

  const { payload, header } = jwt;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp != null && payload.exp < now) {
    res.status(401).json({ error: "Token expired" });
    return;
  }
  const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
  if (payload.iss == null || !validIssuers.includes(payload.iss)) {
    res.status(401).json({ error: "Invalid issuer" });
    return;
  }
  if (clientId && payload.aud !== clientId) {
    res.status(401).json({ error: "Invalid audience" });
    return;
  }

  const key = await getSigningKey(header.kid);
  if (!key) {
    res.status(401).json({ error: "Unknown signing key" });
    return;
  }

  try {
    const message = `${jwt.raw.header}.${jwt.raw.payload}`;
    const signature = Buffer.from(
      jwt.raw.signature.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );
    const publicKey = crypto.createPublicKey({
      key: key,
      format: "jwk",
    });
    const valid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(message, "utf8"),
      publicKey,
      signature
    );
    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  } catch (err) {
    console.error("Verify error:", err);
    res.status(401).json({ error: "Verification failed" });
    return;
  }

  const email = (payload.email || "").trim().toLowerCase();
  if (!email) {
    res.status(401).json({ error: "No email in token" });
    return;
  }

  res.status(200).json({ email });
}
