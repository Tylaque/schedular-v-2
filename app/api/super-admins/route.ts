import { auth } from "@/auth";
import { isOrgOwner, isSuperAdmin } from "@/lib/authz";
import { listSuperAdmins } from "@/lib/data/admins";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (!isOrgOwner(role) && !isSuperAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admins = await listSuperAdmins();
  return NextResponse.json(admins);
}
