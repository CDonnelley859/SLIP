
# SLIP — Race-Day Companion (v1)

A mobile-first social app where friends form a "Scrum," ink picks across a 6-race Daily Card sourced from a real racing API, and watch live results settle into a winner. Built on Lovable Cloud with email/password auth and a Modern Turf aesthetic (deep racing green, brass gold, cream).

## Core game loop

1. **Paddock (home)** — Big Board of upcoming cards + carousel of Active Slips
2. **Stalls (lobby)** — Scrum gathers, sees track/horses/jockey caps, post-time countdown
3. **Daily Gallop (program)** — Ink one horse per race for all 6 races
4. **Validation** — Top-down "print" animation of the slip
5. **Live tracking** — Results stream in race-by-race; Home button to check other slips
6. **Settlement** — Winner crowned with "Hoof Slam"; slip moves to The Spindle

## Pages & routes

- `/` — Paddock (Big Board + Active Slips + nav hub)
- `/auth` — Sign in / sign up (email + password, minimal profile: handle + cap color)
- `/scrum/new` — Pick a card, name the Scrum, get a join code
- `/scrum/join` — Enter join code
- `/scrum/:id/stalls` — Lobby with countdown and roster
- `/scrum/:id/gallop` — Program: 6 races, ink picks
- `/scrum/:id/slip` — Validated slip + live results
- `/spindle` — Archive of completed slips with leaderboards
- `/spindle/:id` — Archived slip detail
- `/stats` — Hoofprints (group wins), podium counts
- `/silk-shop` — Placeholder for v1 (cap color picker only)

## Scoring (Win / Place / Show)

Per race: **5 pts** if your pick wins, **3 pts** for 2nd, **1 pt** for 3rd, 0 otherwise.
Slip total = sum across the 6 races. Group champion = highest total; ties broken by most wins, then earliest pick submission.

## Data model (Lovable Cloud / Postgres + RLS)

- `profiles` — id (auth.users fk), handle, cap_color, created_at
- `cards` — id, track_name, race_date, post_time, source_id, status (`upcoming|live|settled`)
- `races` — id, card_id, race_number (1–6), name, off_time, status, winners jsonb (1st/2nd/3rd horse_ids)
- `horses` — id, race_id, number, name, jockey, odds
- `scrums` — id, card_id, host_id, name, join_code (unique 6-char), created_at
- `scrum_members` — scrum_id, user_id, joined_at (PK composite)
- `picks` — id, scrum_id, user_id, race_id, horse_id, points (nullable until settled), created_at
- `scrum_results` — scrum_id, user_id, total_points, wins, place, show, rank, finalized_at

RLS: members can read their scrum's data; only the picker can insert/update their own picks (and only before `off_time`); cards/races/horses are public-read.

## Backend (Edge Functions)

- `sync-cards` — Pulls upcoming cards + races + horses from your racing API, upserts. Triggered manually for v1; cron-ready.
- `sync-results` — Polls a single card's race results, writes winners, scores all picks for that race, updates `scrum_results`. Called on-demand from the slip view; cron-ready.
- `create-scrum` / `join-scrum` — Generates/validates join codes, enforces card status.
- `submit-picks` — Validates one pick per race, all before post time, writes atomically.

API key for your racing provider stored as a Lovable Cloud secret; never exposed client-side.

## Real-time

Use Supabase Realtime channels per scrum to push: new member joined, picks locked, race settled, final standings. Slip view subscribes; Paddock cards update score/progress live.

## Visual design — Modern Turf

- Palette (HSL tokens in `index.css`): bg `#0f2a1d`, surface `#1a4a32`, brass `#c9a84c`, cream `#f5f0e0`
- Typography: display serif (Playfair / Fraunces) for "SLIP," "PADDOCK," race numbers; humanist sans (Inter or Manrope) for body
- Slip = cream paper texture, perforated edges, monospace race lines, brass embossed logo
- Animations (framer-motion): top-down "print" reveal on validation, stamp-down "Hoof Slam" on settlement, jockey-cap avatars sliding into the lobby

## Build phases

**Phase 1 — Foundation**
- Enable Lovable Cloud, set up auth + profiles table + minimal sign-up
- Apply Modern Turf design system in `index.css` + `tailwind.config.ts`
- Build Paddock shell with empty states

**Phase 2 — Real race data**
- Add racing API key as a secret
- Implement `sync-cards` edge function and a "Refresh Big Board" admin action
- Render Big Board cards from `cards` table

**Phase 3 — Scrum lifecycle**
- Create/join scrum flows, Stalls lobby with countdown
- Daily Gallop program with ink-X selection UX
- `submit-picks` with post-time guardrail
- Print animation + slip view

**Phase 4 — Results & settlement**
- `sync-results` edge function with W/P/S scoring
- Live slip updates via Realtime, Hoof Slam on final race
- Move settled slips to Spindle, write `scrum_results`

**Phase 5 — Stats, polish, archive**
- Spindle archive view + per-slip detail
- Stats page (Hoofprints, podiums)
- Empty/loading/error states, mobile polish at 411px

## Out of scope for v1

- Real money / wagering of any kind
- Push notifications (in-app realtime only)
- Silk Shop commerce (cap color picker only)
- Native iOS/Android wrappers (PWA-ready web app)
- Global leaderboards across scrums

## Open items I'll confirm during build

- Your racing API provider name + the exact endpoint shape (so `sync-cards` maps fields correctly) — I'll request the API key via the secrets tool right after Phase 1
- Default card size — spec says 6 races; confirm whether tracks with fewer/more races should be filtered out or padded

## What I need from you to start

Approve this plan, then I'll begin Phase 1 (Cloud + auth + design system + Paddock shell). I'll ask for your racing API key at the start of Phase 2.
