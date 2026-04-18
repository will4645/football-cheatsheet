import { NextRequest, NextResponse } from 'next/server';
import {
  getMatches, setMatches, getUpcoming, setUpcoming,
  getMatch, setMatch, deleteMatch, getStatsCache, setStatsCache,
} from '@/lib/store';
import { getApiFootballLineups, fetchTeamPlayerHistory, PlayerGameStat } from '@/lib/api-football';
import type { TeamSeasonStats } from '@/lib/api-football';

// Direct Supabase client for writes (bypasses store.ts to avoid fs-module caching issues)
function getSb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function sbSet(key: string, value: unknown) {
  const sb = getSb();
  if (!sb) return;
  const now = new Date().toISOString();
  const { data } = await sb.from('match_cache').update({ value, updated_at: now }).eq('key', key).select('key');
  if (!data || data.length === 0) {
    await sb.from('match_cache').insert({ key, value, updated_at: now });
  }
}

async function sbGet(key: string) {
  const sb = getSb();
  if (!sb) return null;
  const { data } = await sb.from('match_cache').select('value').eq('key', key).single();
  return data?.value ?? null;
}

export const maxDuration = 60; // Vercel max for hobby plan

// ── Auth ───────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? req.headers.get('x-sync-token');
  return token === process.env.SYNC_SECRET;
}

// ── Probability helpers ────────────────────────────────────────────────────
function poissonAtLeast(lambda: number, k: number) {
  let cumulative = 0, term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) { cumulative += term; term *= lambda / (i + 1); }
  return Math.max(0, Math.min(1, 1 - cumulative));
}
function toScale(p: number) { return Math.max(20, Math.min(100, Math.round(p * 5) * 20)); }
function overProb(avg: number, threshold: number) { return toScale(poissonAtLeast(avg, threshold + 1)); }

function seededLast5(name: string, stat: string, avgPerGame: number, threshold: number): boolean[] {
  const prob = poissonAtLeast(avgPerGame, threshold);
  const seed = name + stat;
  return Array.from({ length: 5 }, (_, i) => {
    let h = 0;
    for (let j = 0; j < seed.length; j++) h = Math.imul(31, h) + seed.charCodeAt(j) | 0;
    h = Math.imul(h ^ ((i + 1) * 2654435769), 0x9e3779b9) | 0;
    return ((h >>> 0) % 100) / 100 < prob;
  });
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
  if (idx.has(last) && last.length > 4) return idx.get(last);
  const fl = `${parts[0]} ${last}`;
  if (idx.has(fl)) return idx.get(fl);
  if (last.length > 5) { for (const [k, v] of Array.from(idx)) { if (k.includes(last)) return v; } }
  return null;
}

// ── FBref/Understat cache ──────────────────────────────────────────────────
const STATS_TTL = 23 * 60 * 60 * 1000;
const LEAGUES = [
  { id: 'EPL', name: 'Premier League' }, { id: 'La_liga', name: 'La Liga' },
  { id: 'Bundesliga', name: 'Bundesliga' }, { id: 'Serie_A', name: 'Serie A' },
  { id: 'Ligue_1', name: 'Ligue 1' },
];

async function fetchLeague(league: { id: string; name: string }) {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
  const res = await fetch('https://understat.com/main/getPlayersStats/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://understat.com/league/${league.id}`,
    },
    body: `league=${league.id}&season=2025`,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { players } = await res.json();
  return (players as any[]).map(p => {
    const games = parseInt(p.games) || 1;
    const goals = parseFloat(p.goals) || 0;
    const assts = parseFloat(p.assists) || 0;
    const shots = parseFloat(p.shots) || 0;
    return {
      id: p.id,
      name: p.player_name, games,
      avgMins: Math.round((parseInt(p.time) || 0) / games),
      goals, assists: assts, xg: +(parseFloat(p.npxG) || 0).toFixed(2),
      yellowCards: parseInt(p.yellow_cards) || 0,
      redCards: parseInt(p.red_cards) || 0,
      shotsPerGame: +(shots / games).toFixed(2),
      sotPerGame: +(shots / games * 0.37).toFixed(2),
      gaPerGame: +((goals + assts) / games).toFixed(2),
      foulsPerGame: 0, foulsWonPerGame: 0, tacklesPerGame: 0,
    };
  });
}

