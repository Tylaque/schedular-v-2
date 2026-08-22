import "dotenv/config";
import { db } from "@/lib/db";
import {
  createSessionType,
  updateSessionType,
  softDeleteSessionType,
  reactivateSessionType,
  listSessionTypes,
  listAllSessionTypes,
  ensureSeedSessionTypes,
  resolveSessionTypeName,
} from "@/lib/data/session-types";
import { setAdminRangesForDate } from "@/lib/data/availability-ranges";
import { createBooking } from "@/lib/data/bookings";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
  if (!ok) failures++;
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

async function main() {
  const TS = Date.now().toString().slice(-8);

  // ════════════════════════════════════════════════════════════
  // T1: Seed function idempotency
  // ════════════════════════════════════════════════════════════
  await ensureSeedSessionTypes();
  const seeded = await listSessionTypes();
  check("T1a: seed created 3 starting types", seeded.length === 3, `count=${seeded.length}`);
  const names = seeded.map((s) => s.name).sort();
  check("T1b: seed names are Interview/Feedback/Coaching", names.join(",") === "Coaching,Feedback,Interview", names.join(","));

  // Second call is idempotent
  await ensureSeedSessionTypes();
  const seeded2 = await listSessionTypes();
  check("T1c: second seed call idempotent", seeded2.length === 3, `count=${seeded2.length}`);

  // ════════════════════════════════════════════════════════════
  // T2: CRUD — create, list, update, soft-delete
  // ════════════════════════════════════════════════════════════
  const custom = await createSessionType({ name: `Custom Type ${TS}`, description: "test desc" });
  check("T2a: created custom type", !!custom.id && custom.name === `Custom Type ${TS}`, `id=${custom.id}`);
  check("T2b: custom type isActive", custom.isActive === true);

  const listAfterCreate = await listSessionTypes();
  check("T2c: list includes custom type", listAfterCreate.some((s) => s.id === custom.id), `count=${listAfterCreate.length}`);

  const updated = await updateSessionType(custom.id, { name: `Updated Type ${TS}` });
  check("T2d: updated type name", updated?.name === `Updated Type ${TS}`, `name=${updated?.name}`);

  // Soft-delete
  const deleted = await softDeleteSessionType(custom.id, { actorId: "test", actorLabel: "Test" });
  check("T2e: soft-delete returned true", deleted === true);

  const afterDelete = await listSessionTypes();
  check("T2f: soft-deleted type excluded from listSessionTypes", !afterDelete.some((s) => s.id === custom.id));

  const allAfterDelete = await listAllSessionTypes();
  check("T2g: soft-deleted type still in listAllSessionTypes", allAfterDelete.some((s) => s.id === custom.id && !s.isActive));

  // ════════════════════════════════════════════════════════════
  // T3: Project default assignment + safety test
  // ════════════════════════════════════════════════════════════
  const owner = await db.admin.create({
    data: { name: "ST Owner", initials: "SO", email: `st-owner-${TS}@phase.test`, role: "org_owner", accountType: "organizational" },
  });

  const interviewType = seeded.find((s) => s.name === "Interview")!;

  const proj = await db.project.create({
    data: {
      slug: `st-proj-${TS}`,
      name: "Session Type Test Project",
      company: "ST Co",
      description: "testing session types",
      durationMinutes: 60,
      availabilityPeriodDays: 30,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      minNoticeHours: 1,
      timezone: "Africa/Nairobi",
      bookingDeadlineDays: 7,
      bufferMinutes: 0,
      maxSessionsPerAdminPerDay: 5,
      sessionCapacity: 1,
      autoCompleteBookings: false,
      status: "active",
      availabilityLockDate: new Date(Date.now() + 30 * 86400000),
      brandingLogoInitial: "ST",
      brandingPrimaryColor: "#111827",
      brandingSenderName: "ST Test",
      ownerId: owner.id,
      meetingPlatformPreference: "auto",
      assignmentMode: "AUTO",
      defaultSessionTypeId: interviewType.id,
    },
  });
  check("T3a: project created with default session type", proj.defaultSessionTypeId === interviewType.id, `defaultSessionTypeId=${proj.defaultSessionTypeId}`);

  // SAFETY: update without providing defaultSessionTypeId should NOT clear it
  const projUpdate = await db.project.update({
    where: { id: proj.id },
    data: { name: "Updated Project Name" },
    select: { defaultSessionTypeId: true },
  });
  check("T3b: safety — update without defaultSessionTypeId preserves existing value", projUpdate.defaultSessionTypeId === interviewType.id, `got=${projUpdate.defaultSessionTypeId}`);

  // Explicitly set to null
  const projClear = await db.project.update({
    where: { id: proj.id },
    data: { defaultSessionTypeId: null },
    select: { defaultSessionTypeId: true },
  });
  check("T3c: explicit null clears defaultSessionTypeId", projClear.defaultSessionTypeId === null);

  // Set back for booking tests
  await db.project.update({
    where: { id: proj.id },
    data: { defaultSessionTypeId: interviewType.id },
  });

  // ════════════════════════════════════════════════════════════
  // T4: Booking with explicit session type override
  // ════════════════════════════════════════════════════════════
  const admin = await db.admin.create({
    data: { name: "ST Admin", initials: "SA", email: `st-admin-${TS}@phase.test`, role: "admin", accountType: "organizational" },
  });
  await db.projectAdmin.create({ data: { projectId: proj.id, adminId: admin.id } });

  const fromDate = todayKey();
  // Find first weekday at least 2 days out
  let dayX = "";
  for (let n = 2; n <= 14; n++) {
    const [y, m, d] = fromDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    const dow = dt.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      dayX = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
      break;
    }
  }
  if (!dayX) throw new Error("Could not find a weekday 2+ days out");

  await setAdminRangesForDate(admin.id, dayX, [
    { startTime: "09:00", endTime: "17:00" },
  ]);

  const feedbackType = seeded.find((s) => s.name === "Feedback")!;

  // Booking with explicit Feedback type
  const bkExplicit = await createBooking({
    projectId: proj.id,
    dateKey: dayX,
    time: "10:00",
    participantName: "Explicit Type Tester",
    participantEmail: `st-explicit-${TS}@test.local`,
    sessionTypeId: feedbackType.id,
  });
  if (!bkExplicit.ok) console.log("DEBUG T4a reason:", bkExplicit.reason);
  check("T4a: booking with explicit type succeeded", bkExplicit.ok === true);
  if (bkExplicit.ok) {
    const bookingRow = await db.booking.findUnique({
      where: { id: bkExplicit.booking.id },
      select: { sessionTypeId: true, sessionTypeName: true },
    });
    check("T4b: booking sessionTypeId matches Feedback", bookingRow?.sessionTypeId === feedbackType.id, `got=${bookingRow?.sessionTypeId}`);
    check("T4c: booking sessionTypeName snapshot is Feedback", bookingRow?.sessionTypeName === "Feedback", `got=${bookingRow?.sessionTypeName}`);
  }

  // ════════════════════════════════════════════════════════════
  // T5: Booking without override (inherits project default)
  // ════════════════════════════════════════════════════════════
  const bkNoType = await createBooking({
    projectId: proj.id,
    dateKey: dayX,
    time: "11:00",
    participantName: "No Type Tester",
    participantEmail: `st-notype-${TS}@test.local`,
  });
  check("T5a: booking without type override succeeded", bkNoType.ok === true);
  if (bkNoType.ok) {
    const bookingRow = await db.booking.findUnique({
      where: { id: bkNoType.booking.id },
      select: { sessionTypeId: true, sessionTypeName: true },
    });
    check("T5b: booking sessionTypeId is null (no explicit type)", bookingRow?.sessionTypeId === null);
    check("T5c: booking sessionTypeName inherits project default name", bookingRow?.sessionTypeName === "Interview", `got=${bookingRow?.sessionTypeName}`);
  }

  // ════════════════════════════════════════════════════════════
  // T6: Soft-deleted type safety — bookings retain snapshot
  // ════════════════════════════════════════════════════════════
  const bkToSoftDelete = seeded.find((s) => s.name === "Coaching")!;
  // Create a booking with Coaching type
  const bkCoaching = await createBooking({
    projectId: proj.id,
    dateKey: dayX,
    time: "13:00",
    participantName: "Coaching Tester",
    participantEmail: `st-coaching-${TS}@test.local`,
    sessionTypeId: bkToSoftDelete.id,
  });
  check("T6a: booking with Coaching type succeeded", bkCoaching.ok === true);

  // Soft-delete the Coaching type
  await softDeleteSessionType(bkToSoftDelete.id, { actorId: "test", actorLabel: "Test" });

  // Verify the historical booking still has its snapshot
  if (bkCoaching.ok) {
    const historical = await db.booking.findUnique({
      where: { id: bkCoaching.booking.id },
      select: { sessionTypeId: true, sessionTypeName: true },
    });
    check("T6b: soft-deleted type — historical booking retains sessionTypeName snapshot", historical?.sessionTypeName === "Coaching", `got=${historical?.sessionTypeName}`);
    check("T6c: soft-deleted type — historical booking sessionTypeId still references record", historical?.sessionTypeId === bkToSoftDelete.id, `got=${historical?.sessionTypeId}`);
  }

  // Resolve function: snapshot takes priority over deleted type
  if (bkCoaching.ok) {
    const bookingRow = await db.booking.findUnique({
      where: { id: bkCoaching.booking.id },
      include: { sessionType: true, project: { include: { defaultSessionType: true } } },
    });
    if (bookingRow) {
      const resolved = resolveSessionTypeName(bookingRow as any);
      check("T6d: resolveSessionTypeName uses snapshot for historical booking", resolved === "Coaching", `got=${resolved}`);
    }
  }

  // ════════════════════════════════════════════════════════════
  // T7: Booking with invalid/deactivated sessionTypeId
  // ════════════════════════════════════════════════════════════
  const bkBadType = await createBooking({
    projectId: proj.id,
    dateKey: dayX,
    time: "14:00",
    participantName: "Bad Type Tester",
    participantEmail: `st-badtype-${TS}@test.local`,
    sessionTypeId: bkToSoftDelete.id, // deactivated Coaching
  });
  check("T7a: booking with deactivated type succeeded (graceful fallback)", bkBadType.ok === true);
  if (bkBadType.ok) {
    const bookingRow = await db.booking.findUnique({
      where: { id: bkBadType.booking.id },
      select: { sessionTypeId: true, sessionTypeName: true },
    });
    check("T7b: booking with deactivated type has null sessionTypeId", bookingRow?.sessionTypeId === null);
    check("T7c: booking with deactivated type inherits project default name", bookingRow?.sessionTypeName === "Interview", `got=${bookingRow?.sessionTypeName}`);
  }

  // ════════════════════════════════════════════════════════════
  // T8: Non-existent sessionTypeId
  // ════════════════════════════════════════════════════════════
  const bkFakeId = await createBooking({
    projectId: proj.id,
    dateKey: dayX,
    time: "15:00",
    participantName: "Fake ID Tester",
    participantEmail: `st-fakeid-${TS}@test.local`,
    sessionTypeId: "nonexistent_id_12345",
  });
  check("T8a: booking with non-existent type succeeded (graceful)", bkFakeId.ok === true);
  if (bkFakeId.ok) {
    const bookingRow = await db.booking.findUnique({
      where: { id: bkFakeId.booking.id },
      select: { sessionTypeId: true, sessionTypeName: true },
    });
    check("T8b: booking with non-existent type has null sessionTypeId", bookingRow?.sessionTypeId === null);
    check("T8c: booking with non-existent type inherits project default name", bookingRow?.sessionTypeName === "Interview", `got=${bookingRow?.sessionTypeName}`);
  }

  // ════════════════════════════════════════════════════════════
  // T9: Reactivate a soft-deleted session type
  // ════════════════════════════════════════════════════════════
  const reactivateResult = await reactivateSessionType(bkToSoftDelete.id, { actorId: owner.id, actorLabel: "Test Owner" });
  check("T9a: reactivate returns true", reactivateResult === true);
  const afterReactivate = await listSessionTypes();
  check("T9b: reactivated type reappears in listSessionTypes", afterReactivate.some((s) => s.id === bkToSoftDelete.id));
  const reactivateAuditCount = await db.auditLog.count({
    where: { entityType: "SessionType", entityId: bkToSoftDelete.id },
  });
  check("T9c: audit log has entries for both soft-delete and reactivate", reactivateAuditCount >= 2, `count=${reactivateAuditCount}`);
  // Reactivate on already-active should return false
  const reactivateAgain = await reactivateSessionType(bkToSoftDelete.id);
  check("T9d: reactivate on already-active returns false", reactivateAgain === false);

  // ════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════
  console.log(`\n${failures === 0 ? "ALL SESSION TYPE TESTS PASSED" : `${failures} TEST(S) FAILED`}`);

  // ── Cleanup ──
  await db.booking.deleteMany({ where: { projectId: proj.id } });
  await db.projectAdmin.deleteMany({ where: { projectId: proj.id } });
  await db.project.delete({ where: { id: proj.id } }).catch(() => {});
  await db.admin.delete({ where: { id: admin.id } }).catch(() => {});
  await db.admin.delete({ where: { id: owner.id } }).catch(() => {});
  // Delete custom test type
  await db.sessionType.delete({ where: { id: custom.id } }).catch(() => {});
  // Restore Coaching if it was soft-deleted (for other tests)
  await db.sessionType.update({
    where: { id: bkToSoftDelete.id },
    data: { isActive: true },
  }).catch(() => {});

  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[session-types] FAILED:", e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
