import { chromium, type BrowserContext, type Page } from "playwright";
import { config } from "dotenv";
import { resolve, join } from "path";
import { mkdirSync } from "fs";

const ENV_PATH = resolve(__dirname, "../../.env");
config({ path: ENV_PATH });
const { db } = require("../../lib/db");

const BASE_URL = process.env.AUTH_URL || "http://localhost:3002";
const ADMIN_EMAIL = "owner@test.example.com";
const PASSWORD = "test1234";
const SHOT_DIR = join(__dirname, "../../test-screenshots/dark-phases-bcd");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseColor(css: string): { r: number; g: number; b: number; a: number } {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`cannot parse color: ${css}`);
  const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function blend(over: { r: number; g: number; b: number }, col: { r: number; g: number; b: number; a: number }) {
  return {
    r: col.a * col.r + (1 - col.a) * over.r,
    g: col.a * col.g + (1 - col.a) * over.g,
    b: col.a * col.b + (1 - col.a) * over.b,
  };
}

function luminance(c: { r: number; g: number; b: number }) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contrast(txt: { r: number; g: number; b: number; a: number }, bg: { r: number; g: number; b: number; a: number }, pageBg: { r: number; g: number; b: number }) {
  const b = blend(pageBg, bg);
  const t = blend(b, txt);
  const l1 = luminance(t);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
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
  if (!hasSession) throw new Error("sign-in failed");
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
  await sleep(1600);
}

const computed = (page: Page, sel: string, prop: string) =>
  page.evaluate(
    ([s, p]) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el).getPropertyValue(p).trim() : "NO_ELEMENT";
    },
    [sel, prop] as [string, string],
  );

async function pageBg(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function badgeContrast(page: Page, sel: string): Promise<{ text: string; bg: string; ratio: number }> {
  const base = parseColor(await pageBg(page));
  const text = await computed(page, sel, "color");
  const bg = await computed(page, sel, "background-color");
  const ratio = contrast(parseColor(text), parseColor(bg), base);
  return { text, bg, ratio: +ratio.toFixed(2) };
}

async function lightSurfaces(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sels = ["bg-white", "bg-gray-50", "bg-gray-100"];
    const light: string[] = [];
    for (const cls of sels) {
      document.querySelectorAll(`[class*='${cls}']`).forEach((el) => {
        const bg = getComputedStyle(el as HTMLElement).backgroundColor;
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m && +m[1] > 200 && +m[2] > 200 && +m[3] > 200) {
          const cl = (el as HTMLElement).className.toString().slice(0, 70);
          light.push(`${cls} @ <${el.tagName.toLowerCase()} class="${cl}"> -> ${bg}`);
        }
      });
    }
    return light;
  });
}

