/**
 * lib/prefetch.ts
 * Pre-fetches all API-Football data for near-term matches once (morning cron),
 * stores in Supabase, so the 5-min sync can build sheets with zero AF quota spend.
 */

import {
  fetchApiFootballTeamHistory,
  fetchApiFootballSquadStats,
  fetchPlayerPersonalHistoryBatch,
  fetchApiFootballOdds,
  fetchApiFootballReferee,
  fetchApiFootballRefereeByLeague,
  lookupAfPlayerId,
  guessDomesticLeagueId,
} from '@/lib/api-football';
import type { AfTeamFixtureStats, AfSquadPlayer, MatchOdds, PlayerGameStat } from '@/lib/api-football';
import { kvGet, kvSet } from '@/lib/store';

// ── Component cache TTLs ───────────────────────────────────────────────────
const HIST_TTL    = 44 * 60 * 60 * 1000; // 44h — covers Tue→Thu turnaround, avoids double-fetch
const SQUAD_TTL   = 72 * 60 * 60 * 1000; // 72h — squad season stats barely change within a week
const PLAYERS_TTL = 44 * 60 * 60 * 1000; // 44h — personal histories stable between matchdays
const ODDS_TTL    =  6 * 60 * 60 * 1000; // 6h  — odds genuinely move
const REF_TTL     = 24 * 60 * 60 * 1000; // 24h
const FAILED_TTL  =  2 * 60 * 60 * 1000; // 2h  — retry failed team lookups more aggressively

// ── Serialised shapes for KV storage (Maps → plain objects) ───────────────
interface CachedHist {
  cachedAt: number;
  afTeamId: number;
  history: Record<string, PlayerGameStat[]>;
  playerIds: Record<string, number>;
  afTeamStats: AfTeamFixtureStats | null;
}
interface CachedSquad {
  cachedAt: number;
  stats: Record<string, AfSquadPlayer>;
}
interface CachedPlayers {
  cachedAt: number;
  histories: Record<string, PlayerGameStat[]>; // playerId (string) → stats
}
interface CachedOdds   { cachedAt: number; odds: MatchOdds | null; }
interface CachedRef    { cachedAt: number; referee: string; }

type HistResult   = Awaited<ReturnType<typeof fetchApiFootballTeamHistory>>;
type SquadResult  = Awaited<ReturnType<typeof fetchApiFootballSquadStats>>;

function toHistCache(r: HistResult): CachedHist {
  return {
    cachedAt:   Date.now(),
    afTeamId:   r.afTeamId,
    history:    Object.fromEntries(r.history),
    playerIds:  Object.fromEntries(r.playerIds),
    afTeamStats: r.afTeamStats,
  };
}
function fromHistCache(c: CachedHist): HistResult {
  return {
    history:    new Map(Object.entries(c.history) as [string, PlayerGameStat[]][]),
    playerIds:  new Map(Object.entries(c.playerIds).map(([k, v]) => [k, Number(v)])),
    afTeamId:   c.afTeamId,
    afTeamStats: c.afTeamStats,
    debug: 'from-component-cache',
  };
}
function toSquadCache(r: SquadResult): CachedSquad {
  return { cachedAt: Date.now(), stats: Object.fromEntries(r.stats) };
}
function fromSquadCache(c: CachedSquad): SquadResult {
  return { stats: new Map(Object.entries(c.stats) as [string, AfSquadPlayer][]), debug: 'from-component-cache' };
}

// ── Stored data shapes ─────────────────────────────────────────────────────

export interface PrefetchTeam {
  afTeamId: number;
  /** normalizedName → AF player ID — used for name matching at lineup time */
  playerIds: Record<string, number>;
  /** normalizedName → last-N game stat arrays (from team fixture history) */
  fixtureHistory: Record<string, PlayerGameStat[]>;
  /** String(afPlayerId) → last-5 game stats (personal history per player) */
  personalHistories: Record<string, PlayerGameStat[]>;
  afTeamStats: AfTeamFixtureStats | null;
  /** normalizedName → squad season stats */
  squadStats: Record<string, AfSquadPlayer>;
}

