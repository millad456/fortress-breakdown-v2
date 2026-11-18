// Sieges mode: full replays with a progress bar, pause/stop, story beats and stat chips.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class SiegesMode {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = 'sieges';
    this.list = ctx.content.sieges;
    this.current = null;
    this._off = ctx.engine.addUpdate(() => this.frame());
  }

  enter({ siege } = {}) {
    if (siege) this.play(siege);
  }

  exit() {
    this.stop(false);
  }

  play(id) {
    const { world, siege, ui, engine, timeline } = this.ctx;
    const def = world.scenario.SIEGES[id];
    if (!def) return;
    this.current = this.list.find((s) => s.id === id);
    // the world as it stood
    timeline.applyYear(Math.min(def.year, 1991.5), { glow: false });
    siege.load(id, 'replay');
    siege.play();
    if (def.hour) engine.setTime(def.hour);
    ui.fly(def.pose, { duration: 2.4 });
    ui.renderDock();
  }

  stop(rerender = true) {
    const { siege, timeline } = this.ctx;
    if (this.current || siege.active) {
      siege.stop();
      timeline.applyYear(2025, { glow: false });
    }
    this.current = null;
    if (rerender) this.ctx.ui.renderDock();
  }

  frame() {
    if (!this.current || !this.dockEl?.isConnected) return;
    const { siege } = this.ctx;
    const p = siege.progress;
    const bar = this.dockEl.querySelector('.sg-bar span');
    if (bar) bar.style.width = `${(p * 100).toFixed(1)}%`;
    const beat = siege.beatAt(this.current.beats);
    if (beat && beat !== this.lastBeat) {
      this.lastBeat = beat;
      const b = this.dockEl.querySelector('.sg-beat');
      if (b) b.innerHTML = `<h4>${esc(beat.title)}</h4><p>${esc(beat.text)}</p>`;
    }
    const pb = this.dockEl.querySelector('.sg-pause');
    if (pb) pb.textContent = siege.paused ? 'Resume' : p >= 1 ? 'Replay' : 'Pause';
  }

  dock() {
    if (!this.current) {
      return `<div class="dock-text"><h3>Sieges</h3><p>Three times the city was cut off and fired on. Choose one to replay it.</p>
        <div class="sg-list">${this.list.map((s) => `<button class="sg-pick" data-id="${esc(s.id)}"><b>${esc(s.name)}</b><span>${esc(s.years)} · ${esc(s.attacker)}</span></button>`).join('')}</div></div>`;
    }
    const s = this.current;
    this.lastBeat = null;
    return `<div class="sg">
      <div class="sg-head"><div><p class="tl-when">${esc(s.years)} · ${esc(s.attacker)}</p><h3>${esc(s.name)}</h3></div>
        <div class="sg-ctl"><button class="btn small sg-pause">Pause</button><button class="btn small sg-stop">Stop</button></div></div>
      <div class="sg-bar" role="progressbar" aria-label="Replay progress"><span></span></div>
      <div class="sg-beat"></div>
      <div class="chips">${s.stats.map((x) => `<span class="chip"><b>${esc(x.value)}</b> ${esc(x.label)}</span>`).join('')}</div>
      <p class="sg-sum">${esc(s.outcome)}</p>
    </div>`;
  }

  bindDock(el) {
    this.dockEl = el;
    el.querySelectorAll('.sg-pick').forEach((b) => b.addEventListener('click', () => this.play(b.dataset.id)));
    el.querySelector('.sg-stop')?.addEventListener('click', () => this.stop());
    el.querySelector('.sg-pause')?.addEventListener('click', () => {
      const { siege } = this.ctx;
      if (siege.progress >= 1) this.play(this.current.id);
      else siege.pause();
    });
    this.frame();
  }
}
