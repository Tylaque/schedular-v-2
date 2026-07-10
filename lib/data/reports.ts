import { db } from "@/lib/db";

export type ReportRow = Record<string, string | number | boolean | null>;

export type ReportDefinition = {
  slug: string;
  label: string;
  description: string;
  columns: { key: string; label: string }[];
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    slug: "bookings-summary",
    label: "Bookings Summary",
    description: "Confirmed bookings aggregated by project, admin, date range.",
    columns: [
      { key: "projectName", label: "Project" },
      { key: "adminName", label: "Admin" },
      { key: "dateKey", label: "Date" },
      { key: "time", label: "Time" },
      { key: "participantName", label: "Participant" },
      { key: "participantEmail", label: "Email" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Created" },
    ],
  },
  {
    slug: "admin-utilization",
    label: "Admin Utilization",
    description: "Per-admin booking counts and slot fill rates per project.",
    columns: [
      { key: "projectName", label: "Project" },
      { key: "adminName", label: "Admin" },
      { key: "totalSlots", label: "Total Slots" },
      { key: "bookedSlots", label: "Booked" },
      { key: "utilization", label: "Utilization" },
    ],
  },
  {
    slug: "participant-activity",
    label: "Participant Activity",
    description: "All participants, their booking counts and status across projects.",
    columns: [
      { key: "projectName", label: "Project" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "status", label: "Status" },
      { key: "bookingCount", label: "Bookings" },
    ],
  },
  {
    slug: "project-progress",
    label: "Project Progress",
    description: "Project-level view of slots vs bookings over time.",
    columns: [
      { key: "projectName", label: "Project" },
      { key: "status", label: "Status" },
      { key: "totalSlots", label: "Total Slots" },
      { key: "bookedSlots", label: "Booked" },
      { key: "durationDays", label: "Availability Period (Days)" },
    ],
  },
  {
    slug: "template-usage",
    label: "Template Versions",
    description: "Email template version history and override scopes.",
    columns: [
      { key: "category", label: "Category" },
      { key: "audience", label: "Audience" },
      { key: "projectName", label: "Scope" },
      { key: "version", label: "Version" },
      { key: "subject", label: "Subject" },
      { key: "isActive", label: "Active" },
      { key: "updatedAt", label: "Last Updated" },
    ],
  },
  {
    slug: "notification-log",
    label: "Notification Log",
    description: "All sent (test) notification records.",
    columns: [
      { key: "category", label: "Category" },
      { key: "recipientEmail", label: "Recipient" },
      { key: "recipientRole", label: "Role" },
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Sent At" },
    ],
  },
];

export async function generateReport(slug: string): Promise<ReportRow[]> {
  switch (slug) {
    case "bookings-summary":
      return generateBookingsSummary();
    case "admin-utilization":
      return generateAdminUtilization();
    case "participant-activity":
      return generateParticipantActivity();
    case "project-progress":
      return generateProjectProgress();
    case "template-usage":
      return generateTemplateUsage();
    case "notification-log":
      return generateNotificationLog();
    default:
      throw new Error(`Unknown report slug: ${slug}`);
  }
}

async function generateBookingsSummary(): Promise<ReportRow[]> {
  const rows = await db.booking.findMany({
    where: { status: "confirmed" },
    include: { project: { select: { name: true } }, admin: { select: { name: true } } },
    orderBy: [{ dateKey: "asc" }, { time: "asc" }],
  });
  return rows.map((r) => ({
    projectName: r.project.name,
    adminName: r.admin.name,
    dateKey: r.dateKey,
    time: r.time,
    participantName: r.participantName,
    participantEmail: r.participantEmail,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function generateAdminUtilization(): Promise<ReportRow[]> {
  const projects = await db.project.findMany({
    select: { id: true, name: true },
  });
  const rows: ReportRow[] = [];
  for (const project of projects) {
    const admins = await db.admin.findMany({
      select: { id: true, name: true },
    });
    const totalSlotsPerAdmin = 30;
    for (const admin of admins) {
      const bookingCount = await db.booking.count({
        where: { projectId: project.id, adminId: admin.id, status: "confirmed" },
      });
      rows.push({
        projectName: project.name,
        adminName: admin.name,
        totalSlots: totalSlotsPerAdmin,
        bookedSlots: bookingCount,
        utilization: totalSlotsPerAdmin > 0 ? `${((bookingCount / totalSlotsPerAdmin) * 100).toFixed(1)}%` : "0%",
      });
    }
  }
  return rows;
}

async function generateParticipantActivity(): Promise<ReportRow[]> {
  const participants = await db.participant.findMany({
    include: { project: { select: { name: true } } },
    orderBy: [{ projectId: "asc" }, { email: "asc" }],
  });
  const rows: ReportRow[] = [];
  for (const p of participants) {
    const count = await db.booking.count({
      where: { projectId: p.projectId, participantEmail: p.email, status: "confirmed" },
    });
    rows.push({
      projectName: p.project.name,
      name: p.name,
      email: p.email,
      status: p.status,
      bookingCount: count,
    });
  }
  return rows;
}

async function generateProjectProgress(): Promise<ReportRow[]> {
  const projects = await db.project.findMany({ select: { id: true, name: true, status: true, availabilityPeriodDays: true } });
  const rows: ReportRow[] = [];
  for (const project of projects) {
    const availableSlots = await db.adminAvailability.count({
      where: { projectId: project.id },
    });
    const bookedSlots = await db.booking.count({
      where: { projectId: project.id, status: "confirmed" },
    });
    rows.push({
      projectName: project.name,
      status: project.status,
      totalSlots: availableSlots,
      bookedSlots: bookedSlots,
      durationDays: project.availabilityPeriodDays,
    });
  }
  return rows;
}

async function generateTemplateUsage(): Promise<ReportRow[]> {
  const templates = await db.emailTemplate.findMany({
    orderBy: [{ category: "asc" }, { version: "asc" }],
  });
  const projects = await db.project.findMany({ select: { id: true, name: true } });
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  return templates.map((t) => ({
    category: t.category,
    audience: t.audience,
    projectName: t.projectId ? projectMap.get(t.projectId) ?? t.projectId : "(Global)",
    version: t.version,
    subject: t.subject,
    isActive: t.isActive ? "Yes" : "No",
    updatedAt: t.updatedAt.toISOString(),
  }));
}

async function generateNotificationLog(): Promise<ReportRow[]> {
  const logs = await db.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return logs.map((l) => ({
    category: l.category,
    recipientEmail: l.recipientEmail,
    recipientRole: l.recipientRole,
    subject: l.subject,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
  }));
}
