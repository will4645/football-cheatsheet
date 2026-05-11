/**
 * lib/api-sports.ts
 * Fetches player season stats from API-Football (api-sports.io).
 * Aggregates goals, assists, shots, SoT, fouls committed/won, cards
 * across ALL competitions (Big5 + CL + EL + ECL) per player.
 */

const BASE = 'https://v3.football.api-sports.io';
const SEASON = 2025;
const RATE_MS = 250; // 250ms between requests — safe for paid plan (500 req/min limit)

const COMPETITIONS = [
  // Big 5
  { id: 39,  name: 'Premier League' },
  { id: 140, name: 'La Liga' },
  { id: 78,  name: 'Bundesliga' },
  { id: 135, name: 'Serie A' },
  { id: 61,  name: 'Ligue 1' },
  // European competitions
  { id: 2,   name: 'Champions League' },
  { id: 3,   name: 'Europa League' },
  { id: 848, name: 'Conference League' },
  // Other UEFA domestic leagues (clubs appear in CL/EL/ECL)
  { id: 94,  name: 'Primeira Liga' },       // Portugal
  { id: 88,  name: 'Eredivisie' },          // Netherlands
  { id: 144, name: 'Pro League' },          // Belgium
  { id: 271, name: 'Scottish Premiership' },// Scotland
  { id: 203, name: 'Süper Lig' },           // Turkey
  { id: 113, name: 'Allsvenskan' },         // Sweden
  { id: 119, name: 'Superligaen' },         // Denmark
  { id: 103, name: 'Eliteserien' },         // Norway
  { id: 218, name: 'Austrian Bundesliga' }, // Austria
  { id: 169, name: 'Swiss Super League' },  // Switzerland
  { id: 197, name: 'Super League' },        // Greece
  { id: 106, name: 'Ekstraklasa' },         // Poland
  { id: 210, name: 'HNL' },                 // Croatia
  { id: 286, name: 'SuperLiga' },           // Serbia
  { id: 333, name: 'Ukrainian PL' },        // Ukraine
  { id: 283, name: 'Liga I' },              // Romania
  { id: 244, name: 'Czech Liga' },          // Czech Republic
];

export interface ApiSportsPlayer {
  name: string;
  games: number;
  minsPerGame: number;
  goals: number;
  assists: number;
  shotsPerGame: number;
  sotPerGame: number;
  foulsPerGame: number;
  foulsWonPerGame: number;
  yellowCards: number;
  redCards: number;
  pkGoals: number;
}

function norm(raw: string): string {
  return (raw || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function apiFetch(path: string, key: string): Promise<any> {
  await new Promise(r => setTimeout(r, RATE_MS));
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': key },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API-Sports ${res.status}: ${path}`);
  return res.json();
}

async function fetchLeaguePlayers(leagueId: number, key: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const data = await apiFetch(`/players?league=${leagueId}&season=${SEASON}&page=${page}`, key);
    const results: any[] = data?.response ?? [];
    all.push(...results);
    const totalPages: number = data?.paging?.total ?? 1;
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

interface RawAccumulator {
  name: string;
  games: number;
  minsTotal: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOn: number;
  fouls: number;
  fouled: number;
  yellowCards: number;
  redCards: number;
  pkGoals: number;
}

export async function fetchApiSportsIndex(apiKey: string): Promise<Map<string, ApiSportsPlayer>> {
  const raw = new Map<string, RawAccumulator>();

  for (const comp of COMPETITIONS) {
    try {
      const players = await fetchLeaguePlayers(comp.id, apiKey);

      for (const entry of players) {
        const playerName: string = entry.player?.name ?? '';
        if (!playerName) continue;

        // Filter to this competition AND this season — API can return multi-season rows
        const statEntries: any[] = (entry.statistics ?? []).filter(
          (s: any) => s.league?.id === comp.id && s.league?.season === SEASON,
        );

        for (const s of statEntries) {
          // API has a typo: "appearences" not "appearances"
          const games: number = s.games?.appearences ?? 0;
          if (!games) continue;

          const goals       = s.goals?.total      ?? 0;
          const assists     = s.goals?.assists     ?? 0;
          const shots       = s.shots?.total       ?? 0;
          const shotsOn     = s.shots?.on          ?? 0;
          const fouls       = s.fouls?.committed   ?? 0;
          const fouled      = s.fouls?.drawn       ?? 0;
          const yellowCards = s.cards?.yellow      ?? 0;
          const redCards    = s.cards?.red         ?? 0;
          const pkGoals     = s.penalty?.scored    ?? 0;
          const mins        = s.games?.minutes     ?? (games * 75);

          const key = norm(playerName);
          const existing = raw.get(key);
          if (existing) {
            existing.games       += games;
            existing.minsTotal   += mins;
            existing.goals       += goals;
            existing.assists     += assists;
            existing.shots       += shots;
            existing.shotsOn     += shotsOn;
            existing.fouls       += fouls;
            existing.fouled      += fouled;
            existing.yellowCards += yellowCards;
            existing.redCards    += redCards;
            existing.pkGoals     += pkGoals;
          } else {
            raw.set(key, {
              name: playerName,
              games, minsTotal: mins,
              goals, assists, shots, shotsOn,
              fouls, fouled, yellowCards, redCards, pkGoals,
            });
          }
        }
      }
    } catch (err: any) {
      console.log(`[api-sports] Error fetching ${comp.name}: ${err.message}`);
    }
  }

  const index = new Map<string, ApiSportsPlayer>();
  for (const [key, acc] of Array.from(raw)) {
    const g = acc.games;
    index.set(key, {
      name:            acc.name,
      games:           g,
      minsPerGame:     g > 0 ? Math.round(acc.minsTotal / g) : 75,
      goals:           acc.goals,
      assists:         acc.assists,
      shotsPerGame:    g > 0 ? +(acc.shots   / g).toFixed(2) : 0,
      sotPerGame:      g > 0 ? +(acc.shotsOn / g).toFixed(2) : 0,
      foulsPerGame:    g > 0 ? +(acc.fouls   / g).toFixed(2) : 0,
      foulsWonPerGame: g > 0 ? +(acc.fouled  / g).toFixed(2) : 0,
      yellowCards:     acc.yellowCards,
      redCards:        acc.redCards,
      pkGoals:         acc.pkGoals,
    });
  }

  return index;
}

export function buildApiSportsNameIndex(players: ApiSportsPlayer[]): Map<string, ApiSportsPlayer> {
  const idx = new Map<string, ApiSportsPlayer>();
  const set = (key: string, p: ApiSportsPlayer) => { if (key && !idx.has(key)) idx.set(key, p); };
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

export function lookupApiSports(idx: Map<string, ApiSportsPlayer>, name: string): ApiSportsPlayer | null {
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
