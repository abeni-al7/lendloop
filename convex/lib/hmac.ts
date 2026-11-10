/**
 * HMAC-SHA256 signatures for webhooks in both directions.
 *
 * Header format: `X-LendLoop-Signature: t=<unix seconds>,v1=<hex hmac>`
 * Signed string:  `<t>.<raw body>`
 *
 * The timestamp stops replays of old requests; the body is signed byte for byte.
 */

export const SIGNATURE_HEADER = "X-LendLoop-Signature";
const MAX_SKEW_SECONDS = 300;

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signBody(secret: string, body: string, now = Date.now()): Promise<string> {
  const t = Math.floor(now / 1000);
  return `t=${t},v1=${await hmacHex(secret, `${t}.${body}`)}`;
}

export async function verifySignature(
  secret: string,
  header: string | null,
  body: string,
  now = Date.now(),
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1) return false;
  if (Math.abs(Math.floor(now / 1000) - t) > MAX_SKEW_SECONDS) return false;
  const expected = await hmacHex(secret, `${t}.${body}`);
  return timingSafeEqual(expected, parts.v1);
}

export function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} is not set or is shorter than 32 characters.`);
  }
  return value;
}
