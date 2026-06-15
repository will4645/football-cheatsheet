# Cheat Sheets — Claude Instructions

At the start of every session, read RUNBOOK.md in this folder. It contains all services, costs, account logins, API keys, Stripe IDs, Supabase details, and everything else needed to work on this project. Always refer to it before making decisions about infrastructure, credentials, or costs.

## Project

Next.js 14.2 SaaS — cheatsheets.co.uk
Football betting cheatsheets with Clerk auth, Stripe subscriptions, Supabase database, Vercel hosting.

## Stack

- Framework: Next.js 14.2 (App Router), TypeScript
- Auth: Clerk (production instance ins_3DzqRHW8qTzrMATI6eoGcWVOmmW)
- Payments: Stripe live mode (acct_1TZCpm2Ly6cgjatR) — £9.99/mo or £79.99/yr, 4-day free trial
- Database: Supabase (project znvgalucggakvaphfgri) — `match_cache` table, key/value JSONB
- Hosting: Vercel Pro (project football-cheatsheet, team cheatsheets)
- Data: api-sports.io (£29/mo, 75,000 req/day) for AF player stats; ESPN internal API (free) for lineups

## Rules — ALWAYS FOLLOW

- Never use em dashes in any user-facing text. Use colons, commas, or periods instead.
- Never commit RUNBOOK.md — it contains live secrets.
- Never commit .env files (.env.tmp, .env.vercel.tmp are also gitignored — keep it that way).
- Deploy with: `vercel --prod` from the project folder.
- Domain is cheatsheets.co.uk — never reference football-cheatsheet.vercel.app in user-facing code.
- Always ask before removing or restructuring anything that already works.
- Update this CLAUDE.md at the end of any session that changes architecture, adds features, or fixes bugs.

## Data Pipeline

Three data sources, combined per match:
1. **football-data.org** (free) — match discovery only, no player data
2. **API-Football / api-sports.io** — player stats, squad history, odds, referee. Key: `API_SPORTS_KEY`
3. **ESPN internal API** (free) — lineups, per-game player stats

Three cron jobs:
- **Prefetch (7am UTC daily)**: pre-warms AF data into Supabase caches (`pc:hist:*`, `pc:squad:*`, `pc:players:*`, `pc:odds:*`, `pc:ref:*`). Also runs the daily cache cleanup (`kvDeleteOlderThan`) so stale `prefetch:*`/`pc:*` rows can't crowd out the sync route's 60-row prefetch norm-scan
- **Prefetch (11am UTC daily)**: second run — belt-and-suspenders for teams the 7am run missed
- **Sync (every 5 min)**: reads prefetch cache + ESPN lineups → writes `match:{slug}` sheets. After the main pass, a **lineup watch loop** (150s budget) polls ESPN every ~25s for matches 0.75h..1.6h around kickoff that still lack lineups, and re-runs the sync the moment rosters appear — sheets drop ~30-90s after lineups instead of waiting for the next cron tick. `?watch=0` disables it

## Key Files — Do NOT touch carelessly

| File | Purpose |
|------|---------|
| `lib/api-football.ts` | All AF + ESPN fetching. Has retry logic, parallel ESPN batches, cleanForSearch prefix stripping |
| `lib/prefetch.ts` | Morning cron: pre-warms AF data. `PERSONAL_HISTORY_LEAGUES` controls per-player history fetch. `resolveAfId` 7-step name resolution |
| `app/api/sync/route.ts` | 5-min cron: builds match sheets. `bestLast5()` source selection, `buildPlayers()` aggregation, ESPN fallback, on-demand re-prefetch |
| `app/api/prefetch/route.ts` | HTTP endpoint for the prefetch cron |
| `components/MatchSheet.tsx` | Cheatsheet UI. `Last5Dots` + `CardDots` render player stat dots |
| `data/match.ts` | TypeScript types for match/player data |
| `lib/competitions.ts` | Competition config and slug mapping |
| `lib/store.ts` | Supabase KV helpers (`kvGet`, `kvSet`, `sbGet`) |

## Player Dots System

Each player shows 5 dots per stat: fouls committed, fouls won, shots on target, total shots, goals, assists, cards, saves (GK only).

**Source priority inside `bestLast5()`:**
1. Personal history (`perPlayerHistory`) — true last 5 games across ALL competitions per player by AF ID. Only used when `personalNonZero > bestOtherNonZero` OR (`personalNonZero >= bestOtherNonZero` AND full 5-game window, no gaps). **INERT as of 2026-06-12:** AF v3 `/fixtures` has no `player` param (`"The Player field do not exist."`), so this source has always returned empty in production — `fetchPlayerPersonalHistoryBatch` now probes once and bails instead of wasting 2 AF calls per player. If AF ever adds the param the probe auto-heals on next cold start.
2. AF team history (`afHistory`) — last 15 fixtures from `/fixtures/players?fixture=X&team=Y`, all comps, newest-first. **This is the de-facto primary source for dots.**
3. ESPN team history (`espnHistory`) — from ESPN event summaries, fetched live at sync time.

**Personal history leagues**: `PERSONAL_HISTORY_LEAGUES = {39,140,78,135,61,2,3,848}` (top-5 + CL/EL/ECL). Championship (40) excluded: AF `/players` endpoint returns zero fouls/shots for Championship, adding noise not signal. FA Cup has no AF league ID mapping so `!leagueId` evaluates true and personal history IS fetched for FA Cup. All leagues get AF team history + ESPN fallback.

**Dot ordering**: arrays are `[oldest → newest]` left-to-right. Built by slicing newest-first array, reversing, then padding false at start for <5 games.

