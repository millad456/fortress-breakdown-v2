// Generic water: a large plane with a custom shader and a baked depth texture
// (shallow tint, fresnel sky reflection, sun glitter, shore foam, fog).
import * as THREE from 'three';

export function buildWater(engine, { heightAt, bounds, size = 16000, res = 384 }) {
  const [x0, z0, x1, z1] = bounds;
  const data = new Uint8Array(res * res);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = x0 + ((i + 0.5) / res) * (x1 - x0);
      const z = z0 + ((j + 0.5) / res) * (z1 - z0);
      const h = heightAt(x, z);
      data[j * res + i] = Math.max(0, Math.min(255, Math.round((-h / 40) * 255)));
    }
  }
  const depthTex = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.UnsignedByteType);
  depthTex.magFilter = THREE.LinearFilter;
  depthTex.minFilter = THREE.LinearFilter;
  depthTex.wrapS = depthTex.wrapT = THREE.ClampToEdgeWrapping;
  depthTex.needsUpdate = true;

  const uniforms = {
    uDepth: { value: depthTex },
    uBounds: { value: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uSky: { value: new THREE.Color(0x5d8fc4) },
    uHorizon: { value: new THREE.Color(0xc4d6e6) },
    uDeep: { value: new THREE.Color(0x0b3a52) },
    uShallow: { value: new THREE.Color(0x2aa0a8) },
    uNight: { value: 0 },
    uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 900 },
    uFogFar: { value: 6500 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform sampler2D uDepth; uniform vec4 uBounds; uniform float uTime, uNight, uFogNear, uFogFar;
      uniform vec3 uSunDir, uSunColor, uSky, uHorizon, uDeep, uShallow, uFogColor, uTint;
      varying vec3 vW;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
      float waves(vec2 p){
        float t = uTime;
        float h = 0.0;
        h += sin(dot(p, vec2(0.031, 0.022)) + t * 0.9) * 0.5;
        h += sin(dot(p, vec2(-0.027, 0.041)) + t * 1.2) * 0.35;
        h += sin(dot(p, vec2(0.09, -0.06)) + t * 2.1) * 0.12;
        h += vn(p * 0.35 + vec2(t * 0.4, t * 0.25)) * 0.35;
        h += vn(p * 1.3 - vec2(t * 0.7, -t * 0.5)) * 0.12;
        return h;
      }
      void main(){
        vec2 uv = (vW.xz - uBounds.xy) / uBounds.zw;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float depth = mix(40.0, texture2D(uDepth, clamp(uv, 0.0, 1.0)).r * 40.0, inside);
        vec3 V = normalize(cameraPosition - vW);
        float dist = length(cameraPosition - vW);
        float e = 0.6;
        float h0 = waves(vW.xz);
        vec3 N = normalize(vec3(h0 - waves(vW.xz + vec2(e, 0.0)), e * 2.2, h0 - waves(vW.xz + vec2(0.0, e))));
        N = normalize(mix(N, vec3(0,1,0), smoothstep(400.0, 3000.0, dist)));
        float shallow = exp(-depth / 3.2);
        vec3 base = mix(uDeep, uShallow, shallow) * uTint;
        vec3 R = reflect(-V, N);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 refl = mix(uHorizon, uSky, clamp(R.y * 1.6, 0.0, 1.0));
        vec3 col = mix(base, refl, fres * 0.85);
        float sunUp = smoothstep(-0.02, 0.08, uSunDir.y);
        float spec = pow(max(dot(R, uSunDir), 0.0), 380.0) * 6.0;
        float glit = step(0.86, vn(vW.xz * 2.4 + uTime * 1.7)) * pow(max(dot(R, uSunDir), 0.0), 40.0) * 1.6;
        col += uSunColor * (spec + glit) * sunUp;
        float foamBand = (1.0 - smoothstep(0.08, 0.9, depth)) * inside;
        float foamN = vn(vW.xz * 0.8 + vec2(uTime * 0.3, 0.0)) * 0.6 + 0.4 * sin(uTime * 1.6 + depth * 9.0 + vn(vW.xz * 0.2) * 6.0);
        col = mix(col, vec3(0.92, 0.95, 0.96) * (1.0 - uNight * 0.75), clamp(foamBand * (0.35 + 0.65 * foamN), 0.0, 1.0) * 0.8);
        col *= 1.0 - uNight * 0.55;
        float alpha = mix(0.97, 0.55, shallow) ;
        alpha = max(alpha, foamBand * 0.85);
        float f = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogColor, f);
        gl_FragColor = vec4(col, mix(alpha, 1.0, f));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geom = new THREE.PlaneGeometry(size, size, 1, 1);
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'water';
  mesh.renderOrder = 1;
  mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);

  engine.addUpdate((dt, t) => {
    uniforms.uTime.value = t;
  });
  engine.onTime((e) => {
    uniforms.uSunDir.value.copy(e.sunDir);
    uniforms.uSunColor.value.copy(e.sun.color);
    uniforms.uNight.value = e.night;
    uniforms.uFogColor.value.copy(e.fogColor);
    uniforms.uFogNear.value = e.scene.fog.near;
    uniforms.uFogFar.value = e.scene.fog.far;
    const dusk = 1 - Math.min(1, Math.max(0, (e.sunDir.y - 0.02) / 0.3));
    uniforms.uSky.value.set(0x5d8fc4).lerp(new THREE.Color(0xd08a6a), dusk * 0.5).lerp(new THREE.Color(0x0a1020), e.night);
    uniforms.uHorizon.value.set(0xc4d6e6).lerp(new THREE.Color(0xf0b890), dusk * 0.7).lerp(new THREE.Color(0x141c30), e.night);
  });
  return { mesh, uniforms };
}
