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
  const rows = await db.adminAvailability.findMany({
    where: { projectId },
    select: { dateKey: true, time: true },
    distinct: ["dateKey", "time"],
  });

  const map: Record<string, string[]> = {};
  for (const row of rows) {
    if (!map[row.dateKey]) map[row.dateKey] = [];
    map[row.dateKey].push(row.time);
  }
  return map;
}
