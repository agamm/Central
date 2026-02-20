import { chromium } from '/Users/agam/.npm/_npx/fd3bca3c548369c0/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:1420', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/agam/dev/CentralTauri/.a5c/runs/artifacts/phase-3-screenshot.png' });
await browser.close();
console.log('Screenshot saved');
