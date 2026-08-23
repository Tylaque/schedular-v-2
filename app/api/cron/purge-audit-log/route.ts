import { NextResponse } from "next/server";
import { purgeAuditAndNotificationLogs } from "@/lib/data/audit-retention";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron:purge-audit-log] START");
  const results = await purgeAuditAndNotificationLogs();
  console.log("[cron:purge-audit-log] DONE", results);

  return NextResponse.json(results);
}
