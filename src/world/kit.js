// Building kit: prisms from footprints, sweeps, merlons, arches, stone textures, merging.
// Footprints are [[x, z], ...]; winding is normalised here from the signed area.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { signedArea, centroid } from '../core/geo.js';
import { rng } from '../core/noise.js';

export { mergeGeometries };

/** Clockwise on a north-up map (x east, z south) = positive signed area. */
export function normaliseRing(r) {
  return signedArea(r) < 0 ? r.slice().reverse() : r.slice();
}

/** Offset a closed (clockwise) ring outward by d (negative = inward), mitred and clamped. */
export function offsetRing(r, d) {
  const n = r.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = r[(i - 1 + n) % n], b = r[i], c = r[(i + 1) % n];
    const n1 = edgeNormal(a, b), n2 = edgeNormal(b, c);
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const cos = mx * n1[0] + mz * n1[1];
    const k = d / Math.max(cos, 0.45);
    out.push([b[0] + mx * k, b[1] + mz * k]);
  }
  return out;
}
export function edgeNormal(a, b) {
  const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
  return [tz / l, -tx / l]; // outward for clockwise rings
}

export function scaleRing(r, s, about = centroid(r)) {
  return r.map(([x, z]) => [about[0] + (x - about[0]) * s, about[1] + (z - about[1]) * s]);
}

export function circleRing(cx, cz, rad, seg = 24) {
  const out = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rad, cz - Math.sin(a) * rad]);
  }
  return normaliseRing(out);
}

/** Triangulated cap of a ring at height y (face up if up=true). */
export function capGeometry(r, y, up = true) {
  r = normaliseRing(r);
  const v2 = r.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(v2, []);
  const pos = [];
  for (const t of tris) {
    const [a, b, c] = t.map((i) => r[i]);
    // cross of (b-a)x(c-a) in y: (bz-az)(cx-ax) - (bx-ax)(cz-az) > 0 means facing +y
    const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    const flip = (ny > 0) !== up;
    const tri = flip ? [a, c, b] : [a, b, c];
    for (const p of tri) pos.push(p[0], y, p[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  addPlanarUV(g, 4);
  g.computeVertexNormals();
  return g;
}

/**
 * Prism from a footprint. y0/y1 are numbers or functions (x, z) => y.
 * Side UVs run along the perimeter so the stone texture wraps.
 */
export function prism(r, y0, y1, { top = true, bottom = false, uvScale = 4 } = {}) {
  r = normaliseRing(r);
  const f0 = typeof y0 === 'function' ? y0 : () => y0;
  const f1 = typeof y1 === 'function' ? y1 : () => y1;
  const pos = [], uv = [];
  let run = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const a0 = f0(a[0], a[1]), a1 = f1(a[0], a[1]), b0 = f0(b[0], b[1]), b1 = f1(b[0], b[1]);
    const u0 = run / uvScale, u1 = (run + len) / uvScale;
    // quad A(a,bottom) B(a,top) C(b,top) D(b,bottom): normal points outward for clockwise rings
    pos.push(a[0], a0, a[1], a[0], a1, a[1], b[0], b1, b[1], a[0], a0, a[1], b[0], b1, b[1], b[0], b0, b[1]);
    uv.push(u0, a0 / uvScale, u0, a1 / uvScale, u1, b1 / uvScale, u0, a0 / uvScale, u1, b1 / uvScale, u1, b0 / uvScale);
    run += len;
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const parts = [g];
  if (top) {
    const cap = capGeometry(r, 0, true);
    // the cap follows the per-vertex top height (sloping walls keep a sloping top)
    const cp = cap.getAttribute('position');
    for (let i = 0; i < cp.count; i++) cp.setY(i, f1(cp.getX(i), cp.getZ(i)));
    cap.computeVertexNormals();
    parts.push(cap);
  }
  if (bottom) parts.push(capGeometry(r, typeof y0 === 'function' ? 0 : y0, false));
  g = mergeGeometries(parts.map(nonIndexed), false);
  g.computeVertexNormals();
  return g;
}

/** Replace zero-length or NaN normals (from degenerate triangles) with straight up. */
export function sanitizeNormals(g) {
  const n = g.getAttribute('normal');
  if (!n) return g;
  const a = n.array;
  for (let i = 0; i < a.length; i += 3) {
    const l = a[i] * a[i] + a[i + 1] * a[i + 1] + a[i + 2] * a[i + 2];
    if (!(l > 1e-8)) { a[i] = 0; a[i + 1] = 1; a[i + 2] = 0; }
  }
  n.needsUpdate = true;
  return g;
}

export function nonIndexed(g) {
  const n = g.index ? g.toNonIndexed() : g;
  if (!n.getAttribute('uv')) addPlanarUV(n, 4);
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  if (!n.getAttribute('normal')) n.computeVertexNormals();
  return n;
}

export function addPlanarUV(g, s = 4) {
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / s;
    uv[i * 2 + 1] = p.getZ(i) / s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Hollow ring wall (parapet) around a footprint: outer face at r, inner at r inset by t. */
export function parapet(r, y0, h, t = 0.6) {
  r = normaliseRing(r);
  const inner = offsetRing(r, -t);
  const outer = prism(r, y0, y0 + h, { top: false });
  const inn = prism(inner, y0, y0 + h, { top: false });
  flipFaces(inn);
  // top band
  const pos = [];
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length, y = y0 + h;
    const a = r[i], b = r[j], c = inner[j], d = inner[i];
    pos.push(a[0], y, a[1], d[0], y, d[1], c[0], y, c[1], a[0], y, a[1], c[0], y, c[1], b[0], y, b[1]);
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  addPlanarUV(top);
  fixUp(top);
  const g = mergeGeometries([outer, inn, top].map(nonIndexed));
  g.computeVertexNormals();
  return g;
}

/** Make sure every triangle of a flat horizontal geometry faces +y. */
export function fixUp(g) {
  const p = g.getAttribute('position').array;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5], cx = p[i + 6], cz = p[i + 8];
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny < 0) {
      for (let k = 0; k < 3; k++) {
        const t = p[i + 3 + k];
        p[i + 3 + k] = p[i + 6 + k];
        p[i + 6 + k] = t;
      }
    }
  }
  return g;
}

export function flipFaces(g) {
  const p = g.getAttribute('position').array;
  const uv = g.getAttribute('uv')?.array;
  for (let i = 0; i < p.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = p[i + 3 + k];
      p[i + 3 + k] = p[i + 6 + k];
      p[i + 6 + k] = t;
    }
  }
  if (uv) for (let i = 0; i < uv.length; i += 6) {
    for (let k = 0; k < 2; k++) {
      const t = uv[i + 2 + k];
      uv[i + 2 + k] = uv[i + 4 + k];
      uv[i + 4 + k] = t;
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Matrices for merlons spaced along the edges of a closed ring (or open polyline). */
export function merlonMatrices(r, yAt, { spacing = 3, closed = true, inset = 0.3, w = 1.5, h = 1.1, d = 0.6 } = {}) {
  const out = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(w, h, d), up = new THREE.Vector3(0, 1, 0);
  const n = r.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = r[i], b = r[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) continue;
    const nrm = edgeNormal(a, b);
    const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    q.setFromAxisAngle(up, ang);
    const cnt = Math.max(1, Math.floor(len / spacing));
    for (let k = 0; k < cnt; k++) {
      const t = (k + 0.5) / cnt;
      const x = a[0] + (b[0] - a[0]) * t - nrm[0] * inset, z = a[1] + (b[1] - a[1]) * t - nrm[1] * inset;
      const y = typeof yAt === 'function' ? yAt(x, z, i, t) : yAt;
      m.compose(new THREE.Vector3(x, y + h / 2, z), q, s);
      out.push(m.clone());
    }
  }
  return out;
}

export function instanced(geo, mat, matrices, name) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length));
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.count = matrices.length;
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = true;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  if (name) im.name = name;
  return im;
}

