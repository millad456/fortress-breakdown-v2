// Dubrovnik staging data: camera poses, intro path, anatomy classes, guns for the fields of fire,
// siege and diorama set-ups. All positions derive from layout.js anchors.
import { anchors, orbitPose, geo, insideTown } from './layout.js';
import { heightAt } from './terrain.js';
import { rng } from '../../core/noise.js';
import { bbox } from '../../core/geo.js';

const A = anchors;
const tc = A.townCentre;
const mid = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Camera pose for each place (when it is opened) */
export const PLACE_POSES = {
  minceta: orbitPose(A.minceta, { dist: 200, az: 150, el: 22, y: 40 }),
  bokar: orbitPose(A.bokar, { dist: 150, az: 235, el: 16, y: 16 }),
  lovrijenac: orbitPose(A.lovrijenac, { dist: 200, az: 215, el: 17, y: 36 }),
  stjohn: orbitPose(A.ivan, { dist: 190, az: 135, el: 18, y: 10 }),
  revelin: orbitPose(A.revelin, { dist: 175, az: 40, el: 30, y: 18 }),
  pile: orbitPose(mid(A.pile, A.bokar, 0.3), { dist: 165, az: 290, el: 24, y: 10 }),
  ploce: orbitPose(mid(A.asimon, A.ploce), { dist: 150, az: 55, el: 30, y: 14 }),
  outerwall: orbitPose(mid(A.pile, A.minceta), { dist: 260, az: 285, el: 42, y: 18 }),
  landwalls: orbitPose(A.vid, { dist: 330, az: 345, el: 30, y: 30 }),
  seawalls: orbitPose(A.margarita, { dist: 330, az: 200, el: 20, y: 14 }),
  oldport: orbitPose(A.oldPort, { dist: 270, az: 110, el: 30, y: 6 }),
  stradun: orbitPose(mid(A.stradunWest, A.stradunEast, 0.55), { dist: 190, az: 285, el: 30, y: 8 }),
  srd: orbitPose(A.imperial, { dist: 330, az: 175, el: 20, y: 404 }),
  lokrum: orbitPose(A.lokrum, { dist: 900, az: 325, el: 24, y: 30 }),
  lazareti: orbitPose(A.lazareti, { dist: 180, az: 150, el: 22, y: 6 }),
};

/** Named poses used by the tour, the UI and the screenshot script */
export const POSES = {
  overview: orbitPose(tc, { dist: 1000, az: 215, el: 26, y: 10 }),
  plan: { pos: [tc[0] + 20, 1080, tc[1] + 1.5], target: [tc[0] + 20, 0, tc[1]], fov: 46 },
  landfront: orbitPose(mid(A.minceta, A.vid), { dist: 380, az: 330, el: 38, y: 25 }),
  fireOverview: orbitPose(mid(tc, A.ivan, 0.2), { dist: 1500, az: 200, el: 64, y: 0 }),
  diplomacy: orbitPose(tc, { dist: 1900, az: 196, el: 13, y: 60 }),
  morning: orbitPose(tc, { dist: 700, az: 120, el: 20, y: 10 }),
  night: orbitPose(tc, { dist: 520, az: 205, el: 22, y: 10 }),
  lokrum: PLACE_POSES.lokrum,
  srd: PLACE_POSES.srd,
};
export const HOME = POSES.overview;

/** Intro flight (~11 s): low over the sea at dawn, skim to the sea walls, climb the cliff,
 *  sweep the roofs to Minčeta, then pull back to the overview. */
export const INTRO = {
  duration: 11.5,
  hours: [5.25, 7.6],
  keys: [
    { pos: [tc[0] - 330, 4, tc[1] + 1080], target: [tc[0] - 110, 10, tc[1] + 420], fov: 64 },
    { pos: [tc[0] - 120, 7, tc[1] + 400], target: [tc[0] - 30, 22, tc[1] + 200], fov: 62 },
    { pos: [tc[0] - 40, 48, tc[1] + 255], target: [tc[0] - 25, 32, tc[1] + 60], fov: 58 },
    { pos: [tc[0] - 40, 78, tc[1] - 10], target: [A.minceta[0], 45, A.minceta[1]], fov: 54 },
    { pos: [A.minceta[0] - 30, 96, A.minceta[1] + 85], target: [A.minceta[0], 42, A.minceta[1]], fov: 50 },
    { ...HOME, fov: 46 },
  ],
  // the share of the flight at which the title, coordinates and tagline appear
  cues: { title: 0.06, coords: 0.2, tagline: 0.34 },
};

