// ============================================================
// Broadside — the ship next to you won't stop firing.
// Dodge the shells and survive as long as you can.
// Everything is drawn at 320x180 and scaled up for crisp pixels.
// ============================================================
(() => {
  "use strict";

  const W = 320, H = 180;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const R = Math.round;

  const GAME_ID = "broadside";
  const BEST_KEY = "broadside-best-v2"; // v2 = one-life rules, so old 3-heart bests don't count

  // ---------- colours ----------
  const COL = {
    outline: "#140d0a",
    water: "#16303c", wave: "#22495a", waveHi: "#3f7890", foam: "#9cc7d6",
    iron: "#26242b", ironHi: "#56535e",
    target: "#ff5a3c",
  };
  const PLAYER_DECK = {
    rail: "#6e4127", railHi: "#87532f", deckA: "#a36d3c", deckB: "#9a6535", seam: "#6f4523", knot: "#8a5a2e",
  };
  const ENEMY_DECK = {
    rail: "#3b2b31", railHi: "#4d3a42", deckA: "#4f3b44", deckB: "#48353d", seam: "#2e2227", knot: "#3f2f37",
  };

  // ---------- helpers ----------
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return [c, c.getContext("2d")];
  }

  // Turn a text map into a little image. Each letter is a colour in `pal`.
  function sprite(rows, pal, flip = false) {
    const [c, g] = makeCanvas(rows[0].length, rows.length);
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === "." || !pal[ch]) return;
        g.fillStyle = pal[ch];
        g.fillRect(flip ? row.length - 1 - x : x, y, 1, 1);
      });
    });
    return c;
  }

  function hash(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function disc(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      g.fillRect(R(cx) - w, R(cy) + dy, w * 2 + 1, 1);
    }
  }

  function ellipse(g, cx, cy, rx, ry, color) {
    g.fillStyle = color;
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.floor(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2));
      g.fillRect(R(cx) - w, R(cy) + dy, w * 2 + 1, 1);
    }
  }

  function pxRing(g, cx, cy, r, color) {
    g.fillStyle = color;
    cx = R(cx); cy = R(cy);
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) {
        g.fillRect(cx + a, cy + b, 1, 1);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }

  function line(g, x0, y0, x1, y1, color) {
    g.fillStyle = color;
    x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // ============================================================
  // Sprites
  // ============================================================
  const SAILOR = [
    "..oooo..",
    ".orrrrro",
    "rosssso.",
    ".oseseo.",
    "..osSo..",
    ".owbbwo.",
    "oswbbwso",
    ".owwwwo.",
    ".oppppo.",
  ];
  const LEGS_A = ".ok..ko.";
  const LEGS_B = "..okko..";

  const PLAYER_PAL = {
    o: "#1a1210", r: "#d97757", s: "#f0c39a", S: "#d39a70", e: "#1a1210",
    w: "#eeeae0", b: "#3d6e8f", p: "#3a3532", k: "#2a1d17",
  };
  const CREW_PAL = {
    o: "#0e0a0b", r: "#7a2c2c", s: "#c99a78", S: "#a87a5a", e: "#0e0a0b",
    w: "#3a3238", b: "#1f1a1f", p: "#2a2428", k: "#151012",
  };

  const playerFrames = {
    right: [sprite([...SAILOR, LEGS_A], PLAYER_PAL), sprite([...SAILOR, LEGS_B], PLAYER_PAL)],
    left: [sprite([...SAILOR, LEGS_A], PLAYER_PAL, true), sprite([...SAILOR, LEGS_B], PLAYER_PAL, true)],
  };
  const crewSprite = sprite([...SAILOR, LEGS_A], CREW_PAL, true);

  const BALL_PAL = { o: "#0f0e12", x: "#2b2a30", h: "#8a8794" };
  const ballSmall = sprite([".ooo.", "ohxxo", "oxxxo", "oxxxo", ".ooo."], BALL_PAL);
  const ballMega = sprite([
    "...ooooo...",
    "..oxxxxxo..",
    ".ohhxxxxxo.",
    "ohhxxxxxxxo",
    "ohxxxxxxxxo",
    "oxxxxxxxxxo",
    "oxxxxxxxxxo",
    "oxxxxxxxxxo",
    ".oxxxxxxxo.",
    "..oxxxxxo..",
    "...ooooo...",
  ], BALL_PAL);
  const ballBig = sprite(["..ooo..", ".ohxxo.", "ohhxxxo", "oxxxxxo", "oxxxxxo", ".oxxxo.", "..ooo.."], BALL_PAL);


  // 3x5 pixel digits for the timer
  const DIGITS = {
    0: ["111", "101", "101", "101", "111"], 1: ["010", "110", "010", "010", "111"],
    2: ["111", "001", "111", "100", "111"], 3: ["111", "001", "111", "001", "111"],
    4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "111", "001", "111"],
    6: ["111", "100", "111", "101", "111"], 7: ["111", "001", "001", "010", "010"],
    8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "111"],
    ".": ["0", "0", "0", "0", "1"],
  };

  // ============================================================
  // Your ship (bottom) — bow points left
  // ============================================================
  const BOAT = { top: 66, bottom: 176, stern: 310, tip: 4, bow: 46 };
  const BMID = (BOAT.top + BOAT.bottom) / 2, BHALF = (BOAT.bottom - BOAT.top) / 2;
  const hullLeft = (y) => BOAT.tip + ((y - BMID) / BHALF) ** 2 * BOAT.bow;
  const hullRight = (y) => BOAT.stern - Math.max(0, 5 - Math.min(y - BOAT.top, BOAT.bottom - y));

  // Enemy ship (top) — only its lower half is on screen
  const EN_BOTTOM = 44;
  const enemyLeft = (y) => 8 + ((y + 8) / 52) ** 2 * 56;
  const enemyRight = () => 400;
  const CANNON_X = [96, 140, 184, 228, 272];

  function paintDeck(g, top, bottom, leftFn, rightFn, pal) {
    for (let y = Math.max(0, top); y <= Math.min(H - 1, bottom); y++) {
      const L = R(leftFn(y)), Rx = R(rightFn(y));
      for (let x = Math.max(0, L); x <= Math.min(W - 1, Rx); x++) {
        const edge = Math.min(x - L, Rx - x, y - top, bottom - y);
        let c;
        if (edge < 1) c = COL.outline;
        else if (edge < 2) c = pal.railHi;
        else if (edge < 3) c = pal.rail;
        else if (edge < 4) c = pal.seam;
        else {
          const row = Math.floor((y - top) / 6);
          const inRow = (y - top) % 6;
          if (inRow === 0 || (x + row * 29) % 41 === 0) c = pal.seam;
          else c = row % 2 ? pal.deckA : pal.deckB;
          if (c !== pal.seam && hash(x, y) < 0.02) c = pal.knot;
        }
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
      // shadow on the water just under the hull
    }
    g.fillStyle = "rgba(0,0,0,0.28)";
    for (let k = 1; k <= 2; k++) {
      const y = bottom + k;
      if (y >= H) continue;
      const L = R(leftFn(bottom)), Rx = Math.min(W - 1, R(rightFn(bottom)));
      g.fillRect(L + k, y, Rx - L - k, 1);
    }
  }

  function drawCrate(g, x, y, w, h) {
    g.fillStyle = COL.outline; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = "#b8833f"; g.fillRect(x, y, w, h);
    g.fillStyle = "#8a5a2a";
    g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
    line(g, x + 1, y + 1, x + w - 2, y + h - 2, "#8a5a2a");
    line(g, x + w - 2, y + 1, x + 1, y + h - 2, "#8a5a2a");
    g.fillStyle = "#d29a52"; g.fillRect(x + 1, y + 1, w - 2, 1);
  }

  function drawBarrel(g, x, y, r) {
    disc(g, x, y, r + 1, COL.outline);
    disc(g, x, y, r, "#7a4a28");
    pxRing(g, x, y, r - 1, "#3b3a40");
    disc(g, x, y, r - 3, "#8f5a30");
    g.fillStyle = "#a86c3c"; g.fillRect(x - 2, y - 2, 2, 1);
  }

  function drawMast(g, x, y) {
    disc(g, x, y, 7, COL.outline);
    disc(g, x, y, 6, "#5a3a22");
    pxRing(g, x, y, 4, "#46301c");
    disc(g, x - 1, y - 1, 2, "#7a5232");
  }

  // Pre-draw your ship once
  const [boatCanvas, bg] = makeCanvas(W, H);
  paintDeck(bg, BOAT.top, BOAT.bottom, hullLeft, hullRight, PLAYER_DECK);
  const MAST = { x: 175, y: 121 };
  for (const [tx, ty] of [[130, BOAT.top + 3], [220, BOAT.top + 3], [130, BOAT.bottom - 3], [220, BOAT.bottom - 3]]) {
    line(bg, MAST.x, MAST.y, tx, ty, "#c9b48a");
  }
  // hatch
  bg.fillStyle = COL.outline; bg.fillRect(95, 103, 24, 16);
  bg.fillStyle = "#5e3a20"; bg.fillRect(96, 104, 22, 14);
  bg.fillStyle = "#2a1a10";
  for (let i = 0; i < 4; i++) bg.fillRect(98 + i * 5, 106, 3, 10);
  // rope coil
  pxRing(bg, 286, 152, 5, "#c9b48a"); pxRing(bg, 286, 152, 3, "#a8946a"); pxRing(bg, 286, 152, 1, "#c9b48a");
  drawMast(bg, MAST.x, MAST.y);
  const CRATES = [
    { x: 238, y: 76, w: 13, h: 12 },
    { x: 253, y: 79, w: 12, h: 11 },
  ];
  CRATES.forEach((c) => drawCrate(bg, c.x, c.y, c.w, c.h));
  const BARREL = { x: 70, y: 154, r: 5 };
  drawBarrel(bg, BARREL.x, BARREL.y, BARREL.r);

  // Things you can't walk through
  const PR = 3; // player radius
  const OBST = [
    { type: "circle", x: MAST.x, y: MAST.y, r: 7 },
    { type: "circle", x: BARREL.x, y: BARREL.y, r: BARREL.r + 1 },
    ...CRATES.map((c) => ({ type: "rect", x: c.x - 1, y: c.y - 1, w: c.w + 2, h: c.h + 2 })),
  ];

  // Pre-draw the enemy ship once
  const [enemyCanvas, eg] = makeCanvas(W, H);
  paintDeck(eg, -60, EN_BOTTOM, enemyLeft, enemyRight, ENEMY_DECK);
  drawMast(eg, 206, 10);
  drawBarrel(eg, 70, 14, 4);
  drawBarrel(eg, 300, 10, 4);
  drawCrate(eg, 118, 4, 10, 9);
  CANNON_X.forEach((x) => eg.drawImage(crewSprite, x + 8, 20));
  // orange flag on the mast
  eg.fillStyle = COL.outline; eg.fillRect(206, 2, 14, 7);
  eg.fillStyle = "#d97757"; eg.fillRect(207, 3, 12, 5);
  eg.fillStyle = "#b85c3e"; eg.fillRect(207, 7, 12, 1);

  // Foam pixels around both hulls
  const foamP = [], foamE = [];
  for (let y = BOAT.top; y <= BOAT.bottom; y++) {
    foamP.push([R(hullLeft(y)) - 1, y]);
    foamP.push([R(hullRight(y)) + 1, y]);
  }
  for (let x = R(hullLeft(BOAT.bottom)); x <= BOAT.stern; x++) foamP.push([x, BOAT.bottom + 3]);
  for (let x = R(hullLeft(BOAT.top)); x <= BOAT.stern; x++) foamP.push([x, BOAT.top - 1]);
  for (let y = 0; y <= EN_BOTTOM; y++) foamE.push([R(enemyLeft(y)) - 1, y]);
  for (let x = R(enemyLeft(EN_BOTTOM)); x < W; x++) foamE.push([x, EN_BOTTOM + 3]);

  const waves = Array.from({ length: 80 }, () => ({
    x: rand(0, W), y: R(rand(0, H)), len: R(rand(2, 5)), spd: rand(3, 8),
  }));

  // ============================================================
  // Sound (tiny synth, no files)
  // ============================================================
  const Sound = (() => {
    let ac = null, master = null, nbuf = null;
    let muted = localStorage.getItem("broadside-muted") === "1";
    function init() {
      if (ac) return ac;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = 0.5;
        master.connect(ac.destination);
        nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = nbuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
      return ac;
    }
    function noise(dur, freq, vol) {
      if (muted || !init()) return;
      const t = ac.currentTime;
      const src = ac.createBufferSource(); src.buffer = nbuf;
      const f = ac.createBiquadFilter(); f.type = "lowpass";
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.15), t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t, Math.random() * 0.5); src.stop(t + dur);
    }
    function tone(f1, f2, dur, type, vol) {
      if (muted || !init()) return;
      const t = ac.currentTime;
      const o = ac.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur);
    }
    return {
      unlock() { if (init() && ac.state === "suspended") ac.resume(); },
      get muted() { return muted; },
      toggle() { muted = !muted; localStorage.setItem("broadside-muted", muted ? "1" : "0"); return muted; },
      fire() { noise(0.18, 600, 0.22); },
      boom(big) { noise(big ? 0.7 : 0.45, big ? 1400 : 1000, big ? 0.6 : 0.4); tone(110, 35, 0.35, "sine", 0.35); },
      hit() { tone(520, 90, 0.3, "square", 0.12); },
      pick() { tone(600, 1200, 0.12, "square", 0.08); setTimeout(() => tone(900, 1800, 0.12, "square", 0.08), 90); },
      over() { tone(300, 50, 0.9, "sawtooth", 0.12); },
    };
  })();

  // ============================================================
  // Game state
  // ============================================================
  let state = "menu"; // menu | playing | paused | dying | over
  let clock = 0, time = 0, shake = 0, hurt = 0, deadTimer = 0, lastBoomSound = 0;
  let fireTimer = 1;
  let shells = [], queue = [], parts = [], scorch = [], rings = [], flashes = [];
  const cannons = CANNON_X.map((x) => ({ x, flash: 0 }));
  const player = { x: 120, y: 140, vx: 0, vy: 0, kx: 0, ky: 0, moving: false, anim: 0, face: 1 };

  // How hard it is after t seconds. Starts tough: big, fast shells.
  function difficulty(t) {
    return {
      interval: Math.max(0.5, 1.5 - t * 0.022),
      count: Math.min(8, 2 + Math.floor(t / 10)),
      flight: Math.max(0.65, 1.15 - t * 0.008),
      bigChance: Math.min(0.35, t * 0.008),
    };
  }

  const SHELL_R = 15, BIG_R = 22, MEGA_R = 40;

  function clampToDeck(x, y) {
    y = clamp(y, BOAT.top + 10, BOAT.bottom - 5);
    x = clamp(x, hullLeft(y) + 6, hullRight(y) - 6);
    return [x, y];
  }

  function randomDeckPoint() {
    const y = rand(BOAT.top + 12, BOAT.bottom - 6);
    return [rand(hullLeft(y) + 10, hullRight(y) - 8), y];
  }

  // Where you'll be in `ahead` seconds if you keep moving
  function predict(ahead) {
    return clampToDeck(player.x + player.vx * ahead, player.y - 3 + player.vy * ahead);
  }

  function shot(delay, tx, ty, flight, r = SHELL_R, extra = {}) {
    queue.push({ delay, tx, ty, flight, r, ...extra });
  }

  // ---------- attack patterns ----------
  // Each one queues shells and returns how long to wait before the next attack.
  const ATTACKS = {
    // a few shells: one aimed where you're heading, the rest around you
    scatter(d) {
      for (let i = 0; i < d.count; i++) {
        let tx, ty;
        if (i === 0) [tx, ty] = predict(d.flight * 0.6);
        else if (Math.random() < 0.55) [tx, ty] = clampToDeck(player.x + rand(-55, 55), player.y + rand(-35, 35));
        else [tx, ty] = randomDeckPoint();
        shot(i * 0.11, tx, ty, d.flight * rand(0.9, 1.1), Math.random() < d.bigChance ? BIG_R : SHELL_R);
      }
      return d.interval * rand(0.85, 1.15);
    },

    // rapid fire that chases you: each shell aims where you are when it's fired
    burst(d) {
      const n = 4 + Math.floor(time / 25);
      for (let i = 0; i < n; i++) shot(i * 0.22, 0, 0, d.flight, SHELL_R, { track: true });
      return n * 0.22 + d.interval * 0.6;
    },

    // a circle of shells around you. The middle is safe, if you stay put!
    ring(d) {
      const n = 9, rad = 36, a0 = rand(0, Math.PI * 2);
      const [cx, cy] = clampToDeck(player.x, player.y - 3);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        const [tx, ty] = clampToDeck(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.8);
        shot(i * 0.03, tx, ty, d.flight * 1.1);
      }
      return d.interval + 0.5;
    },

    // a line straight through where you're standing
    line(d) {
      let i = 0;
      if (Math.random() < 0.5) {
        for (let y = BOAT.top + 14; y < BOAT.bottom - 4; y += 22) {
          const [tx, ty] = clampToDeck(player.x, y);
          shot(i++ * 0.06, tx, ty, d.flight);
        }
      } else {
        const y = player.y - 3;
        for (let x = 24; x < BOAT.stern - 6; x += 26) {
          if (x < hullLeft(y) + 6) continue;
          const [tx, ty] = clampToDeck(x, y);
          shot(i++ * 0.05, tx, ty, d.flight);
        }
      }
      return d.interval + 0.6;
    },

    // a wall of shells that sweeps across the deck. Find the gap!
    sweep(d) {
      const fromLeft = Math.random() < 0.5;
      const slots = [];
      for (let y = BOAT.top + 16; y < BOAT.bottom - 4; y += 22) slots.push(y);
      let gap = Math.floor(rand(0, slots.length));
      const cols = [];
      for (let x = 30; x < BOAT.stern - 8; x += 30) cols.push(x);
      if (!fromLeft) cols.reverse();
      cols.forEach((x, c) => {
        // the gap drifts by one slot now and then, so you have to follow it
        if (c > 0 && Math.random() < 0.35) gap = clamp(gap + (Math.random() < 0.5 ? -1 : 1), 0, slots.length - 1);
        slots.forEach((y, s) => {
          if (s === gap) return;
          if (x < hullLeft(y) + 6) return;
          const [tx, ty] = clampToDeck(x, y);
          shot(c * 0.28, tx, ty, d.flight * 1.15);
        });
      });
      return cols.length * 0.28 + d.interval;
    },

    // one huge, slow shell aimed at you, with a couple of small ones to push you around
    mega(d) {
      const [tx, ty] = predict(0.3);
      shot(0, tx, ty, Math.max(1.3, d.flight * 1.6), MEGA_R, { mega: true });
      for (let i = 0; i < 2; i++) {
        const [sx, sy] = clampToDeck(tx + rand(-70, 70), ty + rand(-40, 40));
        shot(0.2 + i * 0.15, sx, sy, d.flight);
      }
      return d.interval + 1.2;
    },
  };

  function pickAttack(t) {
    const options = [["scatter", 4]];
    if (t > 8) options.push(["burst", 2]);
    if (t > 15) options.push(["ring", 1.5], ["line", 1.5]);
    if (t > 25) options.push(["sweep", 1]);
    if (t > 30) options.push(["mega", 1]);
    let roll = Math.random() * options.reduce((a, o) => a + o[1], 0);
    for (const [name, w] of options) if ((roll -= w) <= 0) return name;
    return "scatter";
  }

  function fireVolley(d, attract = false) {
    if (attract) {
      const [tx, ty] = randomDeckPoint();
      shot(0, tx, ty, d.flight);
      return;
    }
    fireTimer = ATTACKS[pickAttack(time)](d);
  }

  function launch(q) {
    if (q.track) [q.tx, q.ty] = predict(0.15);
    const sorted = [...cannons].sort((a, b) => Math.abs(a.x - q.tx) - Math.abs(b.x - q.tx));
    const c = sorted[Math.random() < 0.7 ? 0 : 1];
    c.flash = 0.15;
    const bob = R(Math.sin(clock * 1.4));
    const sx = c.x, sy = 49 + bob;
    for (let i = 0; i < (q.mega ? 14 : 5); i++) {
      parts.push({ x: sx, y: sy, vx: rand(-15, 15), vy: rand(5, 25), life: rand(0.3, 0.6), max: 0.6, size: 2, colors: ["#d8d4cc", "#9a968e", "#5f5c57"] });
    }
    shells.push({
      sx, sy, tx: q.tx, ty: q.ty, t: 0, dur: q.flight, r: q.r, mega: !!q.mega, big: q.r > SHELL_R,
      arc: (q.mega ? 60 : 26) + Math.hypot(q.tx - sx, q.ty - sy) * 0.25,
    });
    Sound.fire();
  }

  function boom(x, y, r) {
    flashes.push({ x, y, r: R(r * 0.7), life: 0.09 });
    rings.push({ x, y, r0: r * 0.5, r1: r + 5, life: 0.22, max: 0.22 });
    const fire = ["#fff6d8", "#ffd166", "#f4a24a", "#d97757", "#8c3b2a", "#3a2a26"];
    const n = r >= MEGA_R ? 60 : 22;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(20, 90) * (r / 12);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), max: 0.55, size: Math.random() < 0.4 ? 2 : 1, colors: fire, drag: 0.9 });
    }
    for (let i = 0; i < n / 2; i++) {
      parts.push({ x: x + rand(-r / 2, r / 2), y: y + rand(-r / 2, r / 2), vx: rand(-10, 10), vy: -rand(5, 20), life: rand(0.6, 1.2), max: 1.2, size: 2, colors: ["#8a857d", "#6a665f", "#4a4743", "#33312e"] });
    }
    scorch.push({ x, y, r: R(r * 0.75), life: 7 });
    if (scorch.length > 40) scorch.shift();
    shake = Math.max(shake, r >= MEGA_R ? 0.45 : r > SHELL_R ? 0.22 : 0.12);
    // don't stack dozens of booms on the same frame (sweeps get loud)
    if (clock - lastBoomSound > 0.05 || r >= MEGA_R) { Sound.boom(r > SHELL_R); lastBoomSound = clock; }
  }

  // One hit and you're out
  function explode(s) {
    boom(s.tx, s.ty, s.r);
    if (state !== "playing") return;
    if (Math.hypot(player.x - s.tx, player.y - 4 - s.ty) < s.r + 1) {
      state = "dying";
      deadTimer = 1.1;
      hurt = 0.3;
      shake = 0.35;
      boom(player.x, player.y - 4, 16);
      Sound.hit();
      Sound.over();
    }
  }

  function collide(p) {
    for (const o of OBST) {
      if (o.type === "circle") {
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), m = o.r + PR;
        if (d < m && d > 0.001) { p.x = o.x + (dx / d) * m; p.y = o.y + (dy / d) * m; }
      } else {
        const l = o.x - PR, r = o.x + o.w + PR, t = o.y - PR, b = o.y + o.h + PR;
        if (p.x > l && p.x < r && p.y > t && p.y < b) {
          const m = Math.min(p.x - l, r - p.x, p.y - t, b - p.y);
          if (m === p.x - l) p.x = l;
          else if (m === r - p.x) p.x = r;
          else if (m === p.y - t) p.y = t;
          else p.y = b;
        }
      }
    }
    p.y = clamp(p.y, BOAT.top + 10, BOAT.bottom - 5);
    p.x = clamp(p.x, hullLeft(p.y) + 8, hullRight(p.y) - 7);
  }

  // ============================================================
  // Input
  // ============================================================
  const keys = new Set();
  const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  const JOY_R = 14;

  function toInternal(e) {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }

  cv.addEventListener("pointerdown", (e) => {
    if (state !== "playing") return;
    const [x, y] = toInternal(e);
    Object.assign(joy, { active: true, id: e.pointerId, ox: x, oy: y, dx: 0, dy: 0 });
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    const [x, y] = toInternal(e);
    let vx = x - joy.ox, vy = y - joy.oy;
    const m = Math.hypot(vx, vy);
    if (m > JOY_R) { vx = (vx / m) * JOY_R; vy = (vy / m) * JOY_R; }
    joy.dx = vx / JOY_R; joy.dy = vy / JOY_R;
  });
  const endJoy = (e) => { if (e.pointerId === joy.id) joy.active = false; };
  cv.addEventListener("pointerup", endJoy);
  cv.addEventListener("pointercancel", endJoy);

  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea")) return; // typing your name
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if ((e.code === "Enter" || e.code === "Space") && (state === "menu" || state === "over")) start();
    else if ((e.code === "KeyP" || e.code === "Escape") && (state === "playing" || state === "paused")) togglePause();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => { keys.clear(); if (state === "playing") togglePause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") togglePause(); });

  // ============================================================
  // Update
  // ============================================================
  function movePlayer(dt) {
    let ix = 0, iy = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) ix -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) ix += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) iy -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) iy += 1;
    if (joy.active) { ix += joy.dx; iy += joy.dy; }
    const m = Math.hypot(ix, iy);
    if (m > 1) { ix /= m; iy /= m; }
    const SPEED = 78;
    player.vx = ix * SPEED; player.vy = iy * SPEED;
    const decay = Math.exp(-7 * dt);
    player.kx *= decay; player.ky *= decay;
    player.x += (player.vx + player.kx) * dt;
    player.y += (player.vy + player.ky) * dt;
    collide(player);
    player.moving = m > 0.1;
    if (player.moving) player.anim += dt;
    if (ix < -0.1) player.face = -1;
    else if (ix > 0.1) player.face = 1;
  }

  function update(dt) {
    clock += dt;
    if (state === "paused") return;

    if (state === "playing") {
      time += dt;
      movePlayer(dt);
      fireTimer -= dt;
      if (fireTimer <= 0) fireVolley(difficulty(time));
    } else if (state === "menu") {
      fireTimer -= dt;
      if (fireTimer <= 0) { fireVolley(difficulty(4), true); fireTimer = rand(1.2, 2); }
    } else if (state === "dying") {
      deadTimer -= dt;
      if (deadTimer <= 0) gameOver();
    }

    for (const q of queue) { q.delay -= dt; if (q.delay <= 0) launch(q); }
    queue = queue.filter((q) => q.delay > 0);

    for (const s of shells) {
      s.t += dt;
      const p = s.t / s.dur;
      if (Math.random() < 0.5 && p < 1) {
        const gx = lerp(s.sx, s.tx, p), gy = lerp(s.sy, s.ty, p) - Math.sin(Math.PI * p) * s.arc;
        parts.push({ x: gx, y: gy, vx: rand(-4, 4), vy: rand(-4, 4), life: 0.35, max: 0.35, size: 1, colors: ["#c9c4ba", "#8a857d", "#55524d"] });
      }
      if (s.t >= s.dur) explode(s);
    }
    shells = shells.filter((s) => s.t < s.dur);

    for (const c of cannons) c.flash = Math.max(0, c.flash - dt);
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      p.life -= dt;
    }
    parts = parts.filter((p) => p.life > 0);
    rings.forEach((r) => (r.life -= dt)); rings = rings.filter((r) => r.life > 0);
    flashes.forEach((f) => (f.life -= dt)); flashes = flashes.filter((f) => f.life > 0);
    scorch.forEach((s) => (s.life -= dt)); scorch = scorch.filter((s) => s.life > 0);
    shake = Math.max(0, shake - dt);
    hurt = Math.max(0, hurt - dt);
  }

  // ============================================================
  // Render
  // ============================================================
  function drawWaves() {
    for (const w of waves) {
      const x = R(((w.x + clock * w.spd) % (W + 8)) - 4);
      ctx.fillStyle = COL.wave;
      ctx.fillRect(x, w.y, w.len, 1);
      if (Math.sin(clock * 2 + w.y) > 0.6) { ctx.fillStyle = COL.waveHi; ctx.fillRect(x + 1, w.y, 1, 1); }
    }
  }

  function drawFoam(list, oy) {
    ctx.fillStyle = COL.foam;
    for (let i = 0; i < list.length; i++) {
      if (Math.sin(i * 1.7 + clock * 2.3) + Math.sin(i * 0.31 - clock * 1.1) > 0.7) {
        ctx.fillRect(list[i][0], list[i][1] + oy, 1, 1);
      }
    }
  }

  function drawCannons(bob) {
    for (const c of cannons) {
      const by = 33 + bob, rec = c.flash > 0 ? 2 : 0;
      ctx.fillStyle = COL.outline; ctx.fillRect(c.x - 6, by - 1, 12, 8);
      ctx.fillStyle = "#5b4030"; ctx.fillRect(c.x - 5, by, 10, 6);
      ctx.fillStyle = "#3a281e"; ctx.fillRect(c.x - 5, by + 5, 10, 1);
      ctx.fillStyle = COL.outline; ctx.fillRect(c.x - 3, by + 2 - rec, 6, 14);
      ctx.fillStyle = COL.iron; ctx.fillRect(c.x - 2, by + 3 - rec, 4, 12);
      ctx.fillStyle = COL.ironHi; ctx.fillRect(c.x - 1, by + 3 - rec, 1, 11);
      ctx.fillStyle = "#08070a"; ctx.fillRect(c.x - 1, by + 14 - rec, 2, 1);
      if (c.flash > 0.07) { disc(ctx, c.x, by + 17, 3, "#ffe7a8"); disc(ctx, c.x, by + 17, 1, "#ffffff"); }
    }
  }

  function drawPlayer() {
    ellipse(ctx, player.x, player.y, 4, 1, "rgba(0,0,0,0.3)");
    const frames = player.face < 0 ? playerFrames.left : playerFrames.right;
    const f = player.moving ? Math.floor(player.anim * 8) % 2 : 0;
    ctx.drawImage(frames[f], R(player.x) - 4, R(player.y) - 10);
  }

  function drawDigits(str, cx, y, s) {
    const widthOf = (ch) => (ch === "." ? 1 : 3) * s + s;
    let total = [...str].reduce((a, ch) => a + widthOf(ch), -s);
    let x = R(cx - total / 2);
    for (const ch of str) {
      const g = DIGITS[ch];
      if (!g) continue;
      for (const [ox, oy, col] of [[-1, 0, COL.outline], [1, 0, COL.outline], [0, -1, COL.outline], [0, 1, COL.outline], [0, 0, "#f2f0e9"]]) {
        ctx.fillStyle = col;
        g.forEach((row, ry) => [...row].forEach((b, rx) => {
          if (b === "1") ctx.fillRect(x + rx * s + ox, y + ry * s + oy, s, s);
        }));
      }
      x += widthOf(ch);
    }
  }

  function render() {
    ctx.save();
    if (shake > 0) ctx.translate(R(rand(-2, 2)), R(rand(-2, 2)));

    ctx.fillStyle = COL.water;
    ctx.fillRect(-4, -4, W + 8, H + 8);
    drawWaves();
    drawFoam(foamP, 0);

    const bob = R(Math.sin(clock * 1.4));
    drawFoam(foamE, bob);
    ctx.drawImage(enemyCanvas, 0, bob);
    drawCannons(bob);

    ctx.drawImage(boatCanvas, 0, 0);

    for (const s of scorch) {
      ctx.globalAlpha = 0.45 * Math.min(1, s.life / 3);
      disc(ctx, s.x, s.y, s.r, "#1c120c");
    }
    ctx.globalAlpha = 1;

    // No landing markers: the shell's shadow on the deck is your only clue.
    // It slides along under the shell and grows as it comes down.
    for (const s of shells) {
      const p = s.t / s.dur;
      ellipse(ctx, lerp(s.sx, s.tx, p), lerp(s.sy, s.ty, p), R(1 + p * s.r * 0.3), R(p * s.r * 0.12), "rgba(0,0,0,0.35)");
    }

    if (state === "playing" || state === "paused" || state === "menu") drawPlayer();

    for (const s of shells) {
      const p = s.t / s.dur;
      const gx = lerp(s.sx, s.tx, p), gy = lerp(s.sy, s.ty, p) - Math.sin(Math.PI * p) * s.arc;
      const img = s.mega ? ballMega : s.big ? ballBig : ballSmall;
      ctx.drawImage(img, R(gx - img.width / 2), R(gy - img.height / 2));
    }

    for (const p of parts) {
      const f = 1 - p.life / p.max;
      ctx.fillStyle = p.colors[Math.min(p.colors.length - 1, Math.floor(f * p.colors.length))];
      ctx.fillRect(R(p.x), R(p.y), p.size, p.size);
    }
    for (const r of rings) {
      ctx.globalAlpha = r.life / r.max;
      pxRing(ctx, r.x, r.y, R(lerp(r.r1, r.r0, r.life / r.max)), "#ffd9a0");
    }
    ctx.globalAlpha = 1;
    for (const f of flashes) disc(ctx, f.x, f.y, f.r, "#fff6d8");

    ctx.restore();

    // HUD
    if (state !== "menu" && state !== "over") {
      drawDigits(time.toFixed(1), W / 2, 5, 2);
    }

    if (joy.active) {
      ctx.globalAlpha = 0.35;
      pxRing(ctx, joy.ox, joy.oy, JOY_R, "#ffffff");
      disc(ctx, joy.ox + joy.dx * JOY_R, joy.oy + joy.dy * JOY_R, 4, "#ffffff");
      ctx.globalAlpha = 1;
    }

    if (hurt > 0) {
      ctx.fillStyle = `rgba(217, 60, 40, ${hurt * 1.2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ============================================================
  // Flow: start / pause / game over
  // ============================================================
  const $ = (id) => document.getElementById(id);
  const show = (id) => ["ov-start", "ov-pause", "ov-over"].forEach((o) => $(o).classList.toggle("hidden", o !== id));

  // Testing shortcut: ?from=40 starts the clock at 40s. Test runs never count as a best or get posted.
  const TEST_FROM = parseFloat(new URLSearchParams(location.search).get("from")) || 0;

  const getBest = () => parseFloat(localStorage.getItem(BEST_KEY) || "0");
  function showBest() {
    const b = getBest();
    document.querySelectorAll("[data-best]").forEach((el) => (el.textContent = b ? `${b.toFixed(1)}s` : "—"));
  }

  function start() {
    if (state === "playing") return;
    Sound.unlock();
    state = "playing";
    // testing shortcut: add ?from=40 to the address to start 40 seconds in
    time = TEST_FROM;
    shake = 0; hurt = 0;
    fireTimer = 0.8;
    shells = []; queue = []; parts = []; scorch = []; rings = []; flashes = [];
    Object.assign(player, { x: 120, y: 140, vx: 0, vy: 0, kx: 0, ky: 0, moving: false, anim: 0, face: 1 });
    show(null);
    cv.focus();
  }

  function togglePause() {
    if (state === "playing") { state = "paused"; keys.clear(); joy.active = false; show("ov-pause"); }
    else if (state === "paused") { state = "playing"; show(null); cv.focus(); }
  }

  function gameOver() {
    state = "over";
    const score = Math.floor(time * 10) / 10;
    const best = getBest();
    const isBest = !TEST_FROM && score > best;
    if (isBest) localStorage.setItem(BEST_KEY, String(score));
    $("final-time").textContent = `${score.toFixed(1)}s`;
    $("new-best").classList.toggle("hidden", !isBest);
    showBest();
    show("ov-over");
    // The leaderboard will listen for this once the database is connected
    if (!TEST_FROM) window.dispatchEvent(new CustomEvent("game:over", { detail: { game: GAME_ID, score } }));
  }

  $("btn-start").addEventListener("click", start);
  $("btn-again").addEventListener("click", start);
  $("btn-resume").addEventListener("click", togglePause);
  const muteBtn = $("btn-mute");
  const syncMute = () => { muteBtn.classList.toggle("off", Sound.muted); muteBtn.setAttribute("aria-label", Sound.muted ? "Sound off" : "Sound on"); };
  muteBtn.addEventListener("click", () => { Sound.toggle(); syncMute(); });
  syncMute();
  showBest();

  // ============================================================
  // Main loop
  // ============================================================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
