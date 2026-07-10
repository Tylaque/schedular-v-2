import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.admin.count();
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[health] database probe failed:", message);
    const safe = message.length > 120 ? message.slice(0, 120) + "..." : message;
    return NextResponse.json(
      { status: "error", database: "unreachable", message: safe },
      { status: 503 }
    );
  }
}
