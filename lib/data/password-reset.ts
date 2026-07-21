import crypto from "crypto";
import { db } from "@/lib/db";

const TOKEN_EXPIRY_HOURS = 48;

export async function createPasswordToken(adminId: string): Promise<{
  token: string;
  rawToken: string;
}> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const token = crypto.createHash("sha256").update(rawToken).digest("hex");

  await db.passwordResetToken.create({
    data: {
      adminId,
      token,
      expires: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  return { token, rawToken };
}

export async function consumePasswordToken(
  rawToken: string
): Promise<{ adminId: string; name: string; email: string } | null> {
  const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");

  const resetToken = await db.passwordResetToken.findUnique({
    where: { token: hashed },
    include: { admin: { select: { id: true, name: true, email: true } } },
  });

  if (!resetToken) return null;
  if (resetToken.usedAt) return null;
  if (resetToken.expires < new Date()) return null;

  await db.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { usedAt: new Date() },
  });

  return { adminId: resetToken.admin.id, name: resetToken.admin.name, email: resetToken.admin.email };
}
