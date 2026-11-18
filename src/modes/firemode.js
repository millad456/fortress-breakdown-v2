// Fields of fire mode: computed fans (see fire.js), a dashed harbour chain and a legend.
import { buildFireLayer } from './fire.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class FireMode {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = 'fire';
    this.cfg = ctx.world.scenario.FIRE;
    this.layer = null;
  }

  build() {
    const { world } = this.ctx;
    this.layer = buildFireLayer({
      guns: world.guns, classes: this.cfg.classes, heightAt: world.heightAt, inside: world.insideTown, ring: world.ring,
      chain: this.cfg.chain?.(),
    });
    this._off = this.ctx.engine.addUpdate((dt, t) => this.layer.group.visible && this.layer.update(t));
  }

  enter({ fly = true } = {}) {
    const { engine, ui } = this.ctx;
    if (!this.layer) {
      ui.toast('Computing fields of fire from the plan…', 1600);
      this.build();
    }
    engine.scene.add(this.layer.group);
    this.layer.group.visible = true;
    if (fly) ui.fly(this.cfg.camera);
  }

  exit() {
    if (this.layer) {
      this.layer.group.visible = false;
      this.ctx.engine.scene.remove(this.layer.group);
    }
  }

  dock() {
    const items = Object.values(this.cfg.classes).map((c) => `<li><i style="background:${c.color}"></i>${esc(c.label)}</li>`).join('');
    return `
      <div class="dock-text">
        <h3>Fields of fire</h3>
        <p>The ground each work could really cover, computed from the plan: rays every 3° out to each gun’s range, stopping at the town or where the ground rises above what the guns could reach.</p>
        <ul class="legend">${items}<li><i class="dash"></i>Harbour mouth, closed at night</li></ul>
      </div>`;
  }
}
