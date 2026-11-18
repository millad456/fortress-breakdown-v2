// Dev tool: compose screenshots matching a pattern into one contact sheet.
//   node scripts/contact.mjs "^place-" shots/contact-places.png [cols]
import { readdirSync, readFileSync } from 'node:fs';
import { launch } from './lib/browser.mjs';

const re = new RegExp(process.argv[2] || '.');
const out = process.argv[3] || 'shots/contact.png';
const cols = +(process.argv[4] || 3);
const files = readdirSync('shots').filter((f) => f.endsWith('.png') && re.test(f) && !f.startsWith('contact')).sort();
const W = 1600, cw = Math.floor(W / cols), ch = Math.round((cw * 9) / 16);
const rows = Math.ceil(files.length / cols);
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${cw}px);font:12px sans-serif;color:#fff">
${files.map((f) => `<div style="position:relative;width:${cw}px;height:${ch}px"><img src="data:image/png;base64,${readFileSync('shots/' + f).toString('base64')}" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;left:4px;top:4px;background:#000a;padding:2px 5px">${f}</span></div>`).join('')}</body>`;
const b = await launch();
const p = await b.newPage({ viewport: { width: W, height: rows * ch } });
await p.setContent(html);
await p.screenshot({ path: out });
await b.close();
console.log(out, files.length);