**Green dot thresholds**: fouls ≥1, foulsWon ≥1, SOT ≥1, shots ≥2, goals ≥1, assists ≥1, saves ≥3, yellowCards ≥1.

## Things Added Carefully — DO NOT Remove

- `afFetch` + `espnFetch` retry logic (2x on 429/5xx, 1.5s/3s backoff)
- ESPN event summaries fetched in parallel batches of 4 (was sequential)
- `cleanForSearch` strips Belgian/Scandinavian/Balkan/Dutch prefixes (KAA, KRC, KV, FK, NK, IFK, NEC, PEC, etc.)
- Word-by-word team search fallback (tries each word ≥4 chars, longest first, with/without league filter)
- Failed team lookups cached with 2h TTL (`FAILED_TTL`) to stop wasting AF quota
- `afLeagueId` threaded from prefetch route → `prefetchMatch` → team search (league-scoped)
- `espnLeagueToAfId` covers Championship(40) and all active leagues
- Guard TTL requires `cornersFor > 0` on both teams before locking sheet as fresh
- Guard also requires `hasGoodPlayers` (both teams have defensive players) — prevents locking sheets with empty player tabs
- ESPN season-stats fallback only triggers when both `shotsFor === 0 AND cornersFor === 0`
- `resolveAfId` 7-step auto-repair name resolution (see below)
- `resolveFromPrefetch` word-scan fallback — matches on words ≥5 chars when all 7 steps fail
- On-demand `fetchPlayerPersonalHistoryBatch` fallback in sync when prefetch has empty personal histories
- On-demand re-prefetch mid-sync when `fixtureHistory` is empty for either team
- ESPN player history fetched as fallback in sync when `fixtureHistory` empty and `confirmedEspnMeta` available
- `hasLineups` requires BOTH home AND away lineup confirmed before building sheet
- `?force=1` on `/api/sync` and `/api/prefetch` to bypass guards

## resolveAfId — 7-Step Name Resolution (lib/prefetch.ts)

Runs when a lineup player name doesn't match any prefetch cache key. Steps 1-4 are free (in-memory). Steps 5-7 cost 1-2 AF calls each, only fire when needed.

1. **Exact match** — lowercase both sides
2. **Surname match** — last word of lineup name matches last word of any cache key
3. **Long word match** — any word ≥6 chars in lineup name found in any cache key
4. **Short surname** — surname ≥3 chars, direct key lookup (catches "Ji" style short surnames)
5. **AF live lookup** — `lookupAfPlayerId(fullName, afTeamId)` — AF search scoped to the team
6. **Fuzzy surname** — Levenshtein edit distance ≤2 on surnames ≥5 chars, same first letter (catches typos/accent differences)
7. **AF surname search** — `lookupAfPlayerId(surname, afTeamId)` — retry with surname only

`levenshtein()` uses standard one-row DP: saves `prev = dp[0]`, sets `dp[0] = i`, then `prev = tmp` only in body. DO NOT add `dp[j-1] = prev` or `dp[b.length] = prev` — those lines corrupt the array (were present in a buggy version deployed briefly in May 2026 and caused Step 6 to return wrong distances for all inputs).

## AF League IDs Reference

PL=39, La Liga=140, Bundesliga=78, Serie A=135, Ligue 1=61, Championship=40, CL=2, EL=3, ECL=848

**Removed leagues (unreliable AF data):** Dutch/Eredivisie=88, Portuguese/Primeira Liga=94, Scottish Prem=179, Belgian=144, Turkish=203. Removed from competitions.ts, ESPN_LEAGUES, prefetch + sync routes (commit c649654).

## Force Rebuild (after fixes or data issues)

1. `/api/prefetch?secret=SYNC_SECRET&force=1` — re-runs morning prefetch for all near-term matches
2. `/api/sync?secret=SYNC_SECRET&force=1` — bypasses 6h guard, rebuilds all sheets immediately

## Quota Usage

Full 20-match Premier League day: ~2,550 AF calls (with 15-game fixture history). That is about 3.4% of the 75,000/day limit. Even with on-demand re-prefetches and two cron runs, a heavy day stays well under 10% of quota. No risk of hitting the cap.

## Known Pre-existing Issues

- **`hasGoodGoals` guard never locks 1-0 results**: FIXED 2026-06-12 — guard now sums both teams: `(homeGoals + awayGoals) > 0`.

## Sign-in Page Notes

- Sign-in on mobile shows blank when visiting a `.vercel.app` preview URL. Clerk (production mode) only allows `cheatsheets.co.uk` — must use `cheatsheets.co.uk/sign-in` on mobile.
- Clerk appearance keys used: `alternativeMethodsBlockButton`, `alternativeMethodsBlockButtonText`, `alternativeMethodsBlockButtonArrow`, `formFieldAction`, `formFieldHintText`, `footer`, `identityPreviewText`, `identityPreviewEditButton`, `formResendCodeLink`, `otpCodeFieldInput`, `userPreviewMainIdentifier`, `userPreviewSecondaryIdentifier`.

## Session Log

### 2026-05-23
- Fixed team stats mirroring bug (Championship + non-ESPN leagues) — against stats now show real opponent data

### 2026-05-24
- Fixed prefetch key mismatch: fd.org appends "FC" suffix but ESPN omits it — norm-scan + mirror-save resolves the gap
- Fixed personal history dots returning 0 — added `season=2025` fallback in `fetchPlayerPersonalHistoryBatch`
- Fixed Sunderland/Burnley/Leeds wrongly classified as Championship — moved regex to eng.1
- Added ESPN supplement match discovery in prefetch as fallback when fd.org is down
- Added batch on-demand personal history fetch at lineup time (prevents timeout on large squads)
- Added CDN caching for match API routes (force-dynamic + Cache-Control s-maxage headers)

