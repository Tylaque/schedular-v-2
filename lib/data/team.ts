import { db } from "@/lib/db";

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

/**
 * Change an admin's role between "admin" and "super_admin" only.
 *
 * Allowed for org_owner and super_admin callers (super_admin can manage
 * every associate system-wide on the Team page — a deliberate exception
 * to normal project-ownership scoping; everything else stays scoped).
 *
 * Org-owner can NEVER be set or removed through this path — ownership
 * changes only via the dedicated `promoteToOrgOwner` transfer flow,
 * which atomically demotes the current owner while promoting the new one.
 *
 * The current org_owner's role cannot be changed through this path either;
 * they can only lose org_owner via someone else being promoted.
 */
export async function changeAdminRole(
  actorAdminId: string,
  targetAdminId: string,
  newRole: "admin" | "super_admin"
): Promise<
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_allowed"
        | "target_not_found"
        | "cannot_change_org_owner_role";
    }
> {
  const actor = await db.admin.findUnique({
    where: { id: actorAdminId },
    select: { role: true, name: true, email: true },
  });
  if (!actor || (actor.role !== "org_owner" && actor.role !== "super_admin")) {
    return { ok: false, reason: "not_allowed" };
  }

  const target = await db.admin.findUnique({
    where: { id: targetAdminId },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!target) {
    return { ok: false, reason: "target_not_found" };
  }

  // org_owner's role cannot be changed via this path — only via promoteToOrgOwner transfer
  if (target.role === "org_owner") {
    return { ok: false, reason: "cannot_change_org_owner_role" };
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
        actorLabel: `${actor.name} <${actor.email}>`,
        entityType: "Admin",
        entityId: targetAdminId,
        beforeState: { role: oldRole },
        afterState: { role: newRole },
      },
    }),
  ]);

  return { ok: true };
}

/**
 * Transfer org ownership from the current owner to a new person.
 *
 * This is the ONLY way to change who the org_owner is. It performs an
 * atomic transaction that:
 *  1. Demotes the current org_owner (actorAdminId) to super_admin
 *     — they keep their projects and assignments, just lose the top-level tier.
 *  2. Promotes the target (targetAdminId) to org_owner.
 *  3. Writes a single org_ownership_transferred audit log entry.
 *
 * If either update fails, the entire transaction rolls back so there is
 * never a moment with zero or two org_owners.
 */
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
        | "already_org_owner"
        | "confirmation_mismatch";
    }
> {
  const actor = await db.admin.findUnique({
    where: { id: actorAdminId },
    select: { id: true, role: true, name: true, email: true },
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

  // Target is already the org_owner — no-op
  if (target.role === "org_owner") {
    return { ok: false, reason: "already_org_owner" };
  }

  // Confirmation phrase must match target's email exactly
  if (confirmationPhrase !== target.email) {
    return { ok: false, reason: "confirmation_mismatch" };
  }

  // Atomic transfer: demote current owner to super_admin, promote target
  await db.$transaction([
    db.admin.update({
      where: { id: actorAdminId },
      data: { role: "super_admin" },
    }),
    db.admin.update({
      where: { id: targetAdminId },
      data: { role: "org_owner" },
    }),
    db.auditLog.create({
      data: {
        action: "org_ownership_transferred",
        actorType: "admin",
        actorId: actorAdminId,
        actorLabel: `${actor.name} <${actor.email}>`,
        entityType: "Admin",
        entityId: targetAdminId,
        beforeState: {
          previousOwnerId: actorAdminId,
          previousOwnerEmail: actor.email,
        },
        afterState: {
          newOwnerId: targetAdminId,
          newOwnerEmail: target.email,
        },
      },
    }),
  ]);

  return { ok: true };
}
