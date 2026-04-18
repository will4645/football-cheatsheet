import type {
  TeamData,
  DefensivePlayer,
  OffensivePlayer,
  ShootingPlayer,
  GoalscoringPlayer,
} from '@/data/match';
import { poissonAtLeast, toScale, overProb, formColor, seededLast5 } from './probability';

/* ─────────────────────────────────────────────────────────────────────────────
   Utility helpers
───────────────────────────────────────────────────────────────────────────── */

/** Returns the last word of a full name (surname), unless it is a single-name player. */
export function shortName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

/** Converts a UTC ISO date string to "HH:MM BST" or "HH:MM GMT". */
export function formatKickoffBST(isoDate: string): string {
  const date = new Date(isoDate);
  // BST = UTC+1 (late March – late October); GMT = UTC+0 otherwise.
  // We derive the offset from the UK locale.
  const londonStr = date.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });
  // Determine whether London is on BST at that moment
  const utcOffset = getUkOffset(date);
  const tz = utcOffset === 1 ? 'BST' : 'GMT';
  return `${londonStr} ${tz}`;
}

function getUkOffset(date: Date): number {
  // Compare London time with UTC
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const london = new Date(utc);
  const londonParts = london.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false });
  const utcHour = london.getUTCHours();
  const londonHour = parseInt(londonParts, 10);
  const diff = ((londonHour - utcHour) + 24) % 24;
  return diff;
}

/** Formats a UTC ISO date as "17 April 2026". */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

/** Builds a URL-safe match slug like "manchester-city-vs-arsenal". */
export function buildMatchId(homeTeamName: string, awayTeamName: string): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(homeTeamName)}-vs-${slug(awayTeamName)}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   League-average defaults (used when API data is missing)
───────────────────────────────────────────────────────────────────────────── */
const DEFAULTS = {
  goalsFor:       1.5,
  goalsAgainst:   1.5,
  cornersFor:     5.0,
  cornersAgainst: 5.0,
  shotsFor:       12.0,
  shotsAgainst:   12.0,
  sotFor:         4.5,
  sotAgainst:     4.5,
  foulsCommitted: 11.0,
  foulsWon:       11.0,
  cardsFor:       1.8,
  cardsAgainst:   1.8,
};

/* ─────────────────────────────────────────────────────────────────────────────
   buildTeamStats
───────────────────────────────────────────────────────────────────────────── */

/**
 * Maps API-Football team statistics response to our TeamData['stats'] shape.
 * apiStats is the `response` object from /teams/statistics.
 */
export function buildTeamStats(apiStats: any): TeamData['stats'] {
  const s = apiStats ?? {};
  const goals = s.goals ?? {};
  const fixtures = s.fixtures ?? {};
  const played = fixtures.played?.total ?? 1;

  // Goals
  const goalsFor = +(goals.for?.average?.total ?? DEFAULTS.goalsFor);
  const goalsAgainst = +(goals.against?.average?.total ?? DEFAULTS.goalsAgainst);

  // Cards
  const cards = s.cards ?? {};
  const yellowTotal = sumCardRange(cards.yellow);
  const redTotal = sumCardRange(cards.red);
  const cardsFor = played > 0 ? +(yellowTotal / played).toFixed(2) : DEFAULTS.cardsFor;
  const cardsAgainst = DEFAULTS.cardsAgainst; // API doesn't expose opponent cards per team endpoint

  // Shots — API provides averages directly
  const shotsFor = +(s.shots?.for?.average ?? DEFAULTS.shotsFor);
  const shotsPg = typeof shotsFor === 'number' && shotsFor > 0 ? shotsFor : DEFAULTS.shotsFor;

  // API doesn't always give shots-on-target average — derive from total/played
  const sotForRaw = s.shots?.on?.average ?? null;
  const sotFor = sotForRaw !== null ? +sotForRaw : +(shotsPg * 0.37).toFixed(2);

  // Passes / corners — API doesn't expose corners directly; approximate from passes
  const cornersFor = +(s.passes?.accuracy ?? 50) > 0
    ? +((+(s.passes?.total?.average ?? 50)) * 0.09).toFixed(2)   // rough heuristic
    : DEFAULTS.cornersFor;
  const cornersAgainst = DEFAULTS.cornersAgainst; // not available per-team

  // Fouls — API provides fouls average
  const foulsCommitted = +(s.fouls?.committed?.average ?? DEFAULTS.foulsCommitted);
  const foulsWon = +(s.fouls?.drawn?.average ?? DEFAULTS.foulsWon);

  return {
    goalsFor,
    goalsAgainst,
    over25Goals:   overProb(goalsFor + goalsAgainst, 2.5),
    cornersFor,
    cornersAgainst,
    over95Corners: overProb(cornersFor + cornersAgainst, 9.5),
    shotsFor: +shotsPg.toFixed(2),
    shotsAgainst: +DEFAULTS.shotsAgainst.toFixed(2),
    over195Shots:  overProb(shotsPg + DEFAULTS.shotsAgainst, 19.5),
    sotFor: +sotFor.toFixed(2),
    sotAgainst: +DEFAULTS.sotAgainst.toFixed(2),
    over95SoT:     overProb(sotFor + DEFAULTS.sotAgainst, 9.5),
    foulsCommitted: +foulsCommitted.toFixed(2),
    foulsWon:       +foulsWon.toFixed(2),
    over155Fouls:   overProb(foulsCommitted + foulsWon, 15.5),
    cardsFor:       +cardsFor.toFixed(2),
    cardsAgainst:   +cardsAgainst.toFixed(2),
    over45Cards:    overProb(cardsFor + cardsAgainst, 4.5),
  };
}