### 2026-05-25 — Big Premier League Day (10 matches): What Broke and What Was Fixed

**Problems observed:**
- Newcastle players showing all-gray dots: 7am prefetch had fetched the team but `fixtureHistory` came back empty (AF returned no results). Sync used the empty cache and had no history to build dots from.
- Sunderland vs Chelsea stuck on "LINEUPS PENDING" all day: `hasLineups` check only tested the home team's lineup length, so when the away lineup was missing, it still tried to build the sheet and locked as pending.
- Some teams with entirely missing player sections: same root cause as above — sheets were being locked by the rebuild guard before both teams' players had been resolved.
- Sign-in mobile: tapping Sign In showed a blank white/dark screen — Clerk widget was clipped by `overflow: hidden` and `justify-center` pushing it off-screen on small phones.
- Sign-in "Email code to..." text was black on dark background (unreadable).
- Sign-in "Use another method" link overlapping "Secured by Clerk" footer text.

**Root causes and fixes:**

| Problem | Root cause | Fix |
|---------|-----------|-----|
| Gray dots (Newcastle + others) | Empty `fixtureHistory` in prefetch cache — AF returned nothing, entry stored as empty, never retried | Three-layer fix: (1) prefetch skip condition now also checks `fixtureHistory` non-empty — empty entries are retried; (2) sync does on-demand re-prefetch mid-loop when it finds empty history; (3) ESPN player history fetched as final fallback |
| "LINEUPS PENDING" stuck | `hasLineups` only checked home team lineup length | Changed to `homeLineupLen > 0 AND awayLineupLen > 0` |
| Sheets locked with empty away players | Rebuild guard had no check for player completeness | Added `hasGoodPlayers` to guard — both teams must have at least one defensive player before sheet locks |
| Single player name mismatch breaking whole team | One failed resolution caused fallback to bad data for other players | Rewrote resolution to be per-player: each player independently goes through all 7 steps + word-scan fallback; one failure does not affect others |
| Sync timing out on large match days | ESPN supplement scan was 30 days for European, 14 days for domestic — scanning far too many events | Reduced to 7 days (European/cups) and 3 days (domestic). Saves ~12s per cycle |
| Missed matches on re-prefetch days | 7am cron is the only run — if it misses a team, no retry until next day | Added 11am UTC second prefetch cron |
| Thinner dot history | Only 10 fixture history games per team | Increased to 15 — richer `afTeamStats` averages and more data for `bestLast5` |
| Sign-in mobile blank screen | `justify-center` + no overflow handling clipped Clerk widget below viewport | Changed outer div to `overflow-y-auto`; right panel to `justify-start lg:justify-center` with `pt-16 pb-12` |
| Black text on dark bg in sign-in | `alternativeMethodsBlockButtonText` not set in Clerk appearance | Added `text-gray-100` to that element key |
| Footer overlap in sign-in | `footer` element had no top margin | Added `mt-6` to `footer` element key |

**Bug found during audit (Levenshtein — committed 6ac0553):**

The `levenshtein()` function in `lib/prefetch.ts` had two lines corrupting the one-row DP array:
- `dp[j-1] = prev` inside the inner loop overwrote the just-computed `dp[i][j-1]` with stale `dp[i-1][j-1]`
- `dp[b.length] = prev` at the end of the outer loop overwrote the correctly computed final cell

Effect: `levenshtein("abc", "abc")` returned 3 instead of 0. Step 6 of `resolveAfId` (fuzzy surname matching within 2 edits) never matched any player — it was completely dead code. Fixed by removing both corrupt lines and saving `prev = dp[0]` + `dp[0] = i` before the inner loop.

**Also introduced JSX syntax error (build failed, fixed same session):**

Placed a `{/* comment */}` as a standalone node before the root `<div>` in the sign-in page return. JSX treats comments as nodes, so the return had two root children and the TypeScript compiler threw `Expected ',', got 'className'`. Deployment `3q5n5ovfq` failed. Fixed by removing the comment. Redeployed as `96fed41`.

**Current deployed commit:** `4597b0d` on master

**Remaining:**
- Test full sign-up → payment flow with a real card

### 2026-05-27 — ECL Final day (Crystal Palace vs Rayo Vallecano)

**Root cause of delayed sheet:** 7am prefetch ran but `personalHistories` was `{}` for both teams (AF returned empty for the personal history batch). All 22 confirmed starters hit the on-demand batch at lineup time, adding ~15-30s to that sync cycle. fd.org was also down all day so match was only discoverable via ESPN supplement, meaning the 11am re-prefetch likely missed it too.

**Fixes applied (4 commits, all deployed):**

