// Fetch the raw OpenStreetMap data for Dubrovnik once, offline.
// Output: cache/osm-dubrovnik.json (git-ignored). The site never calls Overpass.
import { writeFileSync, mkdirSync } from 'node:fs';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Old town (tight) and the wider area (coast, Lokrum, Srđ)
const TOWN = '42.636,18.098,42.650,18.120';
const WIDE = '42.615,18.060,42.675,18.150';

const query = `
[out:json][timeout:180];
(
  way["building"](${'42.632,18.088,42.652,18.130'});
  relation["building"](${'42.632,18.088,42.652,18.130'});
  way["historic"="citywalls"](${TOWN});
  way["barrier"~"^(city_wall|wall)$"](${TOWN});
  way["historic"~"^(castle|fort|tower|city_gate)$"](${WIDE});
  relation["historic"~"^(castle|fort|tower|city_gate)$"](${WIDE});
  node["historic"~"^(castle|fort|tower|city_gate)$"](${WIDE});
  way["man_made"~"^(tower)$"](${TOWN});
  way["natural"="coastline"](${WIDE});
  way["man_made"~"^(pier|breakwater|groyne)$"](${TOWN});
  way["natural"~"^(wood|scrub|beach|cliff|heath)$"](${WIDE});
  relation["natural"~"^(wood|scrub|beach)$"](${WIDE});
  way["landuse"~"^(forest|grass|meadow)$"](${WIDE});
  way["leisure"~"^(park|garden)$"](${WIDE});
  way["highway"](${TOWN});
  node["natural"="peak"](${WIDE});
  node["place"](${WIDE});
  node["man_made"~"^(cross|lighthouse)$"](${WIDE});
  way["amenity"="place_of_worship"](${TOWN});
);
out body;
>;
out skel qt;
`;

async function run() {
  for (const url of ENDPOINTS) {
    try {
      console.log('Querying', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'fortress-viewer-build/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      mkdirSync('cache', { recursive: true });
      writeFileSync('cache/osm-dubrovnik.json', JSON.stringify(json));
      console.log(`Saved ${json.elements.length} elements to cache/osm-dubrovnik.json`);
      return;
    } catch (e) {
      console.warn('  failed:', e.message);
    }
  }
  process.exit(1);
}
run();
