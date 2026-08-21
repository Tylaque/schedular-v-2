import { db } from "@/lib/db";

export type ReminderScheduleInput = {
  hoursBefore: number;
  label: string;
};

export async function getReminderSchedules(projectId: string) {
  return db.reminderSchedule.findMany({
    where: { projectId, isActive: true },
    orderBy: { hoursBefore: "desc" },
    select: { id: true, hoursBefore: true, label: true, isActive: true },
  });
}

export async function upsertReminderSchedules(
  projectId: string,
  schedules: ReminderScheduleInput[]
) {
  const deduped = new Map<number, ReminderScheduleInput>();
  for (const s of schedules) {
    deduped.set(s.hoursBefore, s);
  }
  const unique = Array.from(deduped.values());

  await db.$transaction(async (tx) => {
    await tx.reminderSchedule.deleteMany({ where: { projectId } });
    if (unique.length > 0) {
      await tx.reminderSchedule.createMany({
        data: unique.map((s) => ({
          projectId,
          hoursBefore: s.hoursBefore,
          label: s.label,
        })),
      });
    }
  });
}
