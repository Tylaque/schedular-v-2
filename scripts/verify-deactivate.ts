import "dotenv/config";
import { db } from "@/lib/db";
import { deactivateAdmin, reactivateAdmin } from "@/lib/data/team";
import { listAllAdmins } from "@/lib/data/admins";
import { getAzureSignInGate } from "@/lib/data/auth-invite";
import { isAdminEligibleForSlot } from "@/lib/data/bookings";

function dkOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
    failures++;
  }
}

async function main() {
  const ts = Date.now().toString().slice(-8);
  const cleanupIds: string[] = [];

  // Self-clean leftovers from any previously crashed run before starting.
  await db.admin.deleteMany({ where: { email: { startsWith: "verify-" } } });

  const actor = await db.admin.create({
    data: { name: "Verify Actor", initials: "VA", email: `verify-actor-${ts}@test.local`, role: "org_owner", accountType: "organizational" },
  });
  const remaining = await db.admin.create({
    data: { name: "Verify Remaining", initials: "VR", email: `verify-rem-${ts}@test.local`, role: "admin", accountType: "organizational" },
  });
  const target = await db.admin.create({
    data: { name: "Verify Target", initials: "VT", email: `verify-tgt-${ts}@test.local`, role: "admin", accountType: "organizational" },
  });
  const superActor = await db.admin.create({
    data: { name: "Verify Super", initials: "VS", email: `verify-sup-${ts}@test.local`, role: "super_admin", accountType: "organizational" },
  });
  cleanupIds.push(actor.id, remaining.id, target.id, superActor.id);

  const futureDate = dkOffset(5);
  const pastDate = dkOffset(-3);
  const flaggedDate = dkOffset(7);

  const projectDefaults = {
    company: "VerifyCo",
    description: "",
    durationMinutes: 60,
    availabilityPeriodDays: 30,
    dailyStart: "09:00",
    dailyEnd: "17:00",
    includeWeekends: true,
    minNoticeHours: 0,
    timezone: "UTC",
    bookingDeadlineDays: 0,
    bufferMinutes: 0,
    maxSessionsPerAdminPerDay: 4,
    sessionCapacity: 1,
    status: "active" as const,
    availabilityLockDate: new Date(Date.now() + 90 * 86400000),
    brandingLogoInitial: "V",
    brandingPrimaryColor: "#000000",
    brandingSenderName: "VerifyCo",
  };

  const p1 = await db.project.create({ data: { ...projectDefaults, slug: `verify-p1-${ts}`, name: "Verify P1" } });
  const p2 = await db.project.create({ data: { ...projectDefaults, slug: `verify-p2-${ts}`, name: "Verify P2" } });
  cleanupIds.push(p1.id, p2.id);

  await db.projectAdmin.create({ data: { projectId: p1.id, adminId: target.id } });
  await db.projectAdmin.create({ data: { projectId: p1.id, adminId: remaining.id } });
  await db.projectAdmin.create({ data: { projectId: p2.id, adminId: target.id } });

  await db.adminAvailabilityRange.create({
    data: { adminId: remaining.id, dateKey: futureDate, startTime: "08:00", endTime: "18:00" },
  });

  const reassignedBooking = await db.booking.create({
    data: { projectId: p1.id, adminId: target.id, participantName: "Verify P", participantEmail: "v@test.local", dateKey: futureDate, time: "10:00", status: "confirmed" },
  });
  const historyBooking = await db.booking.create({
    data: { projectId: p1.id, adminId: target.id, participantName: "Verify H", participantEmail: "h@test.local", dateKey: pastDate, time: "11:00", status: "confirmed" },
  });
  const flaggedBooking = await db.booking.create({
    data: { projectId: p2.id, adminId: target.id, participantName: "Verify F", participantEmail: "f@test.local", dateKey: flaggedDate, time: "09:00", status: "confirmed" },
  });
  cleanupIds.push(reassignedBooking.id, historyBooking.id, flaggedBooking.id);

  console.log("\n[1] Deactivate admin with future + past bookings across 2 projects");
  const res = await deactivateAdmin(actor.id, target.id);
  check("deactivate returned ok", res.ok === true, JSON.stringify(res));
  if (res.ok) {
    check(
      "future booking reassigned to remaining eligible admin",
      res.offboarding.reassigned.some((r) => r.bookingId === reassignedBooking.id && r.newAdminId === remaining.id),
      JSON.stringify(res.offboarding)
    );
    check("sole-assignment project booking flagged", res.offboarding.flagged.some((f) => f.bookingId === flaggedBooking.id), JSON.stringify(res.offboarding));
    check("projectsRemoved lists both projects", res.projectsRemoved.length === 2 && res.projectsRemoved.includes(p1.id) && res.projectsRemoved.includes(p2.id), JSON.stringify(res.projectsRemoved));
  }

  const tAfter = await db.admin.findUnique({ where: { id: target.id }, select: { isActive: true, deactivatedAt: true, deactivatedBy: true } });
  check("target isActive=false", tAfter?.isActive === false);
  check("target deactivatedAt set", tAfter?.deactivatedAt != null);
  check("target deactivatedBy = actor", tAfter?.deactivatedBy === actor.id);

  const paCount = await db.projectAdmin.count({ where: { adminId: target.id } });
  check("target has 0 project assignments", paCount === 0, String(paCount));

  const rb = await db.booking.findUnique({ where: { id: reassignedBooking.id } });
  check("future booking now on remaining admin", rb?.adminId === remaining.id, rb?.adminId ?? "");
  const hb = await db.booking.findUnique({ where: { id: historyBooking.id } });
  check("history booking untouched (target, confirmed, un-flagged)", hb?.adminId === target.id && hb?.status === "confirmed" && hb?.needsManualAttention === false, JSON.stringify(hb));
  const fb = await db.booking.findUnique({ where: { id: flaggedBooking.id } });
  check("sole-assignment booking flagged needsManualAttention", fb?.needsManualAttention === true, JSON.stringify(fb));

  const audit = await db.auditLog.findFirst({ where: { action: "admin_deactivated", entityId: target.id } });
  check("admin_deactivated audit written", audit != null);

  const allActive = await listAllAdmins();
  check("listAllAdmins excludes target", !allActive.some((a) => a.id === target.id));

  const gate = await getAzureSignInGate(target.email);
  check("sign-in gate reports deactivated", gate.invited === true && gate.deactivated === true, JSON.stringify(gate));

  const eligible = await isAdminEligibleForSlot(p1.id, target.id, futureDate, "10:00");
  check("inactive admin not eligible for slots", eligible === false);

  console.log("\n[2] Guards");
  const self = await deactivateAdmin(actor.id, actor.id);
  check("self-deactivation blocked", self.ok === false && !self.ok && self.reason === "cannot_deactivate_self", JSON.stringify(self));
  const realOwner = await db.admin.findFirst({
    where: { role: "org_owner", email: { not: { startsWith: "verify-" } } },
    select: { id: true },
  });
  if (realOwner) {
    const sole = await deactivateAdmin(superActor.id, realOwner.id);
    check("any org_owner deactivation blocked", sole.ok === false && !sole.ok && sole.reason === "cannot_deactivate_sole_org_owner", JSON.stringify(sole));
  } else {
    console.log("  SKIP  org_owner deactivation block (no pre-existing org_owner found)");
  }
  const notAuth = await deactivateAdmin(remaining.id, superActor.id);
  check("plain admin cannot deactivate", notAuth.ok === false && !notAuth.ok && notAuth.reason === "not_authorized", JSON.stringify(notAuth));

  console.log("\n[3] Reactivate");
  const react = await reactivateAdmin(actor.id, target.id);
  check("reactivate returned ok", react.ok === true, JSON.stringify(react));
  const tRe = await db.admin.findUnique({ where: { id: target.id }, select: { isActive: true, deactivatedAt: true, deactivatedBy: true } });
  check("target isActive=true after reactivate", tRe?.isActive === true);
  check("target deactivated fields cleared", tRe?.deactivatedAt === null && tRe?.deactivatedBy === null);
  const paAfter = await db.projectAdmin.count({ where: { adminId: target.id } });
  check("assignments NOT restored on reactivate", paAfter === 0, String(paAfter));
  const reAudit = await db.auditLog.findFirst({ where: { action: "admin_reactivated", entityId: target.id } });
  check("admin_reactivated audit written", reAudit != null);
  const gate2 = await getAzureSignInGate(target.email);
  check("sign-in gate active again", gate2.deactivated === false, JSON.stringify(gate2));

  console.log("\n[4] Cleanup");
  await db.auditLog.deleteMany({
    where: { OR: [{ entityId: { in: cleanupIds } }, { actorId: { in: [actor.id, superActor.id] } }, { projectId: { in: [p1.id, p2.id] } }] },
  });
  await db.projectAdmin.deleteMany({ where: { projectId: { in: [p1.id, p2.id] } } });
  await db.adminAvailabilityRange.deleteMany({ where: { adminId: remaining.id } });
  await db.booking.deleteMany({ where: { projectId: { in: [p1.id, p2.id] } } });
  await db.project.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
  await db.admin.deleteMany({ where: { email: { startsWith: "verify-" } } });

  const leftover = await db.admin.count({ where: { email: { startsWith: "verify-" } } });
  check("no leftover verify admins", leftover === 0, String(leftover));

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
