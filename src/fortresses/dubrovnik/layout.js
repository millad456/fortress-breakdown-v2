// Every anchor point for Dubrovnik, derived from geo.json in one place.
// Nothing else in the code base hand-places coordinates: it asks this module.
import geo from './geo.json' with { type: 'json' };
import { centroid, decodeRing, pointInRing, nearestOnPolyline } from '../../core/geo.js';

export { geo };

const W = geo.works;
const c = (k) => centroid(W[k]);
const ring = geo.ring;
const N = ring.length;

/** ring vertex ranges per side, in ring order */
export const SIDE_ORDER = ['land', 'harbour', 'sea', 'west'];
export function sideOfIndex(i) {
  const s = geo.sides;
  if (i >= s.west) return 'west';
  if (i >= s.sea) return 'sea';
  if (i >= s.harbour) return 'harbour';
  return 'land';
}

export const insideTown = (x, z) => pointInRing(x, z, ring);

/** outward unit normal of the ring at vertex i (ring is clockwise on a north-up map) */
export function ringNormal(i) {
  const a = ring[(i - 1 + N) % N], b = ring[(i + 1) % N];
  let tx = b[0] - a[0], tz = b[1] - a[1];
  const l = Math.hypot(tx, tz) || 1;
  return [tz / l, -tx / l];
}

const townCentre = centroid(ring);
const stradun = geo.stradun;

export const anchors = {
  townCentre,
  pile: c('pile'),
  ploce: c('ploce'),
  ploceOuter: centroid(W.ploceOuter),
  minceta: c('minceta'),
  bokar: c('bokar'),
  revelin: c('revelin'),
  lovrijenac: c('lovrijenac'),
  ivan: c('ivan'),
  imperial: c('imperial'),
  royal: c('royal'),
  asimon: c('asimon'),
  luka: c('luka'),
  puncjela: c('puncjela'),
  margarita: c('margarita'),
  stjepan: c('stjepan'),
  spasitelj: c('spasitelj'),
  petar: c('petar'),
  barbara: c('barbara'),
  lucija: c('lucija'),
  vid: c('vid'),
  drezvenik: c('drezvenik'),
  jakov: c('jakov'),
  gornjiUgao: c('gornjiUgao'),
  bellTower: c('bellTower'),
  onofrio: c('onofrio'),
  kase: centroid(geo.kase),
  stradunWest: stradun[0],
  stradunEast: stradun[stradun.length - 1],
  stradunMid: stradun[Math.floor(stradun.length / 2)],
  lokrum: centroid(geo.lokrum),
  srd: geo.points.srd,
  cross: geo.points.cross,
  porporela: geo.points.porporela,
  lazareti: null, // set below
  oldPort: null,
};

// Old Port: the water between the harbour wall, St John and Kaše
{
  const hs = geo.sides.harbour, sea = geo.sides.sea;
  const mid = ring[Math.floor((hs + sea) / 2)];
  const n = ringNormal(Math.floor((hs + sea) / 2));
  anchors.oldPort = [mid[0] + n[0] * 70, mid[1] + n[1] * 70];
}
export const decoded = {
  buildings: geo.buildings.map((b) => ({ ...b, ring: decodeRing(b.r), c: centroid(decodeRing(b.r)) })),
  green: geo.green.map((g) => ({ k: g.k, ring: decodeRing(g.r) })),
  beaches: geo.beaches.map((g) => decodeRing(g.r)),
};

// Lazareti: the row of quarantine halls on the Ploče shore east of the Ploče gates —
// the footprints between the road and the sea, 90–260 m east of the outer gate.
{
  const p = anchors.ploceOuter;
  const halls = decoded.buildings.filter((b) => !b.i && b.c[0] > p[0] + 90 && b.c[0] < p[0] + 260 && b.c[1] > p[1] + 30 && b.c[1] < p[1] + 70);
  halls.sort((a, b) => a.c[0] - b.c[0]);
  halls.forEach((b) => (b.lazareti = true));
  anchors.lazaretiHalls = halls.map((b) => b.ring);
  anchors.lazareti = centroid(halls.map((b) => b.c));
}
// Luža square monuments
{
  const named = (re) => decoded.buildings.find((b) => b.n && re.test(b.n));
  anchors.cathedral = named(/katedrala/i).c;
  anchors.blaise = named(/sv\. Vlaha/i).c;
  anchors.franciscan = named(/^Sv\. Franjo$/).c;
  anchors.dominican = named(/Crkva sv\. Dominika/).c;
  anchors.rector = named(/Knežev dvor/).c;
  anchors.sponza = named(/Sponza/).c;
  // Orlando's Column stands on Luža in front of St Blaise, between it and the bell tower
  const bt = anchors.bellTower, bl = anchors.blaise;
  anchors.orlando = [bt[0] * 0.55 + bl[0] * 0.45 - 8, bt[1] * 0.55 + bl[1] * 0.45];
}

/** Stradun: distance and signed side (+ north) from the street axis */
export function stradunInfo(x, z) {
  const n = nearestOnPolyline(x, z, stradun);
  const a = stradun[n.i], b = stradun[n.i + 1];
  const cross = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
  // travelling east along the street, north (-z) is to the left: cross < 0
  return { d: n.d, north: cross < 0 ? 1 : -1, x: n.x, z: n.z };
}

/** Circuit towers (on the main ring) by key, with their side */
export const CIRCUIT_TOWERS = ['minceta', 'barbara', 'lucija', 'vid', 'drezvenik', 'jakov', 'asimon', 'luka',
  'spasitelj', 'stjepan', 'margarita', 'petar', 'puncjela', 'gornjiUgao'];

export function nearestRingIndex(x, z) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < N; i++) {
    const d = (ring[i][0] - x) ** 2 + (ring[i][1] - z) ** 2;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

/** Orbit-style camera pose around an anchor: distance, azimuth (deg from north, clockwise), elevation (deg) */
export function orbitPose(at, { dist = 160, az = 200, el = 28, y = 10, fov } = {}) {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  const x = at[0] + Math.sin(a) * Math.cos(e) * dist;
  const z = at[1] - Math.cos(a) * Math.cos(e) * dist;
  const p = { pos: [x, y + Math.sin(e) * dist, z], target: [at[0], y, at[1]] };
  if (fov) p.fov = fov;
  return p;
}
