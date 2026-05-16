import { NextRequest, NextResponse } from 'next/server';
import { getApiFootballLineups, getEspnTeamIds, fetchTeamPlayerHistory, findEspnFirstLeg, fetchEspnRosterStats, fetchApiFootballTeamHistory, fetchApiFootballSquadStats, fetchApiFootballReferee, fetchApiFootballRefereeByLeague, fetchApiFootballOdds, fetchPlayerPersonalHistoryBatch, lookupAfPlayerId, guessDomesticLeague, fetchAfFixturesByDateRange, fetchAfConfirmedLineups, PlayerGameStat } from '@/lib/api-football';
import type { TeamSeasonStats, EspnRosterPlayer, AfSquadPlayer, AfTeamFixtureStats, MatchOdds } from '@/lib/api-football';
import { fetchApiSportsIndex, buildApiSportsNameIndex, lookupApiSports } from '@/lib/api-sports';
import type { ApiSportsPlayer } from '@/lib/api-sports';
import { prefetchMatch, resolveAfId, normPrefetch, prefetchToAfResult, prefetchToSquadResult } from '@/lib/prefetch';
import type { PrefetchData } from '@/lib/prefetch';

// Direct Supabase client for writes (bypasses store.ts to avoid fs-module caching issues)
function getSb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: (url: RequestInfo | URL, opts?: RequestInit) => fetch(url, { ...opts, cache: 'no-store' }) },
  });
}

async function sbSet(key: string, value: unknown, log?: (s: string) => void) {
  const sb = getSb();
  if (!sb) { log?.(`[sbSet] no client for ${key}`); return; }
  const now = new Date().toISOString();
  const { error } = await sb.from('match_cache').upsert({ key, value, updated_at: now }, { onConflict: 'key' });
  if (error) { const msg = `[sbSet] ERROR ${key}: ${error.message} (code:${error.code})`; console.error(msg); log?.(msg); }
  else log?.(`[sbSet] ok: ${key}`);
}

async function sbGet(key: string) {
  const sb = getSb();
  if (!sb) return null;
  const { data } = await sb.from('match_cache').select('value').eq('key', key).single();
  return data?.value ?? null;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── Auth ───────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest) {
  const syncSecret = (process.env.SYNC_SECRET ?? '').trim();
  const queryVal = req.nextUrl.searchParams.get('secret') ?? req.nextUrl.searchParams.get('token');
  if (queryVal && syncSecret && queryVal === syncSecret) return true;
  const authHeader = req.headers.get('authorization');
  const cronSecret = (process.env.CRON_SECRET ?? '').trim();
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

// ── Probability helpers ────────────────────────────────────────────────────
function poissonAtLeast(lambda: number, k: number) {
  let cumulative = 0, term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) { cumulative += term; term *= lambda / (i + 1); }
  return Math.max(0, Math.min(1, 1 - cumulative));
}
function poissonExact(lambda: number, k: number) {
  let p = Math.exp(-lambda);
  for (let i = 0; i < k; i++) p *= lambda / (i + 1);
  return p;
}
function toScale(p: number) { return Math.max(1, Math.min(100, Math.round(p * 100))); }
function overProb(avg: number, threshold: number) { return toScale(poissonAtLeast(avg, Math.ceil(threshold))); }

/**
 * Scans a team's recent completed matches to find a previous leg against the
 * same opponent. Returns aggregate goals from the CURRENT match's perspective
 * (home = current home team, away = current away team).
 */
function findFirstLegAggregate(
  matches: any[],
  currentHomeTeamId: number | string,
  currentAwayTeamId: number | string,
): { home: number; away: number } | null {
  if (!matches?.length) return null;
  const hId = String(currentHomeTeamId);
  const aId = String(currentAwayTeamId);
  for (const m of matches) {
    if (!m.score?.fullTime) continue;
    const st = m.status?.type ?? m.status?.short ?? m.status?.long ?? '';
    const finished = st === 'FINISHED' || st === 'FT' || st === 'FULL_TIME' ||
                     (typeof st === 'string' && st.includes('FINISH'));
    if (!finished) continue;
    const mH = String(m.homeTeam?.id ?? '');
    const mA = String(m.awayTeam?.id ?? '');
    const involves = (mH === hId || mH === aId) && (mA === hId || mA === aId) && mH !== mA;
    if (!involves) continue;
    const homeGoals = m.score.fullTime.home ?? 0;
    const awayGoals = m.score.fullTime.away ?? 0;
    // Translate so home/away = current match's home/away perspective
    return mH === hId
      ? { home: homeGoals, away: awayGoals }
      : { home: awayGoals, away: homeGoals };
  }
  return null;
}

// Poisson match outcome model: takes pre-computed expected goals (lH already home-adjusted)
function matchOutcomes(lH: number, lA: number) {
  let home = 0, draw = 0, away = 0;
  for (let h = 0; h <= 7; h++) {
    for (let a = 0; a <= 7; a++) {
      const p = poissonExact(lH, h) * poissonExact(lA, a);
      if (h > a) home += p; else if (h === a) draw += p; else away += p;
    }
  }
  const total = home + draw + away;
  return {
    homeWin: Math.round((home / total) * 100),
    draw:    Math.round((draw / total) * 100),
    awayWin: Math.round((away / total) * 100),
  };
}


// ── Team colours ───────────────────────────────────────────────────────────
const TEAM_COLORS: Record<string, string> = {
  'manchester city': '#6CABDD', 'man city': '#6CABDD',
  'manchester united': '#DA291C', 'man united': '#DA291C', 'man utd': '#DA291C',
  'liverpool': '#C8102E', 'arsenal': '#EF0107', 'chelsea': '#034694',
  'tottenham': '#132257', 'spurs': '#132257', 'newcastle': '#241F20',
  'aston villa': '#95BFE5', 'west ham': '#7A263A', 'brighton': '#0057B8',
  'wolves': '#FDB913', 'wolverhampton': '#FDB913', 'everton': '#003399',
  'fulham': '#CC0000', 'brentford': '#E30613', 'crystal palace': '#1B458F',
  'nottingham forest': '#E53233', 'nottm forest': '#E53233',
  'leicester': '#003090', 'ipswich': '#0044A9', 'southampton': '#D71920',
  'real madrid': '#FEBE10', 'barcelona': '#004D98',
  'atletico': '#CE1126', 'atlético': '#CE1126',
  'bayern': '#DC052D', 'fc bayern': '#DC052D',
  'borussia dortmund': '#FDE100', 'dortmund': '#FDE100',
  'psg': '#004170', 'paris saint-germain': '#004170',
  'juventus': '#000000', 'inter': '#010E80', 'inter milan': '#010E80',
  'ac milan': '#FB090B', 'milan': '#FB090B', 'napoli': '#12A0D7', 'ssc napoli': '#12A0D7',
  'porto': '#003087', 'benfica': '#E4172B', 'ajax': '#D2122E',
  'celtic': '#16A34A', 'rangers': '#1B458F',
  'england': '#012169', 'france': '#002395', 'germany': '#000000',
  'spain': '#AA151B', 'italy': '#003399', 'brazil': '#009C3B',
  'argentina': '#74ACDF', 'portugal': '#006600', 'netherlands': '#FF6600',
};

function getTeamColor(name: string) {
  const lower = (name || '').toLowerCase();
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#888888';
}

function shortName(full: string) {
  if (!full) return '';
  const parts = full.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}

