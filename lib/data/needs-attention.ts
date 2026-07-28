import { db } from "@/lib/db";

export type FlaggedBooking = {
  id: string;
  dateKey: string;
  time: string;
  participantName: string;
  participantEmail: string;
  manualAttentionReason: string | null;
  adminName: string;
  adminEmail: string;
  projectName: string;
  projectSlug: string;
};

/**
 * List all bookings flagged for manual attention.
 * Scoped by project ownership (org_owner sees all, super_admin sees their own projects).
 */
export async function listFlaggedBookings(ownerId?: string): Promise<FlaggedBooking[]> {
  const where: Record<string, unknown> = {
    needsManualAttention: true,
    status: "confirmed",
  };

  if (ownerId) {
    where.project = { ownerId };
  }

  const bookings = await db.booking.findMany({
    where,
    select: {
      id: true,
      dateKey: true,
      time: true,
      participantName: true,
      participantEmail: true,
      manualAttentionReason: true,
      admin: { select: { name: true, email: true } },
      project: { select: { name: true, slug: true } },
    },
    orderBy: [{ dateKey: "asc" }, { time: "asc" }],
  });

  return bookings.map((b) => ({
    id: b.id,
    dateKey: b.dateKey,
    time: b.time,
    participantName: b.participantName,
    participantEmail: b.participantEmail,
    manualAttentionReason: b.manualAttentionReason,
    adminName: b.admin.name,
    adminEmail: b.admin.email,
    projectName: b.project.name,
    projectSlug: b.project.slug,
  }));
}

/**
 * Count flagged bookings for the dashboard badge.
 */
export async function countFlaggedBookings(ownerId?: string): Promise<number> {
  const where: Record<string, unknown> = {
    needsManualAttention: true,
    status: "confirmed",
  };
  if (ownerId) {
    where.project = { ownerId };
  }
  return db.booking.count({ where });
}
