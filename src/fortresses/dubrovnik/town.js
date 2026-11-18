// The town inside the walls and the suburbs outside, from real OSM footprints.
// Every building gets a (modelled) construction year, an earthquake fate and a 1991 fate.
import * as THREE from 'three';
import { decoded, anchors, stradunInfo } from './layout.js';
import { heightAt } from './terrain.js';
import { prism, hippedRoof, gableGeometry, nonIndexed, mergeGeometries, normaliseRing, circleRing, sanitizeNormals } from '../../world/kit.js';
import { townUniforms, townMaterial, townDepthMaterial, stampAttributes, instanceAttributes, minAreaRect } from '../../world/townkit.js';
import { signedArea, centroid, distToPolyline } from '../../core/geo.js';
import { rng } from '../../core/noise.js';
import { geo } from './layout.js';

// Dates for named churches and monuments: [first built, rebuilt after 1667 (0 = survived)]
const DATED = [
  [/katedrala/i, 1192, 1713], [/Crkva sv\. Vlaha/i, 1368, 1715], [/^Sv\. Franjo$/, 1317, 0],
  [/Crkva sv\. Dominika/, 1315, 0], [/Knežev dvor/, 1435, 0], [/Sponza/, 1522, 0], [/Crkva sv\. Ignacija/, 1725, 0],
  [/Isusovačka/, 1735, 0], [/Biskupska/, 1200, 1690], [/Sv\. Spas/, 1528, 0], [/Domino/, 1240, 1680],
  [/Sv\. Josip/, 1667, 0], [/Sigurata/, 1280, 0], [/Nuncijata/, 1534, 0], [/Blagovještenja/, 1877, 0],
  [/Sv\. Nikola/, 1100, 1700], [/Sv\. Jakov Pipunar/, 1225, 0], [/Gospe od Karmena/, 1628, 1680],
  [/sv\. Margarete/i, 1571, 0], [/svetog Roka/i, 1540, 0], [/Domus Christi/, 1540, 0], [/Sv\. Dominika/, 1315, 0],
  [/Sveti Sebastijan/, 1466, 0], [/Grad Dubrovnik|županija/, 1863, 0],
];
const DOMES = [/katedrala/i, /Crkva sv\. Vlaha/i];
const BELLTOWERS = [/^Sv\. Franjo$/, /Crkva sv\. Dominika/];

const PLASTER = [0xefe4cf, 0xe9dcc2, 0xf3ead8, 0xe6d3b3, 0xdcc9a8, 0xeee0c6, 0xe2d7c4];
const SUBURB = [0xd9d3c8, 0xe0dbd2, 0xcfc8bc, 0xe6dfd2, 0xd2cdc4];

function buildYear(b, rand) {
  const [x, z] = b.c;
  if (!b.i) {
    // the town outside the walls: from the 19th century outward
    const d = distToPolyline(x, z, geo.ring, true);
    return Math.round(1810 + Math.min(185, d * 0.3) + (rand() - 0.5) * 50);
  }
  const s = stradunInfo(x, z);
  if (s.north > 0) {
    // the slope north of the Stradun: ~1140–1350, older nearer the street
    return Math.round(1140 + 210 * Math.min(1, (s.d / 170) * 0.6 + rand() * 0.45));
  }
  // the rocky south (old Laus): ~690–1130, oldest on the rock top
  const laus = [anchors.townCentre[0] - 30, anchors.townCentre[1] + 120];
  const t = Math.min(1, Math.hypot(x - laus[0], z - laus[1]) / 230);
  return Math.round(690 + 440 * Math.min(1, t * 0.75 + rand() * 0.3));
}

function groundRange(r) {
  let lo = Infinity, sum = 0;
  for (const [x, z] of r) {
    const h = heightAt(x, z);
    lo = Math.min(lo, h);
    sum += h;
  }
  return [lo, sum / r.length];
}

