// The Stradun and its landmarks: paving, Luža square, City Bell Tower, Orlando's Column,
// Onofrio's Great Fountain.
import * as THREE from 'three';
import { geo, anchors } from './layout.js';
import { heightAt } from './terrain.js';
import { prism, normaliseRing, nonIndexed, mergeGeometries, circleRing, instanced, unitBox, merlonMatrices } from '../../world/kit.js';
import { centroid } from '../../core/geo.js';

export function buildFeatureExtras({ mats }) {
  const group = new THREE.Group();
  group.name = 'stradun';
  const stradun = [];
  let onofrioMasks = null;
  const mk = (g, m, name) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = o.receiveShadow = true;
    o.name = name;
    group.add(o);
    stradun.push(o);
    return o;
  };

  // ---- paving: a ribbon along the street axis that follows the ground, plus Luža square
  const line = resample(geo.stradun, 3);
  const W = 11;
  const pos = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const n = normal(line, i), n2 = normal(line, i + 1);
    const p = (q, nn, s) => [q[0] + nn[0] * s * W / 2, heightAt(q[0] + nn[0] * s * W / 2, q[1] + nn[1] * s * W / 2) + 0.12, q[1] + nn[1] * s * W / 2];
    const a0 = p(a, n, -1), a1 = p(a, n, 1), b0 = p(b, n2, -1), b1 = p(b, n2, 1);
    pos.push(...a0, ...b1, ...a1, ...a0, ...b0, ...b1);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fixUp(pg);
  pg.computeVertexNormals();
  const paving = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.32, metalness: 0.05 });
  mk(pg, paving, 'stradun-paving');
  // Luža: the square at the east end, between the bell tower, Sponza and St Blaise
  const e = anchors.stradunEast;
  const luza = circleRing(e[0] - 4, e[1] + 14, 19, 20);
  const lg = prism(luza, (x, z) => heightAt(x, z) - 1, (x, z) => heightAt(x, z) + 0.1, { top: true });
  mk(lg, paving, 'luza');

  // ---- City Bell Tower (31 m)
  {
    const r = normaliseRing(geo.works.bellTower);
    const c = centroid(r);
    const g0 = Math.min(...r.map(([x, z]) => heightAt(x, z)));
    const top = g0 + 27;
    const parts = [prism(r, g0 - 1, top)];
    const belfry = prism(r.map(([x, z]) => [c[0] + (x - c[0]) * 0.86, c[1] + (z - c[1]) * 0.86]), top, top + 3.5);
    parts.push(belfry);
    const cupola = new THREE.ConeGeometry(2.6, 4.5, 8);
    cupola.translate(c[0], top + 3.5 + 2.25, c[1]);
    parts.push(cupola);
    mk(mergeGeometries(parts.map(nonIndexed)), mats.fortStone, 'bell-tower');
    const bell = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), mats.dark);
    bell.position.set(c[0], top + 1.6, c[1]);
    group.add(bell);
    stradun.push(bell);
    // the clock face
    const clock = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshStandardMaterial({ color: 0x223355, roughness: 0.5 }));
    const toLuza = [e[0] - c[0], e[1] - c[1]];
    const l = Math.hypot(...toLuza) || 1;
    clock.position.set(c[0] + (toLuza[0] / l) * 3.1, top - 5, c[1] + (toLuza[1] / l) * 3.1);
    clock.rotation.y = Math.atan2(toLuza[0], toLuza[1]);
    group.add(clock);
    stradun.push(clock);
  }

  // ---- Orlando's Column
  {
    const [x, z] = anchors.orlando;
    const g = heightAt(x, z);
    const base = new THREE.BoxGeometry(2.6, 1.6, 2.6);
    base.translate(x, g + 0.8, z);
    const col = new THREE.CylinderGeometry(0.55, 0.65, 5.2, 12);
    col.translate(x, g + 1.6 + 2.6, z);
    const fig = new THREE.BoxGeometry(0.8, 2.2, 0.5);
    fig.translate(x, g + 1.6 + 5.2 + 1.1, z);
    mk(mergeGeometries([base, col, fig].map(nonIndexed)), mats.white, 'orlando');
  }

  // ---- Onofrio's Great Fountain (1438): a sixteen-sided basin under a dome
  {
    const r = normaliseRing(geo.works.onofrio);
    const c = centroid(r);
    const R = r.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / r.length;
    const g = heightAt(c[0], c[1]);
    const ring16 = circleRing(c[0], c[1], R, 16);
    const parts = [prism(ring16, g - 0.5, g + 3.4)];
    const dome = new THREE.SphereGeometry(R * 0.82, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(c[0], g + 3.4, c[1]);
    parts.push(dome);
    mk(mergeGeometries(parts.map(nonIndexed)), mats.fortStone, 'onofrio');
    onofrioMasks = instanced(unitBox, mats.dark, merlonMatrices(ring16, g + 1.1, { spacing: 10, w: 0.5, h: 0.5, d: 0.3, inset: -0.05 }));
    group.add(onofrioMasks);
  }

  return { group, stradun, line, onofrioMasks };
}

function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 0.5) continue;
    const k = Math.ceil(d / step);
    for (let j = 1; j <= k; j++) out.push([a[0] + (b[0] - a[0]) * (j / k), a[1] + (b[1] - a[1]) * (j / k)]);
  }
  return out;
}
function normal(line, i) {
  const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
  const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
  return [-tz / l, tx / l];
}
function fixUp(g) {
  const p = g.getAttribute('position').array;
  for (let i = 0; i < p.length; i += 9) {
    const ny = (p[i + 5] - p[i + 2]) * (p[i + 6] - p[i]) - (p[i + 3] - p[i]) * (p[i + 8] - p[i + 2]);
    if (ny < 0) for (let k = 0; k < 3; k++) {
      const t = p[i + 3 + k];
      p[i + 3 + k] = p[i + 6 + k];
      p[i + 6 + k] = t;
    }
  }
}
