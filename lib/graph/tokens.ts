import { db } from "@/lib/db";
import { refreshAzureToken } from "@/lib/graph/refresh";

export type OwnerGraphStatus =
  | { connected: true; accountType: "organizational" | "personal"; accountId: string }
  | { connected: false; reason: "no_account" }
  | { connected: false; reason: "no_refresh_token" }
  | { connected: false; reason: "token_error" };

export async function getValidGraphAccessToken(ownerId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId: ownerId, provider: "azure-ad" },
  });
  if (!account?.refresh_token) return null;
  return refreshAzureToken(account.id);
}

export async function getOwnerGraphStatus(ownerId: string): Promise<OwnerGraphStatus> {
  const admin = await db.admin.findUnique({
    where: { id: ownerId },
    select: {
      accountType: true,
      accounts: {
        where: { provider: "azure-ad" },
        select: { id: true, refresh_token: true },
        take: 1,
      },
    },
  });

  if (!admin) return { connected: false, reason: "no_account" };
  const msAccount = admin.accounts[0];
  if (!msAccount) return { connected: false, reason: "no_account" };
  if (!msAccount.refresh_token) return { connected: false, reason: "no_refresh_token" };

  const token = await refreshAzureToken(msAccount.id);
  if (!token) return { connected: false, reason: "token_error" };

  return {
    connected: true,
    accountType: admin.accountType === "personal" ? "personal" : "organizational",
    accountId: msAccount.id,
  };
}
