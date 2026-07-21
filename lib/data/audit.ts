import { db } from "@/lib/db";
import type { AuditAction } from "@prisma/client";

export async function recordAudit(input: {
  action: AuditAction;
  actorType: string;
  actorId?: string;
  actorLabel: string;
  entityType: string;
  entityId: string;
  projectId?: string;
  beforeState?: unknown;
  afterState?: unknown;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: input.action,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId ?? null,
        beforeState: input.beforeState ?? undefined,
        afterState: input.afterState ?? undefined,
      },
    });
  } catch (err) {
    console.error("Audit log write failed (non-blocking):", err);
  }
}

export async function listAuditLogs(filters: {
  projectId?: string;
  action?: AuditAction;
  entityType?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  ownerId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.action) where.action = filters.action;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) (where.createdAt as Record<string, unknown>).gte = filters.from;
    if (filters.to) (where.createdAt as Record<string, unknown>).lte = filters.to;
  }
  if (filters.ownerId) {
    where.project = { ownerId: filters.ownerId };
  }

  return db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 200,
  });
}
