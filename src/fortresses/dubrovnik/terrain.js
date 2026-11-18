// Dubrovnik terrain: heightAt(x, z) and colorAt(...), in the local metric frame.
// Spatially indexed so a full 600×600 terrain samples in well under half a second.
import { EdgeIndex, pointInRing, bbox, nearestOnPolyline } from '../../core/geo.js';
import { fbm, ridged, smoothstep, lerp, clamp } from '../../core/noise.js';
import { geo, anchors, stradunInfo } from './layout.js';

const ring = geo.ring;

// ---- indexes -------------------------------------------------------------
const landRings = [geo.land, geo.lokrum, geo.kase, ...geo.islets];
const landIdx = new EdgeIndex(landRings.map((pts) => ({ pts, closed: true })), 10);
// coarse coastline for far-field distances
const thin = (pts, step) => {
  const out = [pts[0]];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= step) out.push(p);
  }
  return out;
};
const coarseIdx = new EdgeIndex(landRings.map((pts) => ({ pts: thin(pts, 18), closed: true })), 8);
const ringIdx = new EdgeIndex([{ pts: ring, closed: true }], 8);
const ringBox = bbox(ring);

const withBox = (r) => ({ r, b: bbox(r) });
const inBox = (o, x, z, m = 0) => x >= o.b[0] - m && x <= o.b[2] + m && z >= o.b[1] - m && z <= o.b[3] + m;
const lokrum = withBox(geo.lokrum);
const kase = withBox(geo.kase);
const islets = geo.islets.map(withBox);

// dry moat: between the land front of the main wall and the outer (scarp) wall
const scarp = [...geo.outer.west, ...geo.outer.minceta, ...geo.outer.north];
const moat = withBox(ring.slice(0, geo.sides.harbour + 1).concat(scarp.slice().reverse()));
const scarpIdx = new EdgeIndex([
  { pts: geo.outer.west, closed: false }, { pts: geo.outer.minceta, closed: false }, { pts: geo.outer.north, closed: false },
], 8);

// Srđ ridge: [x, z, crest height]; Srđ summit 412 m about 1 km north of the walls
const S = anchors.srd;
const RIDGE = [
  [-1900, -700, 95], [-1100, -820, 150], [-450, -930, 270], [S[0] - 250, S[1] + 10, 380], [S[0], S[1], 412],
  [S[0] + 500, S[1] + 120, 385], [S[0] + 1200, S[1] + 520, 330], [S[0] + 2000, S[1] + 1150, 320], [S[0] + 2500, S[1] + 1650, 300],
];
const ridgePts = RIDGE.map((r) => [r[0], r[1]]);

const lov = anchors.lovrijenac;
const royal = geo.points.royal;
const port = anchors.oldPort;
const banje = [anchors.ploceOuter[0] + 150, anchors.ploceOuter[1] + 70]; // Banje beach, east of Ploče

export function coastDist(x, z) {
  const d = landIdx.dist(x, z, 60);
  return d < 60 ? d : coarseIdx.dist(x, z, 6000);
}

function townGround(x, z) {
  const s = stradunInfo(x, z);
  if (s.north > 0) {
    // the north side climbs ~27 m towards Minčeta
    return 3.4 + 25 * Math.pow(smoothstep(6, 185, s.d), 0.85);
  }
  // the rocky south-west climbs to the cliff-top sea walls; the south-east stays at harbour level
  const w = smoothstep(395, 175, x);
  return 3.4 + (1.2 + 15 * w) * smoothstep(6, 150, s.d);
}

function srd(x, z, dc) {
  const n = nearestOnPolyline(x, z, ridgePts);
  const a = RIDGE[n.i], b = RIDGE[n.i + 1];
  const H = lerp(a[2], b[2], n.t);
  // north of the crest the ground falls away inland
  const rz = lerp(a[1], b[1], n.t);
  if (z < rz - 1) return H - Math.min(n.d * 0.35, H * 0.55);
  const frac = dc / (dc + n.d + 1e-6);
  // low by the shore, steep flank, a plateau on top
  return H * smoothstep(0, 1, Math.pow(frac, 0.92));
}

