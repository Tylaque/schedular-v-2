import { auth } from "@/auth";
import { isOrgOwner, isSuperAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { previewAdminUnavailableAction } from "@/lib/actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { adminId, fromDate, toDate } = await req.json();

  // Scope: org_owner / super_admin may target any admin; a regular admin
  // may only target an admin assigned to a project they own.
  const role = (session.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role)) {
    const inScope = await db.projectAdmin.findFirst({
      where: { adminId, project: { ownerId: session.user.id } },
      select: { id: true },
    });
    if (!inScope) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await previewAdminUnavailableAction(adminId, fromDate, toDate);
  return NextResponse.json(result);
}
