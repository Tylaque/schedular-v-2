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

export type SignInGate = { invited: boolean; deactivated: boolean };

/**
 * One-shot gate used by the Azure AD signIn callback: is this email an invited
 * admin, and (if so) has that account been soft-deactivated?
 *
 * Deactivated is a distinct outcome from "not invited": the person is a real,
 * known user hitting a real barrier, so the caller can show them an explicit
 * "account deactivated" message rather than the generic AccessDenied used for
 * unknown emails (which must stay generic to avoid leaking who's invited).
 */
export async function getAzureSignInGate(email: string): Promise<SignInGate> {
  const normalized = email.trim().toLowerCase();
  const admin = await db.admin.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, email: true, isActive: true },
  });
  console.log(`[AUTH-DEBUG] getAzureSignInGate: normalized="${normalized}" found=${!!admin} adminId=${admin?.id ?? "null"} adminEmail=${admin?.email ?? "null"} isActive=${admin?.isActive ?? "null"}`);
  if (!admin) return { invited: false, deactivated: false };
  return { invited: true, deactivated: !admin.isActive };
}
