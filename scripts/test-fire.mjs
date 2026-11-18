// T11 check: no fan triangle covers any point inside the walls; every bastion has a fan.
import * as THREE from 'three';
import { geo, sideOfIndex, insideTown } from '../src/fortresses/dubrovnik/layout.js';
import { heightAt } from '../src/fortresses/dubrovnik/terrain.js';
import { SIDES, fireGuns } from '../src/fortresses/dubrovnik/guns.js';
import { buildWallRing } from '../src/world/walls.js';
import { buildWorks } from '../src/fortresses/dubrovnik/works.js';
import { castFan, fanGeometry, triangleOverlapsRing, boxOf } from '../src/modes/fire.js';

const m = () => new THREE.MeshStandardMaterial();
const mats = new Proxy({}, { get: (t, k) => (t[k] ||= m()) });
const walls = buildWallRing({ ring: geo.ring, sideOf: sideOfIndex, sides: SIDES, heightAt, materials: mats, merlonMaterial: m() });
const works = buildWorks({ walls, mats });
const guns = fireGuns(works);
const ring = geo.ring, box = boxOf(ring);

let fail = 0, totalTris = 0;
const t0 = performance.now();
for (const gun of guns) {
  const rays = castFan({ ...gun, heightAt, inside: insideTown });
  const g = fanGeometry(gun, rays, { heightAt, ring, ringBox: box });
  const p = g.getAttribute('position').array;
  const n = p.length / 9;
  totalTris += n;
  let bad = 0;
  for (let i = 0; i < p.length; i += 9) {
    const t = [[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], [p[i + 6], p[i + 7], p[i + 8]]];
    if (triangleOverlapsRing(t, ring, box)) bad++;
    // and a dense sample of interior points against the town test used by the site
    for (let u = 0.05; u < 1; u += 0.15) for (let v = 0.05; u + v < 1; v += 0.15) {
      const x = t[0][0] * u + t[1][0] * v + t[2][0] * (1 - u - v), z = t[0][2] * u + t[1][2] * v + t[2][2] * (1 - u - v);
      if (insideTown(x, z)) bad++;
    }
  }
  if (bad) { fail++; console.log(`  FAIL ${gun.key} (${gun.kind}): ${bad} triangle samples inside the walls`); }
  if (n === 0) { fail++; console.log(`  FAIL ${gun.key} (${gun.kind}): no fan at all`); }
}
const byKind = guns.reduce((a, g) => ((a[g.kind] = (a[g.kind] || 0) + 1), a), {});
console.log(`  ${guns.length} gun positions ${JSON.stringify(byKind)}, ${totalTris} fan triangles, ${(performance.now() - t0).toFixed(0)} ms`);
if (fail) {
  console.log(`${fail} fire check(s) failed`);
  process.exit(1);
}
console.log('fire checks passed: no fan covers the town; every tower, fort and bastion has a fan');
