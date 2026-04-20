/**
 * lib/fbref.ts
 * Scrapes FBref for player season stats covering Big 5 leagues + Champions League.
 * Provides fouls committed/drawn, tackles, shots, goals, assists, cards, minutes.
 * Rate limited to 3.5s per request to avoid FBref bans.
 */

const RATE_MS = 3500;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface FBrefPlayer {
  name: string;
  games: number;
  minsPerGame: number;
  goals: number;
  assists: number;
  shotsPerGame: number;
  yellowCards: number;
  foulsPerGame: number;
  foulsWonPerGame: number;
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
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-GB' },
    });
    if (!res.ok) return null;
    return res.text();
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

interface StdRow { name: string; games: number; mins: number; goals: number; assists: number; shots: number; yellowCards: number }
interface MiscRow { games: number; fouls: number; fouled: number }

async function fetchStandard(compId: string, slug: string): Promise<Map<string, StdRow>> {
  const url = `https://fbref.com/en/comps/${compId}/stats/${slug}-Stats`;
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
      yellowCards: getNum(row, 'cards_yellow'),
    });
  }
  return map;
}

async function fetchMisc(compId: string, slug: string): Promise<Map<string, MiscRow>> {
  const url = `https://fbref.com/en/comps/${compId}/misc/${slug}-Misc-Stats`;
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

// Big5 combined page + Champions League
const COMPS = [
  { id: 'Big5', slug: 'Big-5-European-Leagues' },
  { id: '8',    slug: 'Champions-League' },
  { id: '19',   slug: 'Europa-League' },
];

export async function fetchFBrefIndex(): Promise<Map<string, FBrefPlayer>> {
  const index = new Map<string, FBrefPlayer>();

  for (const comp of COMPS) {
    const stdMap = await fetchStandard(comp.id, comp.slug);
    const miscMap = await fetchMisc(comp.id, comp.slug);

    for (const [key, s] of stdMap) {
      if (index.has(key)) continue; // already have from a higher-priority comp
      const m = miscMap.get(key);
      index.set(key, {
        name: s.name,
        games: s.games,
        minsPerGame: s.mins,
        goals: s.goals,
        assists: s.assists,
        shotsPerGame: s.games > 0 ? +(s.shots / s.games).toFixed(2) : 0,
        yellowCards: s.yellowCards,
        foulsPerGame: m && m.games > 0 ? +(m.fouls / m.games).toFixed(2) : 0,
        foulsWonPerGame: m && m.games > 0 ? +(m.fouled / m.games).toFixed(2) : 0,
      });
    }
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
