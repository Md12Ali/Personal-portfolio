/**
 * Night Stack: one persistent 3D world behind the page.
 *
 * World bible
 *  - Place: a dark sea of light-dots under an indigo, star-filled sky.
 *  - Core: a liquid-chrome sculpture floating inside a halo ring. Its reflections come
 *    from an authored night studio (violet key, cyan strips, lime kicker) baked into a
 *    PMREM environment, so the metal mirrors the world's own palette.
 *  - Landmarks: four floating glass layers (front / server / data / growth), five project
 *    pillars (lime caps = live, violet = in progress), and a light path into the distance.
 *  - Motion: each page section owns one authored camera view. The view's landmark is
 *    framed on the side opposite the copy with a lens shift, so the layout's left/right
 *    rhythm is kept. Pointer adds clamped parallax and pushes a bulge into the chrome.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, LineSegments, BufferGeometry,
  BufferAttribute, PlaneGeometry, SphereGeometry, IcosahedronGeometry, TorusGeometry, BoxGeometry,
  EdgesGeometry, TubeGeometry, CatmullRomCurve3, ShaderMaterial, MeshBasicMaterial, LineBasicMaterial,
  MeshPhysicalMaterial, PMREMGenerator, AdditiveBlending, BackSide, DoubleSide, Color, Vector2, Vector3,
  MathUtils, LinearSRGBColorSpace, NoToneMapping, Quaternion,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const C = {
  night: new Color('#05040c'),
  horizon: new Color('#2a1760'),
  cyan: new Color('#36d6ff'),
  violet: new Color('#8b6bff'),
  lime: new Color('#d4ff3a'),
  slab: new Color('#0b0920'),
};

const CORE = new Vector3(0, 4.6, -10);
const LAYERS = new Vector3(18, 0, -12);
const MONO = new Vector3(-40, 0, -26);
const PATH_FOCUS = new Vector3(-8, 0.8, -46);

/* Scene ledger, keyed by the page's data-scene names.
   pos / look: camera position and the point it frames (the landmark).
   sx: where the landmark sits horizontally (-1 left edge … 1 right edge), opposite the copy.
   sy: vertical placement (positive = higher). m*: narrow-screen overrides. */
const CHAPTERS = {
  hero:      { pos: [0, 4.5, 1.2],    look: CORE.toArray(),        fov: 40, sx: 0.52,  sy: 0.0,   path: 0.6, mpos: [0, 5.0, 3.5],   mfov: 54, msy: 0.42 },
  statement: { pos: [8.2, 8.4, -1],   look: CORE.toArray(),        fov: 42, sx: -0.62, sy: 0.04,  path: 0.4, mpos: [5, 7.5, -2],    mfov: 56, msy: 0.45 },
  work:      { pos: [-32, 7, -3.5],   look: [-40, 3.8, -26.5],     fov: 44, sx: 0.7,   sy: 0.0,   path: 0.4, mpos: [-35, 7, -6],    mfov: 58, msy: 0.4 },
  repos:     { pos: [0, 8, -17],      look: [-2, 6.5, -60],        fov: 50, sx: 0.0,   sy: 0.0,   path: 0.6, mpos: [0, 8, -17],     mfov: 62, msy: 0.2 },
  services:  { pos: [11, 4.6, -24],   look: CORE.toArray(),        fov: 40, sx: -0.6,  sy: 0.0,   path: 0.3, mpos: [9, 5.5, -25],   mfov: 54, msy: 0.4 },
  stack:     { pos: [10, 6, -1.5],    look: [18, 3.8, -12],        fov: 44, sx: 0.58,  sy: 0.0,   path: 0.3, mpos: [11, 7.5, 2],    mfov: 56, msy: 0.4 },
  process:   { pos: [-1.5, 2.8, -31], look: PATH_FOCUS.toArray(),  fov: 48, sx: -0.55, sy: -0.05, path: 1.0, mpos: [-2, 3.6, -30],  mfov: 60, msy: 0.35 },
  contact:   { pos: [0, 10, -0.5],    look: CORE.toArray(),        fov: 42, sx: 0.0,   sy: -0.7,  path: 0.0, mpos: [0, 13, 4],      mfov: 52, msy: -0.66 },
};
const ORDER = Object.keys(CHAPTERS);

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

