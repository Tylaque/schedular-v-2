import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";

export type ProjectWithAdmins = {
  id: string;
  slug: string;
  name: string;
  company: string;
  description: string;
  durationMinutes: number;
  availabilityPeriodDays: number;
  dailyStart: string;
  dailyEnd: string;
  includeWeekends: boolean;
  minNoticeHours: number;
  timezone: string;
  bookingDeadlineDays: number;
  bufferMinutes: number;
  maxSessionsPerAdminPerDay: number;
  sessionCapacity: number;
  status: "draft" | "active" | "paused" | "closed" | "archived";
  availabilityLockDate: Date;
  branding: { logoInitial: string; primaryColor: string; senderName: string };
  admins: { id: string; name: string; initials: string }[];
  createdAt: Date;
  updatedAt: Date;
};

function toProjectWithAdmins(row: {
  id: string;
  slug: string;
  name: string;
  company: string;
  description: string;
  durationMinutes: number;
  availabilityPeriodDays: number;
  dailyStart: string;
  dailyEnd: string;
  includeWeekends: boolean;
  minNoticeHours: number;
  timezone: string;
  bookingDeadlineDays: number;
  bufferMinutes: number;
  maxSessionsPerAdminPerDay: number;
  sessionCapacity: number;
  status: string;
  availabilityLockDate: Date;
  brandingLogoInitial: string;
  brandingPrimaryColor: string;
  brandingSenderName: string;
  admins?: { admin: { id: string; name: string; initials: string } }[];
  createdAt: Date;
  updatedAt: Date;
}): ProjectWithAdmins {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    company: row.company,
    description: row.description,
    durationMinutes: row.durationMinutes,
    availabilityPeriodDays: row.availabilityPeriodDays,
    dailyStart: row.dailyStart,
    dailyEnd: row.dailyEnd,
    includeWeekends: row.includeWeekends,
    minNoticeHours: row.minNoticeHours,
    timezone: row.timezone,
    bookingDeadlineDays: row.bookingDeadlineDays,
    bufferMinutes: row.bufferMinutes,
    maxSessionsPerAdminPerDay: row.maxSessionsPerAdminPerDay,
    sessionCapacity: row.sessionCapacity,
    status: row.status as ProjectWithAdmins["status"],
    availabilityLockDate: row.availabilityLockDate,
    branding: {
      logoInitial: row.brandingLogoInitial,
      primaryColor: row.brandingPrimaryColor,
      senderName: row.brandingSenderName,
    },
    admins: (row.admins ?? []).map((pa) => ({
      id: pa.admin.id,
      name: pa.admin.name,
      initials: pa.admin.initials,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

export async function listProjects(): Promise<ProjectWithAdmins[]> {
  const rows = await db.project.findMany({
    include: { admins: { include: { admin: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toProjectWithAdmins);
}

export async function getProjectBySlug(slug: string): Promise<ProjectWithAdmins | null> {
  const row = await db.project.findUnique({
    where: { slug },
    include: { admins: { include: { admin: true } } },
  });
  return row ? toProjectWithAdmins(row) : null;
}

export async function createProject(input: {
  name: string;
  company: string;
  description: string;
  durationMinutes: number;
  dailyStart: string;
  dailyEnd: string;
  includeWeekends: boolean;
  minNoticeHours: number;
  timezone: string;
  bookingDeadlineDays: number;
  bufferMinutes: number;
  maxSessionsPerAdminPerDay: number;
  sessionCapacity: number;
  availabilityLockDate: Date;
  branding: { logoInitial: string; primaryColor: string; senderName: string };
  status?: "draft" | "active" | "paused" | "closed" | "archived";
  availabilityPeriodDays: number;
  adminIds: string[];
}): Promise<ProjectWithAdmins> {
  let slug = slugify(input.name);

  const existing = await db.project.findUnique({ where: { slug } });
  if (existing) {
    let i = 2;
    while (await db.project.findUnique({ where: { slug: `${slug}-${i}` } })) i++;
    slug = `${slug}-${i}`;
  }

  const row = await db.project.create({
    data: {
      slug,
      name: input.name,
      company: input.company,
      description: input.description,
      durationMinutes: input.durationMinutes,
      availabilityPeriodDays: input.availabilityPeriodDays,
      dailyStart: input.dailyStart,
      dailyEnd: input.dailyEnd,
      includeWeekends: input.includeWeekends,
      minNoticeHours: input.minNoticeHours,
      timezone: input.timezone,
      bookingDeadlineDays: input.bookingDeadlineDays,
      bufferMinutes: input.bufferMinutes,
      maxSessionsPerAdminPerDay: input.maxSessionsPerAdminPerDay,
      sessionCapacity: input.sessionCapacity,
      status: input.status ?? "draft",
      availabilityLockDate: input.availabilityLockDate,
      brandingLogoInitial: input.branding.logoInitial,
      brandingPrimaryColor: input.branding.primaryColor,
      brandingSenderName: input.branding.senderName,
      admins: {
        create: input.adminIds.map((adminId) => ({ adminId })),
      },
    },
    include: { admins: { include: { admin: true } } },
  });

  // Audit: non-blocking, outside transaction — failure won't affect the create
  recordAudit({
    action: "project_created",
    actorType: "super_admin",
    actorLabel: "Unknown (auth not yet wired)", // TODO: replace with session.user once auth lands
    entityType: "Project",
    entityId: row.id,
    projectId: row.id,
    afterState: { ...row, admins: row.admins.length },
  }).catch(() => {});

  return toProjectWithAdmins(row);
}

export async function updateProject(
  slug: string,
  updates: {
    name: string;
    company: string;
    description: string;
    durationMinutes: number;
    dailyStart: string;
    dailyEnd: string;
    includeWeekends: boolean;
    minNoticeHours: number;
    timezone: string;
    bookingDeadlineDays: number;
    bufferMinutes: number;
    maxSessionsPerAdminPerDay: number;
    sessionCapacity: number;
    availabilityLockDate: Date;
    branding: { logoInitial: string; primaryColor: string; senderName: string };
    status: "draft" | "active" | "paused" | "closed" | "archived";
    availabilityPeriodDays: number;
    adminIds: string[];
  }
): Promise<ProjectWithAdmins> {
  const existing = await db.project.findUnique({ where: { slug } });
  if (!existing) throw new Error(`Project "${slug}" not found`);

  const beforeSnapshot = {
    name: existing.name, company: existing.company, status: existing.status,
    description: existing.description, durationMinutes: existing.durationMinutes,
    dailyStart: existing.dailyStart, dailyEnd: existing.dailyEnd,
    timezone: existing.timezone, sessionCapacity: existing.sessionCapacity,
    maxSessionsPerAdminPerDay: existing.maxSessionsPerAdminPerDay,
    bufferMinutes: existing.bufferMinutes, minNoticeHours: existing.minNoticeHours,
    bookingDeadlineDays: existing.bookingDeadlineDays,
    availabilityPeriodDays: existing.availabilityPeriodDays,
    includeWeekends: existing.includeWeekends,
    availabilityLockDate: existing.availabilityLockDate,
    branding: { logoInitial: existing.brandingLogoInitial, primaryColor: existing.brandingPrimaryColor, senderName: existing.brandingSenderName },
  };

  const row = await db.$transaction(async (tx) => {
    // Reconcile admin assignments
    await tx.projectAdmin.deleteMany({ where: { projectId: existing.id } });
    if (updates.adminIds.length > 0) {
      await tx.projectAdmin.createMany({
        data: updates.adminIds.map((adminId) => ({
          projectId: existing.id,
          adminId,
        })),
      });
    }

    return tx.project.update({
      where: { id: existing.id },
      data: {
        name: updates.name,
        company: updates.company,
        description: updates.description,
        durationMinutes: updates.durationMinutes,
        availabilityPeriodDays: updates.availabilityPeriodDays,
        dailyStart: updates.dailyStart,
        dailyEnd: updates.dailyEnd,
        includeWeekends: updates.includeWeekends,
        minNoticeHours: updates.minNoticeHours,
        timezone: updates.timezone,
        bookingDeadlineDays: updates.bookingDeadlineDays,
        bufferMinutes: updates.bufferMinutes,
        maxSessionsPerAdminPerDay: updates.maxSessionsPerAdminPerDay,
        sessionCapacity: updates.sessionCapacity,
        status: updates.status,
        availabilityLockDate: updates.availabilityLockDate,
        brandingLogoInitial: updates.branding.logoInitial,
        brandingPrimaryColor: updates.branding.primaryColor,
        brandingSenderName: updates.branding.senderName,
      },
      include: { admins: { include: { admin: true } } },
    });
  });

  // Audit: non-blocking, outside transaction
  recordAudit({
    action: "project_updated",
    actorType: "super_admin",
    actorLabel: "Unknown (auth not yet wired)", // TODO: replace with session.user once auth lands
    entityType: "Project",
    entityId: row.id,
    projectId: row.id,
    beforeState: beforeSnapshot,
    afterState: {
      name: row.name, company: row.company, status: row.status,
      description: row.description, durationMinutes: row.durationMinutes,
      dailyStart: row.dailyStart, dailyEnd: row.dailyEnd,
      timezone: row.timezone, sessionCapacity: row.sessionCapacity,
      maxSessionsPerAdminPerDay: row.maxSessionsPerAdminPerDay,
      bufferMinutes: row.bufferMinutes, minNoticeHours: row.minNoticeHours,
      bookingDeadlineDays: row.bookingDeadlineDays,
      availabilityPeriodDays: row.availabilityPeriodDays,
      includeWeekends: row.includeWeekends,
      availabilityLockDate: row.availabilityLockDate,
      branding: { logoInitial: row.brandingLogoInitial, primaryColor: row.brandingPrimaryColor, senderName: row.brandingSenderName },
    },
  }).catch(() => {});

  return toProjectWithAdmins(row);
}
