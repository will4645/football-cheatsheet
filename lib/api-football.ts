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
  'por.1',               // Primeira Liga
  'ned.1',               // Eredivisie
  'bel.1',               // Belgian Pro League
  'sco.1',               // Scottish Premiership
  'tur.1',               // Süper Lig
];

// Maps team name patterns to their domestic ESPN league slug
const DOMESTIC_LEAGUE_HINTS: [RegExp, string][] = [
  // Championship teams first — prevents them matching the eng.1 pattern below
  [/sunderland|burnley|leeds|luton|sheffield united|coventry|middlesbrough|norwich|swansea|cardiff|millwall|hull|derby|watford|stoke|qpr|queens park|preston|blackburn|bristol city|plymouth|oxford|portsmouth|sheff wed|sheffield wednesday|wba|west brom|barnsley|birmingham|rotherham|peterborough|reading|wigan|ipswich town/i, 'eng.2'],
  [/arsenal|chelsea|liverpool|manchester|tottenham|brighton|aston villa|west ham|newcastle|brentford|fulham|everton|wolves|wolverhampton|crystal palace|bournemouth|nottingham|ipswich|leicester|southampton/i, 'eng.1'],
  [/atlético|atletico|real madrid|barcelona|sevilla|villarreal|betis|osasuna|girona|athletic bilbao|athletic club|valencia|celta|getafe|mallorca|levante|espanol|espanyol|oviedo|alaves|álaves|rayo vallecano|rayo|leganes|leganés|valladolid|granada|almeria|almería/i, 'esp.1'],
  [/psg|paris saint|paris fc|lyon|marseille|monaco|lille|nice|lens|rennes|nantes|strasbourg|toulouse|auxerre|brest|metz|lorient|angers|havre|le havre|reims|montpellier|troyes|clermont|ajaccio|guingamp/i, 'fra.1'],
  [/bayern|dortmund|leverkusen|leipzig|frankfurt|freiburg|union berlin|wolfsburg|stuttgart|gladbach|monchengladbach|hoffenheim|augsburg|hamburger|hamburgsv|hamburg sv|köln|koln|st pauli|pauli|heidenheim|mainz|werder|bremen|bochum|schalke|paderborn|sandhausen|dusseldorf|düsseldorf/i, 'ger.1'],
  [/juventus|inter milan|inter fc|ac milan|napoli|roma|lazio|fiorentina|atalanta|torino|bologna|genoa|udinese|venezia|lecce|verona|hellas|parma|sassuolo|cagliari|cremonese|pisa|monza|salernitana|empoli|spezia|brescia|bari/i, 'ita.1'],
  [/benfica|porto|sporting cp|sporting lisbon|braga|sc braga|vitoria guimaraes|guimaraes|boavista|estoril|pacos ferreira|arouca|rio ave|famalicao|chaves|vizela|casa pia|gil vicente|moreirense/i, 'por.1'],
  [/ajax|psv|feyenoord|az alkmaar|alkmaar|fc utrecht|twente|enschede|groningen|heerenveen|sparta rotterdam|heracles|almelo|nec nijmegen|excelsior|go ahead eagles|deventer|rkc waalwijk|cambuur|fortuna sittard|volendam/i, 'ned.1'],
  [/club brugge|anderlecht|gent|standard liege|royal antwerp|sint truiden|mechelen|kortrijk|westerlo|oud heverlee leuven|cercle brugge|charleroi|eupen|genk|union sg|union saint gilloise|mouscron|beerschot/i, 'bel.1'],
  [/celtic|rangers|hearts|hibernian|aberdeen|motherwell|livingston|st mirren|st johnstone|dundee|ross county|kilmarnock|inverness|hamilton/i, 'sco.1'],
  [/falkirk|dunfermline|partick thistle|partick|airdrie|cove rangers|raith rovers|inverness ct|queen of the south|arbroath|ayr united|greenock morton|morton|dumbarton|alloa/i, 'sco.2'],
  [/galatasaray|fenerbahce|fenerbahçe|besiktas|beşiktaş|trabzonspor|alanyaspor|sivasspor|kasimpasa|kasımpaşa|adana demirspor|ankaragucu|ankaragücü|konyaspor|kayserispor|gaziantep|istanbulspor|hatayspor/i, 'tur.1'],
  [/malmo|malmö|djurgarden|djurgården|hammarby|ifk göteborg|ifk goteborg|aik|kalmar|elfsborg|hacken|häcken|halmstad|mjallby|varberg|degerfors|sirius|osters|brage|brommapojkarna|helsingborg|norrkoping|norrköping|gif sundsvall|ostersund|östers/i, 'swe.1'],
  [/fc copenhagen|kobenhavn|københavn|midtjylland|brondby|brøndby|aab aalborg|randers|agf aarhus|silkeborg|odense|sonderjyske|sønderjyske|vejle|hvidovre|lyngby|nordsjælland|nordsjaelland/i, 'den.1'],
  [/bodo glimt|bodø|molde|rosenborg|viking|lillestrøm|lillestrom|brann|valerenga|vålerenga|stabæk|stabak|haugesund|tromso|tromsø|sarpsborg|odd|kristiansund|aalesund|ålesund/i, 'nor.1'],
  [/red bull salzburg|fc salzburg|sturm graz|rapid wien|rapid vienna|austria wien|lask|wolfsberger|wolfsberg|ried|hartberg|klagenfurt|altach|blau weiss linz/i, 'aut.1'],
  [/young boys|fc basel|servette|lugano|grasshopper|fc zürich|fc zurich|st gallen|fc sion|winterthur|lausanne sport|thun|aarau/i, 'sui.1'],
  [/olympiacos|paok|aek athens|panathinaikos|asteras tripolis|aris thessaloniki|atromitos|ergotelis|ofi crete|panionios|panserraikos|pas giannina/i, 'gre.1'],
  [/legia warsaw|legia|lech poznan|wisla krakow|wisła|piast gliwice|slask wroclaw|śląsk|jagiellonia|cracovia|zaglebie lubin|zagłębie|rakow czestochowa|raków|gornik zabrze/i, 'pol.1'],
  [/dinamo zagreb|hajduk split|rijeka|osijek|gorica|varazdin|lokomotiva zagreb|sibenik|istra|šibenik/i, 'cro.1'],
  [/red star belgrade|crvena zvezda|partizan|vojvodina|radnicki nis|cukaricki|čukarički|backa topola|bačka|spartak subotica/i, 'srb.1'],
  [/shakhtar donetsk|shakhtar|dynamo kyiv|vorskla|zorya|dnipro|chornomorets|rukh lviv|metalist|desna/i, 'ukr.1'],
  [/fcsb|cfr cluj|universitatea craiova|rapid bucharest|dinamo bucharest|sepsi|hermannstadt|astra giurgiu|poli iasi|fc arges|voluntari|chindia/i, 'rou.1'],
  [/slavia prague|sparta prague|viktoria plzen|plzeň|plzen|banik ostrava|bohemians|slovacko|slovácko|jablonec|sigma olomouc|brno|zbrojovka|teplice|karvina|karviná|hradec kralove/i, 'cze.1'],
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
  saves: number;
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
        saves:       getStat('saves', 'gksaves', 'savesmade', 'goalkeepersaves', 'gkSaves', 'savesTotal'),
      });
    }
  }

  return {
    stats: map,
    debug: `rosters:${rosters.length} players:${rosterPlayers} mapped:${map.size} sample:[${sampleStatNames}]`,
  };
}