| Commit | Fix |
|--------|-----|
| `95b2fd0` | **Prefetch: full squad player IDs merged into personal history batch.** `fetchApiFootballSquadStats` now returns `playerIds: Set<number>` from the `/players?team=X&season=Y` call (already being made). `prefetchMatch` merges those IDs with fixture history IDs before `fetchPlayerPersonalHistoryBatch`. `CachedSquad` updated to persist `playerIds` across cache hits. Covers new signings, rotation players, and anyone not in last 15 fixtures. |
| `e0cb06a` | **Referee TBC on neutral-venue finals fixed.** Ref lookup was using `guessDomesticLeagueId(homeName)` (returns PL=39 for Crystal Palace) to search `/fixtures?league=39`. ECL final not in PL → empty ref → TBC. Fixed: `afLeagueId = leagueId \|\| guessDomesticLeagueId(...)` so ECL final searches league=848 correctly. `prefetched.afLeagueId` not read by sync so no downstream impact. |
| `141b38c` | **potentialOpponent matching fixed.** Three bugs: (1) ESPN sends `GK`/`CDM`/`CAM`/`LCB`/`RCB`/`LWB`/`RWB` — none were MARKS keys, all fell through to formation-place fallback giving wrong opponents. Added `normalizePos()` function, applied in `playerDefaults`. (2) `opp.find()` found only 1 player per zone — strikers only showed 1 CB even when 2 exist. Changed to `opp.filter().slice()`. (3) Formation-place mirror was `12-fp` making LW (fp=11) point at GK (fp=1); fixed to `13-fp`. |
| `latest` | **normalizePos: added `LF`→`LW` and `RF`→`RW`**, removed redundant `'F':'F'` entry. |

**Current deployed commit:** `2f76193` on master

**Known limitation (not fixed):**
- Poisson odds undervalue stronger teams on neutral grounds — when AF has no market odds (common for one-off finals), Poisson uses raw goals-scored/conceded which doesn't account for league quality difference. Crystal Palace showed 38% win prob vs Opta's 50.4%.

**Remaining:**
- Test full sign-up → payment flow with a real card

### 2026-06-01 — Full codebase code review + 25 bug fixes (3 rounds)

Multi-pass automated review found and fixed 25 issues across 5 sessions. Deployed as commits `e692e16`, `0b4f1cf`, `f6edfdb`, `cf790b2`.

**Round 1 — Correctness bugs (commit e692e16)**

| Fix | Detail |
|-----|--------|
| Webhook race condition | `subscription.deleted` now checks stored `stripe_subscription_id` before upserting — prevents a late-arriving delete event overwriting a re-subscription and locking out a paying user |
| Infinite webhook retry | `stripe.customers.retrieve` in `trial_will_end` wrapped in try/catch; deleted customer returns 200 instead of 500 + Stripe retry loop |
| Checkout crash on Stripe error | `emailHadPriorSubscription` wrapped in try/catch; errors deny trial instead of crashing the checkout session with 500 |
| btts sentinel collision | `MatchOdds.btts` changed from `number` to `number \| null`; `let btts = 50` sentinel replaced with `null` in both odds functions; sync check updated to `!== null`. Symmetric 50% bookmaker odds were previously being silently replaced by Poisson model |
| Email copy | "3-day free trial" → "4-day", "ends tomorrow" subject/heading → actual charge date (Stripe fires `trial_will_end` 3 days before end by default, not 1) |
| Standings errors invisible | `fetchEspnStandings` catch now logs errors instead of `catch {}` |
| Season hardcode (partial) | `season=2025` replaced with dynamic `inferSeason()` in `fetchApiFootballOdds` and `lookupAfFixtureId` |
| `stripe_subscription_id` | Added to `getSubscription` select (needed by webhook guard) |

**Round 2 — Remaining review findings (commits 0b4f1cf + f6edfdb)**

| Fix | Detail |
|-----|--------|
| Wrong standings from league guess | `guessDomesticLeague` fallback removed from standings block — position only shown when ESPN meta confirmed the league slug |
| Checkout latency | `emailHadPriorSubscription` parallelised with `Promise.all` (was serial for loop, up to 10 sequential Stripe calls) |
| Clerk null user bypass | `currentUser()` returning null now denies trial conservatively instead of silently skipping the Stripe dedup check |
| Sync latency | Player stats fixture fetches batched 6 at a time with `Promise.all` (was serial, ~10s per live match) |
| Odds duplication | `computeOddsFromSamples` helper extracted, removing ~60 lines duplicated between `fetchApiFootballOdds` and `fetchTheOddsApiOdds` |
| Partial word match false positives | Word length threshold raised `> 3` → `> 4` in `fetchApiFootballOdds` and `lookupAfFixtureId` — "city", "real", "ajax" (4 chars) no longer cross-match wrong fixtures |
| Orphaned import | `guessDomesticLeague` removed from sync route import after standings change made it unused |

**Round 3 — Second scan found new issues (commit cf790b2)**

| Fix | Detail |
|-----|--------|
| Silent subscription loss | `upsertSubscription` now throws on Supabase error — webhooks return 500 and Stripe retries instead of silently losing the subscription write and returning 200 |
| DB error masks as "no subscription" | `getSubscription` logs non-PGRST116 errors instead of silently returning null (a DB outage previously set `trialEligible = true` for any user) |
| Open redirect | `success_url`/`cancel_url` now use `NEXT_PUBLIC_APP_URL` env var instead of the attacker-controlled `Origin` header — previously an authenticated user could craft a Stripe checkout session that redirected victims to an arbitrary domain |
| Pagination cap | `emailHadPriorSubscription` limit raised 10 → 100; `has_more` ignored before, missing prior subscriptions |
| Phone/OAuth users | Trial denial for no-email users now emits `console.warn` with userId for observability |
| Welcome email subject | Conditional: "your trial has started" only when `trialEnd` is non-null; direct subscribers no longer get the wrong subject |
| null `stripe_subscription_id` guard bypass | Guard condition changed to `stored && stored.stripe_subscription_id !== sub.id` — protects rows where column is null (old rows pre-migration) |
| Double DB lookup | `clerkUserId` patched onto `sub.metadata` before calling `handleSubscription` in delete path — eliminates second `getClerkUserIdFromCustomer` Supabase call |
| Season hardcodes (remaining 5) | `inferSeason(date)` helper exported from `api-football.ts`; replaces all remaining `season=2025` hardcodes in `fetchApiFootballTeamHistory`, `fetchApiFootballRefereeByLeague`, `fetchPlayerPersonalHistoryBatch`, `lookupAfPlayerId`, and `fetchAfFixturesByDateRange`. Also fixes word match threshold in `fetchApiFootballRefereeByLeague` (was missed in round 2) |
| Batch error visibility | Fixture stats batch `catch {}` now logs the error and fixture ID |

