/**
 * lib/api-football.ts
 * ─────────────────────
 * Scrapes confirmed lineups and per-player match history from ESPN's public API.
 */

const ESPN_LEAGUES = [
  'eng.1',          // Premier League
  'uefa.champions', // Champions League
  'uefa.europa',    // Europa League
  'eng.fa',         // FA Cup
  'eng.2',          // Championship
  'esp.1',          // La Liga
  'ger.1',          // Bundesliga
  'ita.1',          // Serie A
  'fra.1',          // Ligue 1
];

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
      espnId:         p.athlete?.id ?? '',
      position:       p.position?.displayName ?? p.athlete?.position?.displayName ?? 'Midfielder',
      posAbbr:        (p.position?.abbreviation ?? '').toUpperCase(),
      formationPlace: parseInt(p.formationPlace) || 0,
    }));
  return { lineup: starters, startingEleven: starters };
}

// ── Per-player stat extraction from an event summary ─────────────��────────
export interface PlayerGameStat {
  fc: number;   // fouls committed
  fd: number;   // fouls drawn/suffered
  goals: number;
  assists: number;
  shots: number;
  sot: number;  // shots on target
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
      const id = p.athlete?.id;
      if (!id) continue;

      const rawStats: any[] = p.stats ?? p.statistics ?? [];
      if (!rawStats.length) continue;

      if (!sampleStatNames) {
        const isGK = rawStats.some((s: any) => (s.name ?? '') === 'goalsConceded');
        if (!isGK) {
          sampleStatNames = rawStats.map((s: any) => `${s.name ?? '?'}=${s.value ?? s.displayValue ?? '?'}`).join('|');
        }
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
        fc:      getStat('foulscommitted', 'fc', 'fouls committed'),
        fd:      getStat('foulssuffered', 'foulsdrawn', 'fd', 'fouls drawn', 'foulswon'),
        goals:   getStat('totalgoals', 'goals', 'g'),
        assists: getStat('goalassists', 'assists', 'a'),
        shots:   getStat('totalshots', 'shots', 'sh'),
        sot:     getStat('shotsontarget', 'sot'),
      });
    }
  }

  return {
    stats: map,
    debug: `rosters:${rosters.length} players:${rosterPlayers} mapped:${map.size} sample:[${sampleStatNames}]`,
  };
}

// ── Fetch last N completed event IDs for a team ───────────────────────────
async function fetchTeamRecentEventIds(teamId: string, league: string, n = 5): Promise<{ ids: string[]; debug: string }> {
  if (!teamId) return { ids: [], debug: 'no teamId' };
  try {
    const data = await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}/schedule`
    );
    const events: any[] = data?.events ?? [];
    if (!events.length) {
      const keys = Object.keys(data ?? {}).join(',');
      return { ids: [], debug: `schedule returned 0 events (keys: ${keys})` };
    }
    const completed = events.filter(e => {
      const st = e.competitions?.[0]?.status?.type ?? e.status?.type ?? {};
      return st.completed === true || (st.name ?? '').includes('FINAL');
    });
    const ids = completed
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, n)
      .map((e: any) => e.id);
    return { ids, debug: `${events.length} events, ${completed.length} completed, returning ${ids.length}` };
  } catch (err: any) {
    return { ids: [], debug: `schedule error: ${err.message}` };
  }
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

function extractBoxscoreTeamStats(summary: any, teamId: string): { mine: Record<string, number>; opp: Record<string, number> } | null {
  const teams: any[] = summary?.boxscore?.teams ?? [];
  if (teams.length < 2) return null;

  function parseTeam(t: any): Record<string, number> {
    const out: Record<string, number> = {};
    for (const s of (t?.statistics ?? [])) {
      const raw = s.displayValue ?? String(s.value ?? 0);
      const val = parseFloat(raw.replace('%', '')) || 0;
      out[s.name ?? ''] = val;
    }
    return out;
  }

  const teamA = teams.find((t: any) => t.team?.id === teamId || t.team?.id === String(teamId));
  const teamB = teams.find((t: any) => t.team?.id !== teamId && t.team?.id !== String(teamId));
  if (!teamA || !teamB) {
    // fallback: use homeAway — but we don't know if our team is home or away here
    return { mine: parseTeam(teams[0]), opp: parseTeam(teams[1]) };
  }
  return { mine: parseTeam(teamA), opp: parseTeam(teamB) };
}

// ── Fetch per-player game history for a team (last 5 matches) ─────────────
// Returns { history, debug } — history is Map<espnAthleteId, PlayerGameStat[]> newest first
export async function fetchTeamPlayerHistory(
  teamId: string,
  league: string,
): Promise<{ history: Map<string, PlayerGameStat[]>; seasonStats: TeamSeasonStats | null; debug: string }> {
  const result = new Map<string, PlayerGameStat[]>();
  const { ids: eventIds, debug: scheduleDebug } = await fetchTeamRecentEventIds(teamId, league);
  const eventDebugs: string[] = [];

  const teamStatSamples: Array<{ mine: Record<string, number>; opp: Record<string, number> }> = [];

  for (const eventId of eventIds) {
    try {
      const summary = await espnFetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`
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

  let seasonStats: TeamSeasonStats | null = null;
  if (teamStatSamples.length > 0) {
    const n = teamStatSamples.length;
    const avg = (key: string, side: 'mine' | 'opp') =>
      +( teamStatSamples.reduce((s, g) => s + (g[side][key] ?? 0), 0) / n ).toFixed(2);

    seasonStats = {
      goalsFor:       0, // computed below from player goals
      goalsAgainst:   0,
      cornersFor:     avg('wonCorners', 'mine'),
      cornersAgainst: avg('wonCorners', 'opp'),
      shotsFor:       avg('totalShots', 'mine'),
      shotsAgainst:   avg('totalShots', 'opp'),
      sotFor:         avg('shotsOnTarget', 'mine'),
      sotAgainst:     avg('shotsOnTarget', 'opp'),
      foulsCommitted: avg('foulsCommitted', 'mine'),
      foulsWon:       avg('foulsCommitted', 'opp'),
      cardsFor:       avg('yellowCards', 'mine'),
      cardsAgainst:   avg('yellowCards', 'opp'),
      gamesCount:     n,
    };

    // Goals: sum player totalGoals per game for our team
    const myGoalsPerGame = result.size > 0
      ? Array.from(result.values()).reduce((sum, games) => {
          games.forEach((g, i) => { if (!sum[i]) sum[i] = 0; sum[i] += g.goals; });
          return sum;
        }, [] as number[])
      : [];
    seasonStats.goalsFor = myGoalsPerGame.length
      ? +(myGoalsPerGame.reduce((a, b) => a + b, 0) / myGoalsPerGame.length).toFixed(2)
      : 0;

    // goalsAgainst not easily derivable from our player stats alone — use opponent's player stats if available
    // For now derive as: opponent's shots * goals_per_shot ratio approximation
    // Will be overridden if we have opponent data
    seasonStats.goalsAgainst = +(avg('totalShots', 'opp') * 0.12).toFixed(2);
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
