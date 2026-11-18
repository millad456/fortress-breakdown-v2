// Derive the compact geometry file for the site from the cached OSM data.
//   node scripts/build-geo.mjs  ->  src/fortresses/dubrovnik/geo.json
// Frame: x = east, z = south, metres; origin just inside Pile Gate.
import { writeFileSync } from 'node:fs';
import {
  loadOsm, simplify, simplifyRing, openRing, signedArea, centroid, pointInRing, roundPts, round1, LAT0, LON0,
} from './lib/osm.mjs';

const osm = loadOsm();
const { ways, rels, pts } = osm;
const way = (id) => {
  const w = ways.get(id);
  if (!w) throw new Error('missing way ' + id);
  return w;
};
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

// ---------------------------------------------------------------------------
// 1. Main wall ring: outer face, clockwise from Pile Gate (N -> E -> S -> W).
//    Explicit order, checked on the plot (npm run plot). [id, reversed]
// ---------------------------------------------------------------------------
const RING_WAYS = [
  [668283214, false], // Pile: round the inner gate to the land wall
  [668283213, false],
  [1466480192, true], // north-west land wall, outer face, up to Minčeta
  [1395740268, true], // round the outside of Minčeta
  [1297349984, true], // Minčeta -> Sv. Barbara
  [1297349983, true],
  [1297349982, true], // -> Sv. Lucija
  [1297349981, false],
  [171294838, false], // -> Sv. Vid, Drezvenik
  [171290433, true], // north wall past Sv. Jakov to Asimon
  [668156509, true], // Asimon -> Sv. Luka
  [668156263, true], // round Sv. Luka to the harbour
  [668155584, true], // harbour front, Ribarnica, Ponte
  [843280379, true], // harbour wall to St John
  [668103697, true], // sea walls: St John -> Spasitelj -> Stjepan -> Margarita
  [653117906, true], // south-west sea walls -> Sv. Petar -> Bokar
  [171286081, false], // Bokar -> Puncjela
  [171286080, true], // Puncjela -> Pile
];

function stitch(list) {
  let chain = [];
  for (const [id, rev] of list) {
    let p = pts(way(id));
    if (rev) p = p.slice().reverse();
    if (!chain.length) { chain = p; continue; }
    // join where the two ways come closest (handles overlaps at both ends)
    const K = 12;
    let best = Infinity, bi = chain.length - 1, bj = 0;
    for (let i = Math.max(0, chain.length - K); i < chain.length; i++)
      for (let j = 0; j < Math.min(K, p.length); j++) {
        const d = d2(chain[i], p[j]);
        if (d < best) { best = d; bi = i; bj = j; }
      }
    if (Math.sqrt(best) > 25) console.warn(`  gap of ${Math.sqrt(best).toFixed(1)} m before way ${id}`);
    chain = chain.slice(0, bi + 1).concat(best < 0.25 ? p.slice(bj + 1) : p.slice(bj));
  }
  // close: drop the overlapping last points at Pile
  const K = 12;
  let best = Infinity, bi = chain.length - 1, bj = 0;
  for (let i = chain.length - K; i < chain.length; i++)
    for (let j = 0; j < K; j++) {
      const d = d2(chain[i], chain[j]);
      if (d < best) { best = d; bi = i; bj = j; }
    }
  chain = chain.slice(bj, bi + 1);
  if (d2(chain[0], chain[chain.length - 1]) < 0.25) chain.pop();
  return chain;
}

let ring = simplifyRing(stitch(RING_WAYS), 0.7);
// signedArea > 0 in (x east, z south) means clockwise as seen on a north-up map
if (signedArea(ring) < 0) throw new Error('ring is not clockwise');
ring = roundPts(ring);

