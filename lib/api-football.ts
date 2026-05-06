/**
 * lib/api-football.ts
 * ─────────────────────
 * Scrapes confirmed lineups and per-player match history from ESPN's public API.
 */

const ESPN_LEAGUES = [
  'eng.1',               // Premier League
  'uefa.champions',      // Champions League
  'uefa.europa',         // Europa League
  'uefa.europa.conf',    // Conference League
  'eng.fa',              // FA Cup
  'eng.2',               // Championship
  'esp.1',               // La Liga
  'ger.1',               // Bundesliga
  'ita.1',               // Serie A
  'fra.1',               // Ligue 1
];

// Maps team name patterns to their domestic ESPN league slug
const DOMESTIC_LEAGUE_HINTS: [RegExp, string][] = [
  [/arsenal|chelsea|liverpool|manchester|tottenham|brighton|aston villa|west ham|newcastle|brentford|fulham|everton|wolves|wolverhampton|crystal palace|bournemouth|nottingham|ipswich|leicester|southampton|sunderland|burnley|leeds|luton|sheffield|coventry|middlesbrough|norwich|swansea|cardiff|millwall|hull|derby/i, 'eng.1'],
  [/atlético|atletico|real madrid|barcelona|sevilla|villarreal|betis|osasuna|girona|athletic bilbao|athletic club|valencia|celta|getafe|mallorca|levante|espanol|espanyol|oviedo|alaves|álaves|rayo vallecano|rayo|leganes|leganés|valladolid|granada|almeria|almería/i, 'esp.1'],
  [/psg|paris saint|paris fc|lyon|marseille|monaco|lille|nice|lens|rennes|nantes|strasbourg|toulouse|auxerre|brest|metz|lorient|angers|havre|le havre|reims|montpellier|troyes|clermont|ajaccio|guingamp/i, 'fra.1'],
  [/bayern|dortmund|leverkusen|leipzig|frankfurt|freiburg|union berlin|wolfsburg|stuttgart|gladbach|monchengladbach|hoffenheim|augsburg|hamburger|hamburgsv|hamburg sv|köln|koln|st pauli|pauli|heidenheim|mainz|werder|bremen|bochum|schalke|paderborn|sandhausen|dusseldorf|düsseldorf/i, 'ger.1'],
  [/juventus|inter milan|inter fc|ac milan|napoli|roma|lazio|fiorentina|atalanta|torino|bologna|genoa|udinese|venezia|lecce|verona|hellas|parma|sassuolo|cagliari|cremonese|pisa|monza|salernitana|empoli|spezia|brescia|bari/i, 'ita.1'],
];