// ── Fetch last N completed event IDs for a team across multiple leagues ───
async function fetchTeamRecentEventIds(teamId: string, leagues: string[], n = 12): Promise<{
  ids: string[];
  leagueForId: Map<string, string>;
  espnGoals: { goalsFor: number; goalsAgainst: number; count: number } | null;
  debug: string;
}> {
  if (!teamId) return { ids: [], leagueForId: new Map(), espnGoals: null, debug: 'no teamId' };
  const allEvents: Array<{ id: string; date: string; league: string; gf: number; ga: number }> = [];
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
        completed.forEach(e => {
          const competitors: any[] = e.competitions?.[0]?.competitors ?? [];
          const mine = competitors.find((c: any) => String(c.team?.id) === String(teamId));
          const opp  = competitors.find((c: any) => String(c.team?.id) !== String(teamId) && c.team?.id);
          // Only treat score as 0 when the field is explicitly set; missing/empty → -1 (excluded from avg)
          const gf = (mine && mine.score != null && mine.score !== '') ? (parseInt(mine.score) || 0) : -1;
          const ga = (opp  && opp.score  != null && opp.score  !== '') ? (parseInt(opp.score)  || 0) : -1;
          allEvents.push({ id: e.id, date: e.date ?? '', league: lg, gf, ga });
        });
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

  const scored = sorted.filter(e => e.gf >= 0 && e.ga >= 0);
  const espnGoals = scored.length >= 3
    ? {
        goalsFor:     +(scored.reduce((s, e) => s + e.gf, 0) / scored.length).toFixed(2),
        goalsAgainst: +(scored.reduce((s, e) => s + e.ga, 0) / scored.length).toFixed(2),
        count: scored.length,
      }
    : null;

  return { ids, leagueForId, espnGoals, debug: `${ids.length} events from [${foundLeagues.join(',')}]${espnGoals ? ` goals:${espnGoals.count}g(${espnGoals.goalsFor}F/${espnGoals.goalsAgainst}A)` : ''}` };
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
  offsidesFor: number;
  offsidesAgainst: number;
  freeKicksFor: number;
  freeKicksAgainst: number;
  savesFor: number;
  savesAgainst: number;
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

  const { ids: eventIds, leagueForId, espnGoals, debug: scheduleDebug } = await fetchTeamRecentEventIds(teamId, leaguesToFetch);
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

  // Pick best value: ESPN season endpoint first (own stats only), then boxscore per-game average.
  // The endpoint gives this team's OWN season totals, so it is only valid for the 'mine' side.
  // For 'opp' (defensive/against stats), skip the endpoint and use boxscore opponent-side data.
  function getBestStat(side: 'mine' | 'opp', ...aliases: string[]): number {
    const normAliases = aliases.map(normKey);
    // 1. Endpoint stats — valid for 'mine' only (endpoint doesn't expose opponent stats)
    if (side === 'mine') {
      for (const k of normAliases) {
        const v = endpointStats[k];
        if (v != null && v > 0) return +v.toFixed(2);
      }
    }
    // 2. Per-game average from boxscore samples (both teams present in each event summary)
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
      offsidesFor:    getBestStat('mine', 'offsides', 'Offsides', 'offside', 'offsidescommitted', 'avgoffsides'),
      offsidesAgainst:getBestStat('opp',  'offsides', 'Offsides', 'offside', 'offsidescommitted', 'avgoffsides'),
      freeKicksFor:   getBestStat('mine', 'freekicks', 'Free Kicks', 'freekick', 'freekickswon') || getBestStat('opp', 'fouls', 'Fouls', 'foulscommitted'),
      freeKicksAgainst:getBestStat('opp', 'freekicks', 'Free Kicks', 'freekick', 'freekickswon') || getBestStat('mine', 'fouls', 'Fouls', 'foulscommitted'),
      savesFor:       getBestStat('mine', 'saves', 'Saves', 'goalkeepertotalsaves', 'avgsaves'),
      savesAgainst:   getBestStat('opp',  'saves', 'Saves', 'goalkeepertotalsaves', 'avgsaves'),
      gamesCount:     n,
    };

    // Goals from actual match scores in the schedule (most accurate source)
    if (espnGoals) {
      seasonStats.goalsFor     = espnGoals.goalsFor;
      seasonStats.goalsAgainst = espnGoals.goalsAgainst;
    }
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

    // Prioritise the likely league so we find the event on the first try
    const leagueHint = guessDomesticLeague(homeTeamName) || guessDomesticLeague(awayTeamName);
    const leagues = leagueHint ? [leagueHint, ...ESPN_LEAGUES.filter(l => l !== leagueHint)] : ESPN_LEAGUES;

    for (const league of leagues) {
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

      // Extract team IDs from the event now — return them even if rosters aren't ready yet
      // so the caller can skip the redundant getEspnTeamIds step.
      const evComp = event.competitions?.[0];
      const homeTeamId = String(evComp?.competitors?.find((t: any) => t.homeAway === 'home')?.team?.id ?? '');
      const awayTeamId = String(evComp?.competitors?.find((t: any) => t.homeAway === 'away')?.team?.id ?? '');
      const foundMeta = homeTeamId && awayTeamId ? { league, homeTeamId, awayTeamId } : null;

      let summary: any;
      try {
        summary = await espnFetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${event.id}`
        );
      } catch { continue; }

      const rosters: any[] = summary?.rosters ?? [];
      if (!rosters.length) {
        return { lineups: null, debug: `ESPN found event ${event.id} but no rosters yet`, espnMeta: foundMeta };
      }

      const homeRoster = rosters.find(r => r.homeAway === 'home');
      const awayRoster = rosters.find(r => r.homeAway === 'away');
      if (!homeRoster || !awayRoster) {
        return { lineups: null, debug: `ESPN rosters incomplete for event ${event.id}`, espnMeta: foundMeta };
      }

      const homeStarters = (homeRoster.roster ?? []).filter((p: any) => p.starter);
      const awayStarters = (awayRoster.roster ?? []).filter((p: any) => p.starter);

      if (!homeStarters.length || !awayStarters.length) {
        const sampleRoster = rosters[0];
        const rosterLen = (sampleRoster?.roster ?? []).length;
        const samplePlayer = sampleRoster?.roster?.[0];
        const starterVal = samplePlayer ? String(samplePlayer.starter) : 'n/a';
        return { lineups: null, debug: `ESPN event ${event.id}: ${rosters.length} teams, rosterLen=${rosterLen}, starterVal=${starterVal}, homeStarters=${homeStarters.length}, awayStarters=${awayStarters.length}`, espnMeta: foundMeta };
      }

      const rHomeId = homeRoster.team?.id ? String(homeRoster.team.id) : homeTeamId;
      const rAwayId = awayRoster.team?.id ? String(awayRoster.team.id) : awayTeamId;

      return {
        lineups: {
          homeTeam: transformRoster(homeRoster.roster ?? []),
          awayTeam: transformRoster(awayRoster.roster ?? []),
        },
        debug: `ESPN confirmed lineups: ${homeStarters.length} home / ${awayStarters.length} away starters (teamIds: ${rHomeId}/${rAwayId})`,
        espnMeta: { league, homeTeamId: rHomeId, awayTeamId: rAwayId },
      };
    }

    return { lineups: null, debug: `No ESPN event found for "${homeTeamName}" vs "${awayTeamName}"`, espnMeta: null };
  } catch (e: any) {
    return { lineups: null, debug: `ESPN error: ${e.message}`, espnMeta: null };
  }
}

// ── ESPN team ID lookup (scoreboard only — no rosters needed) ─────────────
// Used when fd.org already has lineups but we still need ESPN team IDs for player history.
export async function getEspnTeamIds(
  homeTeamName: string,
  awayTeamName: string,
  utcDate: string,
): Promise<{ league: string; homeTeamId: string; awayTeamId: string } | null> {
  const date = utcDate.slice(0, 10).replace(/-/g, '');
  const leagueHint = guessDomesticLeague(homeTeamName) || guessDomesticLeague(awayTeamName);
  const leagues = leagueHint ? [leagueHint, ...ESPN_LEAGUES.filter(l => l !== leagueHint)] : ESPN_LEAGUES;
  for (const league of leagues) {
    let scoreboard: any;
    try { scoreboard = await espnFetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}`); }
    catch { continue; }
    const event = (scoreboard?.events ?? []).find((e: any) => {
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find((t: any) => t.homeAway === 'home')?.team?.displayName ?? '';
      const away = comp?.competitors?.find((t: any) => t.homeAway === 'away')?.team?.displayName ?? '';
      return teamMatch(home, homeTeamName) && teamMatch(away, awayTeamName);
    });
    if (!event) continue;
    const comp = event.competitions?.[0];
    const homeTeamId = String(comp?.competitors?.find((t: any) => t.homeAway === 'home')?.team?.id ?? '');
    const awayTeamId = String(comp?.competitors?.find((t: any) => t.homeAway === 'away')?.team?.id ?? '');
    if (homeTeamId && awayTeamId) return { league, homeTeamId, awayTeamId };
  }
  return null;
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

