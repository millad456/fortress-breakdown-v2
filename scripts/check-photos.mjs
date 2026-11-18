// T7 check: every photo referenced in the content exists on Wikimedia Commons, and every place has photos.
import content from '../src/fortresses/dubrovnik/content.js';

const files = [];
let fail = 0;
for (const f of content.features) {
  if (!f.photos?.length) {
    console.log(`  FAIL ${f.id}: no photos`);
    fail++;
  }
  for (const p of f.photos || []) files.push({ id: f.id, ...p });
}
const unique = [...new Set(files.map((x) => x.file))];
const found = new Map();
for (let i = 0; i < unique.length; i += 45) {
  const batch = unique.slice(i, i + 45);
  const q = new URLSearchParams({ action: 'query', format: 'json', titles: batch.map((f) => 'File:' + f).join('|'), prop: 'imageinfo', iiprop: 'size|mime' });
  const res = await fetch('https://commons.wikimedia.org/w/api.php?' + q, { headers: { 'User-Agent': 'fortress-viewer-build/1.0 (photo check)' } });
  const j = await res.json();
  const norm = Object.fromEntries((j.query.normalized || []).map((n) => [n.to, n.from]));
  for (const p of Object.values(j.query.pages)) {
    const title = norm[p.title] || p.title;
    found.set(title.replace(/^File:/, ''), p.missing === undefined && !!p.imageinfo);
  }
}
for (const x of files) {
  const ok = found.get(x.file) ?? found.get(x.file.replace(/_/g, ' '));
  if (!ok) {
    console.log(`  FAIL ${x.id}: missing on Commons: ${x.file}`);
    fail++;
  }
}
console.log(`  ${files.length} photos across ${content.features.length} places checked`);
if (fail) {
  console.log(`${fail} photo check(s) failed`);
  process.exit(1);
}
console.log('photo checks passed');
