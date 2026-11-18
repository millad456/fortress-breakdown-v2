// Generic viewer: loading screen, engine, world build, UI, intro. Fortress-agnostic:
// everything specific arrives through the fortress module (content + build()).
import { Engine } from './engine/Engine.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function pickQuality() {
  const p = new URLSearchParams(location.hash.split('?')[1] || location.search);
  if (p.get('q')) return p.get('q');
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return small || mobile ? 'medium' : 'high';
}

export async function openViewer(root, entry) {
  const el = document.createElement('div');
  el.className = 'viewer';
  el.innerHTML = `
    <div class="stage" aria-label="3D view"></div>
    <div class="loading" role="status" aria-live="polite">
      <div class="loading-inner">
        <p class="eyebrow">${esc(entry.country)}</p>
        <h1>${esc(entry.name)}</h1>
        <div class="bar"><span></span></div>
        <p class="loading-step">Preparing…</p>
      </div>
    </div>`;
  root.appendChild(el);
  document.title = `${entry.name} — Fortress Breakdown`;
  const bar = el.querySelector('.bar span');
  const stepEl = el.querySelector('.loading-step');

  const mod = await entry.load();
  const content = mod.content;
  const steps = content.loadingSteps || [];
  const step = (i) => {
    bar.style.width = `${Math.round(((i + 1) / (steps.length + 1)) * 100)}%`;
    stepEl.textContent = steps[i] || 'Almost there…';
  };

  const t0 = performance.now();
  const engine = new Engine(el.querySelector('.stage'), { quality: pickQuality() });
  const world = await mod.build(engine, step);
  const buildMs = Math.round(performance.now() - t0);
  bar.style.width = '100%';

  const { UI } = await import('./ui/UI.js');
  const ui = new UI(el, engine, world, content, mod);
  window.__fb = { engine, world, ui, buildMs };
  el.querySelector('.loading').classList.add('done');
  setTimeout(() => el.querySelector('.loading')?.remove(), 900);
  ui?.start();

  return {
    dispose() {
      ui?.dispose?.();
      engine.dispose();
      el.remove();
      delete window.__fb;
    },
  };
}
