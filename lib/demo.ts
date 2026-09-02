import { AssignmentMode, MeetingPlatformPreference } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export const DEMO_SLUG = "senior-pm-interview";
export const DEMO_PROJECT_ID = "demo-project-fidlaque";
export const DEMO_ADMIN_DOMAIN = "eureka-ent.org";

const DEMO_STAFF = [
  { id: "demo-staff-1", name: "Demo Host One", initials: "DH", email: "notifications+staff1@eureka-ent.org" },
  { id: "demo-staff-2", name: "Demo Host Two", initials: "DT", email: "notifications+staff2@eureka-ent.org" },
  { id: "demo-staff-3", name: "Demo Host Three", initials: "TH", email: "notifications+staff3@eureka-ent.org" },
];
export const DEMO_STAFF_IDS = DEMO_STAFF.map((s) => s.id);
export const DEMO_STAFF_EMAILS = DEMO_STAFF.map((s) => s.email);

const PROJECT_SHAPE = {
  name: "FidLaque Solutions — Product Demo",
  company: "FidLaque Solutions",
  description:
    "A live, public demo of Scheduler. Pick a slot with one of our demo hosts, submit your details, and get a real booking confirmation — no account required.",
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
  autoCompleteBookings: false,
  selfServiceWindowHours: 4,
  meetingPlatformPreference: MeetingPlatformPreference.auto,
  assignmentMode: AssignmentMode.AUTO,
  brandingLogoInitial: "FL",
  brandingPrimaryColor: "#4338CA",
  brandingSenderName: "FidLaque Solutions",
  ownerId: null,
};

export function isDemoProjectId(id?: string | null): boolean {
  return id === DEMO_PROJECT_ID;
}

