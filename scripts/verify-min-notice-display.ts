import "dotenv/config";
import { db } from "@/lib/db";
import { getConsolidatedAvailability } from "@/lib/data/availability";
import { hoursUntilSession } from "@/lib/slotHelpers";

function check(label: string, ok: boolean, detail?: string) {
  console.log(ok ? `PASS  ${label}${detail ? "  -> " + detail : ""}` : `FAIL  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}
let failures = 0;

async function main() {
  const TS = Date.now().toString().slice(-8);

  // ── Setup ──
  const owner = await db.admin.create({
    data: { name: "MN Owner", initials: "MO", email: `mn-owner-${TS}@phase.test`, role: "org_owner", accountType: "organizational" },
  });

  const adminA = await db.admin.create({
    data: { name: "MN Admin A", initials: "MA", email: `mn-a-${TS}@phase.test`, role: "admin", accountType: "organizational", isActive: true },
  });

  // Admin availability: all day on today and a date guaranteed outside the notice window
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // Use a date 5 days from now — guaranteed outside any reasonable notice window
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 5);
  const futureStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;

  const project = await db.project.create({
    data: {
      slug: `mn-proj-${TS}`,
      name: "MinNotice Test",
      company: "MN Co",
      description: "test",
      durationMinutes: 60,
      availabilityPeriodDays: 30,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      timezone: "Africa/Nairobi",
      sessionCapacity: 5,
      maxSessionsPerAdminPerDay: 10,
      bufferMinutes: 0,
      minNoticeHours: 24,
      bookingDeadlineDays: 30,
      availabilityLockDate: new Date(),
      brandingLogoInitial: "MN",
      brandingPrimaryColor: "#4F46E5",
      brandingSenderName: "MN Test",
      ownerId: owner.id,
    },
  });

  await db.projectAdmin.create({ data: { projectId: project.id, adminId: adminA.id } });

  // Add availability for today and future date
  await db.adminAvailabilityRange.createMany({
    data: [
      { adminId: adminA.id, dateKey: todayStr, startTime: "09:00", endTime: "17:00" },
      { adminId: adminA.id, dateKey: futureStr, startTime: "09:00", endTime: "17:00" },
    ],
  });

  // ── Run getConsolidatedAvailability ──
  const avail = await getConsolidatedAvailability(project.id);
  const todaySlots = avail[todayStr] ?? [];
  const futureSlots = avail[futureStr] ?? [];

  console.log(`\n=== minNoticeHours display test (notice=24h, timezone=Africa/Nairobi) ===`);
  console.log(`today=${todayStr}, future=${futureStr}`);

  // Check: hoursUntilSession for the earliest slot today
  if (todaySlots.length > 0) {
    const earliestToday = todaySlots[0];
    const hoursUntil = hoursUntilSession(todayStr, earliestToday, "Africa/Nairobi");
    console.log(`  earliest today slot: ${earliestToday}, hoursUntilSession=${hoursUntil.toFixed(2)}h`);
  } else {
    console.log(`  today: zero slots (all within 24h notice window)`);
  }

  // Check: hoursUntilSession for the earliest slot on future date
  if (futureSlots.length > 0) {
    const earliestFuture = futureSlots[0];
    const hoursUntil = hoursUntilSession(futureStr, earliestFuture, "Africa/Nairobi");
    console.log(`  earliest future slot: ${earliestFuture}, hoursUntilSession=${hoursUntil.toFixed(2)}h`);
  }

  // ASSERTION 1: today should have NO slots (all are within 24h notice window)
  check("T1: today has zero available slots (all within 24h notice)", todaySlots.length === 0, `count=${todaySlots.length}`);

  // ASSERTION 2: future date should have slots (outside 24h notice)
  check("T2: future date has available slots (outside 24h notice)", futureSlots.length > 0, `count=${futureSlots.length}, slots=${futureSlots.join(",")}`);

  // ASSERTION 3: every today slot (if any) is outside the notice window
  if (todaySlots.length > 0) {
    for (const slot of todaySlots) {
      const h = hoursUntilSession(todayStr, slot, "Africa/Nairobi");
      check(`T3: today slot ${slot} is outside notice window`, h >= 24, `hoursUntil=${h.toFixed(2)}`);
    }
  } else {
    check("T3: today has zero slots (notice filter working)", true, "skipped — no slots to check");
  }

  // ASSERTION 4: every future slot is outside the notice window
  for (const slot of futureSlots) {
    const h = hoursUntilSession(futureStr, slot, "Africa/Nairobi");
    check(`T4: future slot ${slot} is outside notice window`, h >= 24, `hoursUntil=${h.toFixed(2)}`);
  }

  // ── Cleanup ──
  await db.projectAdmin.deleteMany({ where: { projectId: project.id } });
  await db.adminAvailabilityRange.deleteMany({ where: { adminId: adminA.id } });
  await db.project.delete({ where: { id: project.id } });
  await db.admin.deleteMany({ where: { id: { in: [adminA.id, owner.id] } } });

  console.log(failures === 0 ? "\nALL MIN NOTICE TESTS PASSED" : `\n${failures} TESTS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
