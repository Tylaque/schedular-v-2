import { chromium } from "playwright";
import { config } from "dotenv";
import { resolve, join } from "path";
import { mkdirSync } from "fs";

const ENV_PATH = resolve(__dirname, "../../.env");
config({ path: ENV_PATH });

const BASE_URL = process.env.AUTH_URL || "http://localhost:3002";
const OWNER_EMAIL = "owner@test.example.com";
const ADMIN_EMAIL = "test@test.example.com";
const PASSWORD = "test1234";
const SCREENSHOT_DIR = join(__dirname, "../../test-screenshots/polish");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function signIn(ctx: any, page: any, email: string) {
  const csrfRes = await ctx.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  if (!csrfToken) throw new Error("No CSRF token from /api/auth/csrf");
  await ctx.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password: PASSWORD, json: "true" },
  });
  const cookies = await ctx.cookies();
  const hasSession = cookies.some((c: any) => c.name === "authjs.session-token");
  console.log(`  sign-in ${email}: session cookie = ${hasSession}`);
  await page.goto(`${BASE_URL}/admin/projects`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForURL((url: URL) => url.toString().includes("/admin"), { timeout: 30000 });
  await sleep(2000);
}

async function poke(page: any) {
  await page.mouse.move(5, 5);
  await page.keyboard.press("Shift");
}

async function boxShadowOf(page: any, selector: string): Promise<string> {
  return page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).boxShadow : "NO_ELEMENT";
  }, selector);
}

