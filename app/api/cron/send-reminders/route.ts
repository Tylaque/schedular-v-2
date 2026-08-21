import { NextResponse } from "next/server";
import { sendReminders } from "@/lib/data/reminders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron:reminders] START");
  const results = await sendReminders();
  console.log("[cron:reminders] DONE", results);

  return NextResponse.json(results);
}
