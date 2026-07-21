"use server";

import { db } from "@/lib/db";
import { cancelBooking, rescheduleBookingTime } from "@/lib/data/bookings";
import { hoursUntilSession } from "@/lib/slotHelpers";
import { revalidatePath } from "next/cache";

async function getBookingWithProject(bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    select: { dateKey: true, time: true, project: { select: { timezone: true, selfServiceWindowHours: true } } },
  });
}

async function assertSelfServiceWindow(bookingId: string) {
  const b = await getBookingWithProject(bookingId);
  if (!b) throw new Error("Booking not found");
  const hoursLeft = hoursUntilSession(b.dateKey, b.time, b.project.timezone);
  if (hoursLeft < b.project.selfServiceWindowHours) {
    throw new Error("The self-service window has closed — changes must be made by an admin");
  }
}

export async function participantCancelAction(bookingId: string) {
  await assertSelfServiceWindow(bookingId);
  await cancelBooking(bookingId, { actorType: "participant", actorLabel: "Self-service" });
  revalidatePath(`/manage/${bookingId}`);
}

export async function participantRescheduleAction(
  bookingId: string,
  newDateKey: string,
  newTime: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  await assertSelfServiceWindow(bookingId);
  const result = await rescheduleBookingTime(bookingId, newDateKey, newTime, { actor: { actorType: "participant", actorLabel: "Self-service" } });
  if (result.ok) {
    revalidatePath(`/manage/${bookingId}`);
    return { ok: true };
  }
  return result;
}