async function gradientOf(page: any, selector: string): Promise<string> {
  return page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).backgroundImage : "NO_ELEMENT";
  }, selector);
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    // ================= Phase A: org_owner =================
    console.log("=== Phase A: org_owner ===");
    await signIn(context, page, OWNER_EMAIL);

    // --- Dashboard: greeting + stat card shadow ---
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("text=Good", { timeout: 20000 });
    await poke(page);
    const greetingText = await page.locator("div.mb-6").first().innerText();
    console.log("Greeting block text:", JSON.stringify(greetingText));
    const expectedDate = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const hasGreeting = greetingText.includes("Owner");
    const hasDate = greetingText.includes(expectedDate);
    const hasCount = greetingText.includes("1 session");
    const statShadow = await boxShadowOf(page, ".grid .shadow-sm");
    console.log("Greeting name 'Owner':", hasGreeting);
    console.log("Greeting real date:", hasDate);
    console.log("Greeting today count '1 session':", hasCount);
    console.log("Stat card box-shadow:", statShadow);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "01-dashboard.png"), fullPage: true });
    if (!hasGreeting || !hasDate || !hasCount) throw new Error("Dashboard greeting evidence missing");

    // --- Team: gradient avatars + search ---
    await page.goto(`${BASE_URL}/admin/team`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("table", { timeout: 20000 });
    await sleep(2500);
    await poke(page);
    const teamAvatarBg = await gradientOf(page, "tbody span.rounded-full");
    console.log("Team avatar gradient:", teamAvatarBg);
    const teamSearch = page.locator('input[placeholder^="Search team"]');
    const teamSearchVisible = await teamSearch.count() > 0;
    console.log("Team search input visible:", teamSearchVisible);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "02-team.png"), fullPage: true });
    await teamSearch.fill("priya");
    await sleep(800);
    const teamRowsAfter = await page.locator("tbody tr").count();
    console.log("Team rows after 'priya':", teamRowsAfter);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "03-team-search.png"), fullPage: true });
    if (!teamAvatarBg.includes("gradient")) throw new Error("Team avatar not gradient");
    if (!teamSearchVisible) throw new Error("Team search input missing");
    if (teamRowsAfter !== 1) throw new Error(`Team search expected 1 row, got ${teamRowsAfter}`);

    // --- Templates: shadow ---
    await page.goto(`${BASE_URL}/admin/templates`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("table", { timeout: 20000 });
    await poke(page);
    const templatesShadow = await boxShadowOf(page, ".overflow-x-auto");
    console.log("Templates table box-shadow:", templatesShadow);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "04-templates.png"), fullPage: true });
    if (templatesShadow === "none" || templatesShadow === "NO_ELEMENT") throw new Error("Templates table missing shadow");

    // --- Waitlist: search ---
    await page.goto(`${BASE_URL}/admin/waitlist`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("table", { timeout: 20000 });
    await sleep(2500);
    await poke(page);
    const waitlistShadow = await boxShadowOf(page, ".overflow-x-auto");
    console.log("Waitlist table box-shadow:", waitlistShadow);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "05-waitlist.png"), fullPage: true });
    const waitlistSearch = page.locator('input[placeholder="Search by name or email..."]');
    await waitlistSearch.fill("alice");
    await sleep(800);
    const waitlistRows = await page.locator("tbody tr").count();
    const waitlistText = await page.locator("tbody").innerText();
    console.log("Waitlist rows after 'alice':", waitlistRows, "| contains Alice:", waitlistText.includes("Alice Waiting"));
    await page.screenshot({ path: join(SCREENSHOT_DIR, "06-waitlist-search.png"), fullPage: true });
    if (waitlistRows !== 1 || !waitlistText.includes("Alice Waiting")) throw new Error("Waitlist search failed");

    // --- Notification Logs: search ---
    await page.goto(`${BASE_URL}/admin/templates/logs`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("table", { timeout: 20000 });
    await sleep(2500);
    await poke(page);
    const logsShadow = await boxShadowOf(page, ".overflow-x-auto");
    console.log("Logs table box-shadow:", logsShadow);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "07-logs.png"), fullPage: true });
    const logsSearch = page.locator('input[placeholder="Search by recipient or subject..."]');
    await logsSearch.fill("p1@logs.test");
    await sleep(800);
    const logsRows = await page.locator("tbody tr").count();
    console.log("Logs rows after 'p1@logs.test':", logsRows);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "08-logs-search.png"), fullPage: true });
    if (logsRows !== 1) throw new Error(`Logs search expected 1 row, got ${logsRows}`);

    // --- AccountMenu gradient avatar ---
    await page.goto(`${BASE_URL}/admin/my-area`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(2000);
    await poke(page);
    const accountAvatarBg = await gradientOf(page, "button span.rounded-full");
    console.log("AccountMenu avatar gradient:", accountAvatarBg);
    await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      for (const b of buttons) {
        if (b.textContent?.includes("Owner Test")) {
          b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          break;
        }
      }
    });
    await sleep(800);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "09-account-menu.png") });
    if (!accountAvatarBg.includes("gradient")) throw new Error("AccountMenu avatar not gradient");

    // ================= Phase B: admin (my-area greeting + inactivity) =================
    console.log("=== Phase B: admin ===");
    await context.clearCookies();
    await signIn(context, page, ADMIN_EMAIL);

    await page.goto(`${BASE_URL}/admin/my-area`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("text=Good", { timeout: 20000 });
    const myAreaText = await page.locator("body").innerText();
    const myAreaCount = myAreaText.includes("1 session") && myAreaText.includes("Upcoming Sessions (1)");
    console.log("My-area greeting + real count (1 session):", myAreaCount);
    await poke(page);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "10-my-area-admin.png"), fullPage: true });
    if (!myAreaCount) throw new Error("My-area greeting/count missing");

    // --- Inactivity warning + auto-logout (shortened via env on :3003, prod = 13/15 min) ---
    console.log("Inactivity test: waiting for warning modal...");
    await page.waitForSelector("text=Still there?", { timeout: 60000 });
    console.log("Warning modal appeared (real trigger).");
    await page.screenshot({ path: join(SCREENSHOT_DIR, "11-inactivity-warning.png") });
    await page.keyboard.press("Shift"); // real activity -> resets timer, closes modal
    await sleep(1500);
    const modalGone = (await page.locator("text=Still there?").count()) === 0;
    console.log("Modal dismissed by keypress:", modalGone);
    if (!modalGone) throw new Error("Modal did not dismiss on activity");

    console.log("Inactivity test: waiting for auto sign-out...");
    await page.waitForURL((url: URL) => !url.toString().includes("/admin"), { timeout: 60000 });
    console.log("Auto sign-out URL:", page.url());
    await page.screenshot({ path: join(SCREENSHOT_DIR, "12-after-signout.png") });

    if (errors.length > 0) console.warn("Page errors:", errors.join("; "));
    console.log("OK");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
