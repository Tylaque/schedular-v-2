import { chromium, type BrowserContext, type Page } from "playwright";
import { config } from "dotenv";
import { resolve, join } from "path";
import { mkdirSync } from "fs";

const ENV_PATH = resolve(__dirname, "../../.env");
config({ path: ENV_PATH });

const BASE_URL = process.env.AUTH_URL || "http://localhost:3002";
const ADMIN_EMAIL = "test@test.example.com";
const PASSWORD = "test1234";
const SHOT_DIR = join(__dirname, "../../test-screenshots/dark-phase-a");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signIn(ctx: BrowserContext, page: Page) {
  const csrfRes = await ctx.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  if (!csrfToken) throw new Error("No CSRF token");
  await ctx.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: { csrfToken, email: ADMIN_EMAIL, password: PASSWORD, json: "true" },
  });
  const cookies = await ctx.cookies();
  const hasSession = cookies.some((c: any) => c.name === "authjs.session-token");
  console.log(`  sign-in: session cookie = ${hasSession}`);
  if (!hasSession) throw new Error("sign-in failed");
  await page.goto(`${BASE_URL}/admin/projects`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForURL((u: URL) => u.toString().includes("/admin"), { timeout: 30000 });
  await sleep(2000);
}

async function openAccountMenu(page: Page) {
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Test Admin")),
    { timeout: 20000 },
  );
  await sleep(400);
  await page.evaluate(() => {
    const buttons = document.querySelectorAll("button");
    for (const b of buttons) {
      if (b.textContent?.includes("Test Admin")) {
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        break;
      }
    }
  });
  await sleep(800);
}

async function bgOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).backgroundColor : "NO_ELEMENT";
  }, selector);
}

async function colorOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).color : "NO_ELEMENT";
  }, selector);
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  console.log("=== Phase A LIGHT ===");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
    const page = await ctx.newPage();
    await signIn(ctx, page);
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("aside, nav", { timeout: 20000 });
    await sleep(1500);
    await page.screenshot({ path: join(SHOT_DIR, "01-admin-dashboard-light.png"), fullPage: true });
    await openAccountMenu(page);
    await page.screenshot({ path: join(SHOT_DIR, "02-account-menu-light.png") });
    await ctx.close();
  }

  console.log("=== Phase A DARK ===");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
    await ctx.addInitScript(() => localStorage.setItem("theme", "dark"));
    const page = await ctx.newPage();
    await signIn(ctx, page);
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("nav", { timeout: 20000 });
    await sleep(1500);

    const sidebarBg = await bgOf(page, ".lg\\:fixed");
    const navText = await colorOf(page, "nav .rounded-lg");
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    console.log("  sidebar bg:", sidebarBg, "(expect rgb(17,24,39) gray-900)");
    console.log("  sidebar nav text:", navText, "(expect light gray 400/100)");
    console.log("  body bg:", bodyBg, "(expect rgb(3,7,18) gray-950)");
    await page.screenshot({ path: join(SHOT_DIR, "03-admin-dashboard-dark.png"), fullPage: true });

    await openAccountMenu(page);
    const panelBg = await bgOf(page, ".fixed.w-64");
    const nameEl = page.locator(".fixed.w-64 p.font-semibold").first();
    const panelNameColor = await nameEl.evaluate((el) => getComputedStyle(el as HTMLElement).color);
    console.log("  account menu panel bg:", panelBg, "(expect gray-900)");
    console.log("  account menu name color:", panelNameColor, "(expect gray-50)");
    await page.screenshot({ path: join(SHOT_DIR, "04-account-menu-dark.png") });

    // Landing header in dark
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("header", { timeout: 20000 });
    const landingHeaderBg = await bgOf(page, "header");
    console.log("  landing header bg:", landingHeaderBg, "(expect gray-900)");
    await page.screenshot({ path: join(SHOT_DIR, "05-landing-header-dark.png") });

    if (sidebarBg !== "rgb(17, 24, 39)") throw new Error(`sidebar not dark: ${sidebarBg}`);
    if (bodyBg !== "rgb(3, 7, 18)") throw new Error(`body bg not dark: ${bodyBg}`);
    if (panelBg !== "rgb(17, 24, 39)") throw new Error(`account panel not dark: ${panelBg}`);
    if (landingHeaderBg !== "rgb(17, 24, 39)") throw new Error(`landing header not dark: ${landingHeaderBg}`);
    if (!panelNameColor || panelNameColor === "rgb(17, 24, 39)") {
      throw new Error(`account name not legible: ${panelNameColor}`);
    }
    console.log("  Phase A PASS");
    await ctx.close();
  }

  await browser.close();
  console.log("OK");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
