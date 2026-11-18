// Trees: dense forest on Lokrum, the mapped woods and parks, scrub on the Srđ slopes.
// Never on a building, never inside the walls, never in the sea.
import * as THREE from 'three';
import { geo, decoded, insideTown } from './layout.js';
import { heightAt, coastDist } from './terrain.js';
import { pointInRing, bbox } from '../../core/geo.js';
import { rng } from '../../core/noise.js';

export function buildTrees({ quality }) {
  const rand = rng(42);
  const dens = quality === 'high' ? 1 : 0.5;
  // spatial hash of building footprints, so trees never stand on a roof
  const cell = 25, hash = new Map();
  for (const b of decoded.buildings) {
    const [x0, z0, x1, z1] = bbox(b.ring);
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++)
      for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        const k = i * 100000 + j;
        if (!hash.has(k)) hash.set(k, []);
        hash.get(k).push(b.ring);
      }
  }
  const onBuilding = (x, z) => {
    const list = hash.get(Math.floor(x / cell) * 100000 + Math.floor(z / cell));
    if (!list) return false;
    for (const r of list) {
      if (pointInRing(x, z, r)) return true;
    }
    return false;
  };
  const ok = (x, z) => {
    const h = heightAt(x, z);
    if (h < 1.2) return null;
    if (coastDist(x, z) < 2.5) return null;
    if (insideTown(x, z) || onBuilding(x, z) || onBuilding(x + 3, z) || onBuilding(x - 3, z) || onBuilding(x, z + 3) || onBuilding(x, z - 3)) return null;
    return h;
  };

  const pines = [], cypress = [], scrub = [];
  const scatter = (ring, count, kind) => {
    const [x0, z0, x1, z1] = bbox(ring);
    let tries = 0, placed = 0;
    while (placed < count && tries < count * 6) {
      tries++;
      const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0);
      if (!pointInRing(x, z, ring)) continue;
      const h = ok(x, z);
      if (h == null) continue;
      placed++;
      const s = 0.7 + rand() * 0.6;
      if (kind === 'scrub') scrub.push([x, h, z, s]);
      else if (rand() < (kind === 'park' ? 0.4 : 0.14)) cypress.push([x, h, z, s]);
      else pines.push([x, h, z, s]);
    }
  };
  // Lokrum: dense forest across the island
  const lokArea = polyArea(geo.lokrum);
  scatter(geo.lokrum, Math.round((lokArea / 60) * dens), 'wood');
  for (const g of decoded.green) {
    const a = polyArea(g.ring);
    if (pointInRing(...centroidOf(g.ring), geo.lokrum)) continue;
    const per = g.k === 'scrub' ? 140 : g.k === 'park' ? 90 : 70;
    scatter(g.ring, Math.min(2500, Math.round((a / per) * dens)), g.k);
  }
  // sparse scrub on the Srđ slopes
  for (let i = 0; i < 9000 * dens; i++) {
    const x = -900 + rand() * 2600, z = -1500 + rand() * 1300;
    const h = ok(x, z);
    if (h == null || h < 40 || h > 380) continue;
    // fewer on steep or very high ground
    const hx = heightAt(x + 4, z) - h, hz = heightAt(x, z + 4) - h;
    if (Math.hypot(hx, hz) > 3.2 || rand() < h / 500) continue;
    scrub.push([x, h, z, 0.6 + rand() * 0.6]);
  }

  const group = new THREE.Group();
  group.name = 'trees';
  const pineCanopy = new THREE.IcosahedronGeometry(1, 0);
  pineCanopy.scale(3.4, 2.2, 3.4);
  pineCanopy.translate(0, 8, 0);
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 7, 4, 1, true);
  trunk.translate(0, 3.5, 0);
  const cyp = new THREE.ConeGeometry(1.3, 11, 6);
  cyp.translate(0, 5.5, 0);
  const bush = new THREE.IcosahedronGeometry(1, 0);
  bush.scale(1.8, 1.1, 1.8);
  bush.translate(0, 0.6, 0);

  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true });
  const make = (geom, m, list, name, colorJitter) => {
    const im = new THREE.InstancedMesh(geom, m, Math.max(1, list.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    list.forEach(([x, y, z, s], i) => {
      q.setFromAxisAngle(up, rand() * 6.28);
      m4.compose(new THREE.Vector3(x, y - 0.3, z), q, new THREE.Vector3(s, s * (0.85 + rand() * 0.3), s));
      im.setMatrixAt(i, m4);
      if (colorJitter) im.setColorAt(i, col.setHSL(0.24 + rand() * 0.06, 0.35 + rand() * 0.2, 0.2 + rand() * 0.08));
    });
    im.count = list.length;
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = name;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    group.add(im);
    return im;
  };
  make(pineCanopy, mat(0xffffff), pines, 'pine-canopy', true);
  make(trunk, mat(0x5a4632), pines, 'pine-trunk', false).castShadow = false;
  make(cyp, mat(0xffffff), cypress, 'cypress', true);
  make(bush, mat(0xffffff), scrub, 'scrub', true).castShadow = false;
  return { group, count: pines.length + cypress.length + scrub.length };
}

function polyArea(r) {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i], q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}
function centroidOf(r) {
  let x = 0, z = 0;
  for (const p of r) { x += p[0]; z += p[1]; }
  return [x / r.length, z / r.length];
}
