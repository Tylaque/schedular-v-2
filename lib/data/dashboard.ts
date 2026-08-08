import { db } from "@/lib/db";
import { isSessionInPast } from "@/lib/slotHelpers";
import { completePastConfirmedBookings, getBookingDisplayStatus } from "@/lib/data/booking-completion";
import type { ProjectStatus, Prisma } from "@prisma/client";

/**
 * Combines dateKey + time into a Comparable for past/future splitting.
 * Not exported — callers use isSessionInPast from slotHelpers.ts instead.
 */
function sessionInPast(dateKey: string, time: string, timezone: string): boolean {
  return isSessionInPast(dateKey, time, timezone);
}

/**
 * "Today" in a given project timezone, formatted as a dateKey (YYYY-MM-DD).
 */
export function todayDateKeyInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Counts today's confirmed sessions. Pass ownerId for org/project scope or
 * adminId to count a single admin's sessions.
 */
export async function countTodaySessions(opts: { ownerId?: string; adminId?: string }): Promise<number> {
  const { ownerId, adminId } = opts;
  await completePastConfirmedBookings();
  const bookings = await db.booking.findMany({
    where: {
      status: "confirmed",
      ...(adminId ? { adminId } : {}),
      ...(ownerId ? { project: { ownerId } } : {}),
    },
    select: { dateKey: true, project: { select: { timezone: true } } },
  });

  let count = 0;
  for (const b of bookings) {
    if (b.dateKey === todayDateKeyInTimezone(b.project.timezone)) count++;
  }
  return count;
}

export async function getSuperAdminStats(ownerId?: string) {
  const projectFilter = ownerId ? { ownerId } : {};
  const projects = await db.project.findMany({
    where: projectFilter,
    select: { status: true, timezone: true },
  });

  // Lazy completion: past sessions on autoComplete projects become really "completed".
  await completePastConfirmedBookings();

  const totalProjects = projects.length;
  const projectsByStatus: Record<string, number> = {};
  for (const p of projects) {
    projectsByStatus[p.status] = (projectsByStatus[p.status] ?? 0) + 1;
  }

  const totalParticipants = await db.participant.count({
    where: ownerId ? { project: { ownerId } } : {},
  });

  const confirmedBookings = await db.booking.findMany({
    where: { status: "confirmed", ...(ownerId ? { project: { ownerId } } : {}) },
    select: { dateKey: true, time: true, project: { select: { timezone: true } } },
  });

  const cancelledSessions = await db.booking.count({
    where: { status: "cancelled", ...(ownerId ? { project: { ownerId } } : {}) },
  });

  const completedSessions = await db.booking.count({
    where: { status: "completed", ...(ownerId ? { project: { ownerId } } : {}) },
  });

  let upcomingSessions = 0;
  for (const b of confirmedBookings) {
    if (!sessionInPast(b.dateKey, b.time, b.project.timezone)) {
      upcomingSessions++;
    }
  }

  return {
    totalProjects,
    projectsByStatus,
    totalParticipants,
    bookedSessions: confirmedBookings.length,    // total confirmed (past or future)
    pendingSessions: upcomingSessions,            // confirmed + in the future (synonymous with upcomingSessions; we keep both names for dashboard clarity)
    completedSessions,                            // really completed (stored status), incl. auto-completed
    upcomingSessions,
    cancelledSessions,
  };
}

