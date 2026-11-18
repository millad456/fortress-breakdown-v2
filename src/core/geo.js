// Geometry helpers shared by the site and the offline scripts (no three.js here).

/** Decode a delta-encoded ring (decimetres) into [[x, z], ...] metres. */
export function decodeRing(flat) {
  const out = [];
  let x = 0, z = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i]; z += flat[i + 1];
    out.push([x / 10, z / 10]);
  }
  return out;
}

export function signedArea(r) {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const p = r[i], q = r[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function centroid(r) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const p = r[i], q = r[(i + 1) % n];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f; cx += (p[0] + q[0]) * f; cz += (p[1] + q[1]) * f;
  }
  if (Math.abs(a) < 1e-6) {
    let x = 0, z = 0;
    for (const p of r) { x += p[0]; z += p[1]; }
    return [x / r.length, z / r.length];
  }
  return [cx / (3 * a), cz / (3 * a)];
}

export function pointInRing(x, z, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function bbox(r) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of r) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return [x0, z0, x1, z1];
}

export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px, qz = az + t * dz - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

export function distToPolyline(px, pz, pts, closed = false) {
  let best = Infinity;
  const n = pts.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const d = segDist(px, pz, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

/** Nearest point on a polyline: { d, x, z, i (segment), t } */
export function nearestOnPolyline(px, pz, pts, closed = false) {
  let best = { d: Infinity, x: 0, z: 0, i: 0, t: 0 };
  const n = pts.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const x = a[0] + t * dx, z = a[1] + t * dz;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, x, z, i, t };
  }
  return best;
}

/**
 * Spatial index over polyline edges: edges are chunked into short runs, each with a
 * bounding box, so distance and point-in-ring queries only visit nearby chunks.
 */
export class EdgeIndex {
  constructor(rings, chunk = 12) {
    this.chunks = [];
    for (const { pts, closed } of rings) {
      const n = pts.length, m = closed ? n : n - 1;
      for (let s = 0; s < m; s += chunk) {
        const e = Math.min(m, s + chunk);
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        const seg = new Float64Array((e - s) * 4);
        for (let i = s, k = 0; i < e; i++, k += 4) {
          const a = pts[i], b = pts[(i + 1) % n];
          seg[k] = a[0]; seg[k + 1] = a[1]; seg[k + 2] = b[0]; seg[k + 3] = b[1];
          x0 = Math.min(x0, a[0], b[0]); x1 = Math.max(x1, a[0], b[0]);
          z0 = Math.min(z0, a[1], b[1]); z1 = Math.max(z1, a[1], b[1]);
        }
        this.chunks.push({ x0, x1, z0, z1, seg });
      }
    }
  }
  /** distance to the nearest edge; anything beyond `cap` returns `cap` */
  dist(px, pz, cap = Infinity) {
    let best = cap;
    for (const c of this.chunks) {
      const dx = px < c.x0 ? c.x0 - px : px > c.x1 ? px - c.x1 : 0;
      const dz = pz < c.z0 ? c.z0 - pz : pz > c.z1 ? pz - c.z1 : 0;
      if (dx * dx + dz * dz >= best * best) continue;
      const s = c.seg;
      for (let k = 0; k < s.length; k += 4) {
        const d = segDist(px, pz, s[k], s[k + 1], s[k + 2], s[k + 3]);
        if (d < best) best = d;
      }
    }
    return best;
  }
  /** even-odd crossing test over all rings in the index (casts a ray towards -x) */
  inside(px, pz) {
    let inside = false;
    for (const c of this.chunks) {
      if (pz < c.z0 || pz > c.z1 || px < c.x0) continue;
      const s = c.seg;
      for (let k = 0; k < s.length; k += 4) {
        const xi = s[k], zi = s[k + 1], xj = s[k + 2], zj = s[k + 3];
        if ((zi > pz) !== (zj > pz) && px > ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
      }
    }
    return inside;
  }
}
