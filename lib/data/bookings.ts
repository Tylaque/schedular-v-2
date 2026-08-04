import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import { offerNextWaitlistEntry } from "@/lib/data/waitlist";
import { getActiveTemplate, renderTemplate } from "@/lib/data/templates";
import { logNotification } from "@/lib/data/notifications";
import { provisionMeeting, removeMeeting, updateMeetingTime } from "@/lib/data/meetings";
import { isAdminAvailableForSlot } from "@/lib/data/availability-ranges";
import { isAdminCertifiedForProject } from "@/lib/data/certifications";
import { timesOverlap } from "@/lib/timeOverlap";
import type { Prisma } from "@prisma/client";

/**
 * Cross-project conflict check: returns true if the admin already has a
 * confirmed booking on this dateKey/time that overlaps with the proposed
 * slot, across ALL projects (not just the current one).
 *
 * Each existing booking's own project duration+buffer is used for the
 * overlap window — not the new project's rules.
 */
export async function hasSchedulingConflict(
  adminId: string,
  dateKey: string,
  time: string,
  newDurationMinutes: number,
  newBufferMinutes: number,
  excludeBookingId?: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx ?? db;

  const existingBookings = await client.booking.findMany({
    where: {
      adminId,
      dateKey,
      status: "confirmed",
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: {
      time: true,
      project: { select: { durationMinutes: true, bufferMinutes: true } },
    },
  });

  for (const b of existingBookings) {
    const existingWindow = b.project.durationMinutes + b.project.bufferMinutes;
    const newWindow = newDurationMinutes + newBufferMinutes;
    if (timesOverlap(time, newWindow, b.time, existingWindow)) {
      return true;
    }
  }

  return false;
}

type AdminInfo = { id: string; name: string; initials: string };

async function sendNotification(category: "booking_confirmation" | "cancellation_notice" | "reschedule_notice", booking: {
  id: string;
  projectId: string;
  participantName: string;
  participantEmail: string;
  dateKey: string;
  time: string;
  adminId: string;
}, extraCtx?: Record<string, string>) {
  try {
    const [project, admin] = await Promise.all([
      db.project.findUnique({ where: { id: booking.projectId }, select: { name: true, company: true, timezone: true } }),
      db.admin.findUnique({ where: { id: booking.adminId }, select: { name: true } }),
    ]);
    const template = await getActiveTemplate(category, booking.projectId);
    const ctx: Record<string, string> = {
      participant_name: booking.participantName,
      project_name: project?.name ?? "",
      company_name: project?.company ?? "",
      session_date: booking.dateKey,
      session_time: booking.time,
      admin_name: admin?.name ?? "",
      time_zone: project?.timezone ?? "",
      meeting_link: `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/manage/${booking.id}`,
      booking_link: `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/book/${booking.projectId}`,
      company_logo: "",
      ...extraCtx,
    };
    const rendered = renderTemplate(template, ctx);
    await logNotification({
      templateId: template.id,
      category,
      projectId: booking.projectId,
      recipientEmail: booking.participantEmail,
      recipientRole: "participant",
      subject: rendered.subject,
      renderedBody: rendered.bodyHtml,
      status: "sent",
    });
  } catch (err) {
    console.error(`Failed to send ${category} notification:`, err);
  }
}

export async function pickAvailableAdmin(
  projectId: string,
  dateKey: string,
  time: string,
  tx?: Prisma.TransactionClient
): Promise<AdminInfo | null> {
  const client = tx ?? db;

  const project = await client.project.findUnique({
    where: { id: projectId },
    select: {
      durationMinutes: true,
      bufferMinutes: true,
      maxSessionsPerAdminPerDay: true,
    },
  });
  if (!project) return null;

  // Get all active admins assigned to this project
  const projectAdminRows = await client.projectAdmin.findMany({
    where: { projectId, admin: { isActive: true } },
    select: { adminId: true },
  });
  const candidateIds = projectAdminRows.map((pa) => pa.adminId);
  if (candidateIds.length === 0) return null;

  // Certification gate: only associates holding all of the project's required
  // certifications (if any) can serve the slot. Zero requirements = anyone eligible.
  const certifiedIds: string[] = [];
  for (const adminId of candidateIds) {
    if (await isAdminCertifiedForProject(projectId, adminId, client)) {
      certifiedIds.push(adminId);
    }
  }
  if (certifiedIds.length === 0) return null;

  // Check range-based availability for each candidate
  const rangeAvailable: string[] = [];
  for (const adminId of certifiedIds) {
    const available = await isAdminAvailableForSlot(
      adminId,
      dateKey,
      time,
      project.durationMinutes
    );
    if (available) rangeAvailable.push(adminId);
  }
  if (rangeAvailable.length === 0) return null;

  // Check maxSessionsPerAdminPerDay (project-scoped — stays project-specific)
  const bookingsToday = await client.booking.findMany({
    where: {
      projectId,
      dateKey,
      adminId: { in: rangeAvailable },
      status: "confirmed",
    },
    select: { adminId: true },
  });

  const adminDayCounts: Record<string, number> = {};
  const blockedAdmins = new Set<string>();
  for (const b of bookingsToday) {
    adminDayCounts[b.adminId] = (adminDayCounts[b.adminId] ?? 0) + 1;
  }

  for (const [adminId, count] of Object.entries(adminDayCounts)) {
    if (count >= project.maxSessionsPerAdminPerDay) {
      blockedAdmins.add(adminId);
    }
  }

  // Cross-project time-overlap check: skip any admin who has a conflicting
  // booking on this dateKey/time in ANY project.
  for (const adminId of rangeAvailable) {
    if (blockedAdmins.has(adminId)) continue;
    const conflict = await hasSchedulingConflict(adminId, dateKey, time, project.durationMinutes, project.bufferMinutes, undefined, client);
    if (conflict) blockedAdmins.add(adminId);
  }

  let available = rangeAvailable.filter((id) => !blockedAdmins.has(id));
  if (available.length === 0) return null;

  const totalCounts = await client.booking.groupBy({
    by: ["adminId"],
    where: {
      projectId,
      adminId: { in: available },
      status: "confirmed",
    },
    _count: { id: true },
  });

  const countMap: Record<string, number> = {};
  for (const row of totalCounts) {
    countMap[row.adminId] = row._count.id;
  }

  available.sort((a, b) => {
    const ca = countMap[a] ?? 0;
    const cb = countMap[b] ?? 0;
    if (ca !== cb) return ca - cb;
    return a.localeCompare(b);
  });

  const picked = await client.admin.findUnique({
    where: { id: available[0] },
    select: { id: true, name: true, initials: true },
  });

  return picked;
}

type BookingOk = {
  ok: true;
  booking: { id: string; adminId: string; dateKey: string; time: string };
  admin: AdminInfo;
};
type BookingErr = { ok: false; reason: "slot_full" | "no_admin_available" };
type BookingResult = BookingOk | BookingErr;

export async function createBooking(input: {
  projectId: string;
  dateKey: string;
  time: string;
  participantName: string;
  participantEmail: string;
}): Promise<BookingResult> {
  try {
    const result: BookingResult = await db.$transaction(
      async (tx): Promise<BookingResult> => {
        const project = await tx.project.findUnique({
          where: { id: input.projectId },
          select: { sessionCapacity: true },
        });
        if (!project) {
          return { ok: false as const, reason: "slot_full" as const };
        }

        const existingCount = await tx.booking.count({
          where: {
            projectId: input.projectId,
            dateKey: input.dateKey,
            time: input.time,
            status: "confirmed",
          },
        });
        if (existingCount >= project.sessionCapacity) {
          return { ok: false as const, reason: "slot_full" as const };
        }

        const admin = await pickAvailableAdmin(
          input.projectId,
          input.dateKey,
          input.time,
          tx
        );
        if (!admin) {
          return { ok: false as const, reason: "no_admin_available" as const };
        }

        await tx.participant.upsert({
          where: {
            projectId_email: {
              projectId: input.projectId,
              email: input.participantEmail,
            },
          },
          update: { name: input.participantName, status: "booked" },
          create: {
            projectId: input.projectId,
            name: input.participantName,
            email: input.participantEmail,
            status: "booked",
          },
        });

        const booking = await tx.booking.create({
          data: {
            projectId: input.projectId,
            adminId: admin.id,
            participantName: input.participantName,
            participantEmail: input.participantEmail,
            dateKey: input.dateKey,
            time: input.time,
            status: "confirmed",
          },
          select: { id: true, adminId: true, dateKey: true, time: true },
        });

        return { ok: true as const, booking, admin };
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 10000,
      }
    );

    if (result.ok) {
      recordAudit({
        action: "booking_created",
        actorType: "participant",
        actorId: result.booking.adminId,
        actorLabel: input.participantName,
        entityType: "Booking",
        entityId: result.booking.id,
        projectId: input.projectId,
        afterState: {
          dateKey: input.dateKey, time: input.time,
          participantName: input.participantName,
          participantEmail: input.participantEmail,
          adminId: result.booking.adminId,
        },
      }).catch(() => {});

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
      sendNotification("booking_confirmation", {
        id: result.booking.id,
        projectId: input.projectId,
        participantName: input.participantName,
        participantEmail: input.participantEmail,
        dateKey: input.dateKey,
        time: input.time,
        adminId: result.booking.adminId,
      }, {
        manage_booking_link: `${baseUrl}/manage/${result.booking.id}`,
      }).catch(() => {});

      provisionMeeting(input.projectId, result.booking.id).catch((err) => {
        console.error("Failed to provision meeting:", err);
      });
    }

    return result;
  } catch (err: any) {
    // P2002: unique constraint violation on partial index (race on capacity=1 slots)
    // P2034: serialization failure under Serializable isolation (concurrent write conflict)
    // Both outcomes mean the slot was just taken — return slot_full, not a 500.
    if (err?.code === "P2002" || err?.code === "P2034") {
      return { ok: false, reason: "slot_full" };
    }
    throw err;
  }
}

export async function cancelBooking(bookingId: string, actor?: { actorType: string; actorLabel: string }) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, projectId: true, dateKey: true, time: true, participantName: true, participantEmail: true, adminId: true, status: true, teamsMeetingId: true, zoomMeetingId: true },
  });
  if (!booking || booking.status === "cancelled") return null;

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: { status: "cancelled" },
    select: { id: true, projectId: true, dateKey: true, time: true, participantName: true, participantEmail: true, adminId: true },
  });

  recordAudit({
    action: "booking_cancelled",
    actorType: actor?.actorType ?? "admin",
    actorId: booking.adminId,
    actorLabel: actor?.actorLabel ?? "System Admin",
    entityType: "Booking",
    entityId: booking.id,
    projectId: booking.projectId,
    beforeState: { status: "confirmed" },
    afterState: { status: "cancelled" },
  }).catch(() => {});

  offerNextWaitlistEntry(booking.projectId, booking.dateKey, booking.time).catch((err) => {
    console.error("Failed to offer waitlist entry after cancellation:", err);
  });

  if (booking.teamsMeetingId || booking.zoomMeetingId) {
    removeMeeting(booking.projectId, booking.id).catch((err) => {
      console.error("Failed to remove meeting after cancellation:", err);
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  sendNotification("cancellation_notice", {
    id: booking.id,
    projectId: booking.projectId,
    participantName: booking.participantName,
    participantEmail: booking.participantEmail,
    dateKey: booking.dateKey,
    time: booking.time,
    adminId: booking.adminId,
  }, {
    manage_booking_link: `${baseUrl}/manage/${booking.id}`,
  }).catch(() => {});

  return updated;
}

type RescheduleOk = {
  ok: true;
  oldBooking: { id: string; adminId: string; dateKey: string; time: string };
  newBooking: { id: string; adminId: string; dateKey: string; time: string };
};
type RescheduleErr = { ok: false; reason: "not_found" | "already_resolved" | "slot_full" | "no_admin_available" };
type RescheduleResult = RescheduleOk | RescheduleErr;

export async function rescheduleBookingTime(
  bookingId: string,
  newDateKey: string,
  newTime: string,
  options?: { keepSameAdminIfPossible?: boolean; actor?: { actorType: string; actorLabel: string } }
): Promise<RescheduleResult> {
  const original = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, projectId: true, adminId: true, dateKey: true, time: true, participantName: true, participantEmail: true, status: true, teamsMeetingId: true, calendarEventId: true, zoomMeetingId: true, meetingPlatform: true, zoomAccountId: true },
  });
  if (!original) return { ok: false, reason: "not_found" };
  if (original.status !== "confirmed") return { ok: false, reason: "already_resolved" };

  try {
    const result: RescheduleResult = await db.$transaction(async (tx): Promise<RescheduleResult> => {
      const project = await tx.project.findUnique({
        where: { id: original.projectId },
        select: { sessionCapacity: true },
      });
      if (!project) return { ok: false as const, reason: "slot_full" as const };

      const existingCount = await tx.booking.count({
        where: {
          projectId: original.projectId,
          dateKey: newDateKey,
          time: newTime,
          status: "confirmed",
        },
      });
      if (existingCount >= project.sessionCapacity) {
        return { ok: false as const, reason: "slot_full" as const };
      }

      let targetAdminId = original.adminId;
      if (options?.keepSameAdminIfPossible) {
        const sameOk = await isAdminEligibleForSlot(original.projectId, original.adminId, newDateKey, newTime, tx, original.id);
        if (!sameOk) {
          const picked = await pickAvailableAdmin(original.projectId, newDateKey, newTime, tx);
          if (!picked) return { ok: false as const, reason: "no_admin_available" as const };
          targetAdminId = picked.id;
        }
      } else {
        const picked = await pickAvailableAdmin(original.projectId, newDateKey, newTime, tx);
        if (!picked) return { ok: false as const, reason: "no_admin_available" as const };
        targetAdminId = picked.id;
      }

      await tx.booking.update({
        where: { id: original.id },
        data: { status: "rescheduled" },
      });

      const newBooking = await tx.booking.create({
        data: {
          projectId: original.projectId,
          adminId: targetAdminId,
          participantName: original.participantName,
          participantEmail: original.participantEmail,
          dateKey: newDateKey,
          time: newTime,
          status: "confirmed",
          rescheduledFromId: original.id,
          ...(original.calendarEventId
            ? { calendarEventId: original.calendarEventId }
            : {}),
          ...(original.meetingPlatform
            ? {
                meetingPlatform: original.meetingPlatform,
                ...(original.zoomAccountId ? { zoomAccountId: original.zoomAccountId } : {}),
                ...(original.zoomMeetingId ? { zoomMeetingId: original.zoomMeetingId } : {}),
              }
            : {}),
        },
        select: { id: true, adminId: true, dateKey: true, time: true },
      });

      return { ok: true as const, oldBooking: { id: original.id, adminId: original.adminId, dateKey: original.dateKey, time: original.time }, newBooking };
    }, {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 10000,
    });

    if (result.ok) {
      const a = options?.actor ?? { actorType: "admin", actorLabel: "System Admin" };
      recordAudit({
        action: "booking_rescheduled",
        actorType: a.actorType,
        actorId: result.oldBooking.adminId,
        actorLabel: a.actorLabel,
        entityType: "Booking",
        entityId: original.id,
        projectId: original.projectId,
        beforeState: { dateKey: original.dateKey, time: original.time, adminId: original.adminId },
        afterState: { dateKey: newDateKey, time: newTime, adminId: result.newBooking.adminId },
      }).catch(() => {});

      (async () => {
        try {
          const project = await db.project.findUnique({ where: { id: original.projectId }, select: { name: true, company: true } });
          const template = await getActiveTemplate("reschedule_notice", original.projectId);
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
          const ctx = {
            participant_name: original.participantName,
            project_name: project?.name ?? "",
            company_name: project?.company ?? "",
            session_date: newDateKey,
            session_time: newTime,
            admin_name: "",
            time_zone: "",
            meeting_link: "",
            booking_link: `${baseUrl}/book/${original.projectId}`,
            manage_booking_link: `${baseUrl}/manage/${original.id}`,
            company_logo: "",
            old_session_date: original.dateKey,
            old_session_time: original.time,
          };
          const rendered = renderTemplate(template, ctx);
          await logNotification({
            templateId: template.id,
            category: "reschedule_notice",
            projectId: original.projectId,
            recipientEmail: original.participantEmail,
            recipientRole: "participant",
            subject: rendered.subject,
            renderedBody: rendered.bodyHtml,
            status: "sent",
          });
        } catch (err) {
          console.error("Failed to send reschedule notification:", err);
        }
      })();

      offerNextWaitlistEntry(original.projectId, original.dateKey, original.time).catch((err) => {
        console.error("Failed to offer waitlist after reschedule:", err);
      });

      if (original.teamsMeetingId || original.zoomMeetingId) {
        updateMeetingTime(original.projectId, result.newBooking.id, newDateKey, newTime).catch((err) => {
          console.error("Failed to update meeting time after reschedule:", err);
        });
      }
    }

    return result;
  } catch (err: any) {
    if (err?.code === "P2002" || err?.code === "P2034") {
      return { ok: false, reason: "slot_full" };
    }
    throw err;
  }
}

