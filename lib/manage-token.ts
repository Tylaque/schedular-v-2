import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring token that unlocks the manage-booking page.
// Two scopes:
//   "p" (participant) — 30-minute TTL, issued after email verification
//   "a" (admin)       — 7-day TTL, embedded in booking-confirmation emails
//                       sent to admin/super_admin recipients
const PARTICIPANT_TTL_SECONDS = 30 * 60;
const ADMIN_TTL_SECONDS = 7 * 24 * 60 * 60;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required to sign manage-booking tokens");
  return s;
}

/**
 * Decode and verify a token, returning the raw payload parts.
 * Accepts both legacy 3-part (bookingId|email|expiry) and new
 * 4-part (bookingId|email|expiry|scope) payloads.
 */
function payloadParts(token: string): string[] | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const parts = payload.split("|");
  if (parts.length !== 3 && parts.length !== 4) return null;

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  let sigBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig);
    expectedBuf = Buffer.from(expected);
  } catch {
    return null;
  }
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  return parts;
}

/** Sign a participant-scoped token (30-minute TTL). */
export function signManageToken(bookingId: string, email: string): string {
  const expSec = Math.floor(Date.now() / 1000) + PARTICIPANT_TTL_SECONDS;
  const payload = `${bookingId}|${email.toLowerCase().trim()}|${expSec}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

/** Sign an admin-scoped token (7-day TTL). */
export function signManageAdminToken(bookingId: string, email: string): string {
  const expSec = Math.floor(Date.now() / 1000) + ADMIN_TTL_SECONDS;
  const payload = `${bookingId}|${email.toLowerCase().trim()}|${expSec}|a`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyManageToken(
  token: string
): { bookingId: string; email: string; scope: "p" | "a" } | null {
  const parts = payloadParts(token);
  if (!parts) return null;
  const [bookingId, email, expSec, scope] = parts;
  if (!bookingId || !email || !expSec) return null;
  if (Math.floor(Date.now() / 1000) > Number(expSec)) return null;
  return { bookingId, email, scope: scope === "a" ? "a" : "p" };
}
