/**
 * The 3D studio behind the page.
 *
 * One persistent object: a liquid-chrome sculpture lit by an authored photo
 * studio (warm softbox, cool strip light, floor bounce) that is baked into a
 * PMREM environment map, so every reflection on the metal is physically based.
 * Scrolling morphs the sculpture and moves it through the layout; the pointer
 * pushes a soft bulge into the surface. Dust motes drift in the light.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Points, Group, Color, Vector2, Vector3,
  IcosahedronGeometry, SphereGeometry, PlaneGeometry, BufferGeometry, BufferAttribute,
  MeshPhysicalMaterial, MeshBasicMaterial, ShaderMaterial, PMREMGenerator,
  BackSide, DoubleSide, AdditiveBlending, ACESFilmicToneMapping, SRGBColorSpace, MathUtils,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ------------------------------------------------------------------ */
/* Poses: one per page section. x / y are fractions of the visible     */
/* half-width / half-height, so the layout adapts to any aspect ratio. */
/* ------------------------------------------------------------------ */
const EMBER = [1.0, 0.36, 0.12];
const POSES = {
  hero:      { x: 0.52,  y: 0.02,  s: 0.92, amp: 0.13, freq: 0.78, twist: 0.0, rim: 0.3,  glow: EMBER,            gi: 0.5,  spin: 0.0, dim: 1.0 },
  statement: { x: -0.64, y: 0.02,  s: 0.72, amp: 0.24, freq: 0.62, twist: 0.0, rim: 0.4,  glow: [1.0, 0.5, 0.26], gi: 0.38, spin: 1.1, dim: 0.9 },
  work:      { x: 0.76,  y: -0.04, s: 0.5,  amp: 0.07, freq: 1.0,  twist: 0.0, rim: 0.22, glow: [0.5, 0.6, 1.0],  gi: 0.3,  spin: 2.3, dim: 0.85 },
  repos:     { x: 0.0,   y: 0.0,   s: 0.8,  amp: 0.18, freq: 0.85, twist: 0.4, rim: 0.2,  glow: [0.6, 0.62, 0.8], gi: 0.22, spin: 3.0, dim: 0.5 },
  services:  { x: -0.64, y: -0.14, s: 0.62, amp: 0.12, freq: 0.9,  twist: 1.2, rim: 0.32, glow: [1.0, 0.45, 0.2], gi: 0.4,  spin: 3.9, dim: 0.9 },
  stack:     { x: 0.74,  y: 0.02,  s: 0.52, amp: 0.16, freq: 1.0,  twist: 0.0, rim: 0.3,  glow: [0.75, 0.7, 1.0], gi: 0.32, spin: 4.6, dim: 0.9 },
  process:   { x: -0.64, y: -0.04, s: 0.6,  amp: 0.1,  freq: 1.1,  twist: 0.6, rim: 0.28, glow: [0.55, 0.65, 1.0], gi: 0.3, spin: 5.4, dim: 0.9 },
  contact:   { x: 0.0,   y: -0.74, s: 1.35, amp: 0.2,  freq: 0.7,  twist: 0.0, rim: 0.6,  glow: EMBER,            gi: 0.7,  spin: 6.3, dim: 0.85 },
};
const KEYS = ['x', 'y', 's', 'amp', 'freq', 'twist', 'rim', 'gi', 'spin', 'dim'];

/* Ashima simplex noise (MIT) */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
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
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/* Build the photo studio that the chrome reflects. */
function buildStudioEnvironment(renderer) {
  const env = new Scene();
  const room = new Mesh(new SphereGeometry(20, 32, 16), new MeshBasicMaterial({ color: 0x030304, side: BackSide }));
  env.add(room);
  const panel = (w, h, rgb, power, pos) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(rgb[0] * power, rgb[1] * power, rgb[2] * power), side: DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0); // face the centre
    env.add(m);
    return m;
  };
  panel(7, 4.2, [1.0, 0.62, 0.38], 7.0, [-6, 4.5, 3.5]);   // warm key softbox
  panel(0.9, 9, [0.78, 0.86, 1.0], 6.0, [7, 0.5, -1.5]);   // cool strip, right rim
  panel(0.6, 7, [0.78, 0.86, 1.0], 3.5, [-7.5, -0.5, -3]); // cool strip, left rim
  panel(10, 10, [1.0, 1.0, 1.0], 0.9, [0, 9, 0]);           // overhead fill
  panel(14, 14, [1.0, 0.38, 0.14], 0.45, [0, -8, 0]);       // ember floor bounce
  panel(3, 0.35, [1.0, 0.4, 0.15], 9.0, [2.5, -1.5, 7]);    // thin ember kicker in front
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return rt;
}

