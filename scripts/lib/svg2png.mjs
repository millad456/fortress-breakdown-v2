// Render an SVG string to PNG with Playwright (system Chrome if present).
import { chromium } from 'playwright';
export async function svgToPng(svg, out, w = 1600, h = 1200) {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
  await page.screenshot({ path: out });
  await browser.close();
}
