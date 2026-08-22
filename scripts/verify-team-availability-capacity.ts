import "dotenv/config";
import { db } from "@/lib/db";
import { setAdminRangesForDate, getTeamAvailabilityWithCapacity } from "@/lib/data/availability-ranges";

const TS = Date.now().toString(36);

function check(label: string, ok: boolean, detail?: string) {
  const status = ok ? "PASS" : "FAIL";
  const suffix = detail ? " -> " + detail : "";
  console.log("  " + status + "  " + label + suffix);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("=== CAPACITY TOGGLE VERIFICATION ===\n");

  const owner = await db.admin.create({
    data: { name: "Cap Owner", initials: "CO", email: "cap-owner-" + TS + "@phase.test", role: "org_owner", accountType: "organizational" },
  });

  const admin = await db.admin.create({
    data: { name: "Cap Admin", initials: "CA", email: "cap-admin-" + TS + "@phase.test", role: "admin", accountType: "organizational" },
  });

  const proj = await db.project.create({
    data: {
      slug: "cap-test-" + TS,
      name: "Capacity Test",
      company: "Cap Co",
      description: "Fixture for capacity toggle",
      durationMinutes: 30,
      availabilityPeriodDays: 30,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      minNoticeHours: 1,
      timezone: "Africa/Nairobi",
      bookingDeadlineDays: 7,
      bufferMinutes: 15,
      maxSessionsPerAdminPerDay: 5,
      sessionCapacity: 1,
      autoCompleteBookings: false,
      status: "active",
      availabilityLockDate: new Date(Date.now() + 30 * 86400000),
      brandingLogoInitial: "CT",
      brandingPrimaryColor: "#6366f1",
      brandingSenderName: "Cap Test",
      ownerId: owner.id,
      meetingPlatformPreference: "auto",
      assignmentMode: "AUTO",
    },
  });

  await db.projectAdmin.create({
    data: { adminId: admin.id, projectId: proj.id },
  });

  const targetDate = "2026-08-26";

  await setAdminRangesForDate(admin.id, targetDate, [
    { startTime: "09:00", endTime: "12:00" },
    { startTime: "13:00", endTime: "17:00" },
  ]);

  const bk = await db.booking.create({
    data: {
      projectId: proj.id,
      adminId: admin.id,
      dateKey: targetDate,
      time: "09:15",
      status: "confirmed",
      participantName: "Conflict Booker",
      participantEmail: "cap-booker-" + TS + "@test.local",
    },
  });

  console.log("Fixture: project=" + proj.id + " admin=" + admin.id + " date=" + targetDate + " booking=" + bk.id + " at 09:15\n");

  // ── Call getTeamAvailabilityWithCapacity ──
  const result = await getTeamAvailabilityWithCapacity(owner.id, {
    fromDate: targetDate,
    toDate: targetDate,
  });

  check("C1: result has 1 admin entry", result.length === 1, "count=" + result.length);
  if (result.length === 0) { console.log("\nABORT: no result entries"); return; }

  const entry = result[0];
  check("C2: entry matches admin", entry.adminId === admin.id);
  check("C3: entry has capacity array", Array.isArray(entry.capacity), "length=" + (entry.capacity ? entry.capacity.length : 0));

  if (!entry.capacity) { console.log("\nABORT: no capacity data"); return; }

  // Morning range: 09:00-12:00 → 6 slots (09:00, 09:30, 10:00, 10:30, 11:00, 11:30)
  const morning = entry.capacity.find((c) => c.startTime === "09:00");
  check("C4: morning range exists", !!morning);
  if (morning) {
    check("C5: morning totalSlots=6", morning.capacity.totalSlots === 6, "got=" + morning.capacity.totalSlots);
    check("C6: morning bookedSlots=2", morning.capacity.bookedSlots === 2, "got=" + morning.capacity.bookedSlots);
    check("C7: morning bookableSlots=4", morning.capacity.bookableSlots === 4, "got=" + morning.capacity.bookableSlots);
    check("C8: morning first bookable is 10:00", morning.bookableTimes[0] === "10:00", "got=" + morning.bookableTimes[0]);
    check("C9: morning bookable times = [10:00,10:30,11:00,11:30]",
      JSON.stringify(morning.bookableTimes) === JSON.stringify(["10:00", "10:30", "11:00", "11:30"]),
      "got=" + JSON.stringify(morning.bookableTimes));
  }

  // Afternoon range: 13:00-17:00 → 8 slots (13:00,13:30,14:00,14:30,15:00,15:30,16:00,16:30)
  const afternoon = entry.capacity.find((c) => c.startTime === "13:00");
  check("C10: afternoon range exists", !!afternoon);
  if (afternoon) {
    check("C11: afternoon totalSlots=8", afternoon.capacity.totalSlots === 8, "got=" + afternoon.capacity.totalSlots);
    check("C12: afternoon bookedSlots=0", afternoon.capacity.bookedSlots === 0, "got=" + afternoon.capacity.bookedSlots);
    check("C13: afternoon bookableSlots=8", afternoon.capacity.bookableSlots === 8, "got=" + afternoon.capacity.bookableSlots);
    check("C14: afternoon all slots open", afternoon.capacity.bookableSlots === afternoon.capacity.totalSlots);
  }

  // ── Cleanup ──
  await db.booking.delete({ where: { id: bk.id } });
  await db.projectAdmin.deleteMany({ where: { adminId: admin.id, projectId: proj.id } });
  await db.adminAvailabilityRange.deleteMany({ where: { adminId: admin.id, dateKey: targetDate } });
  await db.project.delete({ where: { id: proj.id } });
  await db.admin.delete({ where: { id: admin.id } });
  await db.admin.delete({ where: { id: owner.id } });

  console.log("\n=== ALL CAPACITY TESTS PASSED ===");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => { console.error(e); db.$disconnect(); process.exit(1); });
