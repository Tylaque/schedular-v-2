"use server";

import { db } from "@/lib/db";
import { cancelBooking, rescheduleBookingTime } from "@/lib/data/bookings";
import { hoursUntilSession } from "@/lib/slotHelpers";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { signManageToken } from "@/lib/manage-token";

async function getBookingWithProject(bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    select: { dateKey: true, time: true, participantEmail: true, project: { select: { timezone: true, selfServiceWindowHours: true } } },
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

export async function verifyManageEmail(
  bookingId: string,
  email: string
): Promise<{ verified: true; token: string } | { verified: false; error: string }> {
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!checkRateLimit(`manage-verify:${ip}`, 10, 15 * 60 * 1000)) {
    return { verified: false, error: "Too many attempts. Please try again later." };
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { participantEmail: true },
  });
  if (!booking) {
    return { verified: false, error: "Booking not found." };
  }
  if (booking.participantEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
    return { verified: false, error: "Email does not match our records." };
  }
  return { verified: true, token: signManageToken(bookingId, booking.participantEmail) };
}

export async function participantCancelAction(bookingId: string, participantEmail?: string) {
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!checkRateLimit(`manage-cancel:${ip}`, 5, 15 * 60 * 1000)) {
    throw new Error("Too many requests. Please try again later.");
  }

  // Verify email matches (defense-in-depth — client gate is primary, this is server-side enforcement)
  if (participantEmail) {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { participantEmail: true },
    });
    if (!booking || booking.participantEmail.toLowerCase().trim() !== participantEmail.toLowerCase().trim()) {
      throw new Error("Unauthorized — email verification required.");
    }
  }

  await assertSelfServiceWindow(bookingId);
  await cancelBooking(bookingId, { actorType: "participant", actorLabel: "Self-service" });
  try {
    revalidatePath(`/manage/${bookingId}`);
  } catch (err) {
    console.error("Failed to revalidate manage page after participant cancel:", err);
  }
}

export async function participantRescheduleAction(
  bookingId: string,
  newDateKey: string,
  newTime: string,
  participantEmail?: string
): Promise<{ ok: true; newBookingId: string; token: string } | { ok: false; reason: string }> {
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!checkRateLimit(`manage-reschedule:${ip}`, 5, 15 * 60 * 1000)) {
    throw new Error("Too many requests. Please try again later.");
  }

  // Verify email matches
  if (participantEmail) {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { participantEmail: true },
    });
    if (!booking || booking.participantEmail.toLowerCase().trim() !== participantEmail.toLowerCase().trim()) {
      return { ok: false, reason: "Unauthorized — email verification required." };
    }
  }

  await assertSelfServiceWindow(bookingId);
  const result = await rescheduleBookingTime(bookingId, newDateKey, newTime, { actor: { actorType: "participant", actorLabel: "Self-service" } });
  if (result.ok) {
    const newBooking = await db.booking.findUnique({
      where: { id: result.newBooking.id },
      select: { participantEmail: true },
    });
    if (!newBooking) return { ok: false, reason: "not_found" };
    try {
      revalidatePath(`/manage/${bookingId}`);
      revalidatePath(`/manage/${result.newBooking.id}`);
    } catch (err) {
      console.error("Failed to revalidate manage pages after participant reschedule:", err);
    }
    return { ok: true, newBookingId: result.newBooking.id, token: signManageToken(result.newBooking.id, newBooking.participantEmail) };
  }
  return result;
}
