import { chromium } from "playwright";
import pg from "pg";
import crypto from "node:crypto";

const DATABASE_URL = process.argv[2] ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Pass DATABASE_URL as argv[2] or set env.");
  process.exit(1);
}

const BASE = "http://localhost:3100";
const ALIAS_PARTICIPANT = "notifications+participant@eureka-ent.org";
const DEMO_SLUG = "senior-pm-interview";
const TEST_EMAIL = `demo.e2e.${Date.now()}@eureka-ent.org`;

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const q = (text, params) => pool.query(text, params);

let failures = 0;
const pass = (label, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${extra ? "  | " + extra : ""}`);
  if (!ok) failures++;
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function brutePin(pinHash) {
  for (let i = 0; i < 1_000_000; i++) {
    const s = String(i).padStart(6, "0");
    if (crypto.createHash("sha256").update(s).digest("hex") === pinHash) return s;
  }
  return null;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  // ---------- 1: placeholder availability E2E booking ----------
  console.log(`\n[E2E] opening /book/${DEMO_SLUG} (test email ${TEST_EMAIL})`);
  await page.goto(`${BASE}/book/${DEMO_SLUG}`, { waitUntil: "networkidle", timeout: 60000 });

  const prompt = page.locator('input[placeholder="your@email.com"]');
  if (await prompt.isVisible().catch(() => false)) {
    await prompt.fill(TEST_EMAIL);
    await page.getByRole("button", { name: "Show times" }).click();
    await page.locator("div.aspect-square, button.aspect-square").first().waitFor({ timeout: 15000 });
  }

  const dayBtn = page.locator("button.aspect-square:not([disabled])").first();
  await dayBtn.click();
  await page.waitForTimeout(300);

  const slotBtn = page.locator("button", { hasText: /(^|\s)(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM)$/i, hasNotText: "current" }).first();
  await slotBtn.click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator('input[placeholder="Jane Doe"]').fill("Demo E2E Booker");
  await page.locator('input[placeholder="jane@email.com"]').fill(TEST_EMAIL);
  await page.getByRole("button", { name: /Confirm booking/ }).click();

  await page.getByText("You're booked").waitFor({ timeout: 90000 });
  console.log(`[E2E] confirmed screen reached: ${await page.url()}`);

  // load booking from DB
  const { rows: books } = await q(
    `SELECT id, "projectId", "adminId", "participantName", "participantEmail", "dateKey", time,
            "meetingPlatform", "zoomMeetingId", "teamsMeetingId", "zoomProvisionStatus",
            "meetingFallbackReason", status, "createdAt"
     FROM "Booking" WHERE "participantEmail" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [TEST_EMAIL]
  );
  const booking = books[0];
  pass("booking created in DB", !!booking, booking && JSON.stringify({
    id: booking.id, dateKey: booking.dateKey, time: booking.time, status: booking.status,
  }));
  if (!booking) throw new Error("No booking row found");

  pass("booking.participantEmail = entered test email", booking.participantEmail === TEST_EMAIL, booking.participantEmail);
  const skipMeeting =
    booking.meetingPlatform === null &&
    booking.zoomMeetingId === null &&
    booking.teamsMeetingId === null &&
    booking.zoomProvisionStatus === null;
  pass("demo booking has NO meeting provisioned (zoom/teams skip)", skipMeeting,
    `meetingPlatform=${booking.meetingPlatform} zoom=${booking.zoomMeetingId} teams=${booking.teamsMeetingId} prov=${booking.zoomProvisionStatus}`);

  // project + booking_link slug check
  const { rows: projRows } = await q(`SELECT id, slug FROM "Project" WHERE id = $1`, [booking.projectId]);
  pass("booking on demo project (ownerId-null)", projRows[0]?.id === "demo-project-fidlaque", projRows[0]?.id);

  // NotificationLog evidence: wait for confirmation logs, assert alias-only participant recipients
  const notifDeadline = Date.now() + 20000;
  let notifRows = [];
  while (Date.now() < notifDeadline) {
    notifRows = (await q(
      `SELECT id, category, "recipientEmail", "recipientRole", status, "renderedBody", "hoursBefore"
       FROM "NotificationLog" WHERE "projectId" = $1 AND "createdAt" >= $2 ORDER BY "createdAt" ASC`,
      [booking.projectId, booking.createdAt]
    )).rows;
    if (notifRows.length > 0) break;
    await sleep(1500);
  }
  console.log(`[DB] notification logs for booking: ${notifRows.length}`);
  for (const n of notifRows) {
    console.log(`  ${n.category} role=${n.recipientRole} to=${n.recipientEmail} status=${n.status}`);
  }
  const participantLogs = notifRows.filter((n) => n.recipientRole === "participant");
  pass("confirmation NotificationLog rows created", participantLogs.length > 0);
  pass("participant notifications delivered to alias only",
    participantLogs.length > 0 &&
    participantLogs.every((n) => n.recipientEmail === ALIAS_PARTICIPANT) &&
    !participantLogs.some((n) => n.recipientEmail === TEST_EMAIL),
    participantLogs.map((n) => n.recipientEmail).join(","));

  const slugInBody = participantLogs.some((n) => n.renderedBody && n.renderedBody.includes(`/book/${DEMO_SLUG}`));
  pass("booking_link uses project slug (/book/" + DEMO_SLUG + ")", slugInBody);

  // ---------- 2: manage PIN request + verify on the demo booking ----------
  console.log(`\n[PIN] opening /manage/${booking.id} (locked gate)`);
  await page.goto(`${BASE}/manage/${booking.id}`, { waitUntil: "networkidle", timeout: 60000 });
  const lockEmail = page.locator('input[placeholder="Enter your booking email"]');
  await lockEmail.waitFor({ timeout: 15000 });
  await lockEmail.fill(TEST_EMAIL);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByText("A verification code has been sent to your email.").waitFor({ timeout: 60000 });
  console.log(`[PIN] request accepted (PIN email dispatch routed via demoRecipientEmail)`);

  const { rows: pinRows } = await q(
    `SELECT "pinHash", email, used FROM "VerificationPin" WHERE "bookingId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [booking.id]
  );
  pass("VerificationPin row created for demo booking", pinRows.length > 0);
  pass("VerificationPin identity email = booking email", pinRows[0]?.email === TEST_EMAIL.toLowerCase(), pinRows[0]?.email);
  const pin = brutePin(pinRows[0]?.pinHash ?? "");
  pass("PIN recoverable (hash brute-force)", !!pin, pin && `pin=${pin}`);

  await page.locator('input[placeholder="000000"]').fill(pin ?? "000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL(/\/manage\/.+\?token=/, { timeout: 60000 });

  // unlocked manage page should render booking details (not the locked gate)
  await page.locator("text=Manage your booking").first().waitFor({ timeout: 60000 });
  const lockedGone = !(await page.locator('input[placeholder="Enter your booking email"]').isVisible().catch(() => true));
  pass("manage page unlocked after PIN verify (locked gate gone)", lockedGone);
  pass("manage page shows booking details", await page.getByText(TEST_EMAIL).isVisible().catch(() => false));
  console.log(`[PIN] manage URL after verify: ${page.url()}`);

  // ------------- summary -------------
  console.log(`\n========== DEMO E2E SUMMARY ==========`);
  console.log(`bookingId=${booking.id}`);
  console.log(`participantEmail=${booking.participantEmail}`);
  console.log(`failures=${failures}`);
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error("[E2E] ERROR:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await pool.end();
}