export async function isAdminEligibleForSlot(
  projectId: string,
  adminId: string,
  dateKey: string,
  time: string,
  tx?: Prisma.TransactionClient,
  excludeBookingId?: string,
  skipAvailability?: boolean
): Promise<boolean> {
  const client = tx ?? db;
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { durationMinutes: true, bufferMinutes: true, maxSessionsPerAdminPerDay: true },
  });
  if (!project) return false;

  // Deactivated associates are never eligible for new/reassigned bookings.
  const candidate = await client.admin.findUnique({
    where: { id: adminId },
    select: { isActive: true },
  });
  if (!candidate?.isActive) return false;

  // Certification gate: associate must hold all of the project's required
  // certifications (if any). Zero requirements = eligible.
  if (!(await isAdminCertifiedForProject(projectId, adminId, client))) return false;

  if (!skipAvailability) {
    const available = await isAdminAvailableForSlot(adminId, dateKey, time, project.durationMinutes);
    if (!available) return false;
  }

  // maxSessionsPerAdminPerDay is project-scoped
  const dayBookings = await client.booking.findMany({
    where: { projectId, dateKey, adminId, status: "confirmed" },
    select: { time: true },
  });
  if (dayBookings.length >= project.maxSessionsPerAdminPerDay) return false;

  // Cross-project time-overlap check
  const conflict = await hasSchedulingConflict(adminId, dateKey, time, project.durationMinutes, project.bufferMinutes, excludeBookingId, client);
  if (conflict) return false;

  return true;
}

