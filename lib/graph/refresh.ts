import { db } from "@/lib/db";

const AZURE_AD_TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export async function refreshAzureToken(accountId: string): Promise<string | null> {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account?.refresh_token) return null;

  if (account.expires_at && Date.now() / 1000 < account.expires_at - 60) {
    return account.access_token;
  }

  try {
    const body = new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    });

    const res = await fetch(AZURE_AD_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const refreshed = await res.json();
    if (!res.ok) throw refreshed;

    await db.account.update({
      where: { id: accountId },
      data: {
        access_token: refreshed.access_token,
        expires_at: Math.floor(Date.now() / 1000 + refreshed.expires_in),
        refresh_token: refreshed.refresh_token ?? account.refresh_token,
      },
    });

    return refreshed.access_token;
  } catch (error) {
    console.error("Failed to refresh Azure token for account", accountId, error);
    return null;
  }
}
