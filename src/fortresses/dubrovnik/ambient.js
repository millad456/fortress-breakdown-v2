// Ambient life: gulls, moored and cruising boats, clouds, Libertas flags on the forts,
// floodlit walls and lamps along the walls and the Stradun at night.
import * as THREE from 'three';
import { anchors, geo } from './layout.js';
import { heightAt, coastDist } from './terrain.js';
import { rng } from '../../core/noise.js';
import { shipGeometry } from '../../world/fx.js';

export function buildAmbient({ engine, mats, works, walls, extras }) {
  const group = new THREE.Group();
  group.name = 'ambient';
  const rand = rng(1358);
  const tc = anchors.townCentre;

  // ---------------------------------------------------------------- gulls
  const gullGeo = new THREE.BufferGeometry();
  gullGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1.2, 0.25, 0, 0, 0, 0.25, 0, 0, -0.2, 1.2, 0.25, 0, 0, 0, -0.2, 0, 0, 0.25], 3));
  gullGeo.computeVertexNormals();
  const NG = 36;
  const gulls = new THREE.InstancedMesh(gullGeo, new THREE.MeshBasicMaterial({ color: 0xf4f4f0, side: THREE.DoubleSide }), NG);
  gulls.frustumCulled = false;
  const gullData = Array.from({ length: NG }, () => ({
    cx: tc[0] + (rand() - 0.3) * 500, cz: tc[1] + (rand() - 0.2) * 400, r: 30 + rand() * 90, y: 30 + rand() * 60,
    w: (0.15 + rand() * 0.2) * (rand() < 0.5 ? -1 : 1), ph: rand() * 6.28,
  }));
  group.add(gulls);

  // ---------------------------------------------------------------- boats
  const boatGeo = shipGeometry('gunboat');
  boatGeo.scale(0.32, 0.32, 0.32);
  const skiffGeo = new THREE.BoxGeometry(2.2, 1, 7);
  skiffGeo.translate(0, 0.3, 0);
  const moorSpots = [];
  for (let i = 0; i < 400 && moorSpots.length < 18; i++) {
    const x = anchors.oldPort[0] + (rand() - 0.5) * 160, z = anchors.oldPort[1] + (rand() - 0.5) * 180;
    if (heightAt(x, z) > -1.5) continue;
    if (coastDist(x, z) > 14) continue;
    if (moorSpots.some(([a, b]) => Math.hypot(a - x, b - z) < 9)) continue;
    moorSpots.push([x, z, rand() * 6.28]);
  }
  const moored = new THREE.InstancedMesh(skiffGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), moorSpots.length || 1);
  const colors = [0xf2f2ee, 0x2f5d8a, 0xc0392b, 0xe8e2d0, 0x3a7d5c];
  moorSpots.forEach((_, i) => moored.setColorAt(i, new THREE.Color(colors[i % colors.length])));
  moored.count = moorSpots.length;
  moored.castShadow = true;
  group.add(moored);
  // cruising boats on loops in the channel between the town and Lokrum
  const NC = 5;
  const cruisers = new THREE.InstancedMesh(boatGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), NC);
  for (let i = 0; i < NC; i++) cruisers.setColorAt(i, new THREE.Color(i % 2 ? 0xffffff : 0xdfe6ee));
  cruisers.frustumCulled = false;
  cruisers.castShadow = true;
  const mid = [(tc[0] + anchors.lokrum[0]) / 2, (tc[1] + anchors.lokrum[1]) / 2];
  const cruiseData = Array.from({ length: NC }, (_, i) => ({ rx: 380 + i * 70, rz: 200 + i * 40, sp: 0.012 + rand() * 0.01, ph: rand() * 6.28, rot: 0.6 }));
  group.add(cruisers);
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const wakes = cruiseData.map(() => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(4, 26), wakeMat);
    w.rotation.x = -Math.PI / 2;
    group.add(w);
    return w;
  });

  // ---------------------------------------------------------------- clouds
  const cloudTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const g = x.createRadialGradient(30 + Math.random() * 68, 50 + Math.random() * 28, 2, 64, 64, 40 + Math.random() * 20);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m);
    const sc = 500 + rand() * 700;
    s.scale.set(sc, sc * 0.42, 1);
    s.position.set(tc[0] + (rand() - 0.5) * 6000, 700 + rand() * 500, tc[1] + (rand() - 0.5) * 6000);
    s.userData.v = 4 + rand() * 6;
    clouds.push(s);
    group.add(s);
  }

  // ---------------------------------------------------------------- Libertas flags
  const flagTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#f6f3ea';
    x.fillRect(0, 0, 256, 160);
    x.fillStyle = '#b3242a';
    x.font = 'bold 44px Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('LIBERTAS', 128, 82);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const flagUniforms = { uTime: { value: 0 } };
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 });
  flagMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = flagUniforms.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float k = (position.x + 2.6) / 5.2;
        transformed.z += sin(position.x * 1.6 - uTime * 5.0) * 0.45 * k;
        transformed.y -= k * k * 0.35;`);
  };
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b2f24 });
  for (const g of works.guns.filter((g) => g.kind === 'fort')) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 9, 6), poleMat);
    pole.position.set(g.x, g.y + 4.5 + 1.5, g.z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2, 10, 1), flagMat);
    flag.position.set(g.x + 2.6, g.y + 8.4, g.z);
    flag.castShadow = true;
    group.add(pole, flag);
  }
  // and on Orlando's Column
  {
    const [x, z] = anchors.orlando;
    const y = heightAt(x, z) + 9;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), poleMat);
    pole.position.set(x, y + 3.5, z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2, 10, 1), flagMat);
    flag.scale.setScalar(0.6);
    flag.position.set(x + 1.6, y + 6, z);
    group.add(pole, flag);
  }

  // ---------------------------------------------------------------- night lights
  const lampPos = [];
  const V = walls.verts;
  for (let i = 0; i < V.length; i += 2) {
    const v = V[i];
    // floodlights at the foot of the wall, outside
    lampPos.push(v.p[0] + v.n[0] * 3, Math.max(1, v.gFoot) + 1.5, v.p[1] + v.n[1] * 3);
  }
  for (const [x, y, z] of works.lights) lampPos.push(x, y + 2, z);
  for (let i = 0; i < extras.line.length; i += 4) {
    const [x, z] = extras.line[i];
    lampPos.push(x, heightAt(x, z) + 5, z);
  }
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3));
  const lampMat = new THREE.PointsMaterial({ color: 0xffc070, size: 9, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const lamps = new THREE.Points(lampGeo, lampMat);
  lamps.name = 'lamps';
  group.add(lamps);
  // floodlit stone: a warm emissive on the wall and fort materials at night
  const lit = [mats.stone, mats.fortStone, mats.outerStone, mats.bridgeStone];
  for (const m of lit) {
    m.emissive = new THREE.Color(0xffd29a);
    m.emissiveMap = m.map;
    m.emissiveIntensity = 0;
  }

  // ---------------------------------------------------------------- animate
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  engine.addUpdate((dt, t) => {
    flagUniforms.uTime.value = t;
    gullData.forEach((g, i) => {
      const a = g.ph + t * g.w;
      const x = g.cx + Math.cos(a) * g.r, z = g.cz + Math.sin(a) * g.r;
      e.set(Math.sin(t * 7 + i) * 0.25, -a + (g.w > 0 ? 0 : Math.PI), Math.sin(a) * 0.2);
      q.setFromEuler(e);
      const flap = 0.6 + 0.4 * Math.sin(t * 9 + i * 1.7);
      m4.compose(new THREE.Vector3(x, g.y + Math.sin(t * 0.7 + i) * 3, z), q, new THREE.Vector3(1.4, flap * 1.4, 1.4));
      gulls.setMatrixAt(i, m4);
    });
    gulls.instanceMatrix.needsUpdate = true;
    moorSpots.forEach(([x, z, r], i) => {
      e.set(Math.sin(t * 1.1 + i) * 0.04, r, Math.sin(t * 0.9 + i * 2) * 0.05);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, Math.sin(t * 1.3 + i) * 0.15, z), q, new THREE.Vector3(1, 1, 1));
      moored.setMatrixAt(i, m4);
    });
    moored.instanceMatrix.needsUpdate = true;
    cruiseData.forEach((c, i) => {
      const a = c.ph + t * c.sp;
      const lx = Math.cos(a) * c.rx, lz = Math.sin(a) * c.rz;
      const x = mid[0] + lx * Math.cos(c.rot) - lz * Math.sin(c.rot), z = mid[1] + lx * Math.sin(c.rot) + lz * Math.cos(c.rot);
      const a2 = a + 0.01;
      const lx2 = Math.cos(a2) * c.rx, lz2 = Math.sin(a2) * c.rz;
      const x2 = mid[0] + lx2 * Math.cos(c.rot) - lz2 * Math.sin(c.rot), z2 = mid[1] + lx2 * Math.sin(c.rot) + lz2 * Math.cos(c.rot);
      const head = Math.atan2(x2 - x, z2 - z);
      e.set(0, head, 0);
      q.setFromEuler(e);
      const onWater = heightAt(x, z) < -3;
      m4.compose(new THREE.Vector3(x, onWater ? 0.1 : -30, z), q, new THREE.Vector3(1, 1, 1));
      cruisers.setMatrixAt(i, m4);
      wakes[i].position.set(x - Math.sin(head) * 16, onWater ? 0.15 : -30, z - Math.cos(head) * 16);
      wakes[i].rotation.z = -head;
    });
    cruisers.instanceMatrix.needsUpdate = true;
    for (const c of clouds) {
      c.position.x += c.userData.v * dt;
      if (c.position.x > tc[0] + 3500) c.position.x = tc[0] - 3500;
    }
  });

  return {
    group,
    setNight(v) {
      lampMat.opacity = Math.min(1, v * 1.4);
      for (const m of lit) m.emissiveIntensity = v * 0.2;
      for (const c of clouds) c.material.opacity = 0.75 * (1 - v * 0.8);
      gulls.visible = v < 0.6;
    },
  };
}
void geo;
