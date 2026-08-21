import { db } from "@/lib/db";
import { Resend } from "resend";
import { stripHtml } from "@/lib/html-to-text";
import { getActiveTemplate, renderTemplate } from "@/lib/data/templates";
import { logNotification } from "@/lib/data/notifications";
import type { ParticipantStatus, Prisma } from "@prisma/client";

export type ParticipantRecord = Prisma.ParticipantGetPayload<{ include: { project: { select: { id: true; name: true; slug: true } } } }>;

export async function listParticipantsForProject(projectId: string): Promise<ParticipantRecord[]> {
  return db.participant.findMany({
    where: { projectId },
    include: { project: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getParticipantById(id: string): Promise<ParticipantRecord | null> {
  return db.participant.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });
}

export async function addParticipant(
  projectId: string,
  name: string,
  email: string,
  customFields?: Record<string, string>
): Promise<{ participant: ParticipantRecord; emailSent: boolean }> {
  const participant = await db.participant.upsert({
    where: { projectId_email: { projectId, email } },
    update: { name, customFields: customFields ?? undefined },
    create: {
      projectId,
      name,
      email,
      customFields: customFields ?? undefined,
      status: "invited",
    },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  let emailSent = false;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { status: true } });
  if (project?.status === "active") {
    try {
      await sendParticipantInvitation(participant.id);
      emailSent = true;
    } catch (err) {
      console.error("Failed to send auto-invitation:", err);
    }
  }

  return { participant, emailSent };
}

export type BulkImportResult = {
  imported: number;
  skipped: number;
  errors: { row: number; name: string; email: string; reason: string }[];
};

export async function bulkImportParticipants(
  projectId: string,
  rows: { name: string; email: string; customFields?: Record<string, string> }[]
): Promise<BulkImportResult> {
  const result: BulkImportResult = { imported: 0, skipped: 0, errors: [] };

  const existingEmails = new Set(
    (
      await db.participant.findMany({
        where: { projectId },
        select: { email: true },
      })
    ).map((p) => p.email.toLowerCase())
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (!row.name?.trim()) {
      result.errors.push({ row: rowNum, name: row.name ?? "", email: row.email ?? "", reason: "Name is required" });
      continue;
    }
    if (!row.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
      result.errors.push({ row: rowNum, name: row.name ?? "", email: row.email ?? "", reason: "Invalid email address" });
      continue;
    }

    const emailLower = row.email.trim().toLowerCase();
    if (existingEmails.has(emailLower)) {
      result.errors.push({ row: rowNum, name: row.name.trim(), email: emailLower, reason: "Email already exists in this project" });
      continue;
    }

    await db.participant.upsert({
      where: { projectId_email: { projectId, email: emailLower } },
      update: { name: row.name.trim(), customFields: row.customFields ?? undefined },
      create: {
        projectId,
        name: row.name.trim(),
        email: emailLower,
        customFields: row.customFields ?? undefined,
        status: "invited",
      },
    });
    existingEmails.add(emailLower);
    result.imported++;
  }

  return result;
}

export async function removeParticipant(id: string): Promise<void> {
  await db.participant.delete({ where: { id } });
}

export async function updateParticipantStatus(
  id: string,
  status: ParticipantStatus
): Promise<ParticipantRecord> {
  return db.participant.update({
    where: { id },
    data: { status },
    include: { project: { select: { id: true, name: true, slug: true } } },
  });
}

export async function sendParticipantInvitation(participantId: string): Promise<void> {
  const participant = await db.participant.findUnique({
    where: { id: participantId },
    include: { project: true },
  });
  if (!participant) throw new Error("Participant not found");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const bookingLink = `${baseUrl}/book/${participant.project.slug}/p/${participant.id}`;

  const template = await getActiveTemplate("participant_invitation", participant.projectId);
  const ctx: Record<string, string> = {
    participant_name: participant.name,
    admin_name: "",
    project_name: participant.project.name,
    session_date: "",
    session_time: "",
    time_zone: participant.project.timezone,
    meeting_link: "",
    booking_link: bookingLink,
    manage_booking_link: "",
    company_logo: "",
    company_name: participant.project.company,
  };
  const rendered = renderTemplate(template, ctx);

  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Scheduler <notifications@eureka-ent.org>",
    to: participant.email,
    subject: rendered.subject,
    html: rendered.bodyHtml,
    text: stripHtml(rendered.bodyHtml),
  });
  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message ?? "Resend did not return an email id");
  }

  await logNotification({
    templateId: template.id,
    category: "participant_invitation",
    projectId: participant.projectId,
    recipientEmail: participant.email,
    recipientRole: "participant",
    subject: rendered.subject,
    renderedBody: rendered.bodyHtml,
    status: "sent",
  });

  await db.participant.update({
    where: { id: participantId },
    data: { lastInvitedAt: new Date() },
  });
}

export async function sendParticipantInvitationsForProject(
  projectId: string,
  participantIds?: string[]
): Promise<{ sent: number; failed: number }> {
  const where: Prisma.ParticipantWhereInput = { projectId };
  if (participantIds?.length) {
    where.id = { in: participantIds };
  } else {
    where.status = { in: ["invited", "link_sent", "reminded"] };
  }

  const participants = await db.participant.findMany({ where });
  let sent = 0;
  let failed = 0;

  for (const p of participants) {
    try {
      await sendParticipantInvitation(p.id);
      sent++;
    } catch (err) {
      console.error(`Failed to send invitation to ${p.email}:`, err);
      await logNotification({
        category: "participant_invitation",
        projectId,
        recipientEmail: p.email,
        recipientRole: "participant",
        subject: "Invitation",
        renderedBody: `Failed to send: ${err instanceof Error ? err.message : String(err)}`,
        status: "failed",
      }).catch(() => {});
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendInvitationsOnActivation(projectId: string): Promise<{ sent: number; failed: number }> {
  return sendParticipantInvitationsForProject(projectId);
}
