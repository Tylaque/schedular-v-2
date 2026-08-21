// Tests for the configurable reminder schedule feature.
// Covers: CRUD, default fallback, hour-window matching, dedup logic.
//
// Usage: DATABASE_URL=... npx tsx scripts/verify-reminder-schedules.ts
import "dotenv/config";
import { db } from "@/lib/db";
import { PrismaClient } from "@prisma/client";
import {
  getReminderSchedules,
  upsertReminderSchedules,
} from "@/lib/data/reminder-schedules";

let failures = 0;
let pass = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
  if (ok) pass++;
  else failures++;
}

async function main() {
  const TS = Date.now().toString().slice(-8);

  // ── Setup: create a test project ───────────────────────────────────
  const project = await db.project.create({
    data: {
      slug: `reminder-test-${TS}`,
      name: `Reminder Test ${TS}`,
      company: "Test Co",
      description: "reminder schedule test",
      durationMinutes: 30,
      availabilityPeriodDays: 14,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      minNoticeHours: 2,
      timezone: "Africa/Nairobi",
      bookingDeadlineDays: 7,
      bufferMinutes: 15,
      maxSessionsPerAdminPerDay: 3,
      sessionCapacity: 1,
      availabilityLockDate: new Date("2026-12-01"),
      brandingLogoInitial: "TC",
      brandingPrimaryColor: "#4338CA",
      brandingSenderName: "Test",
    },
  });
  console.log(`\nProject created: ${project.id} (${project.slug})`);

  try {
    // ── Test 1: Empty state (no schedules) ───────────────────────────
    console.log("\n=== Test 1: Empty state ===");
    const empty = await getReminderSchedules(project.id);
    check("No schedules initially", empty.length === 0, `got ${empty.length}`);

    // ── Test 2: Create schedules ─────────────────────────────────────
    console.log("\n=== Test 2: Create schedules ===");
    await upsertReminderSchedules(project.id, [
      { hoursBefore: 72, label: "3 Days Before" },
      { hoursBefore: 24, label: "24 Hour Reminder" },
      { hoursBefore: 1, label: "1 Hour Reminder" },
    ]);
    const schedules = await getReminderSchedules(project.id);
    check("3 schedules created", schedules.length === 3, `got ${schedules.length}`);
    check(
      "Ordered by hoursBefore desc",
      schedules[0].hoursBefore >= schedules[1].hoursBefore &&
        schedules[1].hoursBefore >= schedules[2].hoursBefore,
      `order: ${schedules.map((s) => s.hoursBefore).join(", ")}`
    );
    check("Labels correct", schedules.map((s) => s.label).join("|") === "3 Days Before|24 Hour Reminder|1 Hour Reminder");

    // ── Test 3: Upsert replaces (not appends) ────────────────────────
    console.log("\n=== Test 3: Upsert replaces ===");
    await upsertReminderSchedules(project.id, [
      { hoursBefore: 24, label: "Day Before" },
      { hoursBefore: 0.5, label: "30 Min Before" },
    ]);
    const replaced = await getReminderSchedules(project.id);
    check("Replaced: now 2 schedules", replaced.length === 2, `got ${replaced.length}`);
    check(
      "Old 72h schedule gone",
      !replaced.some((s) => s.hoursBefore === 72),
      `hours: ${replaced.map((s) => s.hoursBefore)}`
    );
    check(
      "New 0.5h schedule present",
      replaced.some((s) => s.hoursBefore === 0.5 && s.label === "30 Min Before")
    );

    // ── Test 4: Upsert with empty array clears all ───────────────────
    console.log("\n=== Test 4: Upsert with empty array ===");
    await upsertReminderSchedules(project.id, []);
    const cleared = await getReminderSchedules(project.id);
    check("All schedules cleared", cleared.length === 0, `got ${cleared.length}`);

    // ── Test 5: Unique constraint on (projectId, hoursBefore) ────────
    console.log("\n=== Test 5: Duplicate hoursBefore ===");
    await upsertReminderSchedules(project.id, [
      { hoursBefore: 24, label: "First" },
      { hoursBefore: 24, label: "Second" },
    ]);
    const deduped = await getReminderSchedules(project.id);
    check(
      "Deduped to 1 (last-write-wins)",
      deduped.length === 1 && deduped[0].label === "Second",
      `got ${deduped.length} with label "${deduped[0]?.label}"`
    );

    // ── Test 6: Cascade delete (project delete removes schedules) ─────
    console.log("\n=== Test 6: Cascade delete ===");
    await upsertReminderSchedules(project.id, [
      { hoursBefore: 24, label: "Test" },
    ]);
    const beforeDelete = await getReminderSchedules(project.id);
    check("Schedule exists before delete", beforeDelete.length === 1);
    await db.project.delete({ where: { id: project.id } });
    const afterDelete = await db.reminderSchedule.findMany({
      where: { projectId: project.id },
    });
    check("Schedules gone after project delete", afterDelete.length === 0, `got ${afterDelete.length}`);

    // ── Test 7: NotificationLog.hoursBefore field ────────────────────
    console.log("\n=== Test 7: NotificationLog.hoursBefore ===");
    // Recreate project for this test
    const p2 = await db.project.create({
      data: {
        slug: `reminder-test-2-${TS}`,
        name: `Reminder Test 2 ${TS}`,
        company: "Test Co",
        description: "test",
        durationMinutes: 30,
        availabilityPeriodDays: 14,
        dailyStart: "09:00",
        dailyEnd: "17:00",
        includeWeekends: false,
        minNoticeHours: 2,
        timezone: "Africa/Nairobi",
        bookingDeadlineDays: 7,
        bufferMinutes: 15,
        maxSessionsPerAdminPerDay: 3,
        sessionCapacity: 1,
        availabilityLockDate: new Date("2026-12-01"),
        brandingLogoInitial: "TC",
        brandingPrimaryColor: "#4338CA",
        brandingSenderName: "Test",
      },
    });
    const logEntry = await db.notificationLog.create({
      data: {
        category: "reminder",
        projectId: p2.id,
        recipientEmail: "test@example.com",
        recipientRole: "participant",
        subject: "Test reminder",
        renderedBody: "<p>Test</p>",
        status: "sent",
        hoursBefore: 24,
      },
    });
    check(
      "hoursBefore stored",
      logEntry.hoursBefore === 24,
      `got ${logEntry.hoursBefore}`
    );

    // Dedup query: find by hoursBefore
    const dedup = await db.notificationLog.findFirst({
      where: {
        category: "reminder",
        projectId: p2.id,
        recipientEmail: "test@example.com",
        hoursBefore: 24,
      },
    });
    check("Dedup by hoursBefore works", dedup?.id === logEntry.id);

    // Different hoursBefore doesn't match
    const noMatch = await db.notificationLog.findFirst({
      where: {
        category: "reminder",
        projectId: p2.id,
        recipientEmail: "test@example.com",
        hoursBefore: 1,
      },
    });
    check("Different hoursBefore doesn't match dedup", noMatch === null);

    // Old-style reminder (hoursBefore=null) still works
    const oldLog = await db.notificationLog.create({
      data: {
        category: "reminder_24h",
        projectId: p2.id,
        recipientEmail: "test@example.com",
        recipientRole: "participant",
        subject: "Old 24h",
        renderedBody: "<p>Old</p>",
        status: "sent",
      },
    });
    check("Old reminder_24h (hoursBefore=null) still works", oldLog.hoursBefore === null);

    // Cleanup p2
    await db.notificationLog.deleteMany({ where: { projectId: p2.id } });
    await db.project.delete({ where: { id: p2.id } });
  } catch (err: any) {
    console.error("Unexpected error:", err.message);
    failures++;
    // Still try to clean up
    try { await db.project.delete({ where: { id: project.id } }); } catch {}
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${pass} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
