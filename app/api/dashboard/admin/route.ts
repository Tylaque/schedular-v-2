import { NextRequest, NextResponse } from "next/server";
import { getAdminDashboardData } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const adminId = request.nextUrl.searchParams.get("adminId");
  if (!adminId) {
    return NextResponse.json({ error: "adminId is required" }, { status: 400 });
  }
  const data = await getAdminDashboardData(adminId);
  if (!data) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
