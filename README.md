# Mohammed Ali — Portfolio

An animated 3D portfolio for Mohammed Ali, full-stack web developer, web & graphic designer, SEO and digital marketer.

## Concept
One WebGL particle world sits behind the whole page and reshapes itself as you scroll — a sphere (hero), a torus knot (about), a double helix (services), stacked layers (stack), a spiral galaxy (work), a möbius ribbon (process) and a ringed sphere (contact). Particles dissolve between formations and react to the pointer.

## Stack
- **Vite** — build
- **Three.js** — custom GLSL particle shader
- **GSAP + ScrollTrigger** — intro, word-by-word reveals, pinned horizontal process
- **Lenis** — smooth scrolling (the only scroll engine)
- **Iconify** (`iconify-icon`) — Solar UI icons and technology logos

The Projects section loads every public repository live from the GitHub API, so new repos appear automatically.

Accessibility: reduced-motion users get a static page (no WebGL, no smooth scroll), split text keeps accessible labels, and everything works by keyboard.

## Develop
```bash
npm install
npm run dev
```

## Deploy (Render)
`render.yaml` defines a static site: `npm install && npm run build`, publishing `dist/`.
