// Generic 3D engine: renderer, sky + sun, shadows, bloom + grain, fog, orbit controls,
// camera flights, time of day, CSS2D label layer and an update registry.
// Knows nothing about any particular fortress.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // arrive fast, settle slowly
  out: (t) => 1 - Math.pow(1 - t, 3),
  flight: (t) => (t < 0.35 ? 0.5 * Math.pow(t / 0.35, 2) * 0.7 : 0.35 + 0.65 * (1 - Math.pow(1 - (t - 0.35) / 0.65, 3))) / 1.0,
};

// Replaces NaN/Inf (degenerate normals, HDR overflow) before bloom can smear them into black blocks
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = clamp(c, 0.0, 60.0); }`,
};

const GrainShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.035 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float n = h(vUv * 1000.0) - 0.5;
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * 0.45;
      gl_FragColor = vec4((c.rgb + n * uAmount) * vig, c.a);
    }`,
};

export class Engine {
  constructor(container, opts = {}) {
    this.container = container;
    this.quality = opts.quality || 'high';
    this.updaters = new Set();
    this.timeListeners = new Set();
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.hour = 10;
    this.night = 0; // 0 day .. 1 full night

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: this.quality === 'high', powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === 'high' ? 2 : 1));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.6;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    r.domElement.classList.add('gl');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xb8c8d8, 900, 6500);
    this.camera = new THREE.PerspectiveCamera(46, 1, 1, 14000);
    this.camera.position.set(0, 400, 900);

    // label layer
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    // controls
    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.maxPolarAngle = Math.PI * 0.47;
    c.minDistance = 25;
    c.maxDistance = 3200;
    c.screenSpacePanning = false;
    c.zoomToCursor = true;
    this.bounds = opts.bounds || { x0: -3000, x1: 3000, z0: -3000, z1: 3000, minY: 6 };

    // sky + lights
    this.sky = new Sky();
    this.sky.scale.setScalar(12000);
    const su = this.sky.material.uniforms;
    su.turbidity.value = 4;
    su.rayleigh.value = 1.4;
    su.mieCoefficient.value = 0.004;
    su.mieDirectionalG.value = 0.82;
    this.scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sm = this.quality === 'high' ? 4096 : 1536;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -650; sc.right = 650; sc.top = 650; sc.bottom = -650; sc.near = 10; sc.far = 4000;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.shadowCentre = new THREE.Vector3(0, 0, 0);
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b5a45, 1.0);
    this.scene.add(this.hemi);
    this.sunDir = new THREE.Vector3(0, 1, 0);

    this.stars = this.makeStars();
    this.scene.add(this.stars);

    // post
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.92);
    if (this.quality === 'high') this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grain = new ShaderPass(GrainShader);
    this.composer.addPass(this.grain);

    this.flight = null;
    this.raycaster = new THREE.Raycaster();
    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    this.resize();
    this.setTime(this.hour);
    this.running = true;
    r.setAnimationLoop(() => this.frame());
  }

  setShadowCentre(x, z) {
    this.shadowCentre.set(x, 0, z);
  }

  makeStars() {
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.9 + 0.08;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 9000;
      pos[i * 3 + 1] = Math.cos(ph) * 9000;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 9000;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const p = new THREE.Points(g, m);
    p.renderOrder = -1;
    return p;
  }

  /** Time of day, 05:00 – 23:00. Drives sun, sky, fog, hemisphere and the night factor. */
  setTime(hour) {
    this.hour = hour = clamp(hour, 4.5, 23.5);
    // a summer day on the Adriatic: sunrise ~05:30, sunset ~20:00
    const dayT = (hour - 5.4) / (20.1 - 5.4);
    const elev = Math.sin(clamp(dayT, -0.2, 1.2) * Math.PI) * 64 - (dayT < 0 || dayT > 1 ? 6 : 0);
    const az = 70 + dayT * 220; // degrees from north, clockwise (east = 90)
    const e = THREE.MathUtils.degToRad(elev), a = THREE.MathUtils.degToRad(az);
    this.sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.night = 1 - smooth(-7, 4, elev);
    const golden = 1 - smooth(4, 22, elev);

    const sunCol = new THREE.Color().setHSL(0.09, 0.85, 0.62).lerp(new THREE.Color(0xfff6ea), smooth(5, 30, elev));
    this.sun.color.copy(sunCol);
    this.sun.intensity = 3.2 * smooth(-2, 12, elev);
    // at night, a cool moon from the south-east keeps the scene readable
    this.moon ||= (() => {
      const m = new THREE.DirectionalLight(0x8fa8d8, 0);
      m.position.set(600, 900, 700);
      this.scene.add(m);
      return m;
    })();
    this.moon.intensity = 0.55 * this.night;
    this.hemi.intensity = 0.3 + 1.35 * (1 - this.night);
    this.hemi.color.set(0xcfe3ff).lerp(new THREE.Color(0x4a5a80), this.night);
    this.hemi.groundColor.set(0x6b5a45).lerp(new THREE.Color(0x151520), this.night);

    const dayFog = new THREE.Color(0xbfd2e4), duskFog = new THREE.Color(0xe0a882), nightFog = new THREE.Color(0x0d1424);
    const fog = dayFog.clone().lerp(duskFog, golden * 0.7).lerp(nightFog, this.night);
    this.scene.fog.color.copy(fog);
    this.fogColor = fog;
    this.renderer.toneMappingExposure = 0.6 + 0.2 * this.night;
    this.stars.material.opacity = smooth(0.55, 1, this.night);
    for (const fn of this.timeListeners) fn(this);
  }

  onTime(fn) {
    this.timeListeners.add(fn);
    fn(this);
    return () => this.timeListeners.delete(fn);
  }

  addUpdate(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
  }

  /** Pose = { pos:[x,y,z], target:[x,y,z], fov? } */
  setPose(p) {
    this.flight = null;
    this.camera.position.set(...p.pos);
    this.controls.target.set(...p.target);
    if (p.fov) { this.camera.fov = p.fov; this.camera.updateProjectionMatrix(); }
    this.controls.update();
  }

  getPose() {
    const r = (v) => Math.round(v * 10) / 10;
    return { pos: this.camera.position.toArray().map(r), target: this.controls.target.toArray().map(r), fov: this.camera.fov };
  }

  /** Fly to a pose along an arc. Resolves when done (or when superseded). */
  flyTo(p, { duration = 2.2, arc = 0.25, onProgress, easing = ease.inOut } = {}) {
    const fromPos = this.camera.position.clone(), fromT = this.controls.target.clone(), fromFov = this.camera.fov;
    const toPos = new THREE.Vector3(...p.pos), toT = new THREE.Vector3(...p.target), toFov = p.fov || fromFov;
    const dist = fromPos.distanceTo(toPos);
    if (dist < 1 && fromT.distanceTo(toT) < 1) return Promise.resolve();
    const lift = arc * dist * 0.5;
    const mid = fromPos.clone().lerp(toPos, 0.5);
    mid.y = Math.max(fromPos.y, toPos.y) + lift;
    const curve = new THREE.QuadraticBezierCurve3(fromPos, mid, toPos);
    const dur = duration * (0.6 + Math.min(0.8, dist / 2500));
    return this._fly((t) => {
      const k = easing(t);
      this.camera.position.copy(curve.getPoint(k));
      this.controls.target.copy(fromT).lerp(toT, ease.inOut(Math.min(1, t * 1.15)));
      this.camera.fov = fromFov + (toFov - fromFov) * k;
    }, dur, onProgress);
  }

  /** Fly a path through several poses (Catmull-Rom). keys: [{pos, target, fov?}] */
  flyPath(keys, { duration = 10, onProgress, easing = (t) => t, timing } = {}) {
    const P = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
    const T = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.target)), false, 'centripetal');
    const fovs = keys.map((k) => k.fov || this.camera.fov);
    return this._fly((t) => {
      const k = timing ? timing(easing(t)) : easing(t);
      this.camera.position.copy(P.getPoint(k));
      this.controls.target.copy(T.getPoint(k));
      const f = k * (fovs.length - 1), i = Math.min(fovs.length - 2, Math.floor(f));
      this.camera.fov = fovs[i] + (fovs[i + 1] - fovs[i]) * (f - i);
    }, duration, onProgress);
  }

  _fly(apply, duration, onProgress) {
    if (this.flight) this.flight.resolve(false);
    return new Promise((resolve) => {
      this.flight = { apply, duration, t: 0, onProgress, resolve };
    });
  }

  cancelFlight() {
    if (this.flight) {
      this.flight.resolve(false);
      this.flight = null;
    }
  }

  finishFlight() {
    if (!this.flight) return;
    const f = this.flight;
    f.apply(1);
    f.onProgress?.(1);
    this.camera.updateProjectionMatrix();
    this.flight = null;
    f.resolve(true);
  }

  /** Raycast from client coordinates against a list of objects */
  pick(clientX, clientY, objects, recursive = true) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    return this.raycaster.intersectObjects(objects, recursive);
  }

  clampCamera() {
    const b = this.bounds, t = this.controls.target, p = this.camera.position;
    t.x = clamp(t.x, b.x0, b.x1);
    t.z = clamp(t.z, b.z0, b.z1);
    t.y = clamp(t.y, -5, 500);
    if (this.groundAt) {
      const g = Math.max(0, this.groundAt(p.x, p.z));
      if (p.y < g + b.minY) p.y = g + b.minY;
    }
  }

  frame() {
    if (!this.running) return;
    const dt = Math.min(0.1, this.clock.getDelta());
    this.elapsed += dt;
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.duration);
      f.apply(f.t);
      this.camera.updateProjectionMatrix();
      f.onProgress?.(f.t);
      if (f.t >= 1) {
        this.flight = null;
        f.resolve(true);
      }
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update();
      this.clampCamera();
    }
    // shadow camera follows the view target so detail stays sharp where you look
    const tgt = this.controls.target;
    const camDist = this.camera.position.distanceTo(tgt);
    const span = clamp(camDist * 0.75, 260, 900);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - span) > 20) {
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
      sc.updateProjectionMatrix();
    }
    const cx = Math.round(tgt.x / 20) * 20, cz = Math.round(tgt.z / 20) * 20;
    this.sun.target.position.set(cx, 0, cz);
    const d = this.sunDir.y > 0.02 ? this.sunDir : new THREE.Vector3(0.3, 0.4, 0.3).normalize();
    this.sun.position.set(cx + d.x * 1800, d.y * 1800, cz + d.z * 1800);
    this.stars.position.copy(this.camera.position);
    this.sky.position.copy(this.camera.position);

    for (const fn of this.updaters) fn(dt, this.elapsed);
    this.grain.uniforms.uTime.value = this.elapsed % 10;
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._resize);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    });
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
