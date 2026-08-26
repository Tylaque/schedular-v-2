import { createHash, randomInt } from "node:crypto";
import { db } from "@/lib/db";

const PIN_LENGTH = 6;
const PIN_TTL_MINUTES = 10;
const PIN_MAX_ATTEMPTS = 5;

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export function generatePin(): string {
  return String(randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, "0");
}

export async function createVerificationPin(
  bookingId: string,
  email: string
): Promise<{ pin: string; expiresAt: Date }> {
  // Invalidate any existing unused pins for this booking+email
  await db.verificationPin.updateMany({
    where: { bookingId, email, used: false },
    data: { used: true },
  });

  const pin = generatePin();
  const pinHash = hashPin(pin);
  const expiresAt = new Date(Date.now() + PIN_TTL_MINUTES * 60 * 1000);

  await db.verificationPin.create({
    data: {
      bookingId,
      email: email.toLowerCase().trim(),
      pinHash,
      expiresAt,
      maxAttempts: PIN_MAX_ATTEMPTS,
    },
  });

  return { pin, expiresAt };
}

export async function verifyPin(
  bookingId: string,
  email: string,
  pin: string
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "wrong_pin" }> {
  const record = await db.verificationPin.findFirst({
    where: {
      bookingId,
      email: email.toLowerCase().trim(),
      used: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "not_found" };
  if (record.used) return { ok: false, reason: "not_found" };
  if (new Date() > record.expiresAt) return { ok: false, reason: "expired" };
  if (record.attempts >= record.maxAttempts) return { ok: false, reason: "too_many_attempts" };

  const inputHash = hashPin(pin);
  if (inputHash !== record.pinHash) {
    // Increment attempts
    await db.verificationPin.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "wrong_pin" };
  }

  // Mark as used
  await db.verificationPin.update({
    where: { id: record.id },
    data: { used: true },
  });

  return { ok: true };
}