export function guessDomesticLeague(teamName: string): string {
  for (const [re, league] of DOMESTIC_LEAGUE_HINTS) {
    if (re.test(teamName)) return league;
  }
  return '';
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

function norm(name: string) {
  return (name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function teamMatch(a: string, b: string) {
  const na = norm(a); const nb = norm(b);
  if (na === nb) return true;
  const wordsA = na.split(' ').filter(w => w.length > 3);
  const wordsB = nb.split(' ').filter(w => w.length > 3);
  return wordsA.some(w => nb.includes(w)) || wordsB.some(w => na.includes(w));
}

async function espnFetch(url: string) {
  await new Promise(r => setTimeout(r, 300));
  // Add cache-bust to bypass ESPN CDN caching on Vercel's shared IPs
  const sep = url.includes('?') ? '&' : '?';
  const bustUrl = `${url}${sep}_cb=${Date.now()}`;
  const res = await fetch(bustUrl, { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status} for ${url}`);
  return res.json();
}

function transformRoster(roster: any[]): { lineup: any[]; startingEleven: any[] } {
  const starters = roster
    .filter(p => p.starter)
    .map(p => ({
      name:           p.athlete?.displayName ?? p.athlete?.fullName ?? 'Unknown',
      espnId:         p.athlete?.id != null ? String(p.athlete.id) : '',
      position:       p.position?.displayName ?? p.athlete?.position?.displayName ?? 'Midfielder',
      posAbbr:        (p.position?.abbreviation ?? '').toUpperCase(),
      formationPlace: parseInt(p.formationPlace) || 0,
    }));
  return { lineup: starters, startingEleven: starters };
}

// ── Per-player stat extraction from an event summary ─────────────��────────
export interface PlayerGameStat {
  fc: number;       // fouls committed
  fd: number;       // fouls drawn/suffered
  goals: number;
  assists: number;
  shots: number;
  sot: number;      // shots on target
  yellowCards: number;
}

function statIdx(names: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const i = names.findIndex(n => n.toLowerCase() === c.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function extractEventStats(summary: any): { stats: Map<string, PlayerGameStat>; debug: string } {
  const map = new Map<string, PlayerGameStat>();

  // Try rosters section — completed ESPN soccer summaries store per-player stats here
  const rosters: any[] = summary?.rosters ?? [];
  let rosterPlayers = 0;
  let sampleStatNames = '';

  for (const team of rosters) {
    for (const p of team?.roster ?? []) {
      rosterPlayers++;
      const id = p.athlete?.id != null ? String(p.athlete.id) : null;
      if (!id) continue;

      const rawStats: any[] = p.stats ?? p.statistics ?? [];
      if (!rawStats.length) continue;

      if (!sampleStatNames) {
        sampleStatNames = rawStats.map((s: any) => s.name ?? s.abbreviation ?? '?').join(',');
      }

      const getStat = (...names: string[]) => {
        for (const name of names) {
          const s = rawStats.find((s: any) =>
            (s.name ?? s.abbreviation ?? s.shortName ?? '').toLowerCase() === name.toLowerCase()
          );
          if (s != null) return parseInt(s.value ?? s.displayValue ?? '0') || 0;
        }
        return 0;
      };

      map.set(id, {
        fc:          getStat('foulscommitted', 'fc', 'fouls committed', 'fouls', 'foulscom'),
        fd:          getStat('foulssuffered', 'foulsdrawn', 'fd', 'fouls drawn', 'foulswon', 'foulswonfree', 'foulsdrawn'),
        goals:       getStat('totalgoals', 'goals', 'g', 'goalscored', 'goal', 'goalsscored', 'gls', 'goaltotal', 'goalsTotal'),
        assists:     getStat('goalassists', 'assists', 'a', 'keyassists', 'ast', 'assist', 'assiststotal', 'goalassist'),
        shots:       getStat('totalshots', 'shots', 'sh', 'shotattempts', 'attemptedshots', 'totalattempts', 'totalShots', 'shotstotal'),
        sot:         getStat('shotsontarget', 'sot', 'shotsongoal', 'shotongoal', 'ontargetattempts', 'ongoalattempts', 'sog', 'targetshots', 'shotsOnTarget'),
        yellowCards: getStat('yellowcards', 'yellowcard', 'yc', 'yellow', 'booking'),
      });
    }
  }

  return {
    stats: map,
    debug: `rosters:${rosters.length} players:${rosterPlayers} mapped:${map.size} sample:[${sampleStatNames}]`,
  };
}

// ── Fetch last N completed event IDs for a team across multiple leagues ───
async function fetchTeamRecentEventIds(teamId: string, leagues: string[], n = 12): Promise<{ ids: string[]; leagueForId: Map<string, string>; debug: string }> {
  if (!teamId) return { ids: [], leagueForId: new Map(), debug: 'no teamId' };
  const allEvents: Array<{ id: string; date: string; league: string }> = [];
  const foundLeagues: string[] = [];

  for (const lg of leagues) {
    try {
      const data = await espnFetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/teams/${teamId}/schedule`
      );
      const events: any[] = data?.events ?? [];
      const completed = events.filter(e => {
        const st = e.competitions?.[0]?.status?.type ?? e.status?.type ?? {};
        return st.completed === true || (st.name ?? '').includes('FINAL');
      });
      if (completed.length > 0) {
        foundLeagues.push(lg);
        completed.forEach(e => allEvents.push({ id: e.id, date: e.date ?? '', league: lg }));
      }
    } catch {}
  }

  // Deduplicate by event ID, sort most-recent first, cap at n
  const unique = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
  const sorted = unique
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, n);
  const ids = sorted.map(e => e.id);
  const leagueForId = new Map(sorted.map(e => [e.id, e.league]));

  return { ids, leagueForId, debug: `${ids.length} events from [${foundLeagues.join(',')}]` };
}

