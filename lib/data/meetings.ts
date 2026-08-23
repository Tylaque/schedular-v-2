// Meeting provisioning orchestration.
//
// Teams logic (create/delete/update via Microsoft Graph) moved here unchanged
// from lib/data/bookings.ts. Zoom provisioning is layered on top and follows
// the project's meetingPlatformPreference:
//
//   teams → Teams only (no Zoom attempt).
//   zoom  → Zoom only. If the pool is full or the Zoom API fails, the booking
//           keeps platform "zoom" with zoomProvisionStatus "failed" and the
//           owner is emailed (category zoom_pool_full_no_fallback). No Teams
//           fallback.
//   auto  → Zoom first. If the pool is full or the Zoom API fails, fall back to
//           Teams (category zoom_fallback_to_teams email + audit).
//
// An audit event is recorded on every fallback outcome.

import { Resend } from "resend";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import { getActiveTemplate, renderTemplate } from "@/lib/data/templates";
import { logNotification } from "@/lib/data/notifications";
import { stripHtml } from "@/lib/html-to-text";
import { createMeetingEvent, deleteMeetingEvent, updateMeetingEventTime } from "@/lib/graph/client";
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeetingTime, zoomPoolConfigured } from "@/lib/zoom/client";
import { claimZoomAccountForBooking, bookingToUtcISO } from "@/lib/data/zoom";
import { log } from "@/lib/log";
import { sendIntegrationFailureAlert } from "@/lib/data/monitoring-alerts";
import type { ZoomAccount } from "@prisma/client";

const NOTIFICATION_FROM = process.env.EMAIL_FROM ?? "Scheduler <notifications@eureka-ent.org>";

export type ZoomFallbackReason = "zoom_pool_full_no_fallback" | "zoom_provision_failed";

type ProjectForProvision = {
  id: string;
  ownerId: string | null;
  name: string;
  company: string;
  timezone: string;
  durationMinutes: number;
  meetingPlatformPreference: "zoom" | "teams" | "auto";
};

type BookingForProvision = {
  id: string;
  projectId: string;
  participantName: string;
  participantEmail: string;
  adminId: string;
  dateKey: string;
  time: string;
  meetingPlatform: "zoom" | "teams" | null;
  zoomAccountId: string | null;
};

function zoomFallbackEmailCategory(reason: ZoomFallbackReason, fellBackToTeams: boolean): "zoom_fallback_to_teams" | "zoom_pool_full_no_fallback" {
  return fellBackToTeams ? "zoom_fallback_to_teams" : "zoom_pool_full_no_fallback";
}

