import { chromium } from "playwright";

const BASE = "http://localhost:3110";

const browser = await chromium.launch({ headless: true });

async function audit(path, colorScheme) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(800);
  const audit = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      horizontalOverflow: doc.scrollWidth - doc.clientWidth,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      headingCount: document.querySelectorAll("h1, h2, h3").length,
      navLinks: [...document.querySelectorAll("header a")].map((a) => a.textContent?.trim()),
      sectionIds: [...document.querySelectorAll("section[id]")].map((s) => s.id),
      brandText: document.body.innerText.includes("Eureka"),
      schedulerRemnant: document.body.innerText.includes("Scheduler"),
      buttons: [...document.querySelectorAll("a, button")].map((a) => a.textContent?.trim()).filter(Boolean),
    };
  });
  audit.colorScheme = colorScheme;
  audit.bodyTextLength = (await page.locator("body").innerText()).length;
  await ctx.close();
  return audit;
}

console.log("HOME LIGHT:", JSON.stringify(await audit("/", "light"), null, 2));
console.log("HOME DARK:", JSON.stringify(await audit("/", "dark"), null, 2));

const legalCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const lp = await legalCtx.newPage();
await lp.goto(`${BASE}/legal/data-processing-addendum`, { waitUntil: "load" });
console.log("LEGAL PAGE:", JSON.stringify(await lp.evaluate(() => ({
  h1: document.querySelector("h1")?.textContent?.trim(),
  marker: document.body.innerText.includes("DRAFT — NOT LEGAL ADVICE"),
  backLink: [...document.querySelectorAll("a")].map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
})) , null, 2));

await browser.close();