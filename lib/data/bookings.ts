import { db } from "@/lib/db";
import { recordAudit } from "@/lib/data/audit";
import { offerNextWaitlistEntry } from "@/lib/data/waitlist";
import { getActiveTemplate, renderTemplate } from "@/lib/data/templates";
import { logNotification } from "@/lib/data/notifications";
import { createMeetingEvent, deleteMeetingEvent, updateMeetingEventTime } from "@/lib/graph/client";
import type { Prisma } from "@prisma/client";

function parseMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(
  startA: string,
  endA: number,
  startB: string,
  endB: number
): boolean {
  const a = parseMinutes(startA);
  const b = parseMinutes(startB);
  return a < b + endB && b < a + endA;
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

  const eligible = await client.adminAvailability.findMany({
    where: { projectId, dateKey, time },
    select: { adminId: true },
  });
  if (eligible.length === 0) return null;

  // All admins are eligible regardless of accountType (Teams meetings are
  // always hosted by the owning super_admin/org_owner, never by the
  // assigned admin-tier admin).
  const candidateIds = eligible.map((e) => e.adminId);
  if (candidateIds.length === 0) return null;

  const bookingsToday = await client.booking.findMany({
    where: {
      projectId,
      dateKey,
      adminId: { in: candidateIds },
      status: "confirmed",
    },
    select: { adminId: true, time: true },
  });

  const adminDayCounts: Record<string, number> = {};
  const blockedAdmins = new Set<string>();
  for (const b of bookingsToday) {
    adminDayCounts[b.adminId] = (adminDayCounts[b.adminId] ?? 0) + 1;

    if (
      timesOverlap(
        time,
        project.durationMinutes + project.bufferMinutes,
        b.time,
        project.durationMinutes + project.bufferMinutes
      )
    ) {
      blockedAdmins.add(b.adminId);
    }
  }

  for (const [adminId, count] of Object.entries(adminDayCounts)) {
    if (count >= project.maxSessionsPerAdminPerDay) {
      blockedAdmins.add(adminId);
    }
  }

  let available = candidateIds.filter((id) => !blockedAdmins.has(id));
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

async function provisionTeamsMeeting(projectId: string, bookingId: string) {
  const [project, booking] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { ownerId: true } }),
    db.booking.findUnique({ where: { id: bookingId }, select: { id: true, projectId: true, participantName: true, participantEmail: true, dateKey: true, time: true } }),
  ]);
  if (!project?.ownerId || !booking) return;

  const result = await createMeetingEvent(project.ownerId, {
    id: booking.id,
    projectId: booking.projectId,
    participantName: booking.participantName,
    participantEmail: booking.participantEmail,
    dateKey: booking.dateKey,
    time: booking.time,
  });

  if ("error" in result) {
    const statusMap = {
      personal: "failed_personal_account" as const,
      insufficient_permissions: "failed_insufficient_permissions" as const,
      unknown: "failed_unknown" as const,
    };
    await db.booking.update({
      where: { id: bookingId },
      data: {
        teamsProvisionStatus: statusMap[result.error],
        teamsErrorDetail: result.detail ?? result.error,
      },
    });
  } else {
    await db.booking.update({
      where: { id: bookingId },
      data: {
        teamsMeetingId: result.teamsMeetingId,
        calendarEventId: result.calendarEventId,
        teamsJoinUrl: result.joinUrl,
        teamsProvisionStatus: "provisioned",
      },
    });
  }
}

async function removeTeamsMeeting(bookingId: string, ownerId: string, teamsMeetingId: string) {
  const result = await deleteMeetingEvent(ownerId, teamsMeetingId);
  if ("error" in result) {
    console.error("Failed to delete Teams meeting for booking", bookingId, result.error);
  }
}

async function updateTeamsMeetingTime(bookingId: string, ownerId: string, dateKey: string, time: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, projectId: true, participantName: true, participantEmail: true } });
  if (!booking) return;

  const result = await updateMeetingEventTime(ownerId, {
    id: booking.id,
    projectId: booking.projectId,
    participantName: booking.participantName,
    participantEmail: booking.participantEmail,
    dateKey,
    time,
  });
  if ("error" in result) {
    console.error("Failed to update Teams meeting time for booking", bookingId, result.error);
  }
}

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

      provisionTeamsMeeting(input.projectId, result.booking.id).catch((err) => {
        console.error("Failed to provision Teams meeting:", err);
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
    select: { id: true, projectId: true, dateKey: true, time: true, participantName: true, participantEmail: true, adminId: true, status: true, teamsMeetingId: true },
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

  if (booking.teamsMeetingId) {
    db.project.findUnique({ where: { id: booking.projectId }, select: { ownerId: true } }).then((project) => {
      if (project?.ownerId) {
        removeTeamsMeeting(booking.id, project.ownerId, booking.teamsMeetingId!).catch(() => {});
      }
    }).catch(() => {});
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
    select: { id: true, projectId: true, adminId: true, dateKey: true, time: true, participantName: true, participantEmail: true, status: true, teamsMeetingId: true },
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
        const sameOk = await isAdminEligibleForSlot(original.projectId, original.adminId, newDateKey, newTime, tx);
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

      if (original.teamsMeetingId) {
        db.project.findUnique({ where: { id: original.projectId }, select: { ownerId: true } }).then((project) => {
          if (project?.ownerId) {
            updateTeamsMeetingTime(result.newBooking.id, project.ownerId, newDateKey, newTime).catch(() => {});
          }
        }).catch(() => {});
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
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx ?? db;
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { durationMinutes: true, bufferMinutes: true, maxSessionsPerAdminPerDay: true },
  });
  if (!project) return false;

  const avail = await client.adminAvailability.findUnique({
    where: { projectId_adminId_dateKey_time: { projectId, adminId, dateKey, time } },
  });
  if (!avail) return false;

  const dayBookings = await client.booking.findMany({
    where: { projectId, dateKey, adminId, status: "confirmed" },
    select: { time: true },
  });
  if (dayBookings.length >= project.maxSessionsPerAdminPerDay) return false;

  for (const b of dayBookings) {
    if (timesOverlap(time, project.durationMinutes + project.bufferMinutes, b.time, project.durationMinutes + project.bufferMinutes)) {
      return false;
    }
  }
  return true;
}

export async function reassignBookingAdmin(
  bookingId: string,
  newAdminId: string
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

  const eligible = await isAdminEligibleForSlot(booking.projectId, newAdminId, booking.dateKey, booking.time);
  if (!eligible) return { ok: false, reason: "admin_not_eligible" };

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: { adminId: newAdminId },
    select: { id: true, adminId: true, dateKey: true, time: true },
  });

  recordAudit({
    action: "booking_rescheduled",
    actorType: "admin",
    actorId: booking.adminId,
    actorLabel: "System Admin",
    entityType: "Booking",
    entityId: booking.id,
    projectId: booking.projectId,
    beforeState: { dateKey: booking.dateKey, time: booking.time, adminId: booking.adminId },
    afterState: { dateKey: booking.dateKey, time: booking.time, adminId: newAdminId },
  }).catch(() => {});

  return { ok: true, booking: updated };
}
