import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import type { SessionTypeClassification } from "@prisma/client";

export type SessionTypeRecord = {
  id: string;
  name: string;
  description: string;
  classification: SessionTypeClassification;
  isActive: boolean;
};

export type ActorInfo = {
  actorId: string;
  actorLabel: string;
};

/**
 * Idempotent seed: ensures the three starting session types exist.
 * Safe to call multiple times — uses upsert with fixed IDs.
 */
export async function ensureSeedSessionTypes(): Promise<void> {
  const seeds = [
    { id: "seed_session_interview", name: "Interview", description: "Standard interview session", classification: "STANDARD" as const },
    { id: "seed_session_feedback", name: "Feedback", description: "Feedback and review session", classification: "FEEDBACK" as const },
    { id: "seed_session_coaching", name: "Coaching", description: "Coaching and mentoring session", classification: "STANDARD" as const },
  ];
  for (const s of seeds) {
    await db.sessionType.upsert({
      where: { id: s.id },
      create: { id: s.id, name: s.name, description: s.description, classification: s.classification, isActive: true },
      update: { classification: s.classification },
    });
  }
}

export async function listSessionTypes(): Promise<SessionTypeRecord[]> {
  return db.sessionType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, classification: true, isActive: true },
  });
}

export async function listAllSessionTypes(): Promise<SessionTypeRecord[]> {
  return db.sessionType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, classification: true, isActive: true },
  });
}

export async function createSessionType(
  input: { name: string; description?: string; classification?: SessionTypeClassification } & Partial<ActorInfo>
): Promise<SessionTypeRecord> {
  const name = input.name.trim();
  const description = input.description?.trim() ?? "";
  const classification = input.classification ?? "STANDARD";
  const sessionType = await db.sessionType.create({
    data: { name, description, classification, isActive: true },
    select: { id: true, name: true, description: true, classification: true, isActive: true },
  });
  if (input.actorId) {
    await recordAudit({
      action: "session_type_created",
      actorType: "admin",
      actorId: input.actorId,
      actorLabel: input.actorLabel ?? "System Admin",
      entityType: "SessionType",
      entityId: sessionType.id,
      afterState: { name, description, classification },
    });
  }
  return sessionType;
}

export async function updateSessionType(
  id: string,
  input: { name: string; description?: string; classification?: SessionTypeClassification } & Partial<ActorInfo>
): Promise<SessionTypeRecord | null> {
  const before = await db.sessionType.findUnique({
    where: { id },
    select: { name: true, description: true, classification: true, isActive: true },
  });
  if (!before || !before.isActive) return null;

  const name = input.name.trim();
  const description = input.description?.trim() ?? "";
  const classification = input.classification ?? before.classification;
  const sessionType = await db.sessionType.update({
    where: { id },
    data: { name, description, classification },
    select: { id: true, name: true, description: true, classification: true, isActive: true },
  });
  if (input.actorId) {
    await recordAudit({
      action: "session_type_updated",
      actorType: "admin",
      actorId: input.actorId,
      actorLabel: input.actorLabel ?? "System Admin",
      entityType: "SessionType",
      entityId: id,
      beforeState: before,
      afterState: { name, description, classification },
    });
  }
  return sessionType;
}

/**
 * Soft-delete a session type. Sets isActive = false.
 * Historical bookings referencing this type are unaffected —
 * they retain the sessionTypeName snapshot.
 */
export async function softDeleteSessionType(
  id: string,
  actor?: ActorInfo
): Promise<boolean> {
  const before = await db.sessionType.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, classification: true, isActive: true },
  });
  if (!before || !before.isActive) return false;

  await db.sessionType.update({
    where: { id },
    data: { isActive: false },
  });
  if (actor) {
    await recordAudit({
      action: "session_type_deleted",
      actorType: "admin",
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
      entityType: "SessionType",
      entityId: id,
      beforeState: before,
    });
  }
  return true;
}

/**
 * Reactivate a soft-deleted session type. Sets isActive = true.
 */
export async function reactivateSessionType(
  id: string,
  actor?: ActorInfo
): Promise<boolean> {
  const before = await db.sessionType.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, classification: true, isActive: true },
  });
  if (!before || before.isActive) return false;

  await db.sessionType.update({
    where: { id },
    data: { isActive: true },
  });
  if (actor) {
    await recordAudit({
      action: "session_type_updated",
      actorType: "admin",
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
      entityType: "SessionType",
      entityId: id,
      beforeState: before,
      afterState: { ...before, isActive: true },
    });
  }
  return true;
}

/**
 * Resolve the display name for a booking's session type.
 *
 * Priority:
 * 1. Booking.sessionTypeName — historical snapshot (survives rename/delete)
 * 2. Booking.sessionType.name — current name if relation exists
 * 3. Project.defaultSessionType.name — project's current default
 * 4. null — no type assigned anywhere
 */
export function resolveSessionTypeName(booking: {
  sessionTypeName?: string | null;
  sessionType?: { name: string } | null;
  project?: { defaultSessionType?: { name: string } | null } | null;
}): string | null {
  if (booking.sessionTypeName) return booking.sessionTypeName;
  if (booking.sessionType?.name) return booking.sessionType.name;
  if (booking.project?.defaultSessionType?.name) return booking.project.defaultSessionType.name;
  return null;
}