export function createWorld(canvas, { mobile = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
  const maxDpr = mobile ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x0a0a0b, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 8.2);

  const envRT = buildStudioEnvironment(renderer);
  scene.environment = envRT.texture;

  /* ---------- cyclorama backdrop ---------- */
  const backdropUniforms = {
    uGlow: { value: new Color(...EMBER) },
    uGlowI: { value: POSES.hero.gi },
    uGlowDir: { value: new Vector3(0.35, -0.25, -1).normalize() },
  };
  const backdrop = new Mesh(
    new SphereGeometry(40, 48, 24),
    new ShaderMaterial({
      side: BackSide, depthWrite: false, uniforms: backdropUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uGlow; uniform float uGlowI; uniform vec3 uGlowDir; varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          vec3 base = mix(vec3(0.0045,0.0045,0.005), vec3(0.0012,0.0012,0.0014), smoothstep(-0.3, 0.7, d.y));
          float g = pow(max(dot(d, uGlowDir), 0.0), 9.0);
          vec3 col = base + uGlow * g * uGlowI * 0.07;
          col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(backdrop);

  /* ---------- the sculpture ---------- */
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: POSES.hero.amp },
    uFreq: { value: POSES.hero.freq },
    uTwist: { value: 0 },
    uPointer: { value: new Vector3(0, 0, 2) },
    uBulge: { value: 0 },
    uRim: { value: POSES.hero.rim },
    uRimColor: { value: new Color(...EMBER) },
  };
  const material = new MeshPhysicalMaterial({
    color: 0xd4d1cc, metalness: 1, roughness: 0.16,
    clearcoat: 1, clearcoatRoughness: 0.06,
    envMapIntensity: 1.1, iridescence: 0.12, iridescenceIOR: 1.6,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uTwist;
        uniform vec3 uPointer; uniform float uBulge;
        ${NOISE}
        vec3 sculpt(vec3 p){
          vec3 n = normalize(p);
          float a = uTwist * p.y;
          float c = cos(a), s = sin(a);
          vec3 q = vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
          vec3 qn = vec3(c*n.x - s*n.z, n.y, s*n.x + c*n.z);
          float t = uTime;
          float f = snoise(q * uFreq + vec3(0.0, t*0.16, t*0.08));
          f += 0.16 * snoise(q * uFreq * 1.9 - vec3(t*0.12));
          float b = uBulge * smoothstep(1.1, 0.0, distance(n, normalize(uPointer)));
          return q + qn * (f * uAmp + b);
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 sp = position;
        vec3 sn = normalize(position);
        vec3 tg = normalize(cross(sn, abs(sn.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0)));
        vec3 bt = normalize(cross(sn, tg));
        float eps = 0.012;
        vec3 sd0 = sculpt(sp);
        vec3 sd1 = sculpt(sp + tg * eps);
        vec3 sd2 = sculpt(sp + bt * eps);
        vec3 objectNormal = normalize(cross(sd1 - sd0, sd2 - sd0));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = sd0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uRim; uniform vec3 uRimColor;`)
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
        outgoingLight += uRimColor * fres * uRim;
        #include <opaque_fragment>`);
  };
  const detail = mobile ? 30 : 64;
  const sculpture = new Mesh(new IcosahedronGeometry(1.2, detail), material);
  const rig = new Group();
  rig.add(sculpture);
  scene.add(rig);

  /* ---------- dust in the light ---------- */
  const COUNT = mobile ? 650 : 1800;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = MathUtils.randFloatSpread(14);
    pos[i * 3 + 1] = MathUtils.randFloatSpread(8);
    pos[i * 3 + 2] = MathUtils.randFloat(-5, 4);
    seed[i] = Math.random();
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(pos, 3));
  dustGeo.setAttribute('aSeed', new BufferAttribute(seed, 1));
  const dustUniforms = { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uColor: { value: new Color(1.0, 0.72, 0.5) } };
  const dust = new Points(dustGeo, new ShaderMaterial({
    uniforms: dustUniforms, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPx; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(position.y + 4.0 + uTime * (0.04 + aSeed * 0.06), 8.0) - 4.0;
        p.x += sin(uTime * 0.2 + aSeed * 40.0) * 0.25;
        p.z += cos(uTime * 0.15 + aSeed * 23.0) * 0.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float near = smoothstep(0.0, 1.0, 1.0 - abs(-mv.z - 7.5) / 6.0);
        vA = (0.15 + 0.85 * fract(aSeed * 7.31)) * near * (0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + aSeed * 30.0));
        gl_PointSize = uPx * (1.2 + aSeed * 2.4) * (8.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * a * vA * 0.55, 1.0);
      }`,
  }));
  scene.add(dust);

  /* ---------- post ---------- */
  let composer = null;
  let bloom = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(1, 1), 0.22, 0.5, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* ---------- state ---------- */
  const order = Object.keys(POSES);
  const cur = { ...POSES.hero };
  const tgt = { ...POSES.hero };
  const glowCur = new Color(...EMBER);
  const glowTgt = new Color(...EMBER);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: 0 };
  let velocity = 0;
  let halfW = 1;
  let halfH = 1;
  let narrow = false;
  let raf = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer && composer.setSize(w, h);
    bloom && bloom.setSize(w, h);
    camera.aspect = w / h;
    narrow = camera.aspect < 0.8;
    camera.fov = narrow ? 40 : 30;
    camera.updateProjectionMatrix();
    halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfW = halfH * camera.aspect;
  }

  function setSection(name, progress = 0) {
    const i = order.indexOf(name);
    if (i < 0) return;
    const a = POSES[order[i]];
    const b = POSES[order[Math.min(i + 1, order.length - 1)]];
    const k = MathUtils.smoothstep(progress, 0.6, 1.0);
    for (const key of KEYS) tgt[key] = MathUtils.lerp(a[key], b[key], k);
    glowTgt.setRGB(...a.glow).lerp(new Color(...b.glow), k);
  }

  function setPointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; pointer.active = 1; }
  function setVelocity(v) { velocity = MathUtils.clamp(v, -3, 3); }

  const tmp = new Vector3();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    elapsed += dt * (1 + Math.abs(velocity) * 0.6);
    velocity *= 0.9;

    const ease = 1 - Math.exp(-dt * 2.6);
    for (const key of KEYS) cur[key] += (tgt[key] - cur[key]) * ease;
    glowCur.lerp(glowTgt, ease);
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 5));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 5));

    // layout: narrow screens keep the sculpture centred and higher up
    const px = narrow ? 0 : cur.x * halfW;
    const py = narrow ? cur.y * halfH + halfH * 0.36 : cur.y * halfH;
    const scale = cur.s * (narrow ? 0.78 : 1) * Math.min(1, halfW / 2.2 + 0.25);
    rig.position.set(px, py + Math.sin(elapsed * 0.6) * 0.06, 0);
    rig.scale.setScalar(scale);
    sculpture.rotation.y = elapsed * 0.12 + cur.spin + pointer.x * 0.35;
    sculpture.rotation.x = Math.sin(elapsed * 0.17) * 0.18 - pointer.y * 0.25;

    uniforms.uTime.value = elapsed;
    uniforms.uAmp.value = cur.amp + Math.min(Math.abs(velocity) * 0.04, 0.12);
    uniforms.uFreq.value = cur.freq;
    uniforms.uTwist.value = cur.twist;
    uniforms.uRim.value = cur.rim;
    uniforms.uRimColor.value.copy(glowCur);
    uniforms.uBulge.value += ((pointer.active ? 0.16 : 0) - uniforms.uBulge.value) * ease;
    // pointer direction in the sculpture's local space
    tmp.set(pointer.x * 1.4, pointer.y * 1.0, 1.0).normalize();
    tmp.applyQuaternion(sculpture.quaternion.clone().invert());
    uniforms.uPointer.value.copy(tmp);

    material.envMapIntensity = 1.1 * cur.dim;
    material.envMapRotation.y = cur.spin * 0.35 + pointer.x * 0.25;
    backdropUniforms.uGlow.value.copy(glowCur);
    backdropUniforms.uGlowI.value = cur.gi;
    backdropUniforms.uGlowDir.value.set(px * 0.12 + 0.05, py * 0.12 - 0.2, -1).normalize();
    dustUniforms.uTime.value = elapsed;

    camera.position.x = pointer.x * 0.18;
    camera.position.y = pointer.y * 0.12;
    camera.lookAt(0, 0, 0);

    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();

  // compile shaders up front so the first visible frame is not a hitch
  renderer.compile(scene, camera);

  function renderOnce() { frame(performance.now()); cancelAnimationFrame(raf); }

  function dispose() {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    envRT.dispose();
    composer && composer.dispose();
    renderer.dispose();
  }

  return { start, stop, setSection, setPointer, setVelocity, resize, renderOnce, dispose, renderer };
}