async function notifyOwnerAndAudit(input: {
  project: ProjectForProvision;
  booking: BookingForProvision;
  reason: ZoomFallbackReason;
  fellBackToTeams: boolean;
  detail: Record<string, string>;
}) {
  recordAudit({
    action: input.fellBackToTeams ? "zoom_fallback_to_teams" : input.reason,
    actorType: "system",
    actorLabel: "Meeting Provisioner",
    entityType: "Booking",
    entityId: input.booking.id,
    projectId: input.project.id,
    afterState: {
      participantName: input.booking.participantName,
      participantEmail: input.booking.participantEmail,
      dateKey: input.booking.dateKey,
      time: input.booking.time,
      reason: input.reason,
      ...input.detail,
    },
  }).catch(() => {});

  try {
    const owner = await db.admin.findUnique({
      where: { id: input.project.ownerId! },
      select: { email: true, name: true },
    });
    if (!owner?.email) return;

    const category = zoomFallbackEmailCategory(input.reason, input.fellBackToTeams);
    const template = await getActiveTemplate(category, input.project.id);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

    const ctx = {
      participant_name: input.booking.participantName,
      admin_name: owner.name ?? "",
      project_name: input.project.name,
      company_name: input.project.company,
      session_date: input.booking.dateKey,
      session_time: input.booking.time,
      time_zone: input.project.timezone,
      meeting_link: "",
      booking_link: `${baseUrl}/book/${input.project.id}`,
      manage_booking_link: `${baseUrl}/manage/${input.booking.id}`,
      company_logo: "",
    };

    const rendered = renderTemplate(template, ctx);
    const resendApiKey = process.env.RESEND_API_KEY ?? "";
    if (!resendApiKey) {
      await logNotification({
        templateId: template.id,
        category,
        projectId: input.project.id,
        recipientEmail: owner.email,
        recipientRole: "super_admin",
        subject: rendered.subject,
        renderedBody: rendered.bodyHtml,
        status: "failed",
      });
      return;
    }
    const resend = new Resend(resendApiKey);
    try {
      const result = await resend.emails.send({
        from: NOTIFICATION_FROM,
        to: owner.email,
        subject: rendered.subject,
        html: rendered.bodyHtml,
        text: stripHtml(rendered.bodyHtml),
      });
      if (result.error || !result.data?.id) {
        throw new Error(result.error?.message ?? "Resend did not return an email id");
      }
      await logNotification({
        templateId: template.id,
        category,
        projectId: input.project.id,
        recipientEmail: owner.email,
        recipientRole: "super_admin",
        subject: rendered.subject,
        renderedBody: rendered.bodyHtml,
        status: "sent",
      });
    } catch (sendErr) {
      await logNotification({
        templateId: template.id,
        category,
        projectId: input.project.id,
        recipientEmail: owner.email,
        recipientRole: "super_admin",
        subject: rendered.subject,
        renderedBody: rendered.bodyHtml,
        status: "failed",
      }).catch(() => {});
    }
  } catch (err) {
    log("error", "zoom", "Failed to send Zoom fallback owner notification", {
      projectId: input.project.id,
      bookingId: input.booking.id,
      reason: input.reason,
      error: String(err),
    });
  }
}

async function provisionTeamsMeeting(
  project: ProjectForProvision,
  booking: BookingForProvision,
  zoomFallbackReason?: ZoomFallbackReason
) {
  const result = await createMeetingEvent(project.ownerId!, {
    id: booking.id,
    projectId: booking.projectId,
    participantName: booking.participantName,
    participantEmail: booking.participantEmail,
    adminId: booking.adminId,
    dateKey: booking.dateKey,
    time: booking.time,
  });

  if ("error" in result) {
    const statusMap = {
      personal: "failed_personal_account" as const,
      insufficient_permissions: "failed_insufficient_permissions" as const,
      unknown: "failed_unknown" as const,
    };
    log("error", "teams", "Teams provisioning failed", {
      projectId: project.id,
      bookingId: booking.id,
      error: result.error,
      detail: result.detail,
      teamsProvisionStatus: statusMap[result.error],
    });
    await db.booking.update({
      where: { id: booking.id },
      data: {
        meetingPlatform: "teams",
        teamsProvisionStatus: statusMap[result.error],
        teamsErrorDetail: result.detail ?? result.error,
        ...(zoomFallbackReason ? { meetingFallbackReason: zoomFallbackReason } : {}),
      },
    });
    if (zoomFallbackReason) {
      await notifyOwnerAndAudit({
        project,
        booking,
        reason: zoomFallbackReason,
        fellBackToTeams: true,
        detail: { teamsProvisionStatus: statusMap[result.error] },
      });
      sendIntegrationFailureAlert({
        projectId: project.id,
        bookingId: booking.id,
        failureType: "teams_failed_after_zoom_fallback",
        detail: `Teams fallback failed after ${zoomFallbackReason}: ${result.error}${result.detail ? ` — ${result.detail}` : ""}`,
      }).catch(() => {});
    } else {
      sendIntegrationFailureAlert({
        projectId: project.id,
        bookingId: booking.id,
        failureType: "teams_provision_failed",
        detail: `Teams error: ${result.error}${result.detail ? ` — ${result.detail}` : ""}`,
      }).catch(() => {});
    }
    return;
  }

  await db.booking.update({
    where: { id: booking.id },
    data: {
      meetingPlatform: "teams",
      teamsMeetingId: result.teamsMeetingId,
      calendarEventId: result.calendarEventId,
      teamsJoinUrl: result.joinUrl,
      teamsProvisionStatus: "provisioned",
      ...(zoomFallbackReason ? { meetingFallbackReason: zoomFallbackReason } : {}),
    },
  });

  if (zoomFallbackReason) {
    await notifyOwnerAndAudit({
      project,
      booking,
      reason: zoomFallbackReason,
      fellBackToTeams: true,
      detail: { teamsProvisionStatus: "provisioned" },
    });
  }
}

