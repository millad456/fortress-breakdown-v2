// Timeline mode: structures and the town by year, glow on new works, the 1667 ruins and rebuilding,
// the 1991 roofs, siege markers and looping dioramas with set camera poses, and Play with holds.
import * as THREE from 'three';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const Y0 = 700, Y1 = 2025;
const GLOW_YEARS = 35;
const HOLD = 8; // seconds Play pauses on each diorama

export class TimelineMode {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = 'timeline';
    this.items = ctx.content.timeline;
    this.year = 1300;
    this.playing = false;
    this.diorama = null;
    this.glowMats = new Map();
    this.hold = 0;
    this.heldAt = new Set();
    // houses built per year → Play slows down through dense building periods
    const hist = new Float32Array(Y1 - Y0 + 1);
    for (const h of ctx.world.town.houses) {
      for (const y of [h.year, h.rebuilt]) if (y >= Y0 && y <= Y1) hist[Math.round(y) - Y0]++;
    }
    this.density = hist;
    this.markers = this.items.filter((it) => it.siege || it.disaster);
    this._off = ctx.engine.addUpdate((dt) => this.tick(dt));
  }

  dioramaKey(it) {
    return it.siege || String(it.year);
  }

  enter({ year, fly = false } = {}) {
    this.active = true;
    this.setYear(year ?? this.year, { fly: !!fly });
  }

  exit() {
    this.active = false;
    this.playing = false;
    this.unstage();
    this.applyYear(Y1, { glow: false });
    for (const s of Object.values(this.ctx.world.structures)) for (const o of s.objects) o && this.glow(o, 0);
    this.ctx.world.town.setYear(2025);
  }

  /** Show the world as it stood in `y` (structures + town). Also used by the sieges mode. */
  applyYear(y, { glow = true } = {}) {
    const { world } = this.ctx;
    world.town.setYear(y);
    for (const s of Object.values(world.structures)) {
      const on = y >= s.year && (!s.until || y < s.until);
      const age = y - s.year;
      const g = glow && on && !s.quiet && age >= 0 && age < GLOW_YEARS ? 1 - age / GLOW_YEARS : 0;
      for (const o of s.objects) {
        if (!o) continue;
        o.visible = on;
        this.glow(o, g);
      }
    }
  }

  /** a warm emissive tint on newly built works, fading over GLOW_YEARS */
  glow(obj, amount) {
    const { highlight } = this.ctx;
    obj.traverse((m) => {
      if (!m.isMesh) return;
      highlight.register(m);
      if (amount <= 0.001) {
        if (m.userData.modeMaterial && m.userData.modeMaterial.userData.timelineGlow) highlight.setMode(m, null);
        return;
      }
      let gm = this.glowMats.get(m);
      if (!gm) {
        gm = m.userData.baseMaterial.clone();
        gm.userData = { timelineGlow: true };
        if (!gm.emissive) return;
        gm.emissive = new THREE.Color(0xffc46b);
        gm.emissiveMap = null;
        this.glowMats.set(m, gm);
      }
      gm.emissiveIntensity = 0.55 * amount;
      if (m.userData.modeMaterial !== gm) highlight.setMode(m, gm);
    });
  }

  setYear(y, { fly = true, fromPlay = false } = {}) {
    y = Math.max(Y0, Math.min(Y1, y));
    this.year = y;
    this.applyYear(y);
    // inside a siege window: stage its diorama
    const it = this.markers.find((m) => {
      const w = m.window || [m.year - 5, m.year + 5];
      return y >= w[0] && y <= w[1];
    });
    if (it) this.stage(it, { fly });
    else this.unstage();
    // a staged event shows its own moment (the 1667 ruins, the 1991 roofs) even on a whole-year slider
    if (this.diorama) {
      const d = this.ctx.world.scenario.SIEGES[this.diorama];
      if (d.year > y) this.ctx.world.town.setYear(d.year);
    }
    if (!fromPlay) this.heldAt.clear();
    this.renderDock();
  }

  stage(it, { fly = true } = {}) {
    const key = this.dioramaKey(it);
    const { world, siege, engine, ui } = this.ctx;
    const defKey = world.scenario.DIORAMAS[key];
    if (!defKey) return;
    if (this.diorama === defKey) return;
    this.diorama = defKey;
    const def = world.scenario.SIEGES[defKey];
    siege.load(defKey, 'diorama');
    siege.auto = true;
    // the 1991 diorama shows the hit roofs: the timeline year inside the window does that
    if (fly) ui.fly(def.pose, { duration: 2.2 });
    if (def.hour) engine.setTime(def.hour);
    this.dioramaItem = it;
  }

  unstage() {
    if (!this.diorama) return;
    this.diorama = null;
    this.dioramaItem = null;
    this.ctx.siege.stop();
  }

  play() {
    this.playing = !this.playing;
    if (this.playing && this.year >= Y1 - 1) this.setYear(Y0, { fly: false });
    this.renderDock();
  }

  tick(dt) {
    if (!this.active || !this.playing) return;
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) this.renderDock();
      return;
    }
    // slower through dense building periods
    const i = Math.round(this.year) - Y0;
    let dens = 0;
    for (let k = -6; k <= 6; k++) dens += this.density[i + k] || 0;
    const speed = 22 / (1 + dens / 18);
    const next = this.year + speed * dt;
    // hold on each event with a diorama
    const crossed = this.markers.find((m) => this.year < m.year && next >= m.year && !this.heldAt.has(m.year));
    if (crossed) {
      this.heldAt.add(crossed.year);
      this.setYear(crossed.year, { fly: true, fromPlay: true });
      this.hold = HOLD;
      return;
    }
    if (next >= Y1) {
      this.setYear(Y1, { fly: false, fromPlay: true });
      this.playing = false;
      this.renderDock();
      return;
    }
    this.setYear(next, { fly: false, fromPlay: true });
  }

  /** the latest event at or before the current year */
  current() {
    let cur = null;
    for (const it of this.items) if (it.year <= this.year + 0.5) cur = it;
    return cur;
  }

  renderDock() {
    const el = this.dockEl;
    if (!el || !el.isConnected || !el.querySelector('.tl')) return;
    const y = Math.round(this.year);
    el.querySelector('.tl-year').textContent = y < 1000 ? `${y} AD` : String(y);
    const slider = el.querySelector('.tl-slider');
    if (document.activeElement !== slider) slider.value = String(y);
    el.querySelector('.tl-play').textContent = this.playing ? (this.hold > 0 ? 'Holding…' : 'Pause') : 'Play';
    el.querySelector('.tl-play').setAttribute('aria-pressed', String(this.playing));
    const cur = this.dioramaItem || this.current();
    const card = el.querySelector('.tl-card');
    if (cur) {
      const isSiege = !!cur.siege;
      card.innerHTML = `<p class="tl-when">${cur.year < 1000 ? cur.year + ' AD' : cur.year}${cur.disaster ? ' · disaster' : isSiege ? ' · siege' : ''}</p>
        <h4>${esc(cur.label)}</h4><p>${esc(cur.text)}</p>
        ${isSiege ? `<button class="btn small tl-replay" data-siege="${esc(cur.siege)}">Watch the full replay</button>` : ''}`;
    }
  }

  dock() {
    const pct = (y) => ((y - Y0) / (Y1 - Y0)) * 100;
    const marks = this.markers.map((m) => `<button class="tl-mark ${m.disaster ? 'dis' : 'war'}" style="left:${pct(m.year).toFixed(2)}%" data-year="${m.year}" title="${esc(m.year + ' — ' + m.label)}" aria-label="${esc(m.year + ' — ' + m.label)}">${m.disaster ? '✦' : '⚔'}</button>`).join('');
    const ticks = [800, 1000, 1200, 1400, 1600, 1800, 2000].map((y) => `<span class="tl-tick" style="left:${pct(y)}%">${y}</span>`).join('');
    return `
      <div class="tl">
        <div class="tl-head dock-keep">
          <button class="btn tl-play" aria-pressed="false">Play</button>
          <span class="tl-year" aria-live="polite"></span>
          <span class="tl-note">House dates are a modelled estimate</span>
        </div>
        <div class="tl-track dock-keep">
          <input class="tl-slider" type="range" min="${Y0}" max="${Y1}" step="1" value="${Math.round(this.year)}" aria-label="Year">
          <div class="tl-marks">${marks}</div>
          <div class="tl-ticks">${ticks}</div>
        </div>
        <div class="tl-card"></div>
      </div>`;
  }

  bindDock(el) {
    this.dockEl = el;
    el.querySelector('.tl-slider').addEventListener('input', (e) => {
      this.playing = false;
      this.setYear(+e.target.value, { fly: true });
    });
    el.querySelector('.tl-play').addEventListener('click', () => this.play());
    el.querySelectorAll('.tl-mark').forEach((b) => b.addEventListener('click', () => {
      this.playing = false;
      this.setYear(+b.dataset.year, { fly: true });
    }));
    el.addEventListener('click', (e) => {
      const r = e.target.closest('.tl-replay');
      if (r) this.ctx.ui.watchReplay(r.dataset.siege);
    });
    this.renderDock();
  }
}
