# Mohammed Ali · Portfolio

**Live site:** https://mohammed-ali-portfolio.onrender.com

The personal portfolio of **Mohammed Ali**, a full-stack web developer who also does web design, graphic design, SEO and digital marketing. It's a dark, animated 3D website built with Three.js, GSAP and Vite, and deployed on Render.

---

## Highlights

- **Mixed-universe 3D background.** Five WebGL looks cross-fade into each other as you scroll (see the table below). They react to your mouse or finger, and scrolling fast speeds them up.
- **Animated name.** "Mohammed Ali" enters letter by letter, then a coloured light sweeps across it. On desktop it tilts in 3D towards the mouse.
- **Live GitHub projects.** Every public repository is pulled from the GitHub API in the visitor's browser, so new repos show up without a rebuild. You can filter them by language, and repos that are deployed get a **Live site** button.
- **Featured projects** with live demos and source code.
- **Motion design.**
  - Loading counter.
  - Word-by-word heading reveals and scrambling labels.
  - About text that lights up as you read it.
  - Pinned horizontal "Process" section.
  - Magnetic buttons, custom cursor and tilting cards.
  - Scroll progress bar and back-to-top ring.
- **Contact.** Email link and a one-click "copy email" button.
- **SEO.** Meta and Open Graph tags, canonical URL, and `Person` structured data (JSON-LD).
- **Accessibility.**
  - Keyboard focus styles and a skip link.
  - Split text keeps its accessible label.
  - Visitors who prefer reduced motion get a calm, static page with no WebGL and no smooth scrolling.

### Background by section

| Section | Background |
|---|---|
| Hero | Spiral galaxy (60,000 stars) over an aurora sky |
| About | Aurora curtains and twinkling stars |
| Services | Neon liquid (domain-warped noise) |
| Stack | Glowing 3D wave field with neon liquid |
| Work | Wave field under the aurora |
| Process | Synthwave grid, striped sun and mountains |
| Contact | Galaxy over the aurora |

On desktop, a bloom pass adds a soft glow. Phones get fewer stars, fewer noise octaves and no bloom, so the page stays smooth.

---

## Featured projects

| Project | What it is | Live | Code |
|---|---|---|---|
| **Qunor** | Free app for learning to read the Quran: 114 surahs, word-by-word audio, tajweed lessons, 81 translations | [qunor.onrender.com](https://qunor.onrender.com) | [GitHub](https://github.com/Md12Ali/Qunor) |
| **ParaLine** | Free, unlimited paraphrasing tool with six styles, an offline mode and an optional Gemini AI mode | [paraline.onrender.com](https://paraline.onrender.com) | [GitHub](https://github.com/Md12Ali/paraline) |
| **Appointments** | Private appointment tracker with text or voice notes and custom-time reminders | [appointments-reminder.onrender.com](https://appointments-reminder.onrender.com) | [GitHub](https://github.com/Md12Ali/Appointments) |
| **A–Z Islamic Learning Platform** | Multilingual, interactive 3D learning platform | In progress | |
| **Pingo** | Real-time chat, media sharing and calling mobile app | In progress | |

---

## Tech stack

| Area | Tools |
|---|---|
| Build | [Vite](https://vitejs.dev) |
| 3D | [Three.js](https://threejs.org), custom GLSL shaders, `EffectComposer` + `UnrealBloomPass` |
| Animation | [GSAP](https://gsap.com) + ScrollTrigger |
| Smooth scroll | [Lenis](https://github.com/darkroomengineering/lenis) |
| Icons | [Iconify](https://iconify.design) (`iconify-icon`): Solar UI icons and technology logos |
| Fonts | Unbounded, Manrope, JetBrains Mono (Google Fonts) |
| Hosting | [Render](https://render.com) static site |

**Skills shown on the site:** JavaScript · PHP · Python · HTML · CSS · Three.js · SQL · MySQL · Web design · Graphic design · SEO · Digital marketing

---

## Project structure

```
.
├── index.html        # All page content and SEO tags
├── public/
│   └── favicon.svg
├── src/
│   ├── main.js       # Loader, smooth scroll, scroll animations, cursor, nav, contact
│   ├── scene.js      # The 3D background: shaders, galaxy, wave field, bloom
│   ├── projects.js   # Live GitHub repos, filters and live-site links
│   └── style.css     # All styles and responsive layout
├── render.yaml       # Render static-site configuration
└── package.json
```

---

## Run it locally

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/Md12Ali/Personal-portfolio.git
cd Personal-portfolio
npm install
npm run dev       # start the dev server at http://localhost:5173
npm run build     # production build into dist/
npm run preview   # preview the production build
```

---

## Editing common things

| To change… | Edit |
|---|---|
| Name, intro text, services, contact details | `index.html` |
| Featured project cards | the `featured` block in `index.html` |
| Which repos get a **Live site** button | the `LIVE` map at the top of `src/projects.js` |
| GitHub account the repo list comes from | `USER` in `src/projects.js` |
| Which background shows in each section | the `MIX` table at the top of `src/scene.js` |
| Colours and fonts | the `:root` variables at the top of `src/style.css` |

---

## Deployment (Render)

The site is a Render **static site**:

- **Build command:** `npm install && npm run build`
- **Publish directory:** `dist`

`render.yaml` holds the same settings, plus long-term caching for built assets.

If Render's GitHub app is connected to this repository, every push to `main` redeploys automatically. If it isn't, start a deploy by hand from the Render dashboard (**Manual Deploy → Deploy latest commit**).

---

## Contact

- **Email:** [md077ali@gmail.com](mailto:md077ali@gmail.com)
- **GitHub:** [@Md12Ali](https://github.com/Md12Ali)

© 2026 Mohammed Ali. All rights reserved.
