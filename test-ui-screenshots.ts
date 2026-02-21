/**
 * Playwright script to take screenshots of the CentralTauri UI.
 * Run: npx playwright test test-ui-screenshots.ts --headed
 * Or: npx tsx test-ui-screenshots.ts
 */
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  console.log("Navigating to localhost:1420...");
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000); // Let the app bootstrap

  // Screenshot 1: Full app view
  await page.screenshot({ path: "/tmp/central-ui-full.png", fullPage: false });
  console.log("Saved: /tmp/central-ui-full.png");

  // Screenshot 2: Narrow sidebar view (resize to see sidebar compactness)
  await page.setViewportSize({ width: 700, height: 800 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/central-ui-narrow.png", fullPage: false });
  console.log("Saved: /tmp/central-ui-narrow.png");

  // Screenshot 3: Very narrow (sidebar stress test)
  await page.setViewportSize({ width: 500, height: 800 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/central-ui-very-narrow.png", fullPage: false });
  console.log("Saved: /tmp/central-ui-very-narrow.png");

  // Reset to normal width
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.waitForTimeout(500);

  // Try to click on a session if one exists
  const sessionItem = page.locator('[role="button"]').first();
  if (await sessionItem.isVisible()) {
    await sessionItem.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "/tmp/central-ui-session.png", fullPage: false });
    console.log("Saved: /tmp/central-ui-session.png");
  }

  await browser.close();
  console.log("Done! Screenshots saved to /tmp/central-ui-*.png");
}

main().catch(console.error);
