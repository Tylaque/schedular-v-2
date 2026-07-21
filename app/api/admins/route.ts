import { auth } from "@/auth";
import { listAllAdmins } from "@/lib/data/admins";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !["org_owner", "super_admin"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admins = await listAllAdmins();
  return NextResponse.json(admins);
}
