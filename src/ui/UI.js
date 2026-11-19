// The viewer UI: top bar, mode tabs, hideable list of places, detail panel, dock, toast, lightbox,
// 3D labels, model highlighting and picking, keyboard, intro and guided tour.
// Generic: everything fortress-specific comes from `content` and `world` (world.scenario).
import { Highlighter } from '../world/highlight.js';
import { Labels } from '../world/labels.js';
import { SiegeEngine } from '../modes/siege-engine.js';
import { AnatomyMode } from '../modes/anatomy.js';
import { FireMode } from '../modes/firemode.js';
import { TimelineMode } from '../modes/timeline.js';
import { SiegesMode } from '../modes/sieges.js';
import { panelHTML, photoUrl, photoPage } from './panel.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const MODES = [
  { id: 'explore', label: 'Explore', key: '1' },
  { id: 'anatomy', label: 'Anatomy', key: '2' },
  { id: 'fire', label: 'Fields of fire', key: '3' },
  { id: 'timeline', label: 'Timeline', key: '4' },
  { id: 'sieges', label: 'Sieges', key: '5' },
];
const KIND_ICON = { tower: '◖', fort: '◆', gate: '⌂', wall: '▬', place: '●' };
const fmtHour = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
const NARROW = 760;
const SHORT = 520;
/** a full-width grab bar that minimizes / expands the card it heads */
const GRAB = (k) => `<button class="grab" data-min="${k}" aria-expanded="true" aria-label="Minimize" title="Minimize"><span aria-hidden="true"></span></button>`;

export class UI {
  constructor(root, engine, world, content) {
    this.root = root;
    this.engine = engine;
    this.world = world;
    this.content = content;
    this.sc = world.scenario;
    this.features = content.features;
    this.byId = Object.fromEntries(this.features.map((f) => [f.id, f]));
    this.mode = 'explore';
    this.selected = null;
    this.tourIndex = -1;
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.buildDOM();

    this.highlight = new Highlighter(engine, world.featureObjects, world.rings);
    this.siege = new SiegeEngine({ engine, defs: this.sc.SIEGES, pickTarget: world.pickTarget, pickRuin: world.pickRuin, town: world.town, heightAt: world.heightAt });
    const ctx = { engine, world, content, ui: this, highlight: this.highlight, siege: this.siege };
    this.timeline = new TimelineMode(ctx);
    ctx.timeline = this.timeline;
    this.modes = { anatomy: new AnatomyMode(ctx), fire: new FireMode(ctx), timeline: this.timeline, sieges: new SiegesMode(ctx) };
    this.labels = new Labels({
      engine, heightField: world.heightField, colliders: world.colliders,
      items: this.features.filter((f) => world.labelAnchors[f.id]).map((f) => ({ id: f.id, name: f.name, pos: world.labelAnchors[f.id] })),
      blockers: () => this.blockerRects(),
      onHover: (id) => this.hoverPlace(id),
      onClick: (id) => this.openPlace(id),
      // a place with a model is labelled only while its model exists (timeline years)
      present: (id) => !world.featureObjects[id] || world.rings[id] || world.featureObjects[id].some((o) => o.visible && o.parent?.visible !== false),
    });
    engine.onTime((e) => {
      world.setNight(e.night);
      this.syncTime();
    });
    this.bindCanvas();
    this.bindKeys();
    this.layout();
    this._resize = () => this.layout();
    window.addEventListener('resize', this._resize);
    this.renderDock();
  }

