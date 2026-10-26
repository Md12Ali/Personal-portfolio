# Mohammed Ali · Portfolio

**Live site:** https://mohammed-ali-portfolio.onrender.com

The personal portfolio of **Mohammed Ali**, a full-stack web developer who also does web design, graphic design, SEO and digital marketing. It's an animated 3D website set inside a bright alpine valley on a clear day, built with Three.js, GSAP and Vite, and deployed on Render.

---

## Highlights

- **A natural 3D landscape.** The whole page sits inside one alpine valley on a clear blue day, built in code with Three.js: a waterfall pouring into a turquoise mirror lake that truly reflects the peaks, trees and sky, a river winding up through pine forest, layered mountain ranges with snowy peaks, drifting clouds, low mist over the water, a flock of birds, fireflies, pine trees with real branch silhouettes that sway in the wind, meadow grass moving in the breeze, white water and spray where the waterfall meets the lake, and soft daylight glow on desktop. The camera banks gently like a drone as it flies between sections. Slopes have fine rocky relief and layered strata. Distant ranges fade into light-blue haze the way real mountains do.
- **Scroll-driven camera.** Scrolling flies the camera up the valley. Each section has its own view, framed on the side opposite the text, and the camera eases smoothly between them. Moving the pointer adds gentle depth.
- **Readable on every screen.** A light theme with navy text, sky-blue accents and frosted-glass panels behind every block of copy, so text stays crisp over the scenery; phones get a lighter scene (fewer trees, less detail, no glow pass) so scrolling stays smooth.
- **Live GitHub projects.** Every public repository is pulled from the GitHub API in the visitor's browser, so new repos show up without a rebuild. Filter them by language; deployed repos get a **Live site** link.
- **Built for hiring.** An "Open to remote & hybrid roles" status in the hero, a recruiter facts strip (role, work type, location) in the contact section, a one-page CV at `/cv.html` with a PDF at `/cv.pdf`, and a case study for every live project (problem, what was built, key decisions, stack) in an accessible dialog.
- **Editorial work index.** Featured projects are large rows that open on hover or keyboard focus (always open on touch screens).
- **Motion design.** Intro curtain, letter-by-letter name reveal, headings that rise word by word, a statement that fills with light as you read, a process timeline that draws itself, and a magnetic contact button.
- **SEO.** Meta, Open Graph image and canonical tags, plus `Person` structured data (JSON-LD).
- **Accessibility.** Skip link, visible focus, accessible labels on split text, and a reduced-motion mode that shows a rendered poster of the world instead of WebGL, with no smooth scrolling and no animation.

### The valley, section by section

| Section | What the camera shows |
|---|---|
| Hero | The waterfall and lake, beside the name |
| About | The waterfall from the hillside |
| Work | Up the valley toward the snowy peaks |
| Repositories | High above the forest, the river below |
| Services | Across the valley to the far ranges |
| Stack | From the opposite slope toward the peaks |
| Process | Following the river upstream |
| Contact | A high view over the whole valley |

On desktop a soft bloom pass makes the sky glow, the water glint and the fireflies shine.

---

## Featured projects

| Project | What it is | Live | Code |
|---|---|---|---|
| **Qunor** | Free app for learning to read the Quran: 114 surahs, word-by-word audio, tajweed lessons, 81 translations | [qunor.onrender.com](https://qunor.onrender.com) | [GitHub](https://github.com/Md12Ali/Qunor) |
| **ParaLine** | Free, unlimited paraphrasing tool with six styles, an offline mode and an optional Gemini AI mode | [paraline.onrender.com](https://paraline.onrender.com) | [GitHub](https://github.com/Md12Ali/paraline) |
| **Driving Teaching** | Teaching platform for UK driving instructors: teaching route, A to Z curriculum, mock test sheet, pupil progress | [driving-teaching.onrender.com](https://driving-teaching.onrender.com) | [GitHub](https://github.com/Md12Ali/Driving-teaching) |
| **Tax Return Helper** | HMRC Self Assessment helper (React, web + Android), in English and Bengali | [yearly-tax-return.onrender.com](https://yearly-tax-return.onrender.com) | [GitHub](https://github.com/Md12Ali/Yearly-tax-return) |
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
│   ├── scene.js      # The 3D valley: terrain, waterfall, water, forest, sky, camera views
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
| Name, intro text, services, contact details, case studies | `index.html` |
| CV | `public/cv.html`; regenerate `public/cv.pdf` by printing the page to PDF (A4, one page) |
| Featured project cards | the `featured` block in `index.html` |
| Which repos get a **Live site** button | the `LIVE` map at the top of `src/projects.js` |
| GitHub account the repo list comes from | `USER` in `src/projects.js` |
| Camera view for each section | the `CHAPTERS` table at the top of `src/scene.js` |
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