export async function getAdminUtilization(ownerId?: string) {
  // When scoped, only include admins assigned to the owner's projects
  const adminFilter = ownerId
    ? { projectAssignments: { some: { project: { ownerId } } } }
    : {};
  const admins = await db.admin.findMany({
    where: adminFilter,
    select: { id: true, name: true },
  });
  const result: {
    adminId: string;
    adminName: string;
    submittedAvailabilityCount: number;
    confirmedBookingsCount: number;
    utilizationRate: number;
  }[] = [];

  for (const admin of admins) {
    const bookingFilter: Record<string, unknown> = { adminId: admin.id, status: "confirmed" };
    if (ownerId) {
      bookingFilter.project = { ownerId };
    }
    const [availCount, bookingCount] = await Promise.all([
      db.adminAvailability.count({ where: { adminId: admin.id } }),
      db.booking.count({ where: bookingFilter as any }),
    ]);
    result.push({
      adminId: admin.id,
      adminName: admin.name,
      submittedAvailabilityCount: availCount,
      confirmedBookingsCount: bookingCount,
      utilizationRate: availCount > 0 ? bookingCount / availCount : 0,
    });
  }

  result.sort((a, b) => b.utilizationRate - a.utilizationRate);
  return result;
}

export type ProjectProgressItem = {
  projectId: string;
  projectSlug: string;
  projectName: string;
  status: ProjectStatus;
  periodElapsedPercent: number;
  participantsScheduledPercent: number;
};

export async function getProjectProgress(ownerId?: string): Promise<ProjectProgressItem[]> {
  const projectFilter = ownerId ? { ownerId } : {};
  const projects = await db.project.findMany({
    where: projectFilter,
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      availabilityLockDate: true,
      createdAt: true,
    },
  });

  const participantCounts = await db.participant.groupBy({
    by: ["projectId", "status"],
    _count: { id: true },
  });

  const participantMap = new Map<string, { total: number; bookedOrCompleted: number }>();
  for (const pc of participantCounts) {
    const entry = participantMap.get(pc.projectId) ?? { total: 0, bookedOrCompleted: 0 };
    entry.total += pc._count.id;
    if (pc.status === "booked" || pc.status === "completed") {
      entry.bookedOrCompleted += pc._count.id;
    }
    participantMap.set(pc.projectId, entry);
  }

  const now = Date.now();
  return projects.map((p) => {
    // Period: from project creation to availabilityLockDate.
    // periodElapsedPercent = how far we are from start to lock date.
    // If lock date is in the past, 100%; if creation is in the future (edge case), 0%.
    const start = p.createdAt.getTime();
    const end = p.availabilityLockDate.getTime();
    let periodElapsedPercent = 0;
    if (end > start) {
      periodElapsedPercent = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    } else {
      periodElapsedPercent = now >= end ? 100 : 0;
    }

    const pc = participantMap.get(p.id);
    const totalP = pc?.total ?? 0;
    const participantsScheduledPercent = totalP > 0 ? (pc!.bookedOrCompleted / totalP) * 100 : 0;

    return {
      projectId: p.id,
      projectSlug: p.slug,
      projectName: p.name,
      status: p.status,
      periodElapsedPercent: Math.round(periodElapsedPercent),
      participantsScheduledPercent: Math.round(participantsScheduledPercent),
    };
  });
}

type AdminDashboardBooking = {
  id: string;
  dateKey: string;
  time: string;
  status: string;
  displayStatus: string;
  projectName: string;
  participantName: string;
  meetingPlatform: "zoom" | "teams" | null;
};

