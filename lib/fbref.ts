/**
 * lib/fbref.ts
 * Scrapes FBref for player season stats covering Big 5 leagues + Champions League.
 * Provides fouls committed/drawn, tackles, shots, goals, assists, cards, minutes.
 * Rate limited to 3.5s per request to avoid FBref bans.
 */

const RATE_MS = 4000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export interface FBrefPlayer {
  name: string;
  games: number;
  minsPerGame: number;
  goals: number;
  assists: number;
  shotsPerGame: number;
  sotPerGame: number;
  yellowCards: number;
  redCards: number;
  foulsPerGame: number;
  foulsWonPerGame: number;
  pkGoals: number;
}

function norm(raw: string): string {
  return (raw || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fbFetch(url: string): Promise<string | null> {
  try {
    await new Promise(r => setTimeout(r, RATE_MS));
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const text = await res.text();
    // FBref returns a Cloudflare challenge page when blocked — detect and reject
    if (text.includes('cf-browser-verification') || text.includes('Enable JavaScript and cookies')) return null;
    return text;
  } catch { return null; }
}

function getCell(row: string, stat: string): string {
  const re = new RegExp(`data-stat="${stat}"[^>]*>(?:<a[^>]*>)?([^<]*)`, 's');
  return row.match(re)?.[1]?.trim() ?? '';
}

function getNum(row: string, stat: string): number {
  return parseFloat(getCell(row, stat)) || 0;
}

function parseRows(html: string): string[] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  const rows: string[] = [];
  const re = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tbody)) !== null) {
    if (m[1].includes('data-stat="player"') && !m[1].includes('"thead"')) rows.push(m[1]);
  }
  return rows;
}

interface StdRow { name: string; games: number; mins: number; goals: number; assists: number; shots: number; shotsOT: number; yellowCards: number; redCards: number; pkGoals: number }
interface MiscRow { games: number; fouls: number; fouled: number }

async function fetchStandardUrl(url: string): Promise<Map<string, StdRow>> {
  const html = await fbFetch(url);
  const map = new Map<string, StdRow>();
  if (!html) return map;
  for (const row of parseRows(html)) {
    const name = getCell(row, 'player');
    if (!name || name === 'Player') continue;
    const games = getNum(row, 'games');
    if (!games) continue;
    const mins90 = getNum(row, 'minutes_90s');
    map.set(norm(name), {
      name, games,
      mins: Math.round((mins90 * 90) / games) || 75,
      goals: getNum(row, 'goals'),
      assists: getNum(row, 'assists'),
      shots: getNum(row, 'shots'),
      shotsOT: getNum(row, 'shots_on_target'),
      yellowCards: getNum(row, 'cards_yellow'),
      redCards: getNum(row, 'cards_red'),
      pkGoals: getNum(row, 'pens_made'),
    });
  }
  return map;
}

async function fetchMiscUrl(url: string): Promise<Map<string, MiscRow>> {
  const html = await fbFetch(url);
  const map = new Map<string, MiscRow>();
  if (!html) return map;
  for (const row of parseRows(html)) {
    const name = getCell(row, 'player');
    if (!name || name === 'Player') continue;
    const games = getNum(row, 'games');
    if (!games) continue;
    map.set(norm(name), {
      games,
      fouls: getNum(row, 'fouls'),
      fouled: getNum(row, 'fouled'),
    });
  }
  return map;
}

// Tries season-specific URL first, falls back to current-season redirect
async function fetchStandard(stdUrls: string[]): Promise<Map<string, StdRow>> {
  for (const url of stdUrls) {
    const m = await fetchStandardUrl(url);
    if (m.size > 0) return m;
  }
  return new Map();
}

async function fetchMisc(miscUrls: string[]): Promise<Map<string, MiscRow>> {
  for (const url of miscUrls) {
    const m = await fetchMiscUrl(url);
    if (m.size > 0) return m;
  }
  return new Map();
}

