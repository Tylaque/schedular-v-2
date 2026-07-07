import { NextRequest, NextResponse } from "next/server";
import { getAdminAvailability } from "@/lib/data/availability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  const adminId = request.nextUrl.searchParams.get("adminId");

  if (!projectId || !adminId) {
    return NextResponse.json({ error: "projectId and adminId are required" }, { status: 400 });
  }

  const entries = await getAdminAvailability(projectId, adminId);
  return NextResponse.json(entries);
}
