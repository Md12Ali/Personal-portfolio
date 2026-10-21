/**
 * Alpine Day: one persistent natural 3D world behind the page.
 *
 * World bible
 *  - Place: a mountain valley at blue hour. A lake in the foreground is fed by a
 *    waterfall dropping off a rock step; above it a river winds up through pine
 *    forest toward snow-capped peaks that still catch the sunset.
 *  - Light: the sun has just set behind the far peaks (warm horizon, deep blue
 *    zenith). Everything near is cool and dark so the page's light text stays
 *    readable; the warm light lives on the horizon, the peaks and the water.
 *  - Air: aerial perspective (every surface fades to the sky colour in its view
 *    direction), drifting cloud bands, mist at the waterfall, fireflies over the lake.
 *  - Motion: each page section owns one authored camera view; scroll flies the
 *    camera up the valley. Landmarks are framed opposite the copy with a lens shift.
 *    Pointer adds a small clamped parallax.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Points, InstancedMesh, BufferGeometry,
  BufferAttribute, PlaneGeometry, SphereGeometry, ConeGeometry, ShaderMaterial, MeshLambertMaterial,
  HemisphereLight, DirectionalLight, Object3D, Color, Vector2, Vector3, Fog, MathUtils,
  BackSide, DoubleSide, AdditiveBlending, ACESFilmicToneMapping, SRGBColorSpace,
  TextureLoader, RepeatWrapping, InstancedBufferAttribute, InstancedBufferGeometry, CanvasTexture,
} from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------------------------------------------------------------- palette */
const P = {
  zenith: new Color('#2a78d6'),
  sky: new Color('#6aaeee'),
  horizonCool: new Color('#c9e2f7'),
  horizonWarm: new Color('#eef5fb'),
  sun: new Color('#fff7ea'),
  forest: new Color('#1f4a2e'),
  meadow: new Color('#4f8a3c'),
  rock: new Color('#7f8898'),
  snow: new Color('#f5f8fc'),
  water: new Color('#0c5266'),
  firefly: new Color('#ffd877'),
};
const SUN_DIR = new Vector3(-0.3, 0.42, -1).normalize();

