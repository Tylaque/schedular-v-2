import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import { expireStaleOffers } from "@/lib/data/waitlist";
import { isAdminAvailableForSlot, getAdminRanges } from "@/lib/data/availability-ranges";
import { isAdminCertifiedForProject } from "@/lib/data/certifications";

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
  projectId: string
): Promise<Record<string, string[]>> {
  await expireStaleOffers();

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      sessionCapacity: true,
      durationMinutes: true,
      dailyStart: true,
      dailyEnd: true,
      includeWeekends: true,
      availabilityPeriodDays: true,
    },
  });
  if (!project) return {};

  // Get all admins assigned to this project
  const projectAdmins = await db.projectAdmin.findMany({
    where: { projectId },
    select: { adminId: true },
  });
  const adminIds = projectAdmins.map((pa) => pa.adminId);
  if (adminIds.length === 0) return {};

  // Certification gate: only certified associates count toward bookable slots.
  // Zero project requirements = all assigned associates are eligible.
  const certifiedIds: string[] = [];
  for (const adminId of adminIds) {
    if (await isAdminCertifiedForProject(projectId, adminId)) {
      certifiedIds.push(adminId);
    }
  }
  if (certifiedIds.length === 0) return {};

  // Determine the date window we need to cover
  const now = new Date();
  const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + project.availabilityPeriodDays);
  const toDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  // Load all ranges for all certified admins in the date window
  const allRanges = await db.adminAvailabilityRange.findMany({
    where: {
      adminId: { in: certifiedIds },
      dateKey: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ dateKey: "asc" }, { startTime: "asc" }],
  });

  // Group ranges by dateKey
  const rangesByDate: Record<string, { adminId: string; startTime: string; endTime: string }[]> = {};
  for (const r of allRanges) {
    if (!rangesByDate[r.dateKey]) rangesByDate[r.dateKey] = [];
    rangesByDate[r.dateKey].push(r);
  }

  // Generate candidate time slots from project's dailyStart/dailyEnd/duration
  const startMin = parseTime(project.dailyStart);
  const endMin = parseTime(project.dailyEnd);
  const step = project.durationMinutes;

  const bookingCounts = await db.booking.groupBy({
    by: ["dateKey", "time"],
    where: { projectId, status: "confirmed" },
    _count: { id: true },
  });

  const fullMap: Record<string, number> = {};
  for (const bc of bookingCounts) {
    fullMap[`${bc.dateKey}|${bc.time}`] = bc._count.id;
  }

  const offeredSlots = await db.waitlistEntry.findMany({
    where: { projectId, status: "offered", dateKey: { not: null }, time: { not: null } },
    select: { dateKey: true, time: true },
  });
  const offeredSet = new Set(offeredSlots.map((s) => `${s.dateKey}|${s.time}`));

  // For each date in range, generate candidate slots and check availability
  const map: Record<string, string[]> = {};
  const d = new Date(fromDate + "T00:00:00Z");
  const endD = new Date(toDate + "T00:00:00Z");

  while (d <= endD) {
    const day = d.getUTCDay();
    if (project.includeWeekends || (day !== 0 && day !== 6)) {
      const dateKey = fmtDate(d);

      // Generate all candidate time slots for this date
      for (let m = startMin; m + step <= endMin; m += step) {
        const time = formatTime(m);
        const key = `${dateKey}|${time}`;

        // Already at capacity?
        const count = fullMap[key] ?? 0;
        if (count >= project.sessionCapacity) continue;
        if (offeredSet.has(key)) continue;

        // Check if at least one certified admin is range-available for this slot
        let slotBookable = false;
        for (const adminId of certifiedIds) {
          if (await isAdminAvailableForSlot(adminId, dateKey, time, project.durationMinutes)) {
            slotBookable = true;
            break;
          }
        }

        if (slotBookable) {
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push(time);
        }
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

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
