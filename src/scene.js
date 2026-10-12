/**
 * "Mixed universe" background.
 * One renderer, five looks that cross-fade as the page scrolls:
 *   aurora sky · neon liquid · synthwave grid   (full-screen shader, blended by weights)
 *   spiral galaxy · glowing wave field          (3D point clouds, faded by opacity)
 * Each section of the page has its own mix; pointer and scroll speed feed every layer.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Points, Group, BufferGeometry, BufferAttribute,
  PlaneGeometry, ShaderMaterial, AdditiveBlending, Color, MathUtils, Vector2, LinearSRGBColorSpace,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* Per-section mix: [aurora, liquid, synth, galaxy, waves, brightness] */
const MIX = [
  [0.55, 0.0, 0.0, 1.0, 0.0, 1.0],   // hero: galaxy over aurora
  [1.0, 0.0, 0.0, 0.3, 0.0, 0.8],    // about: aurora
  [0.15, 1.0, 0.0, 0.0, 0.0, 0.7],   // services: neon liquid
  [0.0, 0.45, 0.0, 0.0, 1.0, 0.75],  // stack: waves + liquid
  [0.35, 0.0, 0.0, 0.0, 1.0, 0.7],   // work: waves + aurora
  [0.0, 0.0, 1.0, 0.0, 0.0, 0.8],    // process: synthwave
  [0.6, 0.0, 0.0, 1.0, 0.0, 1.0],    // contact: galaxy again
];
/* Galaxy framing per section: [x, y, z, scale] */
const GAL_WIDE = [[2.6, 0.2, 0, 0.62], [3.2, 0.6, -2, 0.5], [3.5, 0, -4, 0.4], [3.5, 0, -4, 0.4], [0, 0, -6, 0.4], [0, 0, -6, 0.4], [2.6, 0.2, 0, 0.62]];
const GAL_NARROW = [[0, 1.35, -1, 0.42], [0, 1.6, -3, 0.38], [0, 1, -5, 0.3], [0, 1, -5, 0.3], [0, 0, -6, 0.3], [0, 0, -6, 0.3], [0, 1.3, -1, 0.45]];

const NOISE = /* glsl */`
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < OCTAVES; i++){ v += a*noise(p); p = p*2.02 + vec2(1.7, 9.2); a *= 0.5; } return v; }
`;

