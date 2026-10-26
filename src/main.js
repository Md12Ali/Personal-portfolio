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
root.classList.add('js');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const mobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
if (reduce) root.classList.add('reduce');
document.getElementById('year').textContent = String(new Date().getFullYear());

/* ---------------- Accessible text splitting ---------------- */
// The element keeps its full text as an aria-label; the visual pieces are aria-hidden.
function splitWords(el, mode = 'mask') {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(' ').map((w) => (mode === 'mask'
    ? `<span class="w" aria-hidden="true"><span class="w__i">${w}</span></span>`
    : `<span class="fw" aria-hidden="true">${w}</span>`)).join(' ');
}
function splitChars(el) {
  const text = el.textContent;
  el.innerHTML = [...text].map((c) => `<span class="ch" aria-hidden="true">${c}</span>`).join('');
}
document.querySelectorAll('[data-split]').forEach((el) => splitWords(el, 'mask'));
document.querySelectorAll('[data-fill]').forEach((el) => splitWords(el, 'fill'));
document.querySelectorAll('.hero__word').forEach(splitChars);

/* ---------------- Smooth scroll: Lenis is the only engine ---------------- */
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.5 });
  else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY, behavior: reduce ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#top' ? 0 : document.querySelector(id);
  if (target === null) return;
  e.preventDefault();
  closeMenu();
  scrollToTarget(target);
  const focusEl = target === 0 ? document.getElementById('top') : target;
  focusEl.setAttribute('tabindex', '-1');
  focusEl.focus({ preventScroll: true });
});

/* ---------------- Navigation ---------------- */
const nav = document.querySelector('.nav');
const burger = document.querySelector('.nav__burger');
const menu = document.getElementById('menu');
function closeMenu() {
  if (menu.hidden) return;
  menu.hidden = true;
  root.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Open menu');
  lenis && lenis.start();
}
burger.addEventListener('click', () => {
  if (!menu.hidden) { closeMenu(); return; }
  menu.hidden = false;
  root.classList.add('menu-open');
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Close menu');
  lenis && lenis.stop();
  if (!reduce) gsap.from('.menu nav a', { yPercent: 110, opacity: 0, stagger: 0.05, duration: 0.7, ease: 'expo.out' });
  menu.querySelector('a').focus();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); burger.focus(); } });
window.matchMedia('(min-width: 821px)').addEventListener('change', (m) => m.matches && closeMenu());

let lastY = 0;
function onScrollNav(y) {
  nav.classList.toggle('nav--solid', y > 40);
  const hide = y > lastY && y > window.innerHeight * 0.6 && !root.classList.contains('menu-open');
  nav.classList.toggle('nav--hidden', hide);
  lastY = y;
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScrollNav(scroll));
else window.addEventListener('scroll', () => onScrollNav(window.scrollY), { passive: true });
nav.addEventListener('focusin', () => nav.classList.remove('nav--hidden'));

/* ---------------- 3D world ---------------- */
let world = null;
function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) { return false; }
}
if (!reduce && supportsWebGL()) {
  try {
    const canvas = document.querySelector('.stage__canvas');
    world = createWorld(canvas, { mobile });
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      world && world.stop();
      root.classList.remove('webgl');
    });
    root.classList.add('webgl');
  } catch (err) {
    world = null;
  }
}

if (world) {
  // each section steers the sculpture; progress lets poses blend into the next one
  document.querySelectorAll('[data-scene]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 55%',
      end: 'bottom 55%',
      onUpdate: (self) => world.setSection(sec.dataset.scene, self.progress),
      onToggle: (self) => self.isActive && world.setSection(sec.dataset.scene, self.progress),
    });
  });
  if (lenis) lenis.on('scroll', ({ velocity }) => world.setVelocity(velocity / 25));

  let pending = false;
  let px = 0;
  let py = 0;
  const pushPointer = () => { pending = false; world.setPointer(px, py); };
  window.addEventListener('pointermove', (e) => {
    px = (e.clientX / window.innerWidth) * 2 - 1;
    py = -((e.clientY / window.innerHeight) * 2 - 1);
    if (!pending) { pending = true; requestAnimationFrame(pushPointer); }
  }, { passive: true });
  window.addEventListener('blur', () => world.setPointer(0, 0));
  document.addEventListener('pointerleave', () => world.setPointer(0, 0));
  world.start();
  // test hook: ?snap lets automated screenshots jump the camera to each section's final view
  if (/[?&]snap\b/.test(location.search)) window.__world = world;
}

