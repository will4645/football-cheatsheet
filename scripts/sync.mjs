/**
 * scripts/sync.mjs
 * ─────────────────
 * Polls football-data.org for upcoming fixtures across monitored competitions.
 * When lineups are confirmed, generates a MatchData JSON file and adds the
 * match to data/live/matches.json. Removes finished matches automatically.
 *
 * Run alongside the Next.js dev server:
 *   npm run dev    (terminal 1)
 *   npm run sync   (terminal 2)
 *
 * Requires: FOOTBALL_DATA_KEY in .env.local
 * Free tier covers: PL, CL, FA Cup, World Cup, Euros + more
 * Free tier rate limit: 10 requests/minute
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadFbrefPlayers, buildNameIndex, lookupFbrefPlayer } from './fbref-scraper.mjs';

// Load .env.local manually (works on all Node versions)
try {
  const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
  readFileSync(envFile, 'utf-8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
} catch { /* .env.local not found — rely on environment variables */ }

const require = createRequire(import.meta.url);
const cron    = require('node-cron');

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const LIVE_DIR   = join(ROOT, 'data', 'live');
const MATCHES_FILE  = join(LIVE_DIR, 'matches.json');
const UPCOMING_FILE = join(LIVE_DIR, 'upcoming.json');

if (!existsSync(LIVE_DIR)) mkdirSync(LIVE_DIR, { recursive: true });

const API_KEY = process.env.FOOTBALL_DATA_KEY;
if (!API_KEY) {
  console.error('[sync] ERROR: FOOTBALL_DATA_KEY not set in .env.local');
  process.exit(1);
}

// ── FBref player stats cache ───────────────────────────────────────────────
let fbrefIndex       = new Map();
let fbrefLoadedAt    = 0;
const FBREF_REFRESH  = 23 * 60 * 60 * 1000; // re-load after 23h

async function refreshFbref() {
  if (Date.now() - fbrefLoadedAt < FBREF_REFRESH) return;
  try {
    const players = await loadFbrefPlayers();
    fbrefIndex    = buildNameIndex(players);
    fbrefLoadedAt = Date.now();
    console.log(`[sync] FBref index: ${fbrefIndex.size} name keys`);
  } catch (e) {
    console.warn('[sync] FBref refresh failed:', e.message);
  }
}

const BASE_URL = 'https://api.football-data.org/v4';
const HEADERS  = { 'X-Auth-Token': API_KEY };

// Competitions to monitor (football-data.org codes)
const COMPETITIONS = ['PL', 'CL', 'FAC', 'EL', 'EC', 'WC', 'CLI'];

const FINISHED_STATUSES = new Set(['FINISHED', 'AWARDED', 'CANCELLED']);

// ── In-memory cache ────────────────────────────────────────────────────────
const cache = new Map();
const TTL = {
  matches:  5  * 60 * 1000,
  lineups:  2  * 60 * 1000,
  team:     60 * 60 * 1000,
};

async function apiFetch(path, ttlKey = 'matches') {
  const cached = cache.get(path);
  if (cached && Date.now() < cached.exp) return cached.data;

  await new Promise(r => setTimeout(r, 300)); // respect rate limit
  const res = await fetch(`${BASE_URL}${path}`, { headers: HEADERS });

  if (res.status === 429) {
    console.warn('[sync] Rate limited — waiting 60s');
    await new Promise(r => setTimeout(r, 60000));
    return apiFetch(path, ttlKey);
  }
  if (!res.ok) {
    console.warn(`[sync] ${res.status} for ${path}`);
    return null;
  }

  const data = await res.json();
  cache.set(path, { data, exp: Date.now() + (TTL[ttlKey] || TTL.matches) });
  return data;
}

// ── Probability helpers ────────────────────────────────────────────────────
function poissonAtLeast(lambda, k) {
  let cumulative = 0, term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) { cumulative += term; term *= lambda / (i + 1); }
  return Math.max(0, Math.min(1, 1 - cumulative));
}
function toScale(p) { return Math.max(20, Math.min(100, Math.round(p * 5) * 20)); }
function overProb(avg, threshold) { return toScale(poissonAtLeast(avg, threshold + 1)); }