export interface PrefetchData {
  fetchedAt: number;
  home: PrefetchTeam;
  away: PrefetchTeam;
  odds: MatchOdds | null;
  referee: string;
  afLeagueId: number;
}

// ── Name normalisation (single shared function for consistency) ────────────

export function normPrefetch(raw: string): string {
  return (raw || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Prefetch one match ─────────────────────────────────────────────────────

export async function prefetchMatch(
  matchId: string,
  homeName: string,
  awayName: string,
  matchDate: string,
  apiKey: string,
  log: (s: string) => void,
  leagueId?: number,
): Promise<boolean> {
  if (!apiKey) { log('[prefetch] no API key'); return false; }
  try {
    log(`[prefetch] Starting: ${homeName} vs ${awayName}`);
    const hk = normPrefetch(homeName);
    const ak = normPrefetch(awayName);

    // ── Step 1: team history + squad stats (parallel, each component cached) ──
    const [chHome, chAway, csHome, csAway] = await Promise.all([
      kvGet<CachedHist>(`pc:hist:${hk}`),
      kvGet<CachedHist>(`pc:hist:${ak}`),
      kvGet<CachedSquad>(`pc:squad:${hk}`),
      kvGet<CachedSquad>(`pc:squad:${ak}`),
    ]);

    const now = Date.now();
    // Failed lookups (afTeamId=0) use a short 2h TTL so they retry sooner rather than staying stale for 44h
    const histTtlFor  = (c: CachedHist | null) => c?.afTeamId ? HIST_TTL : FAILED_TTL;
    const squadTtlFor = (c: CachedSquad | null) => (c && Object.keys(c.stats).length > 0) ? SQUAD_TTL : FAILED_TTL;
    const needHomeHist  = !chHome  || now - chHome.cachedAt  >= histTtlFor(chHome);
    const needAwayHist  = !chAway  || now - chAway.cachedAt  >= histTtlFor(chAway);
    const needHomeSquad = !csHome  || now - csHome.cachedAt  >= squadTtlFor(csHome);
    const needAwaySquad = !csAway  || now - csAway.cachedAt  >= squadTtlFor(csAway);

    const [freshHomeHist, freshAwayHist, freshHomeSquad, freshAwaySquad] = await Promise.all([
      needHomeHist  ? fetchApiFootballTeamHistory(homeName, apiKey, leagueId)  : Promise.resolve(null),
      needAwayHist  ? fetchApiFootballTeamHistory(awayName, apiKey, leagueId)  : Promise.resolve(null),
      needHomeSquad ? fetchApiFootballSquadStats(homeName, apiKey, leagueId)   : Promise.resolve(null),
      needAwaySquad ? fetchApiFootballSquadStats(awayName, apiKey, leagueId)   : Promise.resolve(null),
    ]);

    // Save each fresh component immediately so a later failure doesn't lose them.
    // Always save even on failure (afTeamId=0 / empty squad) so we don't re-hit AF on every cron
    // for teams that genuinely don't resolve — the FAILED_TTL gives a 2h retry window.
    if (freshHomeHist)  await kvSet(`pc:hist:${hk}`,  toHistCache(freshHomeHist));
    if (freshAwayHist)  await kvSet(`pc:hist:${ak}`,  toHistCache(freshAwayHist));
    if (freshHomeSquad) await kvSet(`pc:squad:${hk}`, toSquadCache(freshHomeSquad));
    if (freshAwaySquad) await kvSet(`pc:squad:${ak}`, toSquadCache(freshAwaySquad));

    const homeHistory = freshHomeHist ?? (chHome ? fromHistCache(chHome)   : await fetchApiFootballTeamHistory(homeName, apiKey, leagueId));
    const awayHistory = freshAwayHist ?? (chAway ? fromHistCache(chAway)   : await fetchApiFootballTeamHistory(awayName, apiKey, leagueId));
    const homeSquad   = freshHomeSquad ?? (csHome ? fromSquadCache(csHome) : await fetchApiFootballSquadStats(homeName, apiKey, leagueId));
    const awaySquad   = freshAwaySquad ?? (csAway ? fromSquadCache(csAway) : await fetchApiFootballSquadStats(awayName, apiKey, leagueId));

    log(`[prefetch] history: home=${homeHistory.debug} | away=${awayHistory.debug}`);
    log(`[prefetch] squad:   home=${homeSquad.debug}   | away=${awaySquad.debug}`);

    // ── Step 2: personal histories (cached per team, depends on playerIds) ──
    // Skip for non-top-5 domestic leagues (Championship, Scottish Prem, etc.) whose
    // /fixtures/players endpoint doesn't return fouls/shots — personal history adds noise there.
    // Always fetch for top-5 leagues + European cups (CL/EL/ECL): cup games are critical
    // for the true last-5-all-comps window and their per-player stats endpoint is reliable.
    const PERSONAL_HISTORY_LEAGUES = new Set([39, 140, 78, 135, 61, 2, 3, 848]); // Top5 + CL/EL/ECL
    const shouldFetchPersonal = !leagueId || PERSONAL_HISTORY_LEAGUES.has(leagueId);

    const homePlayerIds = Array.from(new Set(homeHistory.playerIds.values()));
    const awayPlayerIds = Array.from(new Set(awayHistory.playerIds.values()));
    log(`[prefetch] personal histories: ${homePlayerIds.length} home, ${awayPlayerIds.length} away players${shouldFetchPersonal ? '' : ' (skipped — non-top-5 domestic league)'}`);

    const [cpHome, cpAway] = await Promise.all([
      shouldFetchPersonal ? kvGet<CachedPlayers>(`pc:players:${hk}`) : Promise.resolve(null),
      shouldFetchPersonal ? kvGet<CachedPlayers>(`pc:players:${ak}`) : Promise.resolve(null),
    ]);

    const needHomePlayers = shouldFetchPersonal && (!cpHome || now - cpHome.cachedAt >= PLAYERS_TTL);
    const needAwayPlayers = shouldFetchPersonal && (!cpAway || now - cpAway.cachedAt >= PLAYERS_TTL);

    const [freshHomePlayers, freshAwayPlayers] = await Promise.all([
      needHomePlayers ? fetchPlayerPersonalHistoryBatch(homePlayerIds, apiKey) : Promise.resolve(null),
      needAwayPlayers ? fetchPlayerPersonalHistoryBatch(awayPlayerIds, apiKey) : Promise.resolve(null),
    ]);

    if (freshHomePlayers && freshHomePlayers.size) {
      const h: Record<string, PlayerGameStat[]> = {};
      freshHomePlayers.forEach((v, k) => { h[String(k)] = v; });
      await kvSet(`pc:players:${hk}`, { cachedAt: Date.now(), histories: h } as CachedPlayers);
    }
    if (freshAwayPlayers && freshAwayPlayers.size) {
      const h: Record<string, PlayerGameStat[]> = {};
      freshAwayPlayers.forEach((v, k) => { h[String(k)] = v; });
      await kvSet(`pc:players:${ak}`, { cachedAt: Date.now(), histories: h } as CachedPlayers);
    }

    const restorePlayers = (c: CachedPlayers): Map<number, PlayerGameStat[]> =>
      new Map(Object.entries(c.histories).map(([k, v]) => [Number(k), v]));

    const homePersonal = freshHomePlayers ?? (cpHome ? restorePlayers(cpHome) : new Map<number, PlayerGameStat[]>());
    const awayPersonal = freshAwayPlayers ?? (cpAway ? restorePlayers(cpAway) : new Map<number, PlayerGameStat[]>());
    log(`[prefetch] personal done: home=${homePersonal.size} away=${awayPersonal.size}`);

    // ── Step 3: odds + referee (cached per match) ─────────────────────────
    const afLeagueId = guessDomesticLeagueId(homeName) || guessDomesticLeagueId(awayName);

    const [coOdds, coRef] = await Promise.all([
      kvGet<CachedOdds>(`pc:odds:${matchId}`),
      kvGet<CachedRef>(`pc:ref:${matchId}`),
    ]);

    const needOdds = !coOdds || now - coOdds.cachedAt >= ODDS_TTL;
    const needRef  = !coRef  || now - coRef.cachedAt  >= REF_TTL;

    const [freshOdds, freshRef] = await Promise.all([
      needOdds ? fetchApiFootballOdds(homeName, awayName, matchDate, apiKey, afLeagueId || undefined) : Promise.resolve(null),
      needRef
        ? (afLeagueId
            ? fetchApiFootballRefereeByLeague(afLeagueId, matchDate, homeName, awayName, apiKey)
            : fetchApiFootballReferee(homeName, apiKey, matchDate))
        : Promise.resolve(null),
    ]);

    if (needOdds) await kvSet(`pc:odds:${matchId}`, { cachedAt: Date.now(), odds: freshOdds } as CachedOdds);
    if (needRef && freshRef !== null) await kvSet(`pc:ref:${matchId}`, { cachedAt: Date.now(), referee: freshRef } as CachedRef);

    const odds     = needOdds ? freshOdds     : (coOdds?.odds ?? null);
    const referee  = needRef  ? (freshRef ?? '') : (coRef?.referee ?? '');
    log(`[prefetch] odds=${odds ? `${odds.homeWin}/${odds.draw}/${odds.awayWin}` : 'none'} ref="${referee || 'none'}"`);

    // ── Assemble final blob (sync reads this, format unchanged) ─────────────
    const buildTeamData = (
      history: typeof homeHistory,
      squad: typeof homeSquad,
      personal: typeof homePersonal,
    ): PrefetchTeam => ({
      afTeamId: history.afTeamId,
      playerIds: Object.fromEntries(history.playerIds),
      fixtureHistory: Object.fromEntries(history.history),
      personalHistories: Object.fromEntries(
        Array.from(personal.entries()).map(([id, games]) => [String(id), games]),
      ),
      afTeamStats: history.afTeamStats,
      squadStats: Object.fromEntries(squad.stats),
    });

    const data: PrefetchData = {
      fetchedAt: Date.now(),
      home: buildTeamData(homeHistory, homeSquad, homePersonal),
      away: buildTeamData(awayHistory, awaySquad, awayPersonal),
      odds,
      referee: referee || '',
      afLeagueId,
    };

    await kvSet(`prefetch:${matchId}`, data);
    log(`[prefetch] saved: prefetch:${matchId} — home ${homeHistory.playerIds.size} ids, away ${awayHistory.playerIds.size} ids`);
    return true;
  } catch (err: any) {
    log(`[prefetch] ERROR ${matchId}: ${err.message}`);
    return false;
  }
}

// ── 7-step auto-repair name resolution ────────────────────────────────────
// Resolves a lineup player name to an AF player ID using the prefetched squad map.
// Steps 1-5 are free (in-memory). Steps 6-7 make 1-2 AF calls each only if needed.

/** Simple Levenshtein distance — capped at 3 for performance */
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i-1] === b[j-1] ? dp[j-1] : 1 + Math.min(dp[j-1], dp[j], prev);
      dp[j-1] = prev;
      prev = tmp;
    }
    dp[b.length] = prev;
  }
  return dp[b.length];
}

