import { createRequire } from "node:module";

// Resolve playwright from the npx cache
const require = createRequire(
  "/Users/agam/.npm/_npx/fd3bca3c548369c0/node_modules/playwright/index.mjs"
);

// Dynamic import from the known npx cache location
const { chromium } = await import(
  "/Users/agam/.npm/_npx/fd3bca3c548369c0/node_modules/playwright/index.mjs"
);

const SCREENSHOT_PATH =
  "/Users/agam/dev/CentralTauri/.a5c/runs/artifacts/phase-1-screenshot.png";

async function takeScreenshot() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  await page.goto("http://localhost:1420", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  // Wait a bit for any CSS transitions/animations
  await page.waitForTimeout(1000);

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`Screenshot saved to ${SCREENSHOT_PATH}`);

  await browser.close();
}

takeScreenshot().catch((err) => {
  console.error("Screenshot failed:", err.message);
  process.exit(1);
});
