import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const ALL_ADMINS = [
  { id: "a1", name: "Priya Nair", initials: "PN", email: "priya@northwind.com" },
  { id: "a2", name: "Marcus Webb", initials: "MW", email: "marcus@northwind.com" },
  { id: "a3", name: "Jo Ellery", initials: "JE", email: "jo@northwind.com" },
  { id: "a4", name: "Sam Torres", initials: "ST", email: "sam@northwind.com" },
  { id: "a5", name: "Lina Chen", initials: "LC", email: "lina@northwind.com" },
  { id: "a6", name: "Omar Hassan", initials: "OH", email: "omar@northwind.com" },
  { id: "a7", name: "Kate Brooks", initials: "KB", email: "kate@northwind.com" },
  { id: "a8", name: "Raj Patel", initials: "RP", email: "raj@northwind.com" },
  { id: "a9", name: "Fiona O'Sullivan", initials: "FO", email: "fiona@northwind.com" },
  { id: "a10", name: "Derek Kim", initials: "DK", email: "derek@northwind.com" },
];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function generateSystemSlotGrid(
  dailyStart: string,
  dailyEnd: string,
  durationMinutes: number,
  includeWeekends: boolean,
  days: number
): { dateKey: string; times: string[] }[] {
  const result: { dateKey: string; times: string[] }[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMin = parseTime(dailyStart);
  const endMin = parseTime(dailyEnd);
  const step = durationMinutes;

  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const day = d.getDay();
    if (!includeWeekends && (day === 0 || day === 6)) continue;

    const times: string[] = [];
    for (let m = startMin; m + step <= endMin; m += step) {
      times.push(formatTime(m));
    }
    result.push({ dateKey: dateKey(d), times });
  }
  return result;
}

async function main() {
  console.log("Seeding database...");

  // Create admins
  for (const a of ALL_ADMINS) {
    await db.admin.upsert({
      where: { id: a.id },
      update: { name: a.name, initials: a.initials, email: a.email },
      create: a,
    });
  }
  console.log(`  Created ${ALL_ADMINS.length} admins`);

  // Create the seed project
  const projectSlug = "senior-pm-interview";
  const projectId = "seed-project-1";

  await db.project.upsert({
    where: { slug: projectSlug },
    update: {
      name: "Senior PM — Round 1 Interview",
      company: "Northwind Labs",
      description:
        "A 45-minute conversation with a member of our product team covering your background, a product-sense exercise, and Q&A.",
      durationMinutes: 45,
      availabilityPeriodDays: 14,
      dailyStart: "09:00",
      dailyEnd: "16:00",
      includeWeekends: false,
      minNoticeHours: 2,
      timezone: "Africa/Nairobi",
      bookingDeadlineDays: 7,
      bufferMinutes: 15,
      maxSessionsPerAdminPerDay: 3,
      sessionCapacity: 1,
      status: "active",
      availabilityLockDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      brandingLogoInitial: "NL",
      brandingPrimaryColor: "#4338CA",
      brandingSenderName: "Northwind Labs",
    },
    create: {
      id: projectId,
      slug: projectSlug,
      name: "Senior PM — Round 1 Interview",
      company: "Northwind Labs",
      description:
        "A 45-minute conversation with a member of our product team covering your background, a product-sense exercise, and Q&A.",
      durationMinutes: 45,
      availabilityPeriodDays: 14,
      dailyStart: "09:00",
      dailyEnd: "16:00",
      includeWeekends: false,
      minNoticeHours: 2,
      timezone: "Africa/Nairobi",
      bookingDeadlineDays: 7,
      bufferMinutes: 15,
      maxSessionsPerAdminPerDay: 3,
      sessionCapacity: 1,
      status: "active",
      availabilityLockDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      brandingLogoInitial: "NL",
      brandingPrimaryColor: "#4338CA",
      brandingSenderName: "Northwind Labs",
    },
  });
  console.log("  Created project: Senior PM — Round 1 Interview");

  // Assign admins a1, a2, a3 to the project
  const projectRecord = await db.project.findUniqueOrThrow({ where: { slug: projectSlug } });
  const adminIds = ["a1", "a2", "a3"];
  for (const adminId of adminIds) {
    await db.projectAdmin.upsert({
      where: { projectId_adminId: { projectId: projectRecord.id, adminId } },
      update: {},
      create: { projectId: projectRecord.id, adminId },
    });
  }
  console.log("  Assigned admins: Priya, Marcus, Jo");

  // Seed some availability entries for Priya (a1)
  const grid = generateSystemSlotGrid("09:00", "16:00", 45, false, 5);
  const seeded: { projectId: string; adminId: string; dateKey: string; time: string }[] = [];
  for (let di = 0; di < grid.length; di++) {
    const day = grid[di];
    for (let ti = 0; ti < day.times.length; ti++) {
      if ((di + ti) % 3 === 0) {
        seeded.push({
          projectId: projectRecord.id,
          adminId: "a1",
          dateKey: day.dateKey,
          time: day.times[ti],
        });
      }
    }
  }

  // Clear existing availability for a1 on this project and re-seed
  await db.adminAvailability.deleteMany({
    where: { projectId: projectRecord.id, adminId: "a1" },
  });
  if (seeded.length > 0) {
    await db.adminAvailability.createMany({ data: seeded });
  }
  console.log(`  Seeded ${seeded.length} availability entries for Priya`);

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
