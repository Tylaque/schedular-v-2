import { Resend } from "resend";
import { db } from "@/lib/db";
import { logNotification } from "@/lib/data/notifications";
import { log } from "@/lib/log";

const NOTIFICATION_FROM = process.env.EMAIL_FROM ?? "Scheduler <notifications@eureka-ent.org>";
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

type FailureType =
  | "teams_provision_failed"
  | "zoom_failed_no_fallback"
  | "teams_failed_after_zoom_fallback"
  | "email_send_failed"
  | "meeting_delete_failed"
  | "meeting_update_failed";

const FAILURE_LABELS: Record<FailureType, string> = {
  teams_provision_failed: "Teams meeting creation failed",
  zoom_failed_no_fallback: "Zoom provisioning failed (no fallback)",
  teams_failed_after_zoom_fallback: "Teams fallback failed after Zoom failure",
  email_send_failed: "Email notification send failed",
  meeting_delete_failed: "Meeting deletion failed",
  meeting_update_failed: "Meeting reschedule failed",
};

function buildDedupKey(projectId: string, bookingId: string, failureType: FailureType): string {
  return `integration_failure:${projectId}:${bookingId}:${failureType}`;
}

export async function hasRecentDedup(dedupKey: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  // NOTE on exact-tie boundary behavior: `gte` means "greater than or equal to
  // cutoff." If a fixture's createdAt were exactly equal to the cutoff, it would
  // still be considered inside the window (suppressed). However, because Date.now()
  // always advances between fixture creation and this query, the fixture's
  // createdAt lands slightly before the computed cutoff in practice — so gte
  // evaluates false and the alert fires. A literal exact-tie boundary is not
  // practically reachable given real timestamp precision; only the near-boundary
  // cases (just inside and just outside) are verified.
  const existing = await db.notificationLog.findFirst({
    where: { dedupKey, createdAt: { gte: cutoff } },
    select: { id: true },
  });
  return existing != null;
}

export async function sendIntegrationFailureAlert(input: {
  projectId: string;
  bookingId: string;
  failureType: FailureType;
  detail: string;
}): Promise<void> {
  const dedupKey = buildDedupKey(input.projectId, input.bookingId, input.failureType);

  log("error", "integration", `${FAILURE_LABELS[input.failureType]}: ${input.detail}`, {
    projectId: input.projectId,
    bookingId: input.bookingId,
    failureType: input.failureType,
    dedupKey,
  });

  const duplicate = await hasRecentDedup(dedupKey);
  if (duplicate) {
    log("info", "integration", "Dedup hit — skipping alert email", { dedupKey });
    return;
  }

  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, ownerId: true, name: true, company: true },
  });
  if (!project?.ownerId) {
    log("warn", "integration", "No project owner — cannot send alert", { projectId: input.projectId });
    return;
  }

  const owner = await db.admin.findUnique({
    where: { id: project.ownerId },
    select: { email: true, name: true },
  });
  if (!owner?.email) {
    log("warn", "integration", "Owner has no email — cannot send alert", { ownerId: project.ownerId });
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY ?? "";
  if (!resendApiKey) {
    log("warn", "integration", "RESEND_API_KEY not set — skipping email send", { dedupKey });
    await logNotification({
      category: "integration_failure",
      projectId: input.projectId,
      recipientEmail: owner.email,
      recipientRole: "super_admin",
      subject: `[${FAILURE_LABELS[input.failureType]}] ${project.name}`,
      renderedBody: input.detail,
      status: "failed",
      dedupKey,
    }).catch(() => {});
    return;
  }

  const resend = new Resend(resendApiKey);
  const subject = `[Integration Alert] ${FAILURE_LABELS[input.failureType]} — ${project.name}`;
  const html = [
    `<p><strong>${FAILURE_LABELS[input.failureType]}</strong></p>`,
    `<p>Project: ${project.name} (${project.company})</p>`,
    `<p>Booking ID: ${input.bookingId}</p>`,
    `<p>Detail: ${input.detail}</p>`,
    `<p style="color:#666;font-size:12px">This is an automated alert. Check the <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/admin/needs-attention">Needs Attention</a> page for details.</p>`,
  ].join("\n");

  try {
    const result = await resend.emails.send({
      from: NOTIFICATION_FROM,
      to: owner.email,
      subject,
      html,
    });
    if (result.error || !result.data?.id) {
      throw new Error(result.error?.message ?? "Resend did not return an email id");
    }
    await logNotification({
      category: "integration_failure",
      projectId: input.projectId,
      recipientEmail: owner.email,
      recipientRole: "super_admin",
      subject,
      renderedBody: html,
      status: "sent",
      dedupKey,
    });
    log("info", "integration", "Alert email sent", { to: owner.email, dedupKey });
  } catch (sendErr) {
    await logNotification({
      category: "integration_failure",
      projectId: input.projectId,
      recipientEmail: owner.email,
      recipientRole: "super_admin",
      subject,
      renderedBody: html,
      status: "failed",
      dedupKey,
    }).catch(() => {});
    log("error", "integration", "Alert email send failed", { to: owner.email, dedupKey, error: String(sendErr) });
  }
}
