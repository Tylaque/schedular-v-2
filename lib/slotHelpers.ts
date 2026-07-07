export type Admin = {
  id: string;
  name: string;
  initials: string;
};

export type Project = {
  id: string;
  slug: string;
  name: string;
  company: string;
  durationMinutes: number;
  description: string;
  admins: Admin[];
  dailyStart: string;
  dailyEnd: string;
  includeWeekends: boolean;
  minNoticeHours: number;
  availabilityLockDate: Date;
  timezone: string;
  bookingDeadlineDays: number;
  bufferMinutes: number;
  maxSessionsPerAdminPerDay: number;
  sessionCapacity: number;
  status: "draft" | "active" | "paused" | "closed" | "archived";
  branding: { logoInitial: string; primaryColor: string; senderName: string };
  availabilityPeriodDays: number;
};

export type SlotGridDay = {
  dateKey: string;
  date: Date;
  times: string[];
};

export const TIMEZONES = [
  "Africa/Nairobi (GMT+3)",
  "America/New_York (GMT-4)",
  "Europe/London (GMT+1)",
  "Asia/Kolkata (GMT+5:30)",
];

const BASE_TIMES = ["9:00", "9:45", "10:30", "11:15", "13:00", "13:45", "14:30", "15:15", "16:00"];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function parseTime(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${pad(m)}`;
}

/**
 * Deterministic mock slot generator. Stands in for the real slot-consolidation
 * logic described in Section 4 of the requirements doc (system-generated grid
 * intersected with submitted Admin availability). Excludes weekends per project
 * config and thins out slots so the demo shows a realistic partially-booked calendar.
 */
export function buildSlotsForDate(date: Date, project: Project, seedOffset: number): string[] {
  const day = date.getDay();
  if (!project.includeWeekends && (day === 0 || day === 6)) return [];
  return BASE_TIMES.filter((_, i) => (i + seedOffset) % 3 !== 0);
}

/** Mock version of the auto-assignment model from Section 4.3 (load-balanced Admin). */
export function assignAdmin(project: Project, dateKey: string, time: string): Admin {
  const idx = (dateKey.length + time.length) % project.admins.length;
  return project.admins[idx];
}

export function generateSystemSlotGrid(project: Project, days: number): SlotGridDay[] {
  const result: SlotGridDay[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMin = parseTime(project.dailyStart);
  const endMin = parseTime(project.dailyEnd);
  const step = project.durationMinutes;

  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const day = d.getDay();
    if (!project.includeWeekends && (day === 0 || day === 6)) continue;

    const times: string[] = [];
    for (let m = startMin; m + step <= endMin; m += step) {
      times.push(formatTime(m));
    }
    result.push({ dateKey: dateKey(d), date: d, times });
  }
  return result;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
