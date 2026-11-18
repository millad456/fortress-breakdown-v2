// Shared helpers for the offline data scripts.
import { readFileSync } from 'node:fs';

export const LAT0 = 42.64145;
export const LON0 = 18.1065;
export const M_PER_LAT = 111320;
export const M_PER_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);

/** lat/lon -> local frame [x east, z south] in metres */
export function project(lat, lon) {
  return [(lon - LON0) * M_PER_LON, -(lat - LAT0) * M_PER_LAT];
}

export function loadOsm(path = 'cache/osm-dubrovnik.json') {
  const d = JSON.parse(readFileSync(path, 'utf8'));
  const nodes = new Map();
  const ways = new Map();
  const rels = [];
  for (const e of d.elements) {
    if (e.type === 'node') nodes.set(e.id, e);
    else if (e.type === 'way') ways.set(e.id, e);
    else if (e.type === 'relation') rels.push(e);
  }
  const pts = (w) => w.nodes.filter((id) => nodes.has(id)).map((id) => project(nodes.get(id).lat, nodes.get(id).lon));
  return { nodes, ways, rels, pts, elements: d.elements };
}

export function signedArea(r) {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const [x1, z1] = r[i];
    const [x2, z2] = r[(i + 1) % n];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export function centroid(r) {
  let x = 0, z = 0;
  for (const p of r) { x += p[0]; z += p[1]; }
  return [x / r.length, z / r.length];
}

export function pointInRing(x, z, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function segDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx - px, qz = az + t * dz - pz;
  return qx * qx + qz * qz;
}

/** Douglas–Peucker on an open polyline; tol may be a function of the point. */
export function simplify(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const tf = typeof tol === 'function' ? tol : () => tol;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
      if (d > best) { best = d; bi = i; }
    }
    const t = tf(pts[bi] || pts[a]);
    if (bi > 0 && best > t * t) {
      keep[bi] = 1;
      stack.push([a, bi], [bi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Simplify a closed ring (no repeated last point). */
export function simplifyRing(r, tol) {
  if (r.length < 5) return r.slice();
  // split at the farthest point from r[0] so DP has two stable anchors
  let far = 0, fd = -1;
  for (let i = 1; i < r.length; i++) {
    const d = (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  const a = simplify(r.slice(0, far + 1), tol);
  const b = simplify(r.slice(far).concat([r[0]]), tol);
  return a.concat(b.slice(1, -1));
}

export function openRing(r) {
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) return r.slice(0, -1);
  return r;
}

export const round1 = (v) => Math.round(v * 10) / 10;
export const roundPts = (r) => r.map(([x, z]) => [round1(x), round1(z)]);
