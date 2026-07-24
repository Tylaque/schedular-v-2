import { auth } from "@/auth";
import { isOrgOwner, isSuperAdmin } from "@/lib/authz";
import { getAdminDashboardData } from "@/lib/data/dashboard";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminId = request.nextUrl.searchParams.get("adminId");
  if (!adminId) {
    return NextResponse.json({ error: "adminId is required" }, { status: 400 });
  }

  // Scope: admins can only view their own dashboard;
  // super_admin and org_owner can view any admin's dashboard.
  // Mirrors the dashboard page logic at app/admin/dashboard/page.tsx:51.
  const role = (session.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role) && session.user.id !== adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getAdminDashboardData(adminId);
  if (!data) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
