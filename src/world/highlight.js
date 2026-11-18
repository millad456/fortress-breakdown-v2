// Material state + model highlighting.
// Every registered mesh keeps its base material; a mode (anatomy colours, timeline glow) may set a
// mode material; highlighting shows an emissive copy of whichever is current. The visible material
// is always recomputed from that state, so mode changes and highlights never fight over restores.
import * as THREE from 'three';

const GLOW = new THREE.Color(0xffb04a);

export class Highlighter {
  /**
   * @param {object} engine
   * @param {Record<string, THREE.Object3D[]>} featureObjects  feature id -> objects
   * @param {Record<string, THREE.Object3D>} rings  feature id -> ground ring (places with no model)
   */
  constructor(engine, featureObjects, rings = {}) {
    this.engine = engine;
    this.meshesOf = {};
    this.rings = rings;
    this.cache = { hover: new Map(), select: new Map() };
    this.hover = null;
    this.selected = null;
    this.flash = 0;
    this.pickables = [];
    for (const [id, objs] of Object.entries(featureObjects)) {
      const list = (this.meshesOf[id] = []);
      for (const o of objs) {
        o.traverse((m) => {
          if (!m.isMesh) return;
          this.register(m);
          m.userData.feature = id;
          list.push(m);
          this.pickables.push(m);
        });
      }
    }
    for (const r of Object.values(rings)) r.visible = false;
    this._off = engine.addUpdate((dt, t) => this.update(dt, t));
  }

  register(m) {
    if (!m.userData.baseMaterial) m.userData.baseMaterial = m.material;
  }

  /** set (or clear with null) the mode material of a mesh */
  setMode(m, mat) {
    this.register(m);
    m.userData.modeMaterial = mat || null;
    this.apply(m);
  }

  litState(m) {
    const f = m.userData.feature;
    if (!f) return null;
    if (f === this.selected) return 'select';
    if (f === this.hover) return 'hover';
    return null;
  }

  apply(m) {
    const base = m.userData.modeMaterial || m.userData.baseMaterial;
    const lit = this.litState(m);
    m.material = lit ? this.glowOf(base, lit) : base;
  }

  glowOf(mat, kind) {
    const cache = this.cache[kind];
    if (cache.has(mat)) return cache.get(mat);
    const g = mat.clone();
    if (g.emissive) {
      g.emissive = GLOW.clone();
      g.emissiveIntensity = kind === 'select' ? 0.6 : 0.45;
      if (g.emissiveMap) g.emissiveMap = null;
    } else if (g.color) {
      g.color = g.color.clone().lerp(GLOW, 0.5);
    }
    // carry over customisations (town shaders) where present
    if (mat.onBeforeCompile) g.onBeforeCompile = mat.onBeforeCompile;
    g.userData = { ...mat.userData, glow: kind };
    cache.set(mat, g);
    return g;
  }

  refresh(id) {
    if (id && this.meshesOf[id]) for (const m of this.meshesOf[id]) this.apply(m);
    if (id && this.rings[id]) this.rings[id].visible = this.hover === id || this.selected === id;
  }

  setHover(id) {
    if (id === this.hover) return;
    const prev = this.hover;
    this.hover = id;
    this.refresh(prev);
    this.refresh(id);
  }

  setSelected(id) {
    if (id === this.selected) return;
    const prev = this.selected;
    this.selected = id;
    this.flash = id ? 1 : 0;
    this.refresh(prev);
    this.refresh(id);
  }

  /** re-apply everything (after a mode swapped many mode materials) */
  applyAll() {
    for (const list of Object.values(this.meshesOf)) for (const m of list) this.apply(m);
  }

  update(dt, t) {
    // flash on select, then a slow pulse while the panel is open
    this.flash = Math.max(0, this.flash - dt * 1.4);
    const sel = 0.42 + 0.22 * Math.sin(t * 2.4) + this.flash * 1.8;
    for (const g of this.cache.select.values()) if (g.emissive) g.emissiveIntensity = sel;
    const hov = 0.38 + 0.08 * Math.sin(t * 5);
    for (const g of this.cache.hover.values()) if (g.emissive) g.emissiveIntensity = hov;
    for (const [id, r] of Object.entries(this.rings)) {
      if (!r.visible) continue;
      const s = 1 + 0.04 * Math.sin(t * 2.2);
      r.scale.set(s, 1, s);
      r.material.opacity = (id === this.selected ? 0.75 : 0.55) + 0.25 * Math.sin(t * 3);
    }
  }

  dispose() {
    this._off?.();
  }
}

/** A pulsing ring draped over the ground, for places with no model of their own. */
export function groundRing(centre, radius, heightAt, { width = 10, color = 0xffb04a, seg = 128 } = {}) {
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    for (const r of [radius - width / 2, radius + width / 2]) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, Math.max(0, heightAt(centre[0] + x, centre[1] + z)) + 2.5, z);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(centre[0], 0, centre[1]);
  mesh.renderOrder = 3;
  mesh.name = 'ground-ring';
  return mesh;
}
