import { db } from "@/lib/db";
import { AdminPrismaAdapter } from "@/lib/auth-adapter";

/**
 * Shared decision used by the NextAuth `signIn` callback: is this email an
 * invited admin who may sign in via Microsoft?
 *
 * An Admin row must already exist (case-insensitive email match). This is the
 * invite-gate: an uninvited Microsoft account is denied before Auth.js ever
 * creates/link-accounts a row.
 */
export async function isInvitedAdminEmail(email: string): Promise<boolean> {
  const adapter = AdminPrismaAdapter();
  let existing = await adapter.getUserByEmail(email);
  if (!existing) {
    existing = await db.admin.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
  }
  return !!existing;
}
