# Cheat Sheets — Claude Instructions

At the start of every session, read RUNBOOK.md in this folder. It contains all services, costs, account logins, API keys, Stripe IDs, Supabase details, and everything else needed to work on this project. Always refer to it before making decisions about infrastructure, credentials, or costs.

## Project

Next.js 14.2 SaaS — cheatsheets.co.uk
Football betting cheatsheets with Clerk auth, Stripe subscriptions, Supabase database, Vercel hosting.

## Stack

- Framework: Next.js 14.2 (App Router), TypeScript
- Auth: Clerk (production instance ins_3DzqRHW8qTzrMATI6eoGcWVOmmW)
- Payments: Stripe live mode (acct_1TZCpm2Ly6cgjatR) — £9.99/mo or £79.99/yr, 7-day free trial
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

Two cron jobs:
- **Prefetch (7am daily)**: pre-warms AF data into Supabase caches (`pc:hist:*`, `pc:squad:*`, `pc:players:*`, `pc:odds:*`, `pc:ref:*`)
- **Sync (every 5 min)**: reads prefetch cache + ESPN lineups → writes `match:{slug}` sheets

## Key Files — Do NOT touch carelessly

| File | Purpose |
|------|---------|
| `lib/api-football.ts` | All AF + ESPN fetching. Has retry logic, parallel ESPN batches, cleanForSearch prefix stripping |
| `lib/prefetch.ts` | Morning cron: pre-warms AF data. `PERSONAL_HISTORY_LEAGUES` controls per-player history fetch |
| `app/api/sync/route.ts` | 5-min cron: builds match sheets. `bestLast5()` source selection, `buildPlayers()` aggregation |
| `app/api/prefetch/route.ts` | HTTP endpoint for the prefetch cron |
| `components/MatchSheet.tsx` | Cheatsheet UI. `Last5Dots` + `CardDots` render player stat dots |
| `data/match.ts` | TypeScript types for match/player data |
| `lib/competitions.ts` | Competition config and slug mapping |
| `lib/store.ts` | Supabase KV helpers (`kvGet`, `kvSet`, `sbGet`) |

## Player Dots System

Each player shows 5 dots per stat: fouls committed, fouls won, shots on target, total shots, goals, assists, cards, saves (GK only).

**Source priority inside `bestLast5()`:**
1. Personal history (`perPlayerHistory`) — true last 5 games across ALL competitions per player by AF ID. Only used when `personalNonZero > bestOtherNonZero` OR (`personalNonZero >= bestOtherNonZero` AND full 5-game window, no gaps).
2. AF team history (`afHistory`) — last 10 fixtures from `/fixtures/players?fixture=X&team=Y`, all comps, newest-first.
3. ESPN team history (`espnHistory`) — from ESPN event summaries, fetched live at sync time.

**Personal history leagues**: `PERSONAL_HISTORY_LEAGUES = {39,140,78,135,61,2,3,848}` (top-5 + CL/EL/ECL). Non-top-5 domestic leagues skipped because their AF endpoint returns zero fouls/shots.

**Dot ordering**: arrays are `[oldest → newest]` left-to-right. Built by slicing newest-first array, reversing, then padding false at start for <5 games.

**Green dot thresholds**: fouls ≥1, foulsWon ≥1, SOT ≥1, shots ≥2, goals ≥1, assists ≥1, saves ≥3, yellowCards ≥1.

## Things Added Carefully — DO NOT Remove

- `afFetch` + `espnFetch` retry logic (2x on 429/5xx, 1.5s/3s backoff)
- ESPN event summaries fetched in parallel batches of 4 (was sequential)
- `cleanForSearch` strips Belgian/Scandinavian/Balkan/Dutch prefixes (KAA, KRC, KV, FK, NK, IFK, NEC, PEC, etc.)
- Word-by-word team search fallback (tries each word ≥4 chars, longest first, with/without league filter)
- Failed team lookups cached with 2h TTL (`FAILED_TTL`) to stop wasting AF quota
- `afLeagueId` threaded from prefetch route → `prefetchMatch` → team search (league-scoped)
- `espnLeagueToAfId` covers Championship(40), Scottish Prem(179), Belgian(144), Turkish(203), Dutch(88), Portuguese(94)
- Guard TTL requires `cornersFor > 0` on both teams before locking sheet as fresh
- ESPN season-stats fallback only triggers when both `shotsFor === 0 AND cornersFor === 0`
- `resolveAfId` 4-step auto-repair name resolution (exact → surname → long word → AF live lookup)
- On-demand `fetchPlayerPersonalHistoryBatch` fallback in sync when prefetch has empty personal histories
- `?force=1` on `/api/sync` and `/api/prefetch` to bypass guards

## AF League IDs Reference

PL=39, La Liga=140, Bundesliga=78, Serie A=135, Ligue 1=61, Championship=40, CL=2, EL=3, ECL=848

**Removed leagues (unreliable AF data):** Dutch/Eredivisie=88, Portuguese/Primeira Liga=94, Scottish Prem=179, Belgian=144, Turkish=203. Removed from competitions.ts, ESPN_LEAGUES, prefetch + sync routes (commit c649654).

## Force Rebuild (after fixes or data issues)

1. `/api/prefetch?secret=SYNC_SECRET&force=1` — re-runs morning prefetch for all near-term matches
2. `/api/sync?secret=SYNC_SECRET&force=1` — bypasses 6h guard, rebuilds all sheets immediately

## Current Status (last updated 2026-05-25)

**Done and deployed (latest commit 0f43b0c on master):**
- Full pipeline hardening (retries, parallel fetches, team search fallbacks, failed-lookup caching)
- Player dots bugs fixed: ECL/EL/CL now fetch personal history, `bestLast5` source selection fixed
- Stripe + Clerk in production mode
- ICO registration complete — ZC153221 (CHEAT SHEETS LTD)
- `STRIPE_ANNUAL_PRICE_ID` confirmed set in Vercel production env vars
- Starling business bank account approved
- Netherlands, Portugal, Scotland, Turkey, Belgium leagues removed (unreliable data)
- **2026-05-23**: Fixed team stats mirroring bug (Championship + non-ESPN leagues) — against stats now real opponent data
- **2026-05-24**: Fixed prefetch key mismatch (fd.org "FC" suffix vs ESPN names) via norm-scan + mirror-save
- **2026-05-24**: Fixed personal history dots returning 0 — added `season=2025` fallback in `fetchPlayerPersonalHistoryBatch`
- **2026-05-24**: Fixed Sunderland/Burnley/Leeds in wrong league regex (moved eng.2 → eng.1)
- **2026-05-24**: Added ESPN supplement match discovery in prefetch for when fd.org is down
- **2026-05-24**: Batch on-demand personal history fetch at lineup time (prevents timeout)
- **2026-05-24**: CDN caching for match API routes (force-dynamic + Cache-Control s-maxage headers)
- **2026-05-25**: Fixed `hasLineups` only checking home team — now requires BOTH home+away lineups before building sheet (prevents sheets with empty away player tabs)
- **2026-05-25**: Guard now requires `hasGoodPlayers` (both teams have defensive players) — prevents locking incomplete-player sheets post-kickoff
- **2026-05-25**: ESPN player history fetched as fallback when prefetch `fixtureHistory` is empty (prevents all-gray-dot rows when 7am prefetch missed a team)
- **2026-05-25**: ESPN supplement scan reduced: European/cups 30→7 days, domestic 14→3 days (saves ~12s per sync cycle)

**Remaining:**
- Test full sign-up → payment flow with a real card
