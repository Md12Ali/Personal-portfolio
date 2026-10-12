import './style.css';
import 'iconify-icon';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createWorld } from './scene.js';
import { initProjects } from './projects.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
root.classList.remove('no-js');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
if (reduce) root.classList.add('reduce');
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------- Text splitting (accessible) ---------------- */
function splitWords(el, cls = '') {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(' ').map((w) =>
    cls ? `<span class="${cls}" aria-hidden="true">${w}</span>`
        : `<span class="split-word" aria-hidden="true"><span>${w}</span></span>`).join(' ');
}
const heroOriginals = new Map();
function splitChars(el) {
  heroOriginals.set(el, el.innerHTML);
  const em = el.querySelector('em');
  const tail = em ? em.outerHTML : '';
  const text = el.childNodes[0].textContent;
  el.innerHTML = [...text].map((c) => `<span class="hero__char" aria-hidden="true">${c}</span>`).join('') +
    (tail ? `<span class="hero__char" aria-hidden="true">${tail}</span>` : '');
}
document.querySelectorAll('[data-split]').forEach((el) => splitWords(el));
document.querySelectorAll('[data-reveal-words]').forEach((el) => splitWords(el, 'rw'));
document.querySelectorAll('.hero__word').forEach(splitChars);

/* ---------------- Smooth scroll (Lenis — the only engine) ---------------- */
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

/* anchors */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#top' ? 0 : document.querySelector(id);
  if (target === null) return;
  e.preventDefault();
  closeMenu();
  if (lenis) lenis.scrollTo(target, { duration: 1.6, offset: 0 });
  else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + scrollY, behavior: reduce ? 'auto' : 'smooth' });
  if (target && target.focus) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
});

/* ---------------- Mobile menu ---------------- */
const burger = document.querySelector('.nav__burger');
const menu = document.getElementById('menu');
function closeMenu() {
  if (menu.hidden) return;
  menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
  lenis && lenis.start();
}
burger.addEventListener('click', () => {
  const open = menu.hidden;
  if (!open) return closeMenu();
  menu.hidden = false; burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
  lenis && lenis.stop();
  if (!reduce) gsap.from('.menu a', { yPercent: 100, opacity: 0, stagger: 0.06, duration: 0.7, ease: 'expo.out' });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ---------------- Nav state ---------------- */
const nav = document.querySelector('.nav');
let lastY = 0;
function onScrollNav(y) {
  nav.classList.toggle('is-scrolled', y > 40);
  nav.classList.toggle('is-hidden', y > lastY && y > 400 && menu.hidden);
  lastY = y;
}
const navLinks = [...document.querySelectorAll('.nav__links a')];
navLinks.forEach((a) => {
  const sec = document.querySelector(a.getAttribute('href'));
  if (!sec) return;
  ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
});

/* ---------------- 3D world ---------------- */
const worldEl = document.querySelector('.world');
let world = null;
if (!reduce) {
  const mobile = window.innerWidth < 860 || !finePointer;
  world = createWorld(document.querySelector('.world__canvas'), { mobile });
  if (world) world.onContextLost(() => worldEl.classList.remove('is-live'));
}

const shapeSections = [...document.querySelectorAll('[data-shape]')];
let shapeTops = [];
function measureShapes() {
  shapeTops = shapeSections.map((s) => s.getBoundingClientRect().top + window.scrollY);
}
function morphForScroll(y) {
  const probe = y + window.innerHeight * 0.55;
  const n = shapeTops.length;
  for (let i = n - 1; i >= 0; i--) {
    if (probe >= shapeTops[i]) {
      if (i === n - 1) return i;
      const span = shapeTops[i + 1] - shapeTops[i];
      const t = (probe - shapeTops[i]) / span;
      return i + gsap.utils.clamp(0, 1, (t - 0.55) / 0.45);
    }
  }
  return 0;
}
ScrollTrigger.addEventListener('refresh', measureShapes);

const progressBar = document.querySelector('.progress span');
const totop = document.querySelector('.totop');
const totopBar = document.querySelector('.totop__bar');
function onScroll() {
  const y = window.scrollY;
  onScrollNav(y);
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const p = Math.min(1, y / max);
  progressBar.style.transform = `scaleX(${p})`;
  totopBar.style.strokeDashoffset = String(138.2 * (1 - p));
  totop.classList.toggle('is-visible', y > window.innerHeight * 0.8);
  if (world) {
    world.setMorph(morphForScroll(y));
    if (lenis) world.setVelocity(lenis.velocity / 30);
  }
}
if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });

/* pointer → world */
if (world && finePointer) {
  let pending = false, px = 0, py = 0;
  window.addEventListener('pointermove', (e) => {
    px = (e.clientX / innerWidth) * 2 - 1; py = -(e.clientY / innerHeight) * 2 + 1;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; world.setPointer(px, py); });
  }, { passive: true });
  document.addEventListener('pointerleave', () => world.clearPointer());
}

/* ---------------- Cursor ---------------- */
if (finePointer && !reduce) {
  root.classList.add('has-cursor');
  const cursor = document.querySelector('.cursor');
  const dot = cursor.querySelector('.cursor__dot');
  const ring = cursor.querySelector('.cursor__ring');
  const label = cursor.querySelector('.cursor__label');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.1 }), dy = gsap.quickTo(dot, 'y', { duration: 0.1 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor], a, button');
    cursor.classList.toggle('is-hover', !!(t && t.dataset.cursor));
    cursor.classList.toggle('is-link', !!(t && !t.dataset.cursor));
    label.textContent = t && t.dataset.cursor ? t.dataset.cursor : '';
  });
  document.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.2 }));
  document.addEventListener('pointerenter', () => gsap.to(cursor, { opacity: 1, duration: 0.2 }));
}

/* ---------------- Magnetic + tilt + spotlight ---------------- */
if (finePointer && !reduce) {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      xTo((e.clientX - b.left - b.width / 2) * 0.3); yTo((e.clientY - b.top - b.height / 2) * 0.3);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const rX = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
    const rY = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      rY((x - 0.5) * 12); rX((0.5 - y) * 12);
    });
    el.addEventListener('pointerleave', () => { rX(0); rY(0); });
  });
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.feat, .layer');
    if (!card) return;
    const b = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - b.left}px`);
    card.style.setProperty('--my', `${e.clientY - b.top}px`);
  }, { passive: true });
}

/* ---------------- Text scramble ---------------- */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>';
function scramble(el, duration = 900) {
  if (reduce || el.dataset.scrambling) return;
  const final = el.dataset.final || (el.dataset.final = el.textContent);
  el.dataset.scrambling = '1';
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const reveal = Math.floor(t * final.length);
    let out = '';
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      if (i < reveal || ch === ' ' || ch === '·') out += ch;
      else out += `<span class="scr">${GLYPHS[(Math.random() * GLYPHS.length) | 0]}</span>`;
    }
    el.innerHTML = out;
    if (t < 1) requestAnimationFrame(step);
    else { el.textContent = final; delete el.dataset.scrambling; }
  };
  requestAnimationFrame(step);
}

/* ---------------- Copy email ---------------- */
document.querySelectorAll('.copy-email').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const hint = btn.querySelector('.copy-email__hint');
    try {
      await navigator.clipboard.writeText(btn.dataset.email);
      hint.textContent = 'Copied ✓';
    } catch (e) {
      window.location.href = `mailto:${btn.dataset.email}`;
      hint.textContent = 'Opening mail…';
    }
    btn.classList.add('is-done');
    setTimeout(() => { hint.textContent = 'Click to copy'; btn.classList.remove('is-done'); }, 2200);
  });
});

/* ---------------- 3D name tilt ---------------- */
if (finePointer && !reduce) {
  const title = document.querySelector('.hero__title');
  const tX = gsap.quickTo(title, 'rotationY', { duration: 1.2, ease: 'power3' });
  const tY = gsap.quickTo(title, 'rotationX', { duration: 1.2, ease: 'power3' });
  gsap.set(title, { transformPerspective: 900 });
  window.addEventListener('pointermove', (e) => {
    if (window.scrollY > window.innerHeight) return;
    tX((e.clientX / innerWidth - 0.5) * 16);
    tY(-(e.clientY / innerHeight - 0.5) * 12);
  }, { passive: true });
}

/* ---------------- Scroll choreography ---------------- */
function setupScroll() {
  if (reduce) return;

  // headings: word by word
  document.querySelectorAll('[data-split]').forEach((el) => {
    gsap.from(el.querySelectorAll('.split-word > span'), {
      yPercent: 110, rotate: 4, duration: 1.1, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  gsap.utils.toArray('.section .eyebrow, .process .eyebrow').forEach((el) => {
    const label = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (label) { const span = document.createElement('span'); span.textContent = label.textContent; label.replaceWith(span); }
    const target = el.lastElementChild;
    gsap.from(el, { opacity: 0, x: -20, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', onEnter: () => target && scramble(target, 700) } });
  });

  // about manifesto lights up as you read
  gsap.to('.about__text .rw', {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: '.about__text', start: 'top 75%', end: 'bottom 45%', scrub: true },
  });
  gsap.from('.about__cell', { y: 40, opacity: 0, stagger: 0.12, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.about__grid', start: 'top 85%' } });

  gsap.from('.service', {
    y: 60, opacity: 0, duration: 1, stagger: 0.08, ease: 'expo.out',
    scrollTrigger: { trigger: '.services__list', start: 'top 80%' },
  });

  gsap.from('.layer', {
    y: 80, opacity: 0, rotationX: -18, duration: 1.2, stagger: 0.1, ease: 'expo.out', transformPerspective: 1000,
    scrollTrigger: { trigger: '.stack__grid', start: 'top 80%' },
  });

  gsap.from('.feat', {
    y: 100, opacity: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.featured', start: 'top 80%' },
  });

  gsap.from('.contact__lede, .contact__ctas > *', {
    y: 40, opacity: 0, stagger: 0.12, duration: 1, ease: 'expo.out',
    scrollTrigger: { trigger: '.contact__lede', start: 'top 85%' },
  });

  // hero parallax out
  gsap.to('.hero__title', { yPercent: -18, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // process: pinned horizontal track on wide screens
  const mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', () => {
    const track = document.querySelector('.process__track');
    const pin = document.querySelector('.process__pin');
    const intro = document.querySelector('.process__intro');
    const distance = () => {
      const cs = getComputedStyle(pin);
      const used = parseFloat(cs.paddingLeft) + intro.offsetWidth + parseFloat(cs.columnGap || 0) + track.scrollWidth + parseFloat(cs.paddingRight);
      return Math.max(0, used - pin.clientWidth);
    };
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '.process', start: 'top top', end: () => `+=${distance() + window.innerHeight * 0.3}`, pin: pin, scrub: 1, invalidateOnRefresh: true },
    });
    tl.to(track, { x: () => -distance(), ease: 'none' }, 0)
      .to('.process__progress span', { scaleX: 1, ease: 'none' }, 0);
  });
  mm.add('(max-width: 860px)', () => {
    gsap.utils.toArray('.step').forEach((s) => gsap.from(s, { y: 60, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 88%' } }));
  });
}

function revealRepos(grid) {
  ScrollTrigger.refresh();
  if (reduce) return;
  gsap.from(grid.children, { y: 40, opacity: 0, stagger: 0.04, duration: 0.8, ease: 'expo.out', clearProps: 'transform,opacity' });
}

/* ---------------- Loader + hero intro ---------------- */
function heroIntro() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.hero__char', { yPercent: 115, rotate: 6, duration: 1.4, stagger: 0.035 })
    .from('.hero__eyebrow', { opacity: 0, x: -24, duration: 1 }, 0.3)
    .from('.hero__lede', { opacity: 0, y: 24, duration: 1.1 }, 0.5)
    .from('.hero__ctas > *', { opacity: 0, y: 24, stagger: 0.08, duration: 1.1 }, 0.6)
    .from('.hero__roles', { opacity: 0, y: 16, duration: 1 }, 0.45)
    .from('.hero__scroll', { opacity: 0, duration: 1 }, 0.9)
    .from('.nav', { yPercent: -100, opacity: 0, duration: 1.1 }, 0.2)
    .add(() => {
      heroOriginals.forEach((html, el) => { el.innerHTML = html; });
      document.querySelector('.hero__title').classList.add('is-shine');
    });
  const eyebrowText = document.querySelector('.hero__eyebrow [data-scramble]');
  if (eyebrowText) setTimeout(() => scramble(eyebrowText, 1100), 350);
  if (world) {
    worldEl.classList.add('is-live');
    world.start();
    gsap.to(world.intro, { value: 1, duration: 3.2, ease: 'power2.out' });
  }
}

async function boot() {
  const loader = document.querySelector('.loader');
  const num = loader.querySelector('.loader__num');
  if (reduce) {
    heroOriginals.forEach((html, el) => { el.innerHTML = html; });
    loader.remove();
    document.body.classList.remove('is-loading');
  } else {
    document.body.classList.add('is-loading');
    const counter = { v: 0 };
    const fonts = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
    await Promise.all([
      gsap.to(counter, { v: 100, duration: 1.5, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(counter.v); } }),
      gsap.to('.loader__bar span', { scaleX: 1, duration: 1.5, ease: 'power2.inOut' }),
      fonts,
    ]);
    await gsap.to(loader, { yPercent: -100, duration: 1, ease: 'expo.inOut' });
    loader.remove();
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
  }
  setupScroll();
  if (!reduce) heroIntro();
  measureShapes();
  ScrollTrigger.refresh();
  onScroll();
}

boot();
initProjects({ onRender: revealRepos });
window.addEventListener('load', () => ScrollTrigger.refresh());

if (!world) worldEl.classList.remove('is-live');