// ── Team primary colours ───────────────────────────────────────────────────
const TEAM_COLORS = {
  'manchester city':    '#6CABDD', 'man city':           '#6CABDD',
  'manchester united':  '#DA291C', 'man united':         '#DA291C', 'man utd': '#DA291C',
  'liverpool':          '#C8102E',
  'arsenal':            '#EF0107',
  'chelsea':            '#034694',
  'tottenham':          '#132257', 'spurs':              '#132257',
  'newcastle':          '#241F20',
  'aston villa':        '#95BFE5',
  'west ham':           '#7A263A',
  'brighton':           '#0057B8',
  'wolves':             '#FDB913', 'wolverhampton':      '#FDB913',
  'everton':            '#003399',
  'fulham':             '#CC0000',
  'brentford':          '#E30613',
  'crystal palace':     '#1B458F',
  'nottingham forest':  '#E53233', 'nottm forest':       '#E53233',
  'leicester':          '#003090',
  'ipswich':            '#0044A9',
  'southampton':        '#D71920',
  'real madrid':        '#FEBE10',
  'barcelona':          '#004D98',
  'atletico':           '#CE1126', 'atlético':           '#CE1126',
  'bayern':             '#DC052D', 'fc bayern':          '#DC052D',
  'borussia dortmund':  '#FDE100', 'dortmund':           '#FDE100',
  'psg':                '#004170', 'paris saint-germain': '#004170', 'paris': '#004170',
  'juventus':           '#000000',
  'inter':              '#010E80', 'inter milan':        '#010E80',
  'ac milan':           '#FB090B', 'milan':              '#FB090B',
  'porto':              '#003087',
  'benfica':            '#E4172B',
  'ajax':               '#D2122E',
  'celtic':             '#16A34A',
  'rangers':            '#1B458F',
  'england':            '#012169',
  'france':             '#002395',
  'germany':            '#000000',
  'spain':              '#AA151B',
  'italy':              '#003399',
  'brazil':             '#009C3B',
  'argentina':          '#74ACDF',
  'portugal':           '#006600',
  'netherlands':        '#FF6600',
};

function getTeamColor(name) {
  const lower = (name || '').toLowerCase();
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#888888';
}

// ── Short name helper ──────────────────────────────────────────────────────
function shortName(full) {
  if (!full) return '';
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1];
}

