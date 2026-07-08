import { db } from "@/lib/db";
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

  const candidateIds = eligible.map((e) => e.adminId);

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