const BASE = 'https://fbref.com/en/comps';
const COMPS = [
  {
    stdUrls:  [`${BASE}/Big5/2025-2026/stats/players/Big-5-European-Leagues-Stats`,  `${BASE}/Big5/stats/Big-5-European-Leagues-Stats`],
    miscUrls: [`${BASE}/Big5/2025-2026/misc/players/Big-5-European-Leagues-Misc-Stats`, `${BASE}/Big5/misc/Big-5-European-Leagues-Misc-Stats`],
  },
  {
    stdUrls:  [`${BASE}/8/2025-2026/stats/Champions-League-Stats`,   `${BASE}/8/stats/Champions-League-Stats`],
    miscUrls: [`${BASE}/8/2025-2026/misc/Champions-League-Misc-Stats`, `${BASE}/8/misc/Champions-League-Misc-Stats`],
  },
  {
    stdUrls:  [`${BASE}/19/2025-2026/stats/Europa-League-Stats`,   `${BASE}/19/stats/Europa-League-Stats`],
    miscUrls: [`${BASE}/19/2025-2026/misc/Europa-League-Misc-Stats`, `${BASE}/19/misc/Europa-League-Misc-Stats`],
  },
];

interface RawAccumulator {
  name: string;
  games: number;
  minsTotal: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOT: number;
  yellowCards: number;
  redCards: number;
  fouls: number;
  fouled: number;
  pkGoals: number;
}

export async function fetchFBrefIndex(): Promise<Map<string, FBrefPlayer>> {
  // Accumulate raw totals across all competitions before computing per-game averages.
  // This ensures a PL player's CL/EL stats are included rather than discarded.
  const raw = new Map<string, RawAccumulator>();

  for (const comp of COMPS) {
    const stdMap = await fetchStandard(comp.stdUrls);
    const miscMap = await fetchMisc(comp.miscUrls);

    for (const [key, s] of Array.from(stdMap)) {
      const m = miscMap.get(key);
      const existing = raw.get(key);
      if (existing) {
        existing.games       += s.games;
        existing.minsTotal   += s.mins * s.games;
        existing.goals       += s.goals;
        existing.assists     += s.assists;
        existing.shots       += s.shots;
        existing.shotsOT     += s.shotsOT;
        existing.yellowCards += s.yellowCards;
        existing.redCards    += s.redCards;
        existing.fouls       += m?.fouls ?? 0;
        existing.fouled      += m?.fouled ?? 0;
        existing.pkGoals     += s.pkGoals;
      } else {
        raw.set(key, {
          name: s.name,
          games: s.games,
          minsTotal: s.mins * s.games,
          goals: s.goals,
          assists: s.assists,
          shots: s.shots,
          shotsOT: s.shotsOT,
          yellowCards: s.yellowCards,
          redCards: s.redCards,
          fouls: m?.fouls ?? 0,
          fouled: m?.fouled ?? 0,
          pkGoals: s.pkGoals,
        });
      }
    }
  }

  const index = new Map<string, FBrefPlayer>();
  for (const [key, acc] of Array.from(raw)) {
    const g = acc.games;
    index.set(key, {
      name: acc.name,
      games: g,
      minsPerGame: g > 0 ? Math.round(acc.minsTotal / g) : 75,
      goals: acc.goals,
      assists: acc.assists,
      shotsPerGame: g > 0 ? +(acc.shots / g).toFixed(2) : 0,
      sotPerGame: g > 0 ? +(acc.shotsOT / g).toFixed(2) : 0,
      yellowCards: acc.yellowCards,
      redCards: acc.redCards,
      foulsPerGame: g > 0 ? +(acc.fouls / g).toFixed(2) : 0,
      foulsWonPerGame: g > 0 ? +(acc.fouled / g).toFixed(2) : 0,
      pkGoals: acc.pkGoals,
    });
  }

  return index;
}

export function buildFBrefNameIndex(players: FBrefPlayer[]): Map<string, FBrefPlayer> {
  const idx = new Map<string, FBrefPlayer>();
  const set = (key: string, p: FBrefPlayer) => { if (key && !idx.has(key)) idx.set(key, p); };
  for (const p of players) {
    const n = norm(p.name);
    const parts = n.split(' ');
    set(n, p);
    if (parts.length >= 2) {
      set(parts[parts.length - 1], p);
      set(`${parts[0]} ${parts[parts.length - 1]}`, p);
    }
  }
  return idx;
}

export function lookupFBref(idx: Map<string, FBrefPlayer>, name: string): FBrefPlayer | null {
  if (!idx.size) return null;
  const n = norm(name);
  const parts = n.split(' ');
  const last = parts[parts.length - 1];
  if (idx.has(n)) return idx.get(n)!;
  if (idx.has(last) && last.length > 3) return idx.get(last)!;
  const fl = `${parts[0]} ${last}`;
  if (idx.has(fl)) return idx.get(fl)!;
  if (last.length > 4) { for (const [k, v] of Array.from(idx)) { if (k.includes(last)) return v; } }
  return null;
}
