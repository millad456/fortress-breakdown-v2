// Anatomy mode: walls coloured by thickness class, the town faded, suburbs and trees hidden,
// a legend and a cross-section of the land front.
import * as THREE from 'three';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class AnatomyMode {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = 'anatomy';
    this.classes = ctx.world.scenario.ANATOMY;
    this.cache = new Map();
  }

  tinted(base, color) {
    const key = base.uuid + color;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = base.clone();
    m.color = new THREE.Color(color);
    if (m.emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = 0.14;
      m.emissiveMap = null;
    }
    this.cache.set(key, m);
    return m;
  }

  enter() {
    const { world, highlight } = this.ctx;
    for (const c of this.classes) {
      for (const o of world.anatomy[c.id] || []) {
        o.traverse((m) => {
          if (!m.isMesh) return;
          highlight.register(m);
          highlight.setMode(m, this.tinted(m.userData.baseMaterial, c.color));
        });
      }
    }
    for (const m of world.fade.materials) {
      m.userData.fadeSave = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
      m.transparent = true;
      m.opacity = 0.12;
      m.depthWrite = false;
      m.needsUpdate = true;
    }
    for (const o of world.fade.hide) o.visible = false;
  }

  exit() {
    const { world, highlight } = this.ctx;
    for (const c of this.classes) {
      for (const o of world.anatomy[c.id] || []) o.traverse((m) => m.isMesh && highlight.setMode(m, null));
    }
    for (const m of world.fade.materials) {
      Object.assign(m, m.userData.fadeSave || { transparent: false, opacity: 1, depthWrite: true });
      m.needsUpdate = true;
    }
    for (const o of world.fade.hide) o.visible = true;
  }

  dock() {
    const items = this.classes.map((c) => `<li><i style="background:${c.color}"></i>${esc(c.label)}</li>`).join('');
    return `
      <div class="dock-row">
        <div class="dock-text">
          <h3 class="dock-keep">Anatomy of the defences</h3>
          <p>Walls coloured by how thick they are. The land front, facing the only approach an army could take, is the thickest; on the sea cliffs the water does most of the work.</p>
          <ul class="legend">${items}</ul>
        </div>
        ${crossSection(this.classes)}
      </div>`;
  }
}

function crossSection(classes) {
  const col = Object.fromEntries(classes.map((c) => [c.id, c.color]));
  return `<figure class="xsec" aria-label="Cross-section of the land front">
    <svg viewBox="0 0 360 150" role="img">
      <title>Cross-section: attacker, outer wall, dry moat, main wall, town</title>
      <path d="M0 118 L92 118 L92 126 L150 126 L150 118 L360 118 L360 150 L0 150Z" fill="#5f6b45" opacity=".7"/>
      <path d="M150 118 L150 118" stroke="#000"/>
      <rect x="84" y="96" width="8" height="22" fill="${col.outer}"/>
      <rect x="82" y="92" width="3" height="4" fill="${col.outer}"/><rect x="88" y="92" width="3" height="4" fill="${col.outer}"/>
      <path d="M92 118 L96 126 L146 126 L150 118" fill="#3b3a2c"/>
      <rect x="150" y="36" width="22" height="90" fill="${col.land}"/>
      <rect x="150" y="28" width="5" height="8" fill="${col.land}"/><rect x="160" y="28" width="5" height="8" fill="${col.land}"/>
      <rect x="172" y="34" width="3" height="4" fill="${col.land}"/>
      <path d="M178 118 L210 118 L210 96 L222 88 L234 96 L234 118 L262 118 L262 102 L274 94 L286 102 L286 118" fill="#d8c9ad"/>
      <g fill="#e8e2d6" font-size="9" font-family="Inter, sans-serif">
        <text x="6" y="110">attacker →</text>
        <text x="66" y="88">outer wall</text>
        <text x="104" y="140">dry moat</text>
        <text x="136" y="22">main wall 4–6 m</text>
        <text x="232" y="84">town</text>
      </g>
      <path d="M22 100 L60 100" stroke="#e8e2d6" stroke-dasharray="3 3"/>
    </svg>
    <figcaption>The land front in section (not to scale)</figcaption>
  </figure>`;
}