export interface TeamSeasonStats {
  goalsFor: number;
  goalsAgainst: number;
  cornersFor: number;
  cornersAgainst: number;
  shotsFor: number;
  shotsAgainst: number;
  sotFor: number;
  sotAgainst: number;
  foulsCommitted: number;
  foulsWon: number;
  cardsFor: number;
  cardsAgainst: number;
  gamesCount: number;
}

// Normalize an ESPN stat name to a lookup key (lowercase, alphanumeric only).
// "Corner Kicks" → "cornerkicks", "Shots on Target" → "shotsontarget", etc.
function normKey(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractBoxscoreTeamStats(summary: any, teamId: string): { mine: Record<string, number>; opp: Record<string, number> } | null {
  const teams: any[] = summary?.boxscore?.teams ?? [];
  if (teams.length < 2) return null;

  function parseTeam(t: any): Record<string, number> {
    const out: Record<string, number> = {};
    for (const s of (t?.statistics ?? [])) {
      const raw = s.displayValue ?? String(s.value ?? 0);
      const val = parseFloat(raw.replace(/[%,]/g, '')) || 0;
      // Store under normalized key so camelCase/space/dash variants all match
      const key = normKey(s.name ?? s.abbreviation ?? '');
      if (key) out[key] = val;
    }
    return out;
  }

  const teamA = teams.find((t: any) => t.team?.id === teamId || t.team?.id === String(teamId));
  const teamB = teams.find((t: any) => t.team?.id !== teamId && t.team?.id !== String(teamId));
  if (!teamA || !teamB) {
    return { mine: parseTeam(teams[0]), opp: parseTeam(teams[1]) };
  }
  return { mine: parseTeam(teamA), opp: parseTeam(teamB) };
}

// ── ESPN team season statistics endpoint ──────────────────────────────────
// Returns a map of normalized stat keys → values (per-game averages when available).
// Tries the /teams/{id}/statistics endpoint which gives season totals or averages directly.
async function fetchEspnTeamSeasonStats(teamId: string, league: string): Promise<Record<string, number>> {
  try {
    const data = await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}/statistics`
    );
    const out: Record<string, number> = {};
    // ESPN splits structure varies — try common response shapes
    const cats: any[] =
      data?.splits?.categories ??
      data?.statistics?.splits?.categories ??
      [];
    const allStats: any[] = cats.length > 0
      ? cats.flatMap((c: any) => c.stats ?? [])
      : (data?.statistics ?? data?.stats ?? []);
    for (const s of allStats) {
      const raw = s.displayValue ?? String(s.value ?? '0');
      const val = parseFloat(raw.replace(/[%,]/g, '')) || 0;
      const key = normKey(s.name ?? s.abbreviation ?? '');
      if (key && val > 0) out[key] = val;
    }
    return out;
  } catch { return {}; }
}

// ── Fetch per-player game history for a team across all competitions ───────
// Returns { history, debug } — history is Map<espnAthleteId, PlayerGameStat[]> newest first
export async function fetchTeamPlayerHistory(
  teamId: string,
  primaryLeague: string,
  teamName: string = '',
): Promise<{ history: Map<string, PlayerGameStat[]>; seasonStats: TeamSeasonStats | null; debug: string }> {
  const result = new Map<string, PlayerGameStat[]>();
  // Always fetch from primary league + domestic league so stats cover all competitions
  const leaguesToFetch = [primaryLeague];
  const domestic = guessDomesticLeague(teamName);
  if (domestic && domestic !== primaryLeague) leaguesToFetch.push(domestic);

  const { ids: eventIds, leagueForId, debug: scheduleDebug } = await fetchTeamRecentEventIds(teamId, leaguesToFetch);
  const eventDebugs: string[] = [];

  const teamStatSamples: Array<{ mine: Record<string, number>; opp: Record<string, number> }> = [];

  for (const eventId of eventIds) {
    try {
      const evLeague = leagueForId.get(eventId) ?? primaryLeague;
      const summary = await espnFetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${evLeague}/summary?event=${eventId}`
      );
      const { stats, debug: eDebug } = extractEventStats(summary);
      eventDebugs.push(`evt${eventId}:${eDebug}`);
      for (const [athleteId, stat] of Array.from(stats)) {
        if (!result.has(athleteId)) result.set(athleteId, []);
        result.get(athleteId)!.push(stat);
      }
      const teamBox = extractBoxscoreTeamStats(summary, teamId);
      if (teamBox) teamStatSamples.push(teamBox);
    } catch (err: any) {
      eventDebugs.push(`evt${eventId}:error(${err.message})`);
    }
  }

  // Try ESPN team statistics endpoint — gives season averages directly, no boxscore needed
  const endpointStats = await fetchEspnTeamSeasonStats(teamId, primaryLeague);
  if (domestic && domestic !== primaryLeague) {
    // Merge domestic stats for fields not yet populated by primary league endpoint
    const domStats = await fetchEspnTeamSeasonStats(teamId, domestic);
    for (const [k, v] of Object.entries(domStats)) {
      if (!endpointStats[k] && v > 0) endpointStats[k] = v;
    }
  }

  let seasonStats: TeamSeasonStats | null = null;
  const n = teamStatSamples.length;

  // Pick best value: ESPN season endpoint first, then boxscore per-game average
  function getBestStat(side: 'mine' | 'opp', ...aliases: string[]): number {
    const normAliases = aliases.map(normKey);
    // 1. Try endpoint stats (season averages)
    for (const k of normAliases) {
      const v = endpointStats[k];
      if (v != null && v > 0) return +v.toFixed(2);
    }
    // 2. Try per-game average from boxscore samples
    if (n > 0) {
      for (const k of normAliases) {
        const sum = teamStatSamples.reduce((s, g) => s + (g[side][k] ?? 0), 0);
        if (sum > 0) return +(sum / n).toFixed(2);
      }
    }
    return 0;
  }

  if (n > 0 || Object.keys(endpointStats).length > 0) {
    seasonStats = {
      goalsFor:       0,
      goalsAgainst:   0,
      // ESPN boxscore: "Corner Kicks" → cornerkicks; endpoint may use "avgCornerKicks" → avgcornerkicks
      cornersFor:     getBestStat('mine', 'cornerkicks', 'Corner Kicks', 'corners', 'avgcornerkicks', 'woncorners', 'totalcorners'),
      cornersAgainst: getBestStat('opp',  'cornerkicks', 'Corner Kicks', 'corners', 'avgcornerkicks', 'woncorners', 'totalcorners'),
      // ESPN boxscore: "Shots" → shots; endpoint may use "avgShots"
      shotsFor:       getBestStat('mine', 'shots', 'Shots', 'totalshots', 'avgshots', 'shotattempts'),
      shotsAgainst:   getBestStat('opp',  'shots', 'Shots', 'totalshots', 'avgshots', 'shotattempts'),
      // ESPN boxscore: "Shots on Target" or "Shots on Goal" → shotsontarget / shotsongoal
      sotFor:         getBestStat('mine', 'shotsontarget', 'Shots on Target', 'shotsongoal', 'Shots on Goal', 'avgshotsontarget', 'ontarget', 'sog'),
      sotAgainst:     getBestStat('opp',  'shotsontarget', 'Shots on Target', 'shotsongoal', 'Shots on Goal', 'avgshotsontarget', 'ontarget', 'sog'),
      // ESPN boxscore: "Fouls" → fouls; "Fouls Committed" → foulscommitted
      foulsCommitted: getBestStat('mine', 'fouls', 'Fouls', 'foulscommitted', 'Fouls Committed', 'avgfouls', 'totalfouls'),
      foulsWon:       getBestStat('opp',  'fouls', 'Fouls', 'foulscommitted', 'Fouls Committed', 'avgfouls', 'totalfouls'),
      // ESPN boxscore: "Yellow Cards" → yellowcards
      cardsFor:       getBestStat('mine', 'yellowcards', 'Yellow Cards', 'avgyellowcards', 'bookings', 'cards'),
      cardsAgainst:   getBestStat('opp',  'yellowcards', 'Yellow Cards', 'avgyellowcards', 'bookings', 'cards'),
      gamesCount:     n,
    };

    // Goals from player stats summed per game
    const myGoalsPerGame = result.size > 0
      ? Array.from(result.values()).reduce((sum, games) => {
          games.forEach((g, i) => { if (!sum[i]) sum[i] = 0; sum[i] += g.goals; });
          return sum;
        }, [] as number[])
      : [];
    seasonStats.goalsFor = myGoalsPerGame.length
      ? +(myGoalsPerGame.reduce((a, b) => a + b, 0) / myGoalsPerGame.length).toFixed(2)
      : 0;

    // goalsAgainst approximated from opponent shots
    seasonStats.goalsAgainst = +(getBestStat('opp', 'shots', 'Shots', 'totalshots') * 0.12).toFixed(2);
  }

  return {
    history: result,
    seasonStats,
    debug: `team ${teamId}: ${scheduleDebug} | ${result.size} players | ${teamStatSamples.length} team-stat games | ${eventDebugs.slice(0, 1).join(' ')}`,
  };
}

