import { db } from "@/lib/db";

function parseMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Validate that a set of ranges for a single day are internally consistent:
 * - startTime < endTime for each range
 * - No overlaps between ranges
 * Returns null if valid, or a descriptive error string if not.
 */
function validateRanges(ranges: { startTime: string; endTime: string }[]): string | null {
  for (let i = 0; i < ranges.length; i++) {
    const s = parseMinutes(ranges[i].startTime);
    const e = parseMinutes(ranges[i].endTime);
    if (s >= e) {
      return `Range ${i + 1}: start time (${ranges[i].startTime}) must be before end time (${ranges[i].endTime}).`;
    }
  }

  // Sort by startTime and check for overlaps
  const sorted = [...ranges]
    .map((r) => ({ s: parseMinutes(r.startTime), e: parseMinutes(r.endTime), startTime: r.startTime, endTime: r.endTime }))
    .sort((a, b) => a.s - b.s);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].s < sorted[i - 1].e) {
      return `Ranges overlap: ${sorted[i - 1].startTime}–${sorted[i - 1].endTime} overlaps with ${sorted[i].startTime}–${sorted[i].endTime}.`;
    }
  }

  return null;
}

/**
 * Get all ranges for an admin within a date window (inclusive).
 */
export async function getAdminRanges(
  adminId: string,
  fromDate: string,
  toDate: string
) {
  return db.adminAvailabilityRange.findMany({
    where: {
      adminId,
      dateKey: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ dateKey: "asc" }, { startTime: "asc" }],
  });
}

/**
 * Get ranges for a single date.
 */
export async function getAdminRangesForDate(adminId: string, dateKey: string) {
  return db.adminAvailabilityRange.findMany({
    where: { adminId, dateKey },
    orderBy: { startTime: "asc" },
  });
}

/**
 * Replace ALL ranges for this admin on this date with the given set.
 * Validates ranges don't overlap and startTime < endTime before writing.
 */
export async function setAdminRangesForDate(
  adminId: string,
  dateKey: string,
  ranges: { startTime: string; endTime: string }[]
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const validationError = validateRanges(ranges);
  if (validationError) {
    return { ok: false, reason: validationError };
  }

  await db.$transaction(async (tx) => {
    await tx.adminAvailabilityRange.deleteMany({
      where: { adminId, dateKey },
    });

    if (ranges.length > 0) {
      await tx.adminAvailabilityRange.createMany({
        data: ranges.map((r) => ({
          adminId,
          dateKey,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
      });
    }
  });

  return { ok: true };
}

/**
 * THE core cross-project matching function.
 *
 * Returns true if any of this admin's stored ranges for this dateKey
 * fully contains the window [time, time + durationMinutes).
 *
 * Called with each PROJECT's own durationMinutes at evaluation time —
 * the same stored ranges naturally produce different eligibility results
 * for a 30-minute-session project vs. a 60-minute-session project
 * checking the same day.
 */
export async function isAdminAvailableForSlot(
  adminId: string,
  dateKey: string,
  time: string,
  durationMinutes: number
): Promise<boolean> {
  const slotStart = parseMinutes(time);
  const slotEnd = slotStart + durationMinutes;

  const ranges = await db.adminAvailabilityRange.findMany({
    where: { adminId, dateKey },
  });

  for (const range of ranges) {
    const rangeStart = parseMinutes(range.startTime);
    const rangeEnd = parseMinutes(range.endTime);
    if (rangeStart <= slotStart && slotEnd <= rangeEnd) {
      return true;
    }
  }

  return false;
}
