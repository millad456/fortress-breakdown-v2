// Plot geo.json (top-down, north up) to shots/plot-geo.png for visual checks.
//   node scripts/plot-geo.mjs [x0,z0,x1,z1] [out.png]
import { readFileSync } from 'node:fs';
import { decodeRing } from '../src/core/geo.js';
import { svgToPng } from './lib/svg2png.mjs';

const g = JSON.parse(readFileSync('src/fortresses/dubrovnik/geo.json', 'utf8'));
const [x0, z0, x1, z1] = (process.argv[2] || '-200,-260,620,380').split(',').map(Number);
const W = 1600, S = W / (x1 - x0), H = Math.round((z1 - z0) * S);
const XY = ([x, z]) => [(x - x0) * S, (z - z0) * S];
const P = (p) => XY(p).map((v) => v.toFixed(1)).join(',');
const poly = (r, fill, stroke = 'none', sw = 1) =>
  `<polygon points="${r.map(P).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line = (r, stroke, sw = 2, extra = '') =>
  `<polyline points="${r.map(P).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif">`;
s += '<rect width="100%" height="100%" fill="#bfdcef"/>';
s += poly(g.land, '#efe8d8') + poly(g.lokrum, '#efe8d8') + poly(g.kase, '#cbb');
s += g.islets.map((r) => poly(r, '#efe8d8')).join('');
for (const a of g.green) s += poly(decodeRing(a.r), a.k === 'scrub' ? '#c9d6a3' : '#a9c98f');
for (const a of g.beaches) s += poly(decodeRing(a.r), '#f3dc9b');
for (const b of g.buildings) s += poly(decodeRing(b.r), b.k === 'church' ? '#d9a' : b.i ? '#c98' : '#aaa', '#555', 0.3);
s += line(g.outer.west, '#06c', 2.5) + line(g.outer.minceta, '#06c', 2.5);
s += line(g.outer.north, '#06c', 2.5, 'stroke-dasharray="6 3"');
for (const [x, z, r] of g.outer.bastions) {
  const [px, pz] = XY([x, z]);
  s += `<circle cx="${px}" cy="${pz}" r="${r * S}" fill="none" stroke="#06c" stroke-width="2"/>`;
}
for (const r of Object.values(g.works)) s += poly(r, 'rgba(255,190,0,.55)', '#850', 1);
s += line(g.ring.concat([g.ring[0]]), '#d00', 2.5);
g.ring.forEach((p, i) => {
  if (i % 10) return;
  const [px, pz] = XY(p);
  s += `<circle cx="${px}" cy="${pz}" r="4" fill="${i === 0 ? '#0a0' : '#d00'}"/><text x="${px + 5}" y="${pz}" font-size="11">${i}</text>`;
});
for (const [k, i] of Object.entries(g.sides)) {
  const [px, pz] = XY(g.ring[i]);
  s += `<text x="${px + 6}" y="${pz + 14}" font-size="14" font-weight="bold" fill="#a00">${k} &gt;</text>`;
}
s += line(g.stradun, '#fff', 3);
for (const [k, p] of Object.entries(g.points)) {
  if (!p) continue;
  const [px, pz] = XY(p);
  s += `<circle cx="${px}" cy="${pz}" r="5" fill="#000"/><text x="${px}" y="${pz - 6}" font-size="12">${k}</text>`;
}
s += '</svg>';
await svgToPng(s, process.argv[3] || 'shots/plot-geo.png', W, H);
console.log('plot written');
