// Dev tool: plot raw OSM wall ways with their IDs over building footprints.
import { loadOsm } from './lib/osm.mjs';
import { svgToPng } from './lib/svg2png.mjs';
const { ways, pts } = loadOsm();
const [x0, z0, x1, z1] = (process.argv[2] || '-80,-220,560,320').split(',').map(Number);
const W = 1600, S = W / (x1 - x0), H = Math.round((z1 - z0) * S);
const P = ([x, z]) => `${((x - x0) * S).toFixed(1)},${((z - z0) * S).toFixed(1)}`;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif">`;
const colors = ['#e6194b','#3cb44b','#4363d8','#f58231','#911eb4','#46f0f0','#f032e6','#bcf60c','#008080','#9a6324','#800000','#000075'];
let ci = 0;
for (const w of ways.values()) {
  const t = w.tags || {};
  if (t.building) svg += `<polygon points="${pts(w).map(P).join(' ')}" fill="#ddd" stroke="#bbb" stroke-width="0.5"/>`;
  if (t.natural === 'coastline') svg += `<polyline points="${pts(w).map(P).join(' ')}" fill="none" stroke="#39c" stroke-width="2"/>`;
}
for (const w of ways.values()) {
  const t = w.tags || {};
  if (!(t.historic === 'citywalls' || t.barrier === 'city_wall')) continue;
  const p = pts(w), c = colors[ci++ % colors.length];
  svg += `<polyline points="${p.map(P).join(' ')}" fill="none" stroke="${c}" stroke-width="3" marker-end="url(#a)"/>`;
  const m = p[Math.floor(p.length / 2)];
  const [sx, sz] = P(m).split(',');
  svg += `<text x="${sx}" y="${sz}" font-size="11" fill="${c}" stroke="#fff" stroke-width="3" paint-order="stroke">${w.id}</text>`;
  const [ax, az] = P(p[0]).split(',');
  svg += `<circle cx="${ax}" cy="${az}" r="3" fill="${c}"/>`;
}
for (const w of ways.values()) {
  const t = w.tags || {};
  if (!t.name || !(t.historic || t.building === 'tower' || /^(Sv\.|Puncjela|Drezvenik|Bokar|Minčeta|Asimon|Revelin)/.test(t.name))) continue;
  const p = pts(w); if (!p.length) continue;
  const c = p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]);
  const [sx, sz] = P(c).split(',');
  svg += `<polygon points="${p.map(P).join(' ')}" fill="rgba(255,200,0,.35)" stroke="#a80" stroke-width="1"/>`;
  svg += `<text x="${sx}" y="${sz}" font-size="13" font-weight="bold" fill="#000">${t.name}</text>`;
}
svg += '</svg>';
await svgToPng(svg, process.argv[3] || 'shots/raw-walls.png', W, H);
console.log('ok', W, H);
