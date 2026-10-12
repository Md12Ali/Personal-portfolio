/**
 * The particle world.
 * One Points mesh carries seven baked formations (one per section).
 * Scroll drives a continuous `uMorph` value (0 → 6); the vertex shader
 * blends formation by formation and "dissolves" particles mid-transition.
 * Pointer pushes particles away in screen space.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  ShaderMaterial, Points, AdditiveBlending, Color, MathUtils, Group,
} from 'three';

const TAU = Math.PI * 2;

/* ---------- formations ---------- */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const shapes = [
  // 0 — sphere: the "seed" of everything
  (i, n, r) => {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.399963229728653;
    const R = 2.1 * (r() < 0.82 ? 1 : 0.4 + r() * 0.6);
    return [Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R];
  },
  // 1 — torus knot: one continuous system
  (i, n, r) => {
    const t = (i / n) * TAU, p = 2, q = 3;
    const R = 1.55, tube = 0.28 + r() * 0.12;
    const cx = (R + 0.6 * Math.cos(q * t)) * Math.cos(p * t);
    const cy = (R + 0.6 * Math.cos(q * t)) * Math.sin(p * t);
    const cz = 0.6 * Math.sin(q * t);
    const a = r() * TAU, b = r() * TAU;
    return [cx + Math.cos(a) * Math.sin(b) * tube, cy + Math.sin(a) * Math.sin(b) * tube, cz + Math.cos(b) * tube];
  },
  // 2 — double helix: the strands of a build
  (i, n, r) => {
    const t = (i / n) * TAU * 3.2 - TAU * 1.6;
    const y = (i / n) * 6 - 3;
    const kind = r();
    if (kind < 0.18) { // rungs
      const k = Math.round((y + 3) * 3) / 3 - 3, f = r() * 2 - 1;
      const tt = ((k + 3) / 6) * TAU * 3.2 - TAU * 1.6;
      return [Math.cos(tt) * f * 1.1, k, Math.sin(tt) * f * 1.1];
    }
    const side = kind < 0.59 ? 0 : Math.PI;
    const j = 0.09;
    return [Math.cos(t + side) * 1.1 + (r() - .5) * j, y + (r() - .5) * j, Math.sin(t + side) * 1.1 + (r() - .5) * j];
  },
  // 3 — stacked layers: front / server / data / growth
  (i, n, r) => {
    const layer = i % 4;
    const y = layer * 0.85 - 1.275;
    const edge = r() < 0.35;
    let x = (r() * 2 - 1) * 1.7, z = (r() * 2 - 1) * 1.7;
    if (edge) { if (r() < .5) x = Math.sign(x) * 1.7; else z = Math.sign(z) * 1.7; }
    return [x, y + (r() - .5) * 0.03, z];
  },
  // 4 — spiral galaxy: a body of work
  (i, n, r) => {
    const arms = 3, arm = i % arms;
    const d = Math.pow(r(), 0.8) * 3.4;
    const a = (arm / arms) * TAU + d * 1.25;
    const s = Math.pow(r(), 3) * (0.55 - d * 0.08) * (r() < .5 ? 1 : -1);
    return [Math.cos(a) * d + s, (r() - .5) * 0.22 * (1.2 - d / 3.4), Math.sin(a) * d + s * 0.6];
  },
  // 5 — möbius ribbon: a continuous process
  (i, n, r) => {
    const u = (i / n) * TAU, v = (r() * 2 - 1) * 0.55;
    const R = 2;
    return [(R + v * Math.cos(u / 2)) * Math.cos(u), v * Math.sin(u / 2), (R + v * Math.cos(u / 2)) * Math.sin(u)];
  },
  // 6 — ring-sphere: the invitation
  (i, n, r) => {
    if (i % 3 === 0) {
      const a = r() * TAU, d = 2.7 + r() * 0.9;
      return [Math.cos(a) * d, (r() - .5) * 0.05, Math.sin(a) * d];
    }
    const u = r() * 2 - 1, a = r() * TAU, R = 1.55;
    const s = Math.sqrt(1 - u * u);
    return [Math.cos(a) * s * R, u * R, Math.sin(a) * s * R];
  },
];

