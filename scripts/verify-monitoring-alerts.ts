// Verification for the monitoring/alerting feature.
//
// Covers: structured log output shape, dedupKey dedup behavior (send once,
// skip repeat within 24h), Project.ownerId resolution (not global owner),
// and listFailedProvisionings query.
//
// Run: npx tsx scripts/verify-monitoring-alerts.ts

import "dotenv/config";
import * as http from "node:http";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { sendIntegrationFailureAlert, hasRecentDedup } from "@/lib/data/monitoring-alerts";
import { listFailedProvisionings, countFailedProvisionings } from "@/lib/data/needs-attention";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
    failures++;
  }
}

// --- Mock Resend email server ---
const sentEmails: { to: string; subject: string }[] = [];
let emailCounter = 0;

function makeResendMock(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET" && req.url === "/__health") {
        res.writeHead(200).end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method === "POST" && (req.url === "/emails" || req.url === "/emails/")) {
        emailCounter++;
        const payload = body ? JSON.parse(body) : {};
        sentEmails.push({ to: payload.to ?? null, subject: payload.subject ?? null });
        res.writeHead(200).end(JSON.stringify({ id: `mock-email-${emailCounter}` }));
        return;
      }
      res.writeHead(404).end(JSON.stringify({ message: "mock-resend: not found" }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function main() {
  const resendMock = await makeResendMock();
  const resendPort = (resendMock.address() as any).port;
  const origResendBaseUrl = process.env.RESEND_BASE_URL;
  const origResendApiKey = process.env.RESEND_API_KEY;
  process.env.RESEND_BASE_URL = `http://127.0.0.1:${resendPort}`;
  process.env.RESEND_API_KEY = "mock-resend-key";

  const ts = Date.now().toString().slice(-8);

  // --- A: Structured log output shape ---
  // --- A: Structured log output shape ---
  console.log("\n[A] Structured log output shape");
  const logs: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args: any[]) => { logs.push(args.join(" ")); };
  console.warn = (...args: any[]) => { logs.push(args.join(" ")); };
  console.error = (...args: any[]) => { logs.push(args.join(" ")); };

  log("info", "test_cat", "test message", { foo: "bar", num: 42 });
  log("warn", "test_cat", "warn message", { baz: true });
  log("error", "test_cat", "error message");

  console.log = origLog;
  console.warn = origWarn;
  console.error = origError;

  check("log emitted 3 lines", logs.length === 3, String(logs.length));

  let parsed0: any;
  try { parsed0 = JSON.parse(logs[0]); } catch { parsed0 = null; }
  check("log line 0 is valid JSON", parsed0 != null);
  check("log line 0 has timestamp", parsed0?.timestamp != null && typeof parsed0.timestamp === "string");
  check("log line 0 level=info", parsed0?.level === "info");
  check("log line 0 category=test_cat", parsed0?.category === "test_cat");
  check("log line 0 message=test message", parsed0?.message === "test message");
  check("log line 0 context foo=bar", parsed0?.foo === "bar");
  check("log line 0 context num=42", parsed0?.num === 42);

  let parsed1: any;
  try { parsed1 = JSON.parse(logs[1]); } catch { parsed1 = null; }
  check("log line 1 level=warn", parsed1?.level === "warn");

  let parsed2: any;
  try { parsed2 = JSON.parse(logs[2]); } catch { parsed2 = null; }
  check("log line 2 level=error", parsed2?.level === "error");

  // --- B: Fixtures ---
  console.log("\n[B] Setup fixtures");
  const owner1 = await db.admin.create({
    data: { name: "Monitor Owner1", initials: "MO1", email: `mon-owner1-${ts}@test.local`, role: "super_admin", accountType: "organizational" },
  });
  const owner2 = await db.admin.create({
    data: { name: "Monitor Owner2", initials: "MO2", email: `mon-owner2-${ts}@test.local`, role: "super_admin", accountType: "organizational" },
  });
  const globalOwner = await db.admin.create({
    data: { name: "Monitor Global", initials: "MG", email: `mon-global-${ts}@test.local`, role: "org_owner", accountType: "organizational" },
  });

  const projectDefaults = {
    company: "MonitorTest",
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
    maxSessionsPerAdminPerDay: 10,
    sessionCapacity: 10,
    status: "active" as const,
    availabilityLockDate: new Date(Date.now() + 90 * 86400000),
    brandingLogoInitial: "M",
    brandingPrimaryColor: "#000000",
    brandingSenderName: "MonitorTest",
  };

  // Project 1 owned by owner1
  const proj1 = await db.project.create({
    data: { ...projectDefaults, slug: `mon-p1-${ts}`, name: "Project1", ownerId: owner1.id },
  });
  // Project 2 owned by owner2
  const proj2 = await db.project.create({
    data: { ...projectDefaults, slug: `mon-p2-${ts}`, name: "Project2", ownerId: owner2.id },
  });

  const d1 = new Date();
  d1.setUTCDate(d1.getUTCDate() + 5);
  const dateKey = d1.toISOString().slice(0, 10);

  const booking1 = await db.booking.create({
    data: { projectId: proj1.id, adminId: owner1.id, participantName: "Mon P1", participantEmail: `mon-p1-${ts}@test.local`, dateKey, time: "10:00", status: "confirmed", meetingPlatform: "teams", teamsProvisionStatus: "failed_personal_account" },
  });
  const booking2 = await db.booking.create({
    data: { projectId: proj2.id, adminId: owner2.id, participantName: "Mon P2", participantEmail: `mon-p2-${ts}@test.local`, dateKey, time: "11:00", status: "confirmed", meetingPlatform: "zoom", zoomProvisionStatus: "failed", zoomErrorDetail: "Zoom auth failed" },
  });
  // Non-failed booking (should not appear)
  const booking3 = await db.booking.create({
    data: { projectId: proj1.id, adminId: owner1.id, participantName: "Mon P3", participantEmail: `mon-p3-${ts}@test.local`, dateKey, time: "12:00", status: "confirmed" },
  });

  // --- C: Project.ownerId resolution ---
  console.log("\n[C] Project.ownerId resolution (not global owner)");
  sentEmails.length = 0;
  await sendIntegrationFailureAlert({
    projectId: proj1.id,
    bookingId: booking1.id,
    failureType: "teams_provision_failed",
    detail: "Teams personal account error",
  });

  check("email sent to project owner (owner1)", sentEmails.some((e) => e.to === owner1.email), JSON.stringify(sentEmails));
  check("email NOT sent to global owner", !sentEmails.some((e) => e.to === globalOwner.email), JSON.stringify(sentEmails));
  check("email NOT sent to owner2", !sentEmails.some((e) => e.to === owner2.email), JSON.stringify(sentEmails));

  // Verify NotificationLog has dedupKey
  const logRow1 = await db.notificationLog.findFirst({
    where: { category: "integration_failure", projectId: proj1.id, recipientEmail: owner1.email },
    orderBy: { createdAt: "desc" },
  });
  check("NotificationLog has dedupKey", logRow1?.dedupKey != null && logRow1.dedupKey.startsWith("integration_failure:"));
  check("NotificationLog status=sent", logRow1?.status === "sent");

  // --- D: Dedup behavior ---
  console.log("\n[D] Dedup behavior (send once, skip repeat within 24h)");
  const emailCountBefore = sentEmails.length;

  // Same dedupKey — should be skipped
  await sendIntegrationFailureAlert({
    projectId: proj1.id,
    bookingId: booking1.id,
    failureType: "teams_provision_failed",
    detail: "Teams personal account error (repeat)",
  });

  check("dedup: no new email sent on repeat", sentEmails.length === emailCountBefore, `before=${emailCountBefore} after=${sentEmails.length}`);

  // Different failure type — should send
  await sendIntegrationFailureAlert({
    projectId: proj1.id,
    bookingId: booking1.id,
    failureType: "email_send_failed",
    detail: "Email send failed",
  });

  check("different failure type: new email sent", sentEmails.length > emailCountBefore, `count=${sentEmails.length}`);

  // Different booking — should send
  await sendIntegrationFailureAlert({
    projectId: proj1.id,
    bookingId: booking2.id,
    failureType: "teams_provision_failed",
    detail: "Teams error on booking2",
  });

  check("different booking: new email sent", sentEmails.length > emailCountBefore + 1, `count=${sentEmails.length}`);

  // Direct dedupKey check
  const dedupKey1 = `integration_failure:${proj1.id}:${booking1.id}:teams_provision_failed`;
  const dedupKey2 = `integration_failure:${proj1.id}:${booking1.id}:nonexistent_type`;
  check("hasRecentDedup true for existing key", await hasRecentDedup(dedupKey1));
  check("hasRecentDedup false for unknown key", !(await hasRecentDedup(dedupKey2)));

  // --- D2: Dedup window boundary tests ---
  console.log("\n[D2] Dedup window boundary (24h)");

  const boundaryDedupKey = `integration_failure:${proj1.id}:${booking3.id}:meeting_delete_failed`;
  const boundaryCategory = "integration_failure" as const;

  // Boundary 1: 23h59m ago → INSIDE window → suppressed
  const t23h59m = new Date(Date.now() - (24 * 60 * 60 * 1000 - 60 * 1000));
  await db.notificationLog.create({
    data: {
      category: boundaryCategory,
      projectId: proj1.id,
      recipientEmail: owner1.email,
      recipientRole: "super_admin",
      subject: "boundary test 23h59m",
      renderedBody: "boundary",
      status: "sent",
      dedupKey: boundaryDedupKey,
      createdAt: t23h59m,
    },
  });
  const emailsBeforeB1 = sentEmails.length;
  await sendIntegrationFailureAlert({
    projectId: proj1.id,
    bookingId: booking3.id,
    failureType: "meeting_delete_failed",
    detail: "boundary 23h59m test",
  });
  check("boundary 23h59m ago: alert SUPPRESSED (inside window)", sentEmails.length === emailsBeforeB1, `before=${emailsBeforeB1} after=${sentEmails.length}`);
  const b1Log = await db.notificationLog.findFirst({
    where: { dedupKey: boundaryDedupKey, createdAt: { gte: t23h59m } },
    orderBy: { createdAt: "desc" },
  });
  check("boundary 23h59m: original row still exists", b1Log != null && b1Log.subject === "boundary test 23h59m");

  // Clean up the fixture row for the next boundary test
  await db.notificationLog.deleteMany({ where: { dedupKey: boundaryDedupKey } });

  // Boundary 2: exactly 24h00m ago → at the exact cutoff.
  // WARNING: This test does NOT verify literal tie-breaking behavior. Because
  // Date.now() advances between fixture creation and the hasRecentDedup check,
  // the fixture's createdAt lands slightly before the computed cutoff → gte
  // evaluates false → alert fires. If the comparison were `gt` (strictly greater
  // than) instead of `gte`, the outcome would be the same. We cannot distinguish
  // `gte` vs `gt` behavior at a literal tie from this test — only that a fixture
  // at the boundary (plus a few ms of clock drift) is correctly treated as expired.
  const t24h00m = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.notificationLog.create({
    data: {
      category: boundaryCategory,
      projectId: proj1.id,
      recipientEmail: owner1.email,
      recipientRole: "super_admin",
      subject: "boundary test 24h00m",
      renderedBody: "boundary",
      status: "sent",
      dedupKey: boundaryDedupKey,
      createdAt: t24h00m,
    },
  });
  const emailsBeforeB2 = sentEmails.length;
  await sendIntegrationFailureAlert({
    projectId: proj1.id,
    bookingId: booking3.id,
    failureType: "meeting_delete_failed",
    detail: "boundary 24h00m test",
  });
  check("boundary exactly 24h00m ago: alert FIRES (clock drift pushes fixture past cutoff)", sentEmails.length > emailsBeforeB2, `before=${emailsBeforeB2} after=${sentEmails.length}`);
  await db.notificationLog.deleteMany({ where: { dedupKey: boundaryDedupKey } });

  // Boundary 3: 24h01m ago → OUTSIDE window → fires
  const t24h01m = new Date(Date.now() - (24 * 60 * 60 * 1000 + 60 * 1000));
  await db.notificationLog.create({
    data: {
      category: boundaryCategory,
      projectId: proj1.id,
      recipientEmail: owner1.email,
      recipientRole: "super_admin",
      subject: "boundary test 24h01m",
      renderedBody: "boundary",
      status: "sent",
      dedupKey: boundaryDedupKey,
      createdAt: t24h01m,
    },
  });
  const emailsBeforeB3 = sentEmails.length;
  await sendIntegrationFailureAlert({
    projectId: proj1.id,
    bookingId: booking3.id,
    failureType: "meeting_delete_failed",
    detail: "boundary 24h01m test",
  });
  check("boundary 24h01m ago: alert FIRES (outside window)", sentEmails.length > emailsBeforeB3, `before=${emailsBeforeB3} after=${sentEmails.length}`);
  await db.notificationLog.deleteMany({ where: { dedupKey: boundaryDedupKey } });

  // --- E: listFailedProvisionings ---
  console.log("\n[E] listFailedProvisionings query");
  const failed1 = await listFailedProvisionings(owner1.id);
  check("owner1 sees their failed provisioning", failed1.some((f) => f.id === booking1.id), JSON.stringify(failed1.map((f) => f.id)));
  check("owner1 does NOT see owner2's failure", !failed1.some((f) => f.id === booking2.id));

  const failed2 = await listFailedProvisionings(owner2.id);
  check("owner2 sees their failed provisioning", failed2.some((f) => f.id === booking2.id));

  const failedAll = await listFailedProvisionings();
  check("no ownerId sees all failures", failedAll.length >= 2);

  check("booking3 (healthy) not in failures", !failedAll.some((f) => f.id === booking3.id));

  // countFailedProvisionings
  const count1 = await countFailedProvisionings(owner1.id);
  check("count matches for owner1", count1 === failed1.length, `count=${count1} listLen=${failed1.length}`);

  // Verify listFailedProvisionings includes expected fields
  const fp = failed1.find((f) => f.id === booking1.id);
  check("listFailedProvisionings has projectName", fp?.projectName === "Project1");
  check("listFailedProvisionings has meetingPlatform", fp?.meetingPlatform === "teams");
  check("listFailedProvisionings has teamsProvisionStatus", fp?.teamsProvisionStatus === "failed_personal_account");

  // --- F: No owner — skip email ---
  console.log("\n[F] No owner on project — skip email");
  const orphanProj = await db.project.create({
    data: { ...projectDefaults, slug: `mon-orphan-${ts}`, name: "Orphan", ownerId: null },
  });
  const emailBefore = sentEmails.length;
  await sendIntegrationFailureAlert({
    projectId: orphanProj.id,
    bookingId: booking1.id,
    failureType: "teams_provision_failed",
    detail: "No owner",
  });
  check("no email sent for orphan project", sentEmails.length === emailBefore, `count=${sentEmails.length}`);

  // --- G: Cleanup ---
  console.log("\n[G] Cleanup");
  await db.notificationLog.deleteMany({ where: { projectId: { in: [proj1.id, proj2.id, orphanProj.id] } } });
  await db.booking.deleteMany({ where: { id: { in: [booking1.id, booking2.id, booking3.id] } } });
  await db.project.deleteMany({ where: { id: { in: [proj1.id, proj2.id, orphanProj.id] } } });
  await db.admin.deleteMany({ where: { id: { in: [owner1.id, owner2.id, globalOwner.id] } } });

  const leftoverAdmins = await db.admin.count({ where: { email: { startsWith: "mon-" } } });
  check("no leftover admins", leftoverAdmins === 0, String(leftoverAdmins));

  resendMock.close();
  if (origResendBaseUrl !== undefined) process.env.RESEND_BASE_URL = origResendBaseUrl; else delete process.env.RESEND_BASE_URL;
  if (origResendApiKey !== undefined) process.env.RESEND_API_KEY = origResendApiKey; else delete process.env.RESEND_API_KEY;
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