const SKY = {
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 uNight; uniform vec3 uHorizon; uniform vec3 uViolet; uniform vec3 uCyan; uniform float uTime;
    varying vec3 vDir;
    void main(){
      float h = vDir.y;
      vec3 col = mix(uHorizon, uNight, smoothstep(-0.02, 0.45, h));
      // soft violet glow band on the horizon, brighter behind the core
      float band = exp(-abs(h - 0.02) * 18.0);
      float focus = pow(max(0.0, dot(normalize(vDir.xz), vec2(0.0, -1.0))), 6.0);
      col += uViolet * band * (0.25 + 0.55 * focus);
      col += uCyan * exp(-abs(h - 0.0) * 60.0) * 0.12;
      col = mix(col, uNight * 0.6, smoothstep(0.0, -0.3, h));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const STARS = {
  vertexShader: `
    attribute float aSize; attribute float aSeed; uniform float uTime; uniform float uPR; varying float vA;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0);
      vA = tw;
      gl_PointSize = aSize * uPR * (0.8 + tw * 0.6);
    }`,
  fragmentShader: `
    varying float vA;
    void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA;
      gl_FragColor = vec4(vec3(0.85, 0.86, 1.0) * a, a); }`,
};

const OCEAN = {
  vertexShader: `
    uniform float uTime; uniform float uPR; uniform vec3 uCore; uniform float uPulse;
    varying float vH; varying float vD; varying float vGlow;
    void main(){
      vec3 p = position;
      float t = uTime;
      float h = sin(p.x * 0.32 + t * 0.7) * 0.28 + sin(p.z * 0.24 + t * 0.55) * 0.34
              + sin((p.x + p.z) * 0.15 - t * 0.4) * 0.42;
      // ripple rings radiating from under the core
      float r = length(p.xz - uCore.xz);
      float ring = sin(r * 1.1 - t * 1.6) * exp(-r * 0.06) * 0.35;
      h += ring;
      p.y = h;
      vH = h;
      vGlow = exp(-r * 0.09) * (0.6 + 0.4 * uPulse);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vD = -mv.z;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uPR * (1.6 + (h + 1.0) * 0.9) * (16.0 / max(-mv.z, 1.0));
    }`,
  fragmentShader: `
    uniform vec3 uCyan; uniform vec3 uViolet; uniform vec3 uLime; uniform vec3 uFog;
    varying float vH; varying float vD; varying float vGlow;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = 1.0 - smoothstep(0.15, 0.5, d);
      vec3 c = mix(uViolet, uCyan, smoothstep(-0.6, 0.7, vH));
      c = mix(c, uLime, smoothstep(0.85, 1.25, vH) * 0.6);
      c *= 0.55 + vGlow * 1.6;
      float fog = exp(-vD * 0.045);
      gl_FragColor = vec4(c * a * fog, a * fog);
    }`,
};

const RING = {
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float uTime; uniform vec3 uCyan; uniform vec3 uViolet; uniform vec3 uLime; uniform float uWake;
    varying vec2 vUv;
    void main(){
      float a = vUv.x;
      vec3 col = mix(uViolet, uCyan, 0.5 + 0.5 * sin(a * 6.2832 + uTime * 0.6));
      float pulse = smoothstep(0.985, 1.0, fract(a - uTime * 0.12));
      col += uLime * pulse * 2.5;
      col *= 1.2 + uWake * 0.8;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const GLOW = {
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 uColor; uniform float uStrength; varying vec2 vUv;
    void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.6) * uStrength;
      gl_FragColor = vec4(uColor * a, a); }`,
};

const PATH = {
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float uTime; uniform float uShow; uniform vec3 uCyan; uniform vec3 uLime; varying vec2 vUv;
    void main(){
      float dash = smoothstep(0.55, 0.6, fract(vUv.x * 26.0 - uTime * 0.9));
      vec3 col = uCyan * (0.7 + 0.3 * dash) + uLime * dash * 0.9;
      float fade = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
      gl_FragColor = vec4(col * fade * uShow, fade * uShow);
    }`,
};

const DUST = {
  vertexShader: `
    attribute float aSeed; uniform float uTime; uniform float uPR; varying float vA;
    void main(){
      vec3 p = position;
      p.y = mod(p.y + uTime * (0.15 + aSeed * 0.25), 12.0);
      p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.4;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      vA = smoothstep(0.0, 2.0, p.y) * (1.0 - smoothstep(9.0, 12.0, p.y)) * exp(-(-mv.z) * 0.03);
      gl_PointSize = uPR * (1.0 + aSeed * 2.5) * (14.0 / max(-mv.z, 1.0));
    }`,
  fragmentShader: `
    uniform vec3 uColor; varying float vA;
    void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA;
      gl_FragColor = vec4(uColor * a, a); }`,
};


/* ---------------------------------------------------------------- helpers */
const sstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function glowSprite(color, size, strength) {
  const m = new ShaderMaterial({
    ...GLOW, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uColor: { value: color.clone() }, uStrength: { value: strength } },
  });
  const mesh = new Mesh(new PlaneGeometry(size, size), m);
  mesh.userData.billboard = true;
  return mesh;
}

/* The night studio the chrome reflects: violet key, cyan strips, lime kicker. */
function buildNightStudio(renderer) {
  const env = new Scene();
  env.add(new Mesh(new SphereGeometry(20, 32, 16), new MeshBasicMaterial({ color: 0x020108, side: BackSide })));
  const panel = (w, h, col, power, pos) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(col).multiplyScalar(power), side: DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(7, 4.2, '#8b6bff', 5.5, [-6, 4.5, 3.5]);    // violet key softbox
  panel(0.9, 9, '#36d6ff', 6.0, [7, 0.5, -1.5]);    // cyan strip, right rim
  panel(0.6, 7, '#36d6ff', 3.0, [-7.5, -0.5, -3]);  // cyan strip, left rim
  panel(10, 10, '#d9d6ff', 0.8, [0, 9, 0]);         // cool overhead fill
  panel(14, 14, '#2a1760', 1.2, [0, -8, 0]);        // indigo sea bounce
  panel(3, 0.35, '#d4ff3a', 7.0, [2.5, -1.5, 7]);   // thin lime kicker in front
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return rt;
}

/* ---------------------------------------------------------------- world */
export function createWorld(canvas, { mobile = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(C.night, 1);
  renderer.outputColorSpace = LinearSRGBColorSpace; // world shaders are authored in display space
  renderer.toneMapping = NoToneMapping;

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 200);
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const uTime = { value: 0 };
  const uWake = { value: 0 };
  const shared = { uCyan: { value: C.cyan }, uViolet: { value: C.violet }, uLime: { value: C.lime } };
  const envRT = buildNightStudio(renderer);
  /* sky */
  const sky = new Mesh(track(new SphereGeometry(120, 32, 16)), track(new ShaderMaterial({
    ...SKY, side: BackSide, depthWrite: false,
    uniforms: { uNight: { value: C.night }, uHorizon: { value: C.horizon }, uViolet: { value: C.violet }, uCyan: { value: C.cyan }, uTime },
  })));
  scene.add(sky);

  /* stars */
  {
    const n = mobile ? 1400 : 3000;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, y = Math.pow(Math.random(), 0.8) * 0.95 + 0.04;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 110, y * 110, Math.sin(th) * r * 110], i * 3);
      size[i] = Math.random() < 0.06 ? 3.2 : 1 + Math.random() * 1.4;
      seed[i] = Math.random();
    }
    const g = track(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const stars = new Points(g, track(new ShaderMaterial({ ...STARS, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime, uPR: { value: dpr } } })));
    stars.frustumCulled = false;
    scene.add(stars);
  }

  /* ocean of light */
  {
    const nx = mobile ? 150 : 240, nz = mobile ? 130 : 210;
    const pos = new Float32Array(nx * nz * 3);
    let k = 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      pos[k++] = (i / (nx - 1) - 0.5) * 80; pos[k++] = 0; pos[k++] = 22 - (j / (nz - 1)) * 92;
    }
    const g = track(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(pos, 3));
    const ocean = new Points(g, track(new ShaderMaterial({
      ...OCEAN, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uTime, uPR: { value: dpr }, uCore: { value: CORE }, uPulse: uWake, uFog: { value: C.night }, ...shared },
    })));
    ocean.frustumCulled = false;
    scene.add(ocean);
  }

  /* core + halo ring */
  const coreGroup = new Group();
  coreGroup.position.copy(CORE);
  scene.add(coreGroup);
  const sculptU = {
    uTime: { value: 0 }, uAmp: { value: 0.14 }, uFreq: { value: 0.8 },
    uPointer: { value: new Vector3(0, 0, 1) }, uBulge: { value: 0 },
    uRim: { value: 0.55 }, uRimColor: { value: C.cyan.clone() },
  };
  const chrome = track(new MeshPhysicalMaterial({
    color: 0xe4e2f0, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05,
    envMap: envRT.texture, envMapIntensity: 2.1, iridescence: 0.25, iridescenceIOR: 1.6,
  }));
  chrome.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sculptU);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; uniform float uFreq; uniform vec3 uPointer; uniform float uBulge;
        ${NOISE}
        vec3 sculpt(vec3 p){
          vec3 n = normalize(p);
          float t = uTime;
          float f = snoise(p * uFreq + vec3(0.0, t*0.16, t*0.08));
          f += 0.16 * snoise(p * uFreq * 1.9 - vec3(t*0.12));
          float b = uBulge * smoothstep(1.1, 0.0, distance(n, normalize(uPointer)));
          return p + n * (f * uAmp + b);
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 sn = normalize(position);
        vec3 tg = normalize(cross(sn, abs(sn.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0)));
        vec3 bt = normalize(cross(sn, tg));
        vec3 sd0 = sculpt(position);
        vec3 sd1 = sculpt(position + tg * 0.012);
        vec3 sd2 = sculpt(position + bt * 0.012);
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
        outgoingLight = pow(max(outgoingLight, vec3(0.0)), vec3(1.0 / 2.2)) * 0.92;
        #include <opaque_fragment>`);
  };
  const core = new Mesh(track(new IcosahedronGeometry(1.35, mobile ? 30 : 64)), chrome);
  coreGroup.add(core);
  const ringMat = track(new ShaderMaterial({ ...RING, uniforms: { uTime, uWake, ...shared } }));
  const ring = new Mesh(track(new TorusGeometry(2.3, 0.045, 16, 260)), ringMat);
  coreGroup.add(ring);
  const ring2 = new Mesh(track(new TorusGeometry(2.62, 0.014, 8, 260)), track(new MeshBasicMaterial({ color: C.violet, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false })));
  ring2.rotation.x = 0.25;
  coreGroup.add(ring2);
  const halo = glowSprite(C.violet, 9, 0.35); coreGroup.add(halo); track(halo.geometry); track(halo.material);
  const coreGlow = glowSprite(C.cyan, 5, 0.22); coreGroup.add(coreGlow); track(coreGlow.geometry); track(coreGlow.material);
  // reflection column on the sea under the core
  const column = glowSprite(C.cyan, 1, 0.35); track(column.geometry); track(column.material);
  column.userData.billboard = false;
  column.scale.set(2.2, 9, 1); column.position.set(CORE.x, 0.4, CORE.z); column.rotation.x = -Math.PI / 2;
  scene.add(column);

  /* stack layers: front / server / data / growth */
  const layers = new Group();
  layers.position.copy(LAYERS);
  scene.add(layers);
  const slabMat = track(new MeshBasicMaterial({ color: C.slab, transparent: true, opacity: 0.72, depthWrite: false }));
  const layerColors = [C.cyan, C.violet, C.cyan, C.lime];
  const layerGeo = track(new BoxGeometry(5.2, 0.16, 3.2));
  const layerEdges = track(new EdgesGeometry(layerGeo));
  const layerItems = layerColors.map((col, i) => {
    const g = new Group();
    g.position.y = 1.6 + i * 1.35;
    g.add(new Mesh(layerGeo, slabMat));
    const e = new LineSegments(layerEdges, track(new LineBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false })));
    g.add(e);
    const gl = glowSprite(col, 4.5, 0.18); track(gl.material); track(gl.geometry); g.add(gl);
    g.userData = { phase: i * 0.9 };
    layers.add(g);
    return g;
  });
  // vertical data beams joining the layers
  {
    const pts = [];
    [[-2.3, -1.3], [2.3, -1.3], [-2.3, 1.3], [2.3, 1.3]].forEach(([x, z]) => { pts.push(x, 1.6, z, x, 1.6 + 3 * 1.35, z); });
    const g = track(new BufferGeometry()); g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    layers.add(new LineSegments(g, track(new LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false }))));
  }

  /* project monoliths: 3 live (lime), 2 in progress (violet) */
  const monos = new Group();
  scene.add(monos);
  const monoDefs = [[-6, 5.2, true], [-3, 6.6, true], [0, 7.6, true], [3, 5.8, false], [6, 4.8, false]].map(([x, h, l]) => [MONO.x + x, h, l]);
  const monoItems = monoDefs.map(([x, h, live], i) => {
    const g = new Group();
    g.position.set(x, 0, MONO.z - Math.abs(x - MONO.x) * 0.25);
    const geo = track(new BoxGeometry(1.5, h, 0.6));
    const m = new Mesh(geo, slabMat); m.position.y = h / 2 + 0.6; g.add(m);
    const col = live ? C.lime : C.violet;
    const e = new LineSegments(track(new EdgesGeometry(geo)), track(new LineBasicMaterial({ color: live ? C.cyan : C.violet, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false })));
    e.position.copy(m.position); g.add(e);
    const cap = new Mesh(track(new BoxGeometry(1.5, 0.08, 0.6)), track(new MeshBasicMaterial({ color: col })));
    cap.position.y = h + 0.64; g.add(cap);
    const capGlow = glowSprite(col, 3.2, live ? 0.6 : 0.4); track(capGlow.geometry); track(capGlow.material);
    capGlow.position.y = h + 0.7; g.add(capGlow);
    g.userData = { baseY: 0, phase: i * 1.3 };
    monos.add(g);
    return g;
  });

  /* light path for the process */
  const curve = new CatmullRomCurve3([
    new Vector3(-3, 0.25, -30), new Vector3(-5.5, 0.25, -38), new Vector3(-8, 0.25, -46),
    new Vector3(-12, 0.25, -58), new Vector3(-15, 0.25, -70),
  ]);
  const pathMat = track(new ShaderMaterial({ ...PATH, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime, uShow: { value: 0.6 }, ...shared } }));
  scene.add(new Mesh(track(new TubeGeometry(curve, 240, 0.07, 8, false)), pathMat));
  const beacons = [0.18, 0.4, 0.62, 0.84].map((t, i) => {
    const b = glowSprite(i % 2 ? C.cyan : C.lime, 1.6, 0.9); track(b.geometry); track(b.material);
    b.position.copy(curve.getPointAt(t)).add(new Vector3(0, 0.35, 0));
    scene.add(b);
    return b;
  });

  /* rising dust */
  {
    const n = mobile ? 500 : 1200;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set([(Math.random() - 0.5) * 50, Math.random() * 12, 10 - Math.random() * 70], i * 3); seed[i] = Math.random(); }
    const g = track(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const dust = new Points(g, track(new ShaderMaterial({ ...DUST, transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uTime, uPR: { value: dpr }, uColor: { value: C.cyan } } })));
    dust.frustumCulled = false;
    scene.add(dust);
  }

  /* post */
  let composer = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.5, 0.5));
    composer.addPass(new OutputPass());
  }

  /* ---------------------------------------------------------------- state */
  let width = 0, height = 0, narrow = false;
  const cur = { pos: new Vector3(), look: new Vector3(), fov: 42, sx: 0, sy: 0, path: 0.6 };
  const tgt = { pos: new Vector3(), look: new Vector3(), fov: 42, sx: 0, sy: 0, path: 0.6 };
  const pointer = { tx: 0, ty: 0, x: 0, y: 0, active: 0 };
  let velocity = 0;
  let raf = 0, running = false, last = performance.now(), time = 0, intro = 0;
  const introFrom = new Vector3(0, 20, 30);
  const tmpA = new Vector3(), tmpP = new Vector3(), invQ = new Quaternion();

  function chapterView(name, out) {
    const c = CHAPTERS[name];
    out.pos.fromArray(narrow && c.mpos ? c.mpos : c.pos);
    out.look.fromArray(c.look);
    out.fov = narrow ? c.mfov : c.fov;
    out.sx = narrow ? 0 : c.sx;
    out.sy = narrow ? c.msy : c.sy;
    out.path = c.path;
    return out;
  }
  const vA = { pos: new Vector3(), look: new Vector3() }, vB = { pos: new Vector3(), look: new Vector3() };
  let section = 'hero', sectionProgress = 0;

  function applySection() {
    const i = Math.max(0, ORDER.indexOf(section));
    const j = Math.min(i + 1, ORDER.length - 1);
    const k = sstep(MathUtils.smoothstep(sectionProgress, 0.55, 1.0));
    chapterView(ORDER[i], vA); chapterView(ORDER[j], vB);
    tgt.pos.copy(vA.pos).lerp(vB.pos, k);
    tgt.look.copy(vA.look).lerp(vB.look, k);
    tgt.fov = MathUtils.lerp(vA.fov, vB.fov, k);
    tgt.sx = MathUtils.lerp(vA.sx, vB.sx, k);
    tgt.sy = MathUtils.lerp(vA.sy, vB.sy, k);
    tgt.path = MathUtils.lerp(vA.path, vB.path, k);
  }

  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    narrow = width < 860 || width / height < 0.9;
    renderer.setSize(width, height, false);
    if (composer) composer.setSize(width, height);
    camera.aspect = width / height;
    applySection();
  }

  function setSection(name, progress = 0) {
    if (!CHAPTERS[name]) return;
    section = name; sectionProgress = progress;
    applySection();
  }

  let first = true;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now; time += dt * (1 + Math.min(Math.abs(velocity), 2) * 0.4);
    uTime.value = time;
    intro = Math.min(1, intro + dt / 2.6);
    velocity *= 0.9;

    const ease = first ? 1 : 1 - Math.exp(-dt * 2.4);
    first = false;
    cur.pos.lerp(tgt.pos, ease);
    cur.look.lerp(tgt.look, ease);
    cur.fov += (tgt.fov - cur.fov) * ease;
    cur.sx += (tgt.sx - cur.sx) * ease;
    cur.sy += (tgt.sy - cur.sy) * ease;
    cur.path += (tgt.path - cur.path) * ease;
    pathMat.uniforms.uShow.value = cur.path;
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));

    // camera: authored view, intro fly-in, clamped pointer parallax
    const ie = 1 - Math.pow(1 - intro, 3);
    tmpP.copy(introFrom).lerp(cur.pos, ie);
    const par = narrow ? 0.2 : 0.5;
    tmpP.x += pointer.x * par; tmpP.y += pointer.y * par * 0.5;
    camera.position.copy(tmpP);
    camera.lookAt(cur.look);
    camera.fov = cur.fov;
    // lens shift: put the framed landmark at (sx, sy) instead of the centre
    camera.setViewOffset(width, height, -cur.sx * width / 2, cur.sy * height / 2, width, height);
    camera.updateProjectionMatrix();

    // chrome core
    const s = 0.3 + 0.7 * ie;
    coreGroup.position.y = CORE.y + Math.sin(time * 0.8) * 0.12;
    coreGroup.scale.setScalar(s);
    core.rotation.y = time * 0.12 + pointer.x * 0.35;
    core.rotation.x = Math.sin(time * 0.17) * 0.18 - pointer.y * 0.25;
    sculptU.uTime.value = time;
    sculptU.uAmp.value = 0.14 + Math.min(Math.abs(velocity) * 0.04, 0.12);
    sculptU.uBulge.value += ((pointer.active ? 0.16 : 0) - sculptU.uBulge.value) * (1 - Math.exp(-dt * 3));
    tmpA.set(pointer.x * 1.4, pointer.y, 1).normalize().applyQuaternion(invQ.copy(core.quaternion).invert());
    sculptU.uPointer.value.copy(tmpA);
    sculptU.uRimColor.value.copy(C.cyan).lerp(C.violet, 0.5 + 0.5 * Math.sin(time * 0.3));
    chrome.envMapRotation.y = time * 0.05 + pointer.x * 0.25;

    ring.rotation.z = time * 0.05;
    ring2.rotation.y = Math.sin(time * 0.3) * 0.25;
    ring2.rotation.z = -time * 0.08;
    layerItems.forEach((g, i) => { g.position.y = 1.6 + i * 1.35 + Math.sin(time * 0.7 + g.userData.phase) * 0.12; g.rotation.y = Math.sin(time * 0.25 + i) * 0.06; });
    monoItems.forEach((g) => { g.position.y = Math.sin(time * 0.5 + g.userData.phase) * 0.15; });
    beacons.forEach((b, i) => { b.material.uniforms.uStrength.value = (0.6 + 0.4 * Math.sin(time * 2 + i * 1.5)) * cur.path; });
    billboards.forEach((o) => o.quaternion.copy(camera.quaternion));

    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  function setPointer(x, y) { pointer.tx = x; pointer.ty = y; pointer.active = x !== 0 || y !== 0 ? 1 : 0; }
  function setVelocity(v) { velocity = MathUtils.clamp(v, -3, 3); }

  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('resize', resize);
  resize();
  const billboards = [];
  scene.traverse((o) => { if (o.userData.billboard) billboards.push(o); });
  renderer.compile(scene, camera);

  function renderOnce() { frame(performance.now()); cancelAnimationFrame(raf); }
  function dispose() {
    stop();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', resize);
    disposables.forEach((d) => d.dispose && d.dispose());
    envRT.dispose();
    if (composer) composer.dispose();
    renderer.dispose();
  }

  function snap() { first = true; intro = 1; }

  return { start, stop, setSection, setPointer, setVelocity, resize, renderOnce, dispose, snap, renderer };
}
