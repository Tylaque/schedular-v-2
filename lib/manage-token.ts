import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring token that unlocks the participant manage-booking page.
// Issued only after the participant's email matches the booking's email
// (see verifyManageEmail in app/manage/[bookingId]/actions.ts), so a leaked
// manage link alone exposes nothing — the bearer must also prove knowledge
// of the booking email to obtain a token.
const TOKEN_TTL_SECONDS = 30 * 60;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required to sign manage-booking tokens");
  return s;
}

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
  if (parts.length !== 3) return null;

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

export function signManageToken(bookingId: string, email: string): string {
  const expSec = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${bookingId}|${email.toLowerCase().trim()}|${expSec}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyManageToken(
  token: string
): { bookingId: string; email: string } | null {
  const parts = payloadParts(token);
  if (!parts) return null;
  const [bookingId, email, expSec] = parts;
  if (!bookingId || !email || !expSec) return null;
  if (Math.floor(Date.now() / 1000) > Number(expSec)) return null;
  return { bookingId, email };
}