/* ---------------------------------------------------------------- terrain math (CPU) */
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 5) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return v;
}
function ridged(x, y) {
  let v = 0, a = 0.55, f = 1, w = 1;
  for (let i = 0; i < 5; i++) {
    let n = 1 - Math.abs(2 * vnoise(x * f, y * f) - 1);
    n *= n * w; w = MathUtils.clamp(n * 1.6, 0, 1);
    v += a * n; f *= 2.1; a *= 0.5;
  }
  return v;
}
const ss = (a, b, x) => { const t = MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* the river's centre line */
const riverX = (z) => 14 * Math.sin(z * 0.011) + 5 * Math.sin(z * 0.027 + 1.0);
const CLIFF_Z = -60;
const STEP = 18;
const LOW_WATER = 0.4;
const HIGH_WATER = STEP + 0.4;

function heightAt(x, z) {
  const d = Math.abs(x - riverX(z));
  const width = 9 + 26 * ss(-25, 25, z);          // the valley floor widens into the lake
  const n = fbm(x * 0.009 + 7.3, z * 0.009 - 2.1);
  const r = 1 - Math.abs(2 * vnoise(x * 0.021, z * 0.021) - 1);
  const far = ss(-110, -330, z);
  let mountains = n * 34 + r * r * 10 + Math.max(0, d - width) * 0.17;
  mountains += far * Math.pow(ridged(x * 0.007 + 3.0, z * 0.007 + 9.0), 1.6) * 150;
  const bank = ss(width * 0.55, width + 34, d);
  const bed = -3 + Math.pow(Math.min(d / width, 1), 2) * 3.2;
  let h = bed + (mountains - bed) * bank;
  // the rock step that makes the waterfall
  const step = ss(CLIFF_Z + 2, CLIFF_Z - 3, z) * STEP;
  h += step * (1 - bank * 0.6);
  // a little rocky texture everywhere
  h += (vnoise(x * 0.18, z * 0.18) - 0.5) * 0.9 * bank + (fbm(x * 0.045, z * 0.045, 3) - 0.5) * 7 * bank;
  return h;
}

/* ---------------------------------------------------------------- shared GLSL */
const SKY_FN = /* glsl */ `
  uniform vec3 uZenith; uniform vec3 uSky; uniform vec3 uHorCool; uniform vec3 uHorWarm; uniform vec3 uSun; uniform vec3 uSunDir;
  vec3 skyColor(vec3 d){
    d = normalize(d);
    float h = d.y;
    float toward = pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 3.0);
    vec3 hor = mix(uHorCool, uHorWarm, toward);
    vec3 col = mix(hor, uSky, smoothstep(0.0, 0.22, h));
    col = mix(col, uZenith, smoothstep(0.2, 0.75, h));
    col = mix(col, hor * 0.55, smoothstep(0.0, -0.25, h));
    float s = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSun * pow(s, 18.0) * 0.55 + uSun * pow(s, 4.0) * 0.12;
    return col;
  }
`;
const NOISE_GLSL = /* glsl */ `
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float fbm2(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*n2(p); p *= 2.03; a *= 0.5; } return v; }
`;
const OUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;
const AERIAL = /* glsl */ `
  vec3 aerial(vec3 col, vec3 wpos, float maxA){
    vec3 v = wpos - cameraPosition;
    float dist = length(v);
    float a = 1.0 - exp(-pow(dist * 0.00115, 1.25));
    vec3 fd = normalize(v * vec3(1.0, 0.25, 1.0));
    vec3 fc = mix(skyColor(fd), mix(uHorCool, uSky, 0.35), 0.5);
    return mix(col, fc, clamp(a, 0.0, maxA));
  }
`;

/* ---------------------------------------------------------------- scene ledger */
/* pos / look: camera and the landmark it frames. sx/sy: where the landmark sits on
   screen (-1 … 1), opposite the copy. m*: narrow-screen overrides. */
function makeChapters() {
  const wfX = riverX(CLIFF_Z);
  return {
    hero:      { pos: [riverX(46) + 6, 7, 46],      look: [wfX, 14, CLIFF_Z],         fov: 42, sx: 0.42,  sy: 0.0,   mpos: [riverX(52), 7, 52],       mlook: [wfX, 15, CLIFF_Z], mfov: 60, msy: 0.52 },
    statement: { pos: [-26, 22, 26],                look: [wfX + 10, 16, CLIFF_Z],    fov: 44, sx: -0.5,  sy: 0.0,   mpos: [-18, 22, 30],             mfov: 58, msy: 0.36 },
    work:      { pos: [riverX(-40) + 20, 40, -30],  look: [-30, 90, -360],            fov: 46, sx: 0.5,   sy: 0.0,   mpos: [riverX(-40) + 14, 42, -26], mfov: 60, msy: 0.3 },
    repos:     { pos: [0, 70, -60],                 look: [-10, 95, -420],            fov: 50, sx: 0.0,   sy: 0.05,  mpos: [0, 70, -60],              mfov: 62, msy: 0.2 },
    services:  { pos: [30, 66, -110],               look: [-40, 70, -380],            fov: 44, sx: -0.5,  sy: 0.0,   mpos: [26, 68, -106],            mfov: 58, msy: 0.32 },
    stack:     { pos: [-30, 66, -140],              look: [40, 70, -380],             fov: 44, sx: 0.5,   sy: 0.0,   mpos: [-26, 68, -136],           mfov: 58, msy: 0.32 },
    process:   { pos: [riverX(-200) + 4, 34, -200], look: [riverX(-320), 40, -340],   fov: 46, sx: -0.45, sy: -0.05, mpos: [riverX(-196), 36, -196],  mfov: 60, msy: 0.3 },
    contact:   { pos: [0, 92, 20],                  look: [-10, 30, -360],            fov: 44, sx: 0.0,   sy: 0.12,  mpos: [0, 100, 30],              mfov: 58, msy: 0.1 },
  };
}

/* ---------------------------------------------------------------- pine texture */
/* A pine painted once into a canvas: a trunk and drooping whorls of needle clusters,
   darker inside, lighter at the tips. Used on crossed alpha-tested cards. */
function makePineTexture() {
  const W = 256, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#2b1e15';
  g.fillRect(W / 2 - 4, 60, 8, H - 60);
  const whorls = 30;
  for (let i = 0; i < whorls; i++) {
    const p = i / (whorls - 1);
    const y = 18 + p * (H - 70);
    const half = (6 + p * 112) * (0.85 + rnd() * 0.3);
    // dense dark core so the tree reads as solid
    g.fillStyle = `hsl(${138 + rnd() * 8}, 32%, ${9 + rnd() * 4}%)`;
    g.beginPath();
    g.moveTo(W / 2 - half * 0.7, y + half * 0.28);
    g.quadraticCurveTo(W / 2, y - 6, W / 2 + half * 0.7, y + half * 0.28);
    g.lineTo(W / 2, y + half * 0.42);
    g.closePath(); g.fill();
    const clusters = 26 + Math.floor(p * 70);
    for (let k = 0; k < clusters; k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const t = Math.pow(rnd(), 0.8);
      const x = W / 2 + side * t * half;
      const yy = y + t * t * half * 0.38 + (rnd() - 0.5) * 8;
      const light = 12 + t * 16 + (1 - p) * 6 + rnd() * 8;
      g.fillStyle = `hsl(${128 + rnd() * 18}, ${30 + rnd() * 15}%, ${light}%)`;
      g.beginPath();
      g.ellipse(x, yy, 3 + rnd() * 4, 2 + rnd() * 2.5, side * (0.35 + t * 0.4), 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------------------------------------------------------------- world */
export function createWorld(canvas, { mobile = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(P.zenith, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(44, 1, 0.5, 1600);
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const uTime = { value: 0 };
  const skyU = {
    uZenith: { value: P.zenith }, uSky: { value: P.sky }, uHorCool: { value: P.horizonCool },
    uHorWarm: { value: P.horizonWarm }, uSun: { value: P.sun }, uSunDir: { value: SUN_DIR },
  };
  scene.fog = new Fog(new Color('#c6dcf1'), 150, 700);

  /* ---- sky with drifting cloud bands and a few early stars ---- */
  const sky = new Mesh(track(new SphereGeometry(1100, 48, 24)), track(new ShaderMaterial({
    side: BackSide, depthWrite: false,
    uniforms: { ...skyU, uTime },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${SKY_FN}${NOISE_GLSL}
      uniform float uTime; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        if (d.y > 0.0) {
          // cloud bands near the horizon, lit warm on the sun side
          vec2 cp = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime * 0.012, 0.0);
          float c = smoothstep(0.48, 0.78, fbm2(cp * 1.3));
          c *= smoothstep(0.0, 0.06, d.y) * (1.0 - smoothstep(0.25, 0.55, d.y));
          float lit = pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 2.0);
          vec3 cc = mix(vec3(0.78, 0.84, 0.92), vec3(1.05), 0.55 + 0.45 * lit);
          col = mix(col, cc, c * 0.85);
          // stars fade in toward the zenith
          vec2 sp = floor(d.xz / (d.y + 0.2) * 260.0);
          float st = step(0.9975, h21(sp)) * smoothstep(0.35, 0.8, d.y);
          col += vec3(0.0) * st;
        }
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
      }`,
  })));
  sky.renderOrder = -1;
  scene.add(sky);

  /* ---- terrain ---- */
  const segs = mobile ? 150 : 260;
  const size = 560;
  const tGeo = track(new PlaneGeometry(size, size, segs, segs));
  tGeo.rotateX(-Math.PI / 2);
  tGeo.translate(0, 0, -170);
  const tp = tGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(tp.getX(i), tp.getZ(i)));
  tGeo.computeVertexNormals();
  const terrainMat = track(new ShaderMaterial({
    defines: { DETAIL: mobile ? 0 : 1 },
    uniforms: {
      ...skyU,
      uForest: { value: P.forest }, uMeadow: { value: P.meadow }, uRock: { value: P.rock }, uSnow: { value: P.snow },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${SKY_FN}${NOISE_GLSL}${AERIAL}
      uniform vec3 uForest; uniform vec3 uMeadow; uniform vec3 uRock; uniform vec3 uSnow;
      varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN);
        // fine relief: perturb the normal with a small noise gradient so slopes are not flat
        // slope-aware coordinates: on steep faces fold height into the pattern so it does not streak
        vec2 q = (vW.xz + vec2(vW.y * 0.8, vW.y * 0.55)) * 0.22;
        #if DETAIL
        float b0 = n2(q) * 0.55 + n2(q * 2.7) * 0.3 + n2(q * 6.1) * 0.15;
        float bx = n2(q + vec2(0.08, 0.0)) * 0.55 + n2((q + vec2(0.08, 0.0)) * 2.7) * 0.3 + n2((q + vec2(0.08, 0.0)) * 6.1) * 0.15;
        float bz = n2(q + vec2(0.0, 0.08)) * 0.55 + n2((q + vec2(0.0, 0.08)) * 2.7) * 0.3 + n2((q + vec2(0.0, 0.08)) * 6.1) * 0.15;
        float near = smoothstep(15.0, 90.0, length(vW - cameraPosition));
        n = normalize(n + vec3(-(bx - b0), 0.0, -(bz - b0)) * mix(3.5, 7.0, near));
        #else
        float b0 = n2(q) * 0.6 + n2(q * 2.7) * 0.4;
        #endif
        float slope = 1.0 - n.y;
        float h = vW.y;
        float var = fbm2((vW.xz + vec2(vW.y * 0.8, vW.y * 0.55)) * 0.05);
        vec3 col = mix(uForest, uMeadow, smoothstep(0.35, 0.75, var) * 0.6);
        col = mix(col, uRock, smoothstep(0.46, 0.72, slope + var * 0.15));
        col = mix(col, uRock, smoothstep(70.0, 100.0, h + var * 18.0));
        float snow = smoothstep(95.0, 125.0, h + var * 30.0) * (1.0 - smoothstep(0.45, 0.75, slope));
        // rock strata and darker crevices
        float rocky = smoothstep(0.3, 0.6, slope) + smoothstep(55.0, 85.0, h);
        col *= mix(1.0, 0.92 + 0.08 * sin(h * 1.2 + var * 7.0 + b0 * 3.0), clamp(rocky, 0.0, 1.0));
        col *= 0.72 + 0.4 * b0;
        col = mix(col, uSnow, snow);
        // light: warm sun from behind the peaks, cool sky fill
        float diff = max(dot(n, normalize(uSunDir)), 0.0);
        float rim = pow(max(dot(n, normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 2.0) * smoothstep(40.0, 140.0, h);
        vec3 lit = col * (uSky * 0.42 * (0.55 + 0.45 * n.y)) + col * uSun * diff * 1.15 + uSun * rim * snow * 0.15;
        gl_FragColor = vec4(aerial(lit, vW, 0.97), 1.0);
        ${OUT}
      }`,
  }));
  const terrain = new Mesh(tGeo, terrainMat);
  scene.add(terrain);

  /* ---- distant mountain ranges: jagged rings fading into the dusk haze ---- */
  const CENTER = new Vector3(0, 0, -150);
  function rangeRing(radius, base, amp, seed, segsA, haze) {
    const cols = segsA + 1;
    const pos = new Float32Array(cols * 2 * 3), uvs = new Float32Array(cols * 2 * 2), idx = [];
    for (let i = 0; i < cols; i++) {
      const a = (i / segsA) * Math.PI * 2;
      const cx = Math.cos(a), cz = Math.sin(a);
      const k = ridged(cx * 2.2 + seed, cz * 2.2 - seed) * 0.75 + fbm(cx * 6 + seed, cz * 6, 3) * 0.25;
      // ranges rise behind the sunset (toward -z) and stay lower behind the viewer
      const facing = 0.55 + 0.45 * Math.max(0, -cz);
      const top = base + Math.pow(k, 1.4) * amp * facing;
      const x = CENTER.x + cx * radius, z = CENTER.z + cz * radius;
      pos.set([x, -40, z, x, top, z], i * 6);
      uvs.set([i / segsA, 0, i / segsA, top / (base + amp)], i * 4);
      if (i < segsA) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = track(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('uv', new BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const m = new Mesh(g, track(new ShaderMaterial({
      side: DoubleSide, depthWrite: true,
      uniforms: { ...skyU, uHaze: { value: haze }, uSnowC: { value: P.snow }, uRockC: { value: P.rock } },
      vertexShader: 'varying vec3 vW; varying float vH; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vH = position.y; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `${SKY_FN}${NOISE_GLSL}
        uniform float uHaze; uniform vec3 uSnowC; uniform vec3 uRockC; varying vec3 vW; varying float vH;
        void main(){
          vec3 v = normalize(vW - cameraPosition);
          float snow = smoothstep(${(base + amp * 0.35).toFixed(1)}, ${(base + amp * 0.7).toFixed(1)}, vH + (fbm2(vW.xz * 0.02 + vH * 0.05) - 0.5) * ${(amp * 0.35).toFixed(1)});
          vec3 col = mix(uRockC * 0.7, uSnowC, snow * 0.85);
          float toward = pow(max(dot(normalize(vec3(v.x, 0.0, v.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 4.0);
          col += uHorWarm * toward * snow * 0.35;
          vec3 haze = mix(skyColor(normalize(vec3(v.x, 0.02, v.z))), mix(uHorCool, uSky, 0.5), 0.35);
          col = mix(col, haze, uHaze * (1.0 - snow * 0.35));
          gl_FragColor = vec4(col, 1.0);
          ${OUT}
        }`,
    })));
    m.renderOrder = -0.5;
    scene.add(m);
    return m;
  }
  rangeRing(520, 40, 150, 1.7, mobile ? 220 : 420, 0.55);
  rangeRing(820, 90, 290, 5.3, mobile ? 220 : 420, 0.78);

  /* ---- water: lake + upper river ---- */
  const waterMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...skyU, uTime, uWater: { value: P.water } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${SKY_FN}${NOISE_GLSL}${AERIAL}
      uniform float uTime; uniform vec3 uWater; varying vec3 vW;
      void main(){
        vec2 p = vW.xz;
        float t = uTime;
        vec2 g = vec2(n2(p * 0.35 + vec2(t * 0.25, t * 0.1)) - n2(p * 0.35 + vec2(1.3, 0.0) + vec2(t * 0.25, t * 0.1)),
                      n2(p * 0.35 + vec2(t * 0.1, -t * 0.22)) - n2(p * 0.35 + vec2(0.0, 1.3) + vec2(t * 0.1, -t * 0.22)));
        g += 0.5 * vec2(n2(p * 1.4 + t * 0.6) - 0.5, n2(p * 1.4 - t * 0.5 + 7.0) - 0.5);
        vec3 n = normalize(vec3(g.x * 0.35, 1.0, g.y * 0.35));
        vec3 v = normalize(vW - cameraPosition);
        vec3 r = reflect(v, n);
        r.y = abs(r.y);
        float fres = 0.08 + 0.92 * pow(1.0 - max(dot(-v, n), 0.0), 4.0);
        vec3 col = mix(uWater, skyColor(r) * 0.45, fres * 0.8);
        float glint = pow(max(dot(r, normalize(uSunDir)), 0.0), 260.0);
        col += uSun * glint * 0.35;
        gl_FragColor = vec4(aerial(col, vW, 0.95), 0.94);
        ${OUT}
      }`,
  }));
  // the lake is a true mirror: it reflects the peaks, the forest and the sunset sky
  const normals = track(new TextureLoader().load('/textures/waternormals.jpg'));
  normals.wrapS = normals.wrapT = RepeatWrapping;
  const lake = new Water(track(new PlaneGeometry(220, 160)), {
    textureWidth: mobile ? 320 : 900, textureHeight: mobile ? 320 : 900,
    waterNormals: normals, sunDirection: SUN_DIR.clone(), sunColor: 0xffffff,
    waterColor: 0x0b5a6e, distortionScale: 0.9, fog: false,
  });
  lake.material.uniforms.size.value = 2.4;
  lake.rotation.x = -Math.PI / 2; lake.position.set(0, LOW_WATER, CLIFF_Z + 80);
  track(lake.material);
  scene.add(lake);

  /* ---- low mist drifting over the lake ---- */
  const mistSheet = new Mesh(track(new PlaneGeometry(240, 170, 1, 1)), track(new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime, ...skyU },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${SKY_FN}${NOISE_GLSL}
      uniform float uTime; varying vec3 vW;
      void main(){
        vec2 p = vW.xz * 0.035 + vec2(uTime * 0.012, uTime * 0.004);
        float m = smoothstep(0.42, 0.85, fbm2(p) * 0.7 + fbm2(p * 2.3 - uTime * 0.01) * 0.4);
        float d = length(vW - cameraPosition);
        m *= smoothstep(6.0, 40.0, d);
        vec3 c = mix(uHorCool, uHorWarm, 0.25) * 1.1;
        gl_FragColor = vec4(c, m * 0.32);
        ${OUT}
      }`,
  })));
  mistSheet.rotation.x = -Math.PI / 2; mistSheet.position.set(0, LOW_WATER + 1.6, CLIFF_Z + 78);
  scene.add(mistSheet);
  // upper river: a mirror on desktop, a light shader on phones
  const river = mobile ? new Mesh(track(new PlaneGeometry(200, 330)), waterMat) : new Water(track(new PlaneGeometry(200, 330)), {
    textureWidth: 640, textureHeight: 640, waterNormals: normals, sunDirection: SUN_DIR.clone(), sunColor: 0xffffff,
    waterColor: 0x0b5a6e, distortionScale: 1.4, fog: false,
  });
  if (!mobile) { river.material.uniforms.size.value = 2.0; track(river.material); }
  river.rotation.x = -Math.PI / 2; river.position.set(0, HIGH_WATER, CLIFF_Z - 3 - 165);
  scene.add(river);

  /* ---- waterfall ---- */
  const wfX = riverX(CLIFF_Z);
  const fallH = HIGH_WATER - LOW_WATER + 1.5;
  const fallGeo = track(new PlaneGeometry(13, fallH, 8, 24));
  {
    // bow the sheet outward at the lip so the water arcs over the edge
    const fp = fallGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const y = fp.getY(i) / (fallH / 2); // -1 bottom … 1 top
      const u = (1 - y) / 2;
      fp.setZ(i, Math.sin(Math.min(u, 0.35) / 0.35 * Math.PI / 2) * 2.4 - u * 0.6);
    }
  }
  const fallMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { uTime, ...skyU },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${SKY_FN}${NOISE_GLSL}
      uniform float uTime; varying vec2 vUv;
      void main(){
        float x = vUv.x, y = vUv.y;
        float streak = n2(vec2(x * 22.0, y * 2.5 + uTime * 2.8)) * 0.65 + n2(vec2(x * 60.0, y * 6.0 + uTime * 4.2)) * 0.35;
        float foam = smoothstep(0.35, 0.85, streak);
        float edge = smoothstep(0.0, 0.12, x) * smoothstep(1.0, 0.88, x);
        float a = (0.35 + foam * 0.65) * edge;
        a *= 0.85 + 0.15 * smoothstep(0.0, 0.15, y);
        vec3 base = mix(vec3(0.42, 0.52, 0.66), vec3(0.85, 0.9, 0.98), foam);
        base = mix(base, skyColor(vec3(0.0, 0.2, -1.0)) * 1.1, 0.25);
        gl_FragColor = vec4(base * 0.9, a * 0.92);
        ${OUT}
      }`,
  }));
  const fall = new Mesh(fallGeo, fallMat);
  fall.position.set(wfX, (HIGH_WATER + LOW_WATER) / 2 - 0.4, CLIFF_Z + 0.5);
  scene.add(fall);

  /* ---- mist at the waterfall's foot ---- */
  const mistN = mobile ? 70 : 140;
  const mPos = new Float32Array(mistN * 3), mSeed = new Float32Array(mistN);
  for (let i = 0; i < mistN; i++) {
    mPos.set([wfX + (Math.random() - 0.5) * 14, LOW_WATER + Math.random() * 6, CLIFF_Z + 2 + Math.random() * 8], i * 3);
    mSeed[i] = Math.random();
  }
  const mistGeo = track(new BufferGeometry());
  mistGeo.setAttribute('position', new BufferAttribute(mPos, 3));
  mistGeo.setAttribute('aSeed', new BufferAttribute(mSeed, 1));
  const mist = new Points(mistGeo, track(new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime, uPR: { value: dpr } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPR; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position;
        float life = fract(uTime * (0.05 + aSeed * 0.05) + aSeed);
        p.y += life * 9.0;
        p.x += sin(aSeed * 30.0 + uTime * 0.4) * 2.0 * life;
        p.z += life * 6.0;
        vA = sin(life * 3.14159) * 0.22;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(uPR * (140.0 + aSeed * 160.0) / -mv.z, 220.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA;
        gl_FragColor = vec4(vec3(0.78, 0.82, 0.92), a); }`,
  })));
  mist.frustumCulled = false;
  scene.add(mist);

  /* ---- pine forest ---- */
  const hemi = new HemisphereLight(new Color('#a6cdf2'), new Color('#33452a'), 1.5);
  const sun = new DirectionalLight(new Color('#fff4e2'), 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100).add(new Vector3(0, 60, 0));
  scene.add(hemi, sun);
  // three crossed cards per tree, painted with the pine texture
  const cards = [0, Math.PI / 3, (2 * Math.PI) / 3].map((r) => {
    const g = new PlaneGeometry(1, 1); g.translate(0, 0.5, 0); g.rotateY(r); return g;
  });
  const treeGeo = track(mergeGeometries(cards));
  cards.forEach((g) => g.dispose());
  { // soften card lighting: normals lean upward so every card catches the sky light
    const nrm = treeGeo.attributes.normal;
    for (let i = 0; i < nrm.count; i++) {
      const v = new Vector3(nrm.getX(i) * 0.35, 0.94, nrm.getZ(i) * 0.35).normalize();
      nrm.setXYZ(i, v.x, v.y, v.z);
    }
  }
  const pineTex = track(makePineTexture());
  const treeMat = track(new MeshLambertMaterial({ map: pineTex, alphaTest: 0.5, side: DoubleSide, color: 0xffffff }));
  treeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          float sway = sin(uTime * 1.1 + ip.x * 0.15 + ip.z * 0.11) * 0.5 + sin(uTime * 2.3 + ip.x * 0.4) * 0.2;
          transformed.x += sway * 0.05 * position.y * position.y;
          transformed.z += sway * 0.03 * position.y * position.y;
        #endif`);
  };
  const want = mobile ? 1400 : 3600;
  const keepClear = Object.values(makeChapters()).flatMap((c) => [[c.pos[0], c.pos[2]], [(c.mpos || c.pos)[0], (c.mpos || c.pos)[2]]]);
  const trees = new InstancedMesh(treeGeo, treeMat, want);
  const dummy = new Object3D();
  const tint = new Color();
  let placed = 0;
  for (let tries = 0; tries < want * 12 && placed < want; tries++) {
    const x = (Math.random() - 0.5) * 300;
    const z = 60 - Math.random() * 330;
    const h = heightAt(x, z);
    const water = z > CLIFF_Z - 3 ? LOW_WATER : HIGH_WATER;
    if (h < water + 1.2 || h > 62 + (z < -150 ? 10 : 0)) continue;
    const slope = Math.abs(heightAt(x + 1.5, z) - h) + Math.abs(heightAt(x, z + 1.5) - h);
    if (slope > 2.6) continue;
    if (fbm(x * 0.03, z * 0.03, 3) < 0.38) continue; // clearings
    if (keepClear.some(([cx, cz]) => (x - cx) ** 2 + (z - cz) ** 2 < 220)) continue; // never in front of the lens
    const s = 0.8 + Math.random() * 0.9;
    dummy.position.set(x, h - 0.3, z);
    dummy.scale.set(3.6 * s, (6.5 + Math.random() * 3.5) * s, 3.6 * s);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    trees.setMatrixAt(placed, dummy.matrix);
    tint.setHSL(0.3 + Math.random() * 0.08, 0.25, 0.62 + Math.random() * 0.3);
    trees.setColorAt(placed, tint);
    placed++;
  }
  trees.count = placed;
  trees.instanceMatrix.needsUpdate = true;
  if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  scene.add(trees);

  /* ---- a small flock of birds crossing the evening sky ---- */
  const birdN = mobile ? 9 : 14;
  const birdGeo = track(new BufferGeometry());
  birdGeo.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0.25,  -1, 0.1, -0.1,  0, 0, -0.2,
    0, 0, 0.25,   1, 0.1, -0.1,  0, 0, -0.2,
  ]), 3));
  const birdOff = new Float32Array(birdN * 4);
  for (let i = 0; i < birdN; i++) {
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    birdOff.set([side * row * 2.2 + (Math.random() - 0.5), -row * 0.5 + (Math.random() - 0.5) * 0.6, row * 2.4, Math.random()], i * 4);
  }
  birdGeo.setAttribute('aOff', new InstancedBufferAttribute(birdOff, 4));
  const birdMat = track(new ShaderMaterial({
    side: DoubleSide,
    uniforms: { uTime, ...skyU },
    vertexShader: /* glsl */ `
      uniform float uTime; attribute vec4 aOff; varying vec3 vW;
      void main(){
        vec3 p = position;
        float flap = sin(uTime * 7.0 + aOff.w * 6.28);
        p.y += abs(p.x) * flap * 0.55;
        p *= 1.5;
        // the flock glides in a long, slow loop across the valley
        float t = uTime * 0.035 + 1.2;
        vec3 c = vec3(sin(t) * 55.0, 27.0 + sin(t * 2.0) * 4.0, -35.0 + cos(t) * 22.0);
        vec3 dir = normalize(vec3(cos(t) * 55.0, cos(t * 2.0) * 8.0, -sin(t) * 22.0));
        vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), dir));
        vec3 up = cross(dir, side);
        vec3 off = side * aOff.x + up * aOff.y - dir * aOff.z;
        off += vec3(sin(uTime * 0.7 + aOff.w * 9.0), sin(uTime * 0.9 + aOff.w * 5.0) * 0.6, 0.0) * 0.8;
        vec3 wp = c + off + side * p.x + up * p.y + dir * p.z;
        vW = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `${SKY_FN}
      varying vec3 vW;
      void main(){
        vec3 v = vW - cameraPosition;
        float a = 1.0 - exp(-length(v) * 0.004);
        vec3 col = mix(vec3(0.015, 0.018, 0.03), skyColor(normalize(v)), a * 0.8);
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
      }`,
  }));
  const birds = new InstancedMesh(birdGeo, birdMat, birdN);
  birds.frustumCulled = false;
  scene.add(birds);

  /* ---- meadow grass on the lake shore, moving in the breeze ---- */
  {
    const bladeN = mobile ? 9000 : 28000;
    const blade = new PlaneGeometry(0.075, 1, 1, 3); blade.translate(0, 0.5, 0);
    const gGeo = track(new InstancedBufferGeometry());
    gGeo.index = blade.index;
    gGeo.setAttribute('position', blade.attributes.position);
    gGeo.setAttribute('uv', blade.attributes.uv);
    const gPos = new Float32Array(bladeN * 3), gRnd = new Float32Array(bladeN * 2);
    let n = 0;
    for (let tries = 0; tries < bladeN * 8 && n < bladeN; tries++) {
      const z = -52 + Math.random() * 128;
      const x = riverX(z) + (Math.random() - 0.5) * 120;
      const h = heightAt(x, z);
      if (h < LOW_WATER + 0.25 || h > 10) continue;
      if (Math.abs(heightAt(x + 1, z) - h) + Math.abs(heightAt(x, z + 1) - h) > 1.1) continue;
      if (fbm(x * 0.08, z * 0.08, 2) < 0.32) continue; // patches
      gPos.set([x, h - 0.05, z], n * 3);
      gRnd.set([Math.random(), Math.random()], n * 2);
      n++;
    }
    gGeo.setAttribute('aPos', new InstancedBufferAttribute(gPos, 3));
    gGeo.setAttribute('aRnd', new InstancedBufferAttribute(gRnd, 2));
    gGeo.instanceCount = n;
    const grass = new Mesh(gGeo, track(new ShaderMaterial({
      side: DoubleSide,
      uniforms: { uTime, ...skyU },
      vertexShader: /* glsl */ `
        uniform float uTime; attribute vec3 aPos; attribute vec2 aRnd; varying float vY; varying vec3 vW;
        void main(){
          vec3 p = position;
          float h = 0.28 + aRnd.y * 0.55;
          p.x *= 1.0 - position.y * 0.85;
          p.y *= h;
          float r = aRnd.x * 6.2832;
          p.xz = mat2(cos(r), -sin(r), sin(r), cos(r)) * p.xz;
          float w = sin(uTime * 1.7 + aPos.x * 0.35 + aPos.z * 0.22) * 0.5 + 0.5;
          w += sin(uTime * 3.1 + aPos.x * 1.3) * 0.15;
          float bend = position.y * position.y * h;
          p.x += (w * 0.32 + 0.08) * bend;
          p.z += w * 0.12 * bend;
          vec3 wp = aPos + p;
          vY = position.y; vW = wp;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: `${SKY_FN}${AERIAL}
        varying float vY; varying vec3 vW;
        void main(){
          vec3 base = vec3(0.025, 0.06, 0.022);
          vec3 tip = vec3(0.16, 0.26, 0.07);
          vec3 col = mix(base, tip, vY);
          gl_FragColor = vec4(aerial(col, vW, 0.9), 1.0);
          ${OUT}
        }`,
    })));
    grass.frustumCulled = false;
    scene.add(grass);
    blade.dispose();
  }

  /* ---- white water where the fall hits the lake ---- */
  const foam = new Mesh(track(new PlaneGeometry(26, 16)), track(new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${NOISE_GLSL}
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 c = (vUv - vec2(0.5, 0.82)) * vec2(1.0, 1.6);
        float d = length(c);
        float n = fbm2(vec2(atan(c.y, c.x) * 3.0, d * 9.0 - uTime * 1.6));
        float a = smoothstep(0.55, 0.0, d) * smoothstep(0.35, 0.75, n + 0.25 * (1.0 - d));
        gl_FragColor = vec4(vec3(0.82, 0.86, 0.92), a * 0.85);
        ${OUT}
      }`,
  })));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(wfX, LOW_WATER + 0.06, CLIFF_Z + 7.5);
  scene.add(foam);
  const sprayN = mobile ? 60 : 160;
  const sPos = new Float32Array(sprayN * 3), sSeed = new Float32Array(sprayN);
  for (let i = 0; i < sprayN; i++) { sPos.set([wfX + (Math.random() - 0.5) * 11, LOW_WATER, CLIFF_Z + 1.5], i * 3); sSeed[i] = Math.random(); }
  const sprayGeo = track(new BufferGeometry());
  sprayGeo.setAttribute('position', new BufferAttribute(sPos, 3));
  sprayGeo.setAttribute('aSeed', new BufferAttribute(sSeed, 1));
  const spray = new Points(sprayGeo, track(new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime, uPR: { value: dpr } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPR; attribute float aSeed; varying float vA;
      void main(){
        float life = fract(uTime * (0.5 + aSeed * 0.4) + aSeed * 7.0);
        vec3 p = position;
        float ang = aSeed * 6.2832;
        p.x += cos(ang) * life * 3.0;
        p.z += abs(sin(ang)) * life * 4.0;
        p.y += life * (3.5 + aSeed * 2.5) - life * life * 4.5;
        vA = (1.0 - life) * 0.75;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPR * (6.0 + aSeed * 8.0) * (20.0 / max(-mv.z, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.1, 0.5, d)) * vA;
        gl_FragColor = vec4(vec3(0.9, 0.93, 0.98), a); }`,
  })));
  spray.frustumCulled = false;
  scene.add(spray);

  /* ---- fireflies over the lake shore ---- */
  const ffN = mobile ? 90 : 200;
  const fPos = new Float32Array(ffN * 3), fSeed = new Float32Array(ffN);
  for (let i = 0; i < ffN; i++) {
    const z = CLIFF_Z + 10 + Math.random() * 100;
    const x = riverX(z) + (Math.random() - 0.5) * 70;
    fPos.set([x, Math.max(heightAt(x, z), LOW_WATER) + 0.6 + Math.random() * 3, z], i * 3);
    fSeed[i] = Math.random();
  }
  const ffGeo = track(new BufferGeometry());
  ffGeo.setAttribute('position', new BufferAttribute(fPos, 3));
  ffGeo.setAttribute('aSeed', new BufferAttribute(fSeed, 1));
  const fireflies = new Points(ffGeo, track(new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime, uPR: { value: dpr }, uColor: { value: P.firefly } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPR; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.5 + aSeed * 40.0) * 1.2;
        p.y += sin(uTime * 0.7 + aSeed * 20.0) * 0.6;
        p.z += cos(uTime * 0.4 + aSeed * 30.0) * 1.2;
        vA = pow(max(0.0, sin(uTime * (0.8 + aSeed) + aSeed * 50.0)), 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPR * 9.0 * (24.0 / max(-mv.z, 1.0)) + 1.5;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0) * vA;
        gl_FragColor = vec4(uColor * a * 1.6, a); }`,
  })));
  fireflies.frustumCulled = false;
  // daylight scene: fireflies stay off

  /* ---- post (desktop): gentle bloom on the sky glow, water glint and fireflies ---- */
  let composer = null;
  let raysPass = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // light shafts: march from each pixel toward the sun and gather the bright sky behind the peaks
    raysPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uSun: { value: new Vector2(0.5, 0.5) }, uStrength: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uStrength; varying vec2 vUv;
        void main(){
          vec4 base = texture2D(tDiffuse, vUv);
          if (uStrength <= 0.001) { gl_FragColor = base; return; }
          vec2 delta = (vUv - uSun) * (0.92 / 40.0);
          vec2 uv = vUv; float decay = 1.0; vec3 acc = vec3(0.0);
          for (int i = 0; i < 40; i++) {
            uv -= delta;
            vec3 s = texture2D(tDiffuse, uv).rgb;
            float l = max(dot(s, vec3(0.3, 0.59, 0.11)) - 1.4, 0.0);
            acc += s * l * decay;
            decay *= 0.955;
          }
          gl_FragColor = vec4(base.rgb + acc * (uStrength / 40.0) * vec3(1.0, 0.82, 0.62), base.a);
        }`,
    });
    composer.addPass(raysPass);
    composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.18, 0.5, 1.15));
    composer.addPass(new OutputPass());
  }

  /* ---------------------------------------------------------------- camera state */
  const CHAPTERS = makeChapters();
  const ORDER = Object.keys(CHAPTERS);
  let width = 0, height = 0, narrow = false;
  const cur = { pos: new Vector3(), look: new Vector3(), fov: 44, sx: 0, sy: 0 };
  const tgt = { pos: new Vector3(), look: new Vector3(), fov: 44, sx: 0, sy: 0 };
  const vA = { pos: new Vector3(), look: new Vector3(), fov: 44, sx: 0, sy: 0 };
  const vB = { pos: new Vector3(), look: new Vector3(), fov: 44, sx: 0, sy: 0 };
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  let velocity = 0;
  let raf = 0, running = false, last = performance.now(), time = 0, intro = 0, first = true;
  let section = 'hero', sectionProgress = 0;
  const tmp = new Vector3(), prevCam = new Vector3(), lateral = new Vector3(), right = new Vector3(), sunScreen = new Vector3();
  let bank = 0;

  function view(name, out) {
    const c = CHAPTERS[name];
    out.pos.fromArray(narrow && c.mpos ? c.mpos : c.pos);
    out.look.fromArray(narrow && c.mlook ? c.mlook : c.look);
    out.fov = narrow ? c.mfov : c.fov;
    out.sx = narrow ? 0 : c.sx;
    out.sy = narrow ? c.msy : c.sy;
    return out;
  }
  function applySection() {
    const i = Math.max(0, ORDER.indexOf(section));
    const j = Math.min(i + 1, ORDER.length - 1);
    let k = MathUtils.smoothstep(sectionProgress, 0.5, 1.0);
    k = k * k * (3 - 2 * k);
    view(ORDER[i], vA); view(ORDER[j], vB);
    tgt.pos.copy(vA.pos).lerp(vB.pos, k);
    tgt.look.copy(vA.look).lerp(vB.look, k);
    tgt.fov = MathUtils.lerp(vA.fov, vB.fov, k);
    tgt.sx = MathUtils.lerp(vA.sx, vB.sx, k);
    tgt.sy = MathUtils.lerp(vA.sy, vB.sy, k);
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

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = MathUtils.clamp((now - last) / 1000, 0, 1 / 30); // RAF time can precede start(): never step backwards
    last = now;
    time += dt;
    uTime.value = time;
    lake.material.uniforms.time.value = time * 0.25;
    if (river.material.uniforms.time) river.material.uniforms.time.value = time * 0.4;
    intro = Math.min(1, intro + dt / 3.0);
    velocity *= 0.9;

    const ease = first ? 1 : 1 - Math.exp(-dt * 1.9);
    first = false;
    cur.pos.lerp(tgt.pos, ease);
    cur.look.lerp(tgt.look, ease);
    cur.fov += (tgt.fov - cur.fov) * ease;
    cur.sx += (tgt.sx - cur.sx) * ease;
    cur.sy += (tgt.sy - cur.sy) * ease;
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 2.5));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 2.5));

    // intro: a slow rise from just above the lake
    const ie = 1 - Math.pow(1 - intro, 3);
    tmp.copy(cur.pos);
    tmp.y -= (1 - ie) * 3.5;
    tmp.z += (1 - ie) * 10;
    const par = narrow ? 0.6 : 1.6;
    tmp.x += pointer.x * par;
    tmp.y += pointer.y * par * 0.5;
    // gentle handheld drift
    tmp.x += Math.sin(time * 0.21) * 0.35;
    tmp.y += Math.sin(time * 0.17) * 0.2;
    const ground = Math.max(heightAt(tmp.x, tmp.z), tmp.z > CLIFF_Z - 3 ? LOW_WATER : HIGH_WATER);
    if (tmp.y < ground + 6) tmp.y = ground + 6;
    // drone-like bank into lateral moves
    lateral.copy(tmp).sub(prevCam);
    prevCam.copy(tmp);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const bankTarget = MathUtils.clamp(-lateral.dot(right) * 0.05, -0.07, 0.07);
    bank += (bankTarget - bank) * (1 - Math.exp(-dt * 3));
    camera.position.copy(tmp);
    sky.position.copy(tmp);
    camera.lookAt(cur.look);
    camera.rotateZ(bank);
    camera.fov = cur.fov;
    camera.setViewOffset(width, height, -cur.sx * width / 2, cur.sy * height / 2, width, height);
    camera.updateProjectionMatrix();

    if (raysPass) {
      sunScreen.copy(SUN_DIR).multiplyScalar(900).add(camera.position).project(camera);
      const facing = sunScreen.z < 1 ? 1 : 0;
      const off = Math.max(Math.abs(sunScreen.x), Math.abs(sunScreen.y));
      raysPass.uniforms.uSun.value.set(sunScreen.x * 0.5 + 0.5, sunScreen.y * 0.5 + 0.5);
      raysPass.uniforms.uStrength.value = facing * (1 - MathUtils.smoothstep(off, 1.0, 2.2)) * 0.5;
    }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  function setPointer(x, y) { pointer.tx = x; pointer.ty = y; }
  function setVelocity(v) { velocity = MathUtils.clamp(v, -3, 3); }

  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('resize', resize);
  resize();
  renderer.compile(scene, camera);

  function renderOnce() { frame(performance.now()); cancelAnimationFrame(raf); }
  function snap() { first = true; intro = 1; }
  function debug() { return { bank, pos: camera.position.toArray(), look: cur.look.toArray(), q: camera.quaternion.toArray(), section, sectionProgress }; }
  function dispose() {
    stop();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', resize);
    disposables.forEach((d) => d.dispose && d.dispose());
    trees.dispose();
    if (composer) composer.dispose();
    renderer.dispose();
  }

  return { start, stop, setSection, setPointer, setVelocity, resize, renderOnce, dispose, snap, debug, renderer };
}
