-- ============================================================
-- Leaderboard database setup
-- Run this ONCE in Supabase: SQL Editor -> New query -> paste all of this -> Run
-- ============================================================

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  game        text        not null,
  name        text        not null,
  score       numeric(10, 1) not null,
  created_at  timestamptz not null default now(),

  -- names: 1-16 letters, numbers, spaces, - or _
  constraint name_ok  check (name ~ '^[A-Za-z0-9 _-]{1,16}$'),
  -- no silly scores (Broadside is in seconds, so an hour is the cap)
  constraint score_ok check (score > 0 and score < 3600)
);

create index if not exists scores_game_score_idx on public.scores (game, score desc);
create index if not exists scores_created_idx    on public.scores (created_at);

-- Row Level Security: the website key can only do what the policies below allow.
alter table public.scores enable row level security;

grant select, insert on public.scores to anon, authenticated;

-- Anyone can read the leaderboard
drop policy if exists "anyone can read scores" on public.scores;
create policy "anyone can read scores"
  on public.scores for select
  to anon, authenticated
  using (true);

-- Anyone can post a score, but only for games that exist.
-- When you add a new game, add its id to this list and run this part again.
drop policy if exists "anyone can post scores" on public.scores;
create policy "anyone can post scores"
  on public.scores for insert
  to anon, authenticated
  with check (game in ('broadside'));

-- There are no update/delete policies, so nobody can change or remove scores
-- from the website. You can still delete bad ones in Table Editor.