export function guessDomesticLeagueId(teamName: string): number {
  const league = guessDomesticLeague(teamName);
  const map: Record<string, number> = {
    'eng.1': 39,  'eng.2': 40,  'esp.1': 140, 'ger.1': 78,  'ita.1': 135, 'fra.1': 61,
    'por.1': 94,  'ned.1': 88,  'bel.1': 144, 'sco.1': 179, 'sco.2': 182, 'tur.1': 203,
    'swe.1': 113, 'den.1': 119, 'nor.1': 103, 'aut.1': 218, 'sui.1': 169,
    'gre.1': 197, 'pol.1': 106, 'cro.1': 210, 'srb.1': 286, 'ukr.1': 333,
    'rou.1': 283, 'cze.1': 244,
  };
  return map[league] ?? 0;
}

export interface AfTeamFixtureStats {
  goalsFor: number;
  goalsAgainst: number;
  cornersFor: number;
  shotsFor: number;
  sotFor: number;
  foulsFor: number;
  offsidesFor: number;
  tacklesFor: number;
  yellowCardsFor: number;
  savesFor: number;
  goalKicksFor: number;
  fixtureCount: number;
}

export async function fetchApiFootballTeamHistory(
  teamName: string,
  apiKey: string,
): Promise<{ history: Map<string, PlayerGameStat[]>; playerIds: Map<string, number>; afTeamId: number; afTeamStats: AfTeamFixtureStats | null; debug: string }> {
  if (!apiKey) return { history: new Map(), playerIds: new Map(), afTeamId: 0, afTeamStats: null, debug: 'no key' };
  const result = new Map<string, PlayerGameStat[]>();
  const playerIds = new Map<string, number>();
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
      // Last resort: search by first keyword only, no league filter
      const firstWord = searchName.split(' ').find(w => w.length >= 5) ?? searchName.split(' ')[0];
      const td3 = await afFetch(`/teams?search=${encodeURIComponent(firstWord)}`, apiKey);
      teams.push(...(td3?.response ?? []));
    }
    if (!teams.length) return { history: new Map(), playerIds: new Map(), afTeamId: 0, afTeamStats: null, debug: `no team: ${searchName}` };

    const tNorm = norm(teamName);
    const best = teams.find(t => {
      const n = norm(t.team?.name ?? '');
      return n === tNorm || tNorm.split(' ').filter(w => w.length > 3).some(w => n.includes(w));
    }) ?? teams[0];
    const teamId: number = best?.team?.id;
    if (!teamId) return { history: new Map(), playerIds: new Map(), afTeamId: 0, afTeamStats: null, debug: `no id: ${searchName}` };

    // Fetch 8 recent fixtures across all competitions so player history includes cup/European games
    let fd = await afFetch(`/fixtures?team=${teamId}&last=8&season=2025`, apiKey);
    let fixtures: any[] = fd?.response ?? [];
    if (!fixtures.length) {
      fd = await afFetch(`/fixtures?team=${teamId}&last=8&season=2024`, apiKey);
      fixtures = fd?.response ?? [];
    }
    if (!fixtures.length) return { history: new Map(), playerIds: new Map(), afTeamId: teamId, afTeamStats: null, debug: `no fixtures: ${teamId}` };

    const sorted = [...fixtures].sort((a: any, b: any) =>
      new Date(b.fixture?.date ?? '').getTime() - new Date(a.fixture?.date ?? '').getTime()
    );

    const fixtureTeamStatsList: Array<{
      corners: number; shots: number; sot: number; fouls: number;
      offsides: number; tackles: number; yellowCards: number; saves: number;
      goalKicks: number;
    }> = [];
    const goalsArr: { gf: number; ga: number }[] = [];

    const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
    for (const fix of sorted) {
      const fid: number = fix.fixture?.id;
      if (!fid) continue;
      if (!FINISHED.has(fix.fixture?.status?.short ?? '')) continue;

      // Extract goals — try top-level goals field first, fall back to score.fulltime
      const isHome = fix.teams?.home?.id === teamId || String(fix.teams?.home?.id) === String(teamId);
      const rawHome = fix.goals?.home ?? fix.score?.fulltime?.home;
      const rawAway = fix.goals?.away ?? fix.score?.fulltime?.away;
      const gf = isHome ? (rawHome ?? -1) : (rawAway ?? -1);
      const ga = isHome ? (rawAway ?? -1) : (rawHome ?? -1);
      if (gf >= 0 && ga >= 0) goalsArr.push({ gf, ga });

      // Fetch player stats and team fixture stats in parallel for the same fixture
      const [pd, sd] = await Promise.all([
        afFetch(`/fixtures/players?fixture=${fid}&team=${teamId}`, apiKey),
        afFetch(`/fixtures/statistics?fixture=${fid}&team=${teamId}`, apiKey),
      ]);

      // ── Player stats ──
      const teamPlayers = pd?.response?.[0];
      if (teamPlayers?.players) {
        for (const p of (teamPlayers.players as any[])) {
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
            saves:       s.goals?.saves     ?? s.goalkeeper?.saves ?? 0,
          };
          const pId: number = p.player?.id;
          const key = norm(pName);
          if (!result.has(key)) result.set(key, []);
          result.get(key)!.push(stat);
          if (pId && !playerIds.has(key)) playerIds.set(key, pId);
          const kParts = key.split(' ');
          const kLast = kParts[kParts.length - 1];
          if (kParts.length >= 2 && kLast.length >= 3) {
            if (!result.has(kLast)) result.set(kLast, result.get(key)!);
            if (pId && !playerIds.has(kLast)) playerIds.set(kLast, pId);
          }
        }
      }

      // ── Team fixture stats ──
      const fixStatsArr: any[] = sd?.response ?? [];
      // Response may contain both teams; find ours
      const fixTeam = fixStatsArr.find((r: any) => r.team?.id === teamId || r.team?.id === String(teamId))
        ?? fixStatsArr[0];
      if (fixTeam?.statistics) {
        const getFixStat = (type: string): number => {
          const entry = (fixTeam.statistics as any[]).find((s: any) => s.type === type);
          const val = entry?.value;
          if (val === null || val === undefined) return 0;
          if (typeof val === 'string' && val.endsWith('%')) return 0;
          return typeof val === 'number' ? val : (parseInt(String(val)) || 0);
        };
        fixtureTeamStatsList.push({
          corners:     getFixStat('Corner Kicks'),
          shots:       getFixStat('Total Shots'),
          sot:         getFixStat('Shots on Goal'),
          fouls:       getFixStat('Fouls'),
          offsides:    getFixStat('Offsides'),
          tackles:     getFixStat('Tackles'),
          yellowCards: getFixStat('Yellow Cards'),
          saves:       getFixStat('Goalkeeper Saves'),
          // These may not be present for all leagues — will be 0 if missing
          goalKicks:   getFixStat('Goal Kicks'),
        });
      }
    }

    // Aggregate fixture team stats into per-game averages
    let afTeamStats: AfTeamFixtureStats | null = null;
    if (fixtureTeamStatsList.length > 0) {
      const n = fixtureTeamStatsList.length;
      const sum = (key: keyof typeof fixtureTeamStatsList[0]) =>
        fixtureTeamStatsList.reduce((acc, x) => acc + x[key], 0);
      // For stats that may be absent (return 0) in some leagues, only average the
      // fixtures where the stat was actually reported (value > 0), so a missing stat
      // doesn't drag the average down to near-zero.
      const avgOrNull = (key: keyof typeof fixtureTeamStatsList[0]): number => {
        const present = fixtureTeamStatsList.filter(x => x[key] > 0);
        if (present.length === 0) return 0;
        return +(present.reduce((acc, x) => acc + x[key], 0) / present.length).toFixed(2);
      };
      afTeamStats = {
        goalsFor:       goalsArr.length > 0 ? +(goalsArr.reduce((s, x) => s + x.gf, 0) / goalsArr.length).toFixed(2) : 0,
        goalsAgainst:   goalsArr.length > 0 ? +(goalsArr.reduce((s, x) => s + x.ga, 0) / goalsArr.length).toFixed(2) : 0,
        cornersFor:     +(sum('corners')     / n).toFixed(2),
        shotsFor:       +(sum('shots')       / n).toFixed(2),
        sotFor:         +(sum('sot')         / n).toFixed(2),
        foulsFor:       +(sum('fouls')       / n).toFixed(2),
        offsidesFor:    +(sum('offsides')    / n).toFixed(2),
        tacklesFor:     avgOrNull('tackles'),
        yellowCardsFor: +(sum('yellowCards') / n).toFixed(2),
        savesFor:       +(sum('saves')       / n).toFixed(2),
        goalKicksFor:   avgOrNull('goalKicks'),
        fixtureCount:   n,
      };
    }

    return {
      history: result,
      playerIds,
      afTeamId: teamId,
      afTeamStats,
      debug: `team ${teamId}(${best?.team?.name}): ${sorted.length} fixtures, ${result.size} players, ${playerIds.size} ids, afStats=${afTeamStats ? `${afTeamStats.fixtureCount}g` : 'none'}`,
    };
  } catch (e: any) {
    return { history: new Map(), playerIds: new Map(), afTeamId: 0, afTeamStats: null, debug: `err: ${e.message}` };
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
      if (player.id) result.set(`id:${player.id}`, player);
    }
  } catch (err: any) {
    console.warn(`[roster] ESPN ${leagueSlug} team ${teamId}: ${err.message}`);
  }
  return result;
}

