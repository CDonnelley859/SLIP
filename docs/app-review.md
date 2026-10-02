# Slip app review — bugs and UI suggestions

Scope: whole `src/` app plus `api/`. PR #1 (API credentials to env vars, results cron) is deliberately not duplicated here.
Items marked **FIXED** are in the accompanying draft PR. A second pass fixed most of the rest (see "Second pass" below); what remains is listed there too.

## Second pass (after "fix the lot")
Fixed: #4 deterministic virtual settlement (seeded by race id), #6 stable horse ids (matched by name, withdrawn flagged), #7 client `syncResults` no longer settles unmatched winners, #13 name change propagates to groups, #14 Spindle delete now hides instead of deleting picks, #15 PRINT SLIP always tappable with a "pick race N" nudge, #16 shared `lib/stats.ts` + error states, #17 not-found states, #19 (stats fetch errors only), #20 unique 4/6-char join codes without lookalike characters, #21 `settled:true` on host/client scored picks, live Lobby members/standings (leavers excluded), dead code removed (Auth, NamePrompt, PageShell, NavLink, Stalls, supabase client — `tsc` is now clean), `viewport-fit=cover`, reduced-motion skips the print animation, keyboard access on Index group cards, aria labels + picked indicator on Gallop race buttons, multi-track hint on Index, package name.

