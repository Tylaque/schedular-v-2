import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import { expireStaleOffers } from "@/lib/data/waitlist";
import { getParticipantBookingCount } from "@/lib/data/bookings";
import { timesOverlap } from "@/lib/timeOverlap";
import { hoursUntilSession } from "@/lib/slotHelpers";

export async function setAdminAvailabilityBulk(
  projectId: string,
  adminId: string,
  entries: { dateKey: string; time: string; selected: boolean }[]
): Promise<void> {
  // Legacy: kept for backward compatibility. New code should use
  // setAdminRangesForDate from availability-ranges.ts instead.
  await db.$transaction(async (tx) => {
    for (const entry of entries) {
      if (entry.selected) {
        await tx.adminAvailability.upsert({
          where: {
            projectId_adminId_dateKey_time: {
              projectId,
              adminId,
              dateKey: entry.dateKey,
              time: entry.time,
            },
          },
          create: {
            projectId,
            adminId,
            dateKey: entry.dateKey,
            time: entry.time,
          },
          update: {},
        });
      } else {
        await tx.adminAvailability.deleteMany({
          where: {
            projectId,
            adminId,
            dateKey: entry.dateKey,
            time: entry.time,
          },
        });
      }
    }
  });

  // Audit: non-blocking, outside transaction
  const selectedCount = entries.filter((e) => e.selected).length;
  recordAudit({
    action: "admin_availability_submitted",
    actorType: "admin",
    actorId: adminId,
    actorLabel: "System Admin",
    entityType: "AdminAvailability",
    entityId: `${projectId}|${adminId}`,
    projectId,
    afterState: { entriesCount: entries.length, selectedCount },
  }).catch(() => {});
}

/**
 * Compute bookable slots for a project using the new unified range model.
 *
 * Instead of reading from the old per-project AdminAvailability table, this
 * iterates over the project's assigned admins, loads their global availability
 * ranges, and generates candidate time slots within each admin's declared
 * free time on each date. A slot is bookable if:
 *  - At least one assigned admin has a range covering it (via isAdminAvailableForSlot)
 *  - The slot's current booking count is below sessionCapacity
 *  - No waitlist offer is pending for that slot
 */