  // ------------------------------------------------------------------ DOM
  buildDOM() {
    const m = this.content.meta;
    const el = document.createElement('div');
    el.className = 'ui';
    el.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#/" aria-label="Fortress Breakdown — all fortresses"><span class="brand-mark" aria-hidden="true">⛫</span><span class="brand-text">Fortress Breakdown</span></a>
        <span class="fname">${esc(m.name)}</span>
        <nav class="tabs" role="tablist" aria-label="Modes">
          ${MODES.map((x) => `<button role="tab" class="tab" data-mode="${x.id}" aria-selected="${x.id === 'explore'}"><kbd>${x.key}</kbd><span>${x.label}</span></button>`).join('')}
        </nav>
        <label class="tod" title="Time of day (N toggles night)"><span class="tod-icon" aria-hidden="true">☀</span>
          <input type="range" min="5" max="23" step="0.05" aria-label="Time of day"><span class="tod-val">10:00</span></label>
        <button class="btn tour-btn">Guided tour</button>
        <button class="btn list-btn" aria-pressed="false" title="Places (L)">Places</button>
      </header>
      <aside class="list" aria-label="Places">
        <div class="list-head"><h2>Places</h2><button class="icon-btn list-close" aria-label="Hide list (L)">✕</button></div>
        <ul>${this.features.map((f) => `<li><button class="place" data-id="${f.id}"><span class="k" aria-hidden="true">${KIND_ICON[f.kind] || '●'}</span><span><b>${esc(f.name)}</b><small>${esc(f.era)}</small></span></button></li>`).join('')}</ul>
        <p class="list-foot">${esc(m.credit)}</p>
      </aside>
      <aside class="panel" aria-label="Place details" aria-hidden="true"><div class="panel-body"></div></aside>
      <section class="dock" aria-live="polite"><div class="dock-tour"></div><div class="dock-card">${GRAB('dock')}<div class="dock-inner"></div><p class="dock-min-label"></p></div></section>
      <div class="toast" role="status"></div>
      <div class="intro-ov" aria-hidden="true">
        <div class="intro-text">
          <p class="intro-coords">${esc(m.coords)} · ${esc(m.country)}</p>
          <h1 class="intro-title">${esc(m.name)}</h1>
          <p class="intro-tag">${esc(m.tagline)}</p>
        </div>
        <div class="intro-btns"><button class="btn primary intro-go">Explore the walls</button><button class="btn ghost intro-skip">Skip intro</button></div>
      </div>
      <div class="lightbox" role="dialog" aria-modal="true" aria-label="Photo" hidden>
        <button class="icon-btn lb-close" aria-label="Close photo">✕</button>
        <img alt=""><p class="lb-cap"></p>
      </div>`;
    this.root.appendChild(el);
    this.el = el;
    const q = (s) => el.querySelector(s);
    this.$ = { topbar: q('.topbar'), list: q('.list'), panel: q('.panel'), panelBody: q('.panel-body'), dock: q('.dock'), dockBox: q('.dock-card'), dockCard: q('.dock-inner'), dockTour: q('.dock-tour'), toast: q('.toast'), intro: q('.intro-ov'), lb: q('.lightbox'), tod: q('.tod input'), todVal: q('.tod-val') };

    el.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode)));
    this.$.tod.addEventListener('input', (e) => this.engine.setTime(+e.target.value));
    q('.list-btn').addEventListener('click', () => this.toggleList());
    q('.list-close').addEventListener('click', () => this.toggleList(false));
    q('.tour-btn').addEventListener('click', () => (this.tourIndex >= 0 ? this.endTour() : this.startTour()));
    el.querySelectorAll('.place').forEach((b) => {
      b.addEventListener('click', () => this.openPlace(b.dataset.id));
      b.addEventListener('pointerenter', () => this.hoverPlace(b.dataset.id));
      b.addEventListener('pointerleave', () => this.hoverPlace(null));
      b.addEventListener('focus', () => this.hoverPlace(b.dataset.id));
      b.addEventListener('blur', () => this.hoverPlace(null));
    });
    // minimize / expand any card; a minimized panel also expands when its title is tapped
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-min]');
      if (b) return this.setMin(b.dataset.min, b.getAttribute('aria-expanded') === 'true');
      if (this.panelMin && e.target.closest('.panel h2, .panel .era')) this.setMin('panel', false);
    });
    this.$.panel.addEventListener('click', (e) => {
      if (e.target.closest('.panel-close')) this.closePanel();
      else if (e.target.closest('.fly-again')) this.flyToPlace(this.selected);
      const ph = e.target.closest('.ph-open');
      if (ph) this.openLightbox(this.byId[this.selected].photos[+ph.dataset.i]);
    });
    this.$.panel.addEventListener('error', (e) => {
      // never show a broken image: drop the figure if a photo fails to load
      if (e.target.tagName === 'IMG') e.target.closest('figure')?.remove();
    }, true);
    q('.lb-close').addEventListener('click', () => this.closeLightbox());
    this.$.lb.addEventListener('click', (e) => e.target === this.$.lb && this.closeLightbox());
    q('.intro-go').addEventListener('click', () => this.endIntro(true));
    q('.intro-skip').addEventListener('click', () => this.endIntro(false));
    // narrow screens start with the list hidden
    this.listOpen = window.innerWidth >= 1100;
  }

  // ------------------------------------------------------------------ layout: no element overlaps another
  layout() {
    const narrow = window.innerWidth < NARROW;
    // phones held sideways: wide but short, so cards get less height
    const short = !narrow && window.innerHeight < SHORT;
    const rc = this.root.classList;
    rc.toggle('narrow', narrow);
    rc.toggle('short', short);
    if (narrow && this.listOpen && this.selected) this.listOpen = false;
    rc.toggle('list-open', !!this.listOpen);
    rc.toggle('panel-open', !!this.selected);
    rc.toggle('sheet-min', !!(this.selected && this.panelMin));
    this.el.querySelector('.list-btn').setAttribute('aria-pressed', String(!!this.listOpen));
    this.$.panel.setAttribute('aria-hidden', String(!this.selected));
    this.$.panel.classList.toggle('min', !!this.panelMin);
    this.$.dockBox.classList.toggle('min', !!this.dockMin);
    this.$.dockTour.querySelector('.tour')?.classList.toggle('min', !!this.tourMin);
    for (const [k, v] of [['panel', this.panelMin], ['dock', this.dockMin], ['tour', this.tourMin]]) {
      this.el.querySelectorAll(`[data-min="${k}"]`).forEach((b) => {
        b.setAttribute('aria-expanded', String(!v));
        b.setAttribute('aria-label', v ? 'Expand' : 'Minimize');
        b.title = v ? 'Expand' : 'Minimize';
      });
    }
    this.el.querySelector('.dock-min-label').textContent = MODES.find((x) => x.id === this.mode)?.label || '';
    const tb = this.$.topbar.getBoundingClientRect().height;
    const st = this.root.style;
    st.setProperty('--topbar', `${Math.ceil(tb)}px`);
    // phone sheets: the place panel sits at the bottom, under the tour card (which moves to the top);
    // when the panel is minimized the dock sits just above it
    st.removeProperty('--sheet-top');
    st.removeProperty('--dock-bottom');
    if (narrow && this.selected) {
      const tour = this.$.dockTour.querySelector('.tour');
      const top = tour && !this.panelMin ? tour.getBoundingClientRect().bottom : tb;
      st.setProperty('--sheet-top', `${Math.ceil(top)}px`);
      // offsetHeight, not the bounding box: the sheet may still be sliding in
      if (this.panelMin) st.setProperty('--dock-bottom', `${this.$.panel.offsetHeight + parseFloat(getComputedStyle(this.$.panel).bottom)}px`);
    }
  }

  /** minimize (true) or expand (false) a card: 'panel', 'dock' or 'tour' */
  setMin(which, v) {
    if (which === 'panel') this.panelMin = v;
    else if (which === 'dock') this.dockMin = v;
    else if (which === 'tour') this.tourMin = v;
    this.layout();
  }

  setDockMin(v) {
    this.setMin('dock', v);
  }

  get compact() {
    return window.innerWidth < NARROW || window.innerHeight < SHORT;
  }

  blockerRects() {
    const out = [this.$.topbar.getBoundingClientRect()];
    if (this.listOpen) out.push(this.$.list.getBoundingClientRect());
    if (this.selected) out.push(this.$.panel.getBoundingClientRect());
    const d = this.$.dock.getBoundingClientRect();
    if (d.height > 0 && getComputedStyle(this.$.dock).visibility !== 'hidden') out.push(d);
    return out;
  }

  toggleList(v = !this.listOpen) {
    this.listOpen = v;
    if (v && window.innerWidth < NARROW && this.selected) this.closePanel(false);
    this.layout();
  }

  toast(msg, ms = 2400) {
    const t = this.$.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  syncTime() {
    const h = this.engine.hour;
    if (document.activeElement !== this.$.tod) this.$.tod.value = String(h);
    this.$.todVal.textContent = fmtHour(h);
    this.el.querySelector('.tod-icon').textContent = this.engine.night > 0.5 ? '☾' : '☀';
  }

  // ------------------------------------------------------------------ places
  hoverPlace(id) {
    this.highlight.setHover(id);
    this.el.querySelectorAll('.place').forEach((b) => b.classList.toggle('hover', b.dataset.id === id));
    for (const it of this.labels.items) it.el.classList.toggle('hover', it.id === id);
  }

  openPlace(id, { fly = true, min = false } = {}) {
    const f = this.byId[id];
    if (!f) return;
    this.selected = id;
    this.panelMin = min;
    this.highlight.setSelected(id);
    this.labels.setActive(id);
    this.$.panelBody.innerHTML = panelHTML(f);
    this.$.panel.scrollTop = 0;
    this.el.querySelectorAll('.place').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    if (window.innerWidth < NARROW) this.listOpen = false;
    this.layout();
    if (fly) this.flyToPlace(id);
  }

  flyToPlace(id) {
    const pose = this.sc.PLACE_POSES[id];
    if (pose) this.fly(pose);
  }

  closePanel(relayout = true) {
    this.selected = null;
    this.highlight.setSelected(null);
    this.labels.setActive(null);
    this.el.querySelectorAll('.place').forEach((b) => b.classList.remove('active'));
    if (relayout) this.layout();
  }

  fly(pose, opts = {}) {
    if (this.reduced) {
      this.engine.setPose(pose);
      return Promise.resolve();
    }
    return this.engine.flyTo(pose, { duration: 2.2, arc: 0.3, ...opts });
  }

  openLightbox(p) {
    if (!p) return;
    const lb = this.$.lb;
    lb.hidden = false;
    const img = lb.querySelector('img');
    img.src = photoUrl(p.file, 1600);
    img.alt = this.byId[this.selected]?.name || '';
    lb.querySelector('.lb-cap').innerHTML = `<a href="${photoPage(p.file)}" target="_blank" rel="noopener">${esc(p.credit)}</a> · ${esc(p.license)} · Wikimedia Commons`;
    lb.querySelector('.lb-close').focus();
  }

  closeLightbox() {
    this.$.lb.hidden = true;
  }

  // ------------------------------------------------------------------ modes
  setMode(id, opts = {}) {
    if (!MODES.some((m) => m.id === id)) return;
    if (id === this.mode && !opts.force) {
      if (opts.siege) this.modes.sieges.play(opts.siege);
      if (opts.year != null) this.timeline.setYear(opts.year, { fly: true });
      return;
    }
    const prev = this.modes[this.mode];
    // lift the highlight, swap the mode, re-apply the highlight
    const sel = this.selected, hov = this.highlight.hover;
    this.highlight.setSelected(null);
    this.highlight.setHover(null);
    prev?.exit();
    this.mode = id;
    const next = this.modes[id];
    next?.enter(opts);
    this.highlight.applyAll();
    this.highlight.setSelected(sel);
    this.highlight.setHover(hov);
    this.el.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === id)));
    this.root.dataset.mode = id;
    this.renderDock();
  }

  renderDock() {
    const m = this.modes[this.mode];
    if (m) {
      this.$.dockCard.innerHTML = m.dock();
      m.bindDock?.(this.$.dockCard);
    } else {
      this.$.dockCard.innerHTML = `
        <div class="dock-row explore">
          <p class="hint"><b>Drag</b> to orbit · <b>right-drag</b> to pan · <b>scroll</b> to zoom · <b>double-click</b> to fly there · <b>click</b> a wall or tower to open it</p>
          <div class="dock-btns dock-keep"><button class="btn small go-home">Overview</button><button class="btn small go-plan">Plan</button><button class="btn small go-night">Night</button></div>
        </div>`;
      this.$.dockCard.querySelector('.go-home').addEventListener('click', () => this.fly(this.sc.HOME));
      this.$.dockCard.querySelector('.go-plan').addEventListener('click', () => this.fly(this.sc.POSES.plan));
      this.$.dockCard.querySelector('.go-night').addEventListener('click', () => this.toggleNight());
    }
    this.layout();
  }

  watchReplay(siegeId) {
    this.setMode('sieges', { siege: siegeId });
  }

  toggleNight() {
    const e = this.engine;
    e.setTime(e.night > 0.5 ? 10 : 21.6);
  }

  // ------------------------------------------------------------------ canvas picking
  bindCanvas() {
    const cv = this.engine.renderer.domElement;
    let down = null, last = 0;
    cv.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      if (this.engine.flight && !this.introRunning) this.engine.cancelFlight();
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.introRunning || e.buttons) return;
      const now = performance.now();
      if (now - last < 70) return;
      last = now;
      const hit = this.engine.pick(e.clientX, e.clientY, this.highlight.pickables, false)[0];
      const id = hit?.object.userData.feature || null;
      this.hoverPlace(id);
      cv.style.cursor = id ? 'pointer' : '';
    });
    cv.addEventListener('pointerleave', () => this.hoverPlace(null));
    cv.addEventListener('pointerup', (e) => {
      if (!down || this.introRunning) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5 || e.button !== 0) return;
      const hit = this.engine.pick(e.clientX, e.clientY, this.highlight.pickables, false)[0];
      const id = hit?.object.userData.feature;
      if (id) this.openPlace(id);
    });
    cv.addEventListener('dblclick', (e) => {
      if (this.introRunning) return;
      const p = this.groundPoint(e.clientX, e.clientY);
      if (!p) return;
      const cam = this.engine.camera.position, t = this.engine.controls.target;
      const off = cam.clone().sub(t).normalize().multiplyScalar(Math.min(320, cam.distanceTo(t)));
      this.fly({ pos: [p[0] + off.x, Math.max(p[1] + 25, p[1] + off.y), p[2] + off.z], target: p });
    });
  }

  groundPoint(x, y) {
    const r = this.engine.renderer.domElement.getBoundingClientRect();
    this.engine.raycaster.setFromCamera({ x: ((x - r.left) / r.width) * 2 - 1, y: -((y - r.top) / r.height) * 2 + 1 }, this.engine.camera);
    const { origin: o, direction: d } = this.engine.raycaster.ray;
    const t = this.world.heightField.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 8000, true);
    if (!isFinite(t)) return null;
    return [o.x + d.x * t, o.y + d.y * t, o.z + d.z * t];
  }

  bindKeys() {
    this._key = (e) => {
      if (e.target.closest?.('input[type=text], textarea')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (this.introRunning) {
        if (e.key === 'Escape' || e.key === ' ') this.endIntro(false);
        return;
      }
      const k = e.key;
      const mode = MODES.find((m) => m.key === k);
      if (mode && !e.target.matches?.('input[type=range]')) {
        this.setMode(mode.id);
        return;
      }
      if (k === 'n' || k === 'N') this.toggleNight();
      else if (k === 'l' || k === 'L') this.toggleList();
      else if (k === 'Escape') {
        if (!this.$.lb.hidden) this.closeLightbox();
        else if (this.selected) this.closePanel();
        else if (this.tourIndex >= 0) this.endTour();
      } else if ((k === 'ArrowRight' || k === 'ArrowLeft') && this.tourIndex >= 0 && !e.target.matches?.('input[type=range]')) {
        e.preventDefault();
        this.tourStep(this.tourIndex + (k === 'ArrowRight' ? 1 : -1));
      }
    };
    window.addEventListener('keydown', this._key);
  }

  // ------------------------------------------------------------------ intro
  start() {
    const I = this.sc.INTRO;
    const p = new URLSearchParams(location.hash.split('?')[1] || '');
    if (p.has('nointro')) {
      this.endIntro(false);
      return;
    }
    this.introRunning = true;
    this.root.classList.add('intro');
    this.$.intro.setAttribute('aria-hidden', 'false');
    this.labels.setVisible(false);
    this.engine.setPose(I.keys[0]);
    this.engine.setTime(I.hours[0]);
    const cues = I.cues;
    const dur = this.reduced ? 4 : I.duration;
    const ease = (t) => 1 - Math.pow(1 - t, 1.7); // arrive fast, settle slowly
    this.engine.flyPath(I.keys, {
      duration: dur, easing: ease,
      onProgress: (t) => {
        this.engine.setTime(I.hours[0] + (I.hours[1] - I.hours[0]) * Math.min(1, t * 1.15));
        this.$.intro.classList.toggle('cue-title', t >= cues.title);
        this.$.intro.classList.toggle('cue-coords', t >= cues.coords);
        this.$.intro.classList.toggle('cue-tag', t >= cues.tagline);
      },
    }).then((done) => done && this.endIntro(false, true));
  }

  /** End the intro: from a button (go/skip), a key, or the flight finishing on its own */
  endIntro(go = false, finished = false) {
    if (!this.introRunning && !this.root.classList.contains('intro') && this._introDone) return;
    this._introDone = true;
    this.introRunning = false;
    if (!finished) {
      this.engine.cancelFlight();
      if (go && !this.reduced) this.engine.flyTo(this.sc.HOME, { duration: 1.6 });
      else this.engine.setPose(this.sc.HOME);
      this.engine.setTime(this.sc.INTRO.hours[1]);
    }
    this.engine.camera.fov = 46;
    this.engine.camera.updateProjectionMatrix();
    this.root.classList.remove('intro');
    this.$.intro.setAttribute('aria-hidden', 'true');
    this.labels.setVisible(true);
    this.layout();
  }

  skipIntro() {
    this.endIntro(false);
  }

  // ------------------------------------------------------------------ tour
  startTour() {
    this.tourIndex = 0;
    this.tourMin = false;
    // on small screens the tour card is the main thing: start the mode controls minimized
    if (this.compact) this.dockMin = true;
    this.el.querySelector('.tour-btn').textContent = 'End tour';
    this.root.classList.add('touring');
    this.tourStep(0);
  }

  endTour() {
    this.tourIndex = -1;
    this.$.dockTour.innerHTML = '';
    this.el.querySelector('.tour-btn').textContent = 'Guided tour';
    this.root.classList.remove('touring');
    this.layout();
  }

  tourStep(i) {
    const stops = this.content.tour;
    if (i < 0 || i >= stops.length) return;
    this.tourIndex = i;
    const s = stops[i];
    if (s.mode !== 'sieges' && this.mode === 'sieges') this.modes.sieges.stop(false);
    this.setMode(s.mode, { year: s.year, siege: s.siege, fly: !s.pose && !s.feature });
    if (s.feature) this.openPlace(s.feature, { min: this.compact });
    else {
      if (this.selected) this.closePanel();
      if (s.pose) this.fly(this.sc.POSES[s.pose]);
    }
    if (s.hour) this.engine.setTime(s.hour);
    else if (s.mode !== 'sieges' && s.mode !== 'timeline' && this.engine.night > 0.5) this.engine.setTime(10);
    this.$.dockTour.innerHTML = `
      <div class="tour">${GRAB('tour')}
        <div class="tour-text"><p class="tl-when">Guided tour · ${i + 1} / ${stops.length}</p><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>
        <div class="tour-nav">
          <button class="icon-btn tour-prev" aria-label="Previous stop (←)" ${i === 0 ? 'disabled' : ''}>←</button>
          <button class="icon-btn tour-next" aria-label="Next stop (→)" ${i === stops.length - 1 ? 'disabled' : ''}>→</button>
          <button class="btn small ghost tour-end">End</button>
        </div>
      </div>`;
    this.$.dockTour.querySelector('.tour-prev').addEventListener('click', () => this.tourStep(i - 1));
    this.$.dockTour.querySelector('.tour-next').addEventListener('click', () => this.tourStep(i + 1));
    this.$.dockTour.querySelector('.tour-end').addEventListener('click', () => this.endTour());
    this.layout();
  }

  dispose() {
    window.removeEventListener('keydown', this._key);
    window.removeEventListener('resize', this._resize);
    this.labels.dispose();
    this.siege.dispose();
    this.highlight.dispose();
    this.el.remove();
  }
}