export function buildTown({ mats }) {
  const U = townUniforms();
  const rand = rng(1667);
  const group = new THREE.Group();
  group.name = 'town';
  const inner = new THREE.Group();
  inner.name = 'old-town';
  const suburbs = new THREE.Group();
  suburbs.name = 'suburbs';
  group.add(inner, suburbs);

  const M = {
    wallsI: townMaterial(U, { color: 0xffffff }),
    roofsI: townMaterial(U, { roof: true, color: 0xffffff }),
    blocks: townMaterial(U, { vertexColors: true }),
    blockRoofs: townMaterial(U, { roof: true, vertexColors: true }),
    church: townMaterial(U, { vertexColors: true, facade: false }),
    suburb: townMaterial(U, { vertexColors: true, facade: false }),
    suburbRoofs: townMaterial(U, { roof: true, vertexColors: true }),
  };

  const units = []; // instanced houses: { cx, cz, ux, uz, len, wid, y0, h, roofH, color, attrs }
  const blocksByCentury = new Map(); // century -> { walls: [], roofs: [] }
  const churchParts = [];
  const suburbWalls = [], suburbRoofs = [];
  const houses = []; // for the timeline, sieges: { x, z, year, rebuilt, hit, inside }
  const roofColor = () => new THREE.Color().setHSL(0.03 + rand() * 0.035, 0.42 + rand() * 0.2, 0.46 + rand() * 0.1);

  for (const b of decoded.buildings) {
    if (b.lazareti) continue;
    const r = normaliseRing(b.ring);
    const area = Math.abs(signedArea(r));
    let year = buildYear(b, rand);
    let rebuilt = 0;
    const named = b.n && DATED.find(([re]) => re.test(b.n));
    if (named) {
      year = named[1];
      rebuilt = named[2];
    } else if (b.i && year < 1667 && rand() < 0.7) {
      // ~70% of the town falls in 1667, rebuilt one by one over ~1669–1715
      rebuilt = Math.round(1669 + Math.pow(rand(), 1.3) * 46);
    }
    const hit = b.i && rand() < 0.56 ? 1 : 0;
    const [gLo, gMean] = groundRange(r);
    const y0 = gLo - 1.5;
    const attrs = { aBuilt: year, aRuin: rebuilt, aHit: hit, aDmg: 0 };
    houses.push({ x: b.c[0], z: b.c[1], year, rebuilt, hit, inside: !!b.i, area });

    const isChurch = b.k === 'church' || (named && !/Knežev|Sponza|Biskupska|Isusovačka|Grad Dubrovnik|županija|Domus/.test(b.n));
    const isMonument = named && !isChurch;

    if (!b.i) {
      // suburbs: one plain house per footprint, a little greyer
      const h = (b.l ? b.l * 3 : 6 + rand() * 4) + (gMean - gLo);
      const col = new THREE.Color(SUBURB[Math.floor(rand() * SUBURB.length)]);
      suburbWalls.push(stampAttributes(prism(r, y0, gMean + h, { top: true }), { ...attrs, aBase: y0, color: col }));
      if (area > 25) suburbRoofs.push(stampAttributes(nonIndexed(hippedRoof(r, gMean + h, Math.min(3, Math.sqrt(area) * 0.22), { shrink: 0.3, over: 0.3 })), { ...attrs, aBase: y0, color: roofColor() }));
      continue;
    }

    if (isChurch || isMonument) {
      const h = Math.min(20, 9 + Math.sqrt(area) * 0.32) + (gMean - gLo);
      const col = new THREE.Color(isChurch ? 0xf0e4c8 : 0xeadcc0);
      const top = gMean + h;
      churchParts.push(stampAttributes(prism(r, y0, top), { ...attrs, aBase: y0, color: col }));
      const roofH = Math.min(6, Math.sqrt(area) * 0.25);
      churchParts.push(stampAttributes(nonIndexed(hippedRoof(r, top, roofH, { shrink: 0.2, over: 0.5 })), { ...attrs, aBase: y0, color: new THREE.Color(0x9c4a30) }));
      if (DOMES.some((re) => re.test(b.n))) {
        const c = centroid(r);
        const R = Math.min(7, Math.sqrt(area) * 0.17);
        const drum = prism(circleRing(c[0], c[1], R, 20), top, top + roofH + 3);
        churchParts.push(stampAttributes(drum, { ...attrs, aBase: y0, color: col }));
        const dome = new THREE.SphereGeometry(R * 1.02, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        dome.translate(c[0], top + roofH + 3, c[1]);
        churchParts.push(stampAttributes(nonIndexed(dome), { ...attrs, aBase: y0, color: new THREE.Color(0x8a8f8c) }));
        const lantern = new THREE.CylinderGeometry(R * 0.2, R * 0.25, R * 0.6, 10);
        lantern.translate(c[0], top + roofH + 3 + R + R * 0.25, c[1]);
        churchParts.push(stampAttributes(nonIndexed(lantern), { ...attrs, aBase: y0, color: col }));
      }
      if (BELLTOWERS.some((re) => re.test(b.n))) {
        // the bell tower stands at the corner nearest the Stradun
        let best = r[0], bd = Infinity;
        for (const p of r) {
          const d = stradunInfo(p[0], p[1]).d;
          if (d < bd) { bd = d; best = p; }
        }
        const c = centroid(r);
        const tc = [best[0] + (c[0] - best[0]) * 0.14, best[1] + (c[1] - best[1]) * 0.14];
        const s = 3;
        const sq = [[tc[0] - s, tc[1] - s], [tc[0] + s, tc[1] - s], [tc[0] + s, tc[1] + s], [tc[0] - s, tc[1] + s]];
        const tTop = gMean + 38;
        churchParts.push(stampAttributes(prism(sq, y0, tTop), { ...attrs, aBase: y0, color: col }));
        const spire = new THREE.ConeGeometry(s * 1.2, 7, 4);
        spire.rotateY(Math.PI / 4);
        spire.translate(tc[0], tTop + 3.5, tc[1]);
        churchParts.push(stampAttributes(nonIndexed(spire), { ...attrs, aBase: y0, color: new THREE.Color(0x9c4a30) }));
      }
      continue;
    }

    const levelsH = b.l ? b.l * 3.2 + 0.8 : 10 + rand() * 5;
    const rect = minAreaRect(r);
    const fill = rect ? area / rect.area : 0;
    if (rect && fill > 0.8 && rect.wid > 3) {
      // rectangular plot: instanced houses, terraces cut into house-width units
      const k = rect.len > 1.7 * rect.wid && rect.len > 12 ? Math.max(1, Math.round(rect.len / (6 + rand() * 2))) : 1;
      const ul = rect.len / k;
      for (let i = 0; i < k; i++) {
        const off = (i + 0.5) * ul - rect.len / 2;
        const cx = rect.cx + rect.ux * off, cz = rect.cz + rect.uz * off;
        const h = levelsH + (rand() - 0.5) * 2.4;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]) => [cx + rect.ux * a * ul / 2 - rect.uz * c * rect.wid / 2, cz + rect.uz * a * ul / 2 + rect.ux * c * rect.wid / 2]);
        const [lo, mean] = groundRange(corners);
        const uy = k > 1 ? year + Math.round((rand() - 0.5) * 30) : year;
        // the ridge runs along the longer side of each unit
        const along = ul >= rect.wid;
        units.push({
          cx, cz, ux: rect.ux, uz: rect.uz, len: ul, wid: rect.wid, y0: lo - 1.5, top: mean + h, along,
          roofH: Math.min(along ? rect.wid : ul, 12) * 0.27,
          color: new THREE.Color(PLASTER[Math.floor(rand() * PLASTER.length)]), roof: roofColor(),
          attrs: { ...attrs, aBuilt: uy },
        });
      }
      continue;
    }
    // irregular plot: extruded facades with a hipped roof, merged per century
    const top = gMean + levelsH;
    const cent = Math.floor(year / 100);
    if (!blocksByCentury.has(cent)) blocksByCentury.set(cent, { walls: [], roofs: [] });
    const bucket = blocksByCentury.get(cent);
    bucket.walls.push(stampAttributes(prism(r, y0, top), { ...attrs, aBase: y0, color: new THREE.Color(PLASTER[Math.floor(rand() * PLASTER.length)]) }));
    bucket.roofs.push(stampAttributes(nonIndexed(hippedRoof(r, top, Math.min(4.5, Math.sqrt(area) * 0.2), { shrink: 0.28, over: 0.35 })), { ...attrs, aBase: y0, color: roofColor() }));
  }

  // ---- instanced houses
  const n = units.length;
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  bodyGeo.translate(0, 0.5, 0);
  const roofGeo = gableGeometry(0.05);
  const body = new THREE.InstancedMesh(bodyGeo, M.wallsI, n);
  const roofs = new THREE.InstancedMesh(roofGeo, M.roofsI, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const bodyRows = [], roofRows = [];
  units.forEach((u, i) => {
    const ang = Math.atan2(-u.uz, u.ux);
    q.setFromAxisAngle(up, ang);
    const H = u.top - u.y0;
    m4.compose(new THREE.Vector3(u.cx, u.y0, u.cz), q, new THREE.Vector3(u.len, H, u.wid));
    body.setMatrixAt(i, m4);
    body.setColorAt(i, u.color);
    bodyRows.push({ ...u.attrs, aBase: 0 });
    const rq = u.along ? q.clone() : q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2));
    const rs = u.along ? new THREE.Vector3(u.len, u.roofH, u.wid) : new THREE.Vector3(u.wid, u.roofH, u.len);
    m4.compose(new THREE.Vector3(u.cx, u.top, u.cz), rq, rs);
    roofs.setMatrixAt(i, m4);
    roofs.setColorAt(i, u.roof);
    roofRows.push({ ...u.attrs, aBase: -(u.top - u.y0) / u.roofH });
  });
  instanceAttributes(bodyGeo, bodyRows);
  instanceAttributes(roofGeo, roofRows);
  for (const im of [body, roofs]) {
    im.castShadow = im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }
  body.name = 'houses';
  roofs.name = 'roofs';
  inner.add(body, roofs);

  const mergedMesh = (parts, mat, name) => {
    if (!parts.length) return null;
    const g = mergeGeometries(parts, false);
    g.computeVertexNormals();
    sanitizeNormals(g);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    m.name = name;
    return m;
  };
  for (const [cent, b] of [...blocksByCentury.entries()].sort((a, c) => a[0] - c[0])) {
    const w = mergedMesh(b.walls, M.blocks, `blocks-${cent}xx`);
    const r = mergedMesh(b.roofs, M.blockRoofs, `block-roofs-${cent}xx`);
    if (w) inner.add(w);
    if (r) inner.add(r);
  }
  const ch = mergedMesh(churchParts, M.church, 'churches');
  if (ch) inner.add(ch);
  const sw = mergedMesh(suburbWalls, M.suburb, 'suburb-houses');
  const sr = mergedMesh(suburbRoofs, M.suburbRoofs, 'suburb-roofs');
  if (sw) suburbs.add(sw);
  if (sr) suburbs.add(sr);

  // shadows follow the timeline too
  const depthWall = townDepthMaterial(U), depthRoof = townDepthMaterial(U, { roof: true });
  group.traverse((o) => {
    if (o.isMesh) o.customDepthMaterial = o.material.userData.isRoof ? depthRoof : depthWall;
  });
  const materials = Object.values(M);
  return {
    group, inner, suburbs, uniforms: U, materials, houses,
    roofs, units,
    setYear(y) {
      U.uYear.value = y;
    },
    setNight(v) {
      U.uNight.value = v;
    },
    /** live siege damage on instanced roofs (index -> 0..1) */
    setRoofDamage(i, v) {
      const a = roofs.geometry.getAttribute('aDmg');
      a.setX(i, v);
      a.needsUpdate = true;
    },
    clearRoofDamage() {
      const a = roofs.geometry.getAttribute('aDmg');
      a.array.fill(0);
      a.needsUpdate = true;
    },
  };
}