export const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** Gable roof unit: ridge along local x, width along z, height 1, base at y=0. */
export function gableGeometry(over = 0.06) {
  const w = 0.5 + over, l = 0.5 + over;
  const v = [
    // two slopes
    -l, 0, w, l, 0, w, l, 1, 0, -l, 0, w, l, 1, 0, -l, 1, 0,
    l, 0, -w, -l, 0, -w, -l, 1, 0, l, 0, -w, -l, 1, 0, l, 1, 0,
    // gable ends
    l, 0, w, l, 0, -w, l, 1, 0,
    -l, 0, -w, -l, 0, w, -l, 1, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  addPlanarUV(g, 1);
  return g;
}

/** Hipped roof over an arbitrary footprint: the eaves shrink towards the centroid. */
export function hippedRoof(r, y, h, { shrink = 0.32, over = 0.4 } = {}) {
  r = normaliseRing(r);
  const eave = offsetRing(r, over);
  const c = centroid(r);
  const ridge = eave.map(([x, z]) => [c[0] + (x - c[0]) * shrink, c[1] + (z - c[1]) * shrink]);
  const pos = [];
  for (let i = 0; i < eave.length; i++) {
    const j = (i + 1) % eave.length;
    const a = eave[i], b = eave[j], cc = ridge[j], d = ridge[i];
    pos.push(a[0], y, a[1], d[0], y + h, d[1], cc[0], y + h, cc[1], a[0], y, a[1], cc[0], y + h, cc[1], b[0], y, b[1]);
  }
  const sides = new THREE.BufferGeometry();
  sides.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // make slopes face outward/up
  const p = sides.getAttribute('position').array;
  for (let i = 0; i < p.length; i += 9) {
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2];
    const vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
    const ny = uz * vx - ux * vz;
    void uy; void vy;
    if (ny < 0) for (let k = 0; k < 3; k++) {
      const t = p[i + 3 + k];
      p[i + 3 + k] = p[i + 6 + k];
      p[i + 6 + k] = t;
    }
  }
  addPlanarUV(sides, 2);
  const g = mergeGeometries([nonIndexed(sides), nonIndexed(capGeometry(ridge, y + h, true))]);
  g.computeVertexNormals();
  return g;
}

