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
): Promise<boolean> {
  if (!apiKey) { log('[prefetch] no API key'); return false; }
  try {
    log(`[prefetch] Starting: ${homeName} vs ${awayName}`);

    // Fetch team fixture history + squad season stats in parallel for both teams
    const [homeHistory, awayHistory, homeSquad, awaySquad] = await Promise.all([
      fetchApiFootballTeamHistory(homeName, apiKey),
      fetchApiFootballTeamHistory(awayName, apiKey),
      fetchApiFootballSquadStats(homeName, apiKey),
      fetchApiFootballSquadStats(awayName, apiKey),
    ]);
    log(`[prefetch] history: home=${homeHistory.debug} | away=${awayHistory.debug}`);
    log(`[prefetch] squad:   home=${homeSquad.debug}   | away=${awaySquad.debug}`);

    // Collect unique AF player IDs from each team's recent fixtures
    const homePlayerIds = Array.from(new Set(homeHistory.playerIds.values()));
    const awayPlayerIds = Array.from(new Set(awayHistory.playerIds.values()));
    log(`[prefetch] personal histories: ${homePlayerIds.length} home, ${awayPlayerIds.length} away players`);

    // Fetch personal histories for all known squad members in parallel
    const [homePersonal, awayPersonal] = await Promise.all([
      fetchPlayerPersonalHistoryBatch(homePlayerIds, apiKey),
      fetchPlayerPersonalHistoryBatch(awayPlayerIds, apiKey),
    ]);
    log(`[prefetch] personal done: home=${homePersonal.size} away=${awayPersonal.size}`);

    // Odds + referee
    const afLeagueId = guessDomesticLeagueId(homeName) || guessDomesticLeagueId(awayName);
    const [odds, referee] = await Promise.all([
      fetchApiFootballOdds(homeName, awayName, matchDate, apiKey, afLeagueId || undefined),
      afLeagueId
        ? fetchApiFootballRefereeByLeague(afLeagueId, matchDate, homeName, awayName, apiKey)
        : fetchApiFootballReferee(homeName, apiKey, matchDate),
    ]);
    log(`[prefetch] odds=${odds ? `${odds.homeWin}/${odds.draw}/${odds.awayWin}` : 'none'} ref="${referee || 'none'}"`);

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

// ── 4-step auto-repair name resolution ────────────────────────────────────
// Resolves a lineup player name to an AF player ID using the prefetched squad map.
// Steps 1-3 are free (in-memory). Step 4 makes 1-2 AF calls only if needed.

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

  // Step 2: surname-only (last word, ≥ 4 chars)
  const surname = parts[parts.length - 1];
  if (surname && surname.length >= 4) {
    const entry = Object.entries(playerIds).find(([k]) => {
      const kp = k.split(' ');
      return kp[kp.length - 1] === surname;
    });
    if (entry) {
      log(`[repair:2] "${lineupName}" → "${entry[0]}" via surname`);
      return entry[1];
    }
  }

  // Step 3: longest distinctive word (≥ 5 chars)
  const longWord = [...parts].filter(w => w.length >= 5).sort((a, b) => b.length - a.length)[0];
  if (longWord) {
    const entry = Object.entries(playerIds).find(([k]) =>
      k.split(' ').some(kw => kw === longWord),
    );
    if (entry) {
      log(`[repair:3] "${lineupName}" → "${entry[0]}" via "${longWord}"`);
      return entry[1];
    }
  }

  // Step 4: AF direct search (up to 2 calls: current season then previous)
  if (afTeamId && apiKey) {
    const found = await lookupAfPlayerId(lineupName, afTeamId, apiKey);
    if (found) {
      log(`[repair:4] "${lineupName}" → AF ID ${found} via search`);
      return found;
    }
  }

  log(`[repair:fail] "${lineupName}" — no match found, player will use defaults`);
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