async function markZoomFailed(
  project: ProjectForProvision,
  booking: BookingForProvision,
  reason: ZoomFallbackReason,
  detail: string
) {
  await db.booking.update({
    where: { id: booking.id },
    data: {
      meetingPlatform: "zoom",
      zoomProvisionStatus: "failed",
      zoomErrorDetail: detail,
      meetingFallbackReason: reason,
    },
  });
  await notifyOwnerAndAudit({
    project,
    booking,
    reason,
    fellBackToTeams: false,
    detail: { zoomErrorDetail: detail },
  });
  sendIntegrationFailureAlert({
    projectId: project.id,
    bookingId: booking.id,
    failureType: "zoom_failed_no_fallback",
    detail: `Zoom failed (${reason}): ${detail}`,
  }).catch(() => {});
}

/**
 * Full provisioning pipeline for a booking. Called fire-and-forget after
 * booking creation; also the single entry point for tests.
 */
export async function provisionMeeting(projectId: string, bookingId: string): Promise<void> {
  const [project, booking] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        name: true,
        company: true,
        timezone: true,
        durationMinutes: true,
        meetingPlatformPreference: true,
      },
    }),
    db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        projectId: true,
        participantName: true,
        participantEmail: true,
        adminId: true,
        dateKey: true,
        time: true,
        meetingPlatform: true,
        zoomAccountId: true,
      },
    }),
  ]);
  if (!project?.ownerId || !booking) return;
  if (booking.meetingPlatform) return; // already provisioned

  const pref = project.meetingPlatformPreference;

  if (pref === "teams") {
    await provisionTeamsMeeting(project, booking);
    return;
  }

  const claim = await claimZoomAccountForBooking({
    bookingId: booking.id,
    dateKey: booking.dateKey,
    time: booking.time,
    timezone: project.timezone,
    durationMinutes: project.durationMinutes,
  });

  if (claim.ok) {
    const start = bookingToUtcISO(booking.dateKey, booking.time, project.timezone);
    const created = await createZoomMeeting({
      zoomUserId: claim.account.zoomUserId,
      topic: `Booking: ${booking.participantName}`,
      startTime: start,
      durationMinutes: project.durationMinutes,
    });
    if (created.ok) {
      await db.booking.update({
        where: { id: booking.id },
        data: {
          meetingPlatform: "zoom",
          zoomMeetingId: created.meeting.id,
          zoomJoinUrl: created.meeting.joinUrl,
          zoomProvisionStatus: "provisioned",
          zoomErrorDetail: null,
          meetingFallbackReason: null,
        },
      });
      return;
    }

    // Account was claimed but the Zoom API failed — release the claim so the
    // account is not wasted, then fall back (auto) or fail (zoom).
    await db.booking.update({ where: { id: booking.id }, data: { zoomAccountId: null } });
    const reason: ZoomFallbackReason = "zoom_provision_failed";
    if (pref === "auto") {
      await provisionTeamsMeeting(project, booking, reason);
    } else {
      await markZoomFailed(
        project,
        booking,
        reason,
        created.error === "auth_failed"
          ? "Zoom Server-to-Server auth failed — check ZOOM_CLIENT_SECRET / app scopes."
          : created.detail ?? "Zoom API error"
      );
    }
    return;
  }

  if (claim.reason === "pool_full") {
    if (pref === "auto") {
      await provisionTeamsMeeting(project, booking, "zoom_pool_full_no_fallback");
    } else {
      await markZoomFailed(project, booking, "zoom_pool_full_no_fallback", "No free Zoom account for this slot.");
    }
    return;
  }

  const reason: ZoomFallbackReason = "zoom_provision_failed";
  if (pref === "auto") {
    await provisionTeamsMeeting(project, booking, reason);
  } else {
    await markZoomFailed(project, booking, reason, claim.detail ?? "Zoom account claim failed");
  }
}

