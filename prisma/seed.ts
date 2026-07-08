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

  // Seed global default email templates for all 9 categories
  const TEMPLATES: {
    category: string;
    audience: string;
    subject: string;
    bodyHtml: string;
  }[] = [
    {
      category: "admin_invitation",
      audience: "admin",
      subject: "You've been added as an interviewer for {{project_name}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{admin_name}},</p>
<p>You have been added as an interviewer for <strong>{{project_name}}</strong> at {{company_name}}.</p>
<p>Please submit your availability for the coming days so candidates can start booking sessions.</p>
<p style="margin:24px 0;"><a href="{{booking_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Submit availability</a></p>
<p>If you have any questions, please reach out to your scheduling coordinator.</p>
<p>Thanks,<br/>{{company_name}}</p>
</div>`,
    },
    {
      category: "availability_request",
      audience: "admin",
      subject: "Availability requested for {{project_name}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{admin_name}},</p>
<p>We need your availability for <strong>{{project_name}}</strong>. Please use the link below to mark the times you're available over the next {{availability_period}} days.</p>
<p style="margin:24px 0;"><a href="{{booking_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Set availability</a></p>
<p>Thank you for helping us schedule these interviews.</p>
<p>Best,<br/>{{company_name}}</p>
</div>`,
    },
    {
      category: "participant_invitation",
      audience: "participant",
      subject: "You're invited to book a session — {{project_name}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>You are invited to schedule a <strong>{{project_name}}</strong> session with {{company_name}}.</p>
<p>Please choose a time that works for you using the link below.</p>
<p style="margin:24px 0;"><a href="{{booking_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Book a time</a></p>
<p>If none of the available times work, you can join the waitlist for additional slots.</p>
<p>We look forward to meeting you.</p>
<p>Best regards,<br/>{{company_name}}</p>
</div>`,
    },
    {
      category: "booking_confirmation",
      audience: "participant",
      subject: "Confirmed: {{project_name}} on {{session_date}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>Your session is confirmed.</p>
<div style="border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;background:#EEF1FD;">
<p style="margin:0 0 8px;"><strong>{{project_name}}</strong></p>
<p style="margin:0 0 4px;">{{session_date}} · {{session_time}}</p>
<p style="margin:0 0 4px;">{{time_zone}}</p>
<p style="margin:0 0 4px;">Interviewer: {{admin_name}}</p>
<p style="margin:12px 0 0;"><a href="{{meeting_link}}" style="color:#4338CA;font-weight:600;">Join Microsoft Teams meeting</a></p>
</div>
<p>The meeting link will also appear on your calendar invitation shortly.</p>
<p>Thanks,<br/>{{company_name}}</p>
</div>`,
    },
    {
      category: "reminder_24h",
      audience: "participant",
      subject: "Reminder: {{project_name}} tomorrow at {{session_time}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>This is a reminder that your <strong>{{project_name}}</strong> session is tomorrow.</p>
<div style="border:2px dashed #DCE1FB;border-radius:12px;padding:20px;margin:20px 0;background:#EEF1FD;">
<p style="margin:0 0 8px;"><strong>{{project_name}}</strong></p>
<p style="margin:0 0 4px;">{{session_date}} · {{session_time}}</p>
<p style="margin:0 0 4px;">{{time_zone}}</p>
<p style="margin:0;">Interviewer: {{admin_name}}</p>
</div>
<p style="margin:24px 0;"><a href="{{meeting_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Join meeting</a></p>
<p>Best,<br/>{{company_name}}</p>
</div>`,
    },
    {
      category: "reminder_1h",
      audience: "participant",
      subject: "Starting soon: {{project_name}} at {{session_time}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>Your <strong>{{project_name}}</strong> session starts in about one hour.</p>
<p style="margin:24px 0;"><a href="{{meeting_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Join meeting</a></p>
<p>Please ensure you have a quiet space and a working camera/microphone.</p>
<p>Good luck!<br/>{{company_name}}</p>
</div>`,
    },
    {
      category: "reschedule_notice",
      audience: "participant",
      subject: "Rescheduled: {{project_name}} on {{session_date}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>Your <strong>{{project_name}}</strong> session has been rescheduled.</p>
<p>Please click below to view the new time and confirm your attendance.</p>
<p style="margin:24px 0;"><a href="{{booking_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View new time</a></p>
<p>We apologise for any inconvenience.</p>
<p>Best,<br/>{{company_name}}</p>
</div>`,
    },
    {
      category: "cancellation_notice",
      audience: "participant",
      subject: "Cancelled: {{project_name}} on {{session_date}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>Your <strong>{{project_name}}</strong> session scheduled for {{session_date}} at {{session_time}} has been cancelled.</p>
<p>If you would like to reschedule, please visit the link below to book a new time.</p>
<p style="margin:24px 0;"><a href="{{booking_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Book a new time</a></p>
<p>We apologise for the inconvenience.</p>
<p>Best regards,<br/>{{company_name}}</p>
</div>`,
    },
    {
      category: "waitlist_offer",
      audience: "participant",
      subject: "A slot just opened up — {{project_name}}",
      bodyHtml: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
<p>Hi {{participant_name}},</p>
<p>A new slot has opened up for <strong>{{project_name}}</strong> at {{company_name}}.</p>
<p>Availability is limited, so grab it before it's taken.</p>
<p style="margin:24px 0;"><a href="{{booking_link}}" style="background:#4338CA;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Book now</a></p>
<p>Best,<br/>{{company_name}}</p>
</div>`,
    },
  ];

  for (const t of TEMPLATES) {
    await db.emailTemplate.create({
      data: {
        category: t.category as any,
        audience: t.audience as any,
        projectId: null,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        version: 1,
        isActive: true,
      },
    });
  }
  console.log(`  Created ${TEMPLATES.length} global email templates`);

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