export function demoRecipientEmail(role: string, actualEmail: string): string {
  const normalized = actualEmail.toLowerCase();
  if (normalized.startsWith("notifications+") && normalized.endsWith(`@${DEMO_ADMIN_DOMAIN}`)) {
    return actualEmail;
  }
  if (role === "participant") {
    return `notifications+participant@${DEMO_ADMIN_DOMAIN}`;
  }
  return `notifications+owner@${DEMO_ADMIN_DOMAIN}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m < 10 ? "0" : ""}${m}`;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function ensureDemoBaseline(client: PrismaClient) {
  const staffIds: string[] = [];
  for (const s of DEMO_STAFF) {
    await client.admin.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        initials: s.initials,
        email: s.email,
        role: "admin",
        accountType: "organizational",
        isActive: true,
      },
      create: {
        id: s.id,
        name: s.name,
        initials: s.initials,
        email: s.email,
        role: "admin",
        accountType: "organizational",
        isActive: true,
      },
    });
    staffIds.push(s.id);
  }

  const formData = {
    ...PROJECT_SHAPE,
    slug: DEMO_SLUG,
    status: "active" as const,
  };

  let project = await client.project.findUnique({ where: { slug: DEMO_SLUG } });
  if (!project) {
    project = await client.project.create({
      data: {
        ...formData,
        id: DEMO_PROJECT_ID,
        availabilityLockDate: addDays(new Date(), PROJECT_SHAPE.availabilityPeriodDays + 1),
      },
    });
  } else {
    project = await client.project.update({
      where: { slug: DEMO_SLUG },
      data: {
        ...formData,
        ownerId: null,
        availabilityLockDate: addDays(new Date(), PROJECT_SHAPE.availabilityPeriodDays + 1),
      },
    });
  }
  const projectId = project.id;

  await client.projectAdmin.deleteMany({ where: { projectId } });
  await client.projectAdmin.createMany({
    data: staffIds.map((adminId) => ({ projectId, adminId })),
  });

  await client.adminAvailabilityRange.deleteMany({ where: { adminId: { in: staffIds } } });

  const windowDays = PROJECT_SHAPE.availabilityPeriodDays;
  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const rangeData: { adminId: string; dateKey: string; startTime: string; endTime: string }[] = [];
  for (let i = 0; i <= windowDays; i++) {
    const d = addDays(fromDate, i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const key = dateKey(d);
    rangeData.push({ adminId: staffIds[0], dateKey: key, startTime: "09:00", endTime: "16:00" });
    rangeData.push({ adminId: staffIds[1], dateKey: key, startTime: "09:00", endTime: "13:15" });
    rangeData.push({ adminId: staffIds[2], dateKey: key, startTime: "13:15", endTime: "16:00" });
  }
  if (rangeData.length > 0) {
    await client.adminAvailabilityRange.createMany({ data: rangeData });
  }

  await client.booking.deleteMany({ where: { projectId } });

  const startMin = 9 * 60;
  const endMin = 16 * 60;
  const step = PROJECT_SHAPE.durationMinutes;
  const slots: { dateKey: string; time: string }[] = [];
  for (let i = 0; i <= windowDays; i++) {
    const d = addDays(fromDate, i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const key = dateKey(d);
    for (let m = startMin; m + step <= endMin; m += step) {
      slots.push({ dateKey: key, time: formatTime(m) });
    }
  }

  const rand = mulberry32(0x5eed2026);
  const guestLetters = "ABCDEFGHIJ";
  const bookingData: {
    projectId: string;
    adminId: string;
    participantName: string;
    participantEmail: string;
    dateKey: string;
    time: string;
    status: "confirmed";
  }[] = [];
  let guestIndex = 0;
  for (const slot of slots) {
    if (rand() >= 0.42) continue;
    const slotMin = slot.time.split(":").map(Number)[0] * 60 + Number(slot.time.split(":")[1]);
    const eligible = [staffIds[0]];
    if (slotMin + step <= 13 * 60 + 15) eligible.push(staffIds[1]);
    if (slotMin >= 13 * 60 + 15) eligible.push(staffIds[2]);
    const adminId = eligible[Math.floor(rand() * eligible.length)];
    const guestN = (guestIndex % 10) + 1;
    bookingData.push({
      projectId,
      adminId,
      participantName: `Demo Guest ${guestLetters[guestIndex % guestLetters.length]}`,
      participantEmail: `notifications+demo-guest-${guestN}@${DEMO_ADMIN_DOMAIN}`,
      dateKey: slot.dateKey,
      time: slot.time,
      status: "confirmed",
    });
    guestIndex++;
  }
  if (bookingData.length > 0) {
    await client.booking.createMany({ data: bookingData });
  }

  return {
    projectId,
    projectSlug: project.slug,
    staffIds,
    totalGridSlots: slots.length,
    baselineBookings: bookingData.length,
  };
}

export async function resetDemoProject(client: PrismaClient) {
  const project = await client.project.findUnique({ where: { slug: DEMO_SLUG } });
  if (!project) {
    return { reset: false, reason: "demo project not found", at: new Date().toISOString() };
  }
  const bookingIds = (
    await client.booking.findMany({ where: { projectId: project.id }, select: { id: true } })
  ).map((r) => r.id);
  const removed = {
    bookings: bookingIds.length,
    waitlist: await client.waitlistEntry.count({ where: { projectId: project.id } }),
    participants: await client.participant.count({ where: { projectId: project.id } }),
    notificationLogs: await client.notificationLog.count({ where: { projectId: project.id } }),
    auditLogs: await client.auditLog.count({ where: { projectId: project.id } }),
  };

  await client.booking.deleteMany({ where: { projectId: project.id } });
  await client.waitlistEntry.deleteMany({ where: { projectId: project.id } });
  await client.participant.deleteMany({ where: { projectId: project.id } });
  await client.notificationLog.deleteMany({ where: { projectId: project.id } });
  await client.auditLog.deleteMany({ where: { projectId: project.id } });

  const baseline = await ensureDemoBaseline(client);

  return { reset: true, removed, baseline, at: new Date().toISOString() };
}