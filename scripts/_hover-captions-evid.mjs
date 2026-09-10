import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";
import pg from "pg";

const BASE = "http://localhost:3110";
const ADMIN_EMAIL = "bt-79350834@phase.test";
const ADMIN_PASS = "ScratchTest1234!";
const TEMPLATE_ID = "cmtaxepxo0001fwvkqc482nzg";
const scratch = readFileSync("C:/Users/mwebi/AppData/Local/Temp/opencode/scratch-url-clean.txt", "utf8").trim();
const OUT = "test-screenshots/hover-captions";
mkdirSync(OUT, { recursive: true });
const db = new pg.Client({ connectionString: scratch });

async function loginViaFetch() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { cache: "no-store" });
  const csrf = await csrfRes.json();
  const cookieString = (csrfRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieString },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: ADMIN_EMAIL, password: ADMIN_PASS, json: "true" }).toString(),
    redirect: "manual",
  });
  const session = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("authjs.session-token="));
  if (!session) throw new Error("login failed");
  return session.split(";")[0];
}

await db.connect().catch(() => {});
await db.query(`UPDATE "Admin" SET role='admin' WHERE email=$1`, [ADMIN_EMAIL]);
const session = await loginViaFetch();
await db.query(`UPDATE "Admin" SET role='super_admin' WHERE email=$1`, [ADMIN_EMAIL]);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 2800 } });
await context.addCookies([{ name: "authjs.session-token", value: session.split("=")[1], domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
const page = await context.newPage();

await page.goto(`${BASE}/admin/my-area`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.goto(`${BASE}/admin/templates/${TEMPLATE_ID}/edit`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const simpleBtn = page.locator('button:has-text("Simple")');
if (await simpleBtn.count()) await simpleBtn.first().click();
await page.waitForTimeout(1200);

// Add a heading block (React state only; never saved)
await page.click('button:has-text("Add block")');
await page.waitForTimeout(400);
await page.click('button:has-text("Heading")');
await page.waitForTimeout(1000);

const captionOpacity = (text) => page.evaluate((t) => {
  const el = [...document.querySelectorAll("span,div,p")].find((e) => e.textContent.trim() === t);
  if (!el) return null;
  return { opacity: getComputedStyle(el).opacity, visible: getComputedStyle(el).opacity !== "0" };
}, text);

async function moveMouseAway() { await page.mouse.move(8, 8); await page.waitForTimeout(400); }

// ===== HEADING block =====
const headingCardIdx = await page.evaluate(() =>
  [...document.querySelectorAll("div.group")].findIndex((c) => [...c.querySelectorAll("span,div,p")].some((e) => e.textContent.trim() === "Heading text"))
);
console.log("heading card index:", headingCardIdx);

const headingCard = page.locator("div.group").nth(headingCardIdx);

// State A: default (no hover/focus)
await moveMouseAway();
await page.waitForTimeout(200);
console.log("HEADING default caption opacity:", JSON.stringify(await captionOpacity("Heading text")));
await page.screenshot({ path: `${OUT}/heading-01-default.png` });

// State B: focus the field WITHOUT hovering (focus-within, not hover)
await page.evaluate((idx) => {
  const card = [...document.querySelectorAll("div.group")][idx];
  const editable = card.querySelector('[contenteditable="true"]');
  editable?.focus();
}, headingCardIdx);
await page.waitForTimeout(400);
await moveMouseAway(); // mouse outside card; focus remains on field
const hoverCard = await headingCard.evaluate((el, p) => {
  const r = el.getBoundingClientRect(); const h = Math.floor(r.height);
  return !(p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.top + h);
}, { x: 8, y: 8 });
console.log("HEADING focus state — mouse outside card:", hoverCard, "caption opacity:", JSON.stringify(await captionOpacity("Heading text")));
await page.screenshot({ path: `${OUT}/heading-02-focus.png` });

// State C: hover (no focus)
await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(300);
const box = await headingCard.boundingBox();
if (box) { await page.mouse.move(box.x + box.width / 2, box.y + 30); await page.waitForTimeout(500); }
console.log("HEADING hover caption opacity:", JSON.stringify(await captionOpacity("Heading text")));
await page.screenshot({ path: `${OUT}/heading-03-hover.png` });
await page.evaluate(() => document.activeElement?.blur());

// ===== DETAILS CARD block (structured type) =====
const cardIdx = await page.evaluate(() =>
  [...document.querySelectorAll("div.group")].findIndex((c) => [...c.querySelectorAll("span,div,p")].some((e) => e.textContent.trim() === "Title (bold)"))
);
console.log("details-card index:", cardIdx);
const cardEl = page.locator("div.group").nth(cardIdx);

await moveMouseAway();
await page.waitForTimeout(200);
console.log("CARD default 'Title (bold)' opacity:", JSON.stringify(await captionOpacity("Title (bold)")));
await page.screenshot({ path: `${OUT}/card-01-default.png` });

await page.evaluate((idx) => {
  const card = [...document.querySelectorAll("div.group")][idx];
  const editable = card.querySelector('[contenteditable="true"]');
  editable?.focus();
}, cardIdx);
await page.waitForTimeout(400);
await moveMouseAway();
console.log("CARD focus 'Title (bold)' opacity:", JSON.stringify(await captionOpacity("Title (bold)")));
await page.screenshot({ path: `${OUT}/card-02-focus.png` });

await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(300);
const cbox = await cardEl.boundingBox();
if (cbox) { await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + 40); await page.waitForTimeout(500); }
console.log("CARD hover 'Title (bold)' opacity:", JSON.stringify(await captionOpacity("Title (bold)")));
await page.screenshot({ path: `${OUT}/card-03-hover.png` });
await page.evaluate(() => document.activeElement?.blur()); await moveMouseAway();

// ===== Shared toolbar unaffected =====
const toolbarAudit = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll("div")).find((d) => /^Insert token:/i.test((d.childNodes[0]?.textContent || "").trim()));
  if (!el) return { toolbar: false };
  const label = [...el.querySelectorAll("span")].find((s) => s.textContent.trim() === "Insert token:");
  return { toolbar: true, insertLabelVisible: label ? getComputedStyle(label).opacity : "n/a", buttons: el.querySelectorAll("button").length };
});
console.log("toolbar audit:", JSON.stringify(toolbarAudit));

// ===== cleanup: remove added heading block (unsaved) =====
await page.evaluate(() => document.activeElement?.blur());
const headingBtn = page.locator("div.group").nth(headingCardIdx);
await headingBtn.hover();
await page.waitForTimeout(400);
await headingBtn.locator('button[title="Remove block"]').first().click();
await page.waitForTimeout(600);
console.log("heading removed (unsaved):", await page.evaluate(() => ![...document.querySelectorAll("div.group")].some((c) => [...c.querySelectorAll("span,div,p")].some((e) => e.textContent.trim() === "Heading text"))));

await browser.close();
await db.end().catch(() => {});
console.log("DONE");