/** Ground height in metres (sea level 0). */
export function heightAt(x, z) {
  const onLand = landIdx.inside(x, z);
  const dc = coastDist(x, z);
  if (!onLand) {
    // sea: depth grows with distance from shore; the Old Port is shallow and flat
    let d = -(1.2 + Math.min(dc, 900) * 0.11 + Math.sqrt(Math.min(dc, 2500)) * 0.6);
    const dp = Math.hypot(x - port[0], z - port[1]);
    d = lerp(-3.6, d, smoothstep(70, 130, dp));
    return d + fbm(x * 0.01, z * 0.01, 3) * 1.2;
  }
  // Lokrum rises to ~96 m around Fort Royal
  if (inBox(lokrum, x, z) && pointInRing(x, z, lokrum.r)) {
    const dr = Math.hypot(x - royal[0], z - royal[1]);
    const frac = dc / (dc + dr * 0.9 + 1e-6);
    return 1.5 + 94 * Math.pow(frac, 1.05) + 3 * smoothstep(0, 8, dc) + fbm(x * 0.02, z * 0.02, 4) * 4 * smoothstep(0, 40, dc);
  }
  if (inBox(kase, x, z) && pointInRing(x, z, kase.r)) return 1.7;
  for (const o of islets) if (inBox(o, x, z) && pointInRing(x, z, o.r)) return 2 + Math.min(dc * 0.9, 9);

  const inTown = x > ringBox[0] && x < ringBox[2] && z > ringBox[1] && z < ringBox[3] && ringIdx.inside(x, z);
  if (inTown) return townGround(x, z) + fbm(x * 0.05, z * 0.05, 2) * 0.25;

  const dr = ringIdx.dist(x, z, 3000);
  let h = srd(x, z, dc);
  // rugged karst noise grows with distance from the walls
  const rough = smoothstep(60, 700, dr);
  h += (ridged(x * 0.004, z * 0.004, 4) - 0.55) * 46 * rough * smoothstep(0, 120, dc);
  h += fbm(x * 0.02, z * 0.02, 3) * (1 + 5 * rough);

  // shore: cliffs under the sea walls, a gentle ramp at Banje beach
  const db = Math.hypot(x - banje[0], z - banje[1]);
  const beachy = 1 - smoothstep(60, 140, db);
  const nearWalls = 1 - smoothstep(20, 90, dr);
  const cliffTop = lerp(lerp(5, 12, nearWalls), 2.5, beachy);
  const cliffW = lerp(lerp(14, 6, nearWalls), 60, beachy);
  h += cliffTop * (1 - Math.pow(1 - smoothstep(0, cliffW, dc), 2));

  // close to the walls, outside ground meets the town level at the wall foot and only
  // then climbs towards Srđ (never raises the sea-side rocks)
  if (dr < 170) {
    const t = 1 - smoothstep(18, 170, dr);
    const g = townGround(x, z) + 1.5 + dr * 0.1;
    h = lerp(h, Math.min(h, g), t);
  }

  // the 37 m rock under Lovrijenac
  const dl = Math.hypot(x - lov[0], z - lov[1]);
  if (dl < 70) h = Math.max(h, 37 * (1 - Math.pow(smoothstep(14, 62, dl), 1.4)) * smoothstep(0, 5, dc) + 1);

  // dry moat ~4.5 m deep between the land walls and the outer wall
  if (inBox(moat, x, z, 2) && pointInRing(x, z, moat.r)) {
    const edge = Math.min(dr, scarpIdx.dist(x, z, 20));
    h -= 4.5 * smoothstep(0.8, 3.5, edge);
  }
  return h;
}

export function inMoat(x, z) {
  return inBox(moat, x, z) && pointInRing(x, z, moat.r) && !ringIdx.inside(x, z);
}


// ---- colour --------------------------------------------------------------
const C = {
  sand: [0.78, 0.71, 0.55], wetSand: [0.55, 0.5, 0.4], deep: [0.12, 0.2, 0.24],
  rockLight: [0.74, 0.71, 0.64], rock: [0.56, 0.53, 0.48], karst: [0.62, 0.6, 0.55],
  grass: [0.42, 0.45, 0.27], dryGrass: [0.58, 0.55, 0.36], scrub: [0.33, 0.38, 0.22],
  pave: [0.7, 0.64, 0.54], moat: [0.42, 0.44, 0.28],
};
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Vertex colour from height, slope (normal.y), beaches, moat and town ground. */
export function colorAt(x, z, h, ny, ctx = {}) {
  const n = fbm(x * 0.03, z * 0.03, 3);
  if (h < 0.4) {
    const t = smoothstep(0.4, -14, h);
    return mix(mix(C.sand, C.wetSand, smoothstep(0.4, -2, h)), C.deep, t);
  }
  if (ctx.inTown) return mix(C.pave, C.rockLight, 0.3 + n * 0.3);
  if (ctx.beach) return mix(C.sand, C.rockLight, 0.2 + n * 0.2);
  if (ctx.moat) return mix(C.moat, C.dryGrass, 0.4 + n * 0.4);
  const steep = smoothstep(0.86, 0.6, ny);
  let col = mix(C.dryGrass, C.grass, clamp(0.5 + n * 0.8, 0, 1));
  col = mix(col, C.scrub, smoothstep(40, 200, h) * 0.6 * (0.6 + n));
  col = mix(col, C.karst, smoothstep(220, 380, h) * 0.65);
  col = mix(col, C.rock, steep * 0.85);
  // a pale limestone fringe along the shore
  col = mix(col, C.rockLight, smoothstep(5, 0.8, h) * 0.8);
  return col;
}
