// Verify maxBookingsPerParticipant: null = unlimited, 1 = one per participant,
// display-side filtering for personalized path, and createBooking enforcement.
import "dotenv/config";
import { db } from "@/lib/db";
import { createBooking } from "@/lib/data/bookings";
import { getConsolidatedAvailability } from "@/lib/data/availability";
import { setAdminRangesForDate } from "@/lib/data/availability-ranges";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const TS = Date.now().toString().slice(-8);
  const d1 = "2026-09-21";
  const email = `mbp-test-${TS}@test.local`;

  const admin = await db.admin.create({
    data: { name: "MBP Admin", initials: "MA", email: `mbp-admin-${TS}@phase.test`, role: "admin", accountType: "organizational" },
  });

  const proj = await db.project.create({
    data: {
      slug: `mbp-proj-${TS}`, name: "MBP Project", company: "MBP", description: "", durationMinutes: 60,
      availabilityPeriodDays: 30, dailyStart: "09:00", dailyEnd: "17:00", includeWeekends: false,
      minNoticeHours: 0, timezone: "UTC", bookingDeadlineDays: 0, bufferMinutes: 0,
      maxSessionsPerAdminPerDay: 10, sessionCapacity: 2, status: "active",
      availabilityLockDate: new Date("2026-12-31T00:00:00.000Z"),
      brandingLogoInitial: "MB", brandingPrimaryColor: "#111111", brandingSenderName: "MBP",
      maxBookingsPerParticipant: null,
    },
  });
  await db.projectAdmin.create({ data: { projectId: proj.id, adminId: admin.id } });
  await setAdminRangesForDate(admin.id, d1, [{ startTime: "09:00", endTime: "17:00" }]);

  try {
    console.log("=== Test 1: null limit = unlimited ===");
    const r1 = await createBooking({ projectId: proj.id, dateKey: d1, time: "10:00", participantName: "MBP P1", participantEmail: email });
    check("first booking succeeds (null limit)", r1.ok === true, r1.ok ? `admin=${r1.admin.id}` : r1.reason);

    const r2 = await createBooking({ projectId: proj.id, dateKey: d1, time: "11:00", participantName: "MBP P1", participantEmail: email });
    check("second booking succeeds (null limit)", r2.ok === true, r2.ok ? `admin=${r2.admin.id}` : r2.reason);

    const r3 = await createBooking({ projectId: proj.id, dateKey: d1, time: "13:00", participantName: "MBP P1", participantEmail: email });
    check("third booking succeeds (null limit)", r3.ok === true, r3.ok ? `admin=${r3.admin.id}` : r3.reason);

    console.log("=== Test 2: set limit = 1, same email blocked ===");
    await db.project.update({ where: { id: proj.id }, data: { maxBookingsPerParticipant: 1 } });

    const r4 = await createBooking({ projectId: proj.id, dateKey: d1, time: "14:00", participantName: "MBP P1", participantEmail: email });
    check("fourth booking blocked (limit=1, already has 3)", r4.ok === false && r4.reason === "max_bookings_reached", JSON.stringify(r4));

    const otherEmail = `mbp-other-${TS}@test.local`;
    const r5 = await createBooking({ projectId: proj.id, dateKey: d1, time: "14:00", participantName: "MBP P2", participantEmail: otherEmail });
    check("different email still books (limit is per-participant)", r5.ok === true, r5.ok ? `admin=${r5.admin.id}` : r5.reason);

    console.log("=== Test 3: display-side filtering (personalized path) ===");
    const availAtLimit = await getConsolidatedAvailability(proj.id, { participantEmail: email });
    check("participant at limit sees empty availability", Object.keys(availAtLimit).length === 0, JSON.stringify(availAtLimit));

    const freshEmail = `mbp-fresh-${TS}@test.local`;
    const availOther = await getConsolidatedAvailability(proj.id, { participantEmail: freshEmail });
    check("participant with 0 bookings still sees slots", Object.keys(availOther).length > 0, `${Object.keys(availOther).length} days`);

    const availNoEmail = await getConsolidatedAvailability(proj.id);
    check("no email = unfiltered availability", Object.keys(availNoEmail).length > 0, `${Object.keys(availNoEmail).length} days`);

    console.log("=== Test 4: increase limit = 2, original email still blocked (3 > 2), other email books one more ===");
    await db.project.update({ where: { id: proj.id }, data: { maxBookingsPerParticipant: 2 } });

    const r6 = await createBooking({ projectId: proj.id, dateKey: d1, time: "15:00", participantName: "MBP P1", participantEmail: email });
    check("original email still blocked (3 > 2)", r6.ok === false && r6.reason === "max_bookings_reached", JSON.stringify(r6));

    const r7 = await createBooking({ projectId: proj.id, dateKey: d1, time: "16:00", participantName: "MBP P2", participantEmail: otherEmail });
    check("other email books second session (1 < 2)", r7.ok === true, r7.ok ? `admin=${r7.admin.id}` : r7.reason);

    const r8 = await createBooking({ projectId: proj.id, dateKey: d1, time: "16:00", participantName: "MBP P2", participantEmail: otherEmail });
    check("other email blocked on third (2 = 2)", r8.ok === false && r8.reason === "max_bookings_reached", JSON.stringify(r8));

    const availAfterLimit2 = await getConsolidatedAvailability(proj.id, { participantEmail: email });
    check("participant at limit sees empty availability", Object.keys(availAfterLimit2).length === 0, JSON.stringify(availAfterLimit2));

    console.log("=== Test 5: display filtering with limit = null again ===");
    await db.project.update({ where: { id: proj.id }, data: { maxBookingsPerParticipant: null } });

    const availUnlimited = await getConsolidatedAvailability(proj.id, { participantEmail: email });
    check("unlimited: participant sees slots again", Object.keys(availUnlimited).length > 0, `${Object.keys(availUnlimited).length} days`);

    console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
  } finally {
    await db.booking.deleteMany({ where: { projectId: proj.id } });
    await db.projectAdmin.deleteMany({ where: { projectId: proj.id } });
    await db.project.deleteMany({ where: { id: proj.id } });
    await db.admin.deleteMany({ where: { id: admin.id } });
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