**Current deployed commit:** `cf790b2` on master

### 2026-06-05 — Multi-agent codebase scan + 12 bug fixes

Second full multi-agent review (5 finder angles + verification + sweep pass). Found and fixed 12 issues. Deployed as commit `807dfb3`.

| Fix | Detail |
|-----|--------|
| sign-up verification trigger | `prepareEmailAddressVerification` was guarded by `!== 'unverified'` (inverted) — condition changed to `=== 'unverified'` so the code sends the email code at the right time |
| `getMatches`/`getUpcoming` null fallback | `kvGet` not awaited before `?? []` in `lib/store.ts` — `?? []` was applied to the Promise object (always truthy), callers received `null` instead of `[]` when key missing |
| Referee fixture match | `fetchApiFootballRefereeByLeague` used `homeMatch \|\| awayMatch` — would return any fixture involving either team on the date, not the specific match. Changed to `&&` |
| `over95SoT` threshold | `overProb(sotFor + sotAgainst, 6.5)` — threshold was 6.5 not 9.5, making over-9.5-SoT probability ~2x inflated on every sheet |
| Null odds poisoning cache | `pc:odds:` kvSet fired unconditionally when `needOdds` was true, even when `freshOdds` was null — overwrote valid cached odds with null for the full TTL. Added `&& freshOdds !== null` guard, matching the existing referee pattern |
| `fetchApiFootballSquadStats` season hardcode | Used `fetchAllPages(2025)` with `2024` fallback — from August 2026 would silently return last season's squad stats. Now uses `inferSeason(new Date())` |
| Checkout `customer_email` | New subscribers had no `customer_email` pre-filled — user could type a different email in Stripe Checkout to bypass the trial-dedup check. `userEmail` extracted to outer scope and passed as `customer_email` when no existing Stripe customer |
| Webhook `break` on customer retrieve failure | `break` inside `catch` inside `switch/case` exits the case — transient `stripe.customers.retrieve` error returned 200 to Stripe (no retry), permanently losing the `trial_will_end` email. Changed to `throw err` so the outer catch returns 500 and Stripe retries |
| Referee priority order | `espnRefName \|\| afOdds?.referee \|\| afReferee` — stale prefetch odds data (up to 44h old) was ranked above freshly-fetched `afReferee`. Reordered to `espnRefName \|\| afReferee \|\| afOdds?.referee` |
| `fetchPlayerPersonalHistoryBatch` bare catch | Per-player fixture ID fetch had `catch {}` — AF 429s or network errors silently dropped the player's history with no log. Added `console.error` |
| Dead `goalRate`/`assistRate` computation | Two variables computed in the goalscoring player map but never included in the returned object. Removed |
| `resolveAfId` step order | Free in-memory short-surname key lookup (Step 5) was sequenced after the AF API full-name search (Step 4) — wasted quota and a wrong AF match could shadow the correct in-memory answer. Swapped to Step 4 = in-memory, Step 5 = AF API |

**Also fixed:** RUNBOOK.md trial period updated from "7 days" to "4 days" (documentation only, not committed — RUNBOOK is gitignored).

### 2026-06-11 — World Cup 2026 added

FIFA World Cup 2026 (AF league ID 1, ESPN slug `fifa.world`) added as a supported competition. Player dots show last 5 international games rather than club form.

**Files changed:**

