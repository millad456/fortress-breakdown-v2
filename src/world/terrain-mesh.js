// Generic terrain mesh: a grid that is dense at the centre and coarse at the edges,
// sampled from any heightAt(x, z) and coloured by colorAt(...).
import * as THREE from 'three';

/**
 * @param {object} o
 * @param {number} o.cx centre x  @param {number} o.cz centre z  @param {number} o.half half-size (m)
 * @param {number} o.n samples per side  @param {number} o.core fraction of linear spacing (0..1)
 * @param {(x:number,z:number)=>number} o.heightAt
 * @param {(x,z,h,ny,ctx)=>number[]} o.colorAt  @param {(x,z)=>object} [o.ctxAt]
 */
export function buildTerrain(o) {
  const { cx, cz, half, n, heightAt, colorAt, ctxAt } = o;
  const a = o.core ?? 0.12;
  const map = (u) => half * (a * u + (1 - a) * u * u * u); // u in [-1, 1]
  const xs = new Float64Array(n), zs = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1;
    xs[i] = cx + map(u);
    zs[i] = cz + map(u);
  }
  const pos = new Float32Array(n * n * 3);
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const h = heightAt(xs[i], zs[j]);
      heights[k] = h;
      pos[k * 3] = xs[i];
      pos[k * 3 + 1] = h;
      pos[k * 3 + 2] = zs[j];
    }
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let p = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const k = j * n + i;
      // counter-clockwise seen from above (+y) so faces point up
      idx[p++] = k; idx[p++] = k + n; idx[p++] = k + 1;
      idx[p++] = k + 1; idx[p++] = k + n; idx[p++] = k + n + 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const nrm = g.getAttribute('normal');
  for (let k = 0; k < nrm.count; k++) if (!(nrm.getX(k) ** 2 + nrm.getY(k) ** 2 + nrm.getZ(k) ** 2 > 1e-8)) nrm.setXYZ(k, 0, 1, 0);
  const col = new Float32Array(n * n * 3);
  for (let k = 0; k < n * n; k++) {
    const x = pos[k * 3], z = pos[k * 3 + 2], h = heights[k];
    const c = colorAt(x, z, h, nrm.getY(k), ctxAt ? ctxAt(x, z, h) : {});
    col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  // a little per-pixel grain so large faces do not look flat
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWp;
        float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(th(i), th(i+vec2(1,0)), f.x), mix(th(i+vec2(0,1)), th(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float gr = tn(vWp.xz * 0.9) * 0.6 + tn(vWp.xz * 0.17) * 0.4;
        diffuseColor.rgb *= 0.86 + 0.24 * gr;`);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return { mesh, xs, zs, heights, n };
}
