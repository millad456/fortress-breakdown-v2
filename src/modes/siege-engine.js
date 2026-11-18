// Generic siege simulation: fleets, batteries, shells with flight time and trails, flashes, smoke,
// fires, scorch marks and roof damage. Runs as a replay (progress 0 → 1) or as a looping diorama.
// Can be stepped by hand (step(dt)) for deterministic headless screenshots.
import * as THREE from 'three';
import { ParticlePool, Fleet } from '../world/fx.js';
import { rng } from '../core/noise.js';

const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class SiegeEngine {
  /**
   * @param {object} o
   * @param {object} o.engine
   * @param {Record<string, object>} o.defs  scenario definitions (fleets, batteries, rate, shell, fires…)
   * @param {(rand:()=>number)=>{x:number,y:number,z:number,roof?:number}} o.pickTarget
   * @param {(rand:()=>number)=>number[]|null} [o.pickRuin]  a fallen house (for earthquake fires)
   * @param {object} [o.town]  { setRoofDamage(i, v), clearRoofDamage() }
   */
  constructor({ engine, defs, pickTarget, pickRuin, town, heightAt }) {
    this.engine = engine;
    this.defs = defs;
    this.pickTarget = pickTarget;
    this.pickRuin = pickRuin;
    this.town = town;
    this.heightAt = heightAt;
    this.group = new THREE.Group();
    this.group.name = 'siege';
    engine.scene.add(this.group);
    this.smoke = new ParticlePool(2400, { name: 'smoke' });
    this.fire = new ParticlePool(2400, { additive: true, name: 'fire' });
    this.group.add(this.smoke.points, this.fire.points);
    // shells
    this.maxShells = 160;
    this.shellMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.maxShells);
    this.shellMesh.frustumCulled = false;
    // create the colour buffer before the first compile so the shader includes instance colours
    for (let i = 0; i < this.maxShells; i++) this.shellMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    this.shellMesh.count = 0;
    this.group.add(this.shellMesh);
    // scorch marks
    this.maxScorch = 400;
    const disc = new THREE.CircleGeometry(1, 14);
    disc.rotateX(-Math.PI / 2);
    this.scorch = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: 0x0c0a08, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), this.maxScorch);
    this.scorch.count = 0;
    this.scorch.renderOrder = 2;
    this.group.add(this.scorch);
    // a point light for the brightest flashes
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 260, 1.6);
    this.group.add(this.flashLight);
    this.reset();
    this.group.visible = false;
    this._off = engine.addUpdate((dt) => {
      if (this.active && this.auto) this.step(dt);
    });
  }

  reset() {
    this.shells = [];
    this.fires = [];
    this.nScorch = 0;
    this.scorch.count = 0;
    this.acc = 0;
    this.fireAcc = 0;
    this.time = 0;
    this.progress = 0;
    this.smoke.clear();
    this.fire.clear();
    this.flashLight.intensity = 0;
    this.town?.clearRoofDamage?.();
    for (const f of this.fleets || []) {
      this.group.remove(f.fleet.mesh);
      f.fleet.mesh.geometry.dispose();
    }
    this.fleets = [];
  }

  /**
   * Load a scenario. mode: 'replay' (progress advances over def.duration) or 'diorama' (loops at a fixed progress).
   */
  load(id, mode = 'replay') {
    this.reset();
    const def = this.defs[id];
    if (!def) return;
    this.id = id;
    this.def = def;
    this.mode = mode;
    this.rand = rng(id.length * 977 + (mode === 'diorama' ? 3 : 7));
    this.progress = mode === 'diorama' ? def.diorama?.progress ?? 0.5 : 0;
    for (const fd of def.fleets || []) {
      const spots = fd.place();
      const fleet = new Fleet(fd.kind, spots.length, { color: fd.color, sail: fd.sail || '#efe6d2' });
      this.group.add(fleet.mesh);
      this.fleets.push({ def: fd, fleet, spots, phase: spots.map(() => this.rand() * 6.28) });
    }
    this.active = true;
    this.paused = false;
    this.group.visible = true;
    this.updateFleets();
  }

  play() {
    this.auto = true;
    this.paused = false;
  }
  pause(v = !this.paused) {
    this.paused = v;
  }
  stop() {
    this.active = false;
    this.auto = false;
    this.group.visible = false;
    this.reset();
  }

  /** Advance the simulation by dt seconds */
  step(dt) {
    if (!this.active || this.paused) return;
    const def = this.def;
    this.time += dt;
    if (this.mode === 'replay') this.progress = Math.min(1, this.progress + dt / def.duration);
    const p = this.progress;
    this.updateFleets();

    // firing
    const rate = (def.rate?.(p) ?? 0) * (this.mode === 'diorama' ? 1.2 : 1);
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.fireShell();
    }
    // fires breaking out (earthquake)
    if (def.fireRate) {
      this.fireAcc += def.fireRate * dt;
      while (this.fireAcc >= 1) {
        this.fireAcc -= 1;
        const r = this.pickRuin?.(this.rand);
        if (r && this.fires.length < 60) this.fires.push({ x: r[0], y: r[1], z: r[2], until: this.time + 8 + this.rand() * 14, size: 1 + this.rand() });
      }
    }
    // shells in flight
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t += dt / s.T;
      if (s.t >= 1) {
        this.impact(s);
        this.shells.splice(i, 1);
        continue;
      }
      const k = s.t;
      const x = s.a[0] + (s.b[0] - s.a[0]) * k, z = s.a[2] + (s.b[2] - s.a[2]) * k;
      const y = s.a[1] + (s.b[1] - s.a[1]) * k + 4 * s.h * k * (1 - k);
      if (n < this.maxShells) {
        m4.makeScale(s.size, s.size, s.size).setPosition(x, y, z);
        this.shellMesh.setMatrixAt(n, m4);
        this.shellMesh.setColorAt(n, s.color);
        n++;
      }
      if (s.trail) this.fire.spawn(x, y, z, { size: 4, grow: -2, life: 0.7, color: [1, 0.75, 0.4], alpha: 0.75 });
      else if (this.rand() < 0.3) this.smoke.spawn(x, y, z, { size: 1.6, grow: 2, life: 1.2, color: [0.6, 0.58, 0.55], alpha: 0.35 });
    }
    this.shellMesh.count = n;
    this.shellMesh.instanceMatrix.needsUpdate = true;
    if (this.shellMesh.instanceColor) this.shellMesh.instanceColor.needsUpdate = true;

    // burning fires
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      if (this.mode === 'replay' && this.time > f.until) {
        this.fires.splice(i, 1);
        continue;
      }
      if (this.mode === 'diorama' && this.time > f.until) f.until = this.time + 6 + this.rand() * 10;
      const spawnFire = Math.min(3, Math.round(dt * 26 * f.size + this.rand()));
      for (let k = 0; k < spawnFire; k++) {
        this.fire.spawn(f.x + (this.rand() - 0.5) * 4 * f.size, f.y + this.rand() * 2, f.z + (this.rand() - 0.5) * 4 * f.size, {
          vy: 5 + this.rand() * 5, size: 6 + this.rand() * 6 * f.size, grow: -3, life: 0.8 + this.rand() * 0.7,
          color: [1, 0.45 + this.rand() * 0.35, 0.12], alpha: 0.9,
        });
      }
      if (this.rand() < dt * 5) {
        this.smoke.spawn(f.x, f.y + 4, f.z, { vx: 1.5, vy: 5 + this.rand() * 3, vz: 0.6, size: 12, grow: 20, life: 8, color: [0.16, 0.15, 0.14], alpha: 0.6 });
      }
    }
    this.flashLight.intensity *= Math.pow(0.02, dt);
    this.smoke.update(dt);
    this.fire.update(dt);
    const h = this.engine.renderer.domElement.height;
    this.smoke.setScale(h);
    this.fire.setScale(h);
  }

  updateFleets() {
    const p = this.progress;
    const t = this.time;
    for (const F of this.fleets) {
      const d = F.def;
      const arrive = d.arrive ? smooth(d.arrive[0], d.arrive[1], p) : 1;
      const leave = d.leave ? smooth(d.leave[0], d.leave[1], p) : 0;
      F.spots.forEach(([tx, tz], i) => {
        const fx = d.from[0] + (tx - d.from[0]) * 0.1 + Math.sin(i * 7.1) * 200, fz = d.from[1] + Math.cos(i * 3.7) * 200;
        let x = fx + (tx - fx) * arrive, z = fz + (tz - fz) * arrive;
        // retreat: back out the way they came
        x += (fx - tx) * leave;
        z += (fz - tz) * leave;
        const moving = (arrive > 0.02 && arrive < 0.98) || (leave > 0.02 && leave < 0.98);
        let heading;
        if (moving) heading = leave > 0.02 ? Math.atan2(fx - tx, fz - tz) : Math.atan2(tx - fx, tz - fz);
        else heading = Math.atan2(tx - d.from[0], tz - d.from[1]) + Math.sin(F.phase[i] + t * 0.1) * 0.15;
        const bob = Math.sin(F.phase[i] + t * 1.3) * 0.25;
        F.fleet.set(i, x, bob, z, heading, Math.sin(F.phase[i] + t * 0.9) * 0.03);
      });
      F.fleet.commit();
      F.fleet.mesh.visible = arrive > 0.001 && leave < 0.999;
    }
  }

  fireShell() {
    const def = this.def;
    const guns = [...(def.batteries || [])];
    for (const F of this.fleets) {
      if (!F.def.fire) continue;
      F.spots.forEach(([x, z]) => guns.push([x, 4, z]));
    }
    if (!guns.length) return;
    const a = guns[Math.floor(this.rand() * guns.length)];
    const tg = this.pickTarget(this.rand);
    const b = [tg.x, tg.y, tg.z];
    const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const sh = def.shell;
    const T = Math.max(1.2, d / sh.speed);
    this.shells.push({
      a, b, t: 0, T, h: d * sh.arc, size: sh.size, trail: sh.trail, roof: tg.roof,
      color: new THREE.Color(sh.color),
    });
    // muzzle flash and smoke at the gun
    this.fire.spawn(a[0], a[1] + 2, a[2], { size: 26, grow: -20, life: 0.3, color: [1, 0.8, 0.45], alpha: 1 });
    this.smoke.spawn(a[0], a[1] + 3, a[2], { vy: 2, size: 16, grow: 16, life: 4, color: [0.75, 0.73, 0.7], alpha: 0.55 });
  }

  impact(s) {
    const [x, y, z] = s.b;
    this.fire.spawn(x, y + 2, z, { size: 40, grow: -50, life: 0.4, color: [1, 0.7, 0.35], alpha: 1 });
    for (let k = 0; k < 6; k++) {
      this.fire.spawn(x, y + 1, z, { vx: (this.rand() - 0.5) * 30, vy: 6 + this.rand() * 14, vz: (this.rand() - 0.5) * 30, size: 1.4, life: 0.5, color: [1, 0.6, 0.25] });
    }
    this.smoke.spawn(x, y + 3, z, { vy: 3.5, vx: 1, size: 18, grow: 26, life: 6, color: [0.45, 0.43, 0.4], alpha: 0.65 });
    this.smoke.spawn(x + 2, y + 2, z - 1, { vy: 2.5, size: 12, grow: 18, life: 5, color: [0.3, 0.28, 0.26], alpha: 0.55 });
    this.flashLight.position.set(x, y + 10, z);
    this.flashLight.intensity = Math.max(this.flashLight.intensity, 4000);
    // scorch mark
    if (this.nScorch < this.maxScorch) {
      const m4 = new THREE.Matrix4().makeScale(2.5 + this.rand() * 2, 1, 2.5 + this.rand() * 2).setPosition(x, y + 0.25, z);
      this.scorch.setMatrixAt(this.nScorch++, m4);
      this.scorch.count = this.nScorch;
      this.scorch.instanceMatrix.needsUpdate = true;
    }
    if (this.def.roofDamage && s.roof != null) this.town?.setRoofDamage?.(s.roof, 1);
    if (this.def.fires && this.rand() < this.def.fires && this.fires.length < 50) {
      this.fires.push({ x, y, z, until: this.time + 6 + this.rand() * 12, size: 0.8 + this.rand() * 0.8 });
    }
  }

  /** Current beat for a list of {t, ...} beats */
  beatAt(beats) {
    let cur = beats[0];
    for (const b of beats) if (this.progress >= b.t) cur = b;
    return cur;
  }

  dispose() {
    this._off?.();
    this.reset();
    this.engine.scene.remove(this.group);
  }
}