/** Sum all match-range buckets in a card object (e.g. cards.yellow) */
function sumCardRange(cardObj: any): number {
  if (!cardObj) return 0;
  return Object.values(cardObj).reduce((acc: number, range: any) => acc + (range?.total ?? 0), 0);
}

/* ─────────────────────────────────────────────────────────────────────────────
   buildPlayers
───────────────────────────────────────────────────────────────────────────── */

interface ApiPlayerStat {
  player: { id: number; name: string };
  statistics: Array<{
    games: { appearences: number | null; minutes: number | null };
    fouls: { committed: number | null; drawn: number | null };
    tackles: { total: number | null };
    shots: { total: number | null; on: number | null };
    goals: { total: number | null; assists: number | null };
    cards: { yellow: number | null; red: number | null };
  }>;
}

interface EnrichedPlayer {
  id: number;
  name: string;
  mins: number;
  appearances: number;
  foulsPerGame: number;
  foulsWonPerGame: number;
  tacklesPerGame: number;
  shotsPerGame: number;
  sotPerGame: number;
  goals: number;
  assists: number;
  gaPerGame: number;
  yellowCards: number;
  last5Goals: number;
  last5Assists: number;
}

function enrichPlayer(apiStat: ApiPlayerStat): EnrichedPlayer | null {
  const stat = apiStat.statistics?.[0];
  if (!stat) return null;
  const appearances = stat.games?.appearences ?? 0;
  if (appearances === 0) return null;

  const totalMins = stat.games?.minutes ?? appearances * 90;
  const mins = Math.min(90, Math.round(totalMins / appearances));

  const foulsCommitted = stat.fouls?.committed ?? 0;
  const foulsDrawn = stat.fouls?.drawn ?? 0;
  const tackles = stat.tackles?.total ?? 0;
  const shots = stat.shots?.total ?? 0;
  const sot = stat.shots?.on ?? 0;
  const goals = stat.goals?.total ?? 0;
  const assists = stat.goals?.assists ?? 0;
  const yellowCards = stat.cards?.yellow ?? 0;

  return {
    id: apiStat.player.id,
    name: apiStat.player.name,
    mins,
    appearances,
    foulsPerGame: +(foulsCommitted / appearances).toFixed(2),
    foulsWonPerGame: +(foulsDrawn / appearances).toFixed(2),
    tacklesPerGame: +(tackles / appearances).toFixed(2),
    shotsPerGame: +(shots / appearances).toFixed(2),
    sotPerGame: +(sot / appearances).toFixed(2),
    goals,
    assists,
    gaPerGame: +((goals + assists) / appearances).toFixed(2),
    yellowCards,
    // last5 isn't in the season-stat endpoint — will be approximated
    last5Goals: estimateLast5(goals, appearances),
    last5Assists: estimateLast5(assists, appearances),
  };
}

/** Rough last-5 estimate: (total / appearances) * 5, rounded, capped at 5 */
function estimateLast5(total: number, appearances: number): number {
  if (appearances === 0) return 0;
  return Math.min(5, Math.round((total / appearances) * 5));
}

/**
 * Builds all four player arrays for a team.
 * @param lineup API lineup response array (players with player.id, player.name, startXI flag)
 * @param playerStatsMap Map of playerId → ApiPlayerStat
 * @param opposingPlayerNames Short names of all players from the other team (for potentialOpponent)
 */