export async function getAdminDashboardData(
  adminId: string,
  opts: { ownerId?: string; includeOwned?: boolean } = {}
) {
  const { ownerId, includeOwned } = opts;
  const admin = await db.admin.findUnique({ where: { id: adminId } });
  if (!admin) return null;

  // Lazy completion: past sessions on autoComplete projects become really "completed".
  await completePastConfirmedBookings();

  // A project counts as "yours" if you're assigned to it (ProjectAdmin) OR —
  // for a self-dashboard (includeOwned) — if you own it. Ownership alone never
  // satisfies the assignment-only case (e.g. a super_admin viewing another
  // admin's dashboard), so that path is unchanged.
  const projectWhere: Prisma.ProjectWhereInput = {
    ...(ownerId ? { ownerId } : {}),
    OR: [
      { admins: { some: { adminId } } },
      ...(includeOwned ? [{ ownerId: adminId }] : []),
    ],
  };

  const assignedProjects = await db.project.findMany({
    where: projectWhere,
    select: { id: true, slug: true, name: true, status: true, timezone: true },
  });

  const availCount = await db.adminAvailability.count({ where: { adminId } });

  const myBookings = await db.booking.findMany({
    where: {
      adminId,
      ...(ownerId ? { project: { ownerId } } : {}),
      status: { in: ["confirmed", "completed", "cancelled", "rescheduled"] },
    },
    select: {
      id: true,
      dateKey: true,
      time: true,
      status: true,
      meetingPlatform: true,
      participantName: true,
      project: {
        select: { name: true, timezone: true, autoCompleteBookings: true },
      },
    },
    orderBy: [{ dateKey: "asc" }, { time: "asc" }],
  });

  const sessions: AdminDashboardBooking[] = myBookings.map((b) => ({
    id: b.id,
    dateKey: b.dateKey,
    time: b.time,
    status: b.status,
    displayStatus: getBookingDisplayStatus({
      status: b.status,
      dateKey: b.dateKey,
      time: b.time,
      timezone: b.project.timezone,
      autoCompleteBookings: b.project.autoCompleteBookings,
    }),
    projectName: b.project.name,
    participantName: b.participantName,
    meetingPlatform: b.meetingPlatform,
  }));

  const upcomingSessions = sessions.filter((s) => s.displayStatus === "confirmed");
  const awaitingCompletionSessions = sessions.filter((s) => s.displayStatus === "awaiting_completion");
  const completedSessions = sessions.filter((s) => s.displayStatus === "completed");

  const participants = await db.participant.findMany({
    where: { projectId: { in: assignedProjects.map((p) => p.id) } },
    select: { id: true, name: true, email: true, status: true, project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return {
    assignedProjects: assignedProjects.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
    })),
    submittedAvailabilityCount: availCount,
    upcomingSessions,
    awaitingCompletionSessions,
    completedSessions,
    sessions,
    relevantParticipants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      status: p.status,
      projectName: p.project.name,
    })),
  };
}

type CalendarFilters = {
  from: Date;
  to: Date;
  projectId?: string;
  adminId?: string;
  participantSearch?: string;
  ownerId?: string;
};

export async function getCalendarEvents(filters: CalendarFilters) {
  // Lazy completion: past sessions on autoComplete projects become really "completed".
  await completePastConfirmedBookings();

  const where: Prisma.BookingWhereInput = {
    dateKey: {
      gte: filters.from.toISOString().slice(0, 10),
      lte: filters.to.toISOString().slice(0, 10),
    },
  };

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.adminId) where.adminId = filters.adminId;
  if (filters.ownerId) {
    where.project = { ownerId: filters.ownerId };
  }

  if (filters.participantSearch) {
    where.OR = [
      { participantName: { contains: filters.participantSearch, mode: "insensitive" } },
      { participantEmail: { contains: filters.participantSearch, mode: "insensitive" } },
    ];
  }

  const bookings = await db.booking.findMany({
    where,
    select: {
      id: true,
      dateKey: true,
      time: true,
      status: true,
      meetingPlatform: true,
      participantName: true,
      participantEmail: true,
      project: { select: { name: true, timezone: true, autoCompleteBookings: true } },
      admin: { select: { name: true } },
    },
    orderBy: [{ dateKey: "asc" }, { time: "asc" }],
  });

  return bookings.map((b) => ({
    id: b.id,
    dateKey: b.dateKey,
    time: b.time,
    status: b.status,
    meetingPlatform: b.meetingPlatform,
    displayStatus: getBookingDisplayStatus({
      status: b.status,
      dateKey: b.dateKey,
      time: b.time,
      timezone: b.project.timezone,
      autoCompleteBookings: b.project.autoCompleteBookings,
    }),
    participantName: b.participantName,
    participantEmail: b.participantEmail,
    projectName: b.project.name,
    adminName: b.admin.name,
  }));
}
