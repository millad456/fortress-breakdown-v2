// Fields of fire, computed from the plan rather than hand-drawn.
// For each gun position, cast rays every few degrees out to its range; each ray stops at the first
// point inside the town ring, or where the ground rises above what the guns can reach
// (gunY + 6 + 0.22·distance). The reachable ground becomes a terrain-hugging fan.
import * as THREE from 'three';

/**
 * @returns {{a:number, r0:number, r1:number}[]} rays (r1 <= r0 means blocked)
 */
export function castFan({ x, z, y, range, heightAt, inside, angStep = 3, step = 2, maxInsideStart = 30 }) {
  const rays = [];
  for (let deg = 0; deg < 360; deg += angStep) {
    const a = (deg * Math.PI) / 180;
    const cx = Math.cos(a), cz = Math.sin(a);
    let r = 0, r0 = 0;
    // a gun on the circuit starts inside or on the ring: walk out first
    if (inside(x, z)) {
      while (r <= maxInsideStart && inside(x + cx * r, z + cz * r)) r += 0.5;
      if (r > maxInsideStart) {
        rays.push({ a, r0: 0, r1: 0 });
        continue;
      }
    }
    r0 = r + 0.5;
    let r1 = r0;
    for (let s = r0; s <= range; s += step) {
      const px = x + cx * s, pz = z + cz * s;
      if (inside(px, pz)) break;
      const g = Math.max(0, heightAt(px, pz));
      if (g > y + 6 + 0.22 * s) break;
      r1 = s;
    }
    rays.push({ a, r0, r1 });
  }
  return rays;
}

/** Build the fan triangles over the ground. Triangles touching the inside of the walls are dropped. */
export function fanGeometry(gun, rays, { heightAt, ring, ringBox, lift = 1.4, radialStep = 5 }) {
  const pos = [], frac = [];
  const P = (ray, k, n) => {
    const r = ray.r0 + (ray.r1 - ray.r0) * (k / n);
    const px = gun.x + Math.cos(ray.a) * r, pz = gun.z + Math.sin(ray.a) * r;
    return [px, Math.max(0, heightAt(px, pz)) + lift, pz, r / gun.range];
  };
  const tris = [];
  for (let i = 0; i < rays.length; i++) {
    const A = rays[i], B = rays[(i + 1) % rays.length];
    if (A.r1 - A.r0 < 1 || B.r1 - B.r0 < 1) continue;
    const n = Math.max(2, Math.ceil(Math.max(A.r1 - A.r0, B.r1 - B.r0) / radialStep));
    for (let k = 0; k < n; k++) {
      const a0 = P(A, k, n), a1 = P(A, k + 1, n), b0 = P(B, k, n), b1 = P(B, k + 1, n);
      tris.push([a0, b0, a1], [a1, b0, b1]);
    }
  }
  for (const t of tris) {
    if (triangleOverlapsRing(t, ring, ringBox)) continue;
    for (const v of t) {
      pos.push(v[0], v[1], v[2]);
      frac.push(v[3]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFrac', new THREE.Float32BufferAttribute(frac, 1));
  return g;
}

/**
 * Exact overlap test between a triangle ([x, y, z] corners) and the interior of a polygon ring:
 * a corner inside the ring, a ring vertex inside the triangle, or crossing edges.
 */
export function triangleOverlapsRing(t, ring, ringBox) {
  const [a, b, c] = t;
  const tx0 = Math.min(a[0], b[0], c[0]), tx1 = Math.max(a[0], b[0], c[0]);
  const tz0 = Math.min(a[2], b[2], c[2]), tz1 = Math.max(a[2], b[2], c[2]);
  if (tx1 < ringBox[0] || tx0 > ringBox[2] || tz1 < ringBox[1] || tz0 > ringBox[3]) return false;
  for (const p of t) if (pointIn(p[0], p[2], ring)) return true;
  const T = [[a[0], a[2]], [b[0], b[2]], [c[0], c[2]]];
  for (const q of ring) {
    if (q[0] < tx0 || q[0] > tx1 || q[1] < tz0 || q[1] > tz1) continue;
    if (inTri(q, T)) return true;
  }
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    if (Math.max(p[0], q[0]) < tx0 || Math.min(p[0], q[0]) > tx1 || Math.max(p[1], q[1]) < tz0 || Math.min(p[1], q[1]) > tz1) continue;
    for (let k = 0; k < 3; k++) if (segX(p, q, T[k], T[(k + 1) % 3])) return true;
  }
  return false;
}
function pointIn(x, z, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function inTri(p, [a, b, c]) {
  const d1 = cr(a, b, p), d2 = cr(b, c, p), d3 = cr(c, a, p);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
function segX(p1, p2, p3, p4) {
  const d1 = cr(p3, p4, p1), d2 = cr(p3, p4, p2), d3 = cr(p1, p2, p3), d4 = cr(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function fanMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: { value: 0 } },
    vertexShader: `attribute float aFrac; varying float vF; void main(){ vF = aFrac; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity, uTime; varying float vF;
      void main(){
        // a thin band sweeping outward from each gun
        float d = fract(uTime * 0.35 - vF);
        float pulse = 1.0 - smoothstep(0.0, 0.07, d);
        float edge = 1.0 - smoothstep(0.85, 1.0, vF);
        float a = uOpacity * (0.55 + 0.45 * vF) * edge + pulse * 0.35 * uOpacity;
        gl_FragColor = vec4(uColor * (1.0 + pulse * 0.6), a);
      }`,
    toneMapped: false,
  });
}

/** The whole fields-of-fire layer for a list of guns. */
export function buildFireLayer({ guns, classes, heightAt, inside, ring, chain }) {
  const ringBox = boxOf(ring);
  const group = new THREE.Group();
  group.name = 'fields-of-fire';
  const mats = {};
  for (const [k, c] of Object.entries(classes)) mats[k] = fanMaterial(c.color, c.opacity);
  const fans = [];
  for (const gun of guns) {
    const rays = castFan({ ...gun, heightAt, inside });
    const geom = fanGeometry(gun, rays, { heightAt, ring, ringBox });
    const m = new THREE.Mesh(geom, mats[gun.kind]);
    m.renderOrder = gun.kind === 'fort' ? 4 : 3;
    group.add(m);
    fans.push({ gun, rays, mesh: m, tris: geom.getAttribute('position').count / 3 });
  }
  if (chain) {
    const [a, b] = chain;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, 1.2 - Math.sin(t * Math.PI) * 0.6, a[1] + (b[1] - a[1]) * t));
    }
    const lg = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xffe08a, dashSize: 4, gapSize: 3, linewidth: 2, toneMapped: false }));
    line.computeLineDistances();
    line.name = 'harbour-chain';
    group.add(line);
  }
  return {
    group, fans,
    update(t) {
      for (const m of Object.values(mats)) m.uniforms.uTime.value = t;
    },
  };
}

export function boxOf(r) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return [x0, z0, x1, z1];
}
