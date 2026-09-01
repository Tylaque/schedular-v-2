import { db } from "@/lib/db";
import { DEMO_SLUG } from "@/lib/demo";

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
  } else {
    where.NOT = { project: { is: { slug: DEMO_SLUG } } };
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
  } else {
    where.NOT = { project: { is: { slug: DEMO_SLUG } } };
  }
  return db.booking.count({ where });
}

export type FailedProvisioning = {
  id: string;
  dateKey: string;
  time: string;
  participantName: string;
  participantEmail: string;
  meetingPlatform: string | null;
  zoomProvisionStatus: string | null;
  teamsProvisionStatus: string | null;
  zoomErrorDetail: string | null;
  teamsErrorDetail: string | null;
  meetingFallbackReason: string | null;
  projectName: string;
  projectSlug: string;
};

/**
 * List all bookings with failed provisioning status.
 * Covers: Zoom-only failures (zoomProvisionStatus=failed) and
 * Teams failures (teamsProvisionStatus IN failed_*).
 * Scoped by project ownership.
 */
export async function listFailedProvisionings(ownerId?: string): Promise<FailedProvisioning[]> {
  const where: Record<string, unknown> = {
    status: "confirmed",
    OR: [
      { zoomProvisionStatus: "failed" },
      { teamsProvisionStatus: { in: ["failed_personal_account", "failed_insufficient_permissions", "failed_unknown"] } },
    ],
  };

  if (ownerId) {
    where.project = { ownerId };
  } else {
    where.NOT = { project: { is: { slug: DEMO_SLUG } } };
  }

  const bookings = await db.booking.findMany({
    where,
    select: {
      id: true,
      dateKey: true,
      time: true,
      participantName: true,
      participantEmail: true,
      meetingPlatform: true,
      zoomProvisionStatus: true,
      teamsProvisionStatus: true,
      zoomErrorDetail: true,
      teamsErrorDetail: true,
      meetingFallbackReason: true,
      project: { select: { name: true, slug: true } },
    },
    orderBy: [{ dateKey: "desc" }, { time: "desc" }],
  });

  return bookings.map((b) => ({
    id: b.id,
    dateKey: b.dateKey,
    time: b.time,
    participantName: b.participantName,
    participantEmail: b.participantEmail,
    meetingPlatform: b.meetingPlatform,
    zoomProvisionStatus: b.zoomProvisionStatus,
    teamsProvisionStatus: b.teamsProvisionStatus,
    zoomErrorDetail: b.zoomErrorDetail,
    teamsErrorDetail: b.teamsErrorDetail,
    meetingFallbackReason: b.meetingFallbackReason,
    projectName: b.project.name,
    projectSlug: b.project.slug,
  }));
}

/**
 * Count bookings with failed provisioning status for the dashboard badge.
 */
export async function countFailedProvisionings(ownerId?: string): Promise<number> {
  const where: Record<string, unknown> = {
    status: "confirmed",
    OR: [
      { zoomProvisionStatus: "failed" },
      { teamsProvisionStatus: { in: ["failed_personal_account", "failed_insufficient_permissions", "failed_unknown"] } },
    ],
  };
  if (ownerId) {
    where.project = { ownerId };
  } else {
    where.NOT = { project: { is: { slug: DEMO_SLUG } } };
  }
  return db.booking.count({ where });
}
