// Generic curtain wall: sweeps a wall profile (outer face, parapet, wall walk, inner kerb,
// inner face) along a clockwise ring of the OUTER face, extruding inward by a per-side thickness.
import * as THREE from 'three';
import { merlonMatrices, instanced, unitBox, sanitizeNormals } from './kit.js';

/**
 * @param {object} o
 * @param {number[][]} o.ring outer face, clockwise on a north-up map
 * @param {(i:number)=>string} o.sideOf side key of ring vertex i
 * @param {Record<string,{thick:number,height:number}>} o.sides
 * @param {(x,z)=>number} o.heightAt
 * @param {Record<string,THREE.Material>} o.materials per side
 * @param {THREE.Material} o.merlonMaterial
 */
export function buildWallRing(o) {
  const { ring, sideOf, sides, heightAt } = o;
  const n = ring.length;
  const PARAPET = 1.7, PT = 0.7, KERB = 0.55;

  // per-vertex frames
  const V = ring.map((p, i) => {
    const a = ring[(i - 1 + n) % n], b = ring[(i + 1) % n];
    const e1 = norm2(p[0] - a[0], p[1] - a[1]), e2 = norm2(b[0] - p[0], b[1] - p[1]);
    const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]];
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const cos = Math.max(0.5, mx * n1[0] + mz * n1[1]);
    const side = sideOf(i);
    return { p, n: [mx, mz], miter: 1 / cos, side, thick: sides[side].thick };
  });
  // smooth the thickness across side changes so the inner face has no steps
  const thick = V.map((v, i) => {
    let s = 0, c = 0;
    for (let k = -2; k <= 2; k++) { s += V[(i + k + n) % n].thick; c++; }
    return s / c;
  });
  V.forEach((v, i) => {
    v.thick = thick[i];
    v.inner = [v.p[0] - v.n[0] * v.thick * v.miter, v.p[1] - v.n[1] * v.thick * v.miter];
    const out = [v.p[0] + v.n[0] * 4, v.p[1] + v.n[1] * 4];
    const inn = [v.inner[0] - v.n[0] * 3, v.inner[1] - v.n[1] * 3];
    v.gOut = Math.max(0, heightAt(out[0], out[1]));
    v.gIn = heightAt(inn[0], inn[1]);
    v.gFoot = Math.min(v.gOut, heightAt(v.p[0], v.p[1]));
  });
  // crest: ground outside + side height, never lower than the lanes behind, smoothed
  let crest = V.map((v) => Math.max(v.gOut + sides[v.side].height, v.gIn + 5.5));
  for (let it = 0; it < 6; it++) {
    crest = crest.map((c, i) => {
      const a = crest[(i - 1 + n) % n], b = crest[(i + 1) % n];
      return Math.max(V[i].gIn + 5, c * 0.5 + (a + b) * 0.25);
    });
  }
  V.forEach((v, i) => (v.crest = crest[i]));

  // profile (offset inward from the outer face, y) for vertex v
  const profile = (v) => {
    const t = v.thick, c = v.crest, bot = Math.min(v.gFoot, v.gIn) - 8;
    return [
      [0, bot], [0, c + PARAPET], [PT, c + PARAPET], [PT, c], [t - 0.45, c], [t - 0.45, c + KERB], [t, c + KERB], [t, Math.min(v.gIn - 2, c - 1)],
    ];
  };

  const meshes = {};
  const merlons = {};
  // ranges: contiguous runs of the same side
  const runs = [];
  for (let i = 0; i < n; i++) {
    if (!runs.length || runs[runs.length - 1].side !== V[i].side) runs.push({ side: V[i].side, from: i, to: i });
    else runs[runs.length - 1].to = i;
  }
  if (runs.length > 1 && runs[0].side === runs[runs.length - 1].side) {
    const last = runs.pop();
    runs[0].from = last.from - n;
  }
  const bySide = {};
  for (const r of runs) (bySide[r.side] ||= []).push(r);

  let along = 0;
  const alongAt = [0];
  for (let i = 1; i <= n; i++) {
    along += Math.hypot(ring[i % n][0] - ring[i - 1][0], ring[i % n][1] - ring[i - 1][1]);
    alongAt.push(along);
  }

  for (const [side, rs] of Object.entries(bySide)) {
    const pos = [], uv = [];
    const merl = [];
    for (const r of rs) {
      // include the next vertex so runs join without gaps
      for (let ii = r.from; ii <= r.to; ii++) {
        const i = (ii + n) % n, j = (i + 1) % n;
        const A = V[i], B = V[j];
        const pa = profile(A), pb = profile(B);
        const ua = alongAt[i] / 4, ub = (j === 0 ? alongAt[n] : alongAt[j]) / 4;
        for (let k = 0; k < pa.length - 1; k++) {
          const P = (v, pr) => [v.p[0] - v.n[0] * pr[0] * v.miter, pr[1], v.p[1] - v.n[1] * pr[0] * v.miter];
          const a0 = P(A, pa[k]), a1 = P(A, pa[k + 1]), b1 = P(B, pb[k + 1]), b0 = P(B, pb[k]);
          // vertical faces use height for v; horizontal ones use the offset
          const vert = Math.abs(pa[k][0] - pa[k + 1][0]) < 0.01;
          const va0 = vert ? pa[k][1] / 4 : pa[k][0] / 4, va1 = vert ? pa[k + 1][1] / 4 : pa[k + 1][0] / 4;
          const vb0 = vert ? pb[k][1] / 4 : pb[k][0] / 4, vb1 = vert ? pb[k + 1][1] / 4 : pb[k + 1][0] / 4;
          pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
          uv.push(ua, va0, ua, va1, ub, vb1, ua, va0, ub, vb1, ub, vb0);
        }
        merl.push([A.p[0] - A.n[0] * 0.35 * A.miter, A.p[1] - A.n[1] * 0.35 * A.miter, A.crest + PARAPET]);
      }
      const j = (r.to + 1 + n) % n;
      merl.push([V[j].p[0] - V[j].n[0] * 0.35 * V[j].miter, V[j].p[1] - V[j].n[1] * 0.35 * V[j].miter, V[j].crest + PARAPET]);
      merl.push(null); // break between runs
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    sanitizeNormals(g);
    const mesh = new THREE.Mesh(g, o.materials[side]);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = 'wall-' + side;
    meshes[side] = mesh;

    // merlons along the outer edge
    const mats = [];
    let seg = [];
    const flush = () => {
      if (seg.length > 1) {
        const pts = seg.map((s) => [s[0], s[1]]);
        const ys = seg.map((s) => s[2]);
        mats.push(...merlonMatrices(pts, (x, z, i, t) => ys[i] + (ys[i + 1] - ys[i]) * t, { closed: false, spacing: 2.8, inset: 0, w: 1.3, h: 1.0, d: PT }));
      }
      seg = [];
    };
    for (const m of merl) (m ? seg.push(m) : flush());
    flush();
    merlons[side] = instanced(unitBox, o.merlonMaterial, mats, 'merlons-' + side);
  }

  /** wall-walk height at the ring vertex nearest (x, z) */
  const walkAt = (x, z) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = (V[i].p[0] - x) ** 2 + (V[i].p[1] - z) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return V[bi].crest;
  };
  return { meshes, merlons, verts: V, walkAt, runs: bySide };
}

function norm2(x, z) {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}