/* Per-formation framing: [x, y, z, scale, opacity] for wide and narrow screens */
const FRAMING_WIDE = [
  [2.35, 0.55, 0, 1.0, 1.0],
  [2.7, 0.0, 0, 0.95, 0.85],
  [3.4, 0.0, -0.5, 1.0, 0.55],
  [3.0, -0.2, -0.5, 0.95, 0.6],
  [0.0, -0.4, -2.5, 1.35, 0.5],
  [2.6, 0.0, -0.5, 1.1, 0.65],
  [2.6, 0.2, 0, 1.15, 0.95],
];
const FRAMING_NARROW = [
  [0.0, 1.35, -1.2, 0.85, 0.9],
  [0.0, 0.8, -2.0, 0.8, 0.55],
  [0.0, 0.0, -2.5, 0.9, 0.4],
  [0.0, 0.0, -2.5, 0.9, 0.4],
  [0.0, 0.0, -3.0, 1.2, 0.4],
  [0.0, 0.0, -2.5, 1.0, 0.45],
  [0.0, 1.3, -1.5, 0.95, 0.75],
];

const vertex = /* glsl */`
  uniform float uTime;
  uniform float uMorph;
  uniform float uIntro;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uVelocity;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  uniform float uAspect;
  attribute vec3 aS1; attribute vec3 aS2; attribute vec3 aS3;
  attribute vec3 aS4; attribute vec3 aS5; attribute vec3 aS6;
  attribute vec4 aRand;
  varying vec3 vColor;
  varying float vAlpha;

  uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC;

  void main() {
    float m = uMorph;
    vec3 p = position;
    p = mix(p, aS1, smoothstep(0., 1., clamp(m - 0., 0., 1.)));
    p = mix(p, aS2, smoothstep(0., 1., clamp(m - 1., 0., 1.)));
    p = mix(p, aS3, smoothstep(0., 1., clamp(m - 2., 0., 1.)));
    p = mix(p, aS4, smoothstep(0., 1., clamp(m - 3., 0., 1.)));
    p = mix(p, aS5, smoothstep(0., 1., clamp(m - 4., 0., 1.)));
    p = mix(p, aS6, smoothstep(0., 1., clamp(m - 5., 0., 1.)));

    // dissolve between formations
    float between = sin(fract(m) * 3.14159);
    vec3 dir = normalize(aRand.xyz - 0.5 + 1e-4);
    p += dir * (between * 0.9 * aRand.w + uVelocity * 0.35 * aRand.x);

    // living drift
    float t = uTime * 0.35;
    p += vec3(
      sin(t + p.y * 1.7 + aRand.x * 6.28),
      cos(t * 0.8 + p.z * 1.3 + aRand.y * 6.28),
      sin(t * 0.7 + p.x * 1.5 + aRand.z * 6.28)
    ) * 0.045;

    // intro: particles condense from a wide cloud
    p = mix(dir * (8.0 + aRand.w * 6.0), p, smoothstep(0., 1., clamp(uIntro * 1.4 - aRand.w * 0.4, 0., 1.)));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = (ndc - uMouse) * vec2(uAspect, 1.0);
    float dist = length(d);
    float push = (1.0 - smoothstep(0.0, 0.38, dist)) * uMouseStrength;
    mv.xy += normalize(d + 1e-5) * push * 0.55 * (-mv.z / 7.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.35 + aRand.w * 0.9) * (1.0 + push * 1.5);
    gl_PointSize = size * uPixelRatio * (7.0 / -mv.z);

    float h = aRand.y;
    vec3 col = mix(uColA, uColB, smoothstep(0.2, 0.9, h + p.y * 0.08));
    col = mix(col, uColC, step(0.93, aRand.z));          // sparse lime sparks
    col += push * vec3(0.5, 0.6, 0.2);
    vColor = col;
    vAlpha = (0.35 + aRand.x * 0.65) * smoothstep(-14.0, -3.5, mv.z);
  }
`;

