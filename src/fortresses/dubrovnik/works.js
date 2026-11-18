// Dubrovnik's towers, forts, gates, bridges, port works and outworks.
// Every footprint comes from OSM (via layout.js); heights are modelled.
import * as THREE from 'three';
import {
  prism, parapet, merlonMatrices, instanced, unitBox, offsetRing, scaleRing, circleRing, normaliseRing,
  edgeNormal, archGeometry, mergeGeometries, nonIndexed, hippedRoof, gableGeometry,
} from '../../world/kit.js';
import { centroid } from '../../core/geo.js';
import { geo, anchors, ringNormal, nearestRingIndex } from './layout.js';
import { heightAt } from './terrain.js';

const W = geo.works;

function minGround(r) {
  let m = Infinity;
  for (const [x, z] of r) m = Math.min(m, heightAt(x, z));
  const c = centroid(r);
  return Math.min(m, heightAt(c[0], c[1]));
}
function radiusOf(r) {
  const c = centroid(r);
  return r.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / r.length;
}
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const awayFromTown = (a, b, minDot = 0.25) => {
  const n = edgeNormal(a, b);
  const mx = (a[0] + b[0]) / 2 - anchors.townCentre[0], mz = (a[1] + b[1]) / 2 - anchors.townCentre[1];
  const l = Math.hypot(mx, mz) || 1;
  return n[0] * mx / l + n[1] * mz / l > minDot;
};

/** Dark openings (embrasures, loopholes, arches) on the faces of a footprint. */
function openings(r, rows, { filter = () => true, spacing = 6, w = 1.2, h = 1.4, minLen = 3 } = {}) {
  const mats = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = v3(0, 1, 0);
  r = normaliseRing(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < minLen || !filter(a, b)) continue;
    const n = edgeNormal(a, b);
    q.setFromAxisAngle(up, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
    const cnt = Math.max(1, Math.floor(len / spacing));
    for (let k = 0; k < cnt; k++) {
      const t = (k + 0.5) / cnt;
      const x = a[0] + (b[0] - a[0]) * t + n[0] * 0.08, z = a[1] + (b[1] - a[1]) * t + n[1] * 0.08;
      for (const y of rows) {
        m.compose(v3(x, y, z), q, v3(w, h, 0.5));
        mats.push(m.clone());
      }
    }
  }
  return mats;
}

