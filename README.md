# Zak's Games

A personal games website. Plain HTML/CSS/JS with no build step, so it can be hosted for free anywhere.

## Run it locally

```bash
npx http-server . -p 8080 -c-1
```

Then open http://localhost:8080

## Files

| File | What it does |
| --- | --- |
| `css/style.css` | All styling. Theme colours are at the top (`--accent` is the orange). |
| `js/site.js` | Site name, list of games, icons, shared header/footer, and generated game cover art. |
| `index.html` | Home page |
| `games.html` | All games |
| `players.html` | Player maker (coming soon) |
| `ideas.html` | Ideas board (coming soon) |
| `leaderboard.html` | Scores (empty until the database is hooked up) |

## Change the name

Edit `SITE` at the top of `js/site.js`.

## Add a game

1. Put the game in `games/<game-id>/index.html`.
2. Add it to `GAMES` in `js/site.js` and set `status: "live"`.

## Connect the leaderboard database (Supabase, free)

1. Sign up at https://supabase.com and click **New project** (Free plan). Pick a region near you.
2. Open **SQL Editor** → **New query**, paste everything from `supabase/schema.sql`, click **Run**.
3. Open **Project Settings** → **API Keys** and copy the **publishable** key (or the legacy **anon public** key).
   Your **Project URL** is under **Project Settings** → **Data API** (looks like `https://xxxx.supabase.co`).
4. Paste both into `js/config.js`.

Both values are safe to be public. Never paste the **secret** / **service_role** key anywhere in this site.

To remove a bad score: Supabase → **Table Editor** → `scores` → select the row → delete.

When you add a new game, add its id to the `game in (...)` list in `supabase/schema.sql` and run that policy again.

## Free hosting plan

- **Website:** GitHub Pages or Cloudflare Pages (both free, both serve this folder as-is).
- **Database (leaderboards, players, ideas):** Supabase free tier. It's a Postgres database
  you can call straight from the browser, so no server is needed.