/** Anatomy classes: thickness by wall type (real ranges in the text; model values in the legend) */
export const ANATOMY = [
  { id: 'land', label: 'Land walls · 4–6 m', color: '#d0473a' },
  { id: 'west', label: 'West walls · ~4.5 m', color: '#e08a3c' },
  { id: 'harbour', label: 'Harbour walls · ~3 m', color: '#e6c34a' },
  { id: 'sea', label: 'Sea walls · 1.5–3 m', color: '#58a6d8' },
  { id: 'outer', label: 'Outer wall & bastions', color: '#9b7fd1' },
  { id: 'forts', label: 'Forts · walls up to 6–12 m', color: '#2fb59b' },
];

/** Fields of fire: ranges and colours per class of gun position */
export const FIRE = {
  classes: {
    fort: { color: '#ff7a45', opacity: 0.4, label: 'Forts · 280–420 m' },
    tower: { color: '#ffd166', opacity: 0.26, label: 'Circuit towers & bastions · ~160 m' },
    bastion: { color: '#7ad3ff', opacity: 0.34, label: 'Outer-wall bastions · ~120 m' },
  },
  ranges: { tower: 160, bastion: 120 },
  // the harbour mouth could be closed at night: drawn from St John's to the head of Kaše
  chain: () => {
    const k = geo.kase;
    let head = k[0], bd = Infinity;
    for (const p of k) {
      const d = Math.hypot(p[0] - A.ivan[0], p[1] - A.ivan[1]);
      if (d < bd) { bd = d; head = p; }
    }
    return [A.ivan, head];
  },
  camera: POSES.fireOverview,
};

// ------------------------------------------------------------------ sieges and dioramas
const [bx0, bz0, bx1, bz1] = bbox(geo.ring);
/** a random point inside the walls (rejection sampling) */
export function randomTownPoint(rand) {
  for (let i = 0; i < 200; i++) {
    const x = bx0 + rand() * (bx1 - bx0), z = bz0 + rand() * (bz1 - bz0);
    if (insideTown(x, z)) return [x, heightAt(x, z), z];
  }
  return [tc[0], heightAt(tc[0], tc[1]), tc[1]];
}

/** sea positions in a ring around the town (only where the water is deep enough) */
function seaRing(n, radius, centre, rand, spread = 40) {
  // walk round the circle, keep the angles that fall on water, then thin to n evenly
  const cand = [];
  const steps = n * 6;
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const r = radius + (rand() - 0.5) * spread;
    const x = centre[0] + Math.cos(a) * r, z = centre[1] + Math.sin(a) * r;
    if (heightAt(x, z) < -6) cand.push([x, z, a]);
  }
  if (cand.length <= n) return cand;
  return Array.from({ length: n }, (_, i) => cand[Math.floor((i * cand.length) / n)]);
}
function seaArc(n, centre, r0, r1, a0, a1, rand) {
  const out = [];
  let tries = 0;
  while (out.length < n && tries < n * 40) {
    tries++;
    const a = a0 + rand() * (a1 - a0), r = r0 + rand() * (r1 - r0);
    const x = centre[0] + Math.cos(a) * r, z = centre[1] + Math.sin(a) * r;
    if (heightAt(x, z) < -8) out.push([x, z, a]);
  }
  return out;
}

const rand = rng(866);
// angles are measured in the x–z plane (0 = east, +90° = south)
const SOUTH = Math.PI / 2;