export function buildWorks({ walls, mats }) {
  const out = {
    features: {}, // feature id -> [objects]
    timeline: {}, // structure key -> object
    colliders: [],
    guns: [], // { key, x, z, y, kind }
    lights: [], // night floodlight anchor points [x, y, z]
  };
  const add = (feature, obj) => {
    (out.features[feature] ||= []).push(obj);
    return obj;
  };
  const mesh = (g, mat, name) => {
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    if (name) m.name = name;
    out.colliders.push(m);
    return m;
  };
  const group = (name) => {
    const g = new THREE.Group();
    g.name = name;
    return g;
  };
  const dark = mats.dark;
  const stone = mats.stone;
  const fortStone = mats.fortStone;

  /** Rim merlons + parapet on top of a footprint */
  const crown = (g, r, top, { merlons = true, mat = stone } = {}) => {
    g.add(mesh(parapet(r, top, 1.5, 0.6), mat));
    if (merlons) g.add(instanced(unitBox, mat, merlonMatrices(offsetRing(normaliseRing(r), -0.3), top + 1.5, { spacing: 2.6, w: 1.2, h: 1.0, d: 0.6, inset: 0 })));
  };

  // ---------------------------------------------------------------- circuit towers
  const TOWERS = {
    // key: [feature, rise (0 = low bastion level with the walk)]
    gornjiUgao: ['landwalls', 5], unnamedTower: ['landwalls', 4], barbara: ['landwalls', 0], lucija: ['landwalls', 0],
    vid: ['landwalls', 4], drezvenik: ['landwalls', 5], jakov: ['landwalls', 5], asimon: ['ploce', 6], luka: ['oldport', 5],
    spasitelj: ['seawalls', 0], stjepan: ['seawalls', 0], margarita: ['seawalls', 0], petar: ['seawalls', 3], puncjela: ['seawalls', 5],
  };
  out.towerKeys = Object.keys(TOWERS);
  out.towerGroups = {};
  for (const [key, [feature, rise]] of Object.entries(TOWERS)) {
    const r = normaliseRing(W[key]);
    const c = centroid(r);
    const walk = walls.walkAt(c[0], c[1]);
    const base = minGround(r) - 8;
    const top = walk + rise;
    const g = group('tower-' + key);
    g.add(mesh(prism(r, base, top), stone, key));
    crown(g, r, top);
    if (rise > 0) {
      g.add(instanced(unitBox, dark, openings(r, [top - 2.6, top - 7], { spacing: 4.5, w: 0.35, h: 1.4, minLen: 2.5 })));
    }
    add(feature, g);
    out.towerGroups[key] = g;
    out.guns.push({ key, x: c[0], z: c[1], y: top + 1, kind: 'tower' });
    out.lights.push([c[0], top, c[1]]);
  }

  // ---------------------------------------------------------------- Minčeta
  {
    const r = normaliseRing(W.minceta), inner = normaliseRing(W.mincetaInner);
    const c = centroid(r), ci = centroid(inner);
    const R = radiusOf(inner);
    const g0 = minGround(r);
    const walk = walls.walkAt(c[0], c[1]);
    const g = group('minceta');
    const drumTop = walk + 2;
    g.add(mesh(prism(r, g0 - 10, drumTop), fortStone, 'minceta-drum'));
    crown(g, r, drumTop, { mat: fortStone });
    const towerTop = drumTop + 13;
    g.add(mesh(prism(inner, drumTop - 1, towerTop), fortStone, 'minceta-tower'));
    // machicolation band on corbels
    const band = offsetRing(inner, 0.9);
    g.add(mesh(prism(band, towerTop, towerTop + 1.3, { top: true }), fortStone));
    g.add(instanced(unitBox, fortStone, merlonMatrices(offsetRing(inner, 0.45), towerTop - 1.1, { spacing: 1.6, w: 0.5, h: 1.1, d: 0.9, inset: 0 })));
    // the wider crowned top with blind arches
    const crownR = offsetRing(inner, 1.1);
    const crownTop = towerTop + 1.3 + 3.4;
    g.add(mesh(prism(crownR, towerTop + 1.3, crownTop), fortStone));
    g.add(instanced(unitBox, dark, openings(crownR, [towerTop + 3], { spacing: 2.2, w: 1.1, h: 1.7, minLen: 1 })));
    crown(g, crownR, crownTop, { mat: fortStone });
    // the small lookout turret on top
    const tur = circleRing(ci[0] + R * 0.25, ci[1] - R * 0.2, R * 0.28, 14);
    g.add(mesh(prism(tur, crownTop, crownTop + 4.5), fortStone));
    crown(g, tur, crownTop + 4.5, { mat: fortStone });
    g.add(instanced(unitBox, dark, openings(r, [g0 + 6, drumTop - 5], { spacing: 6, w: 0.5, h: 1.2 })));
    add('minceta', g);
    out.timeline.mincetaRound = g;
    // 1319: the original square tower (timeline only)
    const sq = group('minceta-1319');
    const s = R * 1.25;
    const sqr = [[ci[0] - s, ci[1] - s], [ci[0] + s, ci[1] - s], [ci[0] + s, ci[1] + s], [ci[0] - s, ci[1] + s]];
    sq.add(mesh(prism(sqr, g0 - 6, walk + 8), stone));
    crown(sq, sqr, walk + 8);
    sq.visible = false;
    add('minceta', sq);
    out.timeline.mincetaSquare = sq;
    out.guns.push({ key: 'minceta', x: ci[0], z: ci[1], y: crownTop, kind: 'fort', range: 300 });
    out.lights.push([ci[0], crownTop, ci[1]]);
    out.mincetaTop = crownTop;
  }

  // ---------------------------------------------------------------- Bokar
  {
    const r = normaliseRing(W.bokar);
    const c = centroid(r), R = radiusOf(r);
    const g0 = minGround(r);
    const walk = walls.walkAt(c[0], c[1]);
    const top = walk - 1;
    const g = group('bokar');
    g.add(mesh(prism(r, Math.min(g0, 0) - 6, top), fortStone, 'bokar'));
    crown(g, r, top, { mat: fortStone });
    // casemate embrasures on the seaward faces
    g.add(instanced(unitBox, dark, openings(r, [top - 4.5, top - 9.5], { filter: (a, b) => awayFromTown(a, b, -0.1), spacing: 4.2, w: 1.1, h: 1.0, minLen: 2 })));
    add('bokar', g);
    out.timeline.bokar = g;
    // the round upper tier, completed 1570
    const up = group('bokar-upper');
    const ur = circleRing(c[0] + (anchors.townCentre[0] - c[0]) * 0.06, c[1] + (anchors.townCentre[1] - c[1]) * 0.06, R * 0.42, 18);
    up.add(mesh(prism(ur, top, top + 5), fortStone));
    crown(up, ur, top + 5, { mat: fortStone });
    up.add(instanced(unitBox, dark, openings(ur, [top + 2.5], { spacing: 3, w: 0.8, h: 0.9, minLen: 1 })));
    add('bokar', up);
    out.timeline.bokarUpper = up;
    out.guns.push({ key: 'bokar', x: c[0], z: c[1], y: top, kind: 'fort', range: 280 });
    out.lights.push([c[0], top + 5, c[1]]);
  }

  // ---------------------------------------------------------------- St John's Fortress
  {
    const r = normaliseRing(W.ivan);
    const c = centroid(r);
    const top = 17;
    const g = group('stjohn');
    g.add(mesh(prism(r, -6, top), fortStone, 'stjohn'));
    crown(g, r, top, { mat: fortStone });
    g.add(instanced(unitBox, dark, openings(r, [5.5, 11], { filter: (a, b) => awayFromTown(a, b, -0.2), spacing: 5, w: 1.2, h: 1.1 })));
    // inner raised block (the fort's tower core)
    const core = scaleRing(r, 0.42, [c[0] - (c[0] - anchors.townCentre[0]) * 0.02, c[1]]);
    g.add(mesh(prism(core, top, top + 5), fortStone));
    crown(g, core, top + 5, { mat: fortStone });
    add('stjohn', g);
    out.timeline.stjohnFort = g;
    // 1346: the first tower at the tip
    let tip = r[0], best = -1;
    for (const p of r) {
      const d = Math.hypot(p[0] - anchors.townCentre[0], p[1] - anchors.townCentre[1]);
      if (d > best) { best = d; tip = p; }
    }
    const tc = [tip[0] + (c[0] - tip[0]) * 0.28, tip[1] + (c[1] - tip[1]) * 0.28];
    const tr = [[tc[0] - 5, tc[1] - 5], [tc[0] + 5, tc[1] - 5], [tc[0] + 5, tc[1] + 5], [tc[0] - 5, tc[1] + 5]];
    const t1346 = group('stjohn-1346');
    t1346.add(mesh(prism(tr, -4, 20), stone));
    crown(t1346, tr, 20);
    t1346.visible = false;
    add('stjohn', t1346);
    out.timeline.stjohnTower = t1346;
    out.guns.push({ key: 'stjohn', x: c[0], z: c[1], y: top, kind: 'fort', range: 420 });
    out.lights.push([c[0], top + 5, c[1]]);
  }

  // ---------------------------------------------------------------- Revelin
  {
    const r = normaliseRing(W.revelin);
    const c = centroid(r);
    const g0 = minGround(r);
    const gTop = Math.max(...r.map(([x, z]) => heightAt(x, z)));
    const top = gTop + 9;
    const g = group('revelin');
    g.add(mesh(prism(r, g0 - 7, top), fortStone, 'revelin'));
    // cordon
    g.add(mesh(prism(offsetRing(r, 0.35), top - 4.2, top - 3.6), fortStone));
    crown(g, r, top, { mat: fortStone });
    g.add(instanced(unitBox, dark, openings(r, [top - 2.2, top - 7.5], { filter: (a, b) => awayFromTown(a, b, -0.3), spacing: 6, w: 1.3, h: 1.1 })));
    const inner = scaleRing(r, 0.55);
    g.add(mesh(prism(inner, top, top + 4), fortStone));
    crown(g, inner, top + 4, { mat: fortStone });
    add('revelin', g);
    out.timeline.revelin = g;
    out.guns.push({ key: 'revelin', x: c[0], z: c[1], y: top + 4, kind: 'fort', range: 360 });
    out.lights.push([c[0], top + 4, c[1]]);
  }

  // ---------------------------------------------------------------- Lovrijenac
  {
    const r = normaliseRing(W.lovrijenac);
    const c = centroid(r);
    const g0 = minGround(r);
    const g = group('lovrijenac');
    const tiers = [[1.0, 8], [0.78, 14], [0.54, 19]];
    const rock = heightAt(c[0], c[1]);
    let prevTop = 0;
    tiers.forEach(([s, h], k) => {
      const tr = scaleRing(r, s);
      const top = rock + h;
      g.add(mesh(prism(tr, k ? prevTop - 1 : g0 - 4, top), fortStone, 'lovrijenac-' + k));
      crown(g, tr, top, { mat: fortStone });
      g.add(instanced(unitBox, dark, openings(tr, [top - 3], { filter: (a, b) => awayFromTown(a, b, -0.15), spacing: 4.5, w: 1.1, h: 1.0, minLen: 2.5 })));
      prevTop = top;
    });
    add('lovrijenac', g);
    out.timeline.lovrijenac = g;
    out.guns.push({ key: 'lovrijenac', x: c[0], z: c[1], y: rock + 19, kind: 'fort', range: 380 });
    out.lights.push([c[0], rock + 19, c[1]]);
  }

  // ---------------------------------------------------------------- Pile Gate
  {
    const r = normaliseRing(W.pile);
    const c = centroid(r);
    const g0 = minGround(r);
    const walk = walls.walkAt(c[0], c[1]);
    const top = Math.max(g0 + 10, walk - 4);
    const g = group('pile-barbican');
    g.add(mesh(prism(r, g0 - 6, top), stone, 'pile'));
    crown(g, r, top);
    add('pile', g);
    // three-arch stone bridge across the moat, heading out from the town
    const dir = norm(c[0] - anchors.townCentre[0], c[1] - anchors.townCentre[1]);
    const R = radiusOf(r);
    const start = [c[0] + dir[0] * R, c[1] + dir[1] * R];
    const L = 30;
    const bridge = buildBridge(start, dir, L, 5.5, { arches: 3, mats, mesh });
    add('pile', bridge);
    out.timeline.pileBridge = bridge;
    // dark gate passage through the barbican, facing the bridge
    const pass = mesh(new THREE.BoxGeometry(3.2, 4.2, R * 2 + 1), dark);
    pass.position.set(c[0], bridge.userData.deckY + 2.1, c[1]);
    pass.rotation.y = Math.atan2(dir[0], dir[1]);
    add('pile', pass);
    out.pileDeck = bridge.userData.deckY;
  }

  // ---------------------------------------------------------------- Ploče Gate
  {
    const pr = normaliseRing(W.ploce);
    const pc = centroid(pr);
    const g0 = minGround(pr);
    const g = group('ploce-gate');
    g.add(mesh(prism(pr, g0 - 4, g0 + 8), stone, 'ploce'));
    crown(g, pr, g0 + 8);
    const enc = normaliseRing(W.ploceOuter);
    g.add(mesh(prism(offsetRing(enc, 0), (x, z) => heightAt(x, z) - 3, (x, z) => heightAt(x, z) + 0.2, { top: true }), mats.paving));
    add('ploce', g);
    // bridge 1: from the Asimon inner gate across the moat; bridge 2: from the outer gate
    const ai = nearestRingIndex(anchors.asimon[0], anchors.asimon[1]);
    const an = ringNormal(ai);
    const b1 = buildBridge([anchors.asimon[0] + an[0] * 4, anchors.asimon[1] + an[1] * 4], an, 16, 4.5, { arches: 2, mats, mesh });
    add('ploce', b1);
    const d2 = norm(anchors.ploceOuter[0] - pc[0], anchors.ploceOuter[1] - pc[1]);
    const b2 = buildBridge([pc[0] - d2[0] * 3, pc[1] - d2[1] * 3], [-d2[0], -d2[1]], 14, 4.5, { arches: 1, mats, mesh });
    add('ploce', b2);
    const pass = mesh(new THREE.BoxGeometry(3, 4, 9), dark);
    const aw = walls.walkAt(anchors.asimon[0], anchors.asimon[1]);
    pass.position.set(anchors.asimon[0], b1.userData.deckY + 2, anchors.asimon[1]);
    pass.rotation.y = Math.atan2(an[0], an[1]);
    void aw;
    add('ploce', pass);
  }

  // ---------------------------------------------------------------- Old Port
  {
    const kr = normaliseRing(geo.kase);
    const kase = group('kase');
    kase.add(mesh(prism(kr, -4, 2.2), stone, 'kase'));
    kase.add(mesh(parapet(kr, 2.2, 0.9, 0.5), stone));
    add('oldport', kase);
    out.timeline.kase = kase;
    // Porporela mole with its green light
    const ivan = normaliseRing(W.ivan);
    const pp = geo.points.porporela;
    let near = ivan[0], bd = Infinity;
    for (const p of ivan) {
      const d = Math.hypot(p[0] - pp[0], p[1] - pp[1]);
      if (d < bd) { bd = d; near = p; }
    }
    const dir = norm(pp[0] - near[0], pp[1] - near[1]);
    const len = Math.hypot(pp[0] - near[0], pp[1] - near[1]) + 22;
    const mole = mesh(new THREE.BoxGeometry(7, 5, len), stone, 'porporela');
    mole.position.set(near[0] + dir[0] * len / 2, -1.6, near[1] + dir[1] * len / 2);
    mole.rotation.y = Math.atan2(dir[0], dir[1]);
    const lightPos = [near[0] + dir[0] * (len - 2), near[1] + dir[1] * (len - 2)];
    const post = mesh(new THREE.CylinderGeometry(0.9, 1.1, 5, 10), mats.white);
    post.position.set(lightPos[0], 3.4, lightPos[1]);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), mats.greenLight);
    lamp.position.set(lightPos[0], 6.4, lightPos[1]);
    const port = group('porporela');
    port.add(mole, post, lamp);
    add('oldport', port);
    out.greenLight = lamp;
    // the Arsenal: three great arches opening onto the harbour, next to the City Bell Tower
    const bi = nearestRingIndex(anchors.bellTower[0], anchors.bellTower[1]);
    let ai = bi, adist = Infinity;
    for (let i = geo.sides.harbour; i < geo.sides.sea; i++) {
      const d = Math.hypot(geo.ring[i][0] - anchors.bellTower[0], geo.ring[i][1] - anchors.bellTower[1]);
      if (d < adist) { adist = d; ai = i; }
    }
    const an = ringNormal(ai);
    const ap = geo.ring[ai];
    const ars = group('arsenal');
    const ac = [ap[0] - an[0] * 7.5, ap[1] - an[1] * 7.5];
    const gA = heightAt(ac[0], ac[1]);
    const body = mesh(new THREE.BoxGeometry(32, 11, 13), stone, 'arsenal');
    body.position.set(0, gA + 5.5 - 1, 0);
    ars.add(body);
    const roof = new THREE.Mesh(gableGeometry(0.04), mats.roof);
    roof.scale.set(33, 3.2, 14);
    roof.position.set(0, gA + 10, 0);
    roof.castShadow = true;
    ars.add(roof);
    for (let k = -1; k <= 1; k++) {
      const arch = mesh(new THREE.BoxGeometry(7.5, 7, 0.6), dark);
      arch.position.set(k * 10, gA + 3.5 - 0.6, 6.6);
      const top = mesh(new THREE.CylinderGeometry(3.75, 3.75, 0.6, 14, 1, false, 0, Math.PI), dark);
      top.rotation.x = Math.PI / 2;
      top.rotation.y = Math.PI / 2;
      top.position.set(k * 10, gA + 6.9, 6.6);
      ars.add(arch, top);
    }
    ars.position.set(ac[0], 0, ac[1]);
    ars.rotation.y = Math.atan2(an[0], an[1]);
    add('oldport', ars);
    out.arsenal = ac;
  }

  // ---------------------------------------------------------------- Lazareti
  {
    const g = group('lazareti');
    for (const hr of anchors.lazaretiHalls) {
      const r = normaliseRing(hr);
      const g0 = minGround(r);
      g.add(mesh(prism(r, g0 - 3, g0 + 6.5), mats.lazStone, 'lazareti'));
      const roof = new THREE.Mesh(hippedRoof(r, g0 + 6.5, 3, { shrink: 0.25, over: 0.4 }), mats.roof);
      roof.castShadow = true;
      g.add(roof);
    }
    add('lazareti', g);
    out.timeline.lazareti = g;
  }

  // ---------------------------------------------------------------- Fort Imperial on Srđ
  {
    const r = normaliseRing(W.imperial);
    const c = centroid(r);
    const g0 = minGround(r);
    const top = g0 + 11;
    const g = group('imperial');
    g.add(mesh(prism(r, g0 - 5, top), fortStone, 'imperial'));
    crown(g, r, top, { mat: fortStone });
    const core = scaleRing(r, 0.45);
    g.add(mesh(prism(core, top, top + 4), fortStone));
    crown(g, core, top + 4, { mat: fortStone });
    g.add(instanced(unitBox, dark, openings(r, [top - 4], { spacing: 6, w: 1.2, h: 1.0 })));
    add('srd', g);
    out.timeline.imperial = g;
    // the stone cross above the town
    const cr = anchors.cross;
    const cy = heightAt(cr[0], cr[1]);
    const cross = group('cross');
    const v = mesh(new THREE.BoxGeometry(1.4, 14, 1.4), mats.white);
    v.position.set(0, 7, 0);
    const h = mesh(new THREE.BoxGeometry(7, 1.4, 1.4), mats.white);
    h.position.set(0, 10, 0);
    cross.add(v, h);
    cross.position.set(cr[0], cy, cr[1]);
    add('srd', cross);
    out.guns.push({ key: 'imperial', x: c[0], z: c[1], y: top + 4, kind: 'fort', range: 400 });
  }

  // ---------------------------------------------------------------- Fort Royal on Lokrum (no feature model: Lokrum uses its ground ring)
  {
    const r = normaliseRing(W.royal);
    const g0 = minGround(r);
    const g = group('royal');
    g.add(mesh(prism(r, g0 - 4, g0 + 8), fortStone, 'royal'));
    crown(g, r, g0 + 8, { mat: fortStone });
    out.royal = g;
    out.timeline.royal = g;
  }

  // ---------------------------------------------------------------- Outer wall, bastions and moat
  {
    const g = group('outerwall');
    const lines = [geo.outer.west, geo.outer.minceta, geo.outer.north];
    for (const line of lines) {
      const band = bandRing(line, 2.4);
      g.add(mesh(prism(band, (x, z) => heightAt(x, z) - 5, (x, z) => heightAt(x, z) + 2.6), mats.outerStone, 'outer'));
      // parapet merlons along the outer edge
      g.add(instanced(unitBox, mats.outerStone, merlonMatrices(line, (x, z) => heightAt(x, z) + 2.6, { closed: false, spacing: 3, w: 1.2, h: 0.9, d: 0.6, inset: 0 })));
    }
    out.outerBastions = [];
    for (const [x, z, R] of geo.outer.bastions) {
      const r = circleRing(x, z, R, 18);
      const gb = Math.max(...r.map(([a, b]) => heightAt(a, b)));
      const top = gb + 3.2;
      g.add(mesh(prism(r, minGround(r) - 5, top), mats.outerStone, 'bastion'));
      crown(g, r, top, { mat: mats.outerStone });
      out.guns.push({ key: 'bastion', x, z, y: top, kind: 'bastion' });
      out.outerBastions.push([x, z, top]);
    }
    add('outerwall', g);
    out.timeline.outerwall = g;
  }

  return out;
}