export async function reassignBookingAdmin(
  bookingId: string,
  newAdminId: string,
  actorAdminId?: string,
  actorLabel?: string,
  skipAvailability?: boolean
): Promise<
  { ok: true; booking: { id: string; adminId: string; dateKey: string; time: string } }
  | { ok: false; reason: "not_found" | "already_resolved" | "admin_not_eligible" }
> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, projectId: true, adminId: true, dateKey: true, time: true, participantName: true, participantEmail: true, status: true },
  });
  if (!booking) return { ok: false, reason: "not_found" };
  if (booking.status !== "confirmed") return { ok: false, reason: "already_resolved" };

  const eligible = await isAdminEligibleForSlot(booking.projectId, newAdminId, booking.dateKey, booking.time, undefined, undefined, skipAvailability);
  if (!eligible) return { ok: false, reason: "admin_not_eligible" };

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: { adminId: newAdminId },
    select: { id: true, adminId: true, dateKey: true, time: true },
  });

  await recordAudit({
    action: "booking_rescheduled",
    actorType: actorAdminId ? "admin" : "system",
    actorId: actorAdminId,
    actorLabel: actorLabel ?? "System Admin",
    entityType: "Booking",
    entityId: booking.id,
    projectId: booking.projectId,
    beforeState: { dateKey: booking.dateKey, time: booking.time, adminId: booking.adminId },
    afterState: { dateKey: booking.dateKey, time: booking.time, adminId: newAdminId },
  });

  return { ok: true, booking: updated };
}
