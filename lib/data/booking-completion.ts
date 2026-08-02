import { db } from "@/lib/db";
import { isSessionInPast } from "@/lib/slotHelpers";
import { recordAudit } from "@/lib/data/audit";

/**
 * A booking's DISPLAY status.
 *
 * "awaiting_completion" is NOT a stored enum value — it is derived at
 * display time: a confirmed booking whose real session time has already
 * passed (evaluated in the project's real IANA timezone) and whose
 * project requires manual completion (autoCompleteBookings=false).
 *
 * For autoCompleteBookings=true projects, a past confirmed booking is
 * derived as "completed" (it is transitioned to a real stored
 * status="completed" lazily by `completePastConfirmedBookings`).
 */
export function getBookingDisplayStatus(args: {
  status: string;
  dateKey: string;
  time: string;
  timezone: string;
  autoCompleteBookings: boolean;
}): string {
  if (args.status !== "confirmed") return args.status;
  if (!isSessionInPast(args.dateKey, args.time, args.timezone)) return "confirmed";
  return args.autoCompleteBookings ? "completed" : "awaiting_completion";
}

/**
 * LAZY auto-completion (best-effort — NOT a scheduled job).
 *
 * Finds all status="confirmed" bookings whose session time has passed and
 * whose project has autoCompleteBookings=true, and flips them to the real
 * stored status="completed". Called at the top of frequently-hit data
 * loads (dashboard, calendar, admin stats). Same honest caveat as the
 * waitlist offer expiry: it can lag if nobody visits a relevant page for
 * a while; completion is eventually consistent, not guaranteed-on-time.
 */
export async function completePastConfirmedBookings(): Promise<number> {
  const candidates = await db.booking.findMany({
    where: { status: "confirmed", project: { autoCompleteBookings: true } },
    select: {
      id: true,
      dateKey: true,
      time: true,
      projectId: true,
      adminId: true,
      participantName: true,
      project: { select: { timezone: true } },
    },
  });

  const past = candidates.filter((b) =>
    isSessionInPast(b.dateKey, b.time, b.project.timezone)
  );

  if (past.length === 0) return 0;

  await db.$transaction(
    past.map((b) =>
      db.booking.update({
        where: { id: b.id },
        data: { status: "completed" },
        select: { id: true },
      })
    )
  );

  for (const b of past) {
    recordAudit({
      action: "booking_completed",
      actorType: "system",
      actorId: b.adminId,
      actorLabel: "System (auto-complete)",
      entityType: "Booking",
      entityId: b.id,
      projectId: b.projectId,
      afterState: {
        dateKey: b.dateKey,
        time: b.time,
        participantName: b.participantName,
        status: "completed",
        method: "auto",
      },
    }).catch(() => {});
  }

  return past.length;
}
