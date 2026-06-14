# Full System Audit — 2026-06-14

**STATUS: COMPLETE**

## Issues investigated
1. [x] Game wiped before sheet released (early hours ~2am Jun 14) — never saw the sheet
2. [x] Germany sheet BTTS "high chance" despite facing weak opponent — Poisson not bookmaker odds
3. [x] Full system audit — every file, every path

## Approach
- Read all key files, understand current state
- Check cleanup/deletion logic (could explain wipe)
- Check odds source priority (bookmaker vs Poisson)
- Full code + logic pass on sync, prefetch, odds, store, competitions
- Multi-agent review before any changes
- Each fix reviewed multiple times for side effects
- All changes logged below

## Phase 1 — Reading / Investigation
- [x] Read app/api/sync/route.ts (full, 2228 lines)
- [x] Read lib/api-football.ts (odds section: fetchApiFootballOdds, fetchTheOddsApiOdds)
- [x] Read lib/prefetch.ts (odds block, lines 225-254)
- [x] Read lib/store.ts
- [x] Read lib/probability.ts
- [x] Check Supabase for current match data
- [x] Verified guessDomesticLeagueId exists (not a bug)

## Phase 2 — Bug Analysis
- [x] 2am game = Brazil vs Morocco, auto-prefetched at 9pm UTC (4h before 1am UTC kickoff)
  - Sheet was most likely built at ~midnight-1am UTC then wiped at 3:30am UTC (2.5h after kickoff)
  - User's PC crashed at 1am UTC (exact kickoff time) — likely missed sheet by minutes
  - Root issue: 2.5h stale window is too tight; extra time + penalties can run to 150min, leaving zero buffer
  - Brazil vs Morocco prefetch also shows odds_btts: null (same BTTS bug)
- [x] Germany vs Curaçao BTTS = 70% (WRONG — bookmakers have it ~20%)
  - prefetch:germany-vs-curaao has odds_home_win: 92, odds_btts: null, over25_odd: 1.25
  - AF returned h2h odds (homeWin > 0), so code returned immediately WITHOUT trying The Odds API for BTTS
  - In probabilities block: resolvedBtts = afOdds.btts !== null ? afOdds.btts : poissonBtts = 70
  - Root cause: raw Poisson uses unqualified team averages (Curaçao scored a lot vs weak CONCACAF teams)
  - Bookmakers encode the quality gap — BTTS should be derived from h2h odds when btts market is missing

## Phase 3 — Fixes Applied

### Fix 1: BTTS derivation from h2h odds (sync/route.ts ~line 1896) — DONE
**Problem:** `resolvedBtts = afOdds.btts !== null ? afOdds.btts : poissonBtts` — Poisson used when btts market absent
**Fix applied:** When btts is null but homeWin > 0, derive from h2h bookmaker probs:
```
resolvedBtts = favWin*0.20 + draw*0.80 + underdogWin*0.85
```
- Favourite wins without conceding ~80% of the time: 20% BTTS
- Draws: ~80% have both teams scoring
- Underdog wins: almost always both teams scored (~85%)
- Germany vs Curaçao (92/6/2): 25% (correct)
- Brazil vs Morocco (57/26/17): 47% (reasonable)
- Balanced (45/30/25): 54% (correct)

### Fix 2: Stale window extended from 2.5h to 3.5h (sync/route.ts, 3 places) — DONE
**Problem:** ESPN-only matches (WC, CL, EL, ECL) deleted 2.5h after kickoff. Extra time + penalties = 150min = zero buffer.
**Fixed at:**
- Line 1058: `return hoursFromKo > 3.5` (stale cleanup)
- Line 1158: `if (hoursFromKo > 3.5) continue` (ESPN supplement)
- Line 1340: `if (!isLive && hoursAway < -3.5) continue` (Phase 2 skip)

## Phase 4 — Broader Audit (No Issues Found)

### Files reviewed and cleared:
- `app/api/prefetch/route.ts`: ESPN supplement included, cache hygiene correct, skip logic sound
- `app/api/matches/route.ts`: liveFiltered at 3h is belt-and-suspenders (stale window now 3.5h, minor inconsistency, not a bug)
- `app/api/matches/[id]/route.ts`: auth gating correct, Supabase read, demo IDs handled
- `app/api/debug/route.ts`: dev tool, auth-gated correctly
- `lib/competitions.ts`: all competitions correctly configured including WC
- `lib/subscription.ts`: status checks correct, past_due grace period logic correct
- `lib/email.ts`: clean HTML emails, correct URLs (cheatsheets.co.uk), no em dashes
- `components/MatchSheet.tsx`: ProbBar thresholds intentional (green>=70, amber 40-69, red<40)
- `app/dashboard/page.tsx`: polls every 30s, correct match counts, clean UI
- `app/competition/[slug]/page.tsx`: subscription gate correct, sorts by kickoff time
- `app/match/[id]/page.tsx`: auth gate correct, polls every 2 min

### Other checks:
- All `2.5` in codebase: only Over/Under market names and probability calculations, no other stale windows
- btts in probabilities IIFE: always a number, never null — no display bug risk
- FINISHED match cleanup paths: correct per source (fd.org: FINISHED+1.5h or >4h; ESPN-only: 3.5h)

## Session Log

### 2026-06-14 — Full audit complete, two bugs found and fixed

- Fix 1 (BTTS): applied successfully — Germany BTTS will be ~25% on next sync (was 70%)
- Fix 2 (stale window): applied at all 3 locations — WC knockout matches now survive extra time + penalties
- Broader audit of all pages, components, lib files: no additional bugs found
- CLAUDE.md updated to document both architecture changes
