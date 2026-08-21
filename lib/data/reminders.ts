import { db } from "@/lib/db";
import { logNotification } from "@/lib/data/notifications";
import { getActiveTemplate, renderTemplate } from "@/lib/data/templates";
import { hoursUntilSession } from "@/lib/slotHelpers";
import { Resend } from "resend";
import { stripHtml } from "@/lib/html-to-text";

const NOTIFICATION_FROM =
  process.env.EMAIL_FROM ?? "Scheduler <notifications@eureka-ent.org>";

type ReminderResult = { sent24h: number; sent1h: number; errors: number };

function todayKeyUTC(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Find confirmed bookings that need a reminder and send them.
 *
 * Called by the /api/cron/send-reminders endpoint on a 30-minute schedule.
 * Deduplicates via NotificationLog — each (category, projectId, recipientEmail)
 * pair is sent at most once per calendar day.
 *
 * Time windows (using hoursUntilSession):
 *   - reminder_24h: 22–25 hours before session
 *   - reminder_1h:  0.5–1.75 hours before session
 *
 * The windows are deliberately wider than 1 hour / 24 hours so the 30-minute
 * cron interval always catches them.
 */
export async function sendReminders(): Promise<ReminderResult> {
  const results: ReminderResult = { sent24h: 0, sent1h: 0, errors: 0 };
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
    },
  });

  for (const booking of bookings) {
    const tz = booking.project.timezone || "Africa/Nairobi";
    const hours = hoursUntilSession(booking.dateKey, booking.time, tz);

    let category: "reminder_24h" | "reminder_1h" | null = null;
    if (hours >= 22 && hours <= 25) {
      category = "reminder_24h";
    } else if (hours >= 0.5 && hours <= 1.75) {
      category = "reminder_1h";
    }
    if (!category) continue;

    const alreadySent = await db.notificationLog.findFirst({
      where: {
        category,
        projectId: booking.projectId,
        recipientEmail: booking.participantEmail,
        createdAt: { gte: new Date(today + "T00:00:00Z") },
      },
      select: { id: true },
    });
    if (alreadySent) continue;

    try {
      const template = await getActiveTemplate(category, booking.projectId);
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
      };
      const rendered = renderTemplate(template, ctx);

      const sendResult = await resend.emails.send({
        from: NOTIFICATION_FROM,
        to: booking.participantEmail,
        subject: rendered.subject,
        html: rendered.bodyHtml,
        text: stripHtml(rendered.bodyHtml),
      });

      const status = sendResult.error || !sendResult.data?.id ? "failed" : "sent";

      await logNotification({
        templateId: template.id,
        category,
        projectId: booking.projectId,
        recipientEmail: booking.participantEmail,
        recipientRole: "participant",
        subject: rendered.subject,
        renderedBody: rendered.bodyHtml,
        status,
      });

      if (status === "sent") {
        if (category === "reminder_24h") results.sent24h++;
        else results.sent1h++;
      } else {
        results.errors++;
      }
    } catch (err) {
      console.error(
        `[reminders] Failed to send ${category} for booking ${booking.id}:`,
        err
      );
      results.errors++;
    }
  }

  return results;
}
