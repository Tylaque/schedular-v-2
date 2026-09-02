import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3110";
const OUT = "test-screenshots/eureka-landing";
mkdirSync(OUT, { recursive: true });

const results = [];

async function checkDevOverlay(ctx, url) {
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 45000 });
  const overlay = await p2.evaluate(() => ({
    portal: !!document.querySelector("nextjs-portal"),
    devScript: !!document.querySelector('script[data-nextjs-dev-overlay="true"]'),
    bodyTextHasScheduler: document.body.innerText.includes("Scheduler"),
  }));
  await p2.close();
  await ctx.close();
  return overlay;
}

const browser = await chromium.launch({ headless: true });

async function home(colorScheme) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme });
  const page = await ctx.newPage();
  const resp = await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 45000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  const audit = await page.evaluate(() => {
    const headerLinks = [...document.querySelectorAll("header a")].map((a) => a.textContent.trim());
    return {
      scrollY: window.scrollY,
      headerLinks,
      bodyHasScheduler: document.body.innerText.includes("Scheduler"),
      buttonColors: [...document.querySelectorAll("a.bg-accent-600")].map((a) => getComputedStyle(a).backgroundColor),
      eyebrowColors: [...document.querySelectorAll("p")].filter((p) => p.className?.toString().includes("uppercase")).map((p) => getComputedStyle(p).color),
      logoColors: [...document.querySelectorAll("div.bg-accent-600")].slice(0, 2).map((d) => getComputedStyle(d).backgroundColor),
    };
  });
  const file = `${OUT}/${colorScheme === "light" ? "01-home-light" : "02-home-dark"}.png`;
  await page.screenshot({ path: file, fullPage: true });
  const title = await page.title();
  console.log(`OK ${resp.status()} / ${colorScheme} -> ${file} [${title}]`);
  Results(results, { url: "/", mode: colorScheme, status: resp.status(), audit });
  await ctx.close();
}

function Results(arr, o) {
  arr.push(o);
}

await home("light");
await home("dark");

const legal = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const lp = await legal.newPage();
const lres = await lp.goto(`${BASE}/legal/privacy-notice`, { waitUntil: "load", timeout: 45000 });
await lp.evaluate(() => window.scrollTo(0, 0));
await lp.waitForTimeout(500);
const legalText = await lp.locator("body").innerText();
await lp.screenshot({ path: `${OUT}/03-legal-draft-marker.png`, fullPage: true });
console.log(`OK ${lres.status()} /legal/privacy-notice -> 03-legal-draft-marker.png marker=${legalText.includes("DRAFT — NOT LEGAL ADVICE")}`);
results.push({
  url: "/legal/privacy-notice", mode: "light", status: lres.status(),
  marker: legalText.includes("DRAFT — NOT LEGAL ADVICE"),
  logoColor: await lp.evaluate(() => getComputedStyle(document.querySelector("div.bg-accent-600")).backgroundColor),
});
await legal.close();

const demo = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const dp = await demo.newPage();
const dres = await dp.goto(`${BASE}/book/senior-pm-interview`, { waitUntil: "networkidle", timeout: 45000 });
await dp.evaluate(() => window.scrollTo(0, 0));
await dp.waitForTimeout(1200);
const demoBody = await dp.locator("body").innerText();
await dp.screenshot({ path: `${OUT}/04-demo-booking.png`, fullPage: true });
console.log(`OK ${dres.status()} /book/senior-pm-interview -> 04-demo-booking.png h1=${(await dp.locator("h1").first().textContent().catch(() => "")).trim()}`);
results.push({
  url: "/book/senior-pm-interview", mode: "light", status: dres.status(),
  bodyHasScheduler: demoBody.includes("Scheduler"),
  bodyHasEureka: demoBody.includes("Eureka"),
  descriptionLine: demoBody.split("\n").find((l) => l.includes("public demo")) ?? null,
});
await demo.close();

const overlayLight = await checkDevOverlay(await browser.newContext({}), "/");
console.log("dev-overlay markers present (prod server):", JSON.stringify(overlayLight));
results.push({ check: "dev-overlay", ...overlayLight });

await browser.close();
console.log("\n=== evidence ===");
console.log(JSON.stringify(results, null, 2));