// ---------------------------------------------------------------------------
// 2. Named works (towers, forts, gates) by OSM name
// ---------------------------------------------------------------------------
const NAMED = {
  minceta: 'Minčeta', bokar: 'Bokar', puncjela: 'Puncjela', barbara: 'Sv. Barbara', lucija: 'Sv. Lucija',
  vid: 'Sv. Vid', drezvenik: 'Drezvenik', jakov: 'Sv. Jakov', asimon: 'Asimon', luka: 'Sv. Luka',
  ivan: 'Sv. Ivan', spasitelj: 'Sv. Spasitelj', stjepan: 'Sv. Stjepan', margarita: 'Sv. Margarita',
  petar: 'Sv. Petar', pile: 'Vrata od Pila', ploce: 'Vrata od Ploča', revelin: 'Revelin',
  lovrijenac: 'Lovrijenac', imperial: 'Tvrđava Imperial', gornjiUgao: 'Kula Gornji ugao',
  royal: 'Utvrda Royal', bellTower: 'Gradski zvonik', onofrio: 'Velika Onofrijeva česma',
};
const works = {};
for (const w of ways.values()) {
  const n = w.tags?.name;
  for (const [k, v] of Object.entries(NAMED)) {
    if (n === v && !works[k] && w.nodes[0] === w.nodes[w.nodes.length - 1]) works[k] = w;
  }
}
for (const k of Object.keys(NAMED)) if (!works[k]) throw new Error('no footprint for ' + NAMED[k]);
const worksOut = {};
for (const [k, w] of Object.entries(works)) {
  let r = openRing(pts(w));
  if (signedArea(r) < 0) r.reverse();
  worksOut[k] = roundPts(simplifyRing(r, 0.3));
}
worksOut.mincetaInner = roundPts(openRing(pts(way(171296971))));
worksOut.ploceOuter = roundPts(simplifyRing(openRing(pts(way(172618650))), 0.4)); // Ploče outer gate enclosure
worksOut.unnamedTower = roundPts(openRing(pts(way(1466480191))));

// ---------------------------------------------------------------------------
// 3. Ring sides: land / harbour / sea / west, as index ranges along the ring
// ---------------------------------------------------------------------------
function nearestIndex(p) {
  let bi = 0, bd = Infinity;
  ring.forEach((q, i) => { const d = d2(p, q); if (d < bd) { bd = d; bi = i; } });
  return bi;
}
const cen = (k) => centroid(worksOut[k]);
const sides = {
  // start index of each side, in ring order
  land: 0, // Pile -> Minčeta -> Asimon
  harbour: nearestIndex(cen('asimon')),
  sea: nearestIndex(cen('ivan')),
  west: nearestIndex(cen('bokar')),
};

// ---------------------------------------------------------------------------
// 4. Outer (scarp) wall: mapped western stretch + synthesised northern stretch
// ---------------------------------------------------------------------------
const westScarp = roundPts(simplify(pts(way(171283156)).slice().reverse(), 0.5)); // Pile -> Minčeta
const mincetaScarp = roundPts(simplify(pts(way(191745607)).slice().reverse(), 0.5));
// north: offset the land front Minčeta -> Revelin outward 14–19 m
const iMin = nearestIndex(cen('minceta'));
const iAsi = sides.harbour;
const north = [];
const nRing = ring.length;
const landFront = [];
for (let i = iMin; i <= iAsi; i++) landFront.push(ring[i]);
// smooth the front so the offset line does not echo every tower
const smoothFront = landFront.map((_, i) => {
  let x = 0, z = 0, c = 0;
  for (let k = -4; k <= 4; k++) {
    const q = landFront[Math.max(0, Math.min(landFront.length - 1, i + k))];
    x += q[0]; z += q[1]; c++;
  }
  return [x / c, z / c];
});
let acc = 0;
for (let i = 0; i < smoothFront.length; i++) {
  const a = smoothFront[Math.max(0, i - 1)], b = smoothFront[Math.min(smoothFront.length - 1, i + 1)];
  let tx = b[0] - a[0], tz = b[1] - a[1];
  const l = Math.hypot(tx, tz) || 1;
  tx /= l; tz /= l;
  // clockwise ring: outward normal is to the left of travel in (x,z) = (tz, -tx)
  const nx = tz, nz = -tx;
  if (i) acc += Math.hypot(smoothFront[i][0] - smoothFront[i - 1][0], smoothFront[i][1] - smoothFront[i - 1][1]);
  const off = 14 + 5 * Math.sin(acc / 40) ** 2;
  north.push([smoothFront[i][0] + nx * off, smoothFront[i][1] + nz * off]);
}
const northScarp = roundPts(simplify(north.filter((p) => !pointInRing(p[0], p[1], worksOut.revelin)), 1.0))
  .slice(2); // start clear of Minčeta's own scarp

