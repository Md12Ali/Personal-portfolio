# Mohammed Ali · Portfolio

**Live site:** https://mohammed-ali-portfolio.onrender.com

The personal portfolio of **Mohammed Ali**, a full-stack web developer who also does web design, graphic design, SEO and digital marketing. It's a dark, animated 3D website set in one night-time world with a liquid-chrome core, built with Three.js, GSAP and Vite, and deployed on Render.

---

## Highlights

- **One persistent 3D world.** The whole page sits in a single night landscape built with Three.js: a glowing dot-grid sea under an indigo, star-filled sky. At its heart, a liquid-chrome sculpture floats inside a halo ring. The chrome reflects an authored night studio (violet key, cyan strips, lime kicker) baked into a PMREM environment map, so its reflections match the world's colours.
- **Scroll-driven camera.** Each section has its own camera view of a landmark, framed on the side opposite the text: the chrome core, a row of project pillars (lime tops = live, violet = in progress), four floating glass "stack" layers, and a light path for the process. Your pointer adds gentle parallax and presses a soft bulge into the chrome.
- **Live GitHub projects.** Every public repository is pulled from the GitHub API in the visitor's browser, so new repos show up without a rebuild. Filter them by language; deployed repos get a **Live site** link.
- **Editorial work index.** Featured projects are large rows that open on hover or keyboard focus (always open on touch screens).
- **Motion design.** Intro curtain, letter-by-letter name reveal, headings that rise word by word, a statement that fills with light as you read, a process timeline that draws itself, and a magnetic contact button.
- **SEO.** Meta, Open Graph image and canonical tags, plus `Person` structured data (JSON-LD).
- **Accessibility.** Skip link, visible focus, accessible labels on split text, and a reduced-motion mode that shows a rendered poster of the world instead of WebGL, with no smooth scrolling and no animation.

### The world, section by section

| Section | What the camera shows |
|---|---|
| Hero | The chrome core in its halo ring, right of the name |
| About | The core from above, on the left |
| Work | The project pillars, right of the list |
| Repositories | Open sky and sea behind the frosted panel |
| Services | The core seen from across the sea, on the left |
| Stack | The four glass layers, on the right |
| Process | The light path running into the distance, on the left |
| Contact | The core rising from the bottom of the screen |

On desktop a light bloom pass adds glow. Phones get a lighter mesh, fewer points and no bloom.

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
| Fonts | Geist and Geist Mono (Google Fonts) |
| Hosting | [Render](https://render.com) static site |

**Skills shown on the site:** JavaScript · PHP · Python · HTML · CSS · Three.js · SQL · MySQL · Web design · Graphic design · SEO · Digital marketing

---

## Project structure

```
.
├── index.html        # All page content and SEO tags
├── public/
│   ├── favicon.svg
│   ├── poster.jpg    # Rendered frame shown when WebGL or motion is off
│   └── og.jpg        # Social share image
├── src/
│   ├── main.js       # Intro, smooth scroll, scroll choreography, nav, contact
│   ├── scene.js      # The 3D world: sea, sky, chrome core, landmarks, camera views
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
| Camera view and landmark placement for each section | the `CHAPTERS` table at the top of `src/scene.js` |
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