export async function resolveAfId(
  lineupName: string,
  team: PrefetchTeam,
  apiKey: string,
  log: (s: string) => void,
): Promise<number | null> {
  const n = normPrefetch(lineupName);
  const parts = n.split(' ').filter(w => w.length >= 2);
  const { playerIds, afTeamId } = team;

  // Step 1: exact normalised match
  if (playerIds[n] != null) return playerIds[n];

  // Step 2: surname-only scan (last word, ≥ 4 chars)
  const surname = parts[parts.length - 1] ?? '';
  if (surname.length >= 4) {
    const entry = Object.entries(playerIds).find(([k]) => {
      const kp = k.split(' ');
      return kp[kp.length - 1] === surname;
    });
    if (entry) {
      log(`[repair:2] "${lineupName}" → "${entry[0]}" via surname`);
      return entry[1];
    }
  }

  // Step 3: longest distinctive word (≥ 5 chars) as any-word match
  const longWord = [...parts].filter(w => w.length >= 5).sort((a, b) => b.length - a.length)[0];
  if (longWord) {
    const entry = Object.entries(playerIds).find(([k]) =>
      k.split(' ').some(kw => kw === longWord),
    );
    if (entry) {
      log(`[repair:3] "${lineupName}" → "${entry[0]}" via word "${longWord}"`);
      return entry[1];
    }
  }

  // Step 4: AF direct search by full name (up to 2 AF calls)
  if (afTeamId && apiKey) {
    const found = await lookupAfPlayerId(lineupName, afTeamId, apiKey);
    if (found) {
      log(`[repair:4] "${lineupName}" → AF ID ${found} via full-name search`);
      return found;
    }
  }

  // ── Steps 5-7: targeted retries for the specific player that slipped through ──

  // Step 5: direct surname key lookup (≥ 3 chars).
  // fetchApiFootballTeamHistory pre-indexes surname-only shortcut keys for multi-word AF names,
  // so playerIds["burn"] or playerIds["son"] exist even when Step 2's scan missed them.
  if (surname.length >= 3 && playerIds[surname] != null) {
    log(`[repair:5] "${lineupName}" → ID ${playerIds[surname]} via short-surname key`);
    return playerIds[surname];
  }

  // Step 6: fuzzy edit-distance ≤ 2 on normalised surname (catches single-char typos / encoding diffs)
  // Only try surnames ≥ 5 chars to avoid accidental short-name collisions (e.g. "son" ≈ "tan").
  if (surname.length >= 5) {
    for (const [k, id] of Object.entries(playerIds)) {
      const kSurname = k.split(' ').pop() ?? '';
      if (kSurname.length >= 5 && kSurname[0] === surname[0] && levenshtein(kSurname, surname) <= 2) {
        log(`[repair:6] "${lineupName}" → "${k}" (ID ${id}) via fuzzy surname ("${surname}"≈"${kSurname}" d=${levenshtein(kSurname, surname)})`);
        return id;
      }
    }
  }

  // Step 7: AF surname-only search — when Step 4's full-name search returned nothing.
  // Useful for: players whose AF display name differs from ESPN/fd.org (common for South American players
  // known by nickname). Only uses strict word-level matching (no players[0] fallback).
  if (afTeamId && apiKey && surname.length >= 4) {
    try {
      const found = await lookupAfPlayerId(surname, afTeamId, apiKey);
      if (found) {
        log(`[repair:7] "${lineupName}" → AF ID ${found} via surname-only AF search`);
        return found;
      }
    } catch {}
  }

  log(`[repair:fail] "${lineupName}" — all 7 steps exhausted, will use team-history fallback`);
  return null;
}

// ── Reconstruct Maps from stored prefetch data ─────────────────────────────

export function prefetchToAfResult(team: PrefetchTeam) {
  return {
    history:    new Map<string, PlayerGameStat[]>(Object.entries(team.fixtureHistory)),
    playerIds:  new Map<string, number>(Object.entries(team.playerIds).map(([k, v]) => [k, Number(v)])),
    afTeamId:   team.afTeamId,
    afTeamStats: team.afTeamStats,
    debug: 'from-prefetch',
  };
}

export function prefetchToSquadResult(team: PrefetchTeam) {
  return {
    stats: new Map<string, AfSquadPlayer>(Object.entries(team.squadStats)),
    debug: 'from-prefetch',
  };
}

export async function getPrefetch(matchId: string): Promise<PrefetchData | null> {
  return kvGet<PrefetchData>(`prefetch:${matchId}`);
}
