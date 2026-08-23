// Verification for the Zoom account-pool feature.
//
// Real local DB evidence with a MOCK Zoom HTTP API (no real credentials).
// Covers: automatic account selection, pool-fill → Teams fallback, Zoom-only
// no-fallback, Teams-only skip, Zoom API failure fallback, and the concurrent
// claim race (two bookings racing for the last account). Fully self-cleaning.
//
// Run: npx tsx scripts/verify-zoom.ts

import "dotenv/config";
import * as http from "node:http";
import { db } from "@/lib/db";
import { provisionMeeting } from "@/lib/data/meetings";
import { setZoomAccountActive } from "@/lib/data/zoom";
import { createZoomAccount } from "@/lib/data/zoom";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
    failures++;
  }
}

let meetingCounter = 1000;
const calls: string[] = [];
let failUser: string | null = null;

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

function makeServer(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST" && path === "/oauth/token") {
        calls.push("token");
        res.writeHead(200).end(JSON.stringify({ access_token: "mock-access-token", expires_in: 3600 }));
        return;
      }
      if (req.method === "GET" && path === "/v2/users") {
        calls.push("users");
        res.writeHead(200).end(
          JSON.stringify({
            users: [
              { id: "zu-1", email: "zoom1@example.test", first_name: "Zoom", last_name: "One" },
              { id: "zu-2", email: "zoom2@example.test", first_name: "Zoom", last_name: "Two" },
            ],
          })
        );
        return;
      }
      const meetingMatch = path.match(/^\/v2\/users\/([^/]+)\/meetings$/);
      if (req.method === "POST" && meetingMatch) {
        calls.push(`create:${meetingMatch[1]}`);
        if (failUser === meetingMatch[1]) {
          res.writeHead(500).end(JSON.stringify({ message: "mock Zoom failure" }));
          return;
        }
        meetingCounter += 1;
        const id = meetingCounter;
        res.writeHead(201).end(JSON.stringify({ id, topic: "Booking", join_url: `https://zoom.us/j/${id}` }));
        return;
      }
      const meetingRes = path.match(/^\/v2\/meetings\/([^/]+)$/);
      if (meetingRes && (req.method === "DELETE" || req.method === "PATCH")) {
        calls.push(`${req.method.toLowerCase()}:${meetingRes[1]}`);
        res.writeHead(204).end();
        return;
      }
      res.writeHead(404).end(JSON.stringify({ message: "not found" }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function dkOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const server = await makeServer();
  const port = (server.address() as any).port;
  process.env.ZOOM_API_BASE = `http://127.0.0.1:${port}`;
  process.env.ZOOM_ACCOUNT_ID = "mock-account-id";
  process.env.ZOOM_CLIENT_ID = "mock-client-id";
  process.env.ZOOM_CLIENT_SECRET = "mock-client-secret";

  const resendMock = await makeResendMock();
  const resendPort = (resendMock.address() as any).port;
  const origResendBaseUrl = process.env.RESEND_BASE_URL;
  const origResendApiKey = process.env.RESEND_API_KEY;
  process.env.RESEND_BASE_URL = `http://127.0.0.1:${resendPort}`;
  process.env.RESEND_API_KEY = "mock-resend-key";

  const ts = Date.now().toString().slice(-8);
  const owner = await db.admin.create({
    data: { name: "Verify Owner", initials: "VO", email: `verify-zoom-owner-${ts}@test.local`, role: "org_owner", accountType: "organizational" },
  });

  const projectDefaults = {
    company: "ZoomVerify",
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
    brandingLogoInitial: "Z",
    brandingPrimaryColor: "#000000",
    brandingSenderName: "ZoomVerify",
    ownerId: owner.id,
  };

  const pAuto = await db.project.create({ data: { ...projectDefaults, slug: `verify-za-${ts}`, name: "Auto", meetingPlatformPreference: "auto" } });
  const pZoom = await db.project.create({ data: { ...projectDefaults, slug: `verify-zz-${ts}`, name: "ZoomOnly", meetingPlatformPreference: "zoom" } });
  const pTeams = await db.project.create({ data: { ...projectDefaults, slug: `verify-zt-${ts}`, name: "TeamsOnly", meetingPlatformPreference: "teams" } });

  const acc1 = await createZoomAccount({ label: "Zoom One", zoomUserId: "zu-1", zoomEmail: "zoom1@example.test" });
  const acc2 = await createZoomAccount({ label: "Zoom Two", zoomUserId: "zu-2", zoomEmail: "zoom2@example.test" });

  // Ensure the two owner-fallback templates exist so email rendering works.
  const createdTemplateIds: string[] = [];
  for (const cat of ["zoom_fallback_to_teams", "zoom_pool_full_no_fallback"] as const) {
    const existing = await db.emailTemplate.findFirst({ where: { category: cat, projectId: null, isActive: true } });
    if (!existing) {
      const t = await db.emailTemplate.create({
        data: {
          category: cat,
          audience: "super_admin",
          projectId: null,
          subject: `Test ${cat}`,
          bodyHtml: `<p>Project: {{project_name}} · Session {{session_date}} {{session_time}}</p>`,
          version: 1,
          isActive: true,
        },
      });
      createdTemplateIds.push(t.id);
    }
  }

  const d1 = dkOffset(3);
  const d2 = dkOffset(4);

  const makeBooking = (projectId: string, dateKey: string, time: string, n: number) =>
    db.booking.create({
      data: {
        projectId,
        adminId: owner.id,
        participantName: `Verify Zoom P${n}`,
        participantEmail: `vp${n}-${ts}@test.local`,
        dateKey,
        time,
        status: "confirmed",
      },
    });

  console.log("\n[A] Auto preference — pool fill then Teams fallback");
  const b1 = await makeBooking(pAuto.id, d1, "10:00", 1);
  const b2 = await makeBooking(pAuto.id, d1, "10:00", 2);
  const b3 = await makeBooking(pAuto.id, d1, "10:00", 3);
  await provisionMeeting(pAuto.id, b1.id);
  await provisionMeeting(pAuto.id, b2.id);
  await provisionMeeting(pAuto.id, b3.id);

  const r1 = await db.booking.findUnique({ where: { id: b1.id } });
  const r2 = await db.booking.findUnique({ where: { id: b2.id } });
  const r3 = await db.booking.findUnique({ where: { id: b3.id } });

  check("b1 provisioned on Zoom", r1?.meetingPlatform === "zoom" && r1.zoomMeetingId != null && (r1.zoomJoinUrl ?? "").startsWith("https://zoom.us/j/"), JSON.stringify({ p: r1?.meetingPlatform, id: r1?.zoomMeetingId }));
  check("b2 provisioned on Zoom", r2?.meetingPlatform === "zoom" && r2.zoomMeetingId != null);
  check("b1 and b2 on DIFFERENT accounts", Boolean(r1?.zoomAccountId && r2?.zoomAccountId && r1.zoomAccountId !== r2.zoomAccountId), `${r1?.zoomAccountId} vs ${r2?.zoomAccountId}`);
  check("b3 fell back to Teams (pool full)", r3?.meetingPlatform === "teams" && r3?.meetingFallbackReason === "zoom_pool_full_no_fallback", JSON.stringify({ p: r3?.meetingPlatform, reason: r3?.meetingFallbackReason }));
  check("b3 released any zoom claim", r3?.zoomAccountId === null, String(r3?.zoomAccountId));
  check("b3 teams provision attempted (no Graph token)", r3?.teamsProvisionStatus != null, String(r3?.teamsProvisionStatus));

  const createdCalls = calls.filter((c) => c.startsWith("create:"));
  check("exactly 2 Zoom meetings created (one per account)", createdCalls.length === 2 && new Set(createdCalls).size === 2, createdCalls.join(","));

  const auditA = await db.auditLog.findFirst({ where: { action: "zoom_fallback_to_teams", entityId: b3.id } });
  check("audit zoom_fallback_to_teams written", auditA != null, JSON.stringify(auditA));
  const notifA = await db.notificationLog.findFirst({ where: { category: "zoom_fallback_to_teams", projectId: pAuto.id, recipientEmail: owner.email } });
  check("owner emailed (zoom_fallback_to_teams)", notifA != null && notifA.recipientRole === "super_admin" && notifA.status === "sent", JSON.stringify(notifA));
  const emailA = sentEmails.find((e) => e.to === owner.email && e.subject?.includes("zoom_fallback_to_teams"));
  check("Resend email actually sent to owner (fallback)", emailA != null, JSON.stringify(emailA));

  console.log("\n[B] Zoom-only preference — pool full, no fallback");
  const b4 = await makeBooking(pZoom.id, d1, "10:00", 4);
  await provisionMeeting(pZoom.id, b4.id);
  const r4 = await db.booking.findUnique({ where: { id: b4.id } });
  check("b4 stays zoom + failed", r4?.meetingPlatform === "zoom" && r4?.zoomProvisionStatus === "failed" && r4?.meetingFallbackReason === "zoom_pool_full_no_fallback", JSON.stringify({ p: r4?.meetingPlatform, s: r4?.zoomProvisionStatus, r: r4?.meetingFallbackReason }));
  check("b4 has no teams meeting", r4?.teamsMeetingId == null);
  const auditB = await db.auditLog.findFirst({ where: { action: "zoom_pool_full_no_fallback", entityId: b4.id } });
  check("audit zoom_pool_full_no_fallback written", auditB != null);
  const notifB = await db.notificationLog.findFirst({ where: { category: "zoom_pool_full_no_fallback", projectId: pZoom.id, recipientEmail: owner.email } });
  check("owner emailed (zoom_pool_full_no_fallback)", notifB != null && notifB.status === "sent", JSON.stringify(notifB));
  const emailB = sentEmails.find((e) => e.to === owner.email && e.subject?.includes("zoom_pool_full_no_fallback"));
  check("Resend email actually sent to owner (zoom-only pool full)", emailB != null, JSON.stringify(emailB));

  console.log("\n[C] Teams-only preference — Zoom never called");
  const callCountC = calls.length;
  const b5 = await makeBooking(pTeams.id, d1, "10:00", 5);
  await provisionMeeting(pTeams.id, b5.id);
  const r5 = await db.booking.findUnique({ where: { id: b5.id } });
  check("b5 is teams", r5?.meetingPlatform === "teams", String(r5?.meetingPlatform));
  check("no zoom API calls for teams-only booking", calls.length === callCountC, `delta=${calls.length - callCountC}`);
  const zoomAudits5 = await db.auditLog.count({ where: { action: { in: ["zoom_fallback_to_teams", "zoom_pool_full_no_fallback", "zoom_provision_failed"] }, entityId: b5.id } });
  check("no zoom audits for teams-only booking", zoomAudits5 === 0, String(zoomAudits5));

  console.log("\n[D] Auto preference — Zoom API failure falls back to Teams");
  failUser = "zu-1";
  const b6 = await makeBooking(pAuto.id, d2, "10:00", 6);
  await provisionMeeting(pAuto.id, b6.id);
  failUser = null;
  const r6 = await db.booking.findUnique({ where: { id: b6.id } });
  check("b6 fell back to Teams after API failure", r6?.meetingPlatform === "teams" && r6?.meetingFallbackReason === "zoom_provision_failed", JSON.stringify({ p: r6?.meetingPlatform, r: r6?.meetingFallbackReason }));
  check("b6 released the claimed account", r6?.zoomAccountId === null, String(r6?.zoomAccountId));
  const auditD = await db.auditLog.findFirst({ where: { action: "zoom_fallback_to_teams", entityId: b6.id } });
  check("audit zoom_fallback_to_teams written (API failure)", auditD != null);
  const notifD = await db.notificationLog.findFirst({ where: { category: "zoom_fallback_to_teams", projectId: pAuto.id, recipientEmail: owner.email }, orderBy: { createdAt: "desc" } });
  check("owner emailed again (fallback)", notifD != null && notifD.status === "sent");
  const emailD = sentEmails.filter((e) => e.to === owner.email);
  check("Resend email actually sent (API failure fallback)", emailD.length >= 3, `count=${emailD.length}`);

  console.log("\n[D2] Zoom-only preference — API failure, no fallback");
  failUser = "zu-1";
  const b9 = await makeBooking(pZoom.id, d2, "09:00", 9);
  await provisionMeeting(pZoom.id, b9.id);
  failUser = null;
  const r9 = await db.booking.findUnique({ where: { id: b9.id } });
  check("b9 stays zoom + failed", r9?.meetingPlatform === "zoom" && r9?.zoomProvisionStatus === "failed" && r9?.meetingFallbackReason === "zoom_provision_failed", JSON.stringify({ p: r9?.meetingPlatform, s: r9?.zoomProvisionStatus, r: r9?.meetingFallbackReason }));
  check("b9 has no teams meeting", r9?.teamsMeetingId == null && r9?.meetingPlatform !== "teams");
  const auditD2 = await db.auditLog.findFirst({ where: { action: "zoom_provision_failed", entityId: b9.id } });
  check("audit zoom_provision_failed written (zoom-only)", auditD2 != null);
  const notifD2 = await db.notificationLog.findFirst({ where: { category: "zoom_pool_full_no_fallback", projectId: pZoom.id, recipientEmail: owner.email }, orderBy: { createdAt: "desc" } });
  check("owner emailed (zoom_pool_full_no_fallback)", notifD2 != null && notifD2.status === "sent");
  const emailD2 = sentEmails.filter((e) => e.to === owner.email && e.subject?.includes("zoom_pool_full_no_fallback"));
  check("Resend email actually sent (zoom-only API failure)", emailD2.length >= 2, `count=${emailD2.length}`);

  console.log("\n[E] Race — two concurrent claims, one free account");
  await setZoomAccountActive(acc2.id, false);
  const b7 = await makeBooking(pAuto.id, d2, "11:00", 7);
  const b8 = await makeBooking(pAuto.id, d2, "11:00", 8);
  await Promise.all([provisionMeeting(pAuto.id, b7.id), provisionMeeting(pAuto.id, b8.id)]);
  const r7 = await db.booking.findUnique({ where: { id: b7.id } });
  const r8 = await db.booking.findUnique({ where: { id: b8.id } });
  const claimedAtSlot = await db.booking.count({ where: { zoomAccountId: acc1.id, dateKey: d2, time: "11:00", status: "confirmed" } });
  check("exactly ONE race booking claimed the last account", claimedAtSlot === 1, String(claimedAtSlot));
  const zoomWinner = [r7, r8].filter((b) => b?.meetingPlatform === "zoom");
  const fallbackLoser = [r7, r8].filter((b) => b?.meetingPlatform === "teams");
  check("one winner (zoom), one loser (teams fallback)", zoomWinner.length === 1 && fallbackLoser.length === 1, `${zoomWinner.length}/${fallbackLoser.length}`);
  check("loser recorded pool_full fallback reason", fallbackLoser[0]?.meetingFallbackReason === "zoom_pool_full_no_fallback", String(fallbackLoser[0]?.meetingFallbackReason));
  await setZoomAccountActive(acc2.id, true);

  console.log("\n[F] Cleanup");
  const auditBefore = await db.auditLog.count({ where: { projectId: { in: [pAuto.id, pZoom.id, pTeams.id] } } });
  const notifBefore = await db.notificationLog.count({ where: { projectId: { in: [pAuto.id, pZoom.id, pTeams.id] } } });
  const bookingBefore = await db.booking.count({ where: { projectId: { in: [pAuto.id, pZoom.id, pTeams.id] } } });
  check("audits were written during run", auditBefore >= 3, String(auditBefore));
  check("notifications were written during run", notifBefore >= 2, String(notifBefore));
  check("zoom bookings were written during run", bookingBefore === 9, String(bookingBefore));

  await db.notificationLog.deleteMany({ where: { projectId: { in: [pAuto.id, pZoom.id, pTeams.id] } } });
  await db.auditLog.deleteMany({ where: { projectId: { in: [pAuto.id, pZoom.id, pTeams.id] } } });
  await db.booking.deleteMany({ where: { projectId: { in: [pAuto.id, pZoom.id, pTeams.id] } } });
  await db.zoomAccount.deleteMany({ where: { id: { in: [acc1.id, acc2.id] } } });
  await db.project.deleteMany({ where: { id: { in: [pAuto.id, pZoom.id, pTeams.id] } } });
  await db.admin.deleteMany({ where: { id: owner.id } });
  if (createdTemplateIds.length > 0) {
    await db.emailTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
  }

  const leftover = await db.admin.count({ where: { email: { startsWith: "verify-zoom-" } } });
  const leftoverAccounts = await db.zoomAccount.count({ where: { label: { in: ["Zoom One", "Zoom Two"] } } });
  check("no leftover verify-zoom admins", leftover === 0, String(leftover));
  check("no leftover pool accounts", leftoverAccounts === 0, String(leftoverAccounts));

  server.close();
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
