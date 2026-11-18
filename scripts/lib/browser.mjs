// Headless browser helpers for screenshots: system Chrome with SwiftShader WebGL, falling back to Chromium.
import { chromium } from 'playwright';

const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-webgl'];

export async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome', args: ARGS });
  } catch {
    return chromium.launch({ args: ARGS });
  }
}

/** Open the viewer, wait for the world, skip the intro. Collects console issues. */
export async function openViewer(browser, url, { width = 1600, height = 900 } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const issues = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') issues.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => issues.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) => {
    // photos are lazy and live; a cancelled image load on navigation is not an issue
    if (!/upload\.wikimedia|commons\.wikimedia|fonts\./.test(r.url())) issues.push('[requestfailed] ' + r.url());
  });
  await page.goto(url);
  try {
    await page.waitForFunction(() => window.__fb && window.__fb.world, null, { timeout: +(process.env.WAIT || 180000) });
  } catch (e) {
    console.log('Viewer did not load. Console:\n' + issues.join('\n'));
    throw e;
  }
  await page.evaluate(() => window.__fb.ui?.skipIntro?.());
  return { page, issues };
}

/** Render a few frames (headless WebGL is slow; we pose directly instead of animating). */
export async function settle(page, frames = 3) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  }, frames);
}