/* ---------------- Intro + hero choreography ---------------- */
const intro = document.querySelector('.intro');
function finishIntro() {
  intro && intro.remove();
  root.classList.add('ready');
  lenis && lenis.start();
}
if (reduce) {
  finishIntro();
} else {
  lenis && lenis.stop();
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: () => ScrollTrigger.refresh() });
  tl.to('.intro__bar span', { scaleX: 1, duration: 0.9, ease: 'power2.inOut' })
    .to('.intro__name', { yPercent: -110, duration: 0.6, ease: 'power3.in' }, '-=0.15')
    .to('.intro', { yPercent: -100, duration: 0.9, ease: 'expo.inOut', onComplete: finishIntro }, '-=0.1')
    .from('.stage', { opacity: 0, scale: 1.06, duration: 1.8, ease: 'power2.out' }, '-=0.7')
    .from('.hero .ch', { yPercent: 105, rotate: 4, duration: 1.2, stagger: 0.035 }, '-=1.5')
    .from('.hero__kicker, .hero__lede, .hero__ctas > *, .hero__facts > div', { y: 24, opacity: 0, duration: 1, stagger: 0.07 }, '-=0.9')
    .from('.nav', { opacity: 0, duration: 0.8, clearProps: 'opacity' }, '<');
  // never trap the page behind the curtain
  setTimeout(() => { if (document.body.contains(intro)) { tl.progress(1); } }, 4500);
}

/* ---------------- Scroll choreography ---------------- */
if (!reduce) {
  // section headings: words rise out of a mask
  document.querySelectorAll('[data-split]').forEach((el) => {
    gsap.from(el.querySelectorAll('.w__i'), {
      yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  // statement: the words fill with light as you read
  document.querySelectorAll('[data-fill]').forEach((el) => {
    gsap.fromTo(el.querySelectorAll('.fw'), { opacity: 0.16 }, {
      opacity: 1, ease: 'none', stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
    });
  });

  const reveal = (sel, opts = {}) => {
    document.querySelectorAll(sel).forEach((group) => {
      const kids = group.children.length ? group.children : [group];
      gsap.from(kids, {
        y: opts.y ?? 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: opts.stagger ?? 0.08,
        scrollTrigger: { trigger: group, start: 'top 85%' },
      });
    });
  };
  reveal('.statement__pillars');
  reveal('.index', { y: 30, stagger: 0.06 });
  reveal('.sect-head__note', { y: 16 });
  reveal('.acc', { y: 24, stagger: 0.05 });
  reveal('.stack__groups', { stagger: 0.1 });
  reveal('.contact__lede, .contact__facts, .contact__actions', { y: 20 });

  gsap.from('.contact__mail', {
    y: 60, opacity: 0, duration: 1.2, ease: 'expo.out',
    scrollTrigger: { trigger: '.contact__mail', start: 'top 90%' },
  });

  // process: the rail draws itself as you scroll, steps light up when reached
  gsap.fromTo('.timeline__fill', { scaleY: 0 }, {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 60%', scrub: 0.5 },
  });
  document.querySelectorAll('.step').forEach((step) => {
    ScrollTrigger.create({ trigger: step, start: 'top 68%', onEnter: () => step.classList.add('is-on'), onLeaveBack: () => step.classList.remove('is-on') });
  });

  // magnetic pull on the two focal CTAs only
  if (finePointer) {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.25);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }
} else {
  document.querySelectorAll('.step').forEach((s) => s.classList.add('is-on'));
}

/* ---------------- Services accordion: one open at a time ---------------- */
const accItems = [...document.querySelectorAll('.acc__item')];
accItems.forEach((d) => d.addEventListener('toggle', () => {
  if (d.open) accItems.forEach((o) => { if (o !== d) o.open = false; });
  ScrollTrigger.refresh();
}));

/* ---------------- Copy email ---------------- */
const status = document.querySelector('.copy-email__status');
document.querySelectorAll('.copy-email').forEach((btn) => {
  const label = btn.querySelector('.copy-email__label');
  btn.addEventListener('click', async () => {
    const email = btn.dataset.email;
    let ok = false;
    try { await navigator.clipboard.writeText(email); ok = true; } catch (e) { ok = false; }
    label.textContent = ok ? 'Copied' : email;
    if (status) status.textContent = ok ? 'Email address copied to clipboard.' : `Email address: ${email}`;
    btn.classList.toggle('is-done', ok);
    setTimeout(() => { label.textContent = 'Copy email'; btn.classList.remove('is-done'); }, 2200);
  });
});

/* ---------------- Live GitHub repositories ---------------- */
initProjects({
  onRender(grid) {
    ScrollTrigger.refresh();
    if (reduce) return;
    gsap.from(grid.children, { y: 24, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.04, clearProps: 'all' });
  },
});

/* fonts and late layout shifts change trigger positions */
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());

/* ---------------- Case studies (native dialogs) ---------------- */
document.querySelectorAll('[data-case]').forEach((btn) => {
  const dlg = document.getElementById(`case-${btn.dataset.case}`);
  if (!dlg || typeof dlg.showModal !== 'function') return;
  btn.addEventListener('click', () => { dlg.showModal(); lenis && lenis.stop(); });
  dlg.querySelector('.case__close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { lenis && lenis.start(); btn.focus(); });
});
