import { chromium, type BrowserContext, type Page } from "playwright";
import { config } from "dotenv";
import { resolve, join } from "path";
import { mkdirSync } from "fs";

const ENV_PATH = resolve(__dirname, "../../.env");
config({ path: ENV_PATH });

const BASE_URL = process.env.AUTH_URL || "http://localhost:3002";
const ADMIN_EMAIL = "test@test.example.com";
const PASSWORD = "test1234";
const SHOT_DIR = join(__dirname, "../../test-screenshots/dark-infra");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hasDark(page: Page) {
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

async function storedTheme(page: Page) {
  return page.evaluate(() => localStorage.getItem("theme"));
}

async function bodyBg(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function installClassRecorder(ctx: BrowserContext, stored?: string) {
  const js = `
    (function (stored) {
      try {
        if (stored) localStorage.setItem("theme", stored);
        var snaps = (window.__classSnapshots = []);
        var last = null;
        function rec() {
          var de = document.documentElement;
          if (!de) return;
          var key = de.className;
          if (last !== key) {
            last = key;
            snaps.push({ t: Math.round(performance.now()), dark: de.classList.contains("dark") });
          }
        }
        rec();
        if (document.documentElement) {
          new MutationObserver(rec).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        }
        var iv = setInterval(rec, 10);
        window.addEventListener("load", function () { clearInterval(iv); });
      } catch (e) {
        window.__recorderError = String(e);
      }
    })(${stored ? JSON.stringify(stored) : "null"});
  `;
  await ctx.addInitScript(js);
}

async function snapshots(page: Page): Promise<Array<{ t: number; dark: boolean }>> {
  return page.evaluate(() => (window as any).__classSnapshots ?? []);
}

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
  await page.goto(`${BASE_URL}/admin/projects`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForURL((u: URL) => u.toString().includes("/admin"), { timeout: 30000 });
  await sleep(1500);
}

function analyzeSnapshots(snaps: Array<{ t: number; dark: boolean }>) {
  const first = snaps[0];
  let sawLightAfterDark = false;
  let sawDark = false;
  for (const s of snaps) {
    if (s.dark) sawDark = true;
    if (sawDark && !s.dark) sawLightAfterDark = true;
  }
  const flashBack = sawDark && sawLightAfterDark;
  return { firstDark: first?.dark ?? false, darkEverApplied: sawDark, flashBack };
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // ============ Phase 1: explicit dark, NO FLASH ============
  console.log("=== Phase 1: explicit dark + no-flash ===");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
    await installClassRecorder(ctx, "dark");
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: "load", timeout: 30000 });
    const snaps = await snapshots(page);
    const a = analyzeSnapshots(snaps);
    console.log("  snapshots:", JSON.stringify(snaps));
    console.log("  first observed dark:", a.firstDark);
    console.log("  dark ever applied:", a.darkEverApplied);
    console.log("  flash-back to light after dark:", a.flashBack);
    const darkAtIdle = await hasDark(page);
    const bg = await bodyBg(page);
    console.log("  html.dark after hydration+idle:", darkAtIdle);
    console.log("  body background (dark should be rgb(3,7,18)):", bg);
    await page.screenshot({ path: join(SHOT_DIR, "01-landing-dark.png"), fullPage: true });
    if (!a.darkEverApplied || a.flashBack || !darkAtIdle) throw new Error("dark flash test failed");
    if (bg !== "rgb(3, 7, 18)") throw new Error(`body bg not dark: ${bg}`);
    console.log("  Phase 1 PASS");
    await ctx.close();
  }

  // ============ Phase 2: system matches OS + toggle + persistence ============
  console.log("=== Phase 2: system default matches OS dark ===");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", bypassCSP: true });
    await installClassRecorder(ctx); // no stored theme -> system
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: "load", timeout: 30000 });
    const sysDark = await hasDark(page);
    console.log("  OS=dark, theme=system -> html.dark:", sysDark);
    await page.screenshot({ path: join(SHOT_DIR, "02-landing-system-dark.png"), fullPage: true });
    if (!sysDark) throw new Error("system did not follow OS=dark");

    console.log("=== Phase 2b: toggle light -> dark -> system ===");
    const toggle = page.locator('button[aria-label^="Theme:"]');
    const toggleCount = await toggle.count();
    console.log("  ThemeToggle present on landing:", toggleCount > 0);
    if (toggleCount === 0) throw new Error("toggle missing on landing");

    await toggle.click(); // -> light
    await sleep(400);
    console.log("  after 1st click (->light): dark =", await hasDark(page), "| stored =", await storedTheme(page));
    await page.screenshot({ path: join(SHOT_DIR, "03-landing-light.png"), fullPage: true });

    await toggle.click(); // -> dark
    await sleep(400);
    console.log("  after 2nd click (->dark): dark =", await hasDark(page), "| stored =", await storedTheme(page));

    console.log("=== Phase 2c: reload with stored dark, verify NO FLASH ===");
    await page.reload({ waitUntil: "load", timeout: 30000 });
    const snaps2 = await snapshots(page);
    const b = analyzeSnapshots(snaps2);
    console.log("  reload snapshots:", JSON.stringify(snaps2));
    console.log("  flash-back after reload:", b.flashBack, "| dark at idle:", await hasDark(page));
    if (b.flashBack) throw new Error("flash back on reload with stored dark");

    await toggle.click(); // -> system (clears stored)
    await sleep(400);
    console.log("  after 3rd click (->system): dark =", await hasDark(page), "| stored =", await storedTheme(page));

    console.log("=== Phase 2d: live OS change while on system ===");
    await page.emulateMedia({ colorScheme: "light" });
    await sleep(600);
    const sysLight = await hasDark(page);
    console.log("  OS switched to light on system theme -> html.dark:", sysLight);
    await page.emulateMedia({ colorScheme: "dark" });
    await sleep(600);
    const sysDarkAgain = await hasDark(page);
    console.log("  OS switched back to dark -> html.dark:", sysDarkAgain);
    if (sysLight || !sysDarkAgain) throw new Error("system theme did not react to live OS change");
    console.log("  Phase 2 PASS");
    await ctx.close();
  }

  // ============ Phase 3: toggle inside AccountMenu (authenticated) ============
  console.log("=== Phase 3: AccountMenu ThemeToggle (authenticated) ===");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
    const page = await ctx.newPage();
    await signIn(ctx, page);
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Wait for session to hydrate the account button, then open the dropdown
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Test Admin")),
      { timeout: 20000 },
    );
    await sleep(500);
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
    const menuToggle = await page.locator("text=Theme").count();
    console.log("  AccountMenu 'Theme' row visible:", menuToggle > 0);
    const menuToggleBtn = await page.locator('button[aria-label^="Theme:"]').count();
    console.log("  AccountMenu ThemeToggle button visible:", menuToggleBtn > 0);
    await page.screenshot({ path: join(SHOT_DIR, "04-account-menu-toggle.png") });
    if (menuToggle === 0 || menuToggleBtn === 0) throw new Error("AccountMenu Theme toggle missing");
    console.log("  Phase 3 PASS");
    await ctx.close();
  }

  await browser.close();
  console.log("OK");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
