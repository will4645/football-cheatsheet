/**
 * lib/sofascore.ts
 * ─────────────────
 * Fetches confirmed lineups from Sofascore's unofficial API.
 * Used as a fallback when football-data.org hasn't published lineups yet.
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://www.sofascore.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': 'https://www.sofascore.com',
  'Cache-Control': 'no-cache',
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

async function sfFetch(url: string) {
  await new Promise(r => setTimeout(r, 500));
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

const POSITION_MAP: Record<string, string> = {
  G: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward',
};

export async function getSofascoreLineups(
  homeTeamName: string,
  awayTeamName: string,
  utcDate: string,
): Promise<{ lineups: { homeTeam: any; awayTeam: any } | null; debug: string }> {
  try {
    const date = utcDate.slice(0, 10);
    const data = await sfFetch(`https://api.sofascore.com/api/v1/sport/football/scheduled-events/${date}`);
    const events: any[] = data?.events ?? [];

    const event = events.find(e =>
      teamMatch(e.homeTeam?.name, homeTeamName) &&
      teamMatch(e.awayTeam?.name, awayTeamName)
    );

    if (!event) {
      return { lineups: null, debug: `No Sofascore event matched for "${homeTeamName}" vs "${awayTeamName}" (${events.length} events checked)` };
    }

    const lineupData = await sfFetch(`https://api.sofascore.com/api/v1/event/${event.id}/lineups`);

    if (!lineupData?.confirmed) {
      return { lineups: null, debug: `Sofascore lineups not confirmed yet for event ${event.id}` };
    }

    const transformSide = (side: any) => {
      const starters = (side?.players ?? [])
        .filter((p: any) => !p.substitute)
        .map((p: any) => ({
          name: p.player?.name ?? 'Unknown',
          position: POSITION_MAP[p.position] ?? p.position ?? 'Midfielder',
        }));
      return { lineup: starters, startingEleven: starters };
    };

    return {
      lineups: {
        homeTeam: transformSide(lineupData.home),
        awayTeam: transformSide(lineupData.away),
      },
      debug: `Sofascore confirmed lineups: event ${event.id}, ${lineupData.home?.players?.length ?? 0} home / ${lineupData.away?.players?.length ?? 0} away players`,
    };
  } catch (e: any) {
    return { lineups: null, debug: `Sofascore error: ${e.message}` };
  }
}