// ── Main lineup fetch ──────────────────────────────────────────────────────
export async function getApiFootballLineups(
  homeTeamName: string,
  awayTeamName: string,
  utcDate: string,
): Promise<{
  lineups: { homeTeam: any; awayTeam: any } | null;
  debug: string;
  espnMeta: { league: string; homeTeamId: string; awayTeamId: string } | null;
}> {
  try {
    const date = utcDate.slice(0, 10).replace(/-/g, '');

    for (const league of ESPN_LEAGUES) {
      let scoreboard: any;
      try {
        scoreboard = await espnFetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}`
        );
      } catch { continue; }

      const events: any[] = scoreboard?.events ?? [];
      const event = events.find(e => {
        const comp = e.competitions?.[0];
        const home = comp?.competitors?.find((t: any) => t.homeAway === 'home')?.team?.displayName ?? '';
        const away = comp?.competitors?.find((t: any) => t.homeAway === 'away')?.team?.displayName ?? '';
        return teamMatch(home, homeTeamName) && teamMatch(away, awayTeamName);
      });

      if (!event) continue;

      let summary: any;
      try {
        summary = await espnFetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${event.id}`
        );
      } catch { continue; }

      const rosters: any[] = summary?.rosters ?? [];
      if (!rosters.length) {
        return { lineups: null, debug: `ESPN found event ${event.id} but no rosters yet`, espnMeta: null };
      }

      const homeRoster = rosters.find(r => r.homeAway === 'home');
      const awayRoster = rosters.find(r => r.homeAway === 'away');
      if (!homeRoster || !awayRoster) {
        return { lineups: null, debug: `ESPN rosters incomplete for event ${event.id}`, espnMeta: null };
      }

      const homeStarters = (homeRoster.roster ?? []).filter((p: any) => p.starter);
      const awayStarters = (awayRoster.roster ?? []).filter((p: any) => p.starter);

      if (!homeStarters.length || !awayStarters.length) {
        const sampleRoster = rosters[0];
        const rosterLen = (sampleRoster?.roster ?? []).length;
        const samplePlayer = sampleRoster?.roster?.[0];
        const starterVal = samplePlayer ? String(samplePlayer.starter) : 'n/a';
        return { lineups: null, debug: `ESPN event ${event.id}: ${rosters.length} teams, rosterLen=${rosterLen}, starterVal=${starterVal}, homeStarters=${homeStarters.length}, awayStarters=${awayStarters.length}`, espnMeta: null };
      }

      const comp = event.competitions?.[0];
      const homeTeamId = comp?.competitors?.find((t: any) => t.homeAway === 'home')?.team?.id ?? homeRoster.team?.id ?? '';
      const awayTeamId = comp?.competitors?.find((t: any) => t.homeAway === 'away')?.team?.id ?? awayRoster.team?.id ?? '';

      return {
        lineups: {
          homeTeam: transformRoster(homeRoster.roster ?? []),
          awayTeam: transformRoster(awayRoster.roster ?? []),
        },
        debug: `ESPN confirmed lineups: ${homeStarters.length} home / ${awayStarters.length} away starters (teamIds: ${homeTeamId}/${awayTeamId})`,
        espnMeta: { league, homeTeamId, awayTeamId },
      };
    }

    return { lineups: null, debug: `No ESPN event found for "${homeTeamName}" vs "${awayTeamName}"`, espnMeta: null };
  } catch (e: any) {
    return { lineups: null, debug: `ESPN error: ${e.message}`, espnMeta: null };
  }
}