function norm(x, z) {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

/** A closed band polygon of width w centred on an open polyline. */
function bandRing(line, w) {
  const left = [], right = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const n = norm(b[1] - a[1], -(b[0] - a[0]));
    left.push([line[i][0] + n[0] * w / 2, line[i][1] + n[1] * w / 2]);
    right.push([line[i][0] - n[0] * w / 2, line[i][1] - n[1] * w / 2]);
  }
  return normaliseRing(left.concat(right.reverse()));
}

/** Stone bridge with round arches from `start` along `dir`. */
function buildBridge(start, dir, L, width, { arches, mats, mesh }) {
  const g = new THREE.Group();
  g.name = 'bridge';
  const end = [start[0] + dir[0] * L, start[1] + dir[1] * L];
  const deckY = Math.max(heightAt(end[0], end[1]), heightAt(start[0], start[1]) - 1) + 0.3;
  let floor = Infinity;
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    floor = Math.min(floor, heightAt(start[0] + dir[0] * L * t, start[1] + dir[1] * L * t));
  }
  const parts = [];
  const deck = new THREE.BoxGeometry(width, 1.4, L);
  deck.translate(0, deckY - 0.7, L / 2);
  parts.push(deck);
  for (const s of [-1, 1]) {
    const p = new THREE.BoxGeometry(0.5, 1.1, L);
    p.translate(s * (width / 2 - 0.25), deckY + 0.55, L / 2);
    parts.push(p);
  }
  const span = L / arches;
  for (let k = 0; k <= arches; k++) {
    const pier = new THREE.BoxGeometry(width, Math.max(1, deckY - floor + 3), k === 0 || k === arches ? 2.4 : 1.8);
    pier.translate(0, (deckY + floor - 3) / 2 - 0.7, k * span);
    parts.push(pier);
  }
  for (let k = 0; k < arches; k++) {
    const a = archGeometry(span - 1.8, width, 1.0, 12);
    a.rotateY(Math.PI / 2);
    const archBase = Math.max(floor, deckY - 1.4 - (span - 1.8) / 2 - 0.6);
    a.translate(0, archBase, (k + 0.5) * span);
    parts.push(a);
    // spandrel fill above the arch
    const sp = new THREE.BoxGeometry(width * 0.98, 1.2, span - 1.6);
    sp.translate(0, deckY - 1.9, (k + 0.5) * span);
    parts.push(sp);
  }
  const m = mesh(mergeGeometries(parts.map(nonIndexed)), mats.bridgeStone, 'bridge');
  g.add(m);
  g.position.set(start[0], 0, start[1]);
  g.rotation.y = Math.atan2(dir[0], dir[1]);
  g.userData.deckY = deckY;
  return g;
}