/** A half-ring arch (for bridges and gates): spans along local x, opening width w. */
export function archGeometry(w, depth, thick = 0.9, seg = 10) {
  const g = new THREE.TorusGeometry(w / 2 + thick / 2, thick / 2, 6, seg, Math.PI);
  g.scale(1, 1, depth / thick);
  return g;
}

// ---- procedural textures -------------------------------------------------
const texCache = new Map();
/** Ashlar stone: courses of blocks with mortar joints and weathering. */
export function stoneTexture(key = 'stone', { base = [214, 202, 178], var: vr = 22, courses = 8, seed = 7 } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const rand = rng(seed);
  ctx.fillStyle = `rgb(${base.map((v) => v - 40).join(',')})`;
  ctx.fillRect(0, 0, S, S);
  const ch = S / courses;
  for (let row = 0; row < courses; row++) {
    let x = -rand() * 60;
    while (x < S) {
      const w = 40 + rand() * 70;
      const k = (rand() - 0.5) * vr;
      ctx.fillStyle = `rgb(${base.map((v) => Math.round(v + k + (rand() - 0.5) * 8)).join(',')})`;
      ctx.fillRect(x + 1.5, row * ch + 1.5, w - 3, ch - 3);
      x += w;
    }
  }
  // weathering streaks + speckle
  for (let i = 0; i < 2600; i++) {
    const a = rand() * 0.08;
    ctx.fillStyle = rand() > 0.5 ? `rgba(60,50,40,${a})` : `rgba(255,250,240,${a})`;
    ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 3, 1 + rand() * 3);
  }
  for (let i = 0; i < 40; i++) {
    const x = rand() * S, g = ctx.createLinearGradient(x, 0, x, S * (0.3 + rand() * 0.6));
    g.addColorStop(0, 'rgba(70,60,50,0.12)');
    g.addColorStop(1, 'rgba(70,60,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 3 + rand() * 8, S);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Terracotta roof tiles. */
export function tileTexture() {
  if (texCache.has('tile')) return texCache.get('tile');
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const rand = rng(3);
  ctx.fillStyle = '#b9b9b9';
  ctx.fillRect(0, 0, S, S);
  const rows = 16, cols = 12;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = 200 + rand() * 55;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    const x = (c + (r % 2) * 0.5) * (S / cols), y = r * (S / rows);
    ctx.beginPath();
    ctx.ellipse(x, y + S / rows / 2, S / cols / 2 - 1, S / rows / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set('tile', t);
  return t;
}

/** Facade texture: rows of windows over plaster/stone (white channel modulated by material colour). */
export function facadeTexture() {
  if (texCache.has('facade')) return texCache.get('facade');
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const rand = rng(11);
  ctx.fillStyle = '#e8e2d6';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(90,80,70,${rand() * 0.07})`;
    ctx.fillRect(rand() * S, rand() * S, 2 + rand() * 6, 2 + rand() * 6);
  }
  // 4 floors x 4 windows per tile (tile = 12 m x 12 m)
  for (let f = 0; f < 4; f++) for (let w = 0; w < 4; w++) {
    const x = w * 64 + 22, y = f * 64 + 16;
    ctx.fillStyle = '#cbbfa8';
    ctx.fillRect(x - 1, y - 2, 22, 36);
    ctx.fillStyle = rand() > 0.5 ? '#5f7a58' : '#6d8466'; // green shutters
    ctx.fillRect(x, y, 5, 32);
    ctx.fillRect(x + 15, y, 5, 32);
    ctx.fillStyle = '#4a4440';
    ctx.fillRect(x + 6, y + 1, 8, 30);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set('facade', t);
  return t;
}

/** Emissive window mask matching facadeTexture (lit windows at night). */
export function windowMaskTexture() {
  if (texCache.has('winmask')) return texCache.get('winmask');
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const rand = rng(21);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  for (let f = 0; f < 4; f++) for (let w = 0; w < 4; w++) {
    if (rand() > 0.42) continue;
    const x = w * 64 + 22, y = f * 64 + 16;
    ctx.fillStyle = rand() > 0.5 ? '#ffcf8a' : '#ffb766';
    ctx.fillRect(x + 6, y + 1, 8, 30);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set('winmask', t);
  return t;
}

export function stoneMaterial(color = 0xffffff, key = 'stone', opts = {}) {
  const map = stoneTexture(key, opts);
  return new THREE.MeshStandardMaterial({ color, map, roughness: 0.92, metalness: 0 });
}

/**
 * Merge the static (non-instanced) meshes under a group per material, baking their transforms.
 * Cuts draw calls; instanced meshes are left as they are.
 */
export function mergeStaticMeshes(group) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const byMat = new Map();
  const remove = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || o === group) return;
    const g = nonIndexed(o.geometry.clone());
    g.applyMatrix4(o.matrixWorld.clone().premultiply(inv));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  const out = [];
  for (const [mat, geoms] of byMat) {
    const m = new THREE.Mesh(sanitizeNormals(mergeGeometries(geoms, false)), mat);
    m.castShadow = m.receiveShadow = true;
    m.name = group.name + '-merged';
    group.add(m);
    out.push(m);
  }
  return out;
}
