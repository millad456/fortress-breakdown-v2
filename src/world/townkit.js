// Generic town kit: a timeline-aware material (construction year, earthquake ruins, roof hits,
// night windows) and helpers for minimum-area rectangles and per-building attributes.
import * as THREE from 'three';
import { facadeTexture, windowMaskTexture, tileTexture } from './kit.js';

/** Shared uniforms: changing uYear re-dates the whole town on the GPU. */
export function townUniforms() {
  return {
    uYear: { value: 2025 },
    uNight: { value: 0 },
    uRuinYear: { value: 1667.27 },
    uHitFrom: { value: 1991.75 },
    uHitTo: { value: 1996.0 },
    uWeathered: { value: 2015.0 },
  };
}

/**
 * MeshStandardMaterial patched with per-building attributes:
 *   aBuilt (year), aRuin (rebuild year after the earthquake, 0 = spared), aHit (1991 roof hit),
 *   aBase (collapse height: local for instanced meshes, world for merged), aDmg (live siege damage)
 */
export function townMaterial(U, { roof = false, facade = true, color = 0xffffff, vertexColors = false, roughness = 0.9 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, vertexColors });
  m.userData.townUniforms = U;
  m.userData.isRoof = roof;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.uniforms.uFacadeTex = { value: facadeTexture() };
    s.uniforms.uWinTex = { value: windowMaskTexture() };
    s.uniforms.uTileTex = { value: tileTexture() };
    s.uniforms.uIsRoof = { value: roof ? 1 : 0 };
    s.uniforms.uFacade = { value: facade ? 1 : 0 };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aBuilt; attribute float aRuin; attribute float aHit; attribute float aBase; attribute float aDmg;
        uniform float uYear, uIsRoof, uRuinYear, uHitFrom, uHitTo, uWeathered;
        varying float vRuin; varying float vHitDark; varying float vNewTile; varying float vDmg;
        varying vec3 vWp; varying vec3 vWn; varying float vBaseW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float built = step(aBuilt, uYear);
        float ruined = step(0.5, aRuin) * step(uRuinYear, uYear) * (1.0 - step(aRuin, uYear)) * step(aBuilt, uRuinYear);
        float kH = built * mix(mix(1.0, 0.38, ruined), 1.0 - ruined, uIsRoof);
        transformed.y = aBase + (transformed.y - aBase) * kH;
        vRuin = ruined;
        vHitDark = uIsRoof * aHit * step(uHitFrom, uYear) * (1.0 - step(uHitTo, uYear));
        vNewTile = uIsRoof * aHit * step(uHitTo, uYear) * (1.0 - smoothstep(uHitTo, uWeathered, uYear));
        vDmg = aDmg;
        vec4 wp4 = vec4(transformed, 1.0);
        vec4 b4 = vec4(0.0, aBase, 0.0, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4; b4 = instanceMatrix * b4; wn = mat3(instanceMatrix) * wn;
        #endif
        wp4 = modelMatrix * wp4;
        vWp = wp4.xyz; vBaseW = (modelMatrix * b4).y; vWn = normalize(mat3(modelMatrix) * wn);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uFacadeTex, uWinTex, uTileTex; uniform float uIsRoof, uFacade, uNight;
        varying float vRuin; varying float vHitDark; varying float vNewTile; varying float vDmg;
        varying vec3 vWp; varying vec3 vWn; varying float vBaseW;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float vert = 1.0 - abs(vWn.y);
        vec2 tg = normalize(vec2(-vWn.z, vWn.x) + 1e-5);
        vec2 fuv = vec2(dot(vWp.xz, tg), vWp.y - vBaseW - 0.6) / 12.0;
        float winLit = 0.0;
        if (uFacade > 0.5 && uIsRoof < 0.5) {
          vec3 fac = texture2D(uFacadeTex, fuv).rgb;
          float above = step(0.06, fuv.y);
          diffuseColor.rgb *= mix(vec3(1.0), fac, vert * above);
          winLit = texture2D(uWinTex, fuv).r * vert * above;
        }
        if (uIsRoof > 0.5) {
          float tl = texture2D(uTileTex, vWp.xz / 2.6 + vec2(vWp.y * 0.13)).r;
          diffuseColor.rgb *= 0.72 + 0.4 * tl;
        }
        diffuseColor.rgb *= mix(1.0, 0.22, vRuin);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.05, 0.045), clamp(max(vHitDark, vDmg), 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.46, 0.24), vNewTile * 0.85);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.4) * winLit * uNight * 1.6 * (1.0 - vRuin);`);
  };
  // separate program cache per variant
  m.customProgramCacheKey = () => `town-${roof ? 1 : 0}-${facade ? 1 : 0}-${vertexColors ? 1 : 0}`;
  return m;
}

/**
 * Depth material for shadows with the same collapse logic, so buildings that do not exist yet
 * (or have fallen) cast no shadow.
 */
export function townDepthMaterial(U, { roof = false } = {}) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.uniforms.uIsRoof = { value: roof ? 1 : 0 };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aBuilt; attribute float aRuin; attribute float aBase;
        uniform float uYear, uIsRoof, uRuinYear;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float built = step(aBuilt, uYear);
        float ruined = step(0.5, aRuin) * step(uRuinYear, uYear) * (1.0 - step(aRuin, uYear)) * step(aBuilt, uRuinYear);
        float kH = built * mix(mix(1.0, 0.38, ruined), 1.0 - ruined, uIsRoof);
        transformed.y = aBase + (transformed.y - aBase) * kH;`);
  };
  m.customProgramCacheKey = () => `town-depth-${roof ? 1 : 0}`;
  return m;
}

/** Fill per-vertex constant attributes on a (non-indexed) merged geometry piece. */
export function stampAttributes(g, a) {
  const n = g.getAttribute('position').count;
  for (const k of ['aBuilt', 'aRuin', 'aHit', 'aBase', 'aDmg']) {
    g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n).fill(a[k] ?? 0), 1));
  }
  if (a.color) {
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = a.color.r; c[i * 3 + 1] = a.color.g; c[i * 3 + 2] = a.color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}

/** Add per-instance attributes to an InstancedMesh's geometry. */
export function instanceAttributes(geom, rows) {
  const n = rows.length;
  for (const k of ['aBuilt', 'aRuin', 'aHit', 'aBase', 'aDmg']) {
    const arr = new Float32Array(Math.max(1, n));
    rows.forEach((r, i) => (arr[i] = r[k] ?? 0));
    geom.setAttribute(k, new THREE.InstancedBufferAttribute(arr, 1));
  }
  return geom;
}

/** Minimum-area bounding rectangle of a polygon (rotating calipers on the hull). */
export function minAreaRect(pts) {
  const hull = convexHull(pts);
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of hull) {
      const u = p[0] * ux + p[1] * uz, v = -p[0] * uz + p[1] * ux;
      if (u < u0) u0 = u; if (u > u1) u1 = u;
      if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      best = { area, ux, uz, len: u1 - u0, wid: v1 - v0, cx: cu * ux - cv * uz, cz: cu * uz + cv * ux };
    }
  }
  // make len the long side
  if (best && best.wid > best.len) {
    best = { ...best, len: best.wid, wid: best.len, ux: -best.uz, uz: best.ux };
  }
  return best;
}

function convexHull(points) {
  const p = points.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
