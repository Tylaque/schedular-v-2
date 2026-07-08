import { db } from "@/lib/db";

export async function getAdminAvailability(
  projectId: string,
  adminId: string
): Promise<{ dateKey: string; time: string }[]> {
  const rows = await db.adminAvailability.findMany({
    where: { projectId, adminId },
    select: { dateKey: true, time: true },
  });
  return rows;
}

export async function setAdminAvailabilityBulk(
  projectId: string,
  adminId: string,
  entries: { dateKey: string; time: string; selected: boolean }[]
): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const entry of entries) {
      if (entry.selected) {
        await tx.adminAvailability.upsert({
          where: {
            projectId_adminId_dateKey_time: {
              projectId,
              adminId,
              dateKey: entry.dateKey,
              time: entry.time,
            },
          },
          create: {
            projectId,
            adminId,
            dateKey: entry.dateKey,
            time: entry.time,
          },
          update: {},
        });
      } else {
        await tx.adminAvailability.deleteMany({
          where: {
            projectId,
            adminId,
            dateKey: entry.dateKey,
            time: entry.time,
          },
        });
      }
    }
  });
}

export async function getConsolidatedAvailability(
  projectId: string
): Promise<Record<string, string[]>> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { sessionCapacity: true },
  });
  if (!project) return {};

  const rows = await db.adminAvailability.findMany({
    where: { projectId },
    select: { dateKey: true, time: true },
    distinct: ["dateKey", "time"],
  });

  const bookingCounts = await db.booking.groupBy({
    by: ["dateKey", "time"],
    where: { projectId, status: "confirmed" },
    _count: { id: true },
  });

  const fullMap: Record<string, number> = {};
  for (const bc of bookingCounts) {
    fullMap[`${bc.dateKey}|${bc.time}`] = bc._count.id;
  }

  const map: Record<string, string[]> = {};
  for (const row of rows) {
    const key = `${row.dateKey}|${row.time}`;
    const count = fullMap[key] ?? 0;
    if (count >= project.sessionCapacity) continue;
    if (!map[row.dateKey]) map[row.dateKey] = [];
    map[row.dateKey].push(row.time);
  }
  return map;
}