const BG_FRAG = /* glsl */`
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse;
uniform float uA; uniform float uL; uniform float uS; uniform float uBright; uniform float uSpeed;
${NOISE}

vec3 aurora(vec2 p, vec2 uv, float t){
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = p.x * (1.1 + fi*0.2) + fi*1.3 + uMouse.x*0.15;
    float n = fbm(vec2(x*1.2, t*0.07 + fi*4.0));
    float base = 0.02 + fi*0.13 + (n-0.5)*0.55 + uMouse.y*0.04;
    float d = p.y - base;
    float band = smoothstep(-0.025, 0.0, d) * exp(-max(d, 0.0) * (3.2 + fi));
    float rays = 0.45 + 0.55*fbm(vec2(x*14.0 + t*0.15, fi*7.0 + t*0.05));
    vec3 c = i == 0 ? vec3(0.15, 1.0, 0.65) : (i == 1 ? vec3(0.45, 0.35, 1.0) : vec3(0.95, 0.3, 0.85));
    col += c * band * rays * (0.5 - fi*0.1);
  }
  col += vec3(0.1, 0.05, 0.25) * exp(-abs(p.y + 0.45) * 5.0) * 0.35;
  return col;
}

vec3 liquid(vec2 p, float t){
  p = p * 1.6 + uMouse * 0.25;
  t *= 0.6;
  vec2 q = vec2(fbm(p + vec2(0.0, t*0.10)), fbm(p + vec2(5.2, 1.3) - t*0.08));
  vec2 r = vec2(fbm(p + 4.0*q + vec2(1.7, 9.2) + t*0.15), fbm(p + 4.0*q + vec2(8.3, 2.8) - t*0.12));
  float f = fbm(p + 4.0*r);
  vec3 col = mix(vec3(0.02, 0.01, 0.06), vec3(0.42, 0.12, 0.95), clamp(f*f*2.2, 0.0, 1.0));
  col = mix(col, vec3(0.0, 0.85, 0.95), clamp(length(q) - 0.55, 0.0, 1.0) * 0.8);
  col = mix(col, vec3(0.85, 1.0, 0.25), clamp(pow(r.x, 5.0) * 2.5, 0.0, 1.0) * 0.55);
  col = mix(col, vec3(1.0, 0.3, 0.75), clamp(pow(r.y, 6.0) * 3.0, 0.0, 1.0) * 0.45);
  return col * (f*f*1.9 + 0.05);
}

vec3 synth(vec2 p, float t){
  p.x += uMouse.x * 0.06;
  float h = -0.08;
  vec3 col;
  if (p.y > h) {
    col = mix(vec3(0.22, 0.02, 0.28), vec3(0.0), smoothstep(h, 0.55, p.y));
    vec2 c = vec2(0.0, 0.16);
    float r = length(p - c);
    vec3 sun = mix(vec3(1.0, 0.25, 0.65), vec3(1.0, 0.85, 0.3), smoothstep(-0.12, 0.3, p.y - c.y + 0.1));
    float stripes = p.y < c.y ? 1.0 - step(fract((c.y - p.y) * 18.0 - t*0.35), (c.y - p.y) * 2.4) : 1.0;
    col = mix(col, sun, smoothstep(0.30, 0.295, r) * stripes);
    col += vec3(1.0, 0.25, 0.6) * exp(-max(r - 0.28, 0.0) * 9.0) * 0.35;
    float m = h + 0.05 + 0.16*noise(vec2(p.x*3.2 + 10.0, 0.0)) + 0.05*noise(vec2(p.x*11.0, 1.0));
    m *= smoothstep(0.0, 0.5, abs(p.x)) * 0.9 + 0.1;
    if (p.y < m) {
      col = vec3(0.04, 0.0, 0.08);
      col += vec3(0.7, 0.2, 1.0) * smoothstep(0.012, 0.0, m - p.y) * 0.9;
    }
  } else {
    float z = 0.35 / (h - p.y + 0.001);
    float x = p.x * z;
    float gx = abs(fract(x * 1.2) - 0.5);
    float gz = abs(fract(z * 0.6 - t * 1.2 * uSpeed) - 0.5);
    float w = 0.035 + z*0.004;
    float line = max(smoothstep(0.5 - w, 0.5, gx), smoothstep(0.5 - w*1.4, 0.5, gz));
    vec3 neon = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.2, 0.8), smoothstep(-0.6, 0.6, p.x));
    col = vec3(0.02, 0.0, 0.05) + neon * line * exp(-z * 0.06) * 1.2;
    col += vec3(0.6, 0.1, 0.6) * exp(-(h - p.y) * 18.0) * 0.6;
  }
  return col;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float t = uTime;
  vec3 col = mix(vec3(0.025, 0.018, 0.06), vec3(0.008, 0.006, 0.02), uv.y);
  float s = hash(floor(gl_FragCoord.xy / 2.5));
  col += step(0.9968, s) * (0.5 + 0.5*sin(t*1.5 + s*80.0)) * vec3(0.85, 0.85, 1.0) * (1.0 - uS);
  if (uA > 0.002) col += aurora(p, uv, t) * uA;
  if (uL > 0.002) col = mix(col, liquid(p, t), uL);
  if (uS > 0.002) col = mix(col, synth(p, t), uS);
  col *= uBright;
  col *= 1.0 - 0.45*length(uv - 0.5);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createWorld(canvas, { mobile }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x050409, 1);
  renderer.outputColorSpace = LinearSRGBColorSpace; // shader colours are authored in display space

  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  /* ---- full-screen background ---- */
  const bgU = {
    uTime: { value: 0 }, uRes: { value: new Vector2() }, uMouse: { value: new Vector2() },
    uA: { value: 0 }, uL: { value: 0 }, uS: { value: 0 }, uBright: { value: 1 }, uSpeed: { value: 1 },
  };
  const bgMat = new ShaderMaterial({
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: BG_FRAG, uniforms: bgU, defines: { OCTAVES: mobile ? 4 : 6 },
    depthWrite: false, depthTest: false,
  });
  const bg = new Mesh(new PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  /* ---- galaxy ---- */
  const galaxy = new Group();
  scene.add(galaxy);
  const gCount = mobile ? 26000 : 60000;
  const gPos = new Float32Array(gCount * 3), gCol = new Float32Array(gCount * 3), gSize = new Float32Array(gCount);
  const cIn = new Color('#ffd9a8'), cMid = new Color('#b388ff'), cOut = new Color('#36d6ff'), cLime = new Color('#d4ff3a'), tmp = new Color();
  for (let i = 0; i < gCount; i++) {
    const r = Math.pow(Math.random(), 1.6) * 6;
    const branch = (i % 4) / 4 * Math.PI * 2;
    const spin = r * 0.9;
    const rnd = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (0.15 + r * 0.12);
    gPos[i * 3] = Math.cos(branch + spin) * r + rnd();
    gPos[i * 3 + 1] = rnd() * 0.6;
    gPos[i * 3 + 2] = Math.sin(branch + spin) * r + rnd();
    const k = r / 6;
    tmp.copy(cIn).lerp(k < 0.5 ? cMid : cOut, k < 0.5 ? k * 2 : (k - 0.5) * 2);
    if (Math.random() < 0.04) tmp.copy(cLime);
    gCol[i * 3] = tmp.r; gCol[i * 3 + 1] = tmp.g; gCol[i * 3 + 2] = tmp.b;
    gSize[i] = Math.random();
  }
  const gGeo = new BufferGeometry();
  gGeo.setAttribute('position', new BufferAttribute(gPos, 3));
  gGeo.setAttribute('aColor', new BufferAttribute(gCol, 3));
  gGeo.setAttribute('aSize', new BufferAttribute(gSize, 1));
  const gMat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: dpr }, uOpacity: { value: 1 }, uIntro: { value: 0 } },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uPR; uniform float uIntro;
      attribute float aSize; attribute vec3 aColor; varying vec3 vC;
      void main(){
        vec3 p = position;
        float r = length(p.xz);
        float a = atan(p.z, p.x) + uTime * (0.6 / (r + 0.6)) * 0.35 - (1.0 - uIntro) * 3.0 / (r + 0.5);
        p.xz = vec2(cos(a), sin(a)) * r * (0.3 + 0.7 * uIntro);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + aSize * 6.0) * uPR * (3.0 / -mv.z);
        vC = aColor;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec3 vC;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0) * uOpacity;
        gl_FragColor = vec4(vC * a, a);
      }`,
  });
  const gPoints = new Points(gGeo, gMat);
  gPoints.frustumCulled = false;
  galaxy.add(gPoints);
  // bright core
  const coreMat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uOpacity: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uOpacity; varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 3.0);
        vec3 c = mix(vec3(0.6, 0.4, 1.0), vec3(1.0, 0.88, 0.7), pow(max(0.0, 1.0 - d), 6.0));
        gl_FragColor = vec4(c * a * uOpacity, a * uOpacity); }`,
  });
  const core = new Mesh(new PlaneGeometry(5, 5), coreMat);
  core.frustumCulled = false;
  scene.add(core);

  /* ---- wave field ---- */
  const nx = mobile ? 120 : 200, nz = mobile ? 80 : 130;
  const wPos = new Float32Array(nx * nz * 3);
  let k = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    wPos[k++] = (i / (nx - 1) - 0.5) * 44; wPos[k++] = 0; wPos[k++] = -(j / (nz - 1)) * 44 + 7;
  }
  const wGeo = new BufferGeometry();
  wGeo.setAttribute('position', new BufferAttribute(wPos, 3));
  const wMat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: dpr }, uMouse: { value: new Vector2() }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uPR; uniform vec2 uMouse; varying float vH; varying float vD;
      void main(){
        vec3 p = position;
        float t = uTime;
        float h = sin(p.x*0.35 + t*0.9) * 0.6 + sin(p.z*0.28 + t*0.7) * 0.7 + sin((p.x + p.z)*0.18 - t*0.5) * 0.9;
        h += sin(length(p.xz - vec2(uMouse.x*10.0, -8.0 + uMouse.y*6.0)) * 0.9 - t*2.5) * 0.35;
        p.y = h - 3.2;
        vH = h;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPR * (2.2 + (h + 2.0) * 0.8) * (14.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying float vH; varying float vD;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.1, 0.5, d);
        vec3 c = mix(vec3(0.2, 0.3, 1.0), vec3(0.1, 0.95, 1.0), smoothstep(-1.5, 0.5, vH));
        c = mix(c, vec3(0.85, 1.0, 0.3), smoothstep(1.0, 2.0, vH));
        float fade = exp(-vD * 0.06) * uOpacity;
        gl_FragColor = vec4(c * a * fade, a * fade);
      }`,
  });
  const waves = new Points(wGeo, wMat);
  waves.frustumCulled = false;
  scene.add(waves);

  /* ---- post ---- */
  let composer = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.65, 0.6, 0.55));
    composer.addPass(new OutputPass());
  }

  /* ---- state ---- */
  let width = 0, height = 0, narrow = false;
  let morphTarget = 0, morph = 0;
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  let velocity = 0, speed = 1;
  let raf = 0, running = false, last = performance.now(), time = 0;
  const introState = { value: 0 };
  const mix = new Array(6).fill(0), gal = new Array(4).fill(0);

  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    narrow = width < 860;
    renderer.setSize(width, height, false);
    if (composer) composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    bgU.uRes.value.set(width * dpr, height * dpr);
  }

  function lerpRows(rows, m, out) {
    const i = Math.min(Math.floor(m), rows.length - 1), j = Math.min(i + 1, rows.length - 1);
    const f = MathUtils.smootherstep(m - i, 0, 1);
    for (let c = 0; c < out.length; c++) out[c] = rows[i][c] + (rows[j][c] - rows[i][c]) * f;
    return out;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; time += dt;

    morph += (morphTarget - morph) * Math.min(1, dt * 2.4);
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    velocity *= 0.9;
    speed += (1 + Math.min(Math.abs(velocity), 3) * 1.5 - speed) * Math.min(1, dt * 3);

    lerpRows(MIX, morph, mix);
    lerpRows(narrow ? GAL_NARROW : GAL_WIDE, morph, gal);
    const intro = introState.value;
    const ease = 1 - Math.pow(1 - intro, 3);

    bgU.uTime.value = time;
    bgU.uMouse.value.set(pointer.x, pointer.y);
    bgU.uA.value = mix[0];
    bgU.uL.value = mix[1];
    bgU.uS.value = mix[2];
    bgU.uBright.value = mix[5] * (0.25 + 0.75 * ease);
    bgU.uSpeed.value = speed;

    galaxy.visible = mix[3] > 0.01;
    galaxy.position.set(gal[0], gal[1], gal[2]);
    galaxy.scale.setScalar(gal[3]);
    galaxy.rotation.set(1.05 + pointer.y * 0.25, 0, 0.35 + pointer.x * 0.2);
    gMat.uniforms.uTime.value = time * speed;
    gMat.uniforms.uOpacity.value = mix[3] * ease;
    gMat.uniforms.uIntro.value = ease;
    coreMat.uniforms.uOpacity.value = mix[3] * ease * 0.8;
    core.visible = galaxy.visible;
    core.position.copy(galaxy.position);
    core.scale.setScalar(gal[3] * 0.9);

    waves.visible = mix[4] > 0.01;
    wMat.uniforms.uTime.value = time * (0.6 + speed * 0.4);
    wMat.uniforms.uMouse.value.set(pointer.x, pointer.y);
    wMat.uniforms.uOpacity.value = mix[4];

    camera.position.x = pointer.x * 0.3;
    camera.position.y = pointer.y * 0.2;
    camera.lookAt(0, -mix[4] * 0.9, -6);

    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const onVis = () => (document.hidden ? stop() : start());
  let lostHandler = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); lostHandler && lostHandler(); });

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);

  return {
    start,
    setMorph(v) { morphTarget = MathUtils.clamp(v, 0, 6); },
    setVelocity(v) { velocity = v; },
    setPointer(x, y) { pointer.tx = x; pointer.ty = y; },
    clearPointer() { pointer.tx = 0; pointer.ty = 0; },
    intro: introState,
    onContextLost(fn) { lostHandler = fn; },
    dispose() {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      [bg, gPoints, core, waves].forEach((o) => { o.geometry.dispose(); o.material.dispose(); });
      if (composer) composer.dispose();
      renderer.dispose();
    },
  };
}