| File | Change |
|------|--------|
| `lib/competitions.ts` | Added `world-cup` entry (AF(1), color #C0392B, apiNames: FIFA World Cup/World Cup) |
| `lib/api-football.ts` | Added `fifa.world` to ESPN_LEAGUES; added exported `INTERNATIONAL_LEAGUE_IDS` set (14 international AF league IDs); added `internationalOnly = false` 4th param to `fetchPlayerPersonalHistoryBatch` — when true, filters player fixture list to only international competitions |
| `lib/prefetch.ts` | Added league 1 to `PERSONAL_HISTORY_LEAGUES`; added `isWorldCup = leagueId === 1` flag and passes it as `internationalOnly` to both `fetchPlayerPersonalHistoryBatch` calls |
| `app/api/prefetch/route.ts` | Added `{ slug: 'fifa.world', afLeagueId: 1 }` to ESPN_PREFETCH_LEAGUES so WC matches are discovered each morning |
| `app/api/sync/route.ts` | Added `'fifa.world': 1` to `espnLeagueToAfId`; on-demand personal history fallback now passes `afLeagueId === 1` as `internationalOnly` |

**Design decision:** For World Cup matches, `INTERNATIONAL_LEAGUE_IDS` covers 14 competitions (WC, Euros, Nations League, Copa America, AFCON, Gold Cup, Friendlies, and all regional qualifiers). This ensures the "last 5 international games" window has meaningful data from the start of the tournament (players have qualifiers + Nations League form, not just 0-1 WC games).

**Known ESPN note:** ESPN reports Czech Republic as "Czechia". API-Football may use "Czech Republic" — name resolution steps in `resolveAfId` should handle the mismatch via surname matching.

### 2026-06-11 (follow-up) — 7 bugs fixed after hostile multi-agent review

A second-pass review found 7 bugs in the initial World Cup implementation. All fixed.

| Bug | Severity | Fix |
|-----|----------|-----|
| `fifa.world` absent from `ESPN_COMP_LEAGUES` in sync route | CRITICAL | Added as first entry with `days: 7` — without this WC matches were never discovered by sync and no sheets were ever built |
| `inferSeason` returns 2025 for June 2026 | CRITICAL | Added `useCalendarYear = false` param; callers pass `true` when `leagueId === 1` — fixes odds, team history, referee, and personal history season queries |
| `fetchCount=10` collapses to 0 after `internationalOnly` filter | HIGH | Changed to `internationalOnly ? Math.max(last * 6, 30) : Math.max(last * 2, 10)` — fetches 30 fixtures so long club runs between qualifiers don't empty the window |
| `fetchTheOddsApiOdds` had no WC entry in `AF_LEAGUE_TO_ODDS_SPORT` | MEDIUM | Added `1: 'soccer_fifa_world_cup'` |
| Local `espnToAfLeague` map in AF lineup fallback missing `fifa.world` | MEDIUM | Added `'fifa.world': 1` |
| Standings guard did not exclude `fifa.world` | MEDIUM | Added `&& !espnLeagueSlug.startsWith('fifa.')` to prevent group-stage positions showing as league table positions |
| `fifa.world` was last in `ESPN_LEAGUES` (slow lineup lookup) | LOW | Moved to position 4 (after `uefa.europa.conf`) — saves ~2.4s per WC sync cycle |

**`inferSeason` callers updated:** `fetchApiFootballTeamHistory`, `fetchApiFootballSquadStats`, `fetchApiFootballOdds`, `fetchApiFootballRefereeByLeague`, `fetchPlayerPersonalHistoryBatch`. Callers in `lookupAfPlayerId` and `lookupAfFixtureId` left unchanged (domestic/club context).

**Current deployed commit:** `807dfb3` on master

### 2026-06-11 (evening) — WC opening day: live-path gaps found and fixed

Mexico vs South Africa (first WC match) built its sheet via the live path because both
morning crons ran before the WC code deployed. That exposed three gaps, all fixed:

| Fix | Detail |
|-----|--------|
| ESPN-sourced lineup speed (commit `0152865`) | For `_fromEspn` matches the sync now pulls rosters straight from the known summary URL (event ID + league already known) instead of letting `getApiFootballLineups` rescan all leagues; `getApiFootballLineups` also accepts an `espnLeagueHint`. Saves up to 5 ESPN calls per WC/CL/EL match. `transformRoster` exported from api-football.ts |
| Referee live lookup writeback (commit `0152865`) | When `prefetched.referee` is empty (ref not assigned at 7am), sync does ONE live `fetchApiFootballRefereeByLeague` call and writes the result back into the prefetch blob so later cycles reuse it |
| **Auto-prefetch ordering bug** (commit `8366815`) | The in-sync auto-prefetch loop ran BEFORE the ESPN supplement populated `nearTermMatches`, so ESPN-only matches (ALL World Cup, CL/EL/ECL, FA Cup) were never auto-prefetched. Moved after all discovery (fd.org + ESPN + AF) with `_espnLeague`/`_afLeagueId` → AF league ID mapping. Critical for matches kicking off before the 7am cron covers them |
| **Odds API fallback in live path** (commit `8366815`) | `fetchTheOddsApiOdds` was only wired into prefetch. Sync's non-prefetch branch now chains the same fallback when AF returns no bookmaker odds (was `odds: null` on the Mexico sheet) |
| **National team name canon** (commit `8366815`) | ESPN "United States"/"Czechia"/"Türkiye" vs AF "USA"/"Czech Republic"/"Turkey" never word-matched. `NATIONAL_TEAM_CANON` map applied inside `norm()` (both comparison sides converge) and `cleanForSearch()` (AF team search uses canonical name). Covers USA (Jun 13) and Czechia (Jun 12 02:00) |
| Observability (commit `8366815`) | `[af-live] referee: X \| odds: Y` log line in the live path — empty lookups were previously silent |
| **ESPN status mapping** (commit `907ccec`) | ESPN supplement matches carried raw ESPN status names (`STATUS_IN_PROGRESS` etc.) that LIVE_STATUSES never matched, so ESPN-sourced matches were never "live" — the rebuild guard froze their sheets for 2h mid-game (observed live on the Mexico sheet). Now mapped to fd.org vocabulary (`IN_PLAY`/`PAUSED`/`FINISHED`/`SCHEDULED`) at the supplement boundary |

**Verified during review:** player dots work for WC (international history flowing: Erik
Lira `last5Fouls [T,T,T,F,T]`), auth gate redirects correctly, Stripe has 1 active sub,
Supabase RLS advisories are INFO-only (service-role-only tables, no policies needed).

**Known data limitation:** ESPN had no `gameInfo.officials` for the WC opener even at
kickoff, so referee TBC can persist when AF also lacks the assignment. Not a code bug.
AF added the WC opener's referee ~10 min after kickoff; the live lookup caught it.

### 2026-06-11 (late) — National team data correctness, verified end to end

Forced prefetch runs for tonight's WC matches exposed three data bugs. All fixed,
deployed, and verified with real AF responses via the new debug proxy.

| Fix | Detail |
|-----|--------|
| **Season filter chopped national team history** (commit `cb0510d`) | `/fixtures?team=X&last=15&season=2026` returns only the 1-2 fixtures played in calendar 2026, and friendlies carry no AF player stats — Czechia/Canada/Bosnia got empty `fixtureHistory` while Korea/Mexico (more 2026 games) worked. National teams (leagueHint 1 or `team.national`) now fetch `last=15` with NO season param: national teams only play internationals, so the unfiltered window is exactly right |
| **Squad stats thin for national teams** (commit `cb0510d`) | `/players?team=X&season=2026` gave 1-2 appearance samples. National teams now merge previous calendar year (qualifiers, Nations League) into current season per player |
| **Women's team shadowing** (commit `201a35d`) | AF search "canada" returns "Canada W" before "Canada"; the OR-ed exact/word-overlap find picked the women's team (id 1717, no player coverage). `pickBestTeam` helper: exact normalized match first (national team preferred on ties), word-overlap fallback second. Used by team history, squad stats, and referee lookups |
| **`/api/debug-af` ops endpoint** (commit `4b08f78`) | SYNC_SECRET-gated proxy for one AF GET (`?secret=...&path=/teams?id=770`). Middleware already excludes `/api/debug*` from Clerk |
| **SYNC_SECRET reset** | Old RUNBOOK value did not authenticate; new value set in Vercel production env + RUNBOOK. Crons unaffected (they use CRON_SECRET Bearer auth) |

**Verified state before tonight's matches:** `prefetch:south-korea-vs-czechia` home 108 /
away 102 player histories; `prefetch:canada-vs-bosnia-herzegovina` home 93 (Canada men's,
team 5529) / away 78. Both with market odds cached. Component caches for the affected
teams were purged so nothing serves stale empty data.

**Ops note:** failed/empty team data gets cached in `pc:hist:*`/`pc:squad:*` component
caches — after fixing a resolution bug, DELETE those rows (plus the `prefetch:*` blob)
or the re-run serves the cached empties.

Also gitignored `.env.tmp`/`.env*.tmp` (commit `0847d95`) — they were untracked but not
actually ignored, contradicting the rule above.

### 2026-06-12 — Full-system audit: lineup watch loop + 5 fixes

Full pass over code, Vercel, Supabase, Stripe, and the live site. All deployments
READY, advisors clean, Stripe and the subscriptions table consistent (1 active paid
sub + 3 manual free-access rows).

| Change | Detail |
|--------|--------|
| **Lineup watch loop** (commit `6d90660`) | The 5-min cron meant a lineup publishing just after a tick waited up to 5+ min for a sheet. The sync GET handler now keeps the invocation alive (150s budget of the 300s maxDuration): runSync returns `awaitingLineups` (matches 0.75h..1.6h around kickoff without lineups, with ESPN league hints), the handler polls ESPN every ~25s and re-runs the sync the moment rosters appear. Sheets now drop ~30-90s after lineups. `?watch=0` disables. fd.org lineup cache TTL cut 2min → 45s so the in-invocation rebuild doesn't read a stale empty-lineup response |
| Pre-kickoff guard tiered (same commit) | 35min TTL within 2h of kickoff (was locked 6h) so late lineup corrections and ref reassignments reach the sheet before kickoff; >2h stays 6h, post-kickoff stays 2h |
| `hasGoodGoals` fix (same commit) | Now `(home + away) > 0` — the old per-team check kept complete 1-0/0-0 sheets rebuilding every cycle (documented known issue) |
| fd.org 429 backoff (same commit) | 60s flat → 15s/45s; worst-case stall halved, cumulative 60s still guarantees a fresh per-minute window |
| Frontend freshness (same commit) | `/api/matches` CDN s-maxage 30 → 15; dashboard + competition polls 60s → 30s |
| Bot POST 500s (commit `7fb184e`) | Bots POSTing to `/` crashed the Server Action parser (no Server Actions exist) — middleware returns 405 for non-GET page requests. Verified live |
| **Cache cleanup** (commit `663b109`) | `kvDeleteOlderThan` in store.ts; prefetch cron deletes stale rows daily (prefetch/pc:odds/pc:ref 4d, pc:hist/squad/players/standings 7d, af:plid 30d — all past read TTLs). Critical because the sync prefetch norm-scan reads max 60 `prefetch:*` rows. Also one-off deleted dead rows: `api_sports_cache`, `fbref_cache`, `fbref_v2_cache`, `__debug_test__` |
| **Dead AF endpoint** (commit `81b6eb4`) | `/fixtures?player=X` does not exist in AF v3 (verified via debug-af: `"The Player field do not exist."`). Personal history has ALWAYS been empty in production (every `pc:players` blob is `{}`); dots come from team-history fallback. The batch was wasting ~190 AF calls/team in prefetch and ~40 calls + ~20s per live sheet rebuild. Now probes once and bails; module flag skips later batches per warm runtime |

**Verified live after deploy:** manual sync ok (built the live Canada vs Bosnia sheet),
`POST /` returns 405, USA vs Paraguay prefetched for tonight (98/92 player histories,
odds cached). The watch loop will see first real action at tonight's 01:00 UTC kickoff.

**Current deployed commit:** `81b6eb4` on master (plus docs commit)

### 2026-06-14 — Full-system audit: BTTS fix + stale window extension

Full audit triggered after PC crash at 2am and two observed issues. All files read, two root causes found and fixed.

**Issue 1 — Match sheet wiped before user saw it (Brazil vs Morocco WC, ~1am UTC kickoff):**
- Sheet built at midnight, deleted at 3:30am UTC (2.5h after 1am kickoff) — extra time + penalties run ~150 min, leaving zero buffer after the final whistle
- Root cause: ESPN-only stale window (WC, CL, EL, ECL matches not in fd.org) was 2.5h — exact length of a match with full extra time + penalties

**Issue 2 — Germany BTTS showing 70% (should be ~25%):**
- AF returned h2h bookmaker odds (homeWin: 92%) but no BTTS market (btts: null)
- Code short-circuited on `r.homeWin > 0` without trying The Odds API for BTTS
- Probabilities block fell back to `poissonBtts = 70` because raw Poisson uses season averages — Curaçao scored a lot in CONCACAF qualifiers vs weaker teams, inflating their `goalsFor` and the BTTS estimate

| Fix | Location | Detail |
|-----|---------|--------|
| **BTTS derivation from h2h odds** | `app/api/sync/route.ts` ~line 1896 | When `afOdds.btts === null` but `afOdds.homeWin > 0`, derive BTTS from h2h: `favWin*0.20 + draw*0.80 + underdogWin*0.85`. Germany vs Curaçao: 25% (was 70%). Brazil vs Morocco: 47%. Balanced match: 54%. Poisson still used as fallback when AF has no h2h odds at all. |
| **Stale window 2.5h → 3.5h** | `app/api/sync/route.ts`, 3 places (lines 1058, 1158, 1340) | ESPN-only matches now survive 3.5h after kickoff, giving ~1h buffer after a match that goes to full extra time + penalties (150 min). fd.org matches unaffected (use FINISHED status + 1.5h path). |

**Broader audit (no additional issues found):**
- `app/api/prefetch/route.ts`: ESPN supplement, skip logic, cache hygiene — all correct
- `app/api/matches/route.ts`: 3h liveFiltered filter is belt-and-suspenders (minor inconsistency with 3.5h stale window, not a bug)
- `app/api/matches/[id]/route.ts`: auth gating, Supabase read — correct
- `lib/competitions.ts`, `lib/subscription.ts`, `lib/email.ts`: clean, correct
- All pages (dashboard, competition, match): auth gates, polling intervals, routing — correct

**Note:** BTTS fix applies only when AF has bookmaker h2h odds but no BTTS market. When AF has no odds at all (non-prefetched matches, rare competitions), Poisson still runs as the fallback.

### 2026-06-14 (follow-up) — Wire The Odds API for BTTS when AF has h2h but btts: null

The BTTS derivation formula (session above) is now the last resort, not the first. For WC/CL/EL/ECL matches, The Odds API likely has a real BTTS market that is more accurate than any formula.

| Fix | Files | Detail |
|-----|-------|--------|
| **The Odds API BTTS merge** | `lib/prefetch.ts` line 235, `app/api/sync/route.ts` line 1696 | Both odds pipelines now check: when `r.homeWin > 0 && r.btts === null && afLeagueId in {1,2,3,848}`, call `fetchTheOddsApiOdds` and merge `btts`/`bttsYesOdd`/`bttsNoOdd` from the result into `r` before returning. The formula derivation in sync/route.ts ~line 1896 handles any remaining case where both AF and The Odds API have no BTTS market. |

**Priority order now:** (1) AF bookmaker BTTS market, (2) The Odds API BTTS market (WC/CL/EL/ECL only), (3) derived from h2h odds, (4) Poisson (only when no h2h odds at all).

**Current deployed commit:** `a474a17` on master, aliased to www.cheatsheets.co.uk.

### 2026-06-15 — WC afLeagueId=0 bug + EU region for BTTS

**Root cause discovered:** `FD_CODE_TO_AF_LEAGUE` in both `app/api/prefetch/route.ts` and `app/api/sync/route.ts` was missing `WC: 1`. fd.org returns World Cup matches with competition code `WC`. Because the code had no mapping for it, WC matches got `afLeagueId=0`. fd.org registers the match slug first, so the ESPN supplement (which correctly maps `fifa.world → 1`) was skipped via the `nearTermIds` deduplication guard. Result: prefetch blobs were saved with `afLeagueId=0` and `odds=null`, causing the sync to use pure Poisson — showing Spain at 57% win and BTTS at 68% vs Cape Verde.

| Fix | Files | Detail |
|-----|-------|--------|
| **WC league ID** | `app/api/prefetch/route.ts` line 48, `app/api/sync/route.ts` line 1291 | Added `WC: 1` to `FD_CODE_TO_AF_LEAGUE` in both files. WC matches from fd.org now get `afLeagueId=1`, triggering national-team history mode (no season filter) and WC-specific odds fetch. |
| **EU region for BTTS** | `lib/api-football.ts` line 1562 | Changed `regions=uk` to `regions=uk,eu` in `fetchTheOddsApiOdds`. UK bookmakers are often late to price BTTS for international matches; EU bookmakers (Unibet, Betway etc.) list it earlier. Costs 6 credits/call instead of 3 — still well within the 500/month free tier for WC volume. |
| **Live Supabase patch** | Supabase SQL | Patched `prefetch:spain-vs-cape-verde` blob directly: injected correct odds (`homeWin:88`, `homeOdd:1.14`) from `pc:odds:` cache and set `afLeagueId:1`. Deleted stale `pc:odds:` entries for Spain/Cape Verde and Belgium/Egypt to force re-fetch with EU region on next prefetch run. |

**Why Cape Verde player dots are empty (data limitation, not a bug):** AF doesn't publish fixture-level statistics for African qualifier matches, so `/fixtures/statistics?fixture=X` returns zeros for shots/saves. The history map (`fixtureHistory`) ends up empty — no dots for Cape Verde players. This is a data gap in AF's coverage, not a code issue.

**BTTS priority order (unchanged):** (1) AF bookmaker BTTS market, (2) The Odds API BTTS (WC/CL/EL/ECL, now with uk+eu regions), (3) h2h formula, (4) Poisson.