// ── Player stats (with FBref overlay) ─────────────────────────────────────
function normName(raw: string) {
  return (raw || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Fuzzy name-based map lookup \u2014 last resort when exact/surname matches fail.
// Finds the closest full-name key by surname match, long-word containment, or word overlap.
// Safe within a single TEAM's player pool (teammates almost never share a distinctive surname).
// Pass skipSingleWord=true to ignore single-word alias entries (e.g. surname shortcuts).
function fuzzyPlayerLookup<T>(query: string, map: Map<string, T>, skipSingleWord = true): T | null {
  const parts = query.split(' ').filter(w => w.length >= 3);
  if (!parts.length) return null;
  const qLast = parts[parts.length - 1];
  const qLong = parts.reduce((a, b) => a.length >= b.length ? a : b, '');
  let best: T | null = null;
  let bestScore = 0;
  for (const [k, v] of Array.from(map)) {
    if (skipSingleWord && !k.includes(' ')) continue;
    const kParts = k.split(' ').filter(w => w.length >= 3);
    const kLast = kParts[kParts.length - 1];
    const kLong = kParts.reduce((a: string, b: string) => a.length >= b.length ? a : b, '');
    let score = 0;
    if (kLast === qLast && qLast.length >= 3) score = 0.9;
    else if (qLast.length >= 4 && (kLast.startsWith(qLast) || qLast.startsWith(kLast))) score = 0.75;
    else if (qLong.length >= 5 && (k.includes(qLong) || kLong.includes(qLong))) score = 0.6;
    else {
      const overlap = parts.filter(w => w.length >= 4 && kParts.some(kw => kw.includes(w) || w.includes(kw)));
      if (overlap.length > 0) score = 0.4 * (overlap.length / Math.max(parts.length, kParts.length));
    }
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return bestScore >= 0.4 ? best : null;
}

function buildNameIndex(players: any[]) {
  const idx = new Map<string, any>();
  const set = (key: string, p: any) => { if (key && !idx.has(key)) idx.set(key, p); };
  for (const p of players) {
    const norm = normName(p.name); const parts = norm.split(' ');
    set(norm, p);
    if (parts.length >= 2) {
      set(parts[parts.length - 1], p);
      set(`${parts[0]} ${parts[parts.length - 1]}`, p);
    }
  }
  return idx;
}

function lookupPlayer(idx: Map<string, any>, name: string) {
  if (!idx.size) return null;
  const norm = normName(name); const parts = norm.split(' ');
  const last = parts[parts.length - 1];
  if (idx.has(norm)) return idx.get(norm);
  if (idx.has(last) && last.length >= 3) return idx.get(last);
  const fl = `${parts[0]} ${last}`;
  if (idx.has(fl)) return idx.get(fl);
  if (last.length > 4) { for (const [k, v] of Array.from(idx)) { if (k.includes(last)) return v; } }
  return null;
}

// ── API-Sports cache (paid API — no scraping) ─────────────────────────────
const STATS_TTL = 23 * 60 * 60 * 1000;

async function getApiSportsIndex(): Promise<Map<string, ApiSportsPlayer>> {
  const apiKey = (process.env.API_SPORTS_KEY ?? '').trim();
  if (!apiKey) return new Map();
  const cached = await sbGet('api_sports_v2_cache') as { scraped: number; players: ApiSportsPlayer[] } | null;
  if (cached && Date.now() - cached.scraped < STATS_TTL) {
    return buildApiSportsNameIndex(cached.players);
  }
  try {
    const index = await fetchApiSportsIndex(apiKey);
    const players = Array.from(index.values());
    if (players.length > 0) {
      await sbSet('api_sports_v2_cache', { scraped: Date.now(), players });
      return buildApiSportsNameIndex(players);
    }
  } catch {}
  if (cached?.players?.length) return buildApiSportsNameIndex(cached.players);
  return new Map();
}

// ── Build team stats ───────────────────────────────────────────────────────
function buildTeamStats(
  fdMatches: any[],
  teamId: number,
  espnStats: TeamSeasonStats | null,
  oppEspnStats: TeamSeasonStats | null,
  afStats: AfTeamFixtureStats | null = null,
  oppAfStats: AfTeamFixtureStats | null = null,
): ReturnType<typeof defaultStats> {
  // Goals from football-data.org (most accurate — confirmed match scores)
  let goalsFor = 0, goalsAgainst = 0, count = 0;
  for (const m of (fdMatches ?? []).slice(0, 10)) {
    const isHome = m.homeTeam?.id === teamId;
    const score = m.score?.fullTime;
    if (!score) continue;
    goalsFor     += isHome ? (score.home ?? 0) : (score.away ?? 0);
    goalsAgainst += isHome ? (score.away ?? 0) : (score.home ?? 0);
    count++;
  }
  // Priority: fd.org results → API-Football fixture scores → ESPN season stats → league avg defaults
  // Use || (not ??) for ESPN goals because the field initialises to 0 when no score data is available
  const avgFor     = count > 0 ? goalsFor / count
                   : ((afStats?.goalsFor ?? 0)     > 0 ? afStats!.goalsFor
                   : (espnStats?.goalsFor     || 1.5));
  const avgAgainst = count > 0 ? goalsAgainst / count
                   : ((afStats?.goalsAgainst ?? 0) > 0 ? afStats!.goalsAgainst
                   : (espnStats?.goalsAgainst || 1.2));

  const e = espnStats;
  const o = oppEspnStats;
  const af = afStats;
  const oaf = oppAfStats;

  // For "for" stats: own AF data is most accurate (from fixture stats endpoint, filtered to this team).
  // For "against" stats: use this team's own ESPN season boxscore averages first (opp-side data
  // from completed events gives genuine defensive averages), then fall back to opponent AF/ESPN.
  // Do NOT use own AF "for" as a proxy for "against" — that causes for==against mirroring when
  // opponent data is unavailable. Similarly do NOT use oaf "for" as a proxy for own "for" —
  // opponent's corners/shots are not a proxy for your own corners/shots.
  const cornersFor      = af?.cornersFor     || e?.cornersFor      || o?.cornersAgainst   || 5.0;
  const cornersAgainst  = e?.cornersAgainst  || oaf?.cornersFor    || o?.cornersFor       || 5.0;
  const shotsFor        = af?.shotsFor       || e?.shotsFor        || o?.shotsAgainst     || 13.0;
  const shotsAgainst    = e?.shotsAgainst    || oaf?.shotsFor      || o?.shotsFor         || 11.0;
  const sotFor          = af?.sotFor         || e?.sotFor          || o?.sotAgainst       || 4.5;
  const sotAgainst      = e?.sotAgainst      || oaf?.sotFor        || o?.sotFor           || 3.8;
  const foulsCommitted  = af?.foulsFor       || e?.foulsCommitted  || o?.foulsWon         || 11.0;
  const foulsWon        = e?.foulsWon        || oaf?.foulsFor      || o?.foulsCommitted   || 11.0;
  const cardsFor        = af?.yellowCardsFor || e?.cardsFor        || o?.cardsAgainst     || 1.8;
  const cardsAgainst    = e?.cardsAgainst    || oaf?.yellowCardsFor|| o?.cardsFor         || 1.8;
  const tacklesFor      = af?.tacklesFor     || e?.tacklesFor      || o?.tacklesAgainst   || 18.0;
  const tacklesAgainst  = e?.tacklesAgainst  || oaf?.tacklesFor    || o?.tacklesFor       || 18.0;
  const offsidesFor     = af?.offsidesFor    || e?.offsidesFor     || o?.offsidesAgainst  || 2.0;
  const offsidesAgainst = e?.offsidesAgainst || oaf?.offsidesFor   || o?.offsidesFor      || 2.0;
  // Free kicks for = fouls this team WON = opponent's committed fouls (oaf.foulsFor is a good proxy)
  const freeKicksFor    = e?.freeKicksFor    || oaf?.foulsFor      || o?.freeKicksAgainst || foulsWon    || 10.0;
  // Free kicks against = fouls this team committed = own fouls (af.foulsFor is a good proxy here)
  const freeKicksAgainst= e?.freeKicksAgainst|| af?.foulsFor       || o?.freeKicksFor     || foulsCommitted || 10.0;
  // Saves: use AF savesFor (GK saves per game) directly; fall back to opponent's AF for the against side
  const savesFor     = af?.savesFor  || oaf?.savesFor || 3.8;
  const savesAgainst = oaf?.savesFor || af?.savesFor  || 3.5;
  return {
    goalsFor: +avgFor.toFixed(2), goalsAgainst: +avgAgainst.toFixed(2),
    over25Goals:    overProb(avgFor + avgAgainst, 2.5),
    cornersFor:     +cornersFor.toFixed(2),      cornersAgainst:    +cornersAgainst.toFixed(2),
    over95Corners:  overProb(cornersFor + cornersAgainst, 9.5),
    shotsFor:       +shotsFor.toFixed(2),        shotsAgainst:      +shotsAgainst.toFixed(2),
    over195Shots:   overProb(shotsFor + shotsAgainst, 19.5),
    sotFor:         +sotFor.toFixed(2),          sotAgainst:        +sotAgainst.toFixed(2),
    over95SoT:      overProb(sotFor + sotAgainst, 6.5),
    foulsCommitted: +foulsCommitted.toFixed(2),  foulsWon:          +foulsWon.toFixed(2),
    over155Fouls:   overProb(foulsCommitted + foulsWon, 15.5),
    cardsFor:       +cardsFor.toFixed(2),        cardsAgainst:      +cardsAgainst.toFixed(2),
    over45Cards:    overProb(cardsFor + cardsAgainst, 4.5),
    tacklesFor:     +tacklesFor.toFixed(2),      tacklesAgainst:    +tacklesAgainst.toFixed(2),
    over345Tackles: overProb(tacklesFor + tacklesAgainst, 34.5),
    offsidesFor:    +offsidesFor.toFixed(2),     offsidesAgainst:   +offsidesAgainst.toFixed(2),
    over35Offsides: overProb(offsidesFor + offsidesAgainst, 3.5),
    freeKicksFor:   +freeKicksFor.toFixed(2),    freeKicksAgainst:  +freeKicksAgainst.toFixed(2),
    over195FreeKicks: overProb(freeKicksFor + freeKicksAgainst, 19.5),
    savesFor:       +savesFor.toFixed(2),        savesAgainst:      +savesAgainst.toFixed(2),
    over75Saves:    overProb(savesFor + savesAgainst, 7.5),
  };
}

function defaultStats() {
  return {
    goalsFor: 1.5, goalsAgainst: 1.2, over25Goals: 60,
    cornersFor: 5.0, cornersAgainst: 5.0, over95Corners: 60,
    shotsFor: 13.0, shotsAgainst: 11.0, over195Shots: 60,
    sotFor: 4.5, sotAgainst: 3.8, over95SoT: 60,
    foulsCommitted: 11.0, foulsWon: 11.0, over155Fouls: 60,
    cardsFor: 1.8, cardsAgainst: 1.8, over45Cards: 40,
    tacklesFor: 18.0, tacklesAgainst: 18.0, over345Tackles: 60,
    offsidesFor: 2.0, offsidesAgainst: 2.0, over35Offsides: 50,
    freeKicksFor: 10.0, freeKicksAgainst: 10.0, over195FreeKicks: 60,
    savesFor: 3.8, savesAgainst: 3.5, over75Saves: 55,
  };
}

// ── Build players ──────────────────────────────────────────────────────────
async function buildPlayers(
  homeLineup: any,
  awayLineup: any,
  espnHistory: Map<string, PlayerGameStat[]> = new Map(),
  apiSportsIdx: Map<string, ApiSportsPlayer> = new Map(),
  espnRosterMap: Map<string, EspnRosterPlayer> = new Map(),
  afHistoryHome: Map<string, PlayerGameStat[]> = new Map(),
  afHistoryAway: Map<string, PlayerGameStat[]> = new Map(),
  afSquadHome: Map<string, AfSquadPlayer> = new Map(),
  afSquadAway: Map<string, AfSquadPlayer> = new Map(),
  perPlayerHistoryHome: Map<string, PlayerGameStat[]> = new Map(),
  perPlayerHistoryAway: Map<string, PlayerGameStat[]> = new Map(),
) {
  function normName(n: string) {
    return (n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function lookupRoster(name: string, espnId?: string): EspnRosterPlayer | null {
    if (espnId) {
      const byId = espnRosterMap.get(`id:${espnId}`);
      if (byId) return byId;
    }
    const n = normName(name);
    if (espnRosterMap.has(n)) return espnRosterMap.get(n)!;
    const parts = n.split(' ');
    const last = parts[parts.length - 1];
    if (last.length >= 4) {
      for (const [k, v] of Array.from(espnRosterMap)) {
        if (k.startsWith('id:')) continue;
        if (k.includes(last) || last.includes(k.split(' ').pop()!)) return v;
      }
    }
    return null;
  }
  function playerDefaults(p: any) {
    const name = p.name || p.person?.name || 'Unknown';
    const pos = (p.position || 'Midfielder').toLowerCase();
    const abbr = (p.posAbbr || '').toUpperCase();
    const isGK  = abbr === 'G' || pos.includes('keeper') || pos.includes('goalkeeper');
    const isAtt = !isGK && (pos.includes('forward') || pos.includes('attack') || pos.includes('winger') || pos.includes('offence'));
    const isMid = !isGK && pos.includes('mid');
    const isDef = !isGK && (pos.includes('back') || pos.includes('defend'));
    const defaults = {
      name,
      isGK,
      understatId: '' as string,
      espnId: (p.espnId ?? '') as string,
      posAbbr: abbr,
      formationPlace: p.formationPlace || 0,
      mins: 75,
      foulsPerGame: isDef ? 1.2 : isMid ? 1.0 : isGK ? 0.1 : 0.8,
      tacklesPerGame: isDef ? 1.8 : isMid ? 1.2 : isGK ? 0.2 : 0.6,
      foulsWonPerGame: isAtt ? 1.8 : isMid ? 1.2 : isGK ? 0.1 : 0.8,
      sotPerGame: isAtt ? 1.5 : isMid ? 0.6 : 0.2,
      shotsPerGame: isAtt ? 3.0 : isMid ? 1.2 : 0.4,
      goals: isAtt ? 4 : isMid ? 2 : 0,
      assists: isAtt ? 3 : isMid ? 3 : 1,
      gaPerGame: isAtt ? 0.35 : isMid ? 0.25 : 0.05,
      yellowCards: isDef ? 4 : isMid ? 3 : 2,
      redCards: 0,
      appearances: 20,
      pkGoals: 0,
      form: 'ok' as const,
    };
    const espnId = (p.espnId ?? '') as string;
    // ESPN roster by ESPN ID is the most reliable source (no name matching required)
    const roster = lookupRoster(name, espnId);
    // If the lineup came from API-Football (espnId is empty), resolve it via roster name match.
    // This lets espnHistory per-game lookups work for players from non-ESPN lineup sources.
    const effectiveEspnId = espnId || roster?.id || '';
    // API-Sports global index as supplementary source for per-game rates
    const as = lookupApiSports(apiSportsIdx, name);

    if (roster || (as && as.games >= 3)) {
      const appearances = roster?.appearances || as?.games || 20;
      const goals       = roster?.goals       ?? as?.goals       ?? defaults.goals;
      const assists     = roster?.assists      ?? as?.assists      ?? defaults.assists;
      const yellowCards = roster?.yellowCards  ?? as?.yellowCards  ?? defaults.yellowCards;
      const redCards    = roster?.redCards     ?? as?.redCards     ?? defaults.redCards;
      const gaPerGame   = appearances > 0 ? +((goals + assists) / appearances).toFixed(2) : defaults.gaPerGame;

      const rosterShotsPg    = roster && roster.appearances > 0 ? +(roster.totalShots      / roster.appearances).toFixed(2) : 0;
      const rosterSotPg      = roster && roster.appearances > 0 ? +(roster.shotsOnTarget   / roster.appearances).toFixed(2) : 0;
      const rosterFoulsPg    = roster && roster.appearances > 0 ? +(roster.foulsCommitted  / roster.appearances).toFixed(2) : 0;
      const rosterFoulsWonPg = roster && roster.appearances > 0 ? +(roster.foulsSuffered   / roster.appearances).toFixed(2) : 0;

      // Roster (ESPN current-club season stats) takes priority over API-Sports global index.
      // API-Sports accumulates across ALL competitions and clubs for the season, so a player
      // who transferred mid-season gets blended cross-club averages.
      // ESPN roster is specific to the current squad and gives accurate current-club stats.
      return {
        ...defaults,
        espnId: effectiveEspnId,
        mins:            as?.minsPerGame     || defaults.mins,
        goals, assists, gaPerGame,
        shotsPerGame:    rosterShotsPg    || as?.shotsPerGame    || defaults.shotsPerGame,
        sotPerGame:      rosterSotPg      || as?.sotPerGame      || defaults.sotPerGame,
        foulsPerGame:    rosterFoulsPg    || as?.foulsPerGame    || defaults.foulsPerGame,
        foulsWonPerGame: rosterFoulsWonPg || as?.foulsWonPerGame || defaults.foulsWonPerGame,
        yellowCards, redCards, appearances,
        pkGoals:         as?.pkGoals ?? 0,
        hasRealData:     true,
      };
    }

    // No data found from any source — use position defaults but flag clearly
    return { ...defaults, espnId: effectiveEspnId, hasRealData: false };
  }

  const homeStarters = homeLineup.lineup || homeLineup.startingEleven || [];
  const awayStarters = awayLineup.lineup || awayLineup.startingEleven || [];

  // ── Positional opponent matching ─────────────────────────────────────────
  // targets = opposing positions to look for, count = how many names to return
  const MARKS: Record<string, { targets: string[]; count: number }> = {
    'G':    { targets: [],                         count: 0 },
    'RB':   { targets: ['LW','AM-L','LM'],         count: 1 },
    'LB':   { targets: ['RW','AM-R','RM'],         count: 1 },
    'CB':   { targets: ['F','ST','SS'],            count: 1 },
    'CD-R': { targets: ['F','ST','SS'],            count: 1 },
    'CD-L': { targets: ['F','ST','SS'],            count: 1 },
    'DM':   { targets: ['AM','CM','SS','F'],       count: 2 },
    'CM':   { targets: ['CM','AM','DM'],           count: 2 },
    'LM':   { targets: ['RB','RM'],                count: 1 },
    'RM':   { targets: ['LB','LM'],                count: 1 },
    'AM':   { targets: ['DM','CM'],                count: 2 },
    'AM-L': { targets: ['RB','RM'],                count: 1 },
    'AM-R': { targets: ['LB','LM'],                count: 1 },
    'LW':   { targets: ['RB','RM'],                count: 1 },
    'RW':   { targets: ['LB','LM'],                count: 1 },
    'F':    { targets: ['CB','CD-R','CD-L'],       count: 2 },
    'ST':   { targets: ['CB','CD-R','CD-L'],       count: 2 },
    'SS':   { targets: ['DM','CM','CB'],           count: 2 },
  };

  function findOpponent(player: any, opposingPlayers: any[]): string {
    const abbr = player.posAbbr;
    const mark = MARKS[abbr];
    if (mark?.count === 0) return '';

    const opp = opposingPlayers.filter(p => !p.isGK); // never list GK as an opponent
    const targets = mark?.targets ?? [];
    const needed  = mark?.count ?? 1;
    const found: string[] = [];
    const used = new Set<string>();

    for (const target of targets) {
      if (found.length >= needed) break;
      const match = opp.find(p => p.posAbbr === target && !used.has(p.name));
      if (match) { found.push(shortName(match.name)); used.add(match.name); }
    }

    if (found.length < needed) {
      const fp = player.formationPlace;
      if (fp) {
        const targetFp = Math.max(1, Math.min(11, 12 - fp));
        const sorted = [...opp]
          .filter(p => !used.has(p.name))
          .sort((a, b) => Math.abs((a.formationPlace || 6) - targetFp) - Math.abs((b.formationPlace || 6) - targetFp));
        for (const p of sorted) {
          if (found.length >= needed) break;
          found.push(shortName(p.name)); used.add(p.name);
        }
      }
    }

    return found.join(', ');
  }

  function top10(players: any[], key: string, excludeGK = true) {
    const pool = (excludeGK ? players.filter(p => !p.isGK) : players);
    return [...pool].sort((a, b) => {
      if (a.hasRealData && !b.hasRealData) return -1;
      if (!a.hasRealData && b.hasRealData) return 1;
      const aTotalGA = (a.goals ?? 0) + (a.assists ?? 0);
      const bTotalGA = (b.goals ?? 0) + (b.assists ?? 0);
      if (key === 'gaPerGame') {
        const aScore = aTotalGA < 3 ? a[key] * 0.5 : a[key];
        const bScore = bTotalGA < 3 ? b[key] * 0.5 : b[key];
        return bScore - aScore;
      }
      return b[key] - a[key];
    }).slice(0, 10);
  }

  function buildSide(starters: any[], opp: any[], afHistory: Map<string, PlayerGameStat[]>, afSquad: Map<string, AfSquadPlayer>, perPlayerHistory: Map<string, PlayerGameStat[]>) {
    function normN(n: string) {
      return (n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function lookupSquad(name: string): AfSquadPlayer | null {
      const key = normN(name);
      if (afSquad.has(key)) return afSquad.get(key)!;
      const parts = key.split(' ');
      const last = parts[parts.length - 1];
      if (last.length >= 3) {
        for (const [k, v] of Array.from(afSquad)) {
          if (k === last || k.endsWith(' ' + last)) return v;
        }
      }
      return fuzzyPlayerLookup(key, afSquad);
    }

    // Apply squad stats (paid API, team-specific) as primary source, overriding global index
    function applySquad(base: any): any {
      const sq = lookupSquad(base.name);
      if (!sq || sq.games < 3) return base;
      const roster = lookupRoster(base.name, base.espnId);
      const goals       = roster?.goals       ?? sq.goals;
      const assists     = roster?.assists      ?? sq.assists;
      const yellowCards = roster?.yellowCards  ?? sq.yellowCards;
      const appearances = roster?.appearances  ?? sq.games;
      const gaPerGame   = appearances > 0 ? +((goals + assists) / appearances).toFixed(2) : base.gaPerGame;
      return {
        ...base,
        mins:            sq.minsPerGame     || base.mins,
        goals, assists, gaPerGame,
        shotsPerGame:    sq.shotsPerGame    || base.shotsPerGame,
        sotPerGame:      sq.sotPerGame      || base.sotPerGame,
        foulsPerGame:    sq.foulsPerGame    || base.foulsPerGame,
        foulsWonPerGame: sq.foulsWonPerGame || base.foulsWonPerGame,
        yellowCards, redCards: sq.redCards,
        appearances, pkGoals: sq.pkGoals,
        hasRealData: true,
      };
    }

    const players    = starters.map(p => applySquad(playerDefaults(p)));
    const oppPlayers = opp.map(p => playerDefaults(p));

    // ── Per-player personal history (true last 5 across all competitions) ───
    function perPlayerLast5(name: string, field: keyof PlayerGameStat, threshold = 1): boolean[] | null {
      const key = normN(name);
      const games = perPlayerHistory.get(key)
        ?? perPlayerHistory.get(key.split(' ').pop() ?? '')
        ?? fuzzyPlayerLookup(key, perPlayerHistory);
      if (!games?.length) return null;
      const slice = games.slice(0, 5);
      const result: boolean[] = [];
      for (let i = 0; i < 5 - slice.length; i++) result.push(false);
      for (const g of [...slice].reverse()) result.push((g[field] ?? 0) >= threshold);
      return result;
    }

    // ── API-Football real last-5 helpers (highest priority) ────────────────
    function lookupAF(name: string): PlayerGameStat[] | null {
      const key = normName(name);
      if (afHistory.has(key)) return afHistory.get(key)!;

      const parts = key.split(' ').filter(w => w.length >= 3);
      if (!parts.length) return null;

      // Shared multi-word match: handles name-order differences (e.g. "Son Heung-min" vs "Heung-Min Son")
      for (const [k, v] of Array.from(afHistory)) {
        const kParts = k.split(' ').filter(w => w.length >= 3);
        const shared = parts.filter(w => kParts.includes(w));
        if (shared.length >= 2) return v;
      }

      // Surname-only (≥5 chars to avoid short-name collisions like "son", "ali", "lee")
      const last = parts[parts.length - 1];
      if (last.length >= 5 && afHistory.has(last)) return afHistory.get(last)!;

      // Fuzzy last resort: closest name within the team's player pool
      return fuzzyPlayerLookup(key, afHistory);
    }
    // Require ≥2 games before using as per-game average (avoids 1-game extremes)
    function afAvg(name: string, field: keyof PlayerGameStat): number | null {
      const games = lookupAF(name);
      if (!games || games.length < 2) return null;
      const sum = games.reduce((s, g) => s + (g[field] ?? 0), 0);
      return +(sum / games.length).toFixed(2);
    }
    function afLast5(name: string, field: keyof PlayerGameStat, threshold = 1): boolean[] | null {
      const games = lookupAF(name);
      if (!games?.length) return null;
      const slice = games.slice(0, 5); // newest first
      const result: boolean[] = [];
      for (let i = 0; i < 5 - slice.length; i++) result.push(false);
      for (const g of [...slice].reverse()) result.push((g[field] ?? 0) >= threshold);
      return result;
    }

    // ── ESPN history helpers (fallback — require ≥3 games for averages) ────
    function espnAvg(espnId: string, field: keyof PlayerGameStat): number | null {
      const games = espnId ? espnHistory.get(espnId) : undefined;
      if (!games?.length) return null;
      const sum = games.reduce((s, g) => s + (g[field] ?? 0), 0);
      return +(sum / games.length).toFixed(2);
    }
    function espnLast5(espnId: string, field: keyof PlayerGameStat, threshold = 1): boolean[] | null {
      const games = espnId ? espnHistory.get(espnId) : undefined;
      if (!games?.length) return null;
      const slice = games.slice(0, 5);
      const result: boolean[] = [];
      for (let i = 0; i < 5 - slice.length; i++) result.push(false);
      for (const g of [...slice].reverse()) result.push((g[field] ?? 0) >= threshold);
      return result;
    }
    // Only use ESPN average if ≥3 games exist (prevents single-game extremes like 4.00 fouls)
    function espnOrSafe(espnId: string, field: keyof PlayerGameStat, fallback: number): number {
      const games = espnId ? espnHistory.get(espnId) : undefined;
      if (!games || games.length < 3) return fallback;
      const sum = games.reduce((s, g) => s + (g[field] ?? 0), 0);
      const v = sum / games.length;
      return v > 0 ? +v.toFixed(2) : fallback;
    }
    function espnLast5Safe(espnId: string, field: keyof PlayerGameStat, threshold = 1): boolean[] | null {
      const games = espnId ? espnHistory.get(espnId) : undefined;
      if (!games?.length) return null;
      return espnLast5(espnId, field, threshold);
    }

    // Pick the best source for dots per stat field.
    // Priority: per-player personal history (true last 5 across all comps) > AF team history > ESPN team history.
    function bestLast5(name: string, espnId: string, field: keyof PlayerGameStat, threshold: number): boolean[] | null {
      // Per-player personal history is the most accurate source — player's own last 5 regardless of competition
      const personal = perPlayerLast5(name, field, threshold);
      if (personal) return personal;

      const afGames   = lookupAF(name);
      const espnGames = espnId ? espnHistory.get(espnId) : undefined;
      const afCount   = afGames?.length  ?? 0;
      const espnCount = espnGames?.length ?? 0;

      const afNonZero   = afGames   ? afGames.filter(g   => (g[field] ?? 0) > 0).length : 0;
      const espnNonZero = espnGames ? espnGames.filter(g => (g[field] ?? 0) > 0).length : 0;

      let games: PlayerGameStat[] | null | undefined;
      if (afNonZero > espnNonZero) {
        games = afGames;                          // AF has real data, ESPN has zeros
      } else if (espnNonZero > afNonZero) {
        games = espnGames;                        // ESPN has real data, AF has zeros
      } else if (afCount >= espnCount && afCount > 0) {
        games = afGames;                          // equal — prefer AF (more precise per-match)
      } else {
        games = espnGames ?? afGames;             // ESPN has more games, use it
      }

      if (!games?.length) return null;
      const slice = games.slice(0, 5);
      const result: boolean[] = [];
      for (let i = 0; i < 5 - slice.length; i++) result.push(false);
      for (const g of [...slice].reverse()) result.push((g[field] ?? 0) >= threshold);
      return result;
    }

    // Season average for the displayed number.
    // Priority: ESPN per-match history (min 3g) → AF per-match avg (min 2g) → fallback (squad/default).
    // AF history covers only ~8 domestic games so is reasonable for season-rate estimates.
    function bestRate(name: string, espnId: string, afField: keyof PlayerGameStat, fallback: number): number {
      const espn = espnOrSafe(espnId, afField, 0);
      if (espn > 0) return espn;
      const af = afAvg(name, afField);
      if (af !== null && af > 0) return af;
      return fallback;
    }

    // Log coverage per player: af=X/esp=Y (nz=Z) — total games and non-zero fouls count
    const afCoverage = starters.map((p: any) => {
      const name   = p.name || p.person?.name || '';
      const afG    = lookupAF(name) ?? [];
      const espG   = p.espnId ? (espnHistory.get(p.espnId) ?? []) : [];
      const afNZ   = afG.filter(g => g.fc > 0 || g.shots > 0).length;
      const espNZ  = espG.filter(g => g.fc > 0 || g.shots > 0).length;
      const status = afG.length === 0 && espG.length === 0 ? 'MISS'
                   : `af=${afG.length}(nz${afNZ})/esp=${espG.length}(nz${espNZ})`;
      return `${name.split(' ').pop()}:${status}`;
    });
    console.log(`[af-coverage] ${afCoverage.join(' | ')}`);

    const defPlayers = [...players].filter(p => !p.isGK).sort((a, b) => {
      if (a.hasRealData && !b.hasRealData) return -1;
      if (!a.hasRealData && b.hasRealData) return 1;
      return bestRate(b.name, b.espnId, 'fc', b.foulsPerGame) - bestRate(a.name, a.espnId, 'fc', a.foulsPerGame);
    }).slice(0, 10);

    const offPlayers = [...players].filter(p => !p.isGK).sort((a, b) => {
      if (a.hasRealData && !b.hasRealData) return -1;
      if (!a.hasRealData && b.hasRealData) return 1;
      return bestRate(b.name, b.espnId, 'fd', b.foulsWonPerGame) - bestRate(a.name, a.espnId, 'fd', a.foulsWonPerGame);
    }).slice(0, 10);

    return {
      defensive: defPlayers.map(p => {
        const fc = bestRate(p.name, p.espnId, 'fc', p.foulsPerGame);
        return {
          name: p.name, mins: p.mins, foulsPerGame: +fc.toFixed(2),
          tacklesPerGame: +p.tacklesPerGame.toFixed(2),
          last5Fouls: bestLast5(p.name, p.espnId, 'fc', 1),
          yellowCards: p.yellowCards,
          potentialOpponent: findOpponent(p, oppPlayers),
          form: p.form,
        };
      }),
      offensive: offPlayers.map(p => {
        const fd = bestRate(p.name, p.espnId, 'fd', p.foulsWonPerGame);
        return {
          name: p.name, mins: p.mins, foulsWonPerGame: +fd.toFixed(2),
          last5FoulsWon: bestLast5(p.name, p.espnId, 'fd', 1),
          potentialOpponent: findOpponent(p, oppPlayers),
          form: p.form,
        };
      }),
      shooting: top10(players, 'sotPerGame').map(p => {
        const sot = bestRate(p.name, p.espnId, 'sot', p.sotPerGame);
        const sh  = bestRate(p.name, p.espnId, 'shots', p.shotsPerGame);
        return {
          name: p.name, mins: p.mins, sotPerGame: +sot.toFixed(2),
          last5SoT:   bestLast5(p.name, p.espnId, 'sot', 1),
          shotsPerGame: +sh.toFixed(2),
          last5Shots: bestLast5(p.name, p.espnId, 'shots', 2),
          form: p.form,
        };
      }),
      goalscoring: top10(players, 'gaPerGame').map(p => {
        const goalRate   = p.gaPerGame * (p.goals   / Math.max(p.goals + p.assists, 1));
        const assistRate = p.gaPerGame * (p.assists / Math.max(p.goals + p.assists, 1));
        return {
          name: p.name, mins: p.mins, goals: p.goals, assists: p.assists,
          gaPerGame: +p.gaPerGame.toFixed(2),
          last5Goals:   bestLast5(p.name, p.espnId, 'goals', 1),
          last5Assists: bestLast5(p.name, p.espnId, 'assists', 1),
          form: p.form,
        };
      }),
      cards: [...players]
        .filter(p => !p.isGK)
        .sort((a, b) => {
          if (a.hasRealData && !b.hasRealData) return -1;
          if (!a.hasRealData && b.hasRealData) return 1;
          const aRate = a.yellowCards / Math.max(1, a.appearances ?? 20);
          const bRate = b.yellowCards / Math.max(1, b.appearances ?? 20);
          return bRate - aRate;
        })
        .slice(0, 10)
        .map(p => {
          const apps = p.appearances ?? 20;
          const cpg = +(p.yellowCards / Math.max(1, apps)).toFixed(2);
          return {
            name: p.name, appearances: apps,
            yellowCards: p.yellowCards,
            redCards: p.redCards ?? 0,
            cardsPerGame: cpg,
            last5Cards: bestLast5(p.name, p.espnId, 'yellowCards', 1)?.map(b => b ? 'yellow' as const : false as const) ?? null,
          };
        }),
      gk: (() => {
        const keeper = players.find(p => p.isGK);
        if (!keeper) return [];
        const afSaves   = afAvg(keeper.name, 'saves');
        const espnSaves = espnAvg(keeper.espnId, 'saves');
        // Use > 0 check: a GK always saves some shots; 0 means the data source doesn't track it
        const savesPerGame = (afSaves != null && afSaves > 0) ? afSaves
                           : (espnSaves != null && espnSaves > 0) ? espnSaves
                           : 3.0;
        return [{
          name: keeper.name,
          savesPerGame: +savesPerGame.toFixed(2),
          last5Saves: bestLast5(keeper.name, keeper.espnId, 'saves', 3),
        }];
      })(),
    };
  }

  const allLineupPlayers = [...homeStarters, ...awayStarters].map((p: any) => ({
    espnId: (p.espnId ?? '') as string,
    name: p.name || p.person?.name || '',
  }));
  const lineupIds = allLineupPlayers.map(p => p.espnId).filter(Boolean);
  const matchedIds = lineupIds.filter((id: string) => espnHistory.has(id));
  let nonZeroSample = 'none';
  for (const id of matchedIds) {
    const games = espnHistory.get(id)!;
    const hasNonZero = games.some(g => g.fc > 0 || g.fd > 0 || g.goals > 0 || g.sot > 0);
    if (hasNonZero) {
      const p = allLineupPlayers.find(p => p.espnId === id);
      nonZeroSample = `player:${p?.name ?? id}`;
      break;
    }
  }
  const diag = `espnIds:${lineupIds.length} matched:${matchedIds.length} | nonZero:${nonZeroSample}`;

  // Log how many lineup players have AF history (name-match check)
  const homeMatched = homeStarters.filter((p: any) => {
    const n = normName(p.name || p.person?.name || '');
    return afHistoryHome.has(n) || (n.split(' ').pop()?.length ?? 0) > 3 && Array.from(afHistoryHome.keys()).some(k => k.includes(n.split(' ').pop()!));
  }).length;
  const awayMatched = awayStarters.filter((p: any) => {
    const n = normName(p.name || p.person?.name || '');
    return afHistoryAway.has(n) || (n.split(' ').pop()?.length ?? 0) > 3 && Array.from(afHistoryAway.keys()).some(k => k.includes(n.split(' ').pop()!));
  }).length;
  const afDiag = `AF matched: home ${homeMatched}/${homeStarters.length}, away ${awayMatched}/${awayStarters.length}`;

  return { home: buildSide(homeStarters, awayStarters, afHistoryHome, afSquadHome, perPlayerHistoryHome), away: buildSide(awayStarters, homeStarters, afHistoryAway, afSquadAway, perPlayerHistoryAway), diag: diag + ' | ' + afDiag };
}

// ── Date helpers ───────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  });
}
function formatKickoff(iso: string) {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const tz = d.toLocaleTimeString('en-GB', { timeZoneName: 'short', timeZone: 'Europe/London' }).includes('BST') ? 'BST' : 'GMT';
  return `${hm} ${tz}`;
}
// fd.org team IDs whose crest CDN returns 404 — override with ESPN CDN
const BADGE_OVERRIDES: Record<string, string> = {
  '100':  'https://a.espncdn.com/i/teamlogos/soccer/500/104.png',  // AS Roma
  '113':  'https://a.espncdn.com/i/teamlogos/soccer/500/114.png',  // SSC Napoli
  '522':  'https://a.espncdn.com/i/teamlogos/soccer/500/2502.png', // OGC Nice
  '548':  'https://a.espncdn.com/i/teamlogos/soccer/500/174.png',  // AS Monaco FC
  '7397': 'https://a.espncdn.com/i/teamlogos/soccer/500/2572.png', // Como 1907
};
function teamBadge(teamId: string | number) {
  const id = String(teamId);
  return BADGE_OVERRIDES[id] ?? `https://crests.football-data.org/${id}.svg`;
}

function matchId(home: string, away: string) {
  const slug = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${slug(home)}-vs-${slug(away)}`;
}
// Normalised match ID for fuzzy dedup — strips club suffixes/prefixes so
// "Arsenal FC" and "Arsenal", "Club Atlético de Madrid" and "Atlético Madrid" match
function normMatchId(home: string, away: string) {
  const norm = (s: string) => (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|bfc|ssc|ac|as|rb|vfb|club|de|van|united|city)\b/g, ' ')
    .replace(/munchen/g, 'munich')     // FC Bayern München → Bayern Munich
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, '-').replace(/^-|-$/g, '');
  return `${norm(home)}-vs-${norm(away)}`;
}

// ── ESPN team ID lookup (for demo sync) ───────────────────────────────────
async function findEspnTeamId(league: string, teamName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const teams: any[] = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
    const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = norm(teamName);
    for (const { team } of teams) {
      const dn = norm(team.displayName ?? '');
      const sn = norm(team.shortDisplayName ?? '');
      if (dn === q || sn === q || dn.includes(q) || q.includes(dn)) return String(team.id);
    }
  } catch {}
  return null;
}

// ── Football-data.org fetch ────────────────────────────────────────────────
const BASE_URL = 'https://api.football-data.org/v4';
const COMPETITIONS = ['PL', 'CL', 'EL', 'ECL', 'PD', 'BL1', 'SA', 'FL1', 'DED', 'PPL'];
const FINISHED_STATUSES = new Set(['FINISHED', 'AWARDED', 'CANCELLED']);

const _apiCache = new Map<string, { data: any; exp: number }>();

async function apiFetch(path: string, ttlMs = 5 * 60 * 1000) {
  const cached = _apiCache.get(path);
  if (cached && Date.now() < cached.exp) return cached.data;
  await new Promise(r => setTimeout(r, 300));
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY! },
  });
  if (res.status === 429) { await new Promise(r => setTimeout(r, 60000)); return apiFetch(path, ttlMs); }
  if (!res.ok) { console.warn(`[sync] ${res.status} for ${path}`); return null; }
  const data = await res.json();
  _apiCache.set(path, { data, exp: Date.now() + ttlMs });
  return data;
}

// ── Main sync logic ────────────────────────────────────────────────────────
async function runSync() {
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  log(`[sync] Running — ${new Date().toISOString()}`);

  // Load paid API-Sports global index (fallback for players not covered by squad stats)
  const apiSportsIdx = await getApiSportsIndex();
  log(`[sync] API-Sports index: ${apiSportsIdx.size} name keys`);

  const today = new Date();
  const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  const in21d  = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000);
  const fmt    = (d: Date) => d.toISOString().slice(0, 10);

  const data = await apiFetch(
    `/matches?competitions=${COMPETITIONS.join(',')}&dateFrom=${fmt(twoDaysAgo)}&dateTo=${fmt(in21d)}`
  );
  // Don't abort if fd.org fails — ESPN supplement still handles CL/EL/ECL
  if (!data?.matches) log('[sync] fd.org: no matches returned (rate limit or API issue)');

  log(`[sync] Found ${data?.matches?.length ?? 0} matches`);

  const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'HALF_TIME', 'EXTRA_TIME', 'PENALTY']);

  const liveMatches: any[] = (await sbGet('matches') as any[]) ?? [];
  const pendingList: any[] = [];
  const nearTermMatches: any[] = [];

  const apiMatchIds = new Set(
    (data?.matches ?? [])
      .filter((m: any) => m.homeTeam?.name && m.awayTeam?.name)
      .map((m: any) => matchId(m.homeTeam.name, m.awayTeam.name))
  );
  // Keep recently-finished ESPN matches (CL/EL/ECL don't appear in fd.org so they'd always be stale)
  const stale = liveMatches.filter((m: any) => {
    if (apiMatchIds.has(m.id)) return false;
    const kickoff = new Date(m.utcDate ?? 0).getTime();
    const hoursFromKo = (Date.now() - kickoff) / 3_600_000;
    return hoursFromKo > 4; // only remove if >4h since kickoff
  });
  for (const m of stale) {
    const sb = getSb(); if (sb) await sb.from('match_cache').delete().eq('key', `match:${m.id}`);
    liveMatches.splice(liveMatches.findIndex((x: any) => x.id === m.id), 1);
    log(`[sync] Removed stale: ${m.id}`);
  }

  // Phase 1: fast pass — classify matches without any API calls
  for (const match of (data?.matches ?? [])) {
    // Skip matches with null team names (fd.org tier restriction — ESPN will cover these)
    if (!match.homeTeam?.name || !match.awayTeam?.name) continue;
    const id     = matchId(match.homeTeam.name, match.awayTeam.name);
    const status = match.status;
    const kickoff   = new Date(match.utcDate);
    const hoursAway = (kickoff.getTime() - Date.now()) / 3_600_000;

    // Skip and clean up: remove FINISHED matches after 90 min, or any match >4h past kickoff
    const tooOld = hoursAway <= -4;
    const finished = FINISHED_STATUSES.has(status) && hoursAway < -1.5;
    if (tooOld || finished) {
      const sb = getSb(); if (sb) await sb.from('match_cache').delete().eq('key', `match:${id}`);
      const updated = liveMatches.filter((m: any) => m.id !== id);
      liveMatches.splice(0, liveMatches.length, ...updated);
      continue;
    }
    // Recently finished matches (within 3 hours) still get a final data pass
    const isLive = LIVE_STATUSES.has(status);

    if (hoursAway > 24 && !isLive) {
      if (!pendingList.find((m: any) => m.id === id) && !liveMatches.find((m: any) => m.id === id)) {
        const homeName = match.homeTeam?.name;
        const awayName = match.awayTeam?.name;
        pendingList.push({
          id, competition: match.competition?.name || 'Football',
          stage: match.stage ? match.stage.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : match.matchday ? `Matchday ${match.matchday}` : 'Match',
          utcDate: match.utcDate,
          date: formatDate(match.utcDate), kickoff: formatKickoff(match.utcDate),
          homeTeam: { name: homeName, badge: teamBadge(match.homeTeam.id), primaryColor: getTeamColor(homeName) },
          awayTeam: { name: awayName, badge: teamBadge(match.awayTeam.id), primaryColor: getTeamColor(awayName) },
        });
      }
      continue;
    }
    nearTermMatches.push(match);
  }

  log(`[sync] Phase 1 done — ${pendingList.length} far-pending, ${nearTermMatches.length} near-term to process`);

  // ── Auto-prefetch: ensure every near-term match has AF data in Supabase ───
  // Runs once on the first sync after a match enters the near-term window.
  // Subsequent syncs find the prefetch data and make zero AF calls.
  {
    const afKeyForPrefetch = (process.env.API_SPORTS_KEY ?? '').trim();
    if (afKeyForPrefetch) {
      for (const m of nearTermMatches) {
        if (!m.homeTeam?.name || !m.awayTeam?.name) continue;
        const mId = matchId(m.homeTeam.name, m.awayTeam.name);
        const existing = await sbGet(`prefetch:${mId}`) as { fetchedAt?: number } | null;
        // Skip if prefetched within the last 6 hours
        if (existing?.fetchedAt && Date.now() - existing.fetchedAt < 6 * 60 * 60 * 1000) continue;
        log(`[sync] Auto-prefetch: ${mId}`);
        await prefetchMatch(mId, m.homeTeam.name, m.awayTeam.name, m.utcDate ?? '', afKeyForPrefetch, log);
      }
    }
  }

  // ── ESPN supplement for CL / EL / ECL (fd.org free tier omits these) ──────
  const ESPN_COMP_LEAGUES = [
    { league: 'uefa.champions',   compName: 'UEFA Champions League' },
    { league: 'uefa.europa',      compName: 'UEFA Europa League' },
    { league: 'uefa.europa.conf', compName: 'UEFA Europa Conference League' },
    { league: 'eng.fa',           compName: 'FA Cup' },
  ];
  // Exclude liveMatches from seenIds so ESPN-sourced EL/ECL/CL matches get re-processed
  // every sync cycle (keeps referee, stats, etc. fresh throughout matchday)
  const seenIds = new Set([
    ...pendingList.map((m: any) => m.id),
    ...nearTermMatches.map((m: any) => matchId(m.homeTeam?.name, m.awayTeam?.name)),
  ]);
  let espnAdded = 0;
  const seenNormIds = new Set<string>([
    ...pendingList.map((m: any) => normMatchId(m.homeTeam?.name, m.awayTeam?.name)),
    ...nearTermMatches.map((m: any) => normMatchId(m.homeTeam?.name, m.awayTeam?.name)),
  ]);
  for (const { league, compName } of ESPN_COMP_LEAGUES) {
    for (let d = 0; d < 30; d++) {
      const dt = new Date(Date.now() + d * 86_400_000);
      const ds = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}`;
      let board: any;
      try {
        // Only throttle near-term days; far-future fixture discovery doesn't need the delay
        if (d < 8) await new Promise(r => setTimeout(r, 300));
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${ds}&_cb=${Date.now()}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', 'Accept': 'application/json' }, cache: 'no-store' }
        );
        if (!res.ok) continue;
        board = await res.json();
      } catch { continue; }
      for (const ev of board?.events ?? []) {
        const comp = ev.competitions?.[0];
        // Allow recently-finished matches through (within 3h) so the cheat sheet stays visible post-match
        const koTime = new Date(ev.date).getTime();
        const hoursFromKo = (Date.now() - koTime) / 3_600_000;
        if (comp?.status?.type?.completed && hoursFromKo > 4) continue;
        const homeComp = comp?.competitors?.find((c: any) => c.homeAway === 'home');
        const awayComp = comp?.competitors?.find((c: any) => c.homeAway === 'away');
        const homeName = homeComp?.team?.displayName;
        const awayName = awayComp?.team?.displayName;
        if (!homeName || !awayName) continue;
        const id = matchId(homeName, awayName);
        const nid = normMatchId(homeName, awayName);
        if (seenIds.has(id) || seenNormIds.has(nid)) continue;
        seenIds.add(id);
        seenNormIds.add(nid);
        const hoursAway = (koTime - Date.now()) / 3_600_000;
        if (hoursAway < -4) continue;
        const notes: any[] = comp?.notes ?? [];
        const stage = notes[0]?.headline || (comp?.type?.abbreviation ? `${comp.type.abbreviation}` : 'Match');
        const homeEspnId = homeComp.team.id;
        const awayEspnId = awayComp.team.id;
        const homeBadge = `https://a.espncdn.com/i/teamlogos/soccer/500/${homeEspnId}.png`;
        const awayBadge = `https://a.espncdn.com/i/teamlogos/soccer/500/${awayEspnId}.png`;
        espnAdded++;
        // Always add to pendingList so the match card appears immediately (even within 24h).
        // Near-term matches are also added to nearTermMatches for full sheet processing.
        pendingList.push({
          id, competition: compName, stage, utcDate: ev.date,
          date: formatDate(ev.date), kickoff: formatKickoff(ev.date),
          homeTeam: { name: homeName, badge: homeBadge, primaryColor: getTeamColor(homeName) },
          awayTeam: { name: awayName, badge: awayBadge, primaryColor: getTeamColor(awayName) },
        });
        if (hoursAway <= 24) {
          nearTermMatches.push({
            _fromEspn: true, _espnLeague: league,
            id: ev.id, status: comp?.status?.type?.name ?? 'SCHEDULED', utcDate: ev.date,
            homeTeam: { name: homeName, id: homeEspnId }, awayTeam: { name: awayName, id: awayEspnId },
            competition: { name: compName }, stage, referees: [], matchday: null,
            _homeBadge: homeBadge, _awayBadge: awayBadge,
          });
        }
      }
    }
  }
  log(`[sync] ESPN supplement: +${espnAdded} CL/EL/ECL matches`);

  // ── AF supplement for extra leagues (Championship, Scottish Prem, etc.) ─────
  // Uses API-Football as the match source for leagues outside fd.org's free tier.
  const AF_SUPPLEMENT_LEAGUES = [
    { leagueId: 40,  compName: 'EFL Championship',    espnSlug: 'eng.2' as string | null },
    { leagueId: 179, compName: 'Scottish Premiership', espnSlug: 'sco.1' },
    { leagueId: 144, compName: 'Belgian Pro League',   espnSlug: 'bel.1' },
    { leagueId: 203, compName: 'Süper Lig',            espnSlug: 'tur.1' },
  ];
  const afSupKey = (process.env.API_SPORTS_KEY ?? '').trim();
  let afAdded = 0;
  if (afSupKey) {
    const AF_LIVE_STATUS  = new Set(['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'HT', 'INT']);
    const AF_FIN_STATUS   = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
    const AF_FIXTURE_CACHE_KEY = 'af_fixture_list_cache';
    const AF_FIXTURE_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours — reduces 1,728 AF calls/day to ~72
    type AfCacheEntry = { fetchedAt: number; fixtures: Array<{ fix: any; lgIdx: number }> };
    const cached = await sbGet(AF_FIXTURE_CACHE_KEY) as AfCacheEntry | null;
    let allAfFixtures: Array<Array<{ fix: any; lg: typeof AF_SUPPLEMENT_LEAGUES[0] }>>;
    if (cached && Date.now() - cached.fetchedAt < AF_FIXTURE_CACHE_TTL) {
      log(`[sync] AF fixture list from cache (${Math.round((Date.now() - cached.fetchedAt) / 60000)}m old)`);
      // Reconstruct batches indexed by league position
      allAfFixtures = AF_SUPPLEMENT_LEAGUES.map((lg, i) =>
        cached.fixtures.filter(e => e.lgIdx === i).map(e => ({ fix: e.fix, lg }))
      );
    } else {
      const batches = await Promise.all(
        AF_SUPPLEMENT_LEAGUES.map((lg, i) =>
          fetchAfFixturesByDateRange(lg.leagueId, fmt(twoDaysAgo), fmt(in7d), 2025, afSupKey)
            .then(fixes => fixes.map(f => ({ fix: f, lg, lgIdx: i })))
            .catch(() => [] as Array<{ fix: any; lg: typeof AF_SUPPLEMENT_LEAGUES[0]; lgIdx: number }>)
        )
      );
      // Store flat list with league index so it's serialisable
      const flat = batches.flat().map(({ fix, lgIdx }) => ({ fix, lgIdx }));
      await sbSet(AF_FIXTURE_CACHE_KEY, { fetchedAt: Date.now(), fixtures: flat }, log);
      allAfFixtures = batches.map(batch => batch.map(({ fix, lg }) => ({ fix, lg })));
      log(`[sync] AF fixture list refreshed: ${flat.length} fixtures across ${AF_SUPPLEMENT_LEAGUES.length} leagues`);
    }
    for (const batch of allAfFixtures) {
      for (const { fix, lg } of batch) {
        const id  = matchId(fix.home.name, fix.away.name);
        const nid = normMatchId(fix.home.name, fix.away.name);
        if (seenIds.has(id) || seenNormIds.has(nid)) continue;
        const koTime    = new Date(fix.utcDate).getTime();
        const hoursAway = (koTime - Date.now()) / 3_600_000;
        if (hoursAway < -4) continue;
        const status = AF_LIVE_STATUS.has(fix.status) ? 'IN_PLAY'
          : AF_FIN_STATUS.has(fix.status) ? 'FINISHED' : 'SCHEDULED';
        seenIds.add(id);
        seenNormIds.add(nid);
        const stageText = fix.leagueRound
          .replace(/Regular Season - (\d+)/i, 'Matchday $1')
          .replace(/^(\d+)$/, 'Matchday $1');
        pendingList.push({
          id, competition: lg.compName, stage: stageText, utcDate: fix.utcDate,
          date: formatDate(fix.utcDate), kickoff: formatKickoff(fix.utcDate),
          homeTeam: { name: fix.home.name, badge: fix.home.logo || '', primaryColor: getTeamColor(fix.home.name) },
          awayTeam: { name: fix.away.name, badge: fix.away.logo || '', primaryColor: getTeamColor(fix.away.name) },
        });
        if (hoursAway <= 24) {
          nearTermMatches.push({
            _fromAf: true, _afFixtureId: fix.id, _afLeagueId: lg.leagueId, _afEspnSlug: lg.espnSlug,
            id, status, utcDate: fix.utcDate,
            homeTeam: { name: fix.home.name, id: String(fix.home.id) },
            awayTeam: { name: fix.away.name, id: String(fix.away.id) },
            competition: { name: lg.compName }, stage: stageText,
            referees: fix.referee ? [{ name: fix.referee }] : [], matchday: null,
            _homeBadge: fix.home.logo || '', _awayBadge: fix.away.logo || '',
          });
        }
        afAdded++;
      }
    }
  }
  log(`[sync] AF supplement: +${afAdded} extra-league matches`);

  // Write upcoming now — far-future matches are ready; near-term will be added below
  await sbSet('upcoming', pendingList, log);

  // Phase 2: slow pass — lineup checks for near-term matches
  // Prioritise ESPN/AF supplement matches (FA Cup, CL, etc.) so they aren't starved by fd.org matches
  nearTermMatches.sort((a, b) => {
    const aSupp = (a._fromEspn || a._fromAf) ? 0 : 1;
    const bSupp = (b._fromEspn || b._fromAf) ? 0 : 1;
    return aSupp - bSupp;
  });
  for (const match of nearTermMatches) {
    const id     = matchId(match.homeTeam?.name, match.awayTeam?.name);
    try {
    const status = match.status;
    const kickoff   = new Date(match.utcDate);
    const hoursAway = (kickoff.getTime() - Date.now()) / 3_600_000;
    const isLive = LIVE_STATUSES.has(status);

    const fromEspn = !!(match as any)._fromEspn;
    const fromAf   = !!(match as any)._fromAf;
    let lineupData = (fromEspn || fromAf) ? null : await apiFetch(`/matches/${match.id}/lineups`, 2 * 60 * 1000);
    let hasLineups = lineupData?.homeTeam?.lineup?.length > 0 || lineupData?.homeTeam?.startingEleven?.length > 0;

    // For ESPN supplement matches, fetch referee from event summary
    let espnRefName = '';
    if (fromEspn && match.id) {
      try {
        const espnLeague = (match as any)._espnLeague ?? 'uefa.europa';
        const sumRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/summary?event=${match.id}`,
          { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, cache: 'no-store' }
        );
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          espnRefName = sumData?.gameInfo?.officials?.[0]?.displayName ?? '';
        }
      } catch {}
    }

    const homeName = match.homeTeam?.name;
    const awayName = match.awayTeam?.name;
    const homeBadge = (match as any)._homeBadge ?? teamBadge(match.homeTeam.id);
    const awayBadge = (match as any)._awayBadge ?? teamBadge(match.awayTeam.id);
    const stage = match.stage
      ? match.stage.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      : match.matchday ? `Matchday ${match.matchday}` : 'Match';

    // Step 1: Try ESPN for lineups + team IDs (0 AF calls). If that fails and match is
    // from AF source within 3h of kickoff, fall back to AF confirmed lineups (1 AF call).
    let espnHistory: Map<string, PlayerGameStat[]> = new Map();
    let confirmedEspnMeta: { league: string; homeTeamId: string; awayTeamId: string } | null = null;
    if (!hasLineups) {
      log(`[sync] Trying ESPN: ${homeName} vs ${awayName}`);
      const { lineups: afLineups, debug: afDebug, espnMeta } = await getApiFootballLineups(homeName, awayName, match.utcDate);
      if (afDebug) log(`[api-football] ${afDebug}`);
      if (afLineups) {
        lineupData = afLineups;
        hasLineups = true;
        log(`[sync] ESPN lineups found for ${homeName} vs ${awayName}`);
      }
      if (espnMeta?.league && espnMeta.homeTeamId && espnMeta.awayTeamId) {
        confirmedEspnMeta = espnMeta;
      } else {
        log(`[sync] No ESPN meta from lineup fetch — espnMeta=${JSON.stringify(espnMeta)}`);
      }

      // AF fallback: only for AF-sourced matches within 3h of kickoff
      if (!hasLineups && fromAf && hoursAway < 3) {
        const afFixId: number = (match as any)._afFixtureId;
        if (afFixId && afSupKey) {
          const afLU = await fetchAfConfirmedLineups(afFixId, afSupKey);
          if (afLU) { lineupData = afLU; hasLineups = true; log(`[sync] AF lineups confirmed: ${homeName} vs ${awayName}`); }
        }
      }
    }

    // Step 2: If fd.org provided lineups but we still have no ESPN meta, look up team IDs via scoreboard.
    // This is the common case: fd.org publishes lineups early but ESPN hasn't confirmed rosters yet.
    // We still need ESPN team IDs to fetch per-player game history for accurate per-game rates.
    if (hasLineups && !confirmedEspnMeta) {
      const meta = await getEspnTeamIds(homeName, awayName, match.utcDate);
      if (meta) {
        confirmedEspnMeta = meta;
        log(`[sync] ESPN meta via scoreboard (fd.org lineup): league=${meta.league} home=${meta.homeTeamId} away=${meta.awayTeamId}`);
      } else {
        log(`[sync] ESPN team IDs not found for ${homeName} vs ${awayName}`);
      }
    }

    // Load prefetch data (zero AF calls if present)
    const prefetched = isLive ? null : await sbGet(`prefetch:${id}`) as PrefetchData | null;
    if (prefetched) log(`[sync] Prefetch found for ${id} (fetched ${Math.round((Date.now() - prefetched.fetchedAt) / 60000)}m ago)`);

    // Step 3: Fetch per-player ESPN history — skip when prefetch covers it
    if (!prefetched && confirmedEspnMeta) {
      log(`[sync] Fetching ESPN history — league:${confirmedEspnMeta.league} home:${confirmedEspnMeta.homeTeamId} away:${confirmedEspnMeta.awayTeamId}`);
      const [homeResult, awayResult] = await Promise.all([
        fetchTeamPlayerHistory(confirmedEspnMeta.homeTeamId, confirmedEspnMeta.league, homeName),
        fetchTeamPlayerHistory(confirmedEspnMeta.awayTeamId, confirmedEspnMeta.league, awayName),
      ]);
      homeResult.history.forEach((v, k) => espnHistory.set(k, v));
      awayResult.history.forEach((v, k) => espnHistory.set(k, v));
      log(`[sync] ESPN: ${espnHistory.size} player records | home corners=${homeResult.seasonStats?.cornersFor ?? 'n/a'} shots=${homeResult.seasonStats?.shotsFor ?? 'n/a'} | away corners=${awayResult.seasonStats?.cornersFor ?? 'n/a'} shots=${awayResult.seasonStats?.shotsFor ?? 'n/a'} | debug: ${homeResult.debug}`);
      (espnHistory as any).__homeStats = homeResult.seasonStats;
      (espnHistory as any).__awayStats = awayResult.seasonStats;
    }

    if (!hasLineups) {
      log(`[sync] No lineups yet: ${homeName} vs ${awayName}`);
      if (hoursAway > -4 && !liveMatches.find((m: any) => m.id === id)) {
        pendingList.push({
          id, competition: match.competition?.name || 'Football', stage,
          utcDate: match.utcDate,
          date: formatDate(match.utcDate), kickoff: formatKickoff(match.utcDate),
          homeTeam: { name: homeName, badge: homeBadge, primaryColor: getTeamColor(homeName) },
          awayTeam: { name: awayName, badge: awayBadge, primaryColor: getTeamColor(awayName) },
        });
        log(`[sync] pending (near): ${id} utcDate=${match.utcDate}`);
      }
      continue;
    }

    log(`[sync] Generating${isLive ? ' (live)' : ''}: ${homeName} vs ${awayName}`);

    const [homeResults, awayResults] = (fromEspn || fromAf)
      ? [null, null]
      : await Promise.all([
          apiFetch(`/teams/${match.homeTeam.id}/matches?status=FINISHED&limit=10`, 60 * 60 * 1000),
          apiFetch(`/teams/${match.awayTeam.id}/matches?status=FINISHED&limit=10`, 60 * 60 * 1000),
        ]);

    // Fetch ESPN domestic roster stats — skip when prefetch covers it
    const combinedRosterMap = new Map<string, EspnRosterPlayer>();
    if (!prefetched && confirmedEspnMeta) {
      const [homeRosterMap, awayRosterMap] = await Promise.all([
        fetchEspnRosterStats(confirmedEspnMeta.homeTeamId, confirmedEspnMeta.league),
        fetchEspnRosterStats(confirmedEspnMeta.awayTeamId, confirmedEspnMeta.league),
      ]);
      homeRosterMap.forEach((v, k) => combinedRosterMap.set(k, v));
      awayRosterMap.forEach((v, k) => combinedRosterMap.set(k, v));
      log(`[roster] ESPN domestic stats: ${combinedRosterMap.size} players`);
    }

    // Load AF data from prefetch (zero quota) or fetch live as fallback
    const afApiKey = (process.env.API_SPORTS_KEY ?? '').trim();
    const espnLeagueToAfId: Record<string, number> = {
      'uefa.champions': 2, 'uefa.europa': 3, 'uefa.europa.conf': 848,
    };
    const afLeagueId = fromEspn
      ? (espnLeagueToAfId[(match as any)._espnLeague ?? ''] ?? 0)
      : fromAf ? ((match as any)._afLeagueId ?? 0)
      : 0;

    let homeAfResult: { history: Map<string, PlayerGameStat[]>; playerIds: Map<string, number>; afTeamId: number; afTeamStats: AfTeamFixtureStats | null; debug: string };
    let awayAfResult: typeof homeAfResult;
    let homeSquadResult: { stats: Map<string, AfSquadPlayer>; debug: string };
    let awaySquadResult: typeof homeSquadResult;
    let afReferee: string;
    let afOdds: MatchOdds | null;

    if (prefetched) {
      homeAfResult   = prefetchToAfResult(prefetched.home);
      awayAfResult   = prefetchToAfResult(prefetched.away);
      homeSquadResult = prefetchToSquadResult(prefetched.home);
      awaySquadResult = prefetchToSquadResult(prefetched.away);
      afReferee      = prefetched.referee;
      afOdds         = prefetched.odds;
      log(`[sync] AF data from prefetch — home ${homeAfResult.playerIds.size} ids, away ${awayAfResult.playerIds.size} ids`);
    } else {
      [homeAfResult, awayAfResult, homeSquadResult, awaySquadResult, afReferee, afOdds] = await Promise.all([
        afApiKey ? fetchApiFootballTeamHistory(homeName, afApiKey) : Promise.resolve({ history: new Map<string, PlayerGameStat[]>(), playerIds: new Map<string, number>(), afTeamId: 0, afTeamStats: null as AfTeamFixtureStats | null, debug: 'no key' }),
        afApiKey ? fetchApiFootballTeamHistory(awayName, afApiKey) : Promise.resolve({ history: new Map<string, PlayerGameStat[]>(), playerIds: new Map<string, number>(), afTeamId: 0, afTeamStats: null as AfTeamFixtureStats | null, debug: 'no key' }),
        afApiKey ? fetchApiFootballSquadStats(homeName, afApiKey) : Promise.resolve({ stats: new Map<string, AfSquadPlayer>(), debug: 'no key' }),
        afApiKey ? fetchApiFootballSquadStats(awayName, afApiKey) : Promise.resolve({ stats: new Map<string, AfSquadPlayer>(), debug: 'no key' }),
        (() => {
          if (!afApiKey) return Promise.resolve('');
          if (afLeagueId) return fetchApiFootballRefereeByLeague(afLeagueId, match.utcDate ?? '', homeName, awayName, afApiKey);
          return fetchApiFootballReferee(homeName, afApiKey, match.utcDate);
        })(),
        afApiKey ? fetchApiFootballOdds(homeName, awayName, match.utcDate ?? '', afApiKey, afLeagueId || undefined) : Promise.resolve(null as MatchOdds | null),
      ]);
      log(`[af-history] home: ${homeAfResult.debug}`);
      log(`[af-history] away: ${awayAfResult.debug}`);
      log(`[af-squad] home: ${homeSquadResult.debug}`);
      log(`[af-squad] away: ${awaySquadResult.debug}`);
    }

    const homeStats = buildTeamStats(homeResults?.matches, match.homeTeam.id, (espnHistory as any).__homeStats ?? null, (espnHistory as any).__awayStats ?? null, homeAfResult.afTeamStats ?? null, awayAfResult.afTeamStats ?? null);
    const awayStats = buildTeamStats(awayResults?.matches, match.awayTeam.id, (espnHistory as any).__awayStats ?? null, (espnHistory as any).__homeStats ?? null, awayAfResult.afTeamStats ?? null, homeAfResult.afTeamStats ?? null);
    log(`[stats] ${homeName}: goals=${homeStats.goalsFor}F/${homeStats.goalsAgainst}A corners=${homeStats.cornersFor} shots=${homeStats.shotsFor}`);
    log(`[stats] ${awayName}: goals=${awayStats.goalsFor}F/${awayStats.goalsAgainst}A corners=${awayStats.cornersFor} shots=${awayStats.shotsFor}`);
    log(`[odds] ${afOdds ? `market: ${afOdds.homeWin}%/${afOdds.draw}%/${afOdds.awayWin}% btts=${afOdds.btts}%` : 'no market odds — using Poisson'}`);

    // ── Per-player personal history ───────────────────────────────────────────
    let perPlayerHistoryHome = new Map<string, PlayerGameStat[]>();
    let perPlayerHistoryAway = new Map<string, PlayerGameStat[]>();
    if (afApiKey) {
      const homeStarters: any[] = lineupData.homeTeam?.lineup || lineupData.homeTeam?.startingEleven || [];
      const awayStarters: any[] = lineupData.awayTeam?.lineup || lineupData.awayTeam?.startingEleven || [];

      if (prefetched) {
        // ── Prefetch path: name matching with 4-step auto-repair, zero extra AF calls for matched players ──
        const resolveFromPrefetch = async (
          starters: any[],
          team: PrefetchData['home'],
        ): Promise<Map<string, PlayerGameStat[]>> => {
          const result = new Map<string, PlayerGameStat[]>();
          for (const p of starters) {
            const name: string = p.name || '';
            if (!name) continue;
            const afId = await resolveAfId(name, team, afApiKey, log);
            if (afId != null) {
              const history = team.personalHistories[String(afId)] ?? [];
              result.set(normPrefetch(name), history);
            }
          }
          return result;
        };

        [perPlayerHistoryHome, perPlayerHistoryAway] = await Promise.all([
          resolveFromPrefetch(homeStarters, prefetched.home),
          resolveFromPrefetch(awayStarters, prefetched.away),
        ]);
        log(`[per-player] prefetch path — home ${perPlayerHistoryHome.size}/${homeStarters.length}, away ${perPlayerHistoryAway.size}/${awayStarters.length}`);
      } else {
        // ── Live path: resolve IDs then fetch personal histories from AF ──────
        const resolvePlayerIds = async (starters: any[], afResult: typeof homeAfResult): Promise<Map<number, string>> => {
          const idToName = new Map<number, string>();
          const missing: Array<{ name: string }> = [];
          for (const p of starters) {
            const name: string = p.name || '';
            if (!name) continue;
            const key = normName(name);
            const afId = afResult.playerIds.get(key)
              ?? afResult.playerIds.get(key.split(' ').pop() ?? '')
              ?? fuzzyPlayerLookup(key, afResult.playerIds);
            if (afId) {
              idToName.set(afId, name);
            } else {
              missing.push({ name });
            }
          }
          if (missing.length > 0 && afResult.afTeamId) {
            for (const { name } of missing) {
              const found = await lookupAfPlayerId(name, afResult.afTeamId, afApiKey);
              if (found) idToName.set(found, name);
            }
          }
          return idToName;
        };

        const [homeIdMap, awayIdMap] = await Promise.all([
          resolvePlayerIds(homeStarters, homeAfResult),
          resolvePlayerIds(awayStarters, awayAfResult),
        ]);
        log(`[per-player] live: home ${homeIdMap.size}/${homeStarters.length} IDs, away ${awayIdMap.size}/${awayStarters.length} IDs`);

        const homePersonal = await fetchPlayerPersonalHistoryBatch(Array.from(homeIdMap.keys()), afApiKey);
        const awayPersonal = await fetchPlayerPersonalHistoryBatch(Array.from(awayIdMap.keys()), afApiKey);
        log(`[per-player] live: home ${homePersonal.size} histories, away ${awayPersonal.size} histories`);

        for (const [id, games] of Array.from(homePersonal)) {
          const name = homeIdMap.get(id);
          if (name) perPlayerHistoryHome.set(normName(name), games);
        }
        for (const [id, games] of Array.from(awayPersonal)) {
          const name = awayIdMap.get(id);
          if (name) perPlayerHistoryAway.set(normName(name), games);
        }
      }
    }

    const players = await buildPlayers(lineupData.homeTeam, lineupData.awayTeam, espnHistory, apiSportsIdx, combinedRosterMap, homeAfResult.history, awayAfResult.history, homeSquadResult.stats, awaySquadResult.stats, perPlayerHistoryHome, perPlayerHistoryAway);
    log(`[buildPlayers] ${players.diag}`);

    const matchData = {
      competition: (typeof match.competition === 'string' ? match.competition : match.competition?.name) || 'Football', stage,
      date: formatDate(match.utcDate), kickoff: formatKickoff(match.utcDate),
      homeTeam: { name: homeName, primaryColor: getTeamColor(homeName), badge: homeBadge, stats: homeStats, players: players.home },
      awayTeam: { name: awayName, primaryColor: getTeamColor(awayName), badge: awayBadge, stats: awayStats, players: players.away },
      referee: {
        name: espnRefName || afOdds?.referee || afReferee || match.referees?.[0]?.name || 'TBC',
        matchAvg: {
          fouls: +(homeStats.foulsCommitted + awayStats.foulsCommitted).toFixed(1),
          cards:  +(homeStats.cardsFor      + awayStats.cardsFor).toFixed(1),
        },
      },
      probabilities: (() => {
        const HOME_ADV = 1.25;
        const lH = Math.max(0.3, (homeStats.goalsFor + awayStats.goalsAgainst) / 2 * HOME_ADV);
        const lA = Math.max(0.3, (awayStats.goalsFor + homeStats.goalsAgainst) / 2);
        const poissonBtts = Math.round((1 - Math.exp(-lH)) * (1 - Math.exp(-lA)) * 100);
        // Use bookmaker odds when available; for BTTS, use Poisson if no BTTS market found
        // (the default of exactly 50 signals no market was found, not a real bookmaker value)
        if (afOdds && afOdds.homeWin > 0) {
          return { ...afOdds, btts: afOdds.btts !== 50 ? afOdds.btts : poissonBtts };
        }
        return { btts: poissonBtts, ...matchOutcomes(lH, lA) };
      })(),
      fixtureId: match.id, status,
      aggregate: await (async () => {
        // Try football-data.org finished matches first
        const fdAgg = findFirstLegAggregate(
          [...(homeResults?.matches ?? []), ...(awayResults?.matches ?? [])],
          match.homeTeam.id, match.awayTeam.id,
        );
        if (fdAgg) return fdAgg;
        // For knockout rounds, scan ESPN scoreboards for the first leg
        const isKnockout = /quarter|semi|round of|knockout|last 16|last 8|last 4/i.test(stage);
        if (isKnockout && confirmedEspnMeta) {
          const espnAgg = await findEspnFirstLeg(
            confirmedEspnMeta.league, confirmedEspnMeta.homeTeamId, confirmedEspnMeta.awayTeamId, match.utcDate,
          );
          if (espnAgg) log(`[sync] First-leg aggregate from ESPN: ${espnAgg.home}–${espnAgg.away}`);
          return espnAgg;
        }
        return null;
      })(),
    };

    await sbSet(`match:${id}`, matchData, log);
    log(`[sync] saved: ${id} corners=${(matchData.homeTeam as any).stats?.cornersFor}`);

    if (!liveMatches.find((m: any) => m.id === id)) {
      liveMatches.push({
        id, competition: matchData.competition, stage, date: matchData.date, kickoff: matchData.kickoff,
        utcDate: match.utcDate,
        homeTeam: { name: homeName, badge: homeBadge, primaryColor: getTeamColor(homeName) },
        awayTeam: { name: awayName, badge: awayBadge, primaryColor: getTeamColor(awayName) },
      });
      log(`[sync] Added: ${id}`);
    }
    } catch (matchErr: any) {
      log(`[sync] ERROR processing ${id}: ${matchErr.message} — skipping match`);
    }
  }

  log(`[sync] Writing — ${liveMatches.length} live, ${pendingList.length} pending`);
  await sbSet('matches', liveMatches, log);
  await sbSet('upcoming', pendingList, log);
  log(`[sync] Done`);
  return logs;
}

// ── Demo sync: generates real stats for Fulham vs Getafe CF ───────────────
async function runDemoSync() {
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  const MATCH_ID  = 'fulham-vs-getafe-cf';
  const HOME_NAME = 'Fulham';
  const AWAY_NAME = 'Getafe CF';
  const afApiKey  = (process.env.API_SPORTS_KEY ?? '').trim();

  const HOME_LINEUP = {
    lineup: [
      { name: 'Bernd Leno',        position: 'Goalkeeper', posAbbr: 'G',    formationPlace: 1,  espnId: '' },
      { name: 'Kenny Tete',        position: 'Defender',   posAbbr: 'RB',   formationPlace: 2,  espnId: '' },
      { name: 'Joachim Andersen',  position: 'Defender',   posAbbr: 'CD-R', formationPlace: 3,  espnId: '' },
      { name: 'Calvin Bassey',     position: 'Defender',   posAbbr: 'CD-L', formationPlace: 4,  espnId: '' },
      { name: 'Antonee Robinson',  position: 'Defender',   posAbbr: 'LB',   formationPlace: 5,  espnId: '' },
      { name: 'Sander Berge',      position: 'Midfielder', posAbbr: 'DM',   formationPlace: 6,  espnId: '' },
      { name: 'Andreas Pereira',   position: 'Midfielder', posAbbr: 'CM',   formationPlace: 8,  espnId: '' },
      { name: 'Harry Wilson',      position: 'Midfielder', posAbbr: 'RW',   formationPlace: 7,  espnId: '' },
      { name: 'Alex Iwobi',        position: 'Midfielder', posAbbr: 'AM',   formationPlace: 10, espnId: '' },
      { name: 'Emile Smith Rowe',  position: 'Midfielder', posAbbr: 'LW',   formationPlace: 11, espnId: '' },
      { name: 'Raúl Jiménez',      position: 'Forward',    posAbbr: 'ST',   formationPlace: 9,  espnId: '' },
    ],
  };

  const AWAY_LINEUP = {
    lineup: [
      { name: 'David Soria',         position: 'Goalkeeper', posAbbr: 'G',    formationPlace: 1,  espnId: '' },
      { name: 'Damián Suárez',       position: 'Defender',   posAbbr: 'RB',   formationPlace: 2,  espnId: '' },
      { name: 'Johan Alderete',      position: 'Defender',   posAbbr: 'CD-R', formationPlace: 3,  espnId: '' },
      { name: 'Gastón Álvarez',      position: 'Defender',   posAbbr: 'CD-L', formationPlace: 4,  espnId: '' },
      { name: 'Diego Rico',          position: 'Defender',   posAbbr: 'LB',   formationPlace: 5,  espnId: '' },
      { name: 'Carles Aleñá',        position: 'Midfielder', posAbbr: 'RM',   formationPlace: 7,  espnId: '' },
      { name: 'Mauro Arambarri',     position: 'Midfielder', posAbbr: 'DM',   formationPlace: 6,  espnId: '' },
      { name: 'Nemanja Maksimović',  position: 'Midfielder', posAbbr: 'CM',   formationPlace: 8,  espnId: '' },
      { name: 'Mason Greenwood',     position: 'Midfielder', posAbbr: 'LW',   formationPlace: 11, espnId: '' },
      { name: 'Óscar Rodríguez',     position: 'Forward',    posAbbr: 'SS',   formationPlace: 10, espnId: '' },
      { name: 'Borja Mayoral',       position: 'Forward',    posAbbr: 'ST',   formationPlace: 9,  espnId: '' },
    ],
  };

  log(`[demo-sync] Starting ${HOME_NAME} vs ${AWAY_NAME}`);

  // Look up ESPN team IDs in their respective domestic leagues
  const [homeEspnId, awayEspnId] = await Promise.all([
    findEspnTeamId('eng.1', HOME_NAME),
    findEspnTeamId('esp.1', AWAY_NAME),
  ]);
  log(`[demo-sync] ESPN IDs: home=${homeEspnId ?? 'not found'} away=${awayEspnId ?? 'not found'}`);

  // ESPN season stats (corners, shots, etc.) and per-player game history
  let espnHistory = new Map<string, PlayerGameStat[]>();
  let homeSeasonStats: any = null;
  let awaySeasonStats: any = null;
  if (homeEspnId || awayEspnId) {
    const [homeResult, awayResult] = await Promise.all([
      homeEspnId ? fetchTeamPlayerHistory(homeEspnId, 'eng.1', HOME_NAME) : Promise.resolve({ history: new Map<string, PlayerGameStat[]>(), seasonStats: null, debug: 'no id' }),
      awayEspnId ? fetchTeamPlayerHistory(awayEspnId, 'esp.1', AWAY_NAME) : Promise.resolve({ history: new Map<string, PlayerGameStat[]>(), seasonStats: null, debug: 'no id' }),
    ]);
    homeResult.history.forEach((v, k) => espnHistory.set(k, v));
    awayResult.history.forEach((v, k) => espnHistory.set(k, v));
    homeSeasonStats = homeResult.seasonStats;
    awaySeasonStats = awayResult.seasonStats;
    log(`[demo-sync] ESPN: ${espnHistory.size} player records | home corners=${homeResult.seasonStats?.cornersFor ?? 'n/a'} | away corners=${awayResult.seasonStats?.cornersFor ?? 'n/a'}`);
  }

  // ESPN roster stats (total goals, assists, cards per player)
  const [homeRosterMap, awayRosterMap] = await Promise.all([
    homeEspnId ? fetchEspnRosterStats(homeEspnId, 'eng.1') : Promise.resolve(new Map<string, EspnRosterPlayer>()),
    awayEspnId ? fetchEspnRosterStats(awayEspnId, 'esp.1') : Promise.resolve(new Map<string, EspnRosterPlayer>()),
  ]);
  const combinedRosterMap = new Map<string, EspnRosterPlayer>();
  homeRosterMap.forEach((v, k) => combinedRosterMap.set(k, v));
  awayRosterMap.forEach((v, k) => combinedRosterMap.set(k, v));
  log(`[demo-sync] ESPN roster: ${combinedRosterMap.size} players`);

  // API-Football team history + squad stats
  const [homeAfResult, awayAfResult, homeSquadResult, awaySquadResult] = await Promise.all([
    afApiKey ? fetchApiFootballTeamHistory(HOME_NAME, afApiKey) : Promise.resolve({ history: new Map<string, PlayerGameStat[]>(), playerIds: new Map<string, number>(), afTeamId: 0, afTeamStats: null as AfTeamFixtureStats | null, debug: 'no key' }),
    afApiKey ? fetchApiFootballTeamHistory(AWAY_NAME, afApiKey) : Promise.resolve({ history: new Map<string, PlayerGameStat[]>(), playerIds: new Map<string, number>(), afTeamId: 0, afTeamStats: null as AfTeamFixtureStats | null, debug: 'no key' }),
    afApiKey ? fetchApiFootballSquadStats(HOME_NAME, afApiKey) : Promise.resolve({ stats: new Map<string, AfSquadPlayer>(), debug: 'no key' }),
    afApiKey ? fetchApiFootballSquadStats(AWAY_NAME, afApiKey) : Promise.resolve({ stats: new Map<string, AfSquadPlayer>(), debug: 'no key' }),
  ]);
  log(`[demo-sync] AF home: ${homeAfResult.debug} | away: ${awayAfResult.debug}`);
  log(`[demo-sync] AF squad home: ${homeSquadResult.debug} | away: ${awaySquadResult.debug}`);

  // Per-player personal history (true last 5 across all competitions)
  let perPlayerHistoryHome = new Map<string, PlayerGameStat[]>();
  let perPlayerHistoryAway = new Map<string, PlayerGameStat[]>();
  if (afApiKey) {
    const resolveIds = async (starters: any[], afResult: typeof homeAfResult): Promise<Map<number, string>> => {
      const idToName = new Map<number, string>();
      const missing: string[] = [];
      for (const p of starters) {
        const key = normName(p.name);
        const afId = afResult.playerIds.get(key)
          ?? afResult.playerIds.get(key.split(' ').pop() ?? '')
          ?? fuzzyPlayerLookup(key, afResult.playerIds);
        if (afId) { idToName.set(afId, p.name); } else { missing.push(p.name); }
      }
      if (missing.length && afResult.afTeamId) {
        for (const name of missing) {
          const found = await lookupAfPlayerId(name, afResult.afTeamId, afApiKey);
          if (found) idToName.set(found, name);
        }
      }
      return idToName;
    };

    const [homeIdMap, awayIdMap] = await Promise.all([
      resolveIds(HOME_LINEUP.lineup, homeAfResult),
      resolveIds(AWAY_LINEUP.lineup, awayAfResult),
    ]);
    log(`[demo-sync] Player IDs: home ${homeIdMap.size}/${HOME_LINEUP.lineup.length}, away ${awayIdMap.size}/${AWAY_LINEUP.lineup.length}`);

    const homePersonal = await fetchPlayerPersonalHistoryBatch(Array.from(homeIdMap.keys()), afApiKey);
    const awayPersonal = await fetchPlayerPersonalHistoryBatch(Array.from(awayIdMap.keys()), afApiKey);

    for (const [id, games] of Array.from(homePersonal)) {
      const name = homeIdMap.get(id);
      if (name) perPlayerHistoryHome.set(normName(name), games);
    }
    for (const [id, games] of Array.from(awayPersonal)) {
      const name = awayIdMap.get(id);
      if (name) perPlayerHistoryAway.set(normName(name), games);
    }
    log(`[demo-sync] Per-player history: home ${perPlayerHistoryHome.size}, away ${perPlayerHistoryAway.size}`);
  }

  const apiSportsIdx = await getApiSportsIndex();

  // Build team-level stats (no fd.org match history since this is a fake fixture)
  const homeStats = buildTeamStats([], 0, homeSeasonStats ?? null, awaySeasonStats ?? null, homeAfResult.afTeamStats ?? null, awayAfResult.afTeamStats ?? null);
  const awayStats = buildTeamStats([], 0, awaySeasonStats ?? null, homeSeasonStats ?? null, awayAfResult.afTeamStats ?? null, homeAfResult.afTeamStats ?? null);
  log(`[demo-sync] Home stats: goals=${homeStats.goalsFor}/${homeStats.goalsAgainst} corners=${homeStats.cornersFor} shots=${homeStats.shotsFor}`);
  log(`[demo-sync] Away stats: goals=${awayStats.goalsFor}/${awayStats.goalsAgainst} corners=${awayStats.cornersFor} shots=${awayStats.shotsFor}`);

  const players = await buildPlayers(
    HOME_LINEUP, AWAY_LINEUP,
    espnHistory, apiSportsIdx, combinedRosterMap,
    homeAfResult.history, awayAfResult.history,
    homeSquadResult.stats, awaySquadResult.stats,
    perPlayerHistoryHome, perPlayerHistoryAway,
  );

  const HOME_ADV = 1.25;
  const lH = Math.max(0.3, (homeStats.goalsFor + awayStats.goalsAgainst) / 2 * HOME_ADV);
  const lA = Math.max(0.3, (awayStats.goalsFor + homeStats.goalsAgainst) / 2);
  const poissonBtts = Math.round((1 - Math.exp(-lH)) * (1 - Math.exp(-lA)) * 100);

  const result = {
    competition: 'UEFA Conference League',
    stage: 'Round of 16',
    date: '12 March 2026',
    kickoff: '18:45 GMT',
    homeTeam: {
      name: HOME_NAME, primaryColor: '#CC0000',
      badge: homeEspnId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${homeEspnId}.png` : 'https://crests.football-data.org/63.svg',
      stats: homeStats, players: players.home,
    },
    awayTeam: {
      name: AWAY_NAME, primaryColor: '#003DA5',
      badge: awayEspnId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${awayEspnId}.png` : 'https://crests.football-data.org/95.svg',
      stats: awayStats, players: players.away,
    },
    referee: {
      name: 'Glenn Nyberg',
      matchAvg: {
        fouls: +(homeStats.foulsCommitted + awayStats.foulsCommitted).toFixed(1),
        cards:  +(homeStats.cardsFor + awayStats.cardsFor).toFixed(1),
      },
    },
    probabilities: { btts: poissonBtts, ...matchOutcomes(lH, lA) },
    aggregate: null,
  };

  await sbSet(`match:${MATCH_ID}`, result, log);
  log(`[demo-sync] Done — saved match:${MATCH_ID}`);
  return logs;
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const demo = req.nextUrl.searchParams.get('demo');

  // Demo sync is open — only generates the Fulham vs Getafe preview sheet
  if (demo === 'fulham-vs-getafe') {
    try {
      const logs = await runDemoSync();
      return NextResponse.json({ ok: true, logs });
    } catch (e: any) {
      console.error('[demo-sync] Error:', e);
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const logs = await runSync();
    return NextResponse.json({ ok: true, logs });
  } catch (e: any) {
    console.error('[sync] Error:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
