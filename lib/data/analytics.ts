import { db } from "@/lib/db";
import { getAdminUtilization } from "@/lib/data/dashboard";
import type { Prisma, ProjectStatus } from "@prisma/client";

export type VolumeGranularity = "week" | "month";

const DAY_MS = 86_400_000;

export type BookingVolumePoint = {
  period: string;
  label: string;
  total: number;
  confirmed: number;
  cancelled: number;
  rescheduled: number;
};

export type AdminUtilizationPoint = {
  adminId: string;
  adminName: string;
  submittedAvailabilityCount: number;
  confirmedBookingsCount: number;
  utilizationRate: number;
};

export type ProjectHealthItem = {
  projectId: string;
  projectName: string;
  projectSlug: string;
  status: ProjectStatus;
  totalSlots: number;
  confirmedBookings: number;
  totalBookings: number;
  fillRate: number;
  cancellationRate: number;
  waitlistCount: number;
};

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeekUTC(d: Date): Date {
  const start = new Date(d.getTime());
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

const weekLabelFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const monthLabelFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function bucketKey(d: Date, granularity: VolumeGranularity): string {
  if (granularity === "month") return d.toISOString().slice(0, 7);
  return toDateKey(startOfWeekUTC(d));
}

function bucketLabel(key: string, granularity: VolumeGranularity): string {
  if (granularity === "month") {
    return monthLabelFmt.format(new Date(`${key}-01T00:00:00.000Z`));
  }
  return weekLabelFmt.format(new Date(`${key}T00:00:00.000Z`));
}

/**
 * Booking volume trend: counts bookings created per week/month within the
 * range, bucketed by booking.createdAt and zero-filled so the chart shows
 * every period between fromDate and toDate even when empty.
 */
export async function getBookingVolumeTrend(opts: {
  ownerId?: string;
  projectId?: string;
  fromDate: string;
  toDate: string;
  granularity: VolumeGranularity;
}): Promise<BookingVolumePoint[]> {
  const { ownerId, projectId, fromDate, toDate, granularity } = opts;
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T23:59:59.999Z`);

  const where: Prisma.BookingWhereInput = {
    createdAt: { gte: from, lte: to },
  };
  if (projectId) where.projectId = projectId;
  if (ownerId) where.project = { ownerId };

  const bookings = await db.booking.findMany({
    where,
    select: { createdAt: true, status: true },
  });

  const buckets: BookingVolumePoint[] = [];
  let cursor =
    granularity === "week"
      ? startOfWeekUTC(from)
      : new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor.getTime() <= to.getTime()) {
    const key = bucketKey(cursor, granularity);
    buckets.push({
      period: key,
      label: bucketLabel(key, granularity),
      total: 0,
      confirmed: 0,
      cancelled: 0,
      rescheduled: 0,
    });
    if (granularity === "week") {
      cursor = new Date(cursor.getTime() + 7 * DAY_MS);
    } else {
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
  }

  const index = new Map(buckets.map((b, i) => [b.period, i]));
  for (const b of bookings) {
    const i = index.get(bucketKey(b.createdAt, granularity));
    if (i === undefined) continue;
    const bucket = buckets[i];
    bucket.total++;
    if (b.status === "confirmed") bucket.confirmed++;
    else if (b.status === "cancelled") bucket.cancelled++;
    else if (b.status === "rescheduled") bucket.rescheduled++;
  }
  return buckets;
}

/**
 * Per-admin utilization snapshot. Reuses getAdminUtilization for the
 * whole-scope view; when a single project is selected, adapts it to count
 * only that project's availability + confirmed bookings.
 */
export async function getAdminUtilizationChart(opts: {
  ownerId?: string;
  projectId?: string;
}): Promise<AdminUtilizationPoint[]> {
  const { ownerId, projectId } = opts;

  if (projectId) {
    // Defense in depth: the requested project must be within the caller's scope.
    const inScope = await db.project.findFirst({
      where: { id: projectId, ...(ownerId ? { ownerId } : {}) },
      select: { id: true },
    });
    if (!inScope) return [];

    const assignments = await db.projectAdmin.findMany({
      where: { projectId },
      select: { admin: { select: { id: true, name: true } } },
    });
    const result: AdminUtilizationPoint[] = [];
    for (const a of assignments) {
      const [availCount, bookingCount] = await Promise.all([
        db.adminAvailability.count({ where: { adminId: a.admin.id, projectId } }),
        db.booking.count({
          where: { adminId: a.admin.id, projectId, status: "confirmed" },
        }),
      ]);
      result.push({
        adminId: a.admin.id,
        adminName: a.admin.name,
        submittedAvailabilityCount: availCount,
        confirmedBookingsCount: bookingCount,
        utilizationRate: availCount > 0 ? bookingCount / availCount : 0,
      });
    }
    result.sort((a, b) => b.utilizationRate - a.utilizationRate);
    return result;
  }

  return getAdminUtilization(ownerId);
}

/**
 * Project health metrics within a date range.
 * fillRate = confirmed bookings / total offered slots in the range (one
 * AdminAvailability row per slot). cancellationRate = cancelled / all
 * bookings in the range. waitlistCount = waitlist entries created in range.
 */
export async function getProjectHealthMetrics(opts: {
  ownerId?: string;
  projectId?: string;
  fromDate: string;
  toDate: string;
}): Promise<ProjectHealthItem[]> {
  const { ownerId, projectId, fromDate, toDate } = opts;

  const projectFilter: Prisma.ProjectWhereInput = {};
  if (ownerId) projectFilter.ownerId = ownerId;
  if (projectId) projectFilter.id = projectId;

  const projects = await db.project.findMany({
    where: projectFilter,
    select: { id: true, name: true, slug: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  if (projects.length === 0) return [];
  const ids = projects.map((p) => p.id);

  const slotsByProject = await db.adminAvailability.groupBy({
    by: ["projectId"],
    where: { projectId: { in: ids }, dateKey: { gte: fromDate, lte: toDate } },
    _count: { id: true },
  });
  const slotCounts = new Map(slotsByProject.map((s) => [s.projectId, s._count.id]));

  const bookingsByProject = await db.booking.groupBy({
    by: ["projectId", "status"],
    where: { projectId: { in: ids }, dateKey: { gte: fromDate, lte: toDate } },
    _count: { id: true },
  });

  const waitlistByProject = await db.waitlistEntry.groupBy({
    by: ["projectId"],
    where: {
      projectId: { in: ids },
      createdAt: {
        gte: new Date(`${fromDate}T00:00:00.000Z`),
        lte: new Date(`${toDate}T23:59:59.999Z`),
      },
    },
    _count: { id: true },
  });
  const waitlistCounts = new Map(waitlistByProject.map((w) => [w.projectId, w._count.id]));

  return projects.map((p) => {
    const totalSlots = slotCounts.get(p.id) ?? 0;
    const projectBookings = bookingsByProject.filter((b) => b.projectId === p.id);
    const confirmedBookings = projectBookings
      .filter((b) => b.status === "confirmed")
      .reduce((n, b) => n + b._count.id, 0);
    const cancelledBookings = projectBookings
      .filter((b) => b.status === "cancelled")
      .reduce((n, b) => n + b._count.id, 0);
    const totalBookings = projectBookings.reduce((n, b) => n + b._count.id, 0);

    return {
      projectId: p.id,
      projectName: p.name,
      projectSlug: p.slug,
      status: p.status,
      totalSlots,
      confirmedBookings,
      totalBookings,
      fillRate: totalSlots > 0 ? confirmedBookings / totalSlots : 0,
      cancellationRate: totalBookings > 0 ? cancelledBookings / totalBookings : 0,
      waitlistCount: waitlistCounts.get(p.id) ?? 0,
    };
  });
}
