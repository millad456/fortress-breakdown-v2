// Phone layout check: screenshots of the main states at phone sizes, and for each one
// how much of the screen the cards cover, whether any two overlap, and whether every
// card can be minimized. Exits 1 on any overlap, a card that cannot be minimized, or
// minimized cards that still cover too much.
//   node scripts/mobile.mjs [prefix]      URL=... to point at another server
import { mkdirSync } from 'node:fs';
import { launch, openViewer, settle } from './lib/browser.mjs';

const BASE = process.env.URL || 'http://localhost:5173/';
const prefix = process.argv[2] || 'mobile';
mkdirSync('shots', { recursive: true });
const SIZES = [[390, 844], [375, 667], [844, 390]];
const MAX_MIN = 0.3; // minimized cards may cover at most 30% of the screen (top bar excluded)

const browser = await launch();
const problems = [];

for (const [w, h] of SIZES) {
  const { page, issues } = await openViewer(browser, BASE + '#/dubrovnik', { width: w, height: h });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const reset = () => ev(() => {
    const { ui, engine } = window.__fb;
    if (ui.tourIndex >= 0) ui.endTour();
    ui.setMode('explore');
    ui.closePanel();
    ui.toggleList(false);
    ui.setDockMin?.(false);
    engine.setTime(10);
  });

  // measure visible cards: coverage of the screen below the top bar, overlaps, minimize buttons
  const measure = () => ev(() => {
    const vis = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    };
    const cards = { list: '.list', panel: '.panel', dock: '.dock-card', tour: '.dock-tour .tour' };
    const R = {};
    for (const [k, s] of Object.entries(cards)) {
      const el = document.querySelector(s);
      if (vis(el)) R[k] = el.getBoundingClientRect();
    }
    const tb = document.querySelector('.topbar').getBoundingClientRect();
    const all = { topbar: tb, ...R };
    const keys = Object.keys(all);
    const overlaps = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = all[keys[i]], b = all[keys[j]];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps.push(`${keys[i]}×${keys[j]}`);
    }
    // coverage by sampling a grid below the top bar
    let hit = 0, tot = 0;
    for (let y = tb.bottom + 2; y < innerHeight; y += 6) for (let x = 2; x < innerWidth; x += 6) {
      tot++;
      if (Object.values(R).some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) hit++;
    }
    const minBtn = {};
    for (const k of Object.keys(R)) {
      if (k === 'list') continue; // the list is a picker: it closes, it does not minimize
      const el = document.querySelector(cards[k]);
      minBtn[k] = !!el.querySelector('[data-min]') && vis(el.querySelector('[data-min]'));
    }
    return { cards: Object.keys(R), overlaps, cover: hit / Math.max(1, tot), minBtn, topbar: Math.round(tb.height) };
  });

  // minimize every card that can be, then measure again
  const minimizeAll = () => ev(() => document.querySelectorAll('[data-min][aria-expanded="true"]').forEach((b) => b.click()));

  const states = {
    explore: async () => {},
    panel: async () => ev(() => window.__fb.ui.openPlace('minceta', { fly: false })),
    list: async () => ev(() => window.__fb.ui.toggleList(true)),
    tour: async () => ev(() => {
      const { ui, engine } = window.__fb;
      ui.startTour();
      ui.tourStep(1);
      engine.finishFlight();
    }),
    // a tour stop that opens a place: the tour controls must stay on screen with the panel
    tourplace: async () => ev(() => {
      const { ui, engine } = window.__fb;
      ui.startTour();
      ui.tourStep(ui.content.tour.findIndex((s) => s.feature));
      engine.finishFlight();
    }),
    timeline: async () => ev(() => {
      const { ui } = window.__fb;
      ui.setMode('timeline');
      ui.timeline.setYear(1667, { fly: false });
    }),
    siege: async () => ev(() => {
      const { ui, engine } = window.__fb;
      ui.setMode('sieges', { siege: 'russian' });
      engine.cancelFlight();
      ui.siege.auto = false;
      for (let i = 0; i < 40; i++) ui.siege.step(0.1);
    }),
    anatomy: async () => ev(() => window.__fb.ui.setMode('anatomy')),
  };

  for (const [name, go] of Object.entries(states)) {
    await reset();
    await go();
    await settle(page, 3);
    const tag = `${prefix}-${w}x${h}-${name}`;
    await page.screenshot({ path: `shots/${tag}.png` });
    const a = await measure();
    let line = `${w}x${h} ${name.padEnd(8)} cards [${a.cards.join(', ')}] cover ${(a.cover * 100).toFixed(0)}%`;
    if (a.overlaps.length) problems.push(`${tag}: overlap ${a.overlaps.join(', ')}`);
    if (name.startsWith('tour') && !a.cards.includes('tour')) problems.push(`${tag}: tour controls not visible`);
    const noMin = Object.entries(a.minBtn).filter(([, v]) => !v).map(([k]) => k);
    if (noMin.length) problems.push(`${tag}: no minimize button on ${noMin.join(', ')}`);
    if (name !== 'list' && name !== 'explore') {
      await minimizeAll();
      await settle(page, 3);
      await page.screenshot({ path: `shots/${tag}-min.png` });
      const b = await measure();
      line += ` → minimized cover ${(b.cover * 100).toFixed(0)}%`;
      if (b.overlaps.length) problems.push(`${tag}-min: overlap ${b.overlaps.join(', ')}`);
      if (b.cover > MAX_MIN) problems.push(`${tag}-min: minimized cards still cover ${(b.cover * 100).toFixed(0)}%`);
    }
    console.log(line + (a.overlaps.length ? `  OVERLAP ${a.overlaps.join(', ')}` : ''));
  }
  problems.push(...issues.map((s) => `${w}x${h} ${s}`));
  await page.close();
}

await browser.close();
console.log(problems.length ? 'Problems:\n' + problems.join('\n') : 'Mobile layout: OK');
process.exit(problems.length ? 1 : 0);
