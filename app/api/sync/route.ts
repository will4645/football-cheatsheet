import { NextRequest, NextResponse } from 'next/server';
import { getApiFootballLineups, fetchTeamPlayerHistory, findEspnFirstLeg, fetchEspnRosterStats, fetchApiFootballTeamHistory, fetchApiFootballSquadStats, guessDomesticLeague, PlayerGameStat } from '@/lib/api-football';
import type { TeamSeasonStats, EspnRosterPlayer, AfSquadPlayer } from '@/lib/api-football';
import { fetchApiSportsIndex, buildApiSportsNameIndex, lookupApiSports } from '@/lib/api-sports';
import type { ApiSportsPlayer } from '@/lib/api-sports';

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

// Poisson match outcome model: expected goals based on attack vs opponent defence
function matchOutcomes(homeGoalsFor: number, homeGoalsAgainst: number, awayGoalsFor: number, awayGoalsAgainst: number) {
  const lH = Math.max(0.3, (homeGoalsFor + awayGoalsAgainst) / 2);
  const lA = Math.max(0.3, (awayGoalsFor + homeGoalsAgainst) / 2);
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

function seededLast5(name: string, stat: string, avgPerGame: number, threshold: number): boolean[] {
  const prob = poissonAtLeast(avgPerGame, threshold);
  const seed = name + stat;
  const result = Array.from({ length: 5 }, (_, i) => {
    let h = 0;
    for (let j = 0; j < seed.length; j++) h = Math.imul(31, h) + seed.charCodeAt(j) | 0;
    h = Math.imul(h ^ ((i + 1) * 2654435769), 0x9e3779b9) | 0;
    return ((h >>> 0) % 100) / 100 < prob;
  });
  // Guarantee a floor of hits so regular performers aren't falsely shown all-red.
  // Math.floor(prob*5): 20%→1, 35%→1, 50%→2, 70%→3. Below 20% no floor (correct for low-scorers).
  const minHits = Math.floor(prob * 5);
  if (minHits > 0 && result.filter(Boolean).length < minHits) {
    // Force rightmost (most-recent) dots green first
    let forced = 0;
    for (let i = 4; i >= 0 && forced < minHits; i--) {
      if (!result[i]) { result[i] = true; forced++; }
    }
  }
  return result;
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
  'ac milan': '#FB090B', 'milan': '#FB090B',
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
  const avgFor     = count > 0 ? goalsFor / count     : (espnStats?.goalsFor     ?? 1.5);
  const avgAgainst = count > 0 ? goalsAgainst / count : (espnStats?.goalsAgainst ?? 1.2);

  const e = espnStats;
  const o = oppEspnStats;

  // Use || (not ??) so ESPN-returned 0 (field lookup failure) falls through to default.
  // Corners/shots/fouls can never genuinely be 0 over a season of football.
  const cornersFor     = e?.cornersFor     || o?.cornersAgainst || 5.0;
  const cornersAgainst = e?.cornersAgainst || o?.cornersFor     || 5.0;
  const shotsFor       = e?.shotsFor       || o?.shotsAgainst   || 13.0;
  const shotsAgainst   = e?.shotsAgainst   || o?.shotsFor       || 11.0;
  const sotFor         = e?.sotFor         || o?.sotAgainst     || 4.5;
  const sotAgainst     = e?.sotAgainst     || o?.sotFor         || 3.8;
  const foulsCommitted = e?.foulsCommitted || o?.foulsWon       || 11.0;
  const foulsWon       = e?.foulsWon       || o?.foulsCommitted || 11.0;
  const cardsFor       = e?.cardsFor       || o?.cardsAgainst   || 1.8;
  const cardsAgainst   = e?.cardsAgainst   || o?.cardsFor       || 1.8;

  return {
    goalsFor: +avgFor.toFixed(2), goalsAgainst: +avgAgainst.toFixed(2),
    over25Goals:   overProb(avgFor + avgAgainst, 2.5),
    cornersFor:    +cornersFor.toFixed(2),    cornersAgainst: +cornersAgainst.toFixed(2),
    over95Corners: overProb(cornersFor + cornersAgainst, 9.5),
    shotsFor:      +shotsFor.toFixed(2),      shotsAgainst:   +shotsAgainst.toFixed(2),
    over195Shots:  overProb(shotsFor + shotsAgainst, 19.5),
    sotFor:        +sotFor.toFixed(2),        sotAgainst:     +sotAgainst.toFixed(2),
    over95SoT:     overProb(sotFor + sotAgainst, 6.5),
    foulsCommitted: +foulsCommitted.toFixed(2), foulsWon:      +foulsWon.toFixed(2),
    over155Fouls:  overProb(foulsCommitted + foulsWon, 15.5),
    cardsFor:      +cardsFor.toFixed(2),      cardsAgainst:   +cardsAgainst.toFixed(2),
    over45Cards:   overProb(cardsFor + cardsAgainst, 4.5),
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
) {
  function normName(n: string) {
    return (n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function lookupRoster(name: string): EspnRosterPlayer | null {
    const n = normName(name);
    if (espnRosterMap.has(n)) return espnRosterMap.get(n)!;
    const parts = n.split(' ');
    const last = parts[parts.length - 1];
    if (last.length >= 3) {
      for (const [k, v] of Array.from(espnRosterMap)) {
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
    // API-Sports global index — fallback when squad stats don't cover this player
    const as = lookupApiSports(apiSportsIdx, name);
    const roster = lookupRoster(name);
    if (as && as.games >= 3) {
      const goals       = roster ? roster.goals       : as.goals;
      const assists     = roster ? roster.assists      : as.assists;
      const appearances = roster ? roster.appearances  : as.games;
      const yellowCards = roster ? roster.yellowCards  : as.yellowCards;
      const redCards    = roster ? roster.redCards     : as.redCards;
      const gaPerGame   = appearances > 0 ? +((goals + assists) / appearances).toFixed(2) : defaults.gaPerGame;
      return {
        ...defaults,
        mins:            as.minsPerGame     || defaults.mins,
        goals, assists, gaPerGame,
        shotsPerGame:    as.shotsPerGame    || defaults.shotsPerGame,
        sotPerGame:      as.sotPerGame      || defaults.sotPerGame,
        foulsPerGame:    as.foulsPerGame    || defaults.foulsPerGame,
        foulsWonPerGame: as.foulsWonPerGame || defaults.foulsWonPerGame,
        yellowCards, redCards, appearances,
        pkGoals:         as.pkGoals,
        hasRealData:     true,
      };
    }

    // Position defaults (last resort)
    return { ...defaults, hasRealData: false };
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

  function top5(players: any[], key: string, excludeGK = true) {
    const pool = (excludeGK ? players.filter(p => !p.isGK) : players).filter(p => p.hasRealData !== false);
    // Sort by stat but prioritise players with >= 5 games to avoid small-sample flukes topping the list
    return [...pool].sort((a, b) => {
      const aGames = a.mins > 0 ? 1 : 0; // proxy: non-zero mins means real data
      const bGames = b.mins > 0 ? 1 : 0;
      const aTotalGA = (a.goals ?? 0) + (a.assists ?? 0);
      const bTotalGA = (b.goals ?? 0) + (b.assists ?? 0);
      if (key === 'gaPerGame') {
        // Penalise players with very few total G+A (likely small sample)
        const aScore = aTotalGA < 3 ? a[key] * 0.5 : a[key];
        const bScore = bTotalGA < 3 ? b[key] * 0.5 : b[key];
        return bScore - aScore;
      }
      return b[key] - a[key];
    }).slice(0, 5);
  }

  function buildSide(starters: any[], opp: any[], afHistory: Map<string, PlayerGameStat[]>, afSquad: Map<string, AfSquadPlayer>) {
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
      return null;
    }

    // Apply squad stats (paid API, team-specific) as primary source, overriding global index
    function applySquad(base: any): any {
      const sq = lookupSquad(base.name);
      if (!sq || sq.games < 3) return base;
      const roster = lookupRoster(base.name);
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

    // ── API-Football real last-5 helpers (highest priority) ────────────────
    function lookupAF(name: string): PlayerGameStat[] | null {
      const key = normName(name);
      if (afHistory.has(key)) return afHistory.get(key)!;
      const parts = key.split(' ');
      const last = parts[parts.length - 1];
      if (last.length >= 3) {
        for (const [k, v] of Array.from(afHistory)) {
          if (k.includes(last) || k.endsWith(last)) return v;
        }
      }
      return null;
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
      if (!games || games.length < 3) return null;
      return espnLast5(espnId, field, threshold);
    }

    // Season average for the displayed number — ESPN history (min 3g) or API-Sports default.
    // AF last-5 is intentionally excluded here: it covers only 5 games across ALL competitions,
    // so one intense CL game can double a defender's fouls average. Use AF only for dots.
    function bestRate(_name: string, espnId: string, _afField: keyof PlayerGameStat, fallback: number): number {
      return espnOrSafe(espnId, _afField, fallback);
    }

    const defPlayers = [...players].filter(p => !p.isGK && p.hasRealData !== false).sort((a, b) =>
      bestRate(b.name, b.espnId, 'fc', b.foulsPerGame) - bestRate(a.name, a.espnId, 'fc', a.foulsPerGame)
    ).slice(0, 5);

    const offPlayers = [...players].filter(p => !p.isGK && p.hasRealData !== false).sort((a, b) =>
      bestRate(b.name, b.espnId, 'fd', b.foulsWonPerGame) - bestRate(a.name, a.espnId, 'fd', a.foulsWonPerGame)
    ).slice(0, 5);

    return {
      defensive: defPlayers.map(p => {
        const fc = bestRate(p.name, p.espnId, 'fc', p.foulsPerGame);
        return {
          name: p.name, mins: p.mins, foulsPerGame: +fc.toFixed(2),
          tacklesPerGame: +p.tacklesPerGame.toFixed(2),
          last5Fouls: afLast5(p.name, 'fc', 1) ?? espnLast5Safe(p.espnId, 'fc') ?? seededLast5(p.name, 'fouls', fc, 1),
          yellowCards: p.yellowCards,
          potentialOpponent: findOpponent(p, oppPlayers),
          form: p.form,
        };
      }),
      offensive: offPlayers.map(p => {
        const fd = bestRate(p.name, p.espnId, 'fd', p.foulsWonPerGame);
        return {
          name: p.name, mins: p.mins, foulsWonPerGame: +fd.toFixed(2),
          last5FoulsWon: afLast5(p.name, 'fd', 1) ?? espnLast5Safe(p.espnId, 'fd') ?? seededLast5(p.name, 'foulsWon', fd, 1),
          potentialOpponent: findOpponent(p, oppPlayers),
          form: p.form,
        };
      }),
      shooting: top5(players, 'sotPerGame').map(p => {
        const sot = bestRate(p.name, p.espnId, 'sot', p.sotPerGame);
        const sh  = bestRate(p.name, p.espnId, 'shots', p.shotsPerGame);
        return {
          name: p.name, mins: p.mins, sotPerGame: +sot.toFixed(2),
          last5SoT:   afLast5(p.name, 'sot', 1) ?? espnLast5Safe(p.espnId, 'sot', 1) ?? seededLast5(p.name, 'sot', sot, 1),
          shotsPerGame: +sh.toFixed(2),
          last5Shots: afLast5(p.name, 'shots', 2) ?? espnLast5Safe(p.espnId, 'shots', 2) ?? seededLast5(p.name, 'shots', sh, 2),
          form: p.form,
        };
      }),
      goalscoring: top5(players, 'gaPerGame').map(p => {
        const goalRate   = p.gaPerGame * (p.goals   / Math.max(p.goals + p.assists, 1));
        const assistRate = p.gaPerGame * (p.assists / Math.max(p.goals + p.assists, 1));
        return {
          name: p.name, mins: p.mins, goals: p.goals, assists: p.assists,
          gaPerGame: +p.gaPerGame.toFixed(2),
          last5Goals:   afLast5(p.name, 'goals', 1) ?? espnLast5Safe(p.espnId, 'goals', 1) ?? seededLast5(p.name, 'goals',   goalRate,   1),
          last5Assists: afLast5(p.name, 'assists', 1) ?? espnLast5Safe(p.espnId, 'assists', 1) ?? seededLast5(p.name, 'assists', assistRate, 1),
          form: p.form,
        };
      }),
      cards: [...players]
        .filter(p => !p.isGK && p.hasRealData !== false)
        .sort((a, b) => {
          const aRate = a.yellowCards / Math.max(1, a.appearances ?? 20);
          const bRate = b.yellowCards / Math.max(1, b.appearances ?? 20);
          return bRate - aRate;
        })
        .slice(0, 5)
        .map(p => {
          const apps = p.appearances ?? 20;
          const cpg = +(p.yellowCards / Math.max(1, apps)).toFixed(2);
          return {
            name: p.name, appearances: apps,
            yellowCards: p.yellowCards,
            redCards: p.redCards ?? 0,
            cardsPerGame: cpg,
            last5Cards: afLast5(p.name, 'yellowCards', 1) ?? seededLast5(p.name, 'cards', cpg, 1),
          };
        }),
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

  return { home: buildSide(homeStarters, awayStarters, afHistoryHome, afSquadHome), away: buildSide(awayStarters, homeStarters, afHistoryAway, afSquadAway), diag: diag + ' | ' + afDiag };
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

// ── Football-data.org fetch ────────────────────────────────────────────────
const BASE_URL = 'https://api.football-data.org/v4';
const COMPETITIONS = ['PL', 'CL', 'EL', 'ECL', 'PD', 'BL1', 'SA', 'FL1'];
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
  const in30d  = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fmt    = (d: Date) => d.toISOString().slice(0, 10);

  const data = await apiFetch(
    `/matches?competitions=${COMPETITIONS.join(',')}&dateFrom=${fmt(twoDaysAgo)}&dateTo=${fmt(in30d)}`
  );
  if (!data?.matches) { log('[sync] No matches returned'); return logs; }

  log(`[sync] Found ${data.matches.length} matches`);

  const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'HALF_TIME', 'EXTRA_TIME', 'PENALTY']);

  const liveMatches: any[] = (await sbGet('matches') as any[]) ?? [];
  const pendingList: any[] = [];
  const nearTermMatches: any[] = [];

  const apiMatchIds = new Set(
    data.matches
      .filter((m: any) => m.homeTeam?.name && m.awayTeam?.name)
      .map((m: any) => matchId(m.homeTeam.name, m.awayTeam.name))
  );
  const stale = liveMatches.filter((m: any) => !apiMatchIds.has(m.id));
  for (const m of stale) {
    const sb = getSb(); if (sb) await sb.from('match_cache').delete().eq('key', `match:${m.id}`);
    liveMatches.splice(liveMatches.findIndex((x: any) => x.id === m.id), 1);
    log(`[sync] Removed stale: ${m.id}`);
  }

  // Phase 1: fast pass — classify matches without any API calls
  for (const match of data.matches) {
    // Skip matches with null team names (fd.org tier restriction — ESPN will cover these)
    if (!match.homeTeam?.name || !match.awayTeam?.name) continue;
    const id     = matchId(match.homeTeam.name, match.awayTeam.name);
    const status = match.status;
    const kickoff   = new Date(match.utcDate);
    const hoursAway = (kickoff.getTime() - Date.now()) / 3_600_000;

    // Skip and clean up matches that are finished & old, or simply too old
    const tooOld = !(hoursAway > -3);
    const oldFinished = FINISHED_STATUSES.has(status) && !(hoursAway > -3);
    if (tooOld || oldFinished) {
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

  // ── ESPN supplement for CL / EL / ECL (fd.org free tier omits these) ──────
  const ESPN_COMP_LEAGUES = [
    { league: 'uefa.champions',   compName: 'UEFA Champions League' },
    { league: 'uefa.europa',      compName: 'UEFA Europa League' },
    { league: 'uefa.europa.conf', compName: 'UEFA Europa Conference League' },
  ];
  const seenIds = new Set([
    ...pendingList.map((m: any) => m.id),
    ...nearTermMatches.map((m: any) => matchId(m.homeTeam?.name, m.awayTeam?.name)),
    ...liveMatches.map((m: any) => m.id),
  ]);
  let espnAdded = 0;
  const seenNormIds = new Set<string>([
    ...pendingList.map((m: any) => normMatchId(m.homeTeam?.name, m.awayTeam?.name)),
    ...nearTermMatches.map((m: any) => normMatchId(m.homeTeam?.name, m.awayTeam?.name)),
    ...liveMatches.map((m: any) => normMatchId(m.homeTeam?.name, m.awayTeam?.name)),
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
        if (comp?.status?.type?.completed) continue;
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
        const koTime = new Date(ev.date).getTime();
        const hoursAway = (koTime - Date.now()) / 3_600_000;
        if (hoursAway < -2) continue;
        const notes: any[] = comp?.notes ?? [];
        const stage = notes[0]?.headline || (comp?.type?.abbreviation ? `${comp.type.abbreviation}` : 'Match');
        const homeEspnId = homeComp.team.id;
        const awayEspnId = awayComp.team.id;
        const homeBadge = `https://a.espncdn.com/i/teamlogos/soccer/500/${homeEspnId}.png`;
        const awayBadge = `https://a.espncdn.com/i/teamlogos/soccer/500/${awayEspnId}.png`;
        espnAdded++;
        if (hoursAway > 24) {
          pendingList.push({
            id, competition: compName, stage, utcDate: ev.date,
            date: formatDate(ev.date), kickoff: formatKickoff(ev.date),
            homeTeam: { name: homeName, badge: homeBadge, primaryColor: getTeamColor(homeName) },
            awayTeam: { name: awayName, badge: awayBadge, primaryColor: getTeamColor(awayName) },
          });
        } else {
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

  // Write upcoming now — far-future matches are ready; near-term will be added below
  await sbSet('upcoming', pendingList, log);

  // Phase 2: slow pass — lineup checks for near-term matches
  for (const match of nearTermMatches) {
    const id     = matchId(match.homeTeam?.name, match.awayTeam?.name);
    const status = match.status;
    const kickoff   = new Date(match.utcDate);
    const hoursAway = (kickoff.getTime() - Date.now()) / 3_600_000;
    const isLive = LIVE_STATUSES.has(status);

    const fromEspn = !!(match as any)._fromEspn;
    let lineupData = fromEspn ? null : await apiFetch(`/matches/${match.id}/lineups`, 2 * 60 * 1000);
    let hasLineups = lineupData?.homeTeam?.lineup?.length > 0 || lineupData?.homeTeam?.startingEleven?.length > 0;

    const homeName = match.homeTeam?.name;
    const awayName = match.awayTeam?.name;
    const homeBadge = (match as any)._homeBadge ?? teamBadge(match.homeTeam.id);
    const awayBadge = (match as any)._awayBadge ?? teamBadge(match.awayTeam.id);
    const stage = match.stage
      ? match.stage.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      : match.matchday ? `Matchday ${match.matchday}` : 'Match';

    // Fallback to API-Football if football-data.org hasn't published lineups yet
    let espnHistory: Map<string, PlayerGameStat[]> = new Map();
    let confirmedEspnMeta: { league: string; homeTeamId: string; awayTeamId: string } | null = null;
    if (!hasLineups) {
      log(`[sync] Trying API-Football: ${homeName} vs ${awayName}`);
      const { lineups: afLineups, debug: afDebug, espnMeta } = await getApiFootballLineups(homeName, awayName, match.utcDate);
      if (afDebug) log(`[api-football] ${afDebug}`);
      if (afLineups) {
        lineupData = afLineups;
        hasLineups = true;
        log(`[sync] API-Football lineups found for ${homeName} vs ${awayName}`);
        // Fetch per-player foul/shot history from ESPN for both teams
        if (espnMeta?.league && espnMeta.homeTeamId && espnMeta.awayTeamId) {
          confirmedEspnMeta = espnMeta;
          log(`[sync] Fetching ESPN history — league:${espnMeta.league} home:${espnMeta.homeTeamId} away:${espnMeta.awayTeamId}`);
          const [homeResult, awayResult] = await Promise.all([
            fetchTeamPlayerHistory(espnMeta.homeTeamId, espnMeta.league, homeName),
            fetchTeamPlayerHistory(espnMeta.awayTeamId, espnMeta.league, awayName),
          ]);
          homeResult.history.forEach((v, k) => espnHistory.set(k, v));
          awayResult.history.forEach((v, k) => espnHistory.set(k, v));
          log(`[sync] ESPN: ${espnHistory.size} player records | home corners=${homeResult.seasonStats?.cornersFor ?? 'n/a'} shots=${homeResult.seasonStats?.shotsFor ?? 'n/a'} | away corners=${awayResult.seasonStats?.cornersFor ?? 'n/a'} shots=${awayResult.seasonStats?.shotsFor ?? 'n/a'} | debug: ${homeResult.debug}`);
          // Store ESPN season stats on espnHistory object for use in buildTeamStats
          (espnHistory as any).__homeStats = homeResult.seasonStats;
          (espnHistory as any).__awayStats = awayResult.seasonStats;
        } else {
          log(`[sync] No ESPN meta — espnMeta=${JSON.stringify(espnMeta)}`);
        }
      }
    }

    if (!hasLineups) {
      log(`[sync] No lineups yet: ${homeName} vs ${awayName}`);
      if (hoursAway > -3 && !liveMatches.find((m: any) => m.id === id)) {
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

    const [homeResults, awayResults] = fromEspn
      ? [null, null]
      : await Promise.all([
          apiFetch(`/teams/${match.homeTeam.id}/matches?status=FINISHED&limit=10`, 60 * 60 * 1000),
          apiFetch(`/teams/${match.awayTeam.id}/matches?status=FINISHED&limit=10`, 60 * 60 * 1000),
        ]);

    const homeStats = buildTeamStats(homeResults?.matches, match.homeTeam.id, (espnHistory as any).__homeStats ?? null, (espnHistory as any).__awayStats ?? null);
    const awayStats = buildTeamStats(awayResults?.matches, match.awayTeam.id, (espnHistory as any).__awayStats ?? null, (espnHistory as any).__homeStats ?? null);
    log(`[stats] ${homeName}: corners=${homeStats.cornersFor} shots=${homeStats.shotsFor} fouls=${homeStats.foulsCommitted}`);
    log(`[stats] ${awayName}: corners=${awayStats.cornersFor} shots=${awayStats.shotsFor} fouls=${awayStats.foulsCommitted}`);
    // Fetch ESPN domestic roster stats for accurate season counting stats
    const [homeRosterMap, awayRosterMap] = await Promise.all([
      confirmedEspnMeta ? fetchEspnRosterStats(confirmedEspnMeta.homeTeamId, guessDomesticLeague(homeName) || confirmedEspnMeta.league) : Promise.resolve(new Map<string, EspnRosterPlayer>()),
      confirmedEspnMeta ? fetchEspnRosterStats(confirmedEspnMeta.awayTeamId, guessDomesticLeague(awayName) || confirmedEspnMeta.league) : Promise.resolve(new Map<string, EspnRosterPlayer>()),
    ]);
    const combinedRosterMap = new Map<string, EspnRosterPlayer>();
    homeRosterMap.forEach((v, k) => combinedRosterMap.set(k, v));
    awayRosterMap.forEach((v, k) => combinedRosterMap.set(k, v));
    log(`[roster] ESPN domestic stats: ${combinedRosterMap.size} players`);

    // Fetch real last-8-game dots + season squad stats from paid API-Football
    const afApiKey = (process.env.API_SPORTS_KEY ?? '').trim();
    const [homeAfResult, awayAfResult, homeSquadResult, awaySquadResult] = await Promise.all([
      afApiKey ? fetchApiFootballTeamHistory(homeName, afApiKey) : Promise.resolve({ history: new Map<string, PlayerGameStat[]>(), debug: 'no key' }),
      afApiKey ? fetchApiFootballTeamHistory(awayName, afApiKey) : Promise.resolve({ history: new Map<string, PlayerGameStat[]>(), debug: 'no key' }),
      afApiKey ? fetchApiFootballSquadStats(homeName, afApiKey) : Promise.resolve({ stats: new Map<string, AfSquadPlayer>(), debug: 'no key' }),
      afApiKey ? fetchApiFootballSquadStats(awayName, afApiKey) : Promise.resolve({ stats: new Map<string, AfSquadPlayer>(), debug: 'no key' }),
    ]);
    log(`[af-history] home: ${homeAfResult.debug}`);
    log(`[af-history] away: ${awayAfResult.debug}`);
    log(`[af-squad] home: ${homeSquadResult.debug}`);
    log(`[af-squad] away: ${awaySquadResult.debug}`);

    const players = await buildPlayers(lineupData.homeTeam, lineupData.awayTeam, espnHistory, apiSportsIdx, combinedRosterMap, homeAfResult.history, awayAfResult.history, homeSquadResult.stats, awaySquadResult.stats);
    log(`[buildPlayers] ${players.diag}`);

    const matchData = {
      competition: (typeof match.competition === 'string' ? match.competition : match.competition?.name) || 'Football', stage,
      date: formatDate(match.utcDate), kickoff: formatKickoff(match.utcDate),
      homeTeam: { name: homeName, primaryColor: getTeamColor(homeName), badge: homeBadge, stats: homeStats, players: players.home },
      awayTeam: { name: awayName, primaryColor: getTeamColor(awayName), badge: awayBadge, stats: awayStats, players: players.away },
      referee: {
        name: match.referees?.[0]?.name || 'TBC',
        matchAvg: {
          fouls: +(homeStats.foulsCommitted + awayStats.foulsCommitted).toFixed(1),
          cards:  +(homeStats.cardsFor      + awayStats.cardsFor).toFixed(1),
        },
      },
      probabilities: (() => {
        const lH = Math.max(0.3, (homeStats.goalsFor + awayStats.goalsAgainst) / 2);
        const lA = Math.max(0.3, (awayStats.goalsFor + homeStats.goalsAgainst) / 2);
        const btts = Math.round((1 - Math.exp(-lH)) * (1 - Math.exp(-lA)) * 100);
        return { btts, ...matchOutcomes(homeStats.goalsFor, homeStats.goalsAgainst, awayStats.goalsFor, awayStats.goalsAgainst) };
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
        homeTeam: { name: homeName, badge: homeBadge, primaryColor: getTeamColor(homeName) },
        awayTeam: { name: awayName, badge: awayBadge, primaryColor: getTeamColor(awayName) },
      });
      log(`[sync] Added: ${id}`);
    }
  }

  log(`[sync] Writing — ${liveMatches.length} live, ${pendingList.length} pending`);
  await sbSet('matches', liveMatches, log);
  await sbSet('upcoming', pendingList, log);
  log(`[sync] Done`);
  return logs;
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
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
