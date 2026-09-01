import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetDemoProject } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron:reset-demo] START");
  const result = await resetDemoProject(db);
  console.log("[cron:reset-demo] DONE", JSON.stringify(result));
  return NextResponse.json(result);
}