// ── First-leg aggregate finder (ESPN scoreboard scan) ─────────────────────
// Scans ESPN scoreboard for the days before a second leg to find the first leg score.
// Returns from the second-leg's perspective: home/away = current match's home/away.
export async function findEspnFirstLeg(
  league: string,
  homeTeamId: string,
  awayTeamId: string,
  currentUtcDate: string,
): Promise<{ home: number; away: number } | null> {
  const currentDate = new Date(currentUtcDate);
  const hId = String(homeTeamId);
  const aId = String(awayTeamId);
  // Two-legged knockout ties are typically 7–21 days apart; scan that window
  for (let daysBack = 5; daysBack <= 21; daysBack++) {
    const checkDate = new Date(currentDate.getTime() - daysBack * 86_400_000);
    const ds = `${checkDate.getFullYear()}${String(checkDate.getMonth() + 1).padStart(2, '0')}${String(checkDate.getDate()).padStart(2, '0')}`;
    try {
      const board = await espnFetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${ds}`
      );
      for (const ev of (board?.events ?? [])) {
        const comp = ev.competitions?.[0];
        if (!comp?.status?.type?.completed) continue;
        const homeComp = comp?.competitors?.find((c: any) => c.homeAway === 'home');
        const awayComp = comp?.competitors?.find((c: any) => c.homeAway === 'away');
        if (!homeComp || !awayComp) continue;
        const evHId = String(homeComp.team?.id ?? '');
        const evAId = String(awayComp.team?.id ?? '');
        // Same two teams, either orientation, different game (not the match itself)
        const sameTeams = (evHId === hId || evHId === aId) && (evAId === hId || evAId === aId) && evHId !== evAId;
        if (!sameTeams) continue;
        const hScore = parseInt(homeComp.score ?? '0') || 0;
        const aScore = parseInt(awayComp.score ?? '0') || 0;
        // Translate to current match's perspective (hId is home in the second leg)
        return evHId === hId ? { home: hScore, away: aScore } : { home: aScore, away: hScore };
      }
    } catch {}
  }
  return null;
}

// ── API-Football fixture player stats (real last-5 game data) ────────────
const AF_BASE = 'https://v3.football.api-sports.io';

async function afFetch(path: string, apiKey: string): Promise<any> {
  await new Promise(r => setTimeout(r, 250));
  const res = await fetch(`${AF_BASE}${path}`, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`AF ${res.status}: ${path}`);
  return res.json();
}

function cleanForSearch(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(FC|CF|SC|RFC|RC|GFC|AFC|BFC|SSC|AC|AS|RB|VfB|VfL|TSV|SV|FSV|Borussia|Club|del|de|des|du|der|van|den|het)\b\.?/gi, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .split(' ').filter(w => w.length >= 2).slice(0, 3).join(' ');
}

function guessDomesticLeagueId(teamName: string): number {
  const league = guessDomesticLeague(teamName);
  const map: Record<string, number> = {
    'eng.1': 39, 'esp.1': 140, 'ger.1': 78, 'ita.1': 135, 'fra.1': 61,
  };
  return map[league] ?? 0;
}

export async function fetchApiFootballTeamHistory(
  teamName: string,
  apiKey: string,
): Promise<{ history: Map<string, PlayerGameStat[]>; debug: string }> {
  if (!apiKey) return { history: new Map(), debug: 'no key' };
  const result = new Map<string, PlayerGameStat[]>();
  try {
    const searchName = cleanForSearch(teamName);
    const leagueId = guessDomesticLeagueId(teamName);
    const leagueParam = leagueId ? `&league=${leagueId}` : '';
    // Note: no season= in /teams search — it conflicts with the search param and blocks results
    const td = await afFetch(
      `/teams?search=${encodeURIComponent(searchName)}${leagueParam}`,
      apiKey,
    );
    const teams: any[] = td?.response ?? [];
    if (!teams.length && leagueParam) {
      // Retry without league filter
      const td2 = await afFetch(`/teams?search=${encodeURIComponent(searchName)}`, apiKey);
      teams.push(...(td2?.response ?? []));
    }
    if (!teams.length) {
      // Last resort: search by first keyword only
      const firstWord = searchName.split(' ').find(w => w.length >= 5) ?? searchName.split(' ')[0];
      const td3 = await afFetch(`/teams?search=${encodeURIComponent(firstWord)}${leagueParam}`, apiKey);
      teams.push(...(td3?.response ?? []));
    }
    if (!teams.length) return { history: new Map(), debug: `no team: ${searchName}` };

    const tNorm = norm(teamName);
    const best = teams.find(t => {
      const n = norm(t.team?.name ?? '');
      return n === tNorm || tNorm.split(' ').filter(w => w.length > 3).some(w => n.includes(w));
    }) ?? teams[0];
    const teamId: number = best?.team?.id;
    if (!teamId) return { history: new Map(), debug: `no id: ${searchName}` };

    let fd = await afFetch(`/fixtures?team=${teamId}&last=5&season=2025`, apiKey);
    let fixtures: any[] = fd?.response ?? [];
    if (!fixtures.length) {
      // Fallback to 2024 season (covers summer-start leagues like MLS, Brasileirão, J-League)
      fd = await afFetch(`/fixtures?team=${teamId}&last=5&season=2024`, apiKey);
      fixtures = fd?.response ?? [];
    }
    if (!fixtures.length) return { history: new Map(), debug: `no fixtures: ${teamId}` };

    const sorted = [...fixtures].sort((a: any, b: any) =>
      new Date(b.fixture?.date ?? '').getTime() - new Date(a.fixture?.date ?? '').getTime()
    );

    for (const fix of sorted) {
      const fid: number = fix.fixture?.id;
      if (!fid) continue;
      const pd = await afFetch(`/fixtures/players?fixture=${fid}&team=${teamId}`, apiKey);
      const teamStats = pd?.response?.[0];
      if (!teamStats?.players) continue;
      for (const p of (teamStats.players as any[])) {
        const pName: string = p.player?.name ?? '';
        if (!pName) continue;
        const s = p.statistics?.[0];
        if (!s) continue;
        const stat: PlayerGameStat = {
          goals:       s.goals?.total     ?? 0,
          assists:     s.goals?.assists   ?? 0,
          shots:       s.shots?.total     ?? 0,
          sot:         s.shots?.on        ?? 0,
          fc:          s.fouls?.committed ?? 0,
          fd:          s.fouls?.drawn     ?? 0,
          yellowCards: s.cards?.yellow    ?? 0,
        };
        const key = norm(pName);
        if (!result.has(key)) result.set(key, []);
        result.get(key)!.push(stat); // newest first
      }
    }

    return {
      history: result,
      debug: `team ${teamId}(${best?.team?.name}): ${sorted.length} fixtures, ${result.size} players`,
    };
  } catch (e: any) {
    return { history: new Map(), debug: `err: ${e.message}` };
  }
}

// ── ESPN domestic roster stats (season totals for one league) ─────────────
export interface EspnRosterPlayer {
  id: string;
  name: string;
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  foulsCommitted: number;
  foulsSuffered: number;
  shotsOnTarget: number;
  totalShots: number;
}

export async function fetchEspnRosterStats(
  teamId: string,
  leagueSlug: string,
): Promise<Map<string, EspnRosterPlayer>> {
  const result = new Map<string, EspnRosterPlayer>();
  if (!teamId || !leagueSlug) return result;
  try {
    const data = await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/teams/${teamId}/roster`
    );
    const athletes: any[] = data.athletes ?? [];
    for (const a of athletes) {
      const cats: any[] = a.statistics?.splits?.categories ?? [];
      const gen = cats.find((c: any) => c.name === 'general');
      const off = cats.find((c: any) => c.name === 'offensive');
      const getStat = (cat: any, name: string): number =>
        cat?.stats?.find((s: any) => s.name === name)?.value ?? 0;

      const appearances = getStat(gen, 'appearances');
      if (!appearances) continue;

      const player: EspnRosterPlayer = {
        id:             String(a.id ?? ''),
        name:           a.displayName ?? '',
        appearances,
        goals:          getStat(off, 'totalGoals'),
        assists:        getStat(off, 'goalAssists'),
        yellowCards:    getStat(gen, 'yellowCards'),
        redCards:       getStat(gen, 'redCards'),
        foulsCommitted: getStat(gen, 'foulsCommitted'),
        foulsSuffered:  getStat(gen, 'foulsSuffered'),
        shotsOnTarget:  getStat(off, 'shotsOnTarget'),
        totalShots:     getStat(off, 'totalShots'),
      };
      result.set(norm(player.name), player);
    }
  } catch (err: any) {
    console.warn(`[roster] ESPN ${leagueSlug} team ${teamId}: ${err.message}`);
  }
  return result;
}
