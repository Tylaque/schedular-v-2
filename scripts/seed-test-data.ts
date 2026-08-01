import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

function todayIn(timezone: string): string {
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

async function main() {
  const hash = await bcrypt.hash("test1234", 10);
  await db.admin.upsert({
    where: { email: "owner@test.example.com" },
    update: { passwordHash: hash, role: "org_owner", name: "Owner Test" },
    create: {
      id: "test-owner-1",
      name: "Owner Test",
      initials: "OT",
      email: "owner@test.example.com",
      passwordHash: hash,
      role: "org_owner",
      accountType: "organizational",
    },
  });
  console.log("org_owner ready");

  const extraAdmins = [
    ["test-admin-priya", "Priya Nair", "priya@northwind.com", "admin"],
    ["test-admin-marcus", "Marcus Webb", "marcus@northwind.com", "admin"],
    ["test-admin-jo", "Jo Ellery", "jo@northwind.com", "admin"],
    ["test-admin-sam", "Sam Torres", "sam@northwind.com", "admin"],
    ["test-admin-kate", "Kate Brooks", "kate@northwind.com", "super_admin"],
  ] as const;
  for (const [id, name, email, role] of extraAdmins) {
    await db.admin.upsert({
      where: { email },
      update: { name, role },
      create: {
        id,
        name,
        initials: name.split(" ").map((p) => p[0]).join("").slice(0, 2),
        email,
        role,
        accountType: "organizational",
      },
    });
  }
  console.log("extra admins ready:", extraAdmins.length);

  const project = await db.project.upsert({
    where: { slug: "test-owner-project" },
    update: {},
    create: {
      slug: "test-owner-project",
      name: "Test Owner Project",
      company: "Northwind Labs",
      description: "Project owned by the local org_owner test account.",
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
      brandingLogoInitial: "TO",
      brandingPrimaryColor: "#4338CA",
      brandingSenderName: "Northwind Labs",
      ownerId: "test-owner-1",
    },
  });
  console.log("project ready:", project.id);

  await db.projectAdmin.upsert({
    where: { projectId_adminId: { projectId: project.id, adminId: "test-admin-id" } },
    update: {},
    create: { projectId: project.id, adminId: "test-admin-id" },
  });

  const dateKey = todayIn("Africa/Nairobi");
  console.log("today (Nairobi):", dateKey);

  await db.booking.deleteMany({ where: { projectId: project.id, participantEmail: "today.booking@test.example.com" } });
  await db.booking.create({
    data: {
      projectId: project.id,
      adminId: "test-admin-id",
      participantName: "Today Booking",
      participantEmail: "today.booking@test.example.com",
      dateKey,
      time: "10:00",
      status: "confirmed",
    },
  });
  console.log("today's confirmed booking inserted");

  await db.waitlistEntry.deleteMany({ where: { projectId: project.id, email: { endsWith: "@waitlist.test" } } });
  const waitlist = [
    ["Alice Waiting", "alice@waitlist.test", dateKey, "11:00", "waiting"],
    ["Bob Offered", "bob@waitlist.test", dateKey, "11:45", "offered"],
    ["Carol Pending", "carol@waitlist.test", null, null, "waiting"],
    ["Dan Claimed", "dan@waitlist.test", dateKey, "12:30", "claimed"],
    ["Eve Expired", "eve@waitlist.test", dateKey, "13:15", "expired"],
    ["Frank Waiting", "frank@waitlist.test", dateKey, "14:00", "waiting"],
  ] as const;
  for (const [name, email, wDate, wTime, status] of waitlist) {
    await db.waitlistEntry.create({
      data: { projectId: project.id, name, email, dateKey: wDate, time: wTime, status },
    });
  }
  console.log("waitlist entries inserted:", waitlist.length);

  await db.notificationLog.deleteMany({ where: { recipientEmail: { endsWith: "@logs.test" } } });
  const logs = [
    ["p1@logs.test", "participant", "booking_confirmation", "Confirmed: Interview on " + dateKey, "sent"],
    ["p2@logs.test", "participant", "reminder_24h", "Reminder: Interview tomorrow", "sent"],
    ["test-admin-id@logs.test", "admin", "availability_request", "Availability requested for Interview", "sent"],
    ["p3@logs.test", "participant", "cancellation_notice", "Cancelled: Interview on " + dateKey, "failed"],
    ["p4@logs.test", "participant", "waitlist_offer", "A slot just opened up", "sent"],
    ["p5@logs.test", "participant", "participant_invitation", "You're invited to book a session", "test"],
  ] as const;
  for (const [recipientEmail, recipientRole, category, subject, status] of logs) {
    await db.notificationLog.create({
      data: {
        category,
        recipientEmail,
        recipientRole,
        subject,
        renderedBody: "<p>test</p>",
        status,
        projectId: project.id,
      },
    });
  }
  console.log("notification logs inserted:", logs.length);

  await db.$disconnect();
}

main();