const fragment = /* glsl */`
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = 1.0 - smoothstep(0.0, 0.5, d);
    a = pow(a, 1.6);
    gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

export function createWorld(canvas, { count }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  /* geometry */
  const geo = new BufferGeometry();
  const r = rng(1337);
  const names = ['position', 'aS1', 'aS2', 'aS3', 'aS4', 'aS5', 'aS6'];
  shapes.forEach((fn, s) => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const [x, y, z] = fn(i, count, r);
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    }
    geo.setAttribute(names[s], new BufferAttribute(arr, 3));
  });
  const rand = new Float32Array(count * 4);
  for (let i = 0; i < rand.length; i++) rand[i] = r();
  geo.setAttribute('aRand', new BufferAttribute(rand, 4));

  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uIntro: { value: 0 },
    uPixelRatio: { value: dpr },
    uSize: { value: count > 12000 ? 5.2 : 6.2 },
    uVelocity: { value: 0 },
    uMouse: { value: [9, 9] },
    uMouseStrength: { value: 0 },
    uAspect: { value: 1 },
    uOpacity: { value: 1 },
    uColA: { value: new Color('#6d4dff') },
    uColB: { value: new Color('#e9e6ff') },
    uColC: { value: new Color('#d4ff3a') },
  };
  const mat = new ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  const group = new Group();
  group.add(points);
  scene.add(group);

  /* state */
  let width = 0, height = 0, narrow = false;
  let morphTarget = 0, morph = 0;
  let mouseTarget = [9, 9], mouse = [9, 9], mouseOn = 0, mouseStrength = 0;
  let velocity = 0;
  let raf = 0, running = false, last = performance.now(), time = 0;
  const frame = [0, 0, 0, 1, 1];

  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    narrow = width < 860;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;
  }

  function framingAt(m) {
    const F = narrow ? FRAMING_NARROW : FRAMING_WIDE;
    const i = Math.min(Math.floor(m), F.length - 1);
    const j = Math.min(i + 1, F.length - 1);
    const f = MathUtils.smootherstep(m - i, 0, 1);
    for (let k = 0; k < 5; k++) frame[k] = F[i][k] + (F[j][k] - F[i][k]) * f;
    return frame;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    morph += (morphTarget - morph) * Math.min(1, dt * 3.2);
    mouse[0] += (mouseTarget[0] - mouse[0]) * Math.min(1, dt * 8);
    mouse[1] += (mouseTarget[1] - mouse[1]) * Math.min(1, dt * 8);
    mouseStrength += (mouseOn - mouseStrength) * Math.min(1, dt * 4);
    velocity *= 0.92;

    const f = framingAt(morph);
    group.position.set(f[0] + mouse[0] * 0.12 * mouseStrength, f[1] + mouse[1] * 0.08 * mouseStrength, f[2]);
    group.scale.setScalar(f[3]);
    group.rotation.y = time * 0.08 + morph * 0.9;
    group.rotation.x = 0.35 * Math.sin(morph * 1.3) + 0.15 + 0.35 * Math.exp(-(morph - 3) * (morph - 3) * 4);
    group.rotation.z = Math.sin(time * 0.1) * 0.05;

    uniforms.uTime.value = time;
    uniforms.uMorph.value = morph;
    uniforms.uVelocity.value = Math.min(Math.abs(velocity), 2.5);
    uniforms.uMouse.value = mouse;
    uniforms.uMouseStrength.value = mouseStrength;
    uniforms.uOpacity.value = f[4];
    renderer.render(scene, camera);
  }

  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  const onVis = () => (document.hidden ? stop() : start());
  const onBlur = () => { mouseOn = 0; };
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
    setPointer(x, y) { mouseTarget = [x, y]; mouseOn = 1; },
    clearPointer() { mouseOn = 0; },
    intro: uniforms.uIntro,
    onContextLost(fn) { lostHandler = fn; },
    dispose() {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      geo.dispose(); mat.dispose(); renderer.dispose();
    },
  };
}
