// Shared time-window overlap logic.
//
// `timesOverlap` is the exact function Teams scheduling has always used for
// conflict detection (formerly defined inside lib/data/bookings.ts, moved here
// unchanged so the Zoom pool check can reuse it verbatim rather than
// reimplementing it). `epochOverlap` is the same math applied to absolute
// timestamps, which is what the Zoom live-API check needs (Zoom meetings are
// absolute UTC datetimes, not per-day "HH:MM" strings).

export function parseMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Two windows overlap iff each starts before the other ends.
 * `startA`/`startB` are "HH:MM" strings; `endA`/`endB` are durations in minutes.
 */
export function timesOverlap(
  startA: string,
  endA: number,
  startB: string,
  endB: number
): boolean {
  const a = parseMinutes(startA);
  const b = parseMinutes(startB);
  return a < b + endB && b < a + endA;
}

/**
 * Same overlap rule on absolute epoch-millisecond timestamps.
 * `[aStart, aEnd)` and `[bStart, bEnd)` are half-open intervals.
 */
export function epochOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
