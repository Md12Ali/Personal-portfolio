/**
 * Liquid-glass world.
 * Centrepiece: an iridescent, chrome-like blob whose surface flows with
 * simplex noise (normals rebuilt in the vertex shader so lighting stays true).
 * Around it: floating glass shapes, two glowing orbit rings, a star field
 * and coloured lights. Scroll moves the camera's subject between framings,
 * pointer tilts everything, fast scrolling makes the liquid ripple harder.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Group, Mesh, Points, BufferGeometry, BufferAttribute,
  IcosahedronGeometry, TorusGeometry, TorusKnotGeometry, OctahedronGeometry, CapsuleGeometry, SphereGeometry,
  MeshPhysicalMaterial, MeshBasicMaterial, PointsMaterial, PointLight, AmbientLight, PMREMGenerator,
  MathUtils, Vector2, ACESFilmicToneMapping, SRGBColorSpace, Fog, AdditiveBlending,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BG = 0x07070b;

/* Ashima simplex noise (MIT) */
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 blobDisplace(vec3 p){
  float n = snoise(p * uFreq + vec3(uTime * 0.22));
  float n2 = snoise(p * uFreq * 2.3 - vec3(uTime * 0.16)) * 0.32;
  return p * (1.0 + uAmp * (n + n2));
}
`;

/* Per-section framing for the blob: [x, y, z, scale, ringsAlpha, hue] */
const WIDE = [
  [2.2, 0.15, 0, 1.0, 1.0, 0.0],
  [-2.4, 0.0, -0.5, 0.85, 0.6, 0.15],
  [2.8, -0.1, -1.0, 0.8, 0.4, 0.3],
  [-2.6, 0.2, -1.0, 0.85, 0.6, 0.45],
  [0.0, 0.0, -3.5, 1.15, 0.3, 0.6],
  [2.4, 0.0, -1.0, 0.9, 0.8, 0.75],
  [2.2, 0.1, 0, 1.05, 1.0, 0.9],
];
const NARROW = [
  [0.0, 1.25, -1.0, 0.78, 1.0, 0.0],
  [0.6, 0.9, -2.2, 0.7, 0.5, 0.15],
  [-0.4, 0.6, -2.6, 0.7, 0.4, 0.3],
  [0.4, 0.4, -2.6, 0.7, 0.5, 0.45],
  [0.0, 0.0, -3.6, 0.9, 0.3, 0.6],
  [0.0, 0.6, -2.6, 0.75, 0.6, 0.75],
  [0.0, 1.0, -1.2, 0.85, 1.0, 0.9],
];

/* Light palettes the scene drifts through as you scroll */
const PALETTE = [
  ['#7b5cff', '#d4ff3a', '#36d6ff'],
  ['#ff4fd8', '#7b5cff', '#36d6ff'],
  ['#36d6ff', '#d4ff3a', '#7b5cff'],
  ['#d4ff3a', '#36d6ff', '#ff4fd8'],
  ['#7b5cff', '#ff8a3d', '#36d6ff'],
  ['#ff4fd8', '#d4ff3a', '#7b5cff'],
  ['#7b5cff', '#d4ff3a', '#36d6ff'],
].map((p) => p.map((c) => new Color(c)));

export function createWorld(canvas, { mobile }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = new Color(BG);
  scene.fog = new Fog(BG, 9, 22);
  const camera = new PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0, 8);

  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  /* ---- lights ---- */
  scene.add(new AmbientLight(0xffffff, 0.15));
  const lights = [0, 1, 2].map(() => {
    const l = new PointLight(0xffffff, 40, 20, 1.6);
    scene.add(l);
    return l;
  });

  /* ---- blob ---- */
  const world = new Group();
  scene.add(world);
  const hero = new Group();
  world.add(hero);

  const uniforms = { uTime: { value: 0 }, uAmp: { value: 0.18 }, uFreq: { value: 0.9 } };
  const blobMat = new MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0.55, roughness: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 820],
    envMapIntensity: 1.25,
  });
  blobMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uAmp; uniform float uFreq;\n${NOISE}`)
      .replace('#include <beginnormal_vertex>', `
        vec3 n0 = normalize(position);
        vec3 tg = normalize(cross(n0, abs(n0.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
        vec3 bt = normalize(cross(n0, tg));
        vec3 dp0 = blobDisplace(position);
        vec3 dp1 = blobDisplace(position + tg * 0.012);
        vec3 dp2 = blobDisplace(position + bt * 0.012);
        vec3 objectNormal = normalize(cross(dp1 - dp0, dp2 - dp0));
      `)
      .replace('#include <begin_vertex>', 'vec3 transformed = dp0;');
  };
  const blob = new Mesh(new IcosahedronGeometry(1.35, mobile ? 28 : 56), blobMat);
  hero.add(blob);

  /* ---- orbit rings ---- */
  const ringMat = new MeshBasicMaterial({ color: 0xd4ff3a, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const ringMat2 = new MeshBasicMaterial({ color: 0x9a85ff, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false });
  const ring1 = new Mesh(new TorusGeometry(2.25, 0.008, 8, 220), ringMat);
  const ring2 = new Mesh(new TorusGeometry(2.6, 0.005, 8, 220), ringMat2);
  ring1.rotation.set(1.2, 0.2, 0);
  ring2.rotation.set(1.75, -0.5, 0.3);
  hero.add(ring1, ring2);
  // little moons riding the rings
  const moonGeo = new SphereGeometry(0.06, 16, 16);
  const moon1 = new Mesh(moonGeo, new MeshBasicMaterial({ color: 0xd4ff3a }));
  const moon2 = new Mesh(moonGeo, new MeshBasicMaterial({ color: 0xb8a8ff }));
  ring1.add(moon1); ring2.add(moon2);

  /* ---- floating glass shapes ---- */
  const glassMat = new MeshPhysicalMaterial(mobile ? {
    color: 0xffffff, metalness: 0.9, roughness: 0.12, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.5, envMapIntensity: 1.4,
  } : {
    color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.7, ior: 1.45,
    clearcoat: 1, iridescence: 0.7, iridescenceIOR: 1.4, envMapIntensity: 1.3,
  });
  const shapeDefs = [
    [new TorusGeometry(0.42, 0.16, 32, 80), [-4.2, 2.0, -2.5]],
    [new OctahedronGeometry(0.42, 0), [4.6, -2.2, -2.0]],
    [new TorusKnotGeometry(0.3, 0.1, 120, 16), [-3.4, -2.4, -1.5]],
    [new CapsuleGeometry(0.2, 0.55, 8, 24), [1.0, 2.8, -3.0]],
    [new IcosahedronGeometry(0.34, 0), [5.2, 2.4, -4.0]],
    [new SphereGeometry(0.26, 32, 32), [-1.2, -3.0, -3.0]],
  ];
  const floaters = shapeDefs.map(([geo, pos], i) => {
    const m = new Mesh(geo, glassMat);
    m.position.set(...pos);
    m.userData = { base: pos.slice(), phase: i * 1.7, speed: 0.4 + (i % 3) * 0.15, spin: [0.2 + i * 0.05, 0.3 - i * 0.03] };
    world.add(m);
    return m;
  });
  if (mobile) floaters.forEach((m, i) => { if (i > 3) m.visible = false; m.userData.base[0] *= 0.45; });

  /* ---- stars ---- */
  const starCount = mobile ? 900 : 2200;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 8 + Math.random() * 14, th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    starPos[i * 3 + 2] = r * Math.cos(ph) - 6;
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new BufferAttribute(starPos, 3));
  const stars = new Points(starGeo, new PointsMaterial({ color: 0xc9c4ff, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(stars);

  /* ---- post ---- */
  let composer = null, bloom = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.7, 0.72);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* ---- state ---- */
  let width = 0, height = 0, narrow = false;
  let morphTarget = 0, morph = 0;
  const pointer = { tx: 0, ty: 0, x: 0, y: 0, on: 0, s: 0 };
  let velocity = 0, wobble = 0;
  let raf = 0, running = false, last = performance.now(), time = 0;
  const introState = { value: 0 };
  const frame = new Array(6).fill(0);
  const tmpA = new Color(), tmpB = new Color();

  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    narrow = width < 860;
    renderer.setSize(width, height, false);
    if (composer) composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function framing(m) {
    const F = narrow ? NARROW : WIDE;
    const i = Math.min(Math.floor(m), F.length - 1), j = Math.min(i + 1, F.length - 1);
    const f = MathUtils.smootherstep(m - i, 0, 1);
    for (let k = 0; k < 6; k++) frame[k] = F[i][k] + (F[j][k] - F[i][k]) * f;
    // palette blend
    for (let l = 0; l < 3; l++) {
      tmpA.copy(PALETTE[i][l]); tmpB.copy(PALETTE[j][l]);
      lights[l].color.copy(tmpA.lerp(tmpB, f));
    }
    return frame;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; time += dt;

    morph += (morphTarget - morph) * Math.min(1, dt * 2.6);
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 5);
    pointer.s += (pointer.on - pointer.s) * Math.min(1, dt * 3);
    velocity *= 0.9;
    wobble += (Math.min(Math.abs(velocity), 2) - wobble) * Math.min(1, dt * 4);

    const f = framing(morph);
    const intro = introState.value;
    const ease = 1 - Math.pow(1 - intro, 3);

    hero.position.set(f[0], f[1] + Math.sin(time * 0.8) * 0.06, f[2]);
    hero.scale.setScalar(f[3] * (0.2 + 0.8 * ease));
    hero.rotation.y = time * 0.12 + pointer.x * 0.5 * pointer.s;
    hero.rotation.x = -pointer.y * 0.35 * pointer.s;

    blob.rotation.y = time * 0.05;
    uniforms.uTime.value = time;
    uniforms.uAmp.value = 0.16 + wobble * 0.12 + Math.sin(time * 0.5) * 0.02 + (1 - ease) * 0.4;
    uniforms.uFreq.value = 0.85 + morph * 0.05;

    ring1.rotation.z = time * 0.25;
    ring2.rotation.z = -time * 0.18;
    moon1.position.set(Math.cos(time * 0.9) * 2.25, Math.sin(time * 0.9) * 2.25, 0);
    moon2.position.set(Math.cos(-time * 0.6 + 2) * 2.6, Math.sin(-time * 0.6 + 2) * 2.6, 0);
    ringMat.opacity = 0.9 * f[4] * ease;
    ringMat2.opacity = 0.7 * f[4] * ease;

    floaters.forEach((m) => {
      const u = m.userData;
      m.position.x = u.base[0] + Math.sin(time * u.speed + u.phase) * 0.25 - pointer.x * 0.4 * pointer.s;
      m.position.y = u.base[1] + Math.cos(time * u.speed * 0.8 + u.phase) * 0.3 - morph * 0.5 - pointer.y * 0.3 * pointer.s;
      m.position.z = u.base[2];
      m.rotation.x += dt * u.spin[0];
      m.rotation.y += dt * u.spin[1];
      m.scale.setScalar(ease);
    });

    // lights orbit the blob
    const c = hero.position;
    lights[0].position.set(c.x + Math.cos(time * 0.5) * 3.2, c.y + 2.2, c.z + Math.sin(time * 0.5) * 3.2);
    lights[1].position.set(c.x + Math.cos(time * 0.4 + 2.1) * 3.4, c.y - 2.0, c.z + Math.sin(time * 0.4 + 2.1) * 3.4);
    lights[2].position.set(c.x + Math.cos(-time * 0.3 + 4.2) * 3.6, c.y + Math.sin(time * 0.7), c.z + 2.5);

    stars.rotation.y = time * 0.008 + pointer.x * 0.05;
    stars.position.y = morph * 0.6;

    camera.position.x = pointer.x * 0.25 * pointer.s;
    camera.position.y = pointer.y * 0.18 * pointer.s;
    camera.lookAt(0, 0, -2);

    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const onVis = () => (document.hidden ? stop() : start());
  const onBlur = () => { pointer.on = 0; };
  let lostHandler = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); lostHandler && lostHandler(); });

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', onBlur);

  return {
    start,
    setMorph(v) { morphTarget = MathUtils.clamp(v, 0, 6); },
    setVelocity(v) { velocity = v; },
    setPointer(x, y) { pointer.tx = x; pointer.ty = y; pointer.on = 1; },
    clearPointer() { pointer.on = 0; },
    intro: introState,
    onContextLost(fn) { lostHandler = fn; },
    dispose() {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      envTex.dispose(); pmrem.dispose();
      if (composer) composer.dispose();
      renderer.dispose();
    },
  };
}