// ── Per-player match history ───────────────────────────────────────────────
async function fetchPlayerGames(playerId: string): Promise<any[]> {
  try {
    await new Promise(r => setTimeout(r, 300));
    const res = await fetch(`https://understat.com/player/${playerId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://understat.com/',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const m = html.match(/var matchesData\s*=\s*JSON\.parse\('([\s\S]+?)'\)/);
    if (!m) return [];
    const raw = m[1].replace(/\\x([0-9a-fA-F]{2})/g, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)));
    const games: any[] = JSON.parse(raw);
    return games
      .filter(g => g.season === '2025' && parseInt(g.time) > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

// Build a boolean[5] from real game data.
// Index 0 = oldest of last 5, index 4 = most recent (rightmost dot).
function actualLast5(games: any[], stat: 'goals' | 'assists' | 'shots2' | 'shots1'): boolean[] {
  const last5 = games.slice(0, 5).reverse(); // oldest first
  const result: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    const g = last5[i + (last5.length - 5 < 0 ? last5.length - 5 : 0)];
    if (!g || last5.length < 5 - i) { result.push(false); continue; }
    switch (stat) {
      case 'goals':   result.push(parseInt(g.goals)   > 0); break;
      case 'assists': result.push(parseInt(g.assists) > 0); break;
      case 'shots2':  result.push(parseInt(g.shots)  >= 2); break;
      case 'shots1':  result.push(parseInt(g.shots)  >= 1); break;
    }
  }
  return result;
}

function gamesLast5(games: any[], stat: 'goals' | 'assists' | 'shots2' | 'shots1'): boolean[] {
  if (!games.length) return [false, false, false, false, false];
  // games is sorted newest-first; take up to 5
  const slice = games.slice(0, 5); // [newest, ..., oldest]
  const padded: (any | null)[] = [];
  // Pad on the left with nulls so index 4 = most recent
  for (let i = 0; i < 5 - slice.length; i++) padded.push(null);
  padded.push(...[...slice].reverse()); // oldest → most recent
  return padded.map(g => {
    if (!g) return false;
    switch (stat) {
      case 'goals':   return parseInt(g.goals)   > 0;
      case 'assists': return parseInt(g.assists) > 0;
      case 'shots2':  return parseInt(g.shots)  >= 2;
      case 'shots1':  return parseInt(g.shots)  >= 1;
    }
  });
}

async function getStatsIndex(): Promise<Map<string, any>> {
  const cached = await getStatsCache();
  if (cached && Date.now() - cached.scraped < STATS_TTL) {
    return buildNameIndex(cached.players as any[]);
  }
  const all: any[] = [];
  for (const league of LEAGUES) {
    try { all.push(...await fetchLeague(league)); } catch { /* skip */ }
  }
  await setStatsCache({ scraped: Date.now(), players: all });
  return buildNameIndex(all);
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

  // Use ESPN boxscore stats where available, otherwise fall back to league averages
  console.log(`[buildTeamStats] espnStats=${espnStats ? `corners=${espnStats.cornersFor} shots=${espnStats.shotsFor} fouls=${espnStats.foulsCommitted} cards=${espnStats.cardsFor} sot=${espnStats.sotFor} games=${espnStats.gamesCount}` : 'null'}`);
  const e = espnStats;
  const o = oppEspnStats;

  const cornersFor     = e?.cornersFor     ?? 5.0;
  const cornersAgainst = e?.cornersAgainst ?? (o?.cornersFor ?? 5.0);
  const shotsFor       = e?.shotsFor       ?? 13.0;
  const shotsAgainst   = e?.shotsAgainst   ?? (o?.shotsFor   ?? 11.0);
  const sotFor         = e?.sotFor         ?? 4.5;
  const sotAgainst     = e?.sotAgainst     ?? (o?.sotFor     ?? 3.8);
  const foulsCommitted = e?.foulsCommitted ?? 11.0;
  const foulsWon       = e?.foulsWon       ?? (o?.foulsCommitted ?? 11.0);
  const cardsFor       = e?.cardsFor       ?? 1.8;
  const cardsAgainst   = e?.cardsAgainst   ?? (o?.cardsFor   ?? 1.8);

  return {
    goalsFor: +avgFor.toFixed(2), goalsAgainst: +avgAgainst.toFixed(2),
    over25Goals:   overProb(avgFor + avgAgainst, 2.5),
    cornersFor:    +cornersFor.toFixed(2),    cornersAgainst: +cornersAgainst.toFixed(2),
    over95Corners: overProb(cornersFor + cornersAgainst, 9.5),
    shotsFor:      +shotsFor.toFixed(2),      shotsAgainst:   +shotsAgainst.toFixed(2),
    over195Shots:  overProb(shotsFor + shotsAgainst, 19.5),
    sotFor:        +sotFor.toFixed(2),        sotAgainst:     +sotAgainst.toFixed(2),
    over95SoT:     overProb(sotFor + sotAgainst, 9.5),
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
  fbrefIdx: Map<string, any>,
  espnHistory: Map<string, PlayerGameStat[]> = new Map(),
) {
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
      goals: isAtt ? 8 : isMid ? 4 : 1,
      assists: isAtt ? 5 : isMid ? 6 : 2,
      gaPerGame: isAtt ? 0.7 : isMid ? 0.4 : 0.1,
      yellowCards: isDef ? 4 : isMid ? 3 : 2,
      form: 'ok' as const,
    };
    const fb = lookupPlayer(fbrefIdx, name);
    if (fb && fb.games >= 3) {
      return {
        ...defaults,
        understatId: fb.id ?? '',
        mins: fb.avgMins || defaults.mins,
        goals: fb.goals, assists: fb.assists, gaPerGame: fb.gaPerGame,
        shotsPerGame: fb.shotsPerGame || defaults.shotsPerGame,
        sotPerGame: fb.sotPerGame || defaults.sotPerGame,
        foulsPerGame: fb.foulsPerGame || defaults.foulsPerGame,
        foulsWonPerGame: fb.foulsWonPerGame || defaults.foulsWonPerGame,
        tacklesPerGame: fb.tacklesPerGame || defaults.tacklesPerGame,
        yellowCards: fb.yellowCards,
      };
    }
    return defaults;
  }

  // Pre-fetch game histories for all players in both lineups
  const homeStarters = homeLineup.lineup || homeLineup.startingEleven || [];
  const awayStarters = awayLineup.lineup || awayLineup.startingEleven || [];
  const allPlayers = [...homeStarters, ...awayStarters].map(p => playerDefaults(p));
  const uniqueIds = Array.from(new Set(allPlayers.map(p => p.understatId).filter(Boolean)));

  const gamesMap = new Map<string, any[]>();
  await Promise.allSettled(
    uniqueIds.map(async (id, idx) => {
      await new Promise(r => setTimeout(r, idx * 150));
      const games = await fetchPlayerGames(id);
      if (games.length) gamesMap.set(id, games);
    })
  );

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
    const pool = excludeGK ? players.filter(p => !p.isGK) : players;
    return [...pool].sort((a, b) => b[key] - a[key]).slice(0, 5);
  }

  function buildSide(starters: any[], opp: any[]) {
    const players    = starters.map(p => playerDefaults(p));
    const oppPlayers = opp.map(p => playerDefaults(p));

    // Build a boolean[5] from ESPN per-game history (newest game = index 4)
    function espnLast5(espnId: string, field: 'fc' | 'fd' | 'goals' | 'assists' | 'sot' | 'shots', threshold = 1): boolean[] | null {
      const games = espnId ? espnHistory.get(espnId) : undefined;
      if (!games?.length) return null;
      // games[0] = most recent; pad left with false if fewer than 5
      const slice = games.slice(0, 5);
      const result: boolean[] = [];
      for (let i = 0; i < 5 - slice.length; i++) result.push(false);
      for (const g of [...slice].reverse()) result.push((g[field] ?? 0) >= threshold);
      return result;
    }

    function getLast5(p: any, stat: 'goals' | 'assists' | 'shots2' | 'shots1', fallbackAvg: number, fallbackThresh: number): boolean[] {
      const games = p.understatId ? gamesMap.get(p.understatId) : undefined;
      if (games?.length) return gamesLast5(games, stat);
      return seededLast5(p.name, stat, fallbackAvg, fallbackThresh);
    }

    return {
      defensive: top5(players, 'foulsPerGame').map(p => ({
        name: p.name, mins: p.mins, foulsPerGame: +p.foulsPerGame.toFixed(2),
        tacklesPerGame: +p.tacklesPerGame.toFixed(2),
        last5Fouls: espnLast5(p.espnId, 'fc') ?? seededLast5(p.name, 'fouls', p.foulsPerGame, 1),
        yellowCards: p.yellowCards,
        potentialOpponent: findOpponent(p, oppPlayers),
        form: p.form,
      })),
      offensive: top5(players, 'foulsWonPerGame').map(p => ({
        name: p.name, mins: p.mins, foulsWonPerGame: +p.foulsWonPerGame.toFixed(2),
        last5FoulsWon: espnLast5(p.espnId, 'fd') ?? seededLast5(p.name, 'foulsWon', p.foulsWonPerGame, 1),
        potentialOpponent: findOpponent(p, oppPlayers),
        form: p.form,
      })),
      shooting: top5(players, 'sotPerGame').map(p => ({
        name: p.name, mins: p.mins, sotPerGame: +p.sotPerGame.toFixed(2),
        last5SoT:     espnLast5(p.espnId, 'sot',   1) ?? getLast5(p, 'shots1', p.sotPerGame,   1),
        shotsPerGame: +p.shotsPerGame.toFixed(2),
        last5Shots:   espnLast5(p.espnId, 'shots', 2) ?? getLast5(p, 'shots2', p.shotsPerGame, 2),
        badges: [], form: p.form,
      })),
      goalscoring: top5(players, 'gaPerGame').map(p => ({
        name: p.name, mins: p.mins, goals: p.goals, assists: p.assists,
        gaPerGame: +p.gaPerGame.toFixed(2),
        badges: [],
        last5Goals:   espnLast5(p.espnId, 'goals',   1) ?? getLast5(p, 'goals',   p.gaPerGame * (p.goals   / Math.max(p.goals + p.assists, 1)), 1),
        last5Assists: espnLast5(p.espnId, 'assists', 1) ?? getLast5(p, 'assists', p.gaPerGame * (p.assists / Math.max(p.goals + p.assists, 1)), 1),
        form: p.form,
      })),
    };
  }

  const lineupIds = allPlayers.map(p => p.espnId).filter(Boolean);
  const matchedIds = lineupIds.filter(id => espnHistory.has(id));
  // Find a player with non-zero stats to verify data quality
  let nonZeroSample = 'none';
  for (const id of matchedIds) {
    const games = espnHistory.get(id)!;
    const hasNonZero = games.some(g => g.fc > 0 || g.fd > 0 || g.goals > 0 || g.sot > 0);
    if (hasNonZero) {
      const p = allPlayers.find(p => p.espnId === id);
      nonZeroSample = `player:${p?.name ?? id} games:${JSON.stringify(games)}`;
      break;
    }
  }
  const diag = `espnIds in lineup:${lineupIds.length} matched:${matchedIds.length} | nonZero:${nonZeroSample}`;

  return { home: buildSide(homeStarters, awayStarters), away: buildSide(awayStarters, homeStarters), diag };
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
function matchId(home: string, away: string) {
  const slug = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${slug(home)}-vs-${slug(away)}`;
}

// ── Football-data.org fetch ────────────────────────────────────────────────
const BASE_URL = 'https://api.football-data.org/v4';
const COMPETITIONS = ['PL', 'CL', 'FAC', 'EL', 'EC', 'WC', 'CLI'];
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

  log(`[sync] Running — ${new Date().toLocaleTimeString()}`);

  // Test Supabase write directly
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const ts = Date.now();
    await sbSet('__sync_test__', { ts });
    const { data: rData } = await sb.from('match_cache').select('value').order('updated_at', { ascending: false }).eq('key', '__sync_test__').limit(1);
    const readBack = rData?.[0]?.value?.ts;
    log(`[sync] Supabase write test: wrote=${ts} readBack=${readBack} match=${readBack === ts}`);
  } else {
    log(`[sync] Supabase write test: SKIPPED — env vars missing`);
  }

  // Load stats index
  const fbrefIdx = await getStatsIndex();
  log(`[sync] FBref index: ${fbrefIdx.size} name keys`);

  const today = new Date();
  const in7d   = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fmt    = (d: Date) => d.toISOString().slice(0, 10);

  const data = await apiFetch(
    `/matches?competitions=${COMPETITIONS.join(',')}&dateFrom=${fmt(today)}&dateTo=${fmt(in7d)}`
  );
  if (!data?.matches) { log('[sync] No matches returned'); return logs; }

  log(`[sync] Found ${data.matches.length} matches`);

  const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'HALF_TIME', 'EXTRA_TIME', 'PENALTY']);

  const liveMatches: any[] = (await sbGet('matches') as any[]) ?? [];
  const pendingList: any[] = [];

  for (const match of data.matches) {
    const id     = matchId(match.homeTeam?.name, match.awayTeam?.name);
    const status = match.status;

    if (FINISHED_STATUSES.has(status)) {
      const sb = getSb(); if (sb) await sb.from('match_cache').delete().eq('key', `match:${id}`);
      const updated = liveMatches.filter((m: any) => m.id !== id);
      liveMatches.splice(0, liveMatches.length, ...updated);
      continue;
    }

    const kickoff   = new Date(match.utcDate);
    const hoursAway = (kickoff.getTime() - Date.now()) / 3_600_000;
    const isLive    = LIVE_STATUSES.has(status);

    // Add future matches (>24h) to upcoming list only
    if (hoursAway > 24 && !isLive) {
      if (!pendingList.find((m: any) => m.id === id) && !liveMatches.find((m: any) => m.id === id)) {
        const homeName = match.homeTeam?.name;
        const awayName = match.awayTeam?.name;
        pendingList.push({
          id, competition: match.competition?.name || 'Football',
          stage: match.stage ? match.stage.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : match.matchday ? `Matchday ${match.matchday}` : 'Match',
          date: formatDate(match.utcDate), kickoff: formatKickoff(match.utcDate),
          homeTeam: { name: homeName, badge: `https://crests.football-data.org/${match.homeTeam.id}.svg`, primaryColor: getTeamColor(homeName) },
          awayTeam: { name: awayName, badge: `https://crests.football-data.org/${match.awayTeam.id}.svg`, primaryColor: getTeamColor(awayName) },
        });
      }
      continue;
    }

    let lineupData = await apiFetch(`/matches/${match.id}/lineups`, 2 * 60 * 1000);
    let hasLineups = lineupData?.homeTeam?.lineup?.length > 0 || lineupData?.homeTeam?.startingEleven?.length > 0;

    const homeName = match.homeTeam?.name;
    const awayName = match.awayTeam?.name;
    const homeBadge = `https://crests.football-data.org/${match.homeTeam.id}.svg`;
    const awayBadge = `https://crests.football-data.org/${match.awayTeam.id}.svg`;
    const stage = match.stage
      ? match.stage.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      : match.matchday ? `Matchday ${match.matchday}` : 'Match';

    // Fallback to API-Football if football-data.org hasn't published lineups yet
    let espnHistory: Map<string, PlayerGameStat[]> = new Map();
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
          log(`[sync] Fetching ESPN history — league:${espnMeta.league} home:${espnMeta.homeTeamId} away:${espnMeta.awayTeamId}`);
          const [homeResult, awayResult] = await Promise.all([
            fetchTeamPlayerHistory(espnMeta.homeTeamId, espnMeta.league),
            fetchTeamPlayerHistory(espnMeta.awayTeamId, espnMeta.league),
          ]);
          homeResult.history.forEach((v, k) => espnHistory.set(k, v));
          awayResult.history.forEach((v, k) => espnHistory.set(k, v));
          log(`[sync] ESPN history loaded: ${espnHistory.size} player records`);
          if (homeResult.seasonStats) log(`[espn-stats-home] corners=${homeResult.seasonStats.cornersFor} shots=${homeResult.seasonStats.shotsFor} fouls=${homeResult.seasonStats.foulsCommitted}`);
          if (awayResult.seasonStats) log(`[espn-stats-away] corners=${awayResult.seasonStats.cornersFor} shots=${awayResult.seasonStats.shotsFor} fouls=${awayResult.seasonStats.foulsCommitted}`);
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
      if (!liveMatches.find((m: any) => m.id === id)) {
        pendingList.push({
          id, competition: match.competition?.name || 'Football', stage,
          date: formatDate(match.utcDate), kickoff: formatKickoff(match.utcDate),
          homeTeam: { name: homeName, badge: homeBadge, primaryColor: getTeamColor(homeName) },
          awayTeam: { name: awayName, badge: awayBadge, primaryColor: getTeamColor(awayName) },
        });
      }
      continue;
    }

    log(`[sync] Generating${isLive ? ' (live)' : ''}: ${homeName} vs ${awayName}`);

    const [homeResults, awayResults] = await Promise.all([
      apiFetch(`/teams/${match.homeTeam.id}/matches?status=FINISHED&limit=10`, 60 * 60 * 1000),
      apiFetch(`/teams/${match.awayTeam.id}/matches?status=FINISHED&limit=10`, 60 * 60 * 1000),
    ]);

    log(`[pre-buildStats] homeStats=${JSON.stringify((espnHistory as any).__homeStats)?.slice(0,80)}`);
    const homeStats = buildTeamStats(homeResults?.matches, match.homeTeam.id, (espnHistory as any).__homeStats ?? null, (espnHistory as any).__awayStats ?? null);
    const awayStats = buildTeamStats(awayResults?.matches, match.awayTeam.id, (espnHistory as any).__awayStats ?? null, (espnHistory as any).__homeStats ?? null);
    log(`[team-stats-home] corners=${homeStats.cornersFor} shots=${homeStats.shotsFor} fouls=${homeStats.foulsCommitted} cards=${homeStats.cardsFor}`);
    log(`[team-stats-away] corners=${awayStats.cornersFor} shots=${awayStats.shotsFor} fouls=${awayStats.foulsCommitted} cards=${awayStats.cardsFor}`);
    const players   = await buildPlayers(lineupData.homeTeam, lineupData.awayTeam, fbrefIdx, espnHistory);
    log(`[players-diag] ${players.diag}`);

    const matchData = {
      competition: match.competition?.name || 'Football', stage,
      date: formatDate(match.utcDate), kickoff: formatKickoff(match.utcDate),
      homeTeam: { name: homeName, primaryColor: getTeamColor(homeName), badge: homeBadge, stats: homeStats, players: players.home },
      awayTeam: { name: awayName, primaryColor: getTeamColor(awayName), badge: awayBadge, stats: awayStats, players: players.away },
      referee: {
        name: match.referees?.[0]?.name || 'TBC',
        currentSeason: { yellows: 3.0, reds: 0.2, foulsPg: 22.0 },
        career:        { yellows: 3.1, reds: 0.2, foulsPg: 23.0 },
      },
      probabilities: {
        btts: overProb((homeStats.goalsFor + awayStats.goalsFor) / 2, 0),
        homeWin: 40, draw: 25, awayWin: 35,
      },
      fixtureId: match.id, status,
    };

    await sbSet(`match:${id}`, matchData);
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

  await sbSet('matches', liveMatches);
  await sbSet('upcoming', pendingList);
  log(`[sync] Done — ${liveMatches.length} live, ${pendingList.length} pending`);
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
