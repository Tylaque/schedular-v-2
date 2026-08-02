import { chromium, type BrowserContext, type Page } from "playwright";
import { config } from "dotenv";
import { resolve, join } from "path";
import { mkdirSync } from "fs";

const ENV_PATH = resolve(__dirname, "../../.env");
config({ path: ENV_PATH });
const { db } = require("../../lib/db");

const BASE_URL = process.env.AUTH_URL || "http://localhost:3002";
const OWNER_EMAIL = "owner@test.example.com";
const SUPER_ADMIN_EMAIL = "kate@northwind.com";
const PASSWORD = "test1234";
const SHOT_DIR = join(__dirname, "../../test-screenshots/analytics");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, extra = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${extra ? `  -> ${extra}` : ""}`);
  }
}

async function signIn(ctx: BrowserContext, page: Page, email: string) {
  const csrfRes = await ctx.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  if (!csrfToken) throw new Error("No CSRF token");
  await ctx.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password: PASSWORD, json: "true" },
  });
  const cookies = await ctx.cookies();
  const hasSession = cookies.some((c: any) => c.name === "authjs.session-token");
  if (!hasSession) throw new Error(`sign-in failed for ${email}`);
  await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForURL((u: URL) => u.toString().includes("/admin"), { timeout: 30000 });
  await sleep(1500);
}

async function goto(page: Page, path: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
      console.log(`  (retry ${attempt}) goto ${path}`);
      await sleep(1500);
    }
  }
  await sleep(1800);
}

async function setTheme(page: Page, theme: string) {
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(1800);
}

async function setDateRange(page: Page, from: string, to: string) {
  await page.locator("input[type='date']").nth(0).fill(from);
  await page.locator("input[type='date']").nth(1).fill(to);
}

async function waitForText(page: Page, text: string, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await page.evaluate((t) => document.body.innerText.includes(t), text)) return true;
    await sleep(300);
  }
  return false;
}

async function countBars(page: Page): Promise<number> {
  return page.locator("[data-testid='booking-volume-chart'] .recharts-bar-rectangle").count();
}

async function waitForBars(page: Page, timeoutMs = 10000): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const n = await countBars(page);
    if (n >= 1) return n;
    await sleep(300);
  }
  return countBars(page);
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();

  await signIn(ctx, page, OWNER_EMAIL);

  await goto(page, "/admin/reports");

  // --- Page structure ---
  const pageText = await page.evaluate(() => document.body.innerText);
  check("analytics section header present", pageText.includes("Analytics"));
  check("booking volume card present", pageText.includes("Booking volume"));
  check("admin utilization card present", pageText.includes("Admin utilization"));
  check("project health card present", pageText.includes("Project health"));

  const dateInputCount = await page.$$eval("input[type='date']", (els) => els.length);
  check("two date-range inputs", dateInputCount === 2, `got ${dateInputCount}`);

  const selectOptions = await page.$$eval("select", (els) =>
    els.map((s) => [...s.options].map((o) => o.text.trim())),
  );
  const granularityOpts = selectOptions[0] ?? [];
  const projectOpts = selectOptions[1] ?? [];
  check("granularity has Weekly/Monthly", granularityOpts.includes("Weekly") && granularityOpts.includes("Monthly"), JSON.stringify(granularityOpts));
  check("project select has All projects", projectOpts.includes("All projects"), JSON.stringify(projectOpts));
  check("project select lists scoped project", projectOpts.includes("Test Owner Project"), JSON.stringify(projectOpts));

  // --- Charts render real data ---
  await page.waitForSelector("[data-testid='booking-volume-chart'] svg", { timeout: 20000 });
  const barCount = await page.locator("[data-testid='booking-volume-chart'] .recharts-bar-rectangle").count();
  const lineCount = await page.locator("[data-testid='booking-volume-chart'] .recharts-line-curve").count();
  check("volume chart has bars", barCount >= 1, `bars=${barCount}`);
  check("volume chart has cancelled+rescheduled lines", lineCount >= 2, `lines=${lineCount}`);

  const healthRow = await page.evaluate(() => {
    const tr = [...document.querySelectorAll("tbody tr")].find((t) => t.textContent?.includes("Test Owner Project"));
    return tr ? tr.textContent : null;
  });
  check("health table lists Test Owner Project", !!healthRow, healthRow ?? "row missing");

  // --- API numeric cross-check vs DB ---
  const WIDE_FROM = "2026-07-01";
  const WIDE_TO = "2026-08-02";
  const wide = await ctx.request.get(`${BASE_URL}/api/analytics?from=${WIDE_FROM}&to=${WIDE_TO}&granularity=week`);
  const wideJson: any = await wide.json();
  check("API 200 wide range", wide.status() === 200, `status ${wide.status()}`);

  const dbBookingsWide = await db.booking.count({ where: { createdAt: { gte: new Date(`${WIDE_FROM}T00:00:00.000Z`), lte: new Date(`${WIDE_TO}T23:59:59.999Z`) } } });
  const volTotal = wideJson.volume.reduce((n: number, b: any) => n + b.total, 0);
  check("volume total matches DB", volTotal === dbBookingsWide, `api=${volTotal} db=${dbBookingsWide}`);

  const dbSlotsWide = await db.adminAvailability.count({ where: { dateKey: { gte: WIDE_FROM, lte: WIDE_TO } } });
  const dbConfirmedWide = await db.booking.count({ where: { status: "confirmed", dateKey: { gte: WIDE_FROM, lte: WIDE_TO } } });
  const dbWaitlistWide = await db.waitlistEntry.count({ where: { createdAt: { gte: new Date(`${WIDE_FROM}T00:00:00.000Z`), lte: new Date(`${WIDE_TO}T23:59:59.999Z`) } } });
  const expectedFill = dbSlotsWide > 0 ? dbConfirmedWide / dbSlotsWide : 0;
  const health = wideJson.health.find((h: any) => h.projectName === "Test Owner Project");
  check("health row returned", !!health);
  if (health) {
    check("fillRate matches DB", Math.abs(health.fillRate - expectedFill) < 1e-9, `expected ${expectedFill} got ${health.fillRate}`);
    check("waitlistCount matches DB", health.waitlistCount === dbWaitlistWide, `expected ${dbWaitlistWide} got ${health.waitlistCount}`);
  }

  // --- Filters change data ---
  await setDateRange(page, "2026-07-01", "2026-07-15");
  const emptyMsg = await waitForText(page, "No bookings in the selected range.");
  check("narrow range shows empty-volume message", emptyMsg);
  const barsNarrow = await countBars(page);
  check("narrow range has zero bars", barsNarrow === 0, `bars=${barsNarrow}`);

  const narrow = await ctx.request.get(`${BASE_URL}/api/analytics?from=2026-07-01&to=2026-07-15&granularity=week`);
  const narrowJson: any = await narrow.json();
  check("API volume empty on narrow range", narrowJson.volume.every((b: any) => b.total === 0), JSON.stringify(narrowJson.volume));
  const dbSlotsNarrow = await db.adminAvailability.count({ where: { dateKey: { gte: "2026-07-01", lte: "2026-07-15" } } });
  check("narrow range health fillRate 0", narrowJson.health[0].fillRate === 0 && dbSlotsNarrow === 0, `slots=${dbSlotsNarrow} fill=${narrowJson.health[0].fillRate}`);

  await setDateRange(page, "2026-07-27", "2026-08-02");
  const barsWideAgain = await waitForBars(page);
  check("data returns after widening range", barsWideAgain >= 1, `bars=${barsWideAgain}`);

  // monthly granularity
  const monthly = await ctx.request.get(`${BASE_URL}/api/analytics?from=2026-07-01&to=2026-08-02&granularity=month`);
  const monthlyJson: any = await monthly.json();
  const monthlyTotal = monthlyJson.volume.reduce((n: number, b: any) => n + b.total, 0);
  check("monthly granularity totals match", monthlyTotal === dbBookingsWide, `api=${monthlyTotal} db=${dbBookingsWide}`);
  check("monthly buckets use yyyy-mm keys", monthlyJson.volume.every((b: any) => /^\d{4}-\d{2}$/.test(b.period)), JSON.stringify(monthlyJson.volume.map((b: any) => b.period)));

  // project filter
  await page.selectOption("select >> nth=1", { label: "Test Owner Project" });
  const barsProject = await waitForBars(page);
  check("project filter keeps data", barsProject >= 1, `bars=${barsProject}`);
  const projectFiltered = await ctx.request.get(`${BASE_URL}/api/analytics?from=${WIDE_FROM}&to=${WIDE_TO}&granularity=week&projectId=${health?.projectId}`);
  const projJson: any = await projectFiltered.json();
  const projTotal = projJson.volume.reduce((n: number, b: any) => n + b.total, 0);
  check("project filter scopes volume to project", projTotal === dbBookingsWide, `api=${projTotal}`);
  await page.selectOption("select >> nth=1", { label: "All projects" });
  await sleep(1200);

  // --- Scoping: super_admin (not org_owner) sees only their own projects (none) ---
  const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const adminPage = await adminCtx.newPage();
  await signIn(adminCtx, adminPage, SUPER_ADMIN_EMAIL);
  await goto(adminPage, "/admin/reports");
  const adminUrl = adminPage.url();
  const adminSelectCount = await adminPage.locator("select").count();
  check("super_admin reports page loaded with selects", adminUrl.includes("/admin/reports") && adminSelectCount >= 2, `url=${adminUrl} selects=${adminSelectCount}`);
  const adminProjects = adminSelectCount >= 2
    ? await adminPage.locator("select").nth(1).evaluate((s: HTMLSelectElement) =>
        Array.from(s.options).map((o) => o.text.trim()),
      )
    : [];
  check("super_admin project select has no projects", adminProjects.length === 1 && adminProjects[0] === "All projects", JSON.stringify(adminProjects));
  const adminEmpty = adminSelectCount >= 2
    ? await waitForText(adminPage, "No bookings in the selected range.")
    : false;
  check("super_admin sees empty analytics", adminEmpty);
  const adminApi = await adminCtx.request.get(`${BASE_URL}/api/analytics?from=${WIDE_FROM}&to=${WIDE_TO}&granularity=week`);
  const adminJson: any = await adminApi.json();
  check("admin API returns no projects", adminJson.projects.length === 0 && adminJson.health.length === 0, `projects=${adminJson.projects.length} health=${adminJson.health.length}`);

  // --- Screenshots: light + dark ---
  await page.selectOption("select >> nth=1", { label: "All projects" }).catch(() => {});
  await setTheme(page, "light");
  await page.waitForSelector(".recharts-responsive-container svg", { timeout: 20000 });
  await sleep(1200);
  const bodyBgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("light body bg gray-50", bodyBgLight === "rgb(249, 250, 251)", bodyBgLight);
  await page.screenshot({ path: join(SHOT_DIR, "reports-analytics-light.png"), fullPage: true });

  await setTheme(page, "dark");
  await page.waitForSelector(".recharts-responsive-container svg", { timeout: 20000 });
  await sleep(1200);
  const bodyBgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("dark body bg gray-950", bodyBgDark === "rgb(3, 7, 18)", bodyBgDark);
  const gridStroke = await page.evaluate(() => {
    const g = document.querySelector(".recharts-cartesian-grid line");
    return g ? getComputedStyle(g).stroke : "NO_GRID";
  });
  check("dark chart grid stroke non-default", /rgba?\(/.test(gridStroke) && !gridStroke.includes("229"), gridStroke);
  const cardBgDark = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("div")].filter((d) => (d as HTMLElement).className.toString().includes("dark:bg-gray-900"));
    const el = cards.find((c) => c.textContent?.includes("Booking volume"));
    return el ? getComputedStyle(el).backgroundColor : "NO_CARD";
  });
  check("dark chart card is gray-900", cardBgDark === "rgb(17, 24, 39)", cardBgDark);
  await page.screenshot({ path: join(SHOT_DIR, "reports-analytics-dark.png"), fullPage: true });

  await browser.close();
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
