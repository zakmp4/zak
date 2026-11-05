// ============================================================
// DB — talks to the Supabase database over plain fetch (no library).
// Needs js/config.js loaded first.
// ============================================================
const DB = (() => {
  // accepts "https://xxxx.supabase.co" with or without "/rest/v1/" on the end
  const url = (window.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const key = window.SUPABASE_ANON_KEY || "";
  const enabled = Boolean(url && key);

  const headers = { apikey: key, "Content-Type": "application/json" };
  // older "anon" keys are JWTs (start with eyJ) and also go in Authorization
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  async function req(path, opts = {}) {
    if (!enabled) throw new Error("Database not connected yet (fill in js/config.js)");
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...opts,
      headers: { ...headers, ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`Database error ${res.status}: ${await res.text()}`);
    return res;
  }

  async function count(path) {
    const res = await req(path, { method: "HEAD", headers: { Prefer: "count=exact" } });
    const range = res.headers.get("content-range") || ""; // looks like "0-9/123" or "*/123"
    return Number(range.split("/")[1]) || 0;
  }

  const weekAgo = () => new Date(Date.now() - 7 * 864e5).toISOString();

  // Only letters, numbers, spaces, - and _, max 16 (the database checks this too)
  const cleanName = (name) => String(name).replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 16);

  return {
    enabled,
    cleanName,

    async topScores({ game, limit = 10, thisWeek = false } = {}) {
      const q = new URLSearchParams({ select: "name,game,score,created_at", order: "score.desc,created_at.asc", limit });
      if (game) q.append("game", `eq.${game}`);
      if (thisWeek) q.append("created_at", `gte.${weekAgo()}`);
      return (await req(`scores?${q}`)).json();
    },

    async submitScore(game, name, score) {
      name = cleanName(name);
      if (!name) throw new Error("Pick a name first");
      await req("scores", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ game, name, score }),
      });
      // your rank = how many scores beat yours, plus one
      const better = await count(`scores?select=id&game=eq.${encodeURIComponent(game)}&score=gt.${score}`);
      return { rank: better + 1 };
    },

    countScores: () => count("scores?select=id"),

    async countPlayers() {
      const rows = await (await req("scores?select=name&limit=5000")).json();
      return new Set(rows.map((r) => r.name.toLowerCase())).size;
    },
  };
})();

// Show a score the right way for its game (Broadside = seconds)
function formatScore(gameId, score) {
  const g = (typeof GAMES !== "undefined" ? GAMES : []).find((x) => x.id === gameId);
  const n = Number(score);
  return g && g.unit === "s" ? `${n.toFixed(1)}s` : String(n);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
