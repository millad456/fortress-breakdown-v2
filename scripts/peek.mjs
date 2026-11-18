// Dev tool: screenshot the viewer at one or more poses.
//   node scripts/peek.mjs name '{"pos":[..],"target":[..]}' [hour] [js-to-eval]
import { launch, openViewer, settle } from './lib/browser.mjs';

const base = process.env.URL || 'http://localhost:5173/#/dubrovnik';
const [name = 'peek', poseJson, hour, js] = process.argv.slice(2);
const browser = await launch();
const { page, issues } = await openViewer(browser, base, { width: +(process.env.W || 1600), height: +(process.env.H || 900) });
const t = await page.evaluate(() => window.__fb.buildMs);
console.log('build ms', t);
if (poseJson) await page.evaluate((p) => window.__fb.engine.setPose(JSON.parse(p)), poseJson);
if (hour) await page.evaluate((h) => window.__fb.engine.setTime(+h), hour);
if (js) console.log(await page.evaluate(js));
await settle(page, 4);
await page.screenshot({ path: `shots/${name}.png` });
console.log(issues.length ? issues.slice(0, 20).join('\n') : 'Console issues: none');
await browser.close();