Not changed (needs your call or touches PR #1 files): #5 `/api/notify` auth and the `api/cron-results` equivalents of #7/#21 (PR #1 territory); #18 UTC/local date (only matters 00:00–01:00); #19 Firestore rules / friend privacy (needs rules in repo); Spindle losing the track name for wiped virtual cards (needs `trackName` stored on the scrum); ESLint `no-explicit-any` clean-up; larger visual/design-system work (below).

## Bugs (prioritised)

### High
1. **FIXED – Print Slip wipes scores of settled races** (`Gallop.tsx` `handleSubmit`). It rewrote every pick, including already-scored ones, with `points: null`. Settled races are never re-scored, so Lobby / Mega standings / Stats lose those points (Slip itself still shows them because it derives from race docs, so the numbers disagree). Now only open races are written.
2. **FIXED – Spindle loses horse names and race numbers for virtual slips after the daily wipe** (`Spindle.tsx`). Horse showed "—" and race number fell back to list position. Slip.tsx already fell back to `pick.horseName`/`pick.raceNumber`; Spindle now does too. (Track name is still lost → "VIRTUAL TRACK"; store `trackName` on the scrum at creation to fix properly.)
3. **FIXED – Invite links create nameless players / hang** (`JoinViaLink`, `JoinMegaViaLink`). A first-time visitor has no handle: `/join/:code` joined with an empty name (blank row in standings); `/join-mega/:code` sat on "Joining…" forever. Both now ask for a name first.
4. **Virtual race settlement is not deterministic** (`virtualTrack.ts` `settleCardRaces`). Each client shuffles horses itself and writes winners; two clients settling the same race at once can write different winners and score picks against a mix. Fix: seed the shuffle from `raceId`+date, or settle in the cron (`api/cron-virtual-track`) only.
5. **`/api/notify` is unauthenticated** (`api/notify.ts`): anyone can POST any scrumId/winners and push notifications to its members. Needs a shared secret or server-side result lookup. (api/ left alone because of PR #1.)
6. **Horse IDs are index-based** (`racingApi.ts`: `${raceId}-h${idx+1}`). If a non-runner is removed between syncs, indices shift and existing picks silently point at a different horse. Key by the API's horse id instead.
7. **Client `syncResults` settles a race even if the winner can't be matched by name**, permanently scoring everyone 0 (the cron version correctly skips). Skip when `winners.first` is null.

### Medium
8. **FIXED – Silent pick failures** (`Gallop.handlePick`): optimistic update, error swallowed. Now rolls back and toasts.
9. **FIXED – `Index.loadData` could loop forever** if seeding fails (seed → reload → needs seed → …). Reseed now throttled to once a minute.
10. **FIXED – Lobby snapshot leak**: unmounting before the async load finished left the listener subscribed.
11. **FIXED – Hard-coded `slip-racing.vercel.app`** in Lobby/Slip share links → now `window.location.origin`.
12. **FIXED – `tsc` error in `App.tsx`** (page variants `ease` typing).
13. **Changing your name in Settings doesn't update existing groups** – `scrumMembers.handle` / `megaSlipMembers.handle` keep the old name.
14. **Deleting a slip from the Spindle deletes its picks**, so it also vanishes from Stats/Crew/Friend stats. Consider hiding instead of deleting.
15. **PRINT SLIP is disabled with no explanation** when picks are missing, and permanently when every race has already started (`allPicked` requires ≥1 open race). Let it be tappable → toast + jump to first unpicked race; allow when nothing is open.
16. **Stats / CrewPage / FriendProfile have no error handling** – a Firestore error leaves the skeleton forever. The same ~40-line stats computation is copy-pasted 3×; extract it.
17. **Slip / HostResults on an unknown scrum id render a blank page** (early `return` with no error state).
18. **UTC vs local date mismatch**: real cards use `toISOString().slice(0,10)` (UTC) while virtual cards use local date. Between 00:00–01:00 BST "today" differs.
19. **Anyone can add anyone as a friend and view their stats by URL** (`/profile/:id`), and all authorisation is client-side (host-only pages, Firestore rules unknown). Worth checking `firestore.rules` — none are in the repo.
20. Join code collisions: 4-char random codes have no uniqueness check, and `Math.random().toString(36).slice(2,6)` can occasionally be <4 chars.
21. `HostResults` / `cron-results` don't set `settled:true` on picks like the virtual path does (Slip uses it as a fallback after wipes).

### Low / housekeeping
- Dead code: `Auth.tsx`, `NamePrompt.tsx`, `PageShell.tsx`, `NavLink.tsx`, `integrations/supabase/*`, `supabase/functions/*`, `Stalls.tsx`, `SlipDesigns.tsx` (routes don't use them). Auth.tsx and the supabase client are the remaining `tsc` errors.
- Legacy `/scrum/new` and `/scrum/join` routes duplicate the Index flows (join form can't take 6-char mega codes).
- ESLint: ~30 `no-explicit-any` errors (mostly `api/` and `racingApi.ts`); `react-hooks/exhaustive-deps` suppressed in several effects.
- `package.json` name is still `vite_react_shadcn_ts`; `vite.config.ts` imports `lovable-tagger`; 1 MB single JS chunk (no code splitting; framer-motion + firebase).
- **FIXED** `manifest.json` theme/background colours were white/black, not the app green.

## UI suggestions (not implemented — for the design pass)
- **Accessibility**: almost no `aria-*` anywhere; clickable `<div onClick>` cards (Index active groups, Spindle) aren't keyboard/screen-reader reachable; race selector buttons in Gallop are bare numbers; cream-on-green at 9–10px mono text with 0.4–0.6 opacity is below WCAG contrast; locked state is conveyed by strikethrough + opacity only.
- **Design system**: every page hand-writes inline `style={{…}}` with the same borders/labels/buttons; `btn-retro`, `label`, `display` classes exist but ~90% of buttons are inline. Extract `Button`, `Field` (floating label input), `Card`, `PageHeader`, `ConfirmRow` — also the big win for Claude Design handoff. The shadcn `components/ui/*` set is unused.
- **Discoverability**: selecting several tracks silently turns "Create group" into a Mega group — add a hint ("Tap more tracks for a Mega group"). The Index carousel shows all 12 virtual slots including finished ones; dim/hide past tracks and don't allow creating groups on them.
- **Index**: selected vs unselected card borders are identical in code (colour fill only); "SWIPE FOR MORE" disappears the fold; header uses three text links — consider a bottom nav (Paddock / Spindle / Settings).
- **Lobby/MegaHub**: "PICKS LOCKED" label is really "first race started" — picks lock per race. Show per-race lock times / next lock. Standings aren't live for new members, and members who left still appear.
- **Gallop**: show picked count ("4/6 picked") and a progress dot per race in the header; make the swipe affordance visible; `NEXT OPEN →` and PRINT SLIP deserve larger tap targets; add haptic/undo for mis-taps.
- **Slip**: ticket text at 9–10px is hard to read; sticky send footer ignores iOS safe-area (`viewport-fit=cover` + `env(safe-area-inset-bottom)`); print animation can't be skipped (respect `prefers-reduced-motion`).
- **Empty/error states** are plain text; add retry buttons and friendlier copy ("Couldn't load — tap to retry").
- **PWA**: only an SVG icon (add 192/512 PNG + maskable, apple-touch-icon); no offline shell; no OG image.
- Copy: mixed terminology (PEN / PADDOCK / LOBBY / HUB, GROUP / SCRUM / SLIP / MEGA) — pick one vocabulary.
