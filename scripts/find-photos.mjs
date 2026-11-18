// Dev tool: search Wikimedia Commons for candidate photos and print file, author and licence.
//   node scripts/find-photos.mjs "Minčeta tower" "Fort Bokar Dubrovnik" ...
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'fortress-viewer-build/1.0 (photo credits lookup)' };
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

for (const term of process.argv.slice(2)) {
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: `${term} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '8',
    prop: 'imageinfo', iiprop: 'extmetadata|size', origin: '*',
  });
  await new Promise((r) => setTimeout(r, 4000));
  const res = await fetch(`${API}?${q}`, { headers: UA });
  if (!res.ok || !/json/.test(res.headers.get("content-type") || "")) { console.log(`## ${term}: HTTP ${res.status}`); continue; }
  const j = await res.json();
  console.log(`\n## ${term}`);
  for (const p of Object.values(j.query?.pages || {})) {
    const ii = p.imageinfo?.[0];
    const m = ii?.extmetadata || {};
    console.log(`${p.title.replace(/^File:/, '')} | ${strip(m.Artist?.value).slice(0, 60)} | ${m.LicenseShortName?.value || '?'} | ${ii?.width}x${ii?.height}`);
  }
}
