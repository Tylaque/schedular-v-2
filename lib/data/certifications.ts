import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import type { Prisma } from "@prisma/client";

export type CertificationRecord = {
  id: string;
  name: string;
  description: string;
};

export type ActorInfo = {
  actorId: string;
  actorLabel: string;
};

export async function listCertifications(): Promise<CertificationRecord[]> {
  return db.certification.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
}

export async function createCertification(
  input: { name: string; description?: string } & Partial<ActorInfo>
): Promise<CertificationRecord> {
  const name = input.name.trim();
  const description = input.description?.trim() ?? "";
  const certification = await db.certification.create({
    data: { name, description },
    select: { id: true, name: true, description: true },
  });
  if (input.actorId) {
    await recordAudit({
      action: "certification_created",
      actorType: "admin",
      actorId: input.actorId,
      actorLabel: input.actorLabel ?? "System Admin",
      entityType: "Certification",
      entityId: certification.id,
      afterState: { name, description },
    });
  }
  return certification;
}

export async function updateCertification(
  id: string,
  input: { name: string; description?: string } & Partial<ActorInfo>
): Promise<CertificationRecord | null> {
  const before = await db.certification.findUnique({
    where: { id },
    select: { name: true, description: true },
  });
  if (!before) return null;

  const name = input.name.trim();
  const description = input.description?.trim() ?? "";
  const certification = await db.certification.update({
    where: { id },
    data: { name, description },
    select: { id: true, name: true, description: true },
  });
  if (input.actorId) {
    await recordAudit({
      action: "certification_updated",
      actorType: "admin",
      actorId: input.actorId,
      actorLabel: input.actorLabel ?? "System Admin",
      entityType: "Certification",
      entityId: id,
      beforeState: before,
      afterState: { name, description },
    });
  }
  return certification;
}

/**
 * Delete a certification from the catalog.
 *
 * Deleting a certification intentionally cascades: every associate's
 * AdminCertification for it and every project's ProjectCertificationRequirement
 * referencing it are removed. This is deliberate — removing a certification type
 * from the catalog removes it from everyone and every project.
 */
export async function deleteCertification(
  id: string,
  actor?: ActorInfo
): Promise<boolean> {
  const before = await db.certification.findUnique({
    where: { id },
    select: { id: true, name: true, description: true },
  });
  if (!before) return false;

  await db.certification.delete({ where: { id } });
  if (actor) {
    await recordAudit({
      action: "certification_deleted",
      actorType: "admin",
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
      entityType: "Certification",
      entityId: id,
      beforeState: before,
    });
  }
  return true;
}

export type AdminCertificationRow = {
  adminId: string;
  certificationId: string;
  name: string;
  grantedAt: Date;
};

/** Flat rows of every admin's certifications, for group-by on Team / ProjectForm. */
export async function getCertificationAssignments(): Promise<AdminCertificationRow[]> {
  const rows = await db.adminCertification.findMany({
    select: {
      adminId: true,
      grantedAt: true,
      certification: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    adminId: r.adminId,
    certificationId: r.certification.id,
    name: r.certification.name,
    grantedAt: r.grantedAt,
  }));
}

export async function getAdminCertifications(adminId: string) {
  return db.adminCertification.findMany({
    where: { adminId },
    include: {
      certification: { select: { id: true, name: true, description: true } },
      grantedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { grantedAt: "desc" },
  });
}

/**
 * Replace the whole certification set for an associate.
 *
 * Semantics mirror setAdminRangesForDate: the provided list is the full set;
 * anything not in it is removed, anything in it is added. A certification is
 * applied via the "CertificationHolder" relation — the admin's certifications.
 */
export async function setAdminCertifications(input: {
  adminId: string;
  certificationIds: string[];
  actor: ActorInfo;
}): Promise<void> {
  const before = await db.adminCertification.findMany({
    where: { adminId: input.adminId },
    select: { certificationId: true },
  });
  const beforeIds = before.map((b) => b.certificationId);
  const afterIds = [...new Set(input.certificationIds)];

  await db.$transaction([
    db.adminCertification.deleteMany({ where: { adminId: input.adminId } }),
    ...afterIds.map((certificationId) =>
      db.adminCertification.create({
        data: {
          adminId: input.adminId,
          certificationId,
          grantedById: input.actor.actorId,
        },
      })
    ),
    db.auditLog.create({
      data: {
        action: "admin_certifications_set",
        actorType: "admin",
        actorId: input.actor.actorId,
        actorLabel: input.actor.actorLabel,
        entityType: "Admin",
        entityId: input.adminId,
        beforeState: { certificationIds: beforeIds },
        afterState: { certificationIds: afterIds },
      },
    }),
  ]);
}

export type ProjectCertificationRequirementRow = {
  certificationId: string;
  name: string;
  description: string;
};

export async function getProjectCertificationRequirements(
  projectId: string
): Promise<ProjectCertificationRequirementRow[]> {
  const rows = await db.projectCertificationRequirement.findMany({
    where: { projectId },
    select: {
      certification: { select: { id: true, name: true, description: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    certificationId: r.certification.id,
    name: r.certification.name,
    description: r.certification.description,
  }));
}

/**
 * Replace the whole required-certification set for a project.
 *
 * Same replace-whole-set semantics as setAdminCertifications. Zero requirements
 * means the project requires no certification at all.
 */
export async function setProjectCertificationRequirements(input: {
  projectId: string;
  certificationIds: string[];
  actor: ActorInfo;
}): Promise<void> {
  const before = await db.projectCertificationRequirement.findMany({
    where: { projectId: input.projectId },
    select: { certificationId: true },
  });
  const beforeIds = before.map((b) => b.certificationId);
  const afterIds = [...new Set(input.certificationIds)];

  await db.$transaction([
    db.projectCertificationRequirement.deleteMany({ where: { projectId: input.projectId } }),
    ...afterIds.map((certificationId) =>
      db.projectCertificationRequirement.create({
        data: { projectId: input.projectId, certificationId },
      })
    ),
    db.auditLog.create({
      data: {
        action: "project_certification_requirements_set",
        actorType: "admin",
        actorId: input.actor.actorId,
        actorLabel: input.actor.actorLabel,
        entityType: "Project",
        entityId: input.projectId,
        beforeState: { certificationIds: beforeIds },
        afterState: { certificationIds: afterIds },
      },
    }),
  ]);
}

/**
 * Eligibility: is this associate certified for this project's requirements?
 *
 * Zero ProjectCertificationRequirement rows = "no certification required",
 * so any associate is eligible (backward-compatible — existing projects
 * without requirements are unaffected).
 *
 * One-or-more requirements = the associate must hold ALL of them (AND, not OR).
 */
export async function isAdminCertifiedForProject(
  projectId: string,
  adminId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx ?? db;

  const required = await client.projectCertificationRequirement.findMany({
    where: { projectId },
    select: { certificationId: true },
  });
  if (required.length === 0) return true;

  const held = await client.adminCertification.findMany({
    where: {
      adminId,
      certificationId: { in: required.map((r) => r.certificationId) },
    },
    select: { certificationId: true },
  });
  const heldSet = new Set(held.map((h) => h.certificationId));
  return required.every((r) => heldSet.has(r.certificationId));
}
