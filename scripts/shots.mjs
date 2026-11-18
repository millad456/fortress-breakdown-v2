// Headless verification screenshots (section 9 of the spec).
// Loads the site, waits for window.__fb.world, skips the intro and sets camera poses directly
// (headless WebGL runs at a few fps, so animated flights would never finish). Steps sieges by hand.
//   node scripts/shots.mjs [filter]      URL=... to point at another server
import { mkdirSync } from 'node:fs';
import { launch, openViewer, settle } from './lib/browser.mjs';

const BASE = process.env.URL || 'http://localhost:5173/';
const VIEW = BASE + '#/dubrovnik';
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
mkdirSync('shots', { recursive: true });

const browser = await launch();
const allIssues = [];
const want = (name) => !only || only.test(name);

async function shot(page, name) {
  await settle(page, 3);
  await page.screenshot({ path: `shots/${name}.png` });
  console.log('  saved', name);
}

// ---------------------------------------------------------------- landing
if (want('landing')) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => allIssues.push('[landing] ' + e.message));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && allIssues.push('[landing] ' + m.text()));
  await page.goto(BASE);
  await page.waitForSelector('.card');
  await page.screenshot({ path: 'shots/landing.png' });
  console.log('  saved landing');
  await page.close();
}

const { page, issues } = await openViewer(browser, VIEW, { width: 1600, height: 900 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const pose = (p) => ev((p) => window.__fb.engine.setPose(p), p);
const named = (k) => ev((k) => window.__fb.world.scenario.POSES[k], k);
const reset = () => ev(() => {
  const { ui, engine } = window.__fb;
  if (ui.tourIndex >= 0) ui.endTour();
  ui.setMode('explore');
  ui.closePanel();
  ui.closeLightbox();
  ui.toggleList(false);
  ui.hoverPlace(null);
  engine.setTime(10);
});
console.log('build ms', await ev(() => window.__fb.buildMs));

// ---------------------------------------------------------------- intro frames (T14)
if (want('intro')) {
  for (const t of [0.15, 0.45, 0.72]) {
    await ev((t) => {
      const { ui, engine } = window.__fb;
      ui._introDone = false;
      ui.start();
      const f = engine.flight;
      f.duration = 1e9;
      f.t = t;
      f.apply(t);
      f.onProgress(t);
      engine.camera.updateProjectionMatrix();
      engine.camera.lookAt(engine.controls.target);
    }, t);
    await shot(page, `intro-${Math.round(t * 100)}`);
    await ev(() => window.__fb.ui.skipIntro());
  }
}

// ---------------------------------------------------------------- overview + plan
await reset();
if (want('overview')) {
  await pose(await named('overview'));
  await shot(page, 'overview');
  await ev(() => window.__fb.ui.toggleList(true));
  await shot(page, 'overview-list');
  await ev(() => window.__fb.ui.toggleList(false));
}
if (want('plan')) {
  await pose(await named('plan'));
  await ev(() => window.__fb.ui.labels.setVisible(false));
  await shot(page, 'plan');
  await ev(() => window.__fb.ui.labels.setVisible(true));
}

// ---------------------------------------------------------------- every place
const ids = await ev(() => window.__fb.ui.features.map((f) => f.id));
for (const id of ids) {
  if (!want('place-' + id)) continue;
  await reset();
  await ev((id) => {
    const { ui, engine, world } = window.__fb;
    ui.openPlace(id, { fly: false });
    engine.setPose(world.scenario.PLACE_POSES[id]);
  }, id);
  await shot(page, 'place-' + id);
}

// ---------------------------------------------------------------- highlighted model, with and without the list
if (want('highlight')) {
  await reset();
  await ev(() => {
    const { ui, engine, world } = window.__fb;
    engine.setPose(world.scenario.PLACE_POSES.minceta);
    ui.hoverPlace('minceta');
  });
  await shot(page, 'highlight-minceta');
  await ev(() => window.__fb.ui.toggleList(true));
  await shot(page, 'highlight-minceta-list');
  await ev(() => {
    const { ui, engine, world } = window.__fb;
    ui.toggleList(false);
    ui.hoverPlace(null);
    ui.openPlace('lokrum', { fly: false });
    engine.setPose(world.scenario.PLACE_POSES.lokrum);
  });
  await shot(page, 'highlight-lokrum-ring');
}

// ---------------------------------------------------------------- modes
if (want('mode-anatomy')) {
  await reset();
  await ev(() => window.__fb.ui.setMode('anatomy'));
  await pose(await named('landfront'));
  await shot(page, 'mode-anatomy');
}
if (want('mode-fire')) {
  await reset();
  await ev(() => window.__fb.ui.setMode('fire', { fly: false }));
  await pose(await named('fireOverview'));
  await shot(page, 'mode-fire');
}
if (want('mode-timeline')) {
  await reset();
  await ev(() => window.__fb.ui.setMode('timeline'));
  await pose(await named('overview'));
  await shot(page, 'mode-timeline');
}
if (want('mode-sieges')) {
  await reset();
  await ev(() => window.__fb.ui.setMode('sieges'));
  await pose(await named('overview'));
  await shot(page, 'mode-sieges');
}

// ---------------------------------------------------------------- timeline years
for (const y of [1000, 1200, 1667, 1690]) {
  if (!want('timeline-' + y)) continue;
  await reset();
  await ev((y) => {
    const { ui, engine, world } = window.__fb;
    ui.setMode('timeline');
    ui.timeline.setYear(y, { fly: false });
    engine.setPose(world.scenario.POSES.overview);
    engine.setTime(11);
  }, y);
  // close-up of the town for the house dates
  await pose({ pos: [-60, 330, 420], target: [230, 0, 80] });
  if (y === 1667) await ev(() => { for (let i = 0; i < 60; i++) window.__fb.ui.siege.step(0.1); });
  await shot(page, 'timeline-' + y);
}

// ---------------------------------------------------------------- dioramas (stepped by hand)
for (const [key, year] of [['saracen', 866], ['russian', 1806], ['jna', 1991], ['quake', 1667]]) {
  if (!want('diorama-' + key)) continue;
  await reset();
  await ev(({ key, year }) => {
    const { ui, engine, world } = window.__fb;
    ui.setMode('timeline');
    ui.timeline.setYear(year, { fly: false });
    const def = world.scenario.SIEGES[key];
    engine.setPose(def.pose);
    engine.cancelFlight();
    for (let i = 0; i < 90; i++) ui.siege.step(0.1);
  }, { key, year });
  await shot(page, 'diorama-' + key);
}

// ---------------------------------------------------------------- siege replays (start to finish, stepped)
for (const id of ['saracen', 'russian', 'jna']) {
  if (!want('siege-' + id)) continue;
  await reset();
  const n = await ev((id) => {
    const { ui, engine, world } = window.__fb;
    ui.setMode('sieges', { siege: id });
    engine.cancelFlight();
    engine.setPose(world.scenario.SIEGES[id].pose);
    ui.siege.auto = false;
    const def = world.scenario.SIEGES[id];
    // run to the climax for the picture
    const steps = Math.round((def.duration * 0.55) / 0.1);
    for (let i = 0; i < steps; i++) ui.siege.step(0.1);
    return steps;
  }, id);
  await shot(page, 'siege-' + id);
  // then on to the end: must finish without errors
  const done = await ev((id) => {
    const { ui, world } = window.__fb;
    const def = world.scenario.SIEGES[id];
    for (let i = 0; i < Math.round((def.duration * 0.5) / 0.1) + 5; i++) ui.siege.step(0.1);
    return ui.siege.progress;
  }, id);
  console.log(`  replay ${id}: stepped ${n}+ frames, progress ${done.toFixed(2)}`);
}

// ---------------------------------------------------------------- time of day, Lokrum, Srđ
if (want('night')) {
  await reset();
  await pose(await named('night'));
  await ev(() => window.__fb.engine.setTime(22));
  await shot(page, 'night');
  await pose({ pos: [120, 60, -40], target: [300, 10, 60] });
  await shot(page, 'night-stradun');
}
if (want('morning')) {
  await reset();
  await pose(await named('morning'));
  await ev(() => window.__fb.engine.setTime(7));
  await shot(page, 'morning');
}
if (want('lokrum')) {
  await reset();
  await pose(await named('lokrum'));
  await shot(page, 'lokrum');
}
if (want('srd')) {
  await reset();
  await pose(await named('srd'));
  await shot(page, 'srd');
}

// ---------------------------------------------------------------- guided tour: every stop, flights finished by hand
if (want('tour')) {
  await reset();
  const n = await ev(() => window.__fb.ui.content.tour.length);
  for (let i = 0; i < n; i++) {
    await ev((i) => {
      const { ui, engine } = window.__fb;
      if (i === 0) ui.startTour();
      else ui.tourStep(i);
      engine.finishFlight();
      ui.siege.auto = false;
      for (let k = 0; k < 40; k++) ui.siege.step(0.1);
    }, i);
    if ([0, 1, 8, 9, 10, 11].includes(i)) await shot(page, `tour-${String(i + 1).padStart(2, '0')}`);
  }
  console.log(`  tour: ${n} stops`);
  await ev(() => window.__fb.ui.endTour());
}

// ---------------------------------------------------------------- layout at three sizes, list + panel open
for (const [w, h] of [[1600, 900], [1280, 720], [390, 844]]) {
  if (!want(`layout-${w}`)) continue;
  await page.setViewportSize({ width: w, height: h });
  await reset();
  await ev(() => {
    const { ui, engine, world } = window.__fb;
    ui.openPlace('revelin', { fly: false });
    ui.toggleList(true);
    engine.setPose(world.scenario.PLACE_POSES.revelin);
  });
  await shot(page, `layout-${w}`);
  // overlap check: list, panel, dock, top bar and toast must not intersect
  const overlaps = await ev(() => {
    const vis = (el) => el && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0' && el.getBoundingClientRect().width > 0;
    const els = { topbar: '.topbar', list: '.list', panel: '.panel', dock: '.dock-card' };
    const R = {};
    for (const [k, s] of Object.entries(els)) {
      const el = document.querySelector(s);
      if (vis(el)) R[k] = el.getBoundingClientRect();
    }
    const out = [];
    const keys = Object.keys(R);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = R[keys[i]], b = R[keys[j]];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`${keys[i]}×${keys[j]}`);
    }
    return { visible: keys, overlaps: out };
  });
  console.log(`  layout ${w}x${h}: visible ${overlaps.visible.join(', ')}; overlaps: ${overlaps.overlaps.join(', ') || 'none'}`);
  if (overlaps.overlaps.length) allIssues.push(`[layout ${w}] overlap ${overlaps.overlaps.join(', ')}`);
  if (w === 390) {
    await ev(() => window.__fb.ui.closePanel());
    await ev(() => window.__fb.ui.toggleList(false));
    await shot(page, 'layout-390-dock');
  }
}
await page.setViewportSize({ width: 1600, height: 900 });

await browser.close();
const all = [...allIssues, ...issues];
console.log(all.length ? 'Console issues:\n' + all.join('\n') : 'Console issues: none');
process.exit(all.length ? 1 : 0);
