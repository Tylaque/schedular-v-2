import { db } from "@/lib/db";
import { demoRecipientEmail, isDemoProjectId } from "@/lib/demo";
import { logNotification } from "@/lib/data/notifications";
import { getActiveTemplate, renderTemplate } from "@/lib/data/templates";
import { hoursUntilSession } from "@/lib/slotHelpers";
import { getReminderSchedules } from "@/lib/data/reminder-schedules";
import { Resend } from "resend";
import { stripHtml } from "@/lib/html-to-text";

const NOTIFICATION_FROM =
  process.env.EMAIL_FROM ?? "Scheduler <notifications@eureka-ent.org>";

type ReminderResult = Record<string, number> & { errors: number };

const DEFAULT_SCHEDULES = [
  { hoursBefore: 24, label: "24 Hour Reminder" },
  { hoursBefore: 1, label: "1 Hour Reminder" },
];

function todayKeyUTC(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export async function sendReminders(): Promise<ReminderResult> {
  const results: ReminderResult = { errors: 0 };
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const today = todayKeyUTC();
  const horizon = addDays(today, 2);

  const bookings = await db.booking.findMany({
    where: {
      status: "confirmed",
      dateKey: { gte: today, lte: horizon },
    },
    select: {
      id: true,
      projectId: true,
      adminId: true,
      participantName: true,
      participantEmail: true,
      dateKey: true,
      time: true,
      project: {
        select: { name: true, company: true, timezone: true },
      },
      admin: {
        select: { name: true },
      },
      sessionType: {
        select: { classification: true },
      },
    },
  });

  const scheduleCache = new Map<string, { hoursBefore: number; label: string }[]>();

  for (const booking of bookings) {
    const tz = booking.project.timezone || "Africa/Nairobi";
    const recipientEmail = isDemoProjectId(booking.projectId)
      ? demoRecipientEmail("participant", booking.participantEmail)
      : booking.participantEmail;
    const hours = hoursUntilSession(booking.dateKey, booking.time, tz);

    if (!scheduleCache.has(booking.projectId)) {
      const dbSchedules = await getReminderSchedules(booking.projectId);
      scheduleCache.set(
        booking.projectId,
        dbSchedules.length > 0
          ? dbSchedules.map((s) => ({ hoursBefore: s.hoursBefore, label: s.label }))
          : DEFAULT_SCHEDULES
      );
    }
    const schedules = scheduleCache.get(booking.projectId)!;

    for (const schedule of schedules) {
      if (hours < schedule.hoursBefore - 1 || hours > schedule.hoursBefore + 0.75) continue;

      const category = "reminder" as const;
      const dedupKey = `${category}_${schedule.hoursBefore}`;

      const alreadySent = await db.notificationLog.findFirst({
        where: {
          category,
          projectId: booking.projectId,
          recipientEmail,
          hoursBefore: schedule.hoursBefore,
          createdAt: { gte: new Date(today + "T00:00:00Z") },
        },
        select: { id: true },
      });
      if (alreadySent) continue;

      try {
        const template = await getActiveTemplate(category, booking.projectId);
        const isFeedback = booking.sessionType?.classification === "FEEDBACK";
        const ctx = {
          participant_name: booking.participantName,
          project_name: booking.project.name ?? "",
          company_name: booking.project.company ?? "",
          session_date: booking.dateKey,
          session_time: booking.time,
          admin_name: booking.admin.name ?? "",
          time_zone: tz,
          meeting_link: `${baseUrl}/manage/${booking.id}`,
          booking_link: `${baseUrl}/book/${booking.projectId}`,
          manage_booking_link: `${baseUrl}/manage/${booking.id}`,
          company_logo: "",
          reminder_label: schedule.label,
          is_feedback: isFeedback ? "true" : "",
        };
        const rendered = renderTemplate(template, ctx);

        const sendResult = await resend.emails.send({
          from: NOTIFICATION_FROM,
          to: recipientEmail,
          subject: rendered.subject,
          html: rendered.bodyHtml,
          text: stripHtml(rendered.bodyHtml),
        });

        const status = sendResult.error || !sendResult.data?.id ? "failed" : "sent";

        await logNotification({
          templateId: template.id,
          category,
          projectId: booking.projectId,
          recipientEmail,
          recipientRole: "participant",
          subject: rendered.subject,
          renderedBody: rendered.bodyHtml,
          status,
          hoursBefore: schedule.hoursBefore,
        });

        if (status === "sent") {
          results[dedupKey] = (results[dedupKey] || 0) + 1;
        } else {
          results.errors++;
        }
      } catch (err) {
        console.error(
          `[reminders] Failed to send ${dedupKey} for booking ${booking.id}:`,
          err
        );
        results.errors++;
      }
    }
  }

  return results;
}
