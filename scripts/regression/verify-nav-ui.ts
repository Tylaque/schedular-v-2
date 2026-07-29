import { chromium } from "playwright";
import { config } from "dotenv";
import { resolve, join } from "path";

const ENV_PATH = resolve(__dirname, "../../.env");
config({ path: ENV_PATH });

const BASE_URL = process.env.AUTH_URL || "http://localhost:3002";
const ADMIN_EMAIL = "test@test.example.com";
const ADMIN_PASSWORD = "test1234";
const SCREENSHOT_DIR = join(__dirname, "screenshots");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    bypassCSP: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];

  page.on("pageerror", (e) => errors.push(e.message));

  try {
    // ---- Sign in via form submission ----
    await page.goto(`${BASE_URL}/auth/signin`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await sleep(1000);

    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASSWORD);
    await page.locator("form:has(#email) button[type=submit]").click();
    await sleep(5000);

    if (!page.url().includes("/admin/my-area")) {
      throw new Error(`Sign-in failed. URL: ${page.url()}`);
    }

    // ---- Warm up the availability route (avoids slow first-load) ----
    await page.goto(`${BASE_URL}/admin/my-availability`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await sleep(1000);
    // Return to my-area
    await page.goto(`${BASE_URL}/admin/my-area`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await sleep(1000);

    // ---- Bug 1: Mobile hamburger nested-link navigation ----
    const hamburger = page.locator("button").filter({
      has: page.locator("svg.lucide-menu"),
    });
    await hamburger.first().click({ force: true });
    await sleep(1000);

    // Expand sidebar sub-group
    const expanded = await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>(
        '[class*="fixed"][class*="inset-0"][class*="z-50"]'
      );
      if (!sidebar) return "no-sidebar";
      const buttons = sidebar.querySelectorAll("button");
      for (const b of buttons) {
        if (b.textContent?.includes("Availability")) {
          b.click();
          return "clicked";
        }
      }
      return "no-button";
    });

    await sleep(500);

    // Verify the My Availability link is in the DOM and click it
    const linkFound = await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>(
        '[class*="fixed"][class*="inset-0"][class*="z-50"]'
      );
      if (!sidebar) return "no-sidebar-after";
      const links = sidebar.querySelectorAll("a");
      for (const l of links) {
        if (l.textContent?.trim() === "My Availability") {
          console.log("[PIN] Found My Availability link, href:", l.getAttribute("href"));
          console.log("[PIN] Link rect:", JSON.stringify(l.getBoundingClientRect()));
          // Dispatch a native click that will be handled by the Link component
          l.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          return `clicked-${l.getAttribute("href")}`;
        }
      }
      return `no-link-found-${Array.from(links).map(l => l.textContent?.trim()).join(",")}`;
    });
    console.log("Link action:", linkFound);

    await sleep(3000);
    console.log("URL after click:", page.url());

    if (!page.url().includes("/admin/my-availability")) {
      throw new Error(
        `Navigation bug: URL did not change to /admin/my-availability (stuck at ${page.url()}, link action: ${linkFound})`
      );
    }

    // ---- Bug 2: Account dropdown offscreen ----
    // Switch to desktop viewport first, then navigate fresh
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/admin/my-area`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await sleep(3000);

    // Find the account button (the one with the user avatar, last visible button in sidebar)
    const accountDebug = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      for (const b of buttons) {
        if (b.textContent?.trim().includes("Test Admin")) {
          return {
            text: b.textContent?.trim(),
            hasChevronSvg: b.querySelector("svg.lucide-chevron-down") !== null,
            fullHtml: b.innerHTML,
            rect: b.getBoundingClientRect(),
          };
        }
      }
      return null;
    });
    if (!accountDebug) {
      throw new Error("Account button with 'Test Admin' text not found");
    }

    // Click the account button
    await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      for (const b of buttons) {
        if (b.textContent?.trim().includes("Test Admin")) {
          b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          break;
        }
      }
    });

    // Wait for dropdown to appear
    try {
      await page.waitForSelector("div.fixed.z-\\[100\\]", { timeout: 5000 });
    } catch {
      throw new Error("Dropdown did not appear after clicking account button");
    }
    await sleep(500);

    const dropdownRect = await page.evaluate(() => {
      const dropdown = document.querySelector<HTMLElement>("div.fixed.z-\\[100\\]");
      if (!dropdown) return null;
      const r = dropdown.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height,
        fullyVisible:
          r.left >= 0 &&
          r.top >= 0 &&
          r.bottom <= window.innerHeight &&
          r.right <= window.innerWidth,
      };
    });

    if (!dropdownRect || !dropdownRect.fullyVisible) {
      throw new Error(
        `Dropdown offscreen/not found: ${JSON.stringify(dropdownRect)}`
      );
    }

    // ---- Sign out ----
    const signOutBtn = page.locator("button", { hasText: "Sign out" });
    await signOutBtn.first().click({ force: true });
    await sleep(3000);

    if (page.url().includes("/admin/")) {
      throw new Error(`Sign-out failed: ${page.url()}`);
    }

    if (errors.length > 0) {
      console.warn("Page errors:", errors.join("; "));
    }
    console.log("OK");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
