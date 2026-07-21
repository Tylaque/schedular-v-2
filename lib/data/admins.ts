import { db } from "@/lib/db";
import { Resend } from "resend";
import { getActiveTemplate, renderTemplate } from "@/lib/data/templates";
import { logNotification } from "@/lib/data/notifications";
import { createPasswordToken } from "@/lib/data/password-reset";

export type AdminRecord = {
  id: string;
  name: string;
  initials: string;
  email: string;
  accountType: string | null;
  role: string;
};

export async function listAllAdmins(): Promise<AdminRecord[]> {
  const rows = await db.admin.findMany({ orderBy: { name: "asc" } });
  return rows.map((a) => ({ id: a.id, name: a.name, initials: a.initials, email: a.email, accountType: a.accountType, role: a.role }));
}

export async function listSuperAdmins(): Promise<AdminRecord[]> {
  const rows = await db.admin.findMany({
    where: { role: { in: ["super_admin", "org_owner"] } },
    orderBy: { name: "asc" },
  });
  return rows.map((a) => ({ id: a.id, name: a.name, initials: a.initials, email: a.email, accountType: a.accountType, role: a.role }));
}

export async function inviteAssociate(input: {
  name: string;
  email: string;
  projectId?: string;
}): Promise<AdminRecord> {
  let admin = await db.admin.findUnique({ where: { email: input.email } });

  if (admin) {
    if (!admin.name || admin.name === admin.email.split("@")[0]) {
      const initials = input.name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
      admin = await db.admin.update({
        where: { id: admin.id },
        data: { name: input.name, initials },
      });
    }
  } else {
    const initials = input.name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    admin = await db.admin.create({
      data: {
        name: input.name,
        email: input.email,
        initials,
        role: "admin",
        accountType: "no_microsoft",
      },
    });
  }

  if (input.projectId) {
    await db.projectAdmin.upsert({
      where: { projectId_adminId: { projectId: input.projectId, adminId: admin.id } },
      update: {},
      create: { projectId: input.projectId, adminId: admin.id },
    });
  }

  // Send email via Resend
  try {
    const projectName = input.projectId
      ? (await db.project.findUnique({ where: { id: input.projectId }, select: { name: true, company: true } }))
      : null;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3002";
    const projectLabel = projectName ? `${projectName.name} at ${projectName.company}` : "a project";
    const resend = new Resend(process.env.RESEND_API_KEY ?? "");

    if (admin.passwordHash) {
      // Existing user with password — send "added to project" notice
      const template = await getActiveTemplate("admin_invitation", input.projectId ?? undefined);
      const ctx: Record<string, string> = {
        admin_name: input.name,
        admin_email: input.email,
        project_name: projectName?.name ?? "",
        company_name: projectName?.company ?? "",
        booking_link: `${baseUrl}/auth/signin`,
        company_logo: "",
      };
      const rendered = renderTemplate(template, ctx);
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "Scheduler <onboarding@scheduler.example.com>",
        to: input.email,
        subject: rendered.subject,
        html: rendered.bodyHtml,
      });
      await logNotification({
        templateId: template.id,
        category: "admin_invitation",
        projectId: input.projectId ?? undefined,
        recipientEmail: input.email,
        recipientRole: "admin",
        subject: rendered.subject,
        renderedBody: rendered.bodyHtml,
        status: "sent",
      });
    } else {
      // New user without password — send setup link
      const { rawToken } = await createPasswordToken(admin.id);
      const setupUrl = `${baseUrl}/auth/set-password/${rawToken}`;

      const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:40px 20px;background-color:#f3f4f6;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:32px 32px 0;">
<h1 style="margin:0;font-size:20px;font-weight:700;color:#111827;">You've been invited to ${projectLabel}</h1>
</td></tr>
<tr><td style="padding:16px 32px;">
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">Hi ${input.name},</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
You've been added as an associate on <strong>${projectName ? projectName.name : "a project"}</strong> at ${projectName ? projectName.company : "your organisation"}.
</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
To get started, set up your password using the link below. This link expires in 48 hours.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background-color:#7c3aed;border-radius:8px;padding:12px 24px;">
<a href="${setupUrl}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">
Set up your password
</a>
</td></tr>
</table>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
If you did not expect this invitation, you can safely ignore this email.
</p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;">
Scheduler &mdash; Multi-project scheduling platform
</p>
</td></tr>
</table>
</td></tr>
</table>`;
      const subject = `You've been invited to ${projectLabel}`;

      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "Scheduler <onboarding@scheduler.example.com>",
        to: input.email,
        subject,
        html,
      });
      await logNotification({
        category: "admin_invitation",
        projectId: input.projectId ?? undefined,
        recipientEmail: input.email,
        recipientRole: "admin",
        subject,
        renderedBody: html,
        status: "sent",
      });
    }
  } catch (err) {
    console.error("Failed to send invitation email via Resend:", err);
    await logNotification({
      category: "admin_invitation",
      projectId: input.projectId ?? undefined,
      recipientEmail: input.email,
      recipientRole: "admin",
      subject: "You've been invited",
      renderedBody: `Failed to send: ${err instanceof Error ? err.message : String(err)}`,
      status: "failed",
    }).catch(() => {});
  }

  return { id: admin.id, name: admin.name, initials: admin.initials, email: admin.email, accountType: admin.accountType, role: admin.role };
}