export const SIEGES = {
  saracen: {
    year: 866,
    duration: 46,
    pose: orbitPose(tc, { dist: 950, az: 165, el: 30, y: 0 }),
    hour: 9,
    fleets: [
      // the Aghlabid galleys ring the islet of Laus
      { kind: 'galley', color: '#7a2a20', sail: '#e8dcc0', count: 36, place: () => seaRing(36, 330, [tc[0] - 20, tc[1] + 60], rand, 70),
        from: [tc[0] + 600, tc[1] + 1600], arrive: [0, 0.12], leave: [0.86, 0.99] },
      // ~100 Byzantine ships appear on the horizon and close in
      { kind: 'galley', color: '#2a3c6a', sail: '#d9b77a', count: 100, place: () => seaArc(100, tc, 1500, 2100, SOUTH - 0.9, SOUTH + 0.6, rand),
        from: [tc[0] + 300, tc[1] + 3800], arrive: [0.66, 0.84], hold: true },
    ],
    batteries: [],
    rate: () => 0,
    diorama: { progress: 0.75 },
  },
  russian: {
    year: 1806,
    duration: 48,
    pose: orbitPose(tc, { dist: 820, az: 12, el: 30, y: 60 }),
    hour: 16,
    fleets: [
      { kind: 'sail', color: '#3a2a20', sail: '#efe6d2', count: 6, place: () => seaArc(6, tc, 900, 1300, SOUTH - 0.5, SOUTH + 0.4, rand),
        from: [tc[0], tc[1] + 3000], arrive: [0, 0.15], leave: [0.88, 0.99] },
    ],
    // cannon on Srđ
    batteries: [
      [A.srd[0] + 60, A.srd[1] + 160], [A.cross[0] - 40, A.cross[1] + 40], [A.cross[0] + 120, A.cross[1] + 60],
      [A.srd[0] - 160, A.srd[1] + 190], [A.imperial[0] + 30, A.imperial[1] + 120],
    ].map(([x, z]) => [x, heightAt(x, z) + 2, z]),
    shell: { speed: 210, arc: 0.18, size: 1.4, color: '#2a2622', trail: false },
    rate: (p) => (p < 0.08 || p > 0.85 ? 0 : p < 0.3 ? 1.6 : 2.6),
    fires: 0.35,
    diorama: { progress: 0.5 },
  },
  jna: {
    year: 1991.93,
    duration: 56,
    pose: orbitPose(tc, { dist: 760, az: 150, el: 30, y: 0 }),
    hour: 15.5,
    fleets: [
      { kind: 'gunboat', color: '#5b636b', sail: null, count: 5, place: () => seaArc(5, tc, 650, 1000, SOUTH - 0.6, SOUTH + 0.5, rand),
        from: [tc[0] + 1500, tc[1] + 2500], arrive: [0.05, 0.2], leave: [0.9, 0.99], fire: true },
    ],
    // shelling from the hills: Srđ, Žarkovica (east), Bosanka and the Dubac road
    batteries: [
      [A.srd[0] + 80, A.srd[1] + 140], [A.cross[0] + 200, A.cross[1] - 40],
      [tc[0] + 2350, tc[1] + 480], [tc[0] + 1350, tc[1] - 380], [tc[0] + 2100, tc[1] - 120],
    ].map(([x, z]) => [x, heightAt(x, z) + 3, z]),
    shell: { speed: 330, arc: 0.32, size: 0.9, color: '#ffcf7a', trail: true },
    rate: (p) => (p < 0.05 ? 0 : p < 0.4 ? 1.4 : p < 0.62 ? 5.5 : p < 0.85 ? 1.6 : 0.3),
    fires: 0.55,
    roofDamage: true,
    diorama: { progress: 0.5 },
  },
  quake: {
    year: 1667.5,
    duration: 30,
    pose: orbitPose(tc, { dist: 560, az: 200, el: 38, y: 0 }),
    hour: 19.2,
    fleets: [],
    batteries: [],
    rate: () => 0,
    fires: 0,
    // fires break out across the fallen town
    fireRate: 2.2,
    diorama: { progress: 0.5 },
  },
};

/** Diorama key for each timeline siege marker */
export const DIORAMAS = { saracen: 'saracen', russian: 'russian', jna: 'jna', 1667: 'quake' };

/** Timeline structure keys for the wall sides (the wall ring grows by side) */
export const WALL_YEARS = { 'walls.sea': 700, 'walls.west': 700, 'walls.land': 1150, 'walls.harbour': 1330 };
