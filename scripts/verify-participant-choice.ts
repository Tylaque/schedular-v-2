import "dotenv/config";
import { db } from "@/lib/db";
import {
  createBooking,
  getEligibleAdmins,
  validateAdminChoice,
  getSlotAdminMap,
} from "@/lib/data/bookings";
import { setAdminCertifications, createCertification } from "@/lib/data/certifications";
import { setProjectCertificationRequirements } from "@/lib/data/certifications";
import { setAdminRangesForDate } from "@/lib/data/availability-ranges";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
  if (!ok) failures++;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const TS = Date.now().toString().slice(-8);
  const dk = "2026-10-01";
  const dk2 = "2026-10-02";

  // ── Setup ──────────────────────────────────────────────
  const owner = await db.admin.create({
    data: { name: "PC Owner", initials: "PO", email: `pc-owner-${TS}@phase.test`, role: "org_owner", accountType: "organizational" },
  });

  const adminA = await db.admin.create({
    data: { name: "PC Admin A", initials: "PA", email: `pc-a-${TS}@phase.test`, role: "admin", accountType: "organizational" },
  });
  const adminB = await db.admin.create({
    data: { name: "PC Admin B", initials: "PB", email: `pc-b-${TS}@phase.test`, role: "admin", accountType: "organizational" },
  });
  const adminC = await db.admin.create({
    data: { name: "PC Admin C (external)", initials: "PC", email: `pc-c-${TS}@phase.test`, role: "admin", accountType: "organizational" },
  });

  // Project in PARTICIPANT_CHOICE mode
  const proj = await db.project.create({
    data: {
      slug: `pc-test-${TS}`,
      name: "Participant Choice Test",
      company: "PC Co",
      description: "testing participant choice",
      durationMinutes: 60,
      availabilityPeriodDays: 30,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      minNoticeHours: 2,
      timezone: "America/New_York",
      bookingDeadlineDays: 7,
      bufferMinutes: 0,
      maxSessionsPerAdminPerDay: 2,
      sessionCapacity: 1,
      autoCompleteBookings: false,
      selfServiceWindowHours: 4,
      status: "active",
      availabilityLockDate: new Date(Date.now() + 90 * 86400000),
      brandingLogoInitial: "P",
      brandingPrimaryColor: "#111827",
      brandingSenderName: "PC Test",
      ownerId: owner.id,
      meetingPlatformPreference: "teams",
      assignmentMode: "PARTICIPANT_CHOICE",
    },
  });

  // Assign adminA and adminB to project (NOT adminC)
  await db.projectAdmin.create({ data: { projectId: proj.id, adminId: adminA.id } });
  await db.projectAdmin.create({ data: { projectId: proj.id, adminId: adminB.id } });

  // Set availability for adminA and adminB
  await setAdminRangesForDate(adminA.id, dk, [{ startTime: "09:00", endTime: "17:00" }]);
  await setAdminRangesForDate(adminB.id, dk, [{ startTime: "09:00", endTime: "17:00" }]);
  await setAdminRangesForDate(adminA.id, dk2, [{ startTime: "09:00", endTime: "17:00" }]);
  await setAdminRangesForDate(adminB.id, dk2, [{ startTime: "09:00", endTime: "17:00" }]);

  console.log("=== PARTICIPANT_CHOICE: eligibility + booking + rejection ===\n");

  // ── T1: getEligibleAdmins returns both assigned admins ──
  const eligible = await getEligibleAdmins(proj.id, dk, "10:00");
  check("T1: getEligibleAdmins returns both assigned admins", eligible.length === 2, `count=${eligible.length} ids=${eligible.join(",")}`);
  check("T1a: adminA is eligible", eligible.includes(adminA.id));
  check("T1b: adminB is eligible", eligible.includes(adminB.id));

  // ── T2: adminC (not assigned) is NOT eligible ──
  check("T2: adminC (not on project) is NOT eligible", !eligible.includes(adminC.id));

  // ── T3: validateAdminChoice for valid admin ──
  const validA = await validateAdminChoice(proj.id, adminA.id, dk, "10:00");
  check("T3: validateAdminChoice(adminA) = true", validA === true);

  // ── T4: validateAdminChoice for invalid admin ──
  const invalidC = await validateAdminChoice(proj.id, adminC.id, dk, "10:00");
  check("T4: validateAdminChoice(adminC) = false", invalidC === false);

  // ── T5: Valid participant choice booking succeeds ──
  const bk1 = await createBooking({
    projectId: proj.id,
    dateKey: dk,
    time: "10:00",
    participantName: "PC T5 Person",
    participantEmail: `pc-t5-${TS}@test.local`,
    adminId: adminA.id,
  });
  check("T5: valid admin choice booking succeeds", bk1.ok === true, bk1.ok ? `adminId=${bk1.admin.id}` : bk1.reason);
  if (bk1.ok) check("T5a: persisted adminId matches choice", bk1.booking.adminId === adminA.id, bk1.booking.adminId);

  // ── T6: Pick admin not assigned to project → admin_not_eligible ──
  const bk2 = await createBooking({
    projectId: proj.id,
    dateKey: dk,
    time: "11:00",
    participantName: "PC T6 Person",
    participantEmail: `pc-t6-${TS}@test.local`,
    adminId: adminC.id,
  });
  check("T6: unassigned adminC rejected → admin_not_eligible", bk2.ok === false && bk2.reason === "admin_not_eligible", bk2.ok ? "unexpected ok" : bk2.reason);

  // ── T7: Certification gate — create cert requirement, reject uncertified ──
  const cert1 = await createCertification({ name: `PC Cert ${TS}`, description: "test cert" });
  await setProjectCertificationRequirements({
    projectId: proj.id,
    certificationIds: [cert1.id],
    actor: { actorId: owner.id, actorLabel: "test" },
  });
  // adminA is NOT certified → should be rejected
  const bk3 = await createBooking({
    projectId: proj.id,
    dateKey: dk,
    time: "12:00",
    participantName: "PC T7 Person",
    participantEmail: `pc-t7-${TS}@test.local`,
    adminId: adminA.id,
  });
  check("T7: uncertified adminA rejected → admin_not_eligible", bk3.ok === false && bk3.reason === "admin_not_eligible", bk3.ok ? "unexpected ok" : bk3.reason);

  // Certify adminB only → adminB should now be eligible
  await setAdminCertifications({
    adminId: adminB.id,
    certificationIds: [cert1.id],
    actor: { actorId: owner.id, actorLabel: "test" },
  });
  const bk4 = await createBooking({
    projectId: proj.id,
    dateKey: dk,
    time: "12:00",
    participantName: "PC T7b Person",
    participantEmail: `pc-t7b-${TS}@test.local`,
    adminId: adminB.id,
  });
  check("T7b: certified adminB accepted", bk4.ok === true, bk4.ok ? `adminId=${bk4.admin.id}` : bk4.reason);

  // ── T8: Daily cap race — adminB has maxSessionsPerAdminPerDay=2, already has 1 ──
  // Book adminB again on same date to hit cap
  const bk5 = await createBooking({
    projectId: proj.id,
    dateKey: dk,
    time: "14:00",
    participantName: "PC T8 Person",
    participantEmail: `pc-t8-${TS}@test.local`,
    adminId: adminB.id,
  });
  check("T8a: second booking for adminB succeeds (cap=2)", bk5.ok === true, bk5.ok ? `adminId=${bk5.admin.id}` : bk5.reason);

  // adminB is now at daily cap — third attempt should fail
  const bk6 = await createBooking({
    projectId: proj.id,
    dateKey: dk,
    time: "15:00",
    participantName: "PC T8c Person",
    participantEmail: `pc-t8c-${TS}@test.local`,
    adminId: adminB.id,
  });
  check("T8b: adminB at daily cap rejected → admin_not_eligible", bk6.ok === false && bk6.reason === "admin_not_eligible", bk6.ok ? "unexpected ok" : bk6.reason);

  // ── T9: Cross-project conflict — adminA has booking at 14:00 on another project ──
  // Use dk2 to avoid the daily cap issue; create a conflicting booking on adminA's slot
  const proj2 = await db.project.create({
    data: {
      slug: `pc-test2-${TS}`,
      name: "PC Conflict Project",
      company: "PC Co 2",
      description: "conflict test",
      durationMinutes: 60,
      availabilityPeriodDays: 30,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      minNoticeHours: 2,
      timezone: "America/New_York",
      bookingDeadlineDays: 7,
      bufferMinutes: 0,
      maxSessionsPerAdminPerDay: 10,
      sessionCapacity: 1,
      autoCompleteBookings: false,
      selfServiceWindowHours: 4,
      status: "active",
      availabilityLockDate: new Date(Date.now() + 90 * 86400000),
      brandingLogoInitial: "X",
      brandingPrimaryColor: "#111827",
      brandingSenderName: "X",
      ownerId: owner.id,
      meetingPlatformPreference: "teams",
      assignmentMode: "AUTO",
    },
  });
  await db.projectAdmin.create({ data: { projectId: proj2.id, adminId: adminA.id } });
  await setAdminRangesForDate(adminA.id, dk2, [{ startTime: "09:00", endTime: "17:00" }]);

  // Book adminA on proj2 at 10:00 dk2
  const conflictBk = await createBooking({
    projectId: proj2.id,
    dateKey: dk2,
    time: "10:00",
    participantName: "PC T9 conflict",
    participantEmail: `pc-t9-${TS}@test.local`,
  });
  check("T9 setup: conflict booking created", conflictBk.ok === true);

  // Now try to book adminA on proj at dk2 10:00 — same time → conflict
  const bk7 = await createBooking({
    projectId: proj.id,
    dateKey: dk2,
    time: "10:00",
    participantName: "PC T9 Person",
    participantEmail: `pc-t9b-${TS}@test.local`,
    adminId: adminA.id,
  });
  check("T9: adminA with cross-project conflict rejected → admin_not_eligible", bk7.ok === false && bk7.reason === "admin_not_eligible", bk7.ok ? "unexpected ok" : bk7.reason);

  // ── T10: getSlotAdminMap returns per-slot admin lists ──
  // Use a fresh date (dk2) where no bookings exist yet; certify both admins
  await setAdminCertifications({
    adminId: adminA.id,
    certificationIds: [cert1.id],
    actor: { actorId: owner.id, actorLabel: "test" },
  });
  const avail: Record<string, string[]> = { [dk2]: ["09:00", "10:00"] };
  const adminMap = await getSlotAdminMap(proj.id, avail);
  check("T10: getSlotAdminMap returns data for dk2", dk2 in adminMap);
  check("T10a: adminMap[dk2][09:00] is array", Array.isArray(adminMap[dk2]?.["09:00"]), `length=${adminMap[dk2]?.["09:00"]?.length ?? 0}`);
  check("T10b: adminMap includes both eligible admins", (adminMap[dk2]?.["09:00"]?.length ?? 0) >= 2, `names=${adminMap[dk2]?.["09:00"]?.map((a) => a.name).join(",") ?? ""}`);

  // ── T11: Tampered adminId (UUID that doesn't exist) → admin_not_eligible ──
  const bk8 = await createBooking({
    projectId: proj.id,
    dateKey: dk,
    time: "16:00",
    participantName: "PC T11 Person",
    participantEmail: `pc-t11-${TS}@test.local`,
    adminId: "cltnonexistent0000000",
  });
  check("T11: tampered/nonexistent adminId rejected → admin_not_eligible", bk8.ok === false && bk8.reason === "admin_not_eligible", bk8.ok ? "unexpected ok" : bk8.reason);

  // ── T12: Concurrent submissions choosing the SAME admin for the SAME slot ──
  // Use adminB (certified) on dk2 at 12:00 (fresh slot, no prior bookings there)
  console.log("\n=== T12: Concurrency — 5 concurrent bookings for same admin, same slot ===");
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, j) =>
      createBooking({
        projectId: proj.id,
        dateKey: dk2,
        time: "12:00",
        participantName: `PC T12-${j}`,
        participantEmail: `pc-t12-${j}-${TS}@test.local`,
        adminId: adminB.id,
      }).then(
        (r) => (r.ok ? { ok: true as const } : { ok: false as const, reason: r.reason }),
        (e: any) => ({ ok: false as const, reason: `throw:${e?.code ?? e?.name ?? "?"}` })
      )
    )
  );
  const t12ok = results.filter((r) => r.ok).length;
  const t12full = results.filter((r) => !r.ok && r.reason === "slot_full").length;
  const t12inelig = results.filter((r) => !r.ok && r.reason === "admin_not_eligible").length;
  const t12threw = results.filter((r) => !r.ok && String(r.reason).startsWith("throw:")).length;
  console.log(`  results: ok=${t12ok} slot_full=${t12full} admin_not_eligible=${t12inelig} threw=${t12threw}`);
  check("T12: exactly 1 booking won", t12ok === 1, `ok=${t12ok}`);
  check("T12a: remaining 4 rejected (slot_full or admin_not_eligible)", t12full + t12inelig === 4, `slot_full=${t12full} admin_not_eligible=${t12inelig}`);
  check("T12b: zero throws", t12threw === 0, `threw=${t12threw}`);

  // DB sanity: exactly 1 confirmed booking at dk2/12:00
  const t12dbCount = await db.booking.count({
    where: { projectId: proj.id, dateKey: dk2, time: "12:00", status: "confirmed" },
  });
  check("T12c: DB holds exactly 1 confirmed booking", t12dbCount === 1, `count=${t12dbCount}`);

  // Verify the winning booking has adminB
  const t12winner = await db.booking.findFirst({
    where: { projectId: proj.id, dateKey: dk2, time: "12:00", status: "confirmed" },
    select: { adminId: true, participantEmail: true },
  });
  check("T12d: winner has adminB as adminId", t12winner?.adminId === adminB.id, `winner=${t12winner?.participantEmail ?? "?"}`);

  // ── T13: AUTO mode ignores passed adminId (regression guard) ──
  const projAuto = await db.project.create({
    data: {
      slug: `pc-auto-${TS}`,
      name: "Auto Mode Test",
      company: "Auto Co",
      description: "auto mode",
      durationMinutes: 60,
      availabilityPeriodDays: 30,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      minNoticeHours: 2,
      timezone: "America/New_York",
      bookingDeadlineDays: 7,
      bufferMinutes: 0,
      maxSessionsPerAdminPerDay: 10,
      sessionCapacity: 1,
      autoCompleteBookings: false,
      selfServiceWindowHours: 4,
      status: "active",
      availabilityLockDate: new Date(Date.now() + 90 * 86400000),
      brandingLogoInitial: "A",
      brandingPrimaryColor: "#111827",
      brandingSenderName: "Auto",
      ownerId: owner.id,
      meetingPlatformPreference: "teams",
      assignmentMode: "AUTO",
    },
  });
  await db.projectAdmin.create({ data: { projectId: projAuto.id, adminId: adminA.id } });
  await db.projectAdmin.create({ data: { projectId: projAuto.id, adminId: adminB.id } });
  await setAdminRangesForDate(adminA.id, dk2, [{ startTime: "09:00", endTime: "17:00" }]);
  await setAdminRangesForDate(adminB.id, dk2, [{ startTime: "09:00", endTime: "17:00" }]);

  const bkAuto = await createBooking({
    projectId: projAuto.id,
    dateKey: dk2,
    time: "14:00",
    participantName: "T13 Auto Person",
    participantEmail: `pc-t13-${TS}@test.local`,
    adminId: adminC.id, // adminC is NOT on this project — AUTO should ignore this
  });
  check("T13: AUTO mode ignores passed adminId and auto-assigns", bkAuto.ok === true, bkAuto.ok ? `adminId=${bkAuto.admin.id}` : bkAuto.reason);
  if (bkAuto.ok) check("T13a: assigned admin is NOT adminC (was ignored)", bkAuto.admin.id !== adminC.id, `got=${bkAuto.admin.id}`);

  // ── Summary ──
  console.log(`\n${failures === 0 ? "ALL PARTICIPANT_CHOICE TESTS PASSED" : `${failures} TEST(S) FAILED`}`);

  // ── Cleanup ──
  // Delete test bookings, projects, admins, cert
  await db.booking.deleteMany({ where: { projectId: { in: [proj.id, proj2.id, projAuto.id] } } });
  await db.projectAdmin.deleteMany({ where: { projectId: { in: [proj.id, proj2.id, projAuto.id] } } });
  await db.projectCertificationRequirement.deleteMany({ where: { projectId: proj.id } });
  await db.adminCertification.deleteMany({ where: { adminId: { in: [adminA.id, adminB.id] } } });
  await db.certification.delete({ where: { id: cert1.id } }).catch(() => {});
  await db.project.deleteMany({ where: { id: { in: [proj.id, proj2.id, projAuto.id] } } });
  await db.admin.deleteMany({ where: { id: { in: [adminA.id, adminB.id, adminC.id, owner.id] } } });

  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[participant-choice] FAILED:", e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