async function driveToTicket(page: Page, path: string, prefer: "first" | "last" = "last"): Promise<boolean> {
  await goto(page, path);
  const dayClicked = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("button[class*='aspect-square']")] as HTMLButtonElement[];
    const avail = cells.find((b) => !b.disabled);
    if (!avail) return false;
    avail.click();
    return true;
  });
  if (!dayClicked) return false;
  await sleep(600);
  await page.waitForSelector("button[class*='text-left']", { timeout: 10000 }).catch(() => {});
  await sleep(600);
  const slotClicked = await page.evaluate((pref) => {
    const btns = [...document.querySelectorAll("button[class*='text-left']")] as HTMLButtonElement[];
    const slots = btns.filter((b) => !b.disabled && /(AM|PM)/.test(b.innerText));
    const slot = pref === "first" ? slots[0] : slots[slots.length - 1];
    if (!slot) return false;
    slot.click();
    return true;
  }, prefer);
  if (!slotClicked) return false;
  await sleep(500);
  await page.evaluate(() => {
    const cont = [...document.querySelectorAll("button")].find((b) => (b as HTMLElement).innerText.trim() === "Continue") as HTMLButtonElement | undefined;
    cont?.click();
  });
  await sleep(600);
  const filled = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input")] as HTMLInputElement[];
    const name = inputs.find((i) => i.placeholder === "Jane Doe");
    const email = inputs.find((i) => i.placeholder === "jane@email.com");
    if (!name || !email) return false;
    const setVal = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setVal.call(name, "Dark Mode Tester");
    name.dispatchEvent(new Event("input", { bubbles: true }));
    setVal.call(email, "darktester@example.com");
    email.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  });
  if (!filled) return false;
  await sleep(400);
  await page.evaluate(() => {
    const c = [...document.querySelectorAll("button")].find((b) => (b as HTMLElement).innerText.trim() === "Confirm booking") as HTMLButtonElement | undefined;
    c?.click();
  });
  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    const dashed = await page.evaluate(() => !!document.querySelector("[class*='border-dashed']"));
    if (dashed) return true;
  }
  return false;
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });

  const proj = await db.project.findFirst({ where: { status: "active" }, select: { id: true, slug: true } });
  const bookPath = proj?.slug ? `/book/${proj.slug}` : null;
  console.log(`book path: ${bookPath ?? "NONE"}`);

  if (proj) {
    const rangeCount = await db.adminAvailabilityRange.count({ where: { adminId: { in: (await db.projectAdmin.findMany({ where: { projectId: proj.id }, select: { adminId: true } })).map((p: { adminId: string }) => p.adminId) } } });
    if (rangeCount === 0) {
      const pas = await db.projectAdmin.findMany({ where: { projectId: proj.id }, select: { adminId: true } });
      if (pas.length > 0) {
        const futureDate = "2026-08-05";
        for (const pa of pas) {
          await db.adminAvailabilityRange.create({
            data: { adminId: pa.adminId, dateKey: futureDate, startTime: "09:00", endTime: "17:00" },
          });
        }
        console.log(`seeded availability ranges for ${futureDate}`);
      } else {
        console.log("warn: no project admins; cannot seed availability");
      }
    }
  }

  const [templateCount, auditCount] = await Promise.all([db.emailTemplate.count(), db.auditLog.count()]);
  if (templateCount === 0) {
    await db.emailTemplate.create({
      data: {
        category: "admin_invitation",
        audience: "admin",
        subject: "You've been invited",
        bodyHtml: "<p>Hi there.</p>",
        isActive: true,
      },
    });
    console.log("seeded 1 email template (admin audience)");
  }
  if (auditCount === 0) {
    await db.auditLog.create({
      data: {
        action: "booking_cancelled",
        actorType: "admin",
        actorId: null,
        actorLabel: "Test Admin",
        entityType: "booking",
        entityId: "seed-audit-1",
        projectId: null,
      },
    });
    console.log("seeded 1 audit log (booking_cancelled)");
  }

  const removed = await db.booking.deleteMany({ where: { participantEmail: { in: ["darktester@example.com", "darkprobe@example.com"] } } });
  if (removed.count > 0) console.log(`cleaned up ${removed.count} prior dark-test bookings`);

  const confirmed = await db.booking.findFirst({
    where: { status: "confirmed", participantEmail: { not: "darktester@example.com" } },
    select: { id: true },
  });
  const bookingId = confirmed?.id;
  console.log(`confirmed booking id: ${bookingId ?? "NONE"}`);
  const managePath = bookingId ? `/manage/${bookingId}` : null;

  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];
  const check = (ok: boolean, label: string) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) failures.push(label);
  };

  const B_PAGES = [
    { path: "/admin/dashboard", label: "dashboard", badgeSel: "[class*='bg-emerald-100']" },
    { path: "/admin/projects", label: "projects", badgeSel: "[class*='bg-emerald-100']" },
    { path: "/admin/my-availability", label: "my-availability" },
  ];
  const C_PAGES = [
    { path: "/admin/templates", label: "templates", badgeSel: "[class*='bg-purple-100']" },
    { path: "/admin/audit", label: "audit", badgeSel: "[class*='bg-red-100']" },
    { path: "/admin/bulk-reschedule", label: "bulk-reschedule" },
  ];
  const D_PAGES = [
    { path: "/", label: "landing" },
    { path: "/auth/signin", label: "signin" },
  ];
  if (bookPath) D_PAGES.push({ path: bookPath, label: "book" });
  if (managePath) D_PAGES.push({ path: managePath, label: "manage-ticket" });

  console.log("=== LIGHT (regression screenshots) ===");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
    const page = await ctx.newPage();
    await signIn(ctx, page);
    for (const p of [...B_PAGES, ...C_PAGES]) {
      await goto(page, p.path);
      await page.screenshot({ path: join(SHOT_DIR, `light-${p.label}.png`), fullPage: true });
    }
    for (const p of D_PAGES) {
      await goto(page, p.path);
      await page.screenshot({ path: join(SHOT_DIR, `light-${p.label}.png`), fullPage: true });
    }
    if (bookPath) {
      const lightTicket = await driveToTicket(page, bookPath, "first");
      if (lightTicket) await page.screenshot({ path: join(SHOT_DIR, "light-book-ticket.png"), fullPage: true });
      else console.log("  (warn) light booking ticket not captured");
    }
    await ctx.close();
  }

  const runAdmin = async (phase: string, pages: { path: string; label: string; badgeSel?: string }[]) => {
    console.log(`=== DARK: ${phase} ===`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
    await ctx.addInitScript(() => localStorage.setItem("theme", "dark"));
    const page = await ctx.newPage();
    await signIn(ctx, page);
    for (const p of pages) {
      await goto(page, p.path);
      const body = await pageBg(page);
      check(body === "rgb(3, 7, 18)", `${p.label}: body bg dark (${body})`);
      const light = await lightSurfaces(page);
      check(light.length === 0, `${p.label}: no light surfaces (${light.length}${light[0] ? `: ${light[0]}` : ""})`);
      if (p.badgeSel) {
        const b = await badgeContrast(page, p.badgeSel);
        check(b.ratio >= 4, `${p.label}: badge contrast ${b.ratio} (text=${b.text} bg=${b.bg})`);
      }
      await page.screenshot({ path: join(SHOT_DIR, `dark-${p.label}.png`), fullPage: true });
    }
    await ctx.close();
  };

  await runAdmin("Phase B", B_PAGES);
  await runAdmin("Phase C", C_PAGES);

  console.log("=== DARK: Phase D ===");
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
    await ctx.addInitScript(() => localStorage.setItem("theme", "dark"));
    const page = await ctx.newPage();

    for (const p of D_PAGES) {
      await goto(page, p.path);
      const body = await pageBg(page);
      check(body === "rgb(3, 7, 18)", `${p.label}: body bg dark (${body})`);
      const light = await lightSurfaces(page);
      check(light.length === 0, `${p.label}: no light surfaces (${light.length}${light[0] ? `: ${light[0]}` : ""})`);
      if (p.label === "signin") {
        const headerBg = await computed(page, "header", "background-color");
        check(headerBg === "rgb(17, 24, 39)", `signin: header bg dark (${headerBg})`);
        const inputBg = await computed(page, "main input, form input", "background-color");
        check(inputBg === "rgb(31, 41, 55)", `signin: input bg dark (${inputBg})`);
      }
      await page.screenshot({ path: join(SHOT_DIR, `dark-${p.label}.png`), fullPage: true });
    }
    if (bookPath) {
      const ticket = await driveToTicket(page, bookPath);
      check(ticket, "book: confirmation ticket (dashed) present in dark");
      if (ticket) await page.screenshot({ path: join(SHOT_DIR, "dark-book-ticket.png"), fullPage: true });
    }
    await ctx.close();
  }

  await browser.close();

  if (failures.length) {
    console.error(`\nFAILED (${failures.length}):`);
    failures.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  console.log("\nALL PHASES B/C/D PASS");
}

main()
  .catch((e) => {
    console.error("FAIL:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
