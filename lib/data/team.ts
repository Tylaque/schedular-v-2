import { db } from "@/lib/db";
import type { AdminRole } from "@prisma/client";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  accountType: string | null;
  ownedProjectNames: string[];
  assignedProjectNames: string[];
};

export async function listTeamMembers(): Promise<TeamMember[]> {
  const admins = await db.admin.findMany({
    orderBy: { name: "asc" },
    include: {
      ownedProjects: { select: { name: true } },
      projectAssignments: { select: { project: { select: { name: true } } } },
    },
  });

  return admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    accountType: a.accountType,
    ownedProjectNames: a.ownedProjects.map((p) => p.name),
    assignedProjectNames: a.projectAssignments.map((pa) => pa.project.name),
  }));
}

export async function changeAdminRole(
  actorAdminId: string,
  targetAdminId: string,
  newRole: AdminRole
): Promise<
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_org_owner"
        | "target_not_found"
        | "cannot_demote_last_org_owner"
        | "self_demotion_blocked";
    }
> {
  const actor = await db.admin.findUnique({
    where: { id: actorAdminId },
    select: { role: true },
  });
  if (!actor || actor.role !== "org_owner") {
    return { ok: false, reason: "not_org_owner" };
  }

  const target = await db.admin.findUnique({
    where: { id: targetAdminId },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!target) {
    return { ok: false, reason: "target_not_found" };
  }

  // Self-demotion blocked
  if (actorAdminId === targetAdminId) {
    const roleHierarchy: Record<string, number> = {
      admin: 0,
      super_admin: 1,
      org_owner: 2,
    };
    if (roleHierarchy[newRole] < roleHierarchy[target.role]) {
      return { ok: false, reason: "self_demotion_blocked" };
    }
  }

  // Cannot demote the last org_owner
  if (
    target.role === "org_owner" &&
    newRole !== "org_owner"
  ) {
    const orgOwnerCount = await db.admin.count({
      where: { role: "org_owner" },
    });
    if (orgOwnerCount <= 1) {
      return { ok: false, reason: "cannot_demote_last_org_owner" };
    }
  }

  const oldRole = target.role;

  await db.$transaction([
    db.admin.update({
      where: { id: targetAdminId },
      data: { role: newRole },
    }),
    db.auditLog.create({
      data: {
        action: "role_changed",
        actorType: "admin",
        actorId: actorAdminId,
        actorLabel: `${actorAdminId}`,
        entityType: "Admin",
        entityId: targetAdminId,
        beforeState: { role: oldRole },
        afterState: { role: newRole },
      },
    }),
  ]);

  return { ok: true };
}

export async function promoteToOrgOwner(
  actorAdminId: string,
  targetAdminId: string,
  confirmationPhrase: string
): Promise<
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_org_owner"
        | "target_not_found"
        | "confirmation_mismatch";
    }
> {
  const actor = await db.admin.findUnique({
    where: { id: actorAdminId },
    select: { role: true },
  });
  if (!actor || actor.role !== "org_owner") {
    return { ok: false, reason: "not_org_owner" };
  }

  const target = await db.admin.findUnique({
    where: { id: targetAdminId },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!target) {
    return { ok: false, reason: "target_not_found" };
  }

  // Confirmation phrase must match target's email exactly
  if (confirmationPhrase !== target.email) {
    return { ok: false, reason: "confirmation_mismatch" };
  }

  const oldRole = target.role;

  await db.$transaction([
    db.admin.update({
      where: { id: targetAdminId },
      data: { role: "org_owner" },
    }),
    db.auditLog.create({
      data: {
        action: "role_changed",
        actorType: "admin",
        actorId: actorAdminId,
        actorLabel: `${actorAdminId}`,
        entityType: "Admin",
        entityId: targetAdminId,
        beforeState: { role: oldRole },
        afterState: { role: "org_owner" },
      },
    }),
  ]);

  return { ok: true };
}
