// Effects: GPU particle pools (smoke, fire, flashes, trails) and low-poly instanced ships.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A pool of soft round particles drawn as one Points object. */
export class ParticlePool {
  constructor(max, { additive = false, name = 'particles' } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.grow = new Float32Array(max);
    this.base = new Float32Array(max * 4);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `
        attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec4 vC;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
          float a = vC.a * (1.0 - smoothstep(0.0, 1.0, r)) * (0.7 + 0.3 * (1.0 - r));
          gl_FragColor = vec4(vC.rgb, a); }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.name = name;
    this.points.renderOrder = additive ? 6 : 5;
  }
  setScale(h) {
    this.points.material.uniforms.uScale.value = h * 0.75;
  }
  spawn(x, y, z, { vx = 0, vy = 0, vz = 0, size = 4, grow = 0, life = 2, color = [1, 1, 1], alpha = 1 } = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.size[i] = size;
    this.grow[i] = grow;
    this.life[i] = life;
    this.age[i] = 0;
    this.base[i * 4] = color[0]; this.base[i * 4 + 1] = color[1]; this.base[i * 4 + 2] = color[2]; this.base[i * 4 + 3] = alpha;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.col[i * 4 + 3] = 0;
        continue;
      }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) {
        this.life[i] = 0;
        this.col[i * 4 + 3] = 0;
        this.size[i] = 0;
        continue;
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.col[i * 4] = this.base[i * 4];
      this.col[i * 4 + 1] = this.base[i * 4 + 1];
      this.col[i * 4 + 2] = this.base[i * 4 + 2];
      this.col[i * 4 + 3] = this.base[i * 4 + 3] * Math.min(1, t * 8) * (1 - t);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }
  clear() {
    this.life.fill(0);
    this.col.fill(0);
    this.size.fill(0);
    this.points.geometry.attributes.aColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- ships
function hull(len, beam, depth, taper = 0.35) {
  const g = new THREE.BoxGeometry(beam, depth, len, 1, 1, 4);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / (len / 2); // -1 stern .. 1 bow
    const k = 1 - Math.pow(Math.abs(z), 2.2) * (1 - taper);
    p.setX(i, p.getX(i) * k);
    if (p.getY(i) < 0) p.setX(i, p.getX(i) * 0.6);
  }
  g.computeVertexNormals();
  return g;
}
const tint = (g, c) => {
  const n = g.getAttribute('position').count, col = new Float32Array(n * 3);
  const cc = new THREE.Color(c);
  for (let i = 0; i < n; i++) { col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g.index ? g.toNonIndexed() : g;
};

/** Geometry for one ship kind, with vertex colours: hull white (tinted per instance), sails from `sail`. */
export function shipGeometry(kind, sail = '#efe6d2') {
  const parts = [];
  if (kind === 'galley') {
    const h = hull(26, 4, 1.6);
    h.translate(0, 0.6, 0);
    parts.push(tint(h, '#ffffff'));
    for (const s of [-1, 1]) {
      const oars = new THREE.BoxGeometry(5, 0.15, 16);
      oars.translate(s * 3.6, 0.2, 0);
      parts.push(tint(oars, '#5a4632'));
    }
    const mast = new THREE.CylinderGeometry(0.15, 0.2, 10, 5);
    mast.translate(0, 5.5, 2);
    parts.push(tint(mast, '#4a3828'));
    const sl = new THREE.BufferGeometry();
    sl.setAttribute('position', new THREE.Float32BufferAttribute([0, 10.5, 9, 0, 1.6, -4, 0, 1.6, 6, 0, 10.5, 9, 0, 1.6, 6, 0, 1.6, -4], 3));
    sl.computeVertexNormals();
    parts.push(tint(sl, sail));
  } else if (kind === 'sail') {
    const h = hull(32, 7, 4, 0.45);
    h.translate(0, 1.2, 0);
    parts.push(tint(h, '#ffffff'));
    for (const [z, hgt] of [[-9, 16], [1, 20], [10, 15]]) {
      const mast = new THREE.CylinderGeometry(0.25, 0.3, hgt, 5);
      mast.translate(0, 3 + hgt / 2, z);
      parts.push(tint(mast, '#3a2a1c'));
      for (const y of [hgt * 0.45, hgt * 0.8]) {
        const s = new THREE.BoxGeometry(9, hgt * 0.3, 0.15);
        s.translate(0, 3 + y, z);
        parts.push(tint(s, sail));
      }
    }
  } else {
    // a grey gunboat
    const h = hull(30, 5, 2.4, 0.3);
    h.translate(0, 0.9, 0);
    parts.push(tint(h, '#ffffff'));
    const sup = new THREE.BoxGeometry(3, 2.6, 8);
    sup.translate(0, 3.2, -2);
    parts.push(tint(sup, '#c9ced3'));
    const mast = new THREE.CylinderGeometry(0.15, 0.15, 6, 5);
    mast.translate(0, 6.5, -2);
    parts.push(tint(mast, '#7a8086'));
    const gun = new THREE.BoxGeometry(0.4, 0.4, 4);
    gun.translate(0, 2.6, 9);
    parts.push(tint(gun, '#3a3f44'));
  }
  const g = mergeGeometries(parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k);
    if (!q.getAttribute('normal')) q.computeVertexNormals();
    return q;
  }));
  g.computeVertexNormals();
  return g;
}

/** Instanced fleet: count ships of one kind, positioned each frame by a callback. */
export class Fleet {
  constructor(kind, count, { color = '#6b4a30', sail } = {}) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(shipGeometry(kind, sail), mat, count);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, c.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.06));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'fleet-' + kind;
    this.count = count;
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
  }
  set(i, x, y, z, heading, roll = 0, scale = 1) {
    this.q.setFromEuler(new THREE.Euler(0, heading, roll, 'YXZ'));
    this.m4.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(scale, scale, scale));
    this.mesh.setMatrixAt(i, this.m4);
  }
  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
