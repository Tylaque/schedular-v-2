import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import { getActiveTemplate, renderTemplate } from "@/lib/data/templates";
import { logNotification } from "@/lib/data/notifications";
import { createBooking } from "@/lib/data/bookings";

export async function joinWaitlist(input: {
  projectId: string;
  name: string;
  email: string;
  dateKey?: string;
  time?: string;
}) {
  const entry = await db.waitlistEntry.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      email: input.email,
      dateKey: input.dateKey ?? null,
      time: input.time ?? null,
      status: "waiting",
    },
  });

  await db.participant.upsert({
    where: {
      projectId_email: {
        projectId: input.projectId,
        email: input.email,
      },
    },
    update: { name: input.name, status: "waitlisted" },
    create: {
      projectId: input.projectId,
      name: input.name,
      email: input.email,
      status: "waitlisted",
    },
  });

  recordAudit({
    action: "waitlist_joined",
    actorType: "participant",
    actorLabel: input.name,
    entityType: "WaitlistEntry",
    entityId: entry.id,
    projectId: input.projectId,
    afterState: { name: input.name, email: input.email, dateKey: input.dateKey, time: input.time },
  }).catch(() => {});

  return entry;
}

export async function getWaitlistEntry(entryId: string) {
  return db.waitlistEntry.findUnique({
    where: { id: entryId },
    include: { project: { select: { name: true, company: true, durationMinutes: true } } },
  });
}

export async function listWaitlistForProject(projectId: string) {
  return db.waitlistEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
}

export async function expireStaleOffers() {
  const stale = await db.waitlistEntry.findMany({
    where: { status: "offered", expiresAt: { lt: new Date() } },
    select: { id: true, projectId: true, dateKey: true, time: true },
  });
  if (stale.length === 0) return;

  await db.waitlistEntry.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "expired" },
  });

  // Cascade: offer the freed slot to the next person in line
  const seen = new Set<string>();
  for (const s of stale) {
    if (!s.dateKey || !s.time) continue;
    const key = `${s.projectId}|${s.dateKey}|${s.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await offerNextWaitlistEntry(s.projectId, s.dateKey, s.time);
  }
}

export async function offerNextWaitlistEntry(
  projectId: string,
  dateKey: string,
  time: string
) {
  const exactMatch = await db.waitlistEntry.findFirst({
    where: { projectId, dateKey, time, status: "waiting" },
    orderBy: { createdAt: "asc" },
  });

  const entry = exactMatch ?? await db.waitlistEntry.findFirst({
    where: { projectId, dateKey, time: null, status: "waiting" },
    orderBy: { createdAt: "asc" },
  });

  if (!entry) return null;

  const updated = await db.waitlistEntry.update({
    where: { id: entry.id },
    data: {
      status: "offered",
      dateKey,
      time: time,
      offeredAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true, company: true } });
    const template = await getActiveTemplate("waitlist_offer", projectId);
    const ctx = {
      participant_name: entry.name,
      project_name: project?.name ?? "",
      company_name: project?.company ?? "",
      session_date: dateKey,
      session_time: time,
      booking_link: `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/waitlist/claim/${entry.id}`,
      company_logo: "",
      admin_name: "",
      time_zone: "",
      meeting_link: "",
    };
    const rendered = renderTemplate(template, ctx);
    await logNotification({
      templateId: template.id,
      category: "waitlist_offer",
      projectId,
      recipientEmail: entry.email,
      recipientRole: "participant",
      subject: rendered.subject,
      renderedBody: rendered.bodyHtml,
      status: "sent",
    });
  } catch (err) {
    console.error("Failed to send waitlist offer notification:", err);
  }

  return updated;
}

export async function claimWaitlistOffer(entryId: string) {
  const entry = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.status !== "offered") {
    return { ok: false as const, reason: "offer_expired" as const };
  }

  if (entry.expiresAt && new Date() > entry.expiresAt) {
    await db.waitlistEntry.update({
      where: { id: entryId },
      data: { status: "expired" },
    });
    return { ok: false as const, reason: "offer_expired" as const };
  }

  if (!entry.dateKey || !entry.time) {
    return { ok: false as const, reason: "offer_expired" as const };
  }

  const result = await createBooking({
    projectId: entry.projectId,
    dateKey: entry.dateKey,
    time: entry.time,
    participantName: entry.name,
    participantEmail: entry.email,
  });

  if (result.ok) {
    await db.waitlistEntry.update({
      where: { id: entryId },
      data: { status: "claimed", claimedBookingId: result.booking.id },
    });
  }

  return result;
}
