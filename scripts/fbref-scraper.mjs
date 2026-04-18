/**
 * scripts/fbref-scraper.mjs
 * ─────────────────────────
 * Fetches real player stats from Understat's internal API.
 * Stats: goals, assists, xG, shots, yellow/red cards, minutes.
 * Covers: Premier League, La Liga, Bundesliga, Serie A, Ligue 1.
 * Results are cached to data/fbref/players.json for 24 hours.
 *
 * Standalone: node scripts/fbref-scraper.mjs
 * Or import { loadFbrefPlayers, buildNameIndex, lookupFbrefPlayer }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const FBREF_DIR  = join(ROOT, 'data', 'fbref');
const CACHE_FILE = join(FBREF_DIR, 'players.json');
const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24h

// Current season start year (2025 = 2025/26)
const SEASON = '2025';

const LEAGUES = [
  { id: 'EPL',        name: 'Premier League' },
  { id: 'La_liga',    name: 'La Liga'         },
  { id: 'Bundesliga', name: 'Bundesliga'      },
  { id: 'Serie_A',    name: 'Serie A'         },
  { id: 'Ligue_1',    name: 'Ligue 1'         },
];

// ── Fetch one league from Understat ────────────────────────────────────────
async function fetchLeague(league) {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 800));

  const res = await fetch('https://understat.com/main/getPlayersStats/', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/x-www-form-urlencoded',
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'X-Requested-With':'XMLHttpRequest',
      'Referer':         `https://understat.com/league/${league.id}`,
    },
    body: `league=${league.id}&season=${SEASON}`,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { success, players } = await res.json();
  if (!success) throw new Error('API returned success=false');
  return players;
}

// ── Transform raw API data into usable player stats ────────────────────────
function transformPlayer(raw, leagueName) {
  const games = parseInt(raw.games)   || 1;
  const mins  = parseInt(raw.time)    || 0;
  const goals = parseFloat(raw.goals) || 0;
  const assts = parseFloat(raw.assists)|| 0;
  const shots = parseFloat(raw.shots) || 0;
  const xg    = parseFloat(raw.npxG)  || 0; // non-penalty xG

  return {
    name:            raw.player_name,
    team:            raw.team_title,
    league:          leagueName,
    position:        raw.position || '',
    games,
    avgMins:         Math.round(mins / games),
    goals,
    assists:         assts,
    xg:              +xg.toFixed(2),
    yellowCards:     parseInt(raw.yellow_cards) || 0,
    redCards:        parseInt(raw.red_cards)    || 0,
    shotsPerGame:    +(shots / games).toFixed(2),
    sotPerGame:      +(shots / games * 0.37).toFixed(2), // ~37% league avg SOT rate
    gaPerGame:       +((goals + assts) / games).toFixed(2),
    // Fouls/tackles not in Understat — sync.mjs falls back to positional defaults
    foulsPerGame:    0,
    foulsWonPerGame: 0,
    tacklesPerGame:  0,
  };
}

// ── Scrape all leagues ─────────────────────────────────────────────────────
async function scrapeAll() {
  const all = [];
  for (const league of LEAGUES) {
    try {
      console.log(`[stats] Fetching ${league.name}…`);
      const raw = await fetchLeague(league);
      const players = raw.map(p => transformPlayer(p, league.name));
      all.push(...players);
      console.log(`[stats] ${league.name}: ${players.length} players`);
    } catch (e) {
      console.warn(`[stats] Skipping ${league.name}: ${e.message}`);
    }
  }
  return all;
}

// ── Name normalisation + fuzzy lookup ─────────────────────────────────────
export function normName(raw) {
  return (raw || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildNameIndex(players) {
  const idx = new Map();
  const set = (key, p) => { if (key && !idx.has(key)) idx.set(key, p); };

  for (const p of players) {
    const norm  = normName(p.name);
    const parts = norm.split(' ');
    set(norm, p);
    if (parts.length >= 2) {
      set(parts[parts.length - 1], p);                   // last name
      set(`${parts[0]} ${parts[parts.length - 1]}`, p);  // first + last
    }
  }
  return idx;
}

export function lookupFbrefPlayer(idx, name) {
  if (!idx?.size) return null;
  const norm  = normName(name);
  const parts = norm.split(' ');
  const last  = parts[parts.length - 1];

  if (idx.has(norm))                    return idx.get(norm);
  if (idx.has(last) && last.length > 4) return idx.get(last);
  const fl = `${parts[0]} ${last}`;
  if (idx.has(fl))                      return idx.get(fl);

  // Partial surname match for longer names (avoids false positives on short names)
  if (last.length > 5) {
    for (const [key, val] of idx) {
      if (key.includes(last)) return val;
    }
  }
  return null;
}

// ── Cache helpers ──────────────────────────────────────────────────────────
export function loadFbrefCache() {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const { scraped, players } = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    if (Date.now() - scraped > CACHE_TTL) return null;
    return players;
  } catch {
    return null;
  }
}

export async function buildFbrefCache() {
  if (!existsSync(FBREF_DIR)) mkdirSync(FBREF_DIR, { recursive: true });
  const players = await scrapeAll();
  writeFileSync(CACHE_FILE, JSON.stringify({ scraped: Date.now(), players }, null, 2));
  console.log(`[stats] Saved ${players.length} players → ${CACHE_FILE}`);
  return players;
}

export async function loadFbrefPlayers() {
  const cached = loadFbrefCache();
  if (cached) { console.log(`[stats] Cache hit — ${cached.length} players`); return cached; }
  console.log('[stats] Cache miss — fetching from Understat…');
  return buildFbrefCache();
}

// ── Standalone run ─────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildFbrefCache()
    .then(p => { console.log(`[stats] Done — ${p.length} players cached.`); process.exit(0); })
    .catch(e => { console.error('[stats] Fatal:', e); process.exit(1); });
}
