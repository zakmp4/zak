// ============================================================
// Site settings — edit these
// ============================================================
const SITE = {
  name: "Zak",
};

// Games shown on the home page and the Games page.
// status: "live" (clickable) or "soon" (shows "In progress")
const GAMES = [
  {
    id: "broadside",
    title: "Broadside",
    blurb: "The ship next to you won't stop firing. How long can you last?",
    url: "games/broadside/",
    status: "live",
    unit: "s", // score is seconds survived
  },
];

// ============================================================
// Icons (line icons, inherit text colour)
// ============================================================
const ICONS = {
  play: '<path d="M7 4l12 8-12 8z"/>',
  players: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.6 0 4.5 1.8 4.5 4.5"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4"/><path d="M12 13v4M8 21h8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

// ============================================================
// Shared header + footer
// Pages set <body data-page="home|games|leaderboard|players|ideas">
// ============================================================
function renderChrome() {
  const page = document.body.dataset.page;
  const root = document.body.dataset.root || "";

  const links = [
    { id: "games", href: "games.html", label: "Games", icon: "grid" },
    { id: "leaderboard", href: "leaderboard.html", label: "Leaderboard", icon: "trophy" },
    { id: "players", href: "players.html", label: "Players", icon: "players" },
    { id: "ideas", href: "ideas.html", label: "Ideas", icon: "idea" },
  ];

  const header = document.getElementById("site-header");
  if (header) {
    header.className = "site-header";
    header.innerHTML = `
      <div class="header-inner">
        <a class="brand" href="${root}index.html"><span class="logo">${SITE.name[0]}</span>${SITE.name}</a>
        <nav class="nav">
          ${links
            .map(
              (l) => `<a href="${root}${l.href}" class="${l.id === page ? "active" : ""}"${
                l.id === page ? ' aria-current="page"' : ""
              }>${icon(l.icon)}<span class="label">${l.label}</span></a>`
            )
            .join("")}
        </nav>
      </div>`;
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="footer-inner">
        <span>© ${new Date().getFullYear()} ${SITE.name}</span>
        <span class="mono">built for fun</span>
      </div>`;
  }

  document.querySelectorAll("[data-site-name]").forEach((el) => (el.textContent = SITE.name));
  document.querySelectorAll("[data-icon]").forEach((el) => (el.outerHTML = icon(el.dataset.icon)));
}

// ============================================================
// Game cover art — generated from the game's id, so every game
// gets its own pattern without needing an image.
// ============================================================
function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)), (h >>> 0) / 4294967296);
}

function gameArt(id) {
  const rnd = seeded(id);
  const cols = 8, rows = 6, cell = 40, gap = 6;
  let shapes = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const r = rnd();
      if (r < 0.35) continue;
      const op = (0.12 + rnd() * 0.88).toFixed(2);
      const round = r > 0.85 ? cell / 2 : 6;
      shapes += `<rect x="${x * (cell + gap) + gap}" y="${y * (cell + gap) + gap}" width="${cell}" height="${cell}" rx="${round}" fill="#d97757" opacity="${op}"/>`;
    }
  }
  const w = cols * (cell + gap) + gap, h = rows * (cell + gap) + gap;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${shapes}</svg>`;
}

// One game tile (home + games pages)
function gameTile(game, root = "") {
  const live = game.status === "live";
  const tag = live ? "a" : "div";
  const href = live ? ` href="${root}${game.url}"` : "";
  return `
    <${tag} class="tile"${href}>
      <div class="tile-art">${gameArt(game.id)}</div>
      <div class="tile-body">
        <h3>${game.title}</h3>
        <p>${game.blurb}</p>
        <div class="tile-foot">
          <span class="chip ${live ? "live" : ""}">${live ? "Playable" : "In progress"}</span>
          ${live ? icon("arrow") : ""}
        </div>
      </div>
    </${tag}>`;
}

function suggestTile(root = "") {
  return `
    <a class="tile tile-add" href="${root}ideas.html">
      <span class="plus">${icon("plus")}</span>
      <h3>Your idea here</h3>
      <p>Pitch a game and I might build it.</p>
    </a>`;
}

document.addEventListener("DOMContentLoaded", renderChrome);