// ── API-Football per-team season player stats (paid API, no scraping) ────────
export interface AfSquadPlayer {
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

export async function fetchApiFootballSquadStats(
  teamName: string,
  apiKey: string,
): Promise<{ stats: Map<string, AfSquadPlayer>; debug: string }> {
  if (!apiKey) return { stats: new Map(), debug: 'no key' };
  const result = new Map<string, AfSquadPlayer>();
  try {
    const searchName = cleanForSearch(teamName);
    const leagueId = guessDomesticLeagueId(teamName);
    const leagueParam = leagueId ? `&league=${leagueId}` : '';

    let td = await afFetch(`/teams?search=${encodeURIComponent(searchName)}${leagueParam}`, apiKey);
    let teams: any[] = td?.response ?? [];
    if (!teams.length && leagueParam) {
      td = await afFetch(`/teams?search=${encodeURIComponent(searchName)}`, apiKey);
      teams = td?.response ?? [];
    }
    if (!teams.length) {
      const firstWord = searchName.split(' ').find(w => w.length >= 5) ?? searchName.split(' ')[0];
      td = await afFetch(`/teams?search=${encodeURIComponent(firstWord)}`, apiKey);
      teams = td?.response ?? [];
    }
    if (!teams.length) return { stats: new Map(), debug: `no team: ${searchName}` };

    const tNorm = norm(teamName);
    const best = teams.find(t => {
      const n = norm(t.team?.name ?? '');
      return n === tNorm || tNorm.split(' ').filter(w => w.length > 3).some(w => n.includes(w));
    }) ?? teams[0];
    const teamId: number = best?.team?.id;
    if (!teamId) return { stats: new Map(), debug: `no id: ${searchName}` };

    const fetchAllPages = async (season: number): Promise<any[]> => {
      const all: any[] = [];
      let page = 1;
      while (true) {
        const pd = await afFetch(`/players?team=${teamId}&season=${season}&page=${page}`, apiKey);
        const results: any[] = pd?.response ?? [];
        all.push(...results);
        const totalPages: number = pd?.paging?.total ?? 1;
        if (page >= totalPages) break;
        page++;
      }
      return all;
    };
    let players = await fetchAllPages(2025);
    if (!players.length) players = await fetchAllPages(2024);
    if (!players.length) return { stats: new Map(), debug: `no players: ${teamId}` };

    for (const entry of players) {
      const player = entry.player;
      const stats: any[] = entry.statistics ?? [];
      if (!stats.length) continue;

      // Prefer domestic league entry for per-game rates; fall back to first
      const domestic = leagueId ? stats.find((s: any) => s.league?.id === leagueId) : null;
      const rateSource = domestic ?? stats[0];
      const rateGames = rateSource?.games?.appearences || 1;

      // Sum totals across all competitions
      let totalGames = 0, totalMins = 0, totalGoals = 0, totalAssists = 0;
      let totalYellow = 0, totalRed = 0, totalPk = 0;
      for (const s of stats) {
        totalGames   += s.games?.appearences ?? 0;
        totalMins    += s.games?.minutes     ?? 0;
        totalGoals   += s.goals?.total       ?? 0;
        totalAssists += s.goals?.assists     ?? 0;
        totalYellow  += s.cards?.yellow      ?? 0;
        totalRed     += s.cards?.red         ?? 0;
        totalPk      += s.penalty?.scored    ?? 0;
      }
      if (totalGames < 1) continue;

      const p: AfSquadPlayer = {
        name:            player.name ?? '',
        games:           totalGames,
        minsPerGame:     Math.round(totalMins / totalGames),
        goals:           totalGoals,
        assists:         totalAssists,
        shotsPerGame:    +((rateSource?.shots?.total    ?? 0) / rateGames).toFixed(2),
        sotPerGame:      +((rateSource?.shots?.on       ?? 0) / rateGames).toFixed(2),
        foulsPerGame:    +((rateSource?.fouls?.committed ?? 0) / rateGames).toFixed(2),
        foulsWonPerGame: +((rateSource?.fouls?.drawn    ?? 0) / rateGames).toFixed(2),
        yellowCards:     totalYellow,
        redCards:        totalRed,
        pkGoals:         totalPk,
      };

      const key = norm(p.name);
      result.set(key, p);
      const parts = key.split(' ');
      const last = parts[parts.length - 1];
      if (last.length >= 3 && !result.has(last)) result.set(last, p);
    }

    return { stats: result, debug: `squad ${teamId}(${best?.team?.name}): ${players.length} players, ${result.size} keys` };
  } catch (e: any) {
    return { stats: new Map(), debug: `squad err: ${e.message}` };
  }
}

// Lookup referee by scanning a specific league+date (most direct for CL/EL/ECL)
export async function fetchApiFootballRefereeByLeague(
  leagueId: number, matchDate: string, homeName: string, awayName: string, apiKey: string,
): Promise<string> {
  if (!apiKey) return '';
  try {
    const dateStr = matchDate.slice(0, 10);
    const fd = await afFetch(`/fixtures?league=${leagueId}&date=${dateStr}&season=2025`, apiKey);
    const fixtures: any[] = fd?.response ?? [];
    if (!fixtures.length) return '';
    const hNorm = norm(homeName);
    const aNorm = norm(awayName);
    const hit = fixtures.find(f => {
      const fh = norm(f.teams?.home?.name ?? '');
      const fa = norm(f.teams?.away?.name ?? '');
      const homeMatch = fh === hNorm || hNorm.split(' ').filter(w => w.length > 3).some(w => fh.includes(w));
      const awayMatch = fa === aNorm || aNorm.split(' ').filter(w => w.length > 3).some(w => fa.includes(w));
      return homeMatch || awayMatch;
    });
    const raw: string = hit?.fixture?.referee ?? '';
    return raw.split(',')[0].trim();
  } catch {
    return '';
  }
}

export async function fetchApiFootballReferee(teamName: string, apiKey: string, matchDate?: string): Promise<string> {
  if (!apiKey) return '';
  try {
    const searchName = cleanForSearch(teamName);
    const leagueId = guessDomesticLeagueId(teamName);
    const leagueParam = leagueId ? `&league=${leagueId}` : '';
    let td = await afFetch(`/teams?search=${encodeURIComponent(searchName)}${leagueParam}`, apiKey);
    let teams: any[] = td?.response ?? [];
    if (!teams.length && leagueParam) {
      td = await afFetch(`/teams?search=${encodeURIComponent(searchName)}`, apiKey);
      teams = td?.response ?? [];
    }
    if (!teams.length) {
      const firstWord = searchName.split(' ')[0];
      if (firstWord !== searchName) {
        td = await afFetch(`/teams?search=${encodeURIComponent(firstWord)}`, apiKey);
        teams = td?.response ?? [];
      }
    }
    if (!teams.length) return '';
    const tNorm = norm(teamName);
    const best = teams.find(t => {
      const n = norm(t.team?.name ?? '');
      return n === tNorm || tNorm.split(' ').filter(w => w.length > 3).some(w => n.includes(w));
    }) ?? teams[0];
    const teamId: number = best?.team?.id;
    if (!teamId) return '';
    const dateStr = matchDate
      ? matchDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const fd = await afFetch(`/fixtures?team=${teamId}&date=${dateStr}`, apiKey);
    const fixtures: any[] = fd?.response ?? [];
    const source = fixtures.length ? fixtures : (await afFetch(`/fixtures?team=${teamId}&next=1`, apiKey))?.response ?? [];
    if (!source.length) return '';
    const raw: string = source[0]?.fixture?.referee ?? '';
    return raw.split(',')[0].trim();
  } catch {
    return '';
  }
}

// ── Per-player personal fixture history (true last N across all competitions) ─
// For each player AF ID, fetches their own last N fixtures and returns per-game stats.
// Deduplicates fixture API calls: teammates share fixture stat requests.
export async function fetchPlayerPersonalHistoryBatch(
  playerAfIds: number[],
  apiKey: string,
  last = 5,
): Promise<Map<number, PlayerGameStat[]>> {
  const result = new Map<number, PlayerGameStat[]>();
  if (!apiKey || !playerAfIds.length) return result;

  // Step 1: get each player's recent fixture IDs
  const playerFixtureMap = new Map<number, Array<{ id: number; date: string }>>();
  const allFixtureIds = new Set<number>();

  for (const playerId of playerAfIds) {
    try {
      const fd = await afFetch(`/fixtures?player=${playerId}&last=${last}`, apiKey);
      const fixtures: any[] = fd?.response ?? [];
      if (fixtures.length > 0) {
        const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
        const entries = fixtures
          .filter((f: any) => FINISHED.has(f.fixture?.status?.short ?? ''))
          .map((f: any) => ({ id: f.fixture?.id as number, date: f.fixture?.date ?? '' }))
          .filter(e => e.id);
        playerFixtureMap.set(playerId, entries);
        entries.forEach(e => allFixtureIds.add(e.id));
      }
    } catch {}
  }

  // Step 2: fetch all player stats for each unique fixture (no team filter = both teams in one call)
  const fixturePlayerStats = new Map<number, Map<number, PlayerGameStat>>();
  for (const fixtureId of Array.from(allFixtureIds)) {
    try {
      const pd = await afFetch(`/fixtures/players?fixture=${fixtureId}`, apiKey);
      const teams: any[] = pd?.response ?? [];
      const playerMap = new Map<number, PlayerGameStat>();
      for (const team of teams) {
        for (const p of (team.players ?? [])) {
          const pid: number = p.player?.id;
          if (!pid) continue;
          const s = p.statistics?.[0];
          if (!s) continue;
          playerMap.set(pid, {
            goals:       s.goals?.total     ?? 0,
            assists:     s.goals?.assists   ?? 0,
            shots:       s.shots?.total     ?? 0,
            sot:         s.shots?.on        ?? 0,
            fc:          s.fouls?.committed ?? 0,
            fd:          s.fouls?.drawn     ?? 0,
            yellowCards: s.cards?.yellow    ?? 0,
            saves:       s.goals?.saves     ?? s.goalkeeper?.saves ?? 0,
          });
        }
      }
      fixturePlayerStats.set(fixtureId, playerMap);
    } catch {}
  }

  // Step 3: build per-player history (newest first)
  for (const [playerId, fixtures] of Array.from(playerFixtureMap)) {
    const sorted = [...fixtures].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const games: PlayerGameStat[] = [];
    for (const { id: fixtureId } of sorted) {
      const stat = fixturePlayerStats.get(fixtureId)?.get(playerId);
      // Always push — missing stats become zeros so game position stays correct in the timeline
      games.push(stat ?? { goals: 0, assists: 0, shots: 0, sot: 0, fc: 0, fd: 0, yellowCards: 0, saves: 0 });
    }
    if (games.length > 0) result.set(playerId, games);
  }

  return result;
}

// Fallback: look up an AF player ID by name search when the player didn't appear in
// the team's recent domestic fixtures (e.g. long-term injury, just transferred).
export async function lookupAfPlayerId(
  playerName: string,
  afTeamId: number,
  apiKey: string,
): Promise<number | null> {
  if (!apiKey || !afTeamId) return null;
  try {
    const parts = norm(playerName).split(' ').filter(w => w.length >= 3).slice(0, 2);
    const searchName = parts.join(' ');
    if (!searchName) return null;
    for (const season of [2025, 2024]) {
      const pd = await afFetch(`/players?search=${encodeURIComponent(searchName)}&team=${afTeamId}&season=${season}`, apiKey);
      const players: any[] = pd?.response ?? [];
      if (!players.length) continue;
      const pNorm = norm(playerName);
      const match = players.find((p: any) => {
        const n = norm(p.player?.name ?? '');
        return n === pNorm || pNorm.split(' ').filter(w => w.length > 3).some((w: string) => n.includes(w));
      }) ?? players[0];
      const id = match?.player?.id;
      if (id) return id;
    }
    return null;
  } catch {
    return null;
  }
}

// ── API-Football bookmaker odds → implied probabilities ────────────────────
export interface MatchOdds {
  homeWin: number;
  draw: number;
  awayWin: number;
  btts: number;
  referee?: string;
}

export async function fetchApiFootballOdds(
  homeName: string,
  awayName: string,
  matchDate: string,
  apiKey: string,
  leagueId?: number,
): Promise<MatchOdds | null> {
  if (!apiKey) return null;
  try {
    const dateStr = matchDate.slice(0, 10);
    const guessedLeague = leagueId ?? guessDomesticLeagueId(homeName) ?? guessDomesticLeagueId(awayName);
    const leagueParam = guessedLeague ? `&league=${guessedLeague}` : '';

    const fd = await afFetch(`/fixtures?date=${dateStr}&season=2025${leagueParam}`, apiKey);
    const fixtures: any[] = fd?.response ?? [];

    const hNorm = norm(homeName);
    const aNorm = norm(awayName);
    const fixture = fixtures.find(f => {
      const fh = norm(f.teams?.home?.name ?? '');
      const fa = norm(f.teams?.away?.name ?? '');
      const homeMatch = fh === hNorm || hNorm.split(' ').filter(w => w.length > 3).some(w => fh.includes(w));
      const awayMatch = fa === aNorm || aNorm.split(' ').filter(w => w.length > 3).some(w => fa.includes(w));
      return homeMatch && awayMatch;
    });
    if (!fixture) return null;

    const fixtureId: number = fixture.fixture?.id;
    if (!fixtureId) return null;

    const refRaw: string = fixture.fixture?.referee ?? '';
    const referee = refRaw ? refRaw.split(',')[0].trim() : undefined;

    const od = await afFetch(`/odds?fixture=${fixtureId}`, apiKey);
    const bookmakers: any[] = od?.response?.[0]?.bookmakers ?? [];
    if (!bookmakers.length) {
      // No odds available but we found the fixture — return referee only if present
      return referee ? { homeWin: 0, draw: 0, awayWin: 0, btts: 50, referee } : null;
    }

    const h2hSamples: { home: number; draw: number; away: number }[] = [];
    const bttsSamples: { yes: number; no: number }[] = [];

    for (const bm of bookmakers) {
      for (const bet of (bm.bets ?? [])) {
        if (bet.id === 1 || bet.name === 'Match Winner') {
          const home = parseFloat(bet.values?.find((v: any) => v.value === 'Home')?.odd ?? '0');
          const draw = parseFloat(bet.values?.find((v: any) => v.value === 'Draw')?.odd ?? '0');
          const away = parseFloat(bet.values?.find((v: any) => v.value === 'Away')?.odd ?? '0');
          if (home > 1 && draw > 1 && away > 1) h2hSamples.push({ home, draw, away });
        }
        if (bet.id === 5 || bet.name === 'Both Teams To Score') {
          const yes = parseFloat(bet.values?.find((v: any) => v.value === 'Yes')?.odd ?? '0');
          const no  = parseFloat(bet.values?.find((v: any) => v.value === 'No')?.odd  ?? '0');
          if (yes > 1 && no > 1) bttsSamples.push({ yes, no });
        }
      }
    }

    if (!h2hSamples.length) return null;

    // Average implied probabilities across bookmakers then normalise to remove overround
    const avg = {
      home: h2hSamples.reduce((s, o) => s + 1 / o.home, 0) / h2hSamples.length,
      draw: h2hSamples.reduce((s, o) => s + 1 / o.draw, 0) / h2hSamples.length,
      away: h2hSamples.reduce((s, o) => s + 1 / o.away, 0) / h2hSamples.length,
    };
    const total = avg.home + avg.draw + avg.away;

    let btts = 50;
    if (bttsSamples.length > 0) {
      const yesP = bttsSamples.reduce((s, o) => s + 1 / o.yes, 0) / bttsSamples.length;
      const noP  = bttsSamples.reduce((s, o) => s + 1 / o.no,  0) / bttsSamples.length;
      btts = Math.round((yesP / (yesP + noP)) * 100);
    }

    return {
      homeWin: Math.round((avg.home / total) * 100),
      draw:    Math.round((avg.draw / total) * 100),
      awayWin: Math.round((avg.away / total) * 100),
      btts,
      ...(referee ? { referee } : {}),
    };
  } catch {
    return null;
  }
}

// ── AF fixture listing (match source for leagues not on fd.org free tier) ───
export interface AfFixtureSummary {
  id: number;
  utcDate: string;
  status: string;
  referee: string;
  leagueName: string;
  leagueRound: string;
  home: { id: number; name: string; logo: string };
  away: { id: number; name: string; logo: string };
}

export async function fetchAfFixturesByDateRange(
  leagueId: number,
  fromDate: string,
  toDate: string,
  season: number,
  apiKey: string,
): Promise<AfFixtureSummary[]> {
  if (!apiKey || !leagueId) return [];
  try {
    const data = await afFetch(
      `/fixtures?league=${leagueId}&season=${season}&from=${fromDate}&to=${toDate}`,
      apiKey,
    );
    return (data?.response ?? [])
      .map((f: any) => ({
        id:          f.fixture?.id as number,
        utcDate:     f.fixture?.date ?? '',
        status:      f.fixture?.status?.short ?? 'NS',
        referee:     (f.fixture?.referee ?? '').split(',')[0].trim(),
        leagueName:  f.league?.name ?? '',
        leagueRound: f.league?.round ?? '',
        home: { id: f.teams?.home?.id as number, name: f.teams?.home?.name ?? '', logo: f.teams?.home?.logo ?? '' },
        away: { id: f.teams?.away?.id as number, name: f.teams?.away?.name ?? '', logo: f.teams?.away?.logo ?? '' },
      }))
      .filter((f: AfFixtureSummary) => f.id && f.home.name && f.away.name);
  } catch { return []; }
}

// Returns ESPN-compatible lineup shape so Phase 2 consumes it unchanged.
// { homeTeam: { lineup, startingEleven }, awayTeam: { ... } }
export async function fetchAfConfirmedLineups(
  fixtureId: number,
  apiKey: string,
): Promise<{ homeTeam: any; awayTeam: any } | null> {
  if (!apiKey || !fixtureId) return null;
  try {
    const data = await afFetch(`/fixtures/lineups?fixture=${fixtureId}`, apiKey);
    const teams: any[] = data?.response ?? [];
    if (teams.length < 2) return null;
    const posMap: Record<string, string> = {
      G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward', A: 'Forward',
    };
    const transform = (t: any) => {
      const starters = (t.startXI ?? [])
        .map((p: any, i: number) => ({
          name:           p.player?.name ?? '',
          espnId:         String(p.player?.id ?? ''),
          position:       posMap[p.player?.pos ?? ''] ?? 'Midfielder',
          posAbbr:        p.player?.pos ?? 'M',
          formationPlace: i + 1,
        }))
        .filter((p: any) => p.name);
      return { lineup: starters, startingEleven: starters };
    };
    if ((teams[0].startXI?.length ?? 0) < 11 || (teams[1].startXI?.length ?? 0) < 11) return null;
    return { homeTeam: transform(teams[0]), awayTeam: transform(teams[1]) };
  } catch { return null; }
}