// ── Build team stats from recent match results ─────────────────────────────
function buildTeamStats(matches, teamId) {
  if (!matches?.length) return defaultStats();

  let goalsFor = 0, goalsAgainst = 0, count = 0;
  for (const m of matches.slice(0, 10)) {
    const isHome = m.homeTeam?.id === teamId;
    const score  = m.score?.fullTime;
    if (!score) continue;
    goalsFor     += isHome ? (score.home ?? 0) : (score.away ?? 0);
    goalsAgainst += isHome ? (score.away ?? 0) : (score.home ?? 0);
    count++;
  }

  if (!count) return defaultStats();

  const avgFor   = goalsFor  / count;
  const avgAgainst = goalsAgainst / count;

  return {
    goalsFor:      +avgFor.toFixed(2),
    goalsAgainst:  +avgAgainst.toFixed(2),
    over25Goals:   overProb(avgFor + avgAgainst, 2.5),
    cornersFor: 5.0, cornersAgainst: 5.0, over95Corners: 60,
    shotsFor: 13.0, shotsAgainst: 11.0, over195Shots: 60,
    sotFor: 4.5, sotAgainst: 3.8, over95SoT: 60,
    foulsCommitted: 11.0, foulsWon: 11.0, over155Fouls: 60,
    cardsFor: 1.8, cardsAgainst: 1.8, over45Cards: 40,
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

// ── Build player sections from lineup ─────────────────────────────────────
function buildPlayers(homeLineup, awayLineup) {
  function playerDefaults(p) {
    const name = p.name || p.person?.name || 'Unknown';
    const pos  = (p.position || 'Midfielder').toLowerCase();
    const isAttacker = pos.includes('forward') || pos.includes('attack') || pos.includes('winger') || pos.includes('offence');
    const isMid      = pos.includes('mid');
    const isDef      = pos.includes('back') || pos.includes('defend') || pos.includes('keeper') || pos.includes('goal');

    const defaults = {
      name,
      mins:            75,
      foulsPerGame:    isDef ? 1.2 : isMid ? 1.0 : 0.8,
      tacklesPerGame:  isDef ? 1.8 : isMid ? 1.2 : 0.6,
      foulsWonPerGame: isAttacker ? 1.8 : isMid ? 1.2 : 0.8,
      sotPerGame:      isAttacker ? 1.5 : isMid ? 0.6 : 0.2,
      shotsPerGame:    isAttacker ? 3.0 : isMid ? 1.2 : 0.4,
      goals:           isAttacker ? 8  : isMid ? 4  : 1,
      assists:         isAttacker ? 5  : isMid ? 6  : 2,
      gaPerGame:       isAttacker ? 0.7 : isMid ? 0.4 : 0.1,
      yellowCards:     isDef ? 4 : isMid ? 3 : 2,
      last5Goals:      isAttacker ? 2 : isMid ? 1 : 0,
      last5Assists:    isAttacker ? 1 : isMid ? 2 : 0,
      form:            'ok',
    };

    const fb = lookupFbrefPlayer(fbrefIndex, name);
    if (fb && fb.games >= 3) {
      // Overlay real stats — keep positional defaults only for metrics FBref had as 0
      return {
        ...defaults,
        mins:            fb.avgMins || defaults.mins,
        goals:           fb.goals,
        assists:         fb.assists,
        gaPerGame:       fb.gaPerGame,
        shotsPerGame:    fb.shotsPerGame  || defaults.shotsPerGame,
        sotPerGame:      fb.sotPerGame    || defaults.sotPerGame,
        foulsPerGame:    fb.foulsPerGame  || defaults.foulsPerGame,
        foulsWonPerGame: fb.foulsWonPerGame || defaults.foulsWonPerGame,
        tacklesPerGame:  fb.tacklesPerGame  || defaults.tacklesPerGame,
        yellowCards:     fb.yellowCards,
      };
    }

    return defaults;
  }

  function top5(players, key) {
    return [...players].sort((a, b) => b[key] - a[key]).slice(0, 5);
  }

  function buildSide(starters, opposingStarters) {
    const players = starters.map(playerDefaults);
    const opp     = opposingStarters.map(playerDefaults);

    const oppDef = top5(opp, 'foulsPerGame').slice(0, 2).map(p => shortName(p.name)).join(', ');
    const oppOff = top5(opp, 'foulsWonPerGame').slice(0, 2).map(p => shortName(p.name)).join(', ');

    return {
      defensive: top5(players, 'foulsPerGame').map(p => ({
        name: p.name, mins: p.mins,
        foulsPerGame: +p.foulsPerGame.toFixed(2),
        tacklesPerGame: +p.tacklesPerGame.toFixed(2),
        prob1Foul: toScale(poissonAtLeast(p.foulsPerGame, 1)),
        yellowCards: p.yellowCards,
        potentialOpponent: oppDef,
        form: p.form,
      })),
      offensive: top5(players, 'foulsWonPerGame').map(p => ({
        name: p.name, mins: p.mins,
        foulsWonPerGame: +p.foulsWonPerGame.toFixed(2),
        prob1FoulWon: toScale(poissonAtLeast(p.foulsWonPerGame, 1)),
        prob2FoulWon: toScale(poissonAtLeast(p.foulsWonPerGame, 2)),
        potentialOpponent: oppOff,
        form: p.form,
      })),
      shooting: top5(players, 'sotPerGame').map(p => ({
        name: p.name, mins: p.mins,
        sotPerGame: +p.sotPerGame.toFixed(2),
        prob1SoT: toScale(poissonAtLeast(p.sotPerGame, 1)),
        shotsPerGame: +p.shotsPerGame.toFixed(2),
        prob2Shots: toScale(poissonAtLeast(p.shotsPerGame, 2)),
        badges: [], form: p.form,
      })),
      goalscoring: top5(players, 'gaPerGame').map(p => ({
        name: p.name, mins: p.mins,
        goals: p.goals, assists: p.assists,
        gaPerGame: +p.gaPerGame.toFixed(2),
        prob: toScale(poissonAtLeast(p.gaPerGame, 1)),
        badges: [], last5Goals: p.last5Goals, last5Assists: p.last5Assists,
        form: p.form,
      })),
    };
  }

  const homeStarters = homeLineup.lineup || homeLineup.startingEleven || [];
  const awayStarters = awayLineup.lineup || awayLineup.startingEleven || [];

  return {
    home: buildSide(homeStarters, awayStarters),
    away: buildSide(awayStarters, homeStarters),
  };
}

// ── Date helpers ───────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  });
}

function formatKickoff(iso) {
  const d  = new Date(iso);
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const tz = d.toLocaleTimeString('en-GB', { timeZoneName: 'short', timeZone: 'Europe/London' }).includes('BST') ? 'BST' : 'GMT';
  return `${hm} ${tz}`;
}

function matchId(home, away) {
  const slug = s => (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${slug(home)}-vs-${slug(away)}`;
}

// ── File helpers ───────────────────────────────────────────────────────────
function readMatches() {
  try { return JSON.parse(readFileSync(MATCHES_FILE, 'utf-8')); }
  catch { return []; }
}

function saveMatches(list)   { writeFileSync(MATCHES_FILE,  JSON.stringify(list, null, 2)); }
function saveUpcoming(list) { writeFileSync(UPCOMING_FILE, JSON.stringify(list, null, 2)); }

function removeMatch(id) {
  const file = join(LIVE_DIR, `${id}.json`);
  if (existsSync(file)) { unlinkSync(file); console.log(`[sync] Removed: ${id}`); }
  saveMatches(readMatches().filter(m => m.id !== id));
}

// ── Main sync ──────────────────────────────────────────────────────────────
async function sync() {
  console.log(`[sync] Running — ${new Date().toLocaleTimeString()}`);
  await refreshFbref();

  const today    = new Date();
  const in24h    = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const fmt      = d => d.toISOString().slice(0, 10);

  const data = await apiFetch(`/matches?competitions=${COMPETITIONS.join(',')}&dateFrom=${fmt(today)}&dateTo=${fmt(in24h)}`);
  if (!data?.matches) { console.log('[sync] No matches returned'); return; }

  console.log(`[sync] Found ${data.matches.length} matches today/tomorrow`);
  const liveMatches   = readMatches();
  const pendingList   = [];

  for (const match of data.matches) {
    const id     = matchId(match.homeTeam?.name, match.awayTeam?.name);
    const status = match.status;

    if (FINISHED_STATUSES.has(status)) { removeMatch(id); continue; }

    const kickoff   = new Date(match.utcDate);
    const hoursAway = (kickoff - Date.now()) / 3_600_000;
    if (hoursAway > 24) continue;

    // Fetch lineups
    const lineupData  = await apiFetch(`/matches/${match.id}/lineups`, 'lineups');
    const hasLineups  = lineupData?.homeTeam?.lineup?.length > 0 || lineupData?.homeTeam?.startingEleven?.length > 0;

    if (!hasLineups) {
      console.log(`[sync] No lineups yet: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`);
      const homeName  = match.homeTeam?.name;
      const awayName  = match.awayTeam?.name;
      const stage     = match.stage
        ? match.stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : match.matchday ? `Matchday ${match.matchday}` : 'Match';
      if (!liveMatches.find(m => m.id === id)) {
        pendingList.push({
          id,
          competition: match.competition?.name || 'Football',
          stage,
          date:    formatDate(match.utcDate),
          kickoff: formatKickoff(match.utcDate),
          homeTeam: { name: homeName, badge: `https://crests.football-data.org/${match.homeTeam.id}.svg`, primaryColor: getTeamColor(homeName) },
          awayTeam: { name: awayName, badge: `https://crests.football-data.org/${match.awayTeam.id}.svg`, primaryColor: getTeamColor(awayName) },
        });
      }
      continue;
    }

    console.log(`[sync] Generating: ${match.homeTeam?.name} vs ${match.awayTeam?.name}`);

    const [homeResults, awayResults] = await Promise.all([
      apiFetch(`/teams/${match.homeTeam.id}/matches?status=FINISHED&limit=10`, 'team'),
      apiFetch(`/teams/${match.awayTeam.id}/matches?status=FINISHED&limit=10`, 'team'),
    ]);

    const homeStats = buildTeamStats(homeResults?.matches, match.homeTeam.id);
    const awayStats = buildTeamStats(awayResults?.matches, match.awayTeam.id);
    const players   = buildPlayers(lineupData.homeTeam, lineupData.awayTeam);

    const homeName  = match.homeTeam.name;
    const awayName  = match.awayTeam.name;
    const homeBadge = `https://crests.football-data.org/${match.homeTeam.id}.svg`;
    const awayBadge = `https://crests.football-data.org/${match.awayTeam.id}.svg`;

    const stage = match.stage
      ? match.stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : match.matchday ? `Matchday ${match.matchday}` : 'Match';

    const matchData = {
      competition: match.competition?.name || 'Football',
      stage,
      date:    formatDate(match.utcDate),
      kickoff: formatKickoff(match.utcDate),
      homeTeam: {
        name: homeName, primaryColor: getTeamColor(homeName), badge: homeBadge,
        stats: homeStats, players: players.home,
      },
      awayTeam: {
        name: awayName, primaryColor: getTeamColor(awayName), badge: awayBadge,
        stats: awayStats, players: players.away,
      },
      referee: {
        name: match.referees?.[0]?.name || 'TBC',
        currentSeason: { yellows: 3.0, reds: 0.2, foulsPg: 22.0 },
        career:        { yellows: 3.1, reds: 0.2, foulsPg: 23.0 },
      },
      probabilities: {
        btts:    overProb((homeStats.goalsFor + awayStats.goalsFor) / 2, 0),
        homeWin: 40, draw: 25, awayWin: 35,
      },
      fixtureId: match.id,
      status,
    };

    writeFileSync(join(LIVE_DIR, `${id}.json`), JSON.stringify(matchData, null, 2));

    if (!liveMatches.find(m => m.id === id)) {
      liveMatches.push({
        id, competition: matchData.competition, stage: matchData.stage,
        date: matchData.date, kickoff: matchData.kickoff,
        homeTeam: { name: homeName, badge: homeBadge, primaryColor: getTeamColor(homeName) },
        awayTeam: { name: awayName, badge: awayBadge, primaryColor: getTeamColor(awayName) },
      });
      saveMatches(liveMatches);
      console.log(`[sync] Added to home page: ${id}`);
    }
  }

  saveUpcoming(pendingList);
  console.log(`[sync] Upcoming (no lineups): ${pendingList.length}`);

  // Check existing live matches for finished status
  for (const m of readMatches()) {
    try {
      const file = join(LIVE_DIR, `${m.id}.json`);
      if (!existsSync(file)) continue;
      const d = JSON.parse(readFileSync(file, 'utf-8'));
      if (!d.fixtureId) continue;
      const latest = await apiFetch(`/matches/${d.fixtureId}`, 'lineups');
      if (latest?.match && FINISHED_STATUSES.has(latest.match.status)) removeMatch(m.id);
    } catch { /* ignore */ }
  }
}

// ── Start ──────────────────────────────────────────────────────────────────
console.log('[sync] Football cheatsheet automation started');
console.log('[sync] Monitoring: PL · FA Cup · CL · EL · World Cup · Euros');
console.log('[sync] Polling every 5 minutes. Ctrl+C to stop.\n');

sync();
cron.schedule('*/5 * * * *', sync);