/**
 * Delete the live meeting (Teams and/or Zoom) for a booking on cancellation.
 */
export async function removeMeeting(projectId: string, bookingId: string): Promise<void> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  if (!project?.ownerId) return;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { teamsMeetingId: true, zoomMeetingId: true, meetingPlatform: true },
  });
  if (!booking) return;

  if (booking.teamsMeetingId) {
    const result = await deleteMeetingEvent(project.ownerId, booking.teamsMeetingId);
    if ("error" in result) {
      log("error", "teams", "Failed to delete Teams meeting", {
        bookingId,
        teamsMeetingId: booking.teamsMeetingId,
        error: result.error,
      });
      sendIntegrationFailureAlert({
        projectId,
        bookingId,
        failureType: "meeting_delete_failed",
        detail: `Teams delete failed: ${result.error}`,
      }).catch(() => {});
    }
  }

  if (booking.zoomMeetingId) {
    try {
      if (zoomPoolConfigured()) {
        await deleteZoomMeeting(booking.zoomMeetingId);
      }
    } catch (err) {
      log("error", "zoom", "Failed to delete Zoom meeting", {
        bookingId,
        zoomMeetingId: booking.zoomMeetingId,
        error: String(err),
      });
    }
  }
}

/**
 * Update a booking's live meeting time after a reschedule. The new booking row
 * carries the original meeting ids (see rescheduleBookingTime in bookings.ts),
 * so the same Teams/Zoom meeting is updated in place.
 */
export async function updateMeetingTime(
  projectId: string,
  bookingId: string,
  newDateKey: string,
  newTime: string
): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, timezone: true, durationMinutes: true },
  });
  if (!project?.ownerId) return;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      projectId: true,
      adminId: true,
      participantName: true,
      participantEmail: true,
      calendarEventId: true,
      zoomMeetingId: true,
      meetingPlatform: true,
    },
  });
  if (!booking) return;

  if (booking.meetingPlatform === "zoom" && booking.zoomMeetingId) {
    try {
      if (zoomPoolConfigured()) {
        await updateZoomMeetingTime(
          booking.zoomMeetingId,
          bookingToUtcISO(newDateKey, newTime, project.timezone),
          project.durationMinutes
        );
      }
    } catch (err) {
      log("error", "zoom", "Failed to update Zoom meeting time", {
        bookingId,
        zoomMeetingId: booking.zoomMeetingId,
        newDateKey,
        newTime,
        error: String(err),
      });
    }
    return;
  }

  if (booking.meetingPlatform === "teams" && booking.calendarEventId) {
    const result = await updateMeetingEventTime(project.ownerId, {
      id: booking.id,
      projectId: booking.projectId,
      participantName: booking.participantName,
      participantEmail: booking.participantEmail,
      adminId: booking.adminId,
      dateKey: newDateKey,
      time: newTime,
      calendarEventId: booking.calendarEventId,
    });
    if ("error" in result) {
      log("error", "teams", "Failed to update Teams meeting time", {
        bookingId,
        calendarEventId: booking.calendarEventId,
        newDateKey,
        newTime,
        error: result.error,
      });
      sendIntegrationFailureAlert({
        projectId,
        bookingId,
        failureType: "meeting_update_failed",
        detail: `Teams reschedule failed: ${result.error}`,
      }).catch(() => {});
    }
  }
}
