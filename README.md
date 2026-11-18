# Fortress Breakdown — the walls of Dubrovnik in 3D

An interactive 3D breakdown of the fortifications of Dubrovnik, in the browser: what each wall, tower and fort is, how they covered each other, how the town grew inside them, and how the city fared in its sieges.

- **Plan from survey data.** The wall line, every tower and fort, every building footprint, the coastline and the Kaše breakwater come from OpenStreetMap. Heights, terrain, textures and detail are modelled procedurally.
- **Five modes.** Explore, Anatomy (walls by thickness, with a cross-section), Fields of fire (computed, not drawn), Timeline (700 AD → today, with dioramas), and Sieges (full replays of 866–867, 1806 and 1991–92).
- **A guided tour** of 13 stops, a 10–12 s intro flight, and day/night from 05:00 to 23:00.

Built with [three.js](https://threejs.org) r170 and [Vite](https://vitejs.dev). Plain JavaScript ES modules, no UI framework; the only runtime dependency is `three`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173/#/dubrovnik
npm run build      # static site in dist/
npm run preview    # serve dist/ on http://localhost:4180
```

Add `?q=medium` to the hash URL (`#/dubrovnik?q=medium`) to force the lighter quality tier, or `?nointro` to skip the intro. Narrow screens and phones get the medium tier automatically.

**Keys:** `1`–`5` modes · `N` night · `L` list of places · `Esc` close · `←` `→` step the tour. Double-click the ground to fly there; click a wall or tower to open it.

## Checks

```bash
npm test               # geo.json checks (size, closed clockwise ring through all 16 named towers)
                       # + fields of fire: no fan covers the town, every tower/fort/bastion has a fan
npm run shots          # headless screenshots of every place, mode, year, diorama, replay and layout
                       # (needs `npm run dev` running; prints "Console issues: none" when clean)
node scripts/check-photos.mjs   # every photo exists on Wikimedia Commons
```

`scripts/shots.mjs` uses the system Chrome (`channel: 'chrome'`) with SwiftShader WebGL and falls back to Playwright's Chromium. Headless WebGL renders a few frames per second, so it sets camera poses directly and steps the siege simulation by hand rather than waiting for animations. It also measures the list, panel, dock and top bar at 1600×900, 1280×720 and 390×844 and fails on any overlap.

## Refresh the map data

The site never calls OpenStreetMap at runtime. The data is fetched once, offline, and committed as a compact JSON file:

```bash
npm run fetch-osm      # one Overpass query (with a fallback endpoint) → cache/osm-dubrovnik.json (git-ignored)
npm run build-geo      # derive src/fortresses/dubrovnik/geo.json (~100 kB)
npm run plot           # plot geo.json to shots/plot-geo.png to check the ring, towers and coast
node scripts/plot-raw.mjs   # plot the raw OSM wall ways with their IDs (to revise the stitch list)
```

The main wall is mapped in OSM as many overlapping `citywalls` ways running in both directions. `build-geo.mjs` stitches an **explicit ordered list** of way IDs (some reversed) into one closed, clockwise ring of the outer face, starting at the Pile Gate, joining each pair of ways where they come closest. The list was chosen by plotting the candidates; re-check the plot after any refresh.

## Structure

```
index.html, vite.config.js          static site, base './' for GitHub Pages
.github/workflows/deploy.yml        build + test + deploy to Pages on push to main
scripts/
  fetch-osm.mjs, build-geo.mjs      offline data pipeline (lib/osm.mjs: projection, simplification)
  plot-geo.mjs, plot-raw.mjs        data plots
  test-geo.mjs, test-fire.mjs       programmatic checks (npm test)
  shots.mjs, peek.mjs, contact.mjs  headless screenshots and contact sheets
  find-photos.mjs, check-photos.mjs Wikimedia Commons photo lookup and verification
src/
  main.js, landing.js, viewer.js    hash router, landing page, generic viewer + loading screen
  engine/Engine.js                  renderer, sky + sun, shadows, bloom, grain, fog, orbit controls,
                                    flyTo / flyPath, time of day, CSS2D labels, update registry
  core/                             geometry helpers (edge index, point-in-ring), noise — no three.js
  world/                            generic builders: terrain mesh, water shader, wall ring sweep,
                                    building kit, town shader, highlighting, labels, effects, height field
  modes/                            anatomy, fields of fire (computed), timeline, sieges + siege engine
  ui/                               top bar, list, panel, dock, toast, lightbox, intro, tour; styles
  fortresses/
    index.js                        registry (one live fortress, three "coming soon")
    dubrovnik/
      geo.json                      derived OSM data
      layout.js                     every anchor point, derived from geo.json in one place
      terrain.js                    heightAt / colorAt (indexed: 360k samples in ~0.3 s)
      works.js, town.js, extras.js  towers, forts, gates, port; houses; Stradun landmarks
      trees.js, ambient.js          trees; gulls, boats, clouds, flags, night lights
      guns.js, scenario.js          wall sides + gun positions; camera poses, intro path,
                                    anatomy classes, siege and diorama set-ups
      content.js                    15 places, timeline, 3 sieges, tour, sources
```

The engine, UI and modes know nothing about Dubrovnik. A second fortress is a new folder under `src/fortresses/` with its own `geo.json`, `layout.js`, `content.js` and a `build()` that returns the same world interface, plus an entry in `fortresses/index.js`.

## Decisions and modelling notes

- **Frame.** x = east, z = south, y = up, metres; origin just inside the Pile Gate (42.64145 N, 18.10650 E), equirectangular projection. Every coordinate in the code is in this frame.
- **Wall sizes.** The model extrudes the ring inward by land 5.5 m, west 4.5 m, harbour 3 m and sea 2.4 m; crest = ground outside + 20 m (land) / 14 m (sea), never lower than the lanes behind, smoothed. The real ranges (4–6 m and 1.5–3 m) are in the text.
- **Outer wall.** The western stretch with its semicircular bastions follows OSM; the northern stretch is not mapped and is synthesised 14–19 m outside the land front, with bastions spaced along it. The panel says so.
- **Terrain** is procedural: a Srđ ridge (412 m), the town levels (Stradun ~3.4 m, north side climbing ~27 m to Minčeta, the rocky south-west up to the sea walls), cliffs under the sea walls, a 37 m rock under Lovrijenac, a 4.5 m dry moat, Lokrum rising to ~96 m.
- **House dates are a modelled estimate**, shown as such in the timeline: the rocky south (old Laus) ~690–1130, the slope north of the Stradun ~1140–1350, named churches and monuments at their own dates, the town outside the walls from the 19th century outward. In 1667 about 70% of houses become blackened shells and are rebuilt one by one over 1669–1715; about 56% of roofs inside the walls are marked as hit in 1991, relaid in bright tile from 1996 and weathered back by 2015.
- **Fields of fire** are computed: for each gun position, rays every 3° out to its range, stopping at the first point inside the town ring or where the ground rises above `gunY + 6 + 0.22·distance`. Fan triangles that overlap the walled area are removed by an exact triangle–polygon test, and `npm test` checks it. Ranges: forts 280–420 m, circuit towers 150–170 m, outer-wall bastions 120 m.
- **The harbour chain** is drawn between St John's and the head of Kaše as an illustration of the closable harbour mouth; its exact historical line is not certain.
- **Gun and battery positions** in the siege replays (Srđ in 1806; the hills, Žarkovica and Bosanka, and gunboats in 1991) are representative, not surveyed.
- **Wikipedia links.** Several towers and gates have no English article of their own; those panels link to *Walls of Dubrovnik*.
- **Performance.** Repeated things are instanced (houses, roofs, merlons, trees, ships, boats); each work's static meshes are merged per material. About 300 draw calls and 2M triangles per frame at the overview (including the shadow pass), with a `medium` tier (smaller terrain grid, half the trees, smaller shadow map, no bloom) for phones. A NaN/Inf guard pass before bloom keeps degenerate pixels from smearing.
- **Accessibility.** Visible keyboard focus, glass panels with blur behind text, `prefers-reduced-motion` shortens the intro and replaces camera flights with cuts.

## Credits

- **Map data** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database Licence (ODbL). The derived `geo.json` is a Produced Work from that data.
- **Photographs** load live from [Wikimedia Commons](https://commons.wikimedia.org); each is credited with its author and licence under the image (CC BY, CC BY-SA or public domain). Photographers: Bernard Gagnon, Sumitsurai, Dennis G. Jarvis, Richard Mortel, Bahnfrend, Marcin Konsek, Bracodbk, Joanbanjo, Ramón from Llanera, LBM1948, Jerzy Strzelecki, Paavo01, RajashreeTalukdar, Diego Delso, Soska, Martin Falbisoner, László Szalai, Peter Denton, trolvag, Tlusťa, Lasta.
- **Sources** for the history are listed in the app and in `content.js` (`sources`): Wikipedia articles on the walls, Lovrijenac, the sieges, the 1667 earthquake, the Republic of Ragusa, the Lazarettos and quarantine; the UNESCO World Heritage listing; the Society of Friends of Dubrovnik Antiquities.

## Who built it

Written from a written specification by **Claude** (Anthropic's model *Claude Opus 5.5*, model id `claude-opus-5-5`), working in Claude Code, for the repository owner: the data pipeline, engine, models, content and checks. Libraries: three.js (MIT), Vite (MIT), Playwright (Apache-2.0, dev only).
