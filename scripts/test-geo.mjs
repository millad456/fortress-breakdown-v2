// T3 checks: geo.json size; ring closed, clockwise and through all 16 named towers.
import { readFileSync, statSync } from 'node:fs';
import { signedArea, pointInRing, distToPolyline } from '../src/core/geo.js';

const file = 'src/fortresses/dubrovnik/geo.json';
const g = JSON.parse(readFileSync(file, 'utf8'));
let fail = 0;
const ok = (c, m) => {
  console.log((c ? '  ok   ' : '  FAIL ') + m);
  if (!c) fail++;
};
const kb = statSync(file).size / 1024;
ok(kb < 200, `geo.json is ${kb.toFixed(1)} kB (< 200)`);
ok(g.ring.length > 50, `ring has ${g.ring.length} points`);
const a = g.ring[0], b = g.ring[g.ring.length - 1];
ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 25, 'ring closes at Pile (last point near the first)');
ok(signedArea(g.ring) > 0, 'ring is clockwise on a north-up map');
const TOWERS = ['minceta', 'bokar', 'puncjela', 'barbara', 'lucija', 'vid', 'drezvenik', 'jakov', 'asimon',
  'luka', 'ivan', 'spasitelj', 'stjepan', 'margarita', 'petar', 'pile'];
for (const t of TOWERS) {
  const r = g.works[t];
  const hit = g.ring.some(([x, z]) => pointInRing(x, z, r)) || r.some(([x, z]) => distToPolyline(x, z, g.ring, true) < 3);
  ok(hit, `ring runs through ${t}`);
}
const s = g.sides;
ok(s.land < s.harbour && s.harbour < s.sea && s.sea < s.west, `sides in ring order ${JSON.stringify(s)}`);
const inside = g.buildings.filter((x) => x.i).length;
ok(inside > 300, `${inside} buildings inside the walls`);
ok(g.outer.bastions.length >= 6, `${g.outer.bastions.length} outer-wall bastions`);
if (fail) {
  console.log(`${fail} geo check(s) failed`);
  process.exit(1);
}
console.log('geo checks passed');
