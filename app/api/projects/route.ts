import { auth } from "@/auth";
import { isOrgOwner, isSuperAdmin } from "@/lib/authz";
import { listProjects } from "@/lib/data/projects";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session?.user as any)?.role;
  const ownerId = isOrgOwner(role) || isSuperAdmin(role) ? undefined : session?.user?.id;
  const projects = await listProjects(ownerId);
  return NextResponse.json(projects);
}
