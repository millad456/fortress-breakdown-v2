// Dubrovnik: builds the world from geo.json + layout + content. The engine and UI stay generic;
// everything Dubrovnik-specific is assembled here and handed over as plain data and objects.
import * as THREE from 'three';
import content from './content.js';
import { geo, anchors, sideOfIndex, insideTown, decoded, nearestRingIndex } from './layout.js';
import { heightAt, colorAt, inMoat } from './terrain.js';
import { buildTerrain } from '../../world/terrain-mesh.js';
import { buildWater } from '../../world/water.js';
import { buildWallRing } from '../../world/walls.js';
import { HeightField } from '../../world/heightfield.js';
import { stoneMaterial, mergeStaticMeshes } from '../../world/kit.js';
import { pointInRing, centroid } from '../../core/geo.js';
import { groundRing } from '../../world/highlight.js';
import { buildWorks } from './works.js';
import { buildTown } from './town.js';
import { buildTrees } from './trees.js';
import { buildAmbient } from './ambient.js';
import { buildFeatureExtras } from './extras.js';
import * as scenario from './scenario.js';
import { SIDES, fireGuns } from './guns.js';

export { content };

export { SIDES };

export function makeMaterials() {
  const m = {
    stone: stoneMaterial(0xf1e6cf, 'stone', { base: [222, 210, 186] }),
    fortStone: stoneMaterial(0xf4e9d2, 'fort', { base: [226, 214, 190], courses: 10, seed: 9 }),
    outerStone: stoneMaterial(0xe0d3b8, 'outer', { base: [206, 194, 170], seed: 13 }),
    bridgeStone: stoneMaterial(0xead9bc, 'bridge', { base: [216, 200, 174], courses: 6, seed: 5 }),
    lazStone: stoneMaterial(0xe9dcc4, 'laz', { base: [214, 204, 186], seed: 17 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x16120e, roughness: 1 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.6 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xb4583a, roughness: 0.85 }),
    paving: new THREE.MeshStandardMaterial({ color: 0xd8ccb4, roughness: 0.45, metalness: 0.0 }),
    greenLight: new THREE.MeshStandardMaterial({ color: 0x33ff66, emissive: 0x33ff66, emissiveIntensity: 3 }),
  };
  m.wallSides = { land: m.stone, west: m.stone, harbour: m.stone, sea: m.stone };
  return m;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/**
 * Build the Dubrovnik world.
 * @param {import('../../engine/Engine.js').Engine} engine
 * @param {(i:number)=>void} step  called with the index of the loading step reached
 */
export async function build(engine, step = () => {}) {
  const q = engine.quality;
  const scene = engine.scene;
  const root = new THREE.Group();
  root.name = 'dubrovnik';
  scene.add(root);
  const mats = makeMaterials();

  // ---- terrain + water
  step(0);
  await nextFrame();
  const centre = [anchors.townCentre[0] + 60, anchors.townCentre[1] + 150];
  const terrain = buildTerrain({
    cx: centre[0], cz: centre[1], half: 2300, n: q === 'high' ? 600 : 380, core: 0.12,
    heightAt, colorAt,
    ctxAt: (x, z, h) => ({
      inTown: h > 0.5 && Math.abs(x - anchors.townCentre[0]) < 330 && Math.abs(z - anchors.townCentre[1]) < 260 && insideTown(x, z),
      moat: h > 0.5 && Math.abs(x - anchors.townCentre[0]) < 330 && z < anchors.townCentre[1] && inMoat(x, z),
      beach: h > 0 && h < 6 && decoded.beaches.some((b) => pointInRing(x, z, b)),
    }),
  });
  root.add(terrain.mesh);
  const hf = new HeightField(terrain.xs, terrain.zs, terrain.heights);
  engine.groundAt = (x, z) => hf.sample(x, z);
  const water = buildWater(engine, { heightAt, bounds: [centre[0] - 2300, centre[1] - 2300, centre[0] + 2300, centre[1] + 2300] });
  root.add(water.mesh);

  // ---- walls
  step(1);
  await nextFrame();
  const walls = buildWallRing({
    ring: geo.ring, sideOf: sideOfIndex, sides: SIDES, heightAt,
    materials: mats.wallSides, merlonMaterial: mats.stone,
  });
  for (const k of Object.keys(walls.meshes)) root.add(walls.meshes[k], walls.merlons[k]);

  // ---- towers and forts
  step(2);
  await nextFrame();
  const works = buildWorks({ walls, mats });
  // one draw call per material per work: merge the static pieces, then collide against the merged meshes
  works.colliders = [];
  for (const objs of Object.values(works.features)) for (const o of objs) if (o.isGroup) works.colliders.push(...mergeStaticMeshes(o));
  works.colliders.push(...mergeStaticMeshes(works.royal));
  for (const objs of Object.values(works.features)) for (const o of objs) root.add(o);
  root.add(works.royal);

  // ---- town
  step(3);
  await nextFrame();
  const town = buildTown({ engine, mats });
  root.add(town.group);

  // ---- trees, Stradun, ambient
  step(4);
  await nextFrame();
  const extras = buildFeatureExtras({ mats, walls });
  root.add(extras.group);
  const trees = buildTrees({ quality: q, town });
  root.add(trees.group);
  const ambient = buildAmbient({ engine, mats, works, walls, town, extras });
  root.add(ambient.group);

  step(5);
  await nextFrame();

  // feature -> meshes (what lights up when a place is highlighted)
  const featureObjects = { ...works.features };
  const push = (id, ...objs) => (featureObjects[id] ||= []).push(...objs);
  push('landwalls', walls.meshes.land, walls.merlons.land);
  push('seawalls', walls.meshes.sea, walls.merlons.sea, walls.meshes.west, walls.merlons.west);
  push('oldport', walls.meshes.harbour, walls.merlons.harbour);
  push('stradun', ...extras.stradun);

  // Lokrum has no model of its own: it lights up as a pulsing ring on the ground
  const rings = { lokrum: groundRing(anchors.lokrum, 520, heightAt, { width: 14 }) };
  root.add(rings.lokrum);

  // towers by the side of the circuit they stand on
  const towerSide = {};
  for (const [key, g] of Object.entries(works.towerGroups)) {
    const c = anchors[key] || centroid(geo.works[key]);
    towerSide[key] = sideOfIndex(nearestRingIndex(c[0], c[1]));
  }
  const towersOn = (side) => Object.entries(towerSide).filter(([, s]) => s === side).map(([k]) => works.towerGroups[k]);

  // ---- timeline structures: key -> objects + year (walls grow by side; works by their dates)
  const structures = {};
  for (const side of ['sea', 'west', 'land', 'harbour']) {
    structures['walls.' + side] = { objects: [walls.meshes[side], walls.merlons[side], ...towersOn(side)], year: scenario.WALL_YEARS['walls.' + side] };
  }
  for (const item of content.timeline) {
    for (const k of item.structures || []) {
      if (structures[k]) continue;
      if (works.timeline[k]) structures[k] = { objects: [works.timeline[k]], year: item.year };
    }
    for (const k of item.remove || []) if (structures[k]) structures[k].until = item.year;
  }
  // landmarks that need no timeline card of their own
  const byName = (n) => extras.stradun.filter((o) => o.name === n);
  const named = new Set(['stradun-paving', 'luza', 'orlando', 'onofrio']);
  Object.assign(structures, {
    'stradun.paving': { objects: [...byName('stradun-paving'), ...byName('luza')], year: 1468, quiet: true },
    'stradun.bell': { objects: extras.stradun.filter((o) => !named.has(o.name)), year: 1444, quiet: true },
    'stradun.orlando': { objects: byName('orlando'), year: 1418, quiet: true },
    'stradun.onofrio': { objects: [...byName('onofrio'), extras.onofrioMasks], year: 1438, quiet: true },
  });

  // ---- anatomy classes: which meshes take which thickness colour
  const forts = ['minceta', 'bokar', 'stjohn', 'revelin', 'lovrijenac', 'srd'].flatMap((f) => works.features[f] || []);
  const anatomy = {
    land: [walls.meshes.land, walls.merlons.land, ...towersOn('land')],
    west: [walls.meshes.west, walls.merlons.west, ...towersOn('west')],
    harbour: [walls.meshes.harbour, walls.merlons.harbour, ...towersOn('harbour')],
    sea: [walls.meshes.sea, walls.merlons.sea, ...towersOn('sea')],
    outer: [works.timeline.outerwall],
    forts,
  };

  // ---- siege targets: roofs of houses inside the walls, or random points in the streets
  const insideUnits = town.units.map((u, i) => ({ u, i })).filter(({ u }) => insideTown(u.cx, u.cz));
  const pickTarget = (rand) => {
    if (rand() < 0.75 && insideUnits.length) {
      const { u, i } = insideUnits[Math.floor(rand() * insideUnits.length)];
      return { x: u.cx, y: u.top + u.roofH * 0.6, z: u.cz, roof: i };
    }
    const [x, y, z] = scenario.randomTownPoint(rand);
    return { x, y: y + 0.5, z };
  };
  const ruined = town.houses.filter((h) => h.inside && h.rebuilt > 0);
  const pickRuin = (rand) => {
    const h = ruined[Math.floor(rand() * ruined.length)];
    return h ? [h.x, heightAt(h.x, h.z) + 5, h.z] : null;
  };

  const colliders = [...works.colliders, ...Object.values(walls.meshes)];
  const world = {
    root, terrain, water, walls, works, town, trees, ambient, extras, mats, heightField: hf,
    heightAt, featureObjects, rings, colliders, structures, anatomy,
    insideTown, ring: geo.ring,
    fade: { materials: town.materials, hide: [town.suburbs, trees.group] },
    guns: fireGuns(works),
    pickTarget, pickRuin,
    labelAnchors: labelAnchors(featureObjects, rings),
    bounds: { x0: centre[0] - 2000, x1: centre[0] + 2000, z0: centre[1] - 2000, z1: centre[1] + 2000, minY: 6 },
    scenario,
    setNight(v) {
      town.setNight(v);
      ambient.setNight(v);
    },
  };
  engine.bounds = world.bounds;
  engine.setShadowCentre(anchors.townCentre[0], anchors.townCentre[1]);
  return world;
}

/** Label position for each place: above the top of its model (or its ring). */
function labelAnchors(featureObjects, rings) {
  const out = {};
  const box = new THREE.Box3();
  for (const [id, objs] of Object.entries(featureObjects)) {
    box.makeEmpty();
    for (const o of objs) {
      o.updateWorldMatrix(true, true);
      box.expandByObject(o);
    }
    if (box.isEmpty()) continue;
    const c = box.getCenter(new THREE.Vector3());
    // long walls: put the label on the model near its middle, not in the empty bbox centre
    out[id] = [c.x, box.max.y + 6, c.z];
  }
  for (const [id, r] of Object.entries(rings)) {
    out[id] = [r.position.x, 110, r.position.z];
  }
  // walls and the Stradun are long and bent: anchor them on the named places they run past
  const at = (a, y) => [a[0], heightAt(a[0], a[1]) + y, a[1]];
  out.landwalls = at(anchors.vid, 34);
  out.seawalls = at(anchors.margarita, 28);
  out.outerwall = at(geo.outer.bastions[1], 22);
  out.stradun = at(anchors.stradunMid ? [(anchors.stradunWest[0] + anchors.stradunEast[0]) / 2, (anchors.stradunWest[1] + anchors.stradunEast[1]) / 2] : anchors.stradunEast, 26);
  out.oldport = at(anchors.oldPort, 22);
  return out;
}
