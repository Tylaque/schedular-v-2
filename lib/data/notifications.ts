import { db } from "@/lib/db";
import type { EmailCategory, EmailAudience, NotificationStatus } from "@prisma/client";
import { getActiveTemplate, renderTemplate, MOCK_PREVIEW_CONTEXT } from "@/lib/data/templates";
import { ALL_CATEGORIES } from "@/lib/template-utils";

export async function listNotificationLogs(limit = 100) {
  return db.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export const CATEGORY_LABEL = new Map(ALL_CATEGORIES.map((c) => [c.value, c.label]));

export async function logNotification(input: {
  templateId?: string;
  category: EmailCategory;
  projectId?: string;
  recipientEmail: string;
  recipientRole: EmailAudience;
  subject: string;
  renderedBody: string;
  status: NotificationStatus;
}) {
  return db.notificationLog.create({
    data: {
      templateId: input.templateId ?? null,
      category: input.category,
      projectId: input.projectId ?? null,
      recipientEmail: input.recipientEmail,
      recipientRole: input.recipientRole,
      subject: input.subject,
      renderedBody: input.renderedBody,
      status: input.status,
    },
  });
}

/**
 * Stubbed send — does NOT send a real email. Resolves the active template for the
 * given category, renders it with MOCK_PREVIEW_CONTEXT, and writes a log row with
 * status "test". This is the placeholder until Microsoft Graph mail-send is integrated.
 */
export async function sendTestEmail(
  templateId: string,
  recipientEmail: string
) {
  const template = await db.emailTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  const rendered = renderTemplate(template, MOCK_PREVIEW_CONTEXT);

  return logNotification({
    templateId: template.id,
    category: template.category,
    projectId: template.projectId ?? undefined,
    recipientEmail,
    recipientRole: template.audience,
    subject: rendered.subject,
    renderedBody: rendered.bodyHtml,
    status: "test",
  });
}
