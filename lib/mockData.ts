export type Admin = {
  id: string;
  name: string;
  initials: string;
};

export type Project = {
  slug: string;
  name: string;
  company: string;
  durationMinutes: number;
  description: string;
  admins: Admin[];
  dailyStart: string; // "09:00"
  dailyEnd: string; // "16:00"
  includeWeekends: boolean;
  minNoticeHours: number;
};

// In a real build this comes from PostgreSQL via Prisma (Project + ProjectAdmin tables).
// Kept as static mock data here so the booking UI can be built and reviewed
// before the database layer exists.
export const PROJECTS: Record<string, Project> = {
  "senior-pm-interview": {
    slug: "senior-pm-interview",
    name: "Senior PM — Round 1 Interview",
    company: "Northwind Labs",
    durationMinutes: 45,
    description:
      "A 45-minute conversation with a member of our product team covering your background, a product-sense exercise, and Q&A.",
    admins: [
      { id: "a1", name: "Priya Nair", initials: "PN" },
      { id: "a2", name: "Marcus Webb", initials: "MW" },
      { id: "a3", name: "Jo Ellery", initials: "JE" },
    ],
    dailyStart: "09:00",
    dailyEnd: "16:00",
    includeWeekends: false,
    minNoticeHours: 2,
  },
};

export const TIMEZONES = [
  "Africa/Nairobi (GMT+3)",
  "America/New_York (GMT-4)",
  "Europe/London (GMT+1)",
  "Asia/Kolkata (GMT+5:30)",
];

const BASE_TIMES = ["9:00", "9:45", "10:30", "11:15", "13:00", "13:45", "14:30", "15:15", "16:00"];

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
