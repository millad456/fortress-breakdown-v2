// 3D place labels (CSS2D): one small text tag per place, no dots. Hidden when occluded by terrain
// or walls (checked every few frames), when they would sit under the UI, and scaled down with distance.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class Labels {
  /**
   * @param {object} o
   * @param {object} o.engine
   * @param {{id:string,name:string,pos:number[]}[]} o.items
   * @param {import('./heightfield.js').HeightField} o.heightField
   * @param {THREE.Object3D[]} o.colliders
   * @param {()=>DOMRect[]} o.blockers  screen rects labels must not overlap
   */
  constructor({ engine, items, heightField, colliders, blockers, onHover, onClick, present }) {
    this.present = present || (() => true);
    this.engine = engine;
    this.hf = heightField;
    this.colliders = colliders;
    this.blockers = blockers;
    this.group = new THREE.Group();
    this.group.name = 'labels';
    engine.scene.add(this.group);
    this.items = items.map((it) => {
      const el = document.createElement('button');
      el.className = 'label3d';
      el.type = 'button';
      el.textContent = it.name;
      el.dataset.id = it.id;
      el.tabIndex = -1;
      el.addEventListener('pointerenter', () => onHover?.(it.id));
      el.addEventListener('pointerleave', () => onHover?.(null));
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick?.(it.id);
      });
      const obj = new CSS2DObject(el);
      obj.position.set(...it.pos);
      obj.center.set(0.5, 1);
      this.group.add(obj);
      return { ...it, el, obj, occluded: false };
    });
    this.raycaster = new THREE.Raycaster();
    this.frame = 0;
    this.visible = true;
    this._off = engine.addUpdate(() => this.update());
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  setActive(id) {
    for (const it of this.items) it.el.classList.toggle('active', it.id === id);
  }

  update() {
    if (!this.visible) return;
    const cam = this.engine.camera;
    const camPos = cam.position;
    const check = this.frame++ % 6 === 0;
    const rects = check ? this.blockers() : null;
    const canvas = this.engine.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const it of this.items) {
      const d = camPos.distanceTo(it.obj.position);
      if (check) {
        it.occluded = this.occluded(it.obj.position, d);
        // keep clear of the top bar and the panels
        v.copy(it.obj.position).project(cam);
        const sx = canvas.left + ((v.x + 1) / 2) * canvas.width, sy = canvas.top + ((1 - v.y) / 2) * canvas.height;
        it.underUI = v.z > 1 || rects.some((r) => sx > r.left - 50 && sx < r.right + 50 && sy > r.top - 8 && sy < r.bottom + 26);
      }
      it.dist = d;
      if (check) it.absent = !this.present(it.id);
      const hide = it.absent || it.occluded || it.underUI || it.crowded || d > 5200;
      it.el.classList.toggle('hidden', hide);
      // smaller when far
      const s = Math.max(0.62, Math.min(1, 900 / Math.max(d, 1)));
      it.el.style.setProperty('--s', s.toFixed(2));
    }
    if (check) this.declutter();
  }

  /** labels never overlap each other: the active one wins, then the nearest */
  declutter() {
    const placed = [];
    const order = this.items.slice().sort((a, b) => (b.el.classList.contains('active') - a.el.classList.contains('active')) || a.dist - b.dist);
    for (const it of order) {
      if (it.absent || it.occluded || it.underUI) {
        it.crowded = false;
        continue;
      }
      const r = it.el.getBoundingClientRect();
      if (!r.width) continue;
      const hit = placed.some((p) => r.left < p.right + 4 && p.left < r.right + 4 && r.top < p.bottom + 2 && p.top < r.bottom + 2);
      it.crowded = hit;
      it.el.classList.toggle('hidden', hit);
      if (!hit) placed.push(r);
    }
  }

  occluded(p, dist) {
    const cam = this.engine.camera.position;
    const dir = new THREE.Vector3().subVectors(p, cam).normalize();
    // terrain (cheap height-field march)
    const tHit = this.hf.raycast(cam.x, cam.y, cam.z, dir.x, dir.y, dir.z, dist - 8, false);
    if (tHit < dist - 8) return true;
    // walls and works
    this.raycaster.set(cam, dir);
    this.raycaster.far = dist - 10;
    const hit = this.raycaster.intersectObjects(this.colliders, false);
    return hit.length > 0;
  }

  dispose() {
    this._off?.();
    this.engine.scene.remove(this.group);
    for (const it of this.items) it.el.remove();
  }
}
