import { auth } from "@/auth";
import { canManageProject } from "@/lib/authz";
import { db } from "@/lib/db";
import { previewDateShiftAction } from "@/lib/actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { projectId, fromDate, toDate, offsetDays } = await req.json();

  // Scope: org_owner / super_admin may target any project; a regular admin
  // may only target a project they own.
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  const user = { id: session.user.id, role: (session.user as any)?.role as "admin" | "super_admin" | "org_owner" };
  if (!project || !canManageProject(user, project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await previewDateShiftAction(projectId, fromDate, toDate, offsetDays);
  return NextResponse.json(result);
}