export async function getConsolidatedAvailability(
  projectId: string,
  opts?: { participantEmail?: string },
): Promise<Record<string, string[]>> {
  // Fire-and-forget: expire stale waitlist offers in the background.
  // This is maintenance work — a participant loading the booking page
  // should not wait for it. If it fails, it retries on the next render.
  expireStaleOffers().catch(() => {});

  const _debug = !!process.env.AVAIL_DEBUG;

  // ── Phase 1: all queries that only need projectId (input) ──────────
  const _t0 = performance.now();
  const [project, projectAdmins, requiredCerts, bookingCounts, offeredSlots] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        sessionCapacity: true,
        durationMinutes: true,
        dailyStart: true,
        dailyEnd: true,
        includeWeekends: true,
        availabilityPeriodDays: true,
        maxSessionsPerAdminPerDay: true,
        bufferMinutes: true,
        minNoticeHours: true,
        timezone: true,
        maxBookingsPerParticipant: true,
      },
    }),
    db.projectAdmin.findMany({
      where: { projectId, admin: { isActive: true } },
      select: { adminId: true },
    }),
    db.projectCertificationRequirement.findMany({
      where: { projectId },
      select: { certificationId: true },
    }),
    db.booking.groupBy({
      by: ["dateKey", "time"],
      where: { projectId, status: "confirmed" },
      _count: { id: true },
    }),
    db.waitlistEntry.findMany({
      where: { projectId, status: "offered", dateKey: { not: null }, time: { not: null } },
      select: { dateKey: true, time: true },
    }),
  ]);
  if (_debug) console.log(`[avail:perf] Phase 1 (5 parallel queries): ${(performance.now() - _t0).toFixed(0)}ms`);
  if (!project) return {};

  if (opts?.participantEmail && project.maxBookingsPerParticipant != null) {
    const count = await getParticipantBookingCount(projectId, opts.participantEmail);
    if (count >= project.maxBookingsPerParticipant) return {};
  }

  // Get all ACTIVE admins assigned to this project.
  const adminIds = projectAdmins.map((pa) => pa.adminId);
  if (adminIds.length === 0) return {};

  // ── Phase 2: certification gate (needs adminIds from Phase 1) ──────
  const _t1 = performance.now();
  const certifiedIds: string[] = [];
  if (requiredCerts.length === 0) {
    certifiedIds.push(...adminIds);
  } else {
    const requiredIds = new Set(requiredCerts.map((r) => r.certificationId));
    const heldRows = await db.adminCertification.findMany({
      where: { adminId: { in: adminIds }, certificationId: { in: [...requiredIds] } },
      select: { adminId: true, certificationId: true },
    });
    const heldByAdmin = new Map<string, Set<string>>();
    for (const row of heldRows) {
      if (!heldByAdmin.has(row.adminId)) heldByAdmin.set(row.adminId, new Set());
      heldByAdmin.get(row.adminId)!.add(row.certificationId);
    }
    for (const adminId of adminIds) {
      const held = heldByAdmin.get(adminId);
      if (held && requiredIds.size === [...requiredIds].filter((id) => held.has(id)).length) {
        certifiedIds.push(adminId);
      }
    }
  }
  if (_debug) console.log(`[avail:perf] Phase 2 (cert gate): ${(performance.now() - _t1).toFixed(0)}ms`);
  if (certifiedIds.length === 0) return {};

  // Determine the date window
  const now = new Date();
  const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + project.availabilityPeriodDays);
  const toDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  // Generate candidate time slots from project's dailyStart/dailyEnd/duration
  const startMin = parseTime(project.dailyStart);
  const endMin = parseTime(project.dailyEnd);
  const step = project.durationMinutes;

  // ── Phase 3: data-heavy queries that need certifiedIds ─────────────
  const _t2 = performance.now();
  const [allRanges, adminBookings] = await Promise.all([
    db.adminAvailabilityRange.findMany({
      where: {
        adminId: { in: certifiedIds },
        dateKey: { gte: fromDate, lte: toDate },
      },
      orderBy: [{ dateKey: "asc" }, { startTime: "asc" }],
    }),
    db.booking.findMany({
      where: {
        adminId: { in: certifiedIds },
        dateKey: { gte: fromDate, lte: toDate },
        status: "confirmed",
      },
      select: {
        dateKey: true,
        time: true,
        adminId: true,
        projectId: true,
        project: { select: { durationMinutes: true, bufferMinutes: true } },
      },
    }),
  ]);
  if (_debug) console.log(`[avail:perf] Phase 3 (2 parallel queries): ${(performance.now() - _t2).toFixed(0)}ms (${adminBookings.length} bookings)`);

  // ── Build in-memory indexes ────────────────────────────────────────
  const fullMap: Record<string, number> = {};
  for (const bc of bookingCounts) {
    fullMap[`${bc.dateKey}|${bc.time}`] = bc._count.id;
  }

  const offeredSet = new Set(offeredSlots.map((s) => `${s.dateKey}|${s.time}`));

  const rangesByDate: Record<string, { adminId: string; startTime: string; endTime: string }[]> = {};
  for (const r of allRanges) {
    if (!rangesByDate[r.dateKey]) rangesByDate[r.dateKey] = [];
    rangesByDate[r.dateKey].push(r);
  }

  const dailyCounts: Record<string, Record<string, number>> = {};
  const bookingsByDate: Record<string, { adminId: string; time: string; duration: number; buffer: number }[]> = {};
  for (const b of adminBookings) {
    if (!bookingsByDate[b.dateKey]) bookingsByDate[b.dateKey] = [];
    bookingsByDate[b.dateKey].push({
      adminId: b.adminId,
      time: b.time,
      duration: b.project.durationMinutes,
      buffer: b.project.bufferMinutes,
    });
    if (b.projectId === projectId) {
      if (!dailyCounts[b.dateKey]) dailyCounts[b.dateKey] = {};
      dailyCounts[b.dateKey][b.adminId] = (dailyCounts[b.dateKey][b.adminId] ?? 0) + 1;
    }
  }

  // ── Slot generation: purely in-memory ──────────────────────────────
  const map: Record<string, string[]> = {};
  const d = new Date(fromDate + "T00:00:00Z");
  const endD = new Date(toDate + "T00:00:00Z");

  while (d <= endD) {
    const day = d.getUTCDay();
    if (project.includeWeekends || (day !== 0 && day !== 6)) {
      const dateKey = fmtDate(d);
      const dayBookings = bookingsByDate[dateKey] ?? [];
      const dayAdminCounts = dailyCounts[dateKey] ?? {};

      for (let m = startMin; m + step <= endMin; m += step) {
        const time = formatTime(m);
        const key = `${dateKey}|${time}`;

        const count = fullMap[key] ?? 0;
        if (count >= project.sessionCapacity) continue;
        if (offeredSet.has(key)) continue;

        // Min-notice gate: hide slots that fall within the project's notice window.
        // Uses the same IANA-timezone-aware calculation as the booking-time check
        // in createBooking (bookings.ts).
        if (hoursUntilSession(dateKey, time, project.timezone) < project.minNoticeHours) continue;

        const dateRanges = rangesByDate[dateKey] ?? [];
        let slotBookable = false;
        for (const r of dateRanges) {
          const rangeStart = parseTime(r.startTime);
          const rangeEnd = parseTime(r.endTime);
          if (!(rangeStart <= m && m + step <= rangeEnd)) continue;

          const adminDayCount = dayAdminCounts[r.adminId] ?? 0;
          if (adminDayCount >= project.maxSessionsPerAdminPerDay) continue;

          const newWindow = step + project.bufferMinutes;
          let hasConflict = false;
          for (const eb of dayBookings) {
            if (eb.adminId !== r.adminId) continue;
            const existingWindow = eb.duration + eb.buffer;
            if (timesOverlap(time, newWindow, eb.time, existingWindow)) {
              hasConflict = true;
              break;
            }
          }
          if (hasConflict) continue;

          slotBookable = true;
          break;
        }

        if (slotBookable) {
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push(time);
        }
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  if (_debug) console.log(`[avail:perf] TOTAL: ${(performance.now() - _t0).toFixed(0)}ms`);
  return map;
}

function parseTime(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m < 10 ? "0" : ""}${m}`;
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Default booking window for a project: from today to today +
 * availabilityPeriodDays (inclusive dateKeys), matching the window used by
 * getConsolidatedAvailability.
 */
export function bookingDateWindow(availabilityPeriodDays: number): { fromDate: string; toDate: string } {
  const now = new Date();
  const fromDate = fmtDate(now);
  const end = new Date(now);
  end.setDate(end.getDate() + availabilityPeriodDays);
  return { fromDate, toDate: fmtDate(end) };
}

export type RangeSlotCounts = {
  total: number;
  byAdmin: Record<string, number>;
};

/**
 * Count bookable slots derived from the unified AdminAvailabilityRange model
 * for one project over an inclusive date range.
 *
 * Reuses the same qualification and grid rules as getConsolidatedAvailability
 * (assigned + active + certified admins; dailyStart→dailyEnd at
 * durationMinutes steps, honoring includeWeekends), but counts every grid
 * slot covered by at least one qualified admin's range — WITHOUT
 * sessionCapacity or waitlist filtering, so "total slots offered" stays
 * independent of bookings already landed.
 *
 * Returns the project-wide union total plus per-admin counts.
 */
export async function countRangeSlots(opts: {
  projectId: string;
  fromDate: string;
  toDate: string;
}): Promise<RangeSlotCounts> {
  const project = await db.project.findUnique({
    where: { id: opts.projectId },
    select: {
      dailyStart: true,
      dailyEnd: true,
      durationMinutes: true,
      includeWeekends: true,
    },
  });
  if (!project) return { total: 0, byAdmin: {} };

  const projectAdmins = await db.projectAdmin.findMany({
    where: { projectId: opts.projectId, admin: { isActive: true } },
    select: { adminId: true },
  });

  const requiredCerts2 = await db.projectCertificationRequirement.findMany({
    where: { projectId: opts.projectId },
    select: { certificationId: true },
  });
  const qualifiedIds: string[] = [];
  if (requiredCerts2.length === 0) {
    qualifiedIds.push(...projectAdmins.map((pa) => pa.adminId));
  } else {
    const requiredIds = new Set(requiredCerts2.map((r) => r.certificationId));
    const heldRows = await db.adminCertification.findMany({
      where: { adminId: { in: projectAdmins.map((pa) => pa.adminId) }, certificationId: { in: [...requiredIds] } },
      select: { adminId: true, certificationId: true },
    });
    const heldByAdmin = new Map<string, Set<string>>();
    for (const row of heldRows) {
      if (!heldByAdmin.has(row.adminId)) heldByAdmin.set(row.adminId, new Set());
      heldByAdmin.get(row.adminId)!.add(row.certificationId);
    }
    for (const pa of projectAdmins) {
      const held = heldByAdmin.get(pa.adminId);
      if (held && requiredIds.size === [...requiredIds].filter((id) => held.has(id)).length) {
        qualifiedIds.push(pa.adminId);
      }
    }
  }
  if (qualifiedIds.length === 0) return { total: 0, byAdmin: {} };

  const ranges = await db.adminAvailabilityRange.findMany({
    where: {
      adminId: { in: qualifiedIds },
      dateKey: { gte: opts.fromDate, lte: opts.toDate },
    },
    select: { adminId: true, dateKey: true, startTime: true, endTime: true },
  });

  const rangesByDate = new Map<string, { adminId: string; startMin: number; endMin: number }[]>();
  for (const r of ranges) {
    const list = rangesByDate.get(r.dateKey) ?? [];
    list.push({ adminId: r.adminId, startMin: parseTime(r.startTime), endMin: parseTime(r.endTime) });
    rangesByDate.set(r.dateKey, list);
  }

  const startMin = parseTime(project.dailyStart);
  const endMin = parseTime(project.dailyEnd);
  const step = project.durationMinutes;
  const byAdmin: Record<string, number> = {};
  for (const id of qualifiedIds) byAdmin[id] = 0;
  let total = 0;

  const d = new Date(`${opts.fromDate}T00:00:00Z`);
  const endD = new Date(`${opts.toDate}T00:00:00Z`);
  while (d <= endD) {
    const day = d.getUTCDay();
    if (project.includeWeekends || (day !== 0 && day !== 6)) {
      const dateRanges = rangesByDate.get(fmtDate(d));
      if (dateRanges) {
        for (let m = startMin; m + step <= endMin; m += step) {
          const slotEnd = m + step;
          let anyCovered = false;
          for (const r of dateRanges) {
            if (r.startMin <= m && slotEnd <= r.endMin) {
              byAdmin[r.adminId] += 1;
              anyCovered = true;
            }
          }
          if (anyCovered) total += 1;
        }
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return { total, byAdmin };
}
