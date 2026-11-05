// ============================================================
// "Post your score" form for any game.
// The game fires:  window.dispatchEvent(new CustomEvent("game:over", { detail: { game, score } }))
// The page needs: <form id="post-form"> with <input id="player-name">, and <p id="post-status">
// ============================================================
(() => {
  const form = document.getElementById("post-form");
  const input = document.getElementById("player-name");
  const status = document.getElementById("post-status");
  if (!form || !input || !status) return;

  const root = document.body.dataset.root || "";
  const NAME_KEY = "player-name";
  input.value = localStorage.getItem(NAME_KEY) || "";
  let pending = null;

  if (!DB.enabled) {
    form.classList.add("hidden");
    status.textContent = "Online leaderboard not connected yet";
  }

  window.addEventListener("game:over", (e) => {
    pending = e.detail;
    if (!DB.enabled) return;
    form.classList.remove("hidden");
    form.querySelector("button").disabled = false;
    input.disabled = false;
    status.textContent = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pending) return;
    const name = DB.cleanName(input.value);
    if (!name) { status.textContent = "Type a name (letters and numbers)"; input.focus(); return; }
    localStorage.setItem(NAME_KEY, name);
    const btn = form.querySelector("button");
    btn.disabled = true; input.disabled = true;
    status.textContent = "Posting...";
    try {
      const { rank } = await DB.submitScore(pending.game, name, pending.score);
      pending = null;
      form.classList.add("hidden");
      status.innerHTML = `Posted! You're <b class="accent">#${rank}</b> all-time. <a href="${root}leaderboard.html?game=${encodeURIComponent(e.target.dataset.game || "")}">See leaderboard</a>`;
    } catch (err) {
      console.error(err);
      btn.disabled = false; input.disabled = false;
      status.textContent = "Couldn't post. Try again?";
    }
  });
})();