// bastions: western ones found as bulges of the mapped line; northern ones spaced along the synthetic line
function distToRing(p) {
  let best = Infinity;
  for (let i = 0; i < nRing; i++) {
    const a = ring[i], b = ring[(i + 1) % nRing];
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(a[0] + t * dx - p[0], a[1] + t * dz - p[1]));
  }
  return best;
}
const bastions = [];
{
  const raw = pts(way(171283156));
  const ds = raw.map(distToRing);
  for (let i = 2; i < raw.length - 2; i++) {
    const isMax = ds[i] >= ds[i - 1] && ds[i] >= ds[i + 1] && ds[i] >= ds[i - 2] && ds[i] >= ds[i + 2] && ds[i] > 6;
    // a semicircle is drawn with closely spaced vertices; a lone kink in a straight run is not a bastion
    const tight = Math.sqrt(d2(raw[i], raw[i - 1])) < 7 && Math.sqrt(d2(raw[i], raw[i + 1])) < 7;
    if (isMax && tight) {
      // the apex of a semicircle: centre lies back towards the wall
      const R = 6;
      const near = ring[nearestIndex(raw[i])];
      const vx = near[0] - raw[i][0], vz = near[1] - raw[i][1], l = Math.hypot(vx, vz);
      const c = [raw[i][0] + (vx / l) * R, raw[i][1] + (vz / l) * R];
      if (!bastions.some((b) => Math.hypot(b[0] - c[0], b[1] - c[1]) < 18)) bastions.push([round1(c[0]), round1(c[1]), R]);
    }
  }
  let run = 0;
  for (let i = 1; i < northScarp.length; i++) {
    run += Math.hypot(northScarp[i][0] - northScarp[i - 1][0], northScarp[i][1] - northScarp[i - 1][1]);
    if (run > 55 && i < northScarp.length - 2) {
      bastions.push([northScarp[i][0], northScarp[i][1], 6]);
      run = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Coastline -> one land polygon (east -> west, closed far inland), Lokrum, Kaše
// ---------------------------------------------------------------------------
const MAINLAND = [1232419797, 1232419800, 668081876, 1231141421, 1432601416, 1231141420, 632668329];
let coast = [];
for (const id of MAINLAND) {
  const p = pts(way(id));
  coast = coast.length ? coast.concat(p.slice(1)) : p;
}
coast.reverse(); // east -> west
const TOWN = [250, 60];
const tolCoast = (p) => {
  const d = Math.hypot(p[0] - TOWN[0], p[1] - TOWN[1]);
  return Math.min(14, 0.6 + Math.max(0, d - 350) * 0.012);
};
coast = simplify(coast, tolCoast);
const east = coast[0], west = coast[coast.length - 1];
const land = roundPts(coast.concat([[west[0], -5000], [east[0], -5000]]));
const ringOf = (id, tol) => {
  let r = openRing(pts(way(id)));
  if (signedArea(r) < 0) r.reverse();
  return roundPts(simplifyRing(r, tol));
};
const lokrum = ringOf(6193666, 2.5);
const kase = ringOf(37407537, 0.4);
const islets = [172032201, 172032202, 1072828812].map((id) => ringOf(id, 0.8));

// ---------------------------------------------------------------------------
// 6. Buildings within ~1 km of town (flat delta-encoded rings in decimetres)
// ---------------------------------------------------------------------------
function encode(r) {
  const out = [];
  let px = 0, pz = 0;
  for (const [x, z] of r) {
    const ix = Math.round(x * 10), iz = Math.round(z * 10);
    out.push(ix - px, iz - pz);
    px = ix; pz = iz;
  }
  return out;
}
const buildings = [];
const CHURCH = /^(church|chapel|cathedral)$/;
function addBuilding(r, tags) {
  r = openRing(r);
  if (r.length < 3) return;
  const c = centroid(r);
  if (Math.hypot(c[0] - TOWN[0], c[1] - TOWN[1]) > 1050) return;
  if (Math.abs(signedArea(r)) < 6) return;
  // skip the fortifications themselves: they are modelled separately
  for (const k of ['minceta', 'bokar', 'revelin', 'lovrijenac', 'ivan', 'imperial', 'royal', 'pile', 'ploce',
    'asimon', 'puncjela', 'barbara', 'lucija', 'vid', 'drezvenik', 'jakov', 'luka', 'spasitelj', 'stjepan',
    'margarita', 'petar', 'gornjiUgao', 'bellTower', 'onofrio']) {
    if (pointInRing(c[0], c[1], worksOut[k])) return;
  }
  const inside = pointInRing(c[0], c[1], ring);
  r = simplifyRing(r, inside ? 0.35 : 0.7);
  if (r.length < 3) return;
  if (signedArea(r) < 0) r.reverse();
  const b = { r: encode(r) };
  if (inside) b.i = 1;
  const isChurch = CHURCH.test(tags.building || '') || tags.amenity === 'place_of_worship';
  if (isChurch) b.k = 'church';
  if (tags.name && (inside || isChurch)) b.n = tags.name;
  const lv = parseInt(tags['building:levels'], 10);
  if (lv > 0 && lv < 15) b.l = lv;
  buildings.push(b);
}
const fortIds = new Set(Object.values(works).map((w) => w.id));
for (const w of ways.values()) {
  const t = w.tags || {};
  if (!t.building || fortIds.has(w.id)) continue;
  if (w.nodes[0] !== w.nodes[w.nodes.length - 1]) continue;
  addBuilding(pts(w), t);
}
for (const rel of rels) {
  if (!rel.tags?.building) continue;
  const outer = rel.members.filter((m) => m.type === 'way' && m.role === 'outer' && ways.has(m.ref));
  for (const m of outer) {
    const w = ways.get(m.ref);
    if (w.nodes[0] === w.nodes[w.nodes.length - 1]) addBuilding(pts(w), rel.tags);
  }
}

// ---------------------------------------------------------------------------
// 7. Green areas, beaches, Stradun axis, named points
// ---------------------------------------------------------------------------
const green = [];
const beaches = [];
const greenTag = (t) =>
  ['wood', 'scrub', 'heath'].includes(t.natural) || t.landuse === 'forest' || ['park', 'garden'].includes(t.leisure);
function addArea(list, r, kind) {
  r = openRing(r);
  if (r.length < 3) return;
  const c = centroid(r);
  if (c[0] < -1700 || c[0] > 2500 || c[1] < -1800 || c[1] > 2400) return;
  if (signedArea(r) < 0) r.reverse();
  r = simplifyRing(r, 2);
  if (r.length < 3 || Math.abs(signedArea(r)) < 40) return;
  list.push({ k: kind, r: encode(r) });
}
for (const w of ways.values()) {
  const t = w.tags || {};
  if (w.nodes[0] !== w.nodes[w.nodes.length - 1]) continue;
  if (greenTag(t)) addArea(green, pts(w), t.natural === 'scrub' || t.natural === 'heath' ? 'scrub' : t.leisure ? 'park' : 'wood');
  else if (t.natural === 'beach') addArea(beaches, pts(w), 'beach');
}
for (const rel of rels) {
  const t = rel.tags || {};
  if (!greenTag(t)) continue;
  for (const m of rel.members) if (m.role === 'outer' && ways.has(m.ref)) {
    const w = ways.get(m.ref);
    if (w.nodes[0] === w.nodes[w.nodes.length - 1]) addArea(green, pts(w), 'wood');
  }
}
const stradun = roundPts(simplify(pts(way(987089809)), 0.8)).reverse(); // Pile -> Luža
const nodeXY = (pred) => {
  for (const e of osm.elements) if (e.type === 'node' && e.tags && pred(e.tags)) return roundPts([pts({ nodes: [e.id] })[0]])[0];
  return null;
};
const points = {
  srd: nodeXY((t) => t.natural === 'peak' && t.name === 'Srđ'),
  cross: nodeXY((t) => t.man_made === 'cross'),
  porporela: nodeXY((t) => t.name === 'Porporela'),
  royal: roundPts([centroid(worksOut.royal)])[0],
  lokrumPeak: nodeXY((t) => t.natural === 'peak' && t.ele === '96'),
};

// ---------------------------------------------------------------------------
const geo = {
  source: 'OpenStreetMap contributors (ODbL), fetched ' + new Date().toISOString().slice(0, 10),
  frame: { lat0: LAT0, lon0: LON0, x: 'east', z: 'south', unit: 'm' },
  ring, sides, works: worksOut,
  outer: { west: westScarp, minceta: mincetaScarp, north: northScarp, bastions },
  land, lokrum, kase, islets,
  buildings, green, beaches, stradun, points,
};
const json = JSON.stringify(geo);
writeFileSync('src/fortresses/dubrovnik/geo.json', json);
console.log(`ring ${ring.length} pts, ${buildings.length} buildings (${buildings.filter((b) => b.i).length} inside),`
  + ` ${green.length} green, ${beaches.length} beaches, ${bastions.length} bastions`);
console.log(`geo.json ${(json.length / 1024).toFixed(1)} kB`);