export function buildPlayers(
  lineup: any,
  playerStatsMap: Map<number, ApiPlayerStat>,
  opposingPlayerNames: string[]
): TeamData['players'] {
  // Extract starting XI player IDs from lineup
  const startingPlayers: Array<{ id: number; name: string }> = [];
  const startXI: any[] = lineup?.startXI ?? [];
  for (const entry of startXI) {
    const p = entry?.player ?? entry;
    if (p?.id) startingPlayers.push({ id: p.id, name: p.name ?? '' });
  }

  // Enrich each starting player with stats
  const enriched: EnrichedPlayer[] = [];
  for (const { id, name } of startingPlayers) {
    const apiStat = playerStatsMap.get(id);
    if (apiStat) {
      const e = enrichPlayer(apiStat);
      if (e) enriched.push(e);
    } else {
      // No stats found — create a minimal placeholder
      enriched.push({
        id,
        name,
        mins: 75,
        appearances: 1,
        foulsPerGame: 0.5,
        foulsWonPerGame: 0.5,
        tacklesPerGame: 0.5,
        shotsPerGame: 0.5,
        sotPerGame: 0.2,
        goals: 0,
        assists: 0,
        gaPerGame: 0,
        yellowCards: 0,
        last5Goals: 0,
        last5Assists: 0,
      });
    }
  }

  /* ── Defensive (top 5 by foulsPerGame) ── */
  const topDefensive = [...enriched]
    .sort((a, b) => b.foulsPerGame - a.foulsPerGame)
    .slice(0, 5);

  // For potentialOpponent: pick top 1-2 opposing players by foulsWonPerGame
  // We receive opposingPlayerNames already sorted by foulsWon desc
  const oppDefStr = opposingPlayerNames.slice(0, 2).join(', ');

  const defensive: DefensivePlayer[] = topDefensive.map(p => ({
    name: p.name,
    mins: p.mins,
    foulsPerGame: p.foulsPerGame,
    tacklesPerGame: p.tacklesPerGame,
    last5Fouls: seededLast5(p.name, 'fouls', p.foulsPerGame, 1),
    yellowCards: p.yellowCards,
    potentialOpponent: oppDefStr || 'Unknown',
    form: formColor(p.last5Goals, p.last5Assists),
  }));

  /* ── Offensive (top 5 by foulsWonPerGame) ── */
  const topOffensive = [...enriched]
    .sort((a, b) => b.foulsWonPerGame - a.foulsWonPerGame)
    .slice(0, 5);

  // potentialOpponent for offensive: top 1-2 opposing by foulsPerGame
  const oppOffStr = opposingPlayerNames.slice(0, 2).join(', ');

  const offensive: OffensivePlayer[] = topOffensive.map(p => ({
    name: p.name,
    mins: p.mins,
    foulsWonPerGame: p.foulsWonPerGame,
    last5FoulsWon: seededLast5(p.name, 'foulsWon', p.foulsWonPerGame, 1),
    potentialOpponent: oppOffStr || 'Unknown',
    form: formColor(p.last5Goals, p.last5Assists),
  }));

  /* ── Shooting (top 5 by sotPerGame) ── */
  const topShooting = [...enriched]
    .sort((a, b) => b.sotPerGame - a.sotPerGame)
    .slice(0, 5);

  const shooting: ShootingPlayer[] = topShooting.map(p => ({
    name: p.name,
    mins: p.mins,
    sotPerGame: p.sotPerGame,
    last5SoT: seededLast5(p.name, 'sot', p.sotPerGame, 1),
    shotsPerGame: p.shotsPerGame,
    last5Shots: seededLast5(p.name, 'shots2', p.shotsPerGame, 2),
    badges: [],
    form: formColor(p.last5Goals, p.last5Assists),
  }));

  /* ── Goalscoring (top 5 by G+A per game) ── */
  const topGoalscoring = [...enriched]
    .sort((a, b) => b.gaPerGame - a.gaPerGame)
    .slice(0, 5);

  const goalscoring: GoalscoringPlayer[] = topGoalscoring.map(p => ({
    name: p.name,
    mins: p.mins,
    goals: p.goals,
    assists: p.assists,
    gaPerGame: p.gaPerGame,
    badges: [],
    last5Goals: seededLast5(p.name, 'goals', p.gaPerGame, 1),
    last5Assists: seededLast5(p.name, 'assists', p.assists / Math.max(p.goals + p.assists, 1) * p.gaPerGame, 1),
    form: formColor(p.last5Goals, p.last5Assists),
  }));

  return { defensive, offensive, shooting, goalscoring };
}
