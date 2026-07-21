import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admins = await db.admin.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  const accounts = await db.account.findMany({ orderBy: { expires_at: "desc" }, take: 5 });

  return NextResponse.json({
    admins: admins.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      accountType: a.accountType,
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      userId: a.userId,
      provider: a.provider,
      access_token_set: a.access_token !== null,
      refresh_token_set: a.refresh_token !== null,
      expires_at: a.expires_at ? new Date(a.expires_at * 1000).toISOString() : null,
    })),
  });
}
