import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import { isAdminEligibleForSlot, pickAvailableAdmin } from "@/lib/data/bookings";
import { isSessionInPast } from "@/lib/slotHelpers";

type OffboardingResult = {
  reassigned: { bookingId: string; oldAdminId: string; newAdminId: string }[];
  flagged: { bookingId: string; reason: string }[];
};

/**
 * Process future confirmed bookings for a departing admin on a project.
 *
 * For each booking:
 * - If an eligible remaining admin exists at the exact same dateKey/time: reassign
 * - If no eligible admin: flag for manual attention
 *
 * Resilient — one booking's failure never stops the others.
 */
export async function offboardAdminFromProject(
  projectId: string,
  departingAdminId: string,
  remainingAdminIds: string[],
): Promise<OffboardingResult> {
  const result: OffboardingResult = { reassigned: [], flagged: [] };

  if (remainingAdminIds.length === 0) {
    // No remaining admins — flag all departing bookings
    try {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { timezone: true },
      });
      const tz = project?.timezone ?? "UTC";

      const bookings = await db.booking.findMany({
        where: {
          projectId,
          adminId: departingAdminId,
          status: "confirmed",
        },
        select: { id: true, dateKey: true, time: true },
      });

      const departingAdmin = await db.admin.findUnique({
        where: { id: departingAdminId },
        select: { name: true },
      });

      for (const booking of bookings) {
        if (isSessionInPast(booking.dateKey, booking.time, tz)) continue;

        const reason = `Admin ${departingAdmin?.name ?? departingAdminId} was removed from this project; no other assigned associate is available at this session's date/time — please reassign manually.`;
        await db.booking.update({
          where: { id: booking.id },
          data: { needsManualAttention: true, manualAttentionReason: reason },
        });

        await recordAudit({
          action: "booking_rescheduled",
          actorType: "system",
          actorLabel: `Off-boarding: no remaining admins for project`,
          entityType: "Booking",
          entityId: booking.id,
          projectId,
          beforeState: { adminId: departingAdminId, needsManualAttention: false },
          afterState: { adminId: departingAdminId, needsManualAttention: true, reason },
        });

        result.flagged.push({ bookingId: booking.id, reason });
      }
    } catch (err) {
      console.error("Offboarding failed (no remaining admins path):", err);
    }
    return result;
  }

  // Fetch project details for eligibility checks
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      timezone: true,
      durationMinutes: true,
      bufferMinutes: true,
      maxSessionsPerAdminPerDay: true,
    },
  });
  const tz = project?.timezone ?? "UTC";

  // Get all departing admin's future confirmed bookings on this project
  let bookings: { id: string; dateKey: string; time: string }[];
  try {
    const allBookings = await db.booking.findMany({
      where: {
        projectId,
        adminId: departingAdminId,
        status: "confirmed",
      },
      select: { id: true, dateKey: true, time: true },
    });
    bookings = allBookings.filter((b) => !isSessionInPast(b.dateKey, b.time, tz));
  } catch (err) {
    console.error("Failed to fetch departing admin bookings:", err);
    return result;
  }

  const departingAdmin = await db.admin.findUnique({
    where: { id: departingAdminId },
    select: { name: true },
  });

  for (const booking of bookings) {
    try {
      // Try each remaining admin for eligibility at this exact slot
      let pickedAdminId: string | null = null;

      for (const candidateId of remainingAdminIds) {
        const eligible = await isAdminEligibleForSlot(
          projectId,
          candidateId,
          booking.dateKey,
          booking.time,
        );
        if (eligible) {
          pickedAdminId = candidateId;
          break; // Use first eligible (same order as pickAvailableAdmin)
        }
      }

      if (pickedAdminId) {
        // Reassign
        await db.booking.update({
          where: { id: booking.id },
          data: { adminId: pickedAdminId },
        });

        const newAdmin = await db.admin.findUnique({
          where: { id: pickedAdminId },
          select: { name: true },
        });

        await recordAudit({
          action: "booking_rescheduled",
          actorType: "system",
          actorLabel: `Off-boarding: ${departingAdmin?.name ?? departingAdminId} removed from project`,
          entityType: "Booking",
          entityId: booking.id,
          projectId,
          beforeState: { adminId: departingAdminId, dateKey: booking.dateKey, time: booking.time },
          afterState: { adminId: pickedAdminId, dateKey: booking.dateKey, time: booking.time },
        });

        result.reassigned.push({
          bookingId: booking.id,
          oldAdminId: departingAdminId,
          newAdminId: pickedAdminId,
        });
      } else {
        // Flag for manual attention
        const reason = `Admin ${departingAdmin?.name ?? departingAdminId} was removed from this project; no other assigned associate is available at session ${booking.dateKey} ${booking.time} — please reassign manually.`;
        await db.booking.update({
          where: { id: booking.id },
          data: { needsManualAttention: true, manualAttentionReason: reason },
        });

        await recordAudit({
          action: "booking_rescheduled",
          actorType: "system",
          actorLabel: `Off-boarding: flagged — no eligible replacement for ${departingAdmin?.name ?? departingAdminId}`,
          entityType: "Booking",
          entityId: booking.id,
          projectId,
          beforeState: { adminId: departingAdminId, needsManualAttention: false },
          afterState: { adminId: departingAdminId, needsManualAttention: true, reason },
        });

        result.flagged.push({ bookingId: booking.id, reason });
      }
    } catch (err) {
      console.error(`Failed to process booking ${booking.id} during offboarding:`, err);
    }
  }

  return result;
}
