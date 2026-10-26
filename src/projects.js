/**
 * Loads every public repository from GitHub in the visitor's browser,
 * so the Projects section stays current with no rebuilds.
 */
const USER = 'Md12Ali';
const API = `https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`;
const CACHE_KEY = 'ma-repos-v1';
const CACHE_MS = 10 * 60 * 1000;

// Live deployments on Render, keyed by lower-case repo name
const LIVE = {
  qunor: 'https://qunor.onrender.com',
  paraline: 'https://paraline.onrender.com',
  appointments: 'https://appointments-reminder.onrender.com',
  'driving-teaching': 'https://driving-teaching.onrender.com',
  'yearly-tax-return': 'https://yearly-tax-return.onrender.com',
  'adi-part-3': 'https://adi-part-3.onrender.com',
};

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', PHP: '#7a86b8', Python: '#3572A5', HTML: '#e34c26',
  CSS: '#663399', Kotlin: '#A97BFF', Java: '#b07219', Dart: '#00B4AB', Vue: '#41b883', Shell: '#89e051',
  SCSS: '#c6538c', 'C++': '#f34b7d', C: '#555555', Swift: '#F05138', Go: '#00ADD8', Ruby: '#701516',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prettyName = (n) => n.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const units = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [sec, u] of units) if (s >= sec) return `${Math.floor(s / sec)}${u} ago`;
  return 'just now';
}

async function getRepos() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at < CACHE_MS) return data;
    }
  } catch (e) { /* storage unavailable */ }

  const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const json = await res.json();
  const data = json.map((r) => ({
    name: r.name, url: r.html_url, desc: r.description, lang: r.language, stars: r.stargazers_count,
    forks: r.forks_count, pushed: r.pushed_at, fork: r.fork, home: r.homepage, topics: r.topics || [],
  }));
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) { /* ignore */ }
  return data;
}

function repoCard(r) {
  const color = LANG_COLORS[r.lang] || '#8b8a9b';
  const live = LIVE[r.name.toLowerCase()] || (r.home && /^https?:\/\//.test(r.home) ? r.home : '');
  return `
  <article class="repo" data-lang="${esc(r.lang || 'Other')}">
    <h4 class="repo__name"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(prettyName(r.name))}</a><iconify-icon icon="solar:arrow-right-up-linear" aria-hidden="true"></iconify-icon></h4>
    <p class="repo__desc">${esc(r.desc || (r.fork ? 'Forked repository.' : 'A project by Mohammed Ali.'))}</p>
    ${live ? `<a class="repo__live" href="${esc(live)}" target="_blank" rel="noopener">Live site <iconify-icon icon="solar:arrow-right-up-linear" aria-hidden="true"></iconify-icon></a>` : ''}
    <div class="repo__meta">
      ${r.lang ? `<span><i class="repo__dot" style="background:${color}"></i>${esc(r.lang)}</span>` : ''}
      ${r.stars ? `<span><iconify-icon icon="solar:star-linear"></iconify-icon>${r.stars}</span>` : ''}
      ${r.fork ? '<span>Fork</span>' : ''}
      <span>Updated ${timeAgo(r.pushed)}</span>
    </div>
  </article>`;
}

export async function initProjects({ onRender } = {}) {
  const grid = document.querySelector('.repos__grid');
  const filters = document.querySelector('.repos__filters');
  if (!grid) return;

  let repos;
  try {
    repos = await getRepos();
  } catch (e) {
    grid.innerHTML = `<p class="repos__state">Couldn't reach GitHub just now. <a href="https://github.com/${USER}?tab=repositories" target="_blank" rel="noopener">Browse all repositories on GitHub</a></p>`;
    return;
  }

  repos = repos
    .filter((r) => r.name.toLowerCase() !== 'personal-portfolio')
    .sort((a, b) => (a.fork - b.fork) || (!!LIVE[b.name.toLowerCase()] - !!LIVE[a.name.toLowerCase()]) || (new Date(b.pushed) - new Date(a.pushed)));

  // link featured cards to their real repos when found
  document.querySelectorAll('.row[data-repo-hint]').forEach((card) => {
    const link = card.querySelector('.row__repo');
    if (!link || !link.hidden) return;
    const hints = card.dataset.repoHint.split(',');
    const hit = repos.find((r) => hints.some((h) => `${r.name} ${r.desc || ''}`.toLowerCase().includes(h)));
    if (hit) { link.href = hit.url; link.hidden = false; }
  });

  if (!repos.length) {
    grid.innerHTML = `<p class="repos__state">New repositories are on the way. <a href="https://github.com/${USER}" target="_blank" rel="noopener">Follow on GitHub</a></p>`;
    return;
  }

  const langs = [...new Set(repos.map((r) => r.lang || 'Other'))];
  const counts = Object.fromEntries(langs.map((l) => [l, repos.filter((r) => (r.lang || 'Other') === l).length]));
  langs.sort((a, b) => counts[b] - counts[a]);

  let active = 'All';
  const render = () => {
    const list = active === 'All' ? repos : repos.filter((r) => (r.lang || 'Other') === active);
    grid.innerHTML = list.map(repoCard).join('');
    onRender && onRender(grid);
  };

  if (langs.length > 1 && filters) {
    filters.innerHTML = ['All', ...langs].map((l) =>
      `<button class="chip" type="button" aria-pressed="${l === 'All'}" data-lang="${esc(l)}">${esc(l)}${l === 'All' ? ` <span class="chip__n">${repos.length}</span>` : ''}</button>`).join('');
    filters.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      active = b.dataset.lang;
      filters.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      render();
    });
  }
  render();
}
