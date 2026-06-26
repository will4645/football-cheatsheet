import { NextRequest, NextResponse } from 'next/server';
import { prefetchMatch } from '@/lib/prefetch';
import { fetchAfFixturesByDateRange } from '@/lib/api-football';
import { fetchApiSportsIndex, buildApiSportsNameIndex } from '@/lib/api-sports';
import { kvGet, kvSet, kvDeleteOlderThan } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BASE_URL = 'https://api.football-data.org/v4';
const COMPETITIONS = ['PL', 'CL', 'EL', 'ECL', 'PD', 'BL1', 'SA', 'FL1'];

function isAuthorized(req: NextRequest): boolean {
  const syncSecret = (process.env.SYNC_SECRET ?? '').trim();
  const cronSecret = (process.env.CRON_SECRET ?? '').trim();
  const q = req.nextUrl.searchParams.get('secret') ?? req.nextUrl.searchParams.get('token');
  if (syncSecret && q === syncSecret) return true;
  const auth = req.headers.get('authorization');
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  return false;
}

function matchSlug(home: string, away: string): string {
  const s = (v: string) => (v || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${s(home)}-vs-${s(away)}`;
}

// Strip common club suffix tokens so the slug matches ESPN names (which omit " FC").
// e.g. "Brighton & Hove Albion FC" → "Brighton & Hove Albion"
function stripClubSuffix(name: string): string {
  return name.replace(/\s+(fc|afc|sc|cf|fk|bk|if|sk|ac|bc|athletic)\s*$/i, '').trim();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  const afApiKey = (process.env.API_SPORTS_KEY ?? '').trim();
  if (!afApiKey) return NextResponse.json({ error: 'no API_SPORTS_KEY' }, { status: 500 });

  const force = req.nextUrl.searchParams.get('force') === '1';

  // fd.org competition code → AF league ID
  const FD_CODE_TO_AF_LEAGUE: Record<string, number> = {
    PL: 39, PD: 140, BL1: 78, SA: 135, FL1: 61,
    CL: 2, EL: 3, ECL: 848, WC: 1,
  };

  try {
    // Get upcoming matches from football-data.org
    const today = new Date();
    const from = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    const to   = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const fmt  = (d: Date) => d.toISOString().slice(0, 10);

    const res = await fetch(
      `${BASE_URL}/matches?competitions=${COMPETITIONS.join(',')}&dateFrom=${fmt(from)}&dateTo=${fmt(to)}`,
      { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY! }, cache: 'no-store' },
    );
    // Don't bail early if fd.org is down — ESPN supplement covers PL and major leagues below
    if (!res.ok) log(`[prefetch] fd.org ${res.status} — continuing with ESPN supplement`);

    const data = res.ok ? await res.json() : {};
    const matches: any[] = data?.matches ?? [];
    log(`[prefetch] ${matches.length} matches from fd.org`);

    // Only pre-fetch matches within 24h of kickoff that have known team names
    let nearTerm: Array<{ homeTeam: { name: string }; awayTeam: { name: string }; utcDate: string; afLeagueId?: number }> =
      matches
        .filter((m: any) => {
          if (!m.homeTeam?.name || !m.awayTeam?.name) return false;
          const hoursAway = (new Date(m.utcDate).getTime() - Date.now()) / 3_600_000;
          return hoursAway > -2 && hoursAway < 24;
        })
        .map((m: any) => ({
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          utcDate: m.utcDate,
          afLeagueId: FD_CODE_TO_AF_LEAGUE[m.competition?.code ?? ''],
        }));

    // ── ESPN supplement: discover matches when fd.org is down or missing leagues ──
    // Hits the public ESPN scoreboard API for each major domestic + European league.
    const ESPN_PREFETCH_LEAGUES = [
      { slug: 'eng.1', afLeagueId: 39 },
      { slug: 'uefa.champions', afLeagueId: 2 },
      { slug: 'uefa.europa', afLeagueId: 3 },
      { slug: 'uefa.europa.conf', afLeagueId: 848 },
      { slug: 'esp.1', afLeagueId: 140 },
      { slug: 'ger.1', afLeagueId: 78 },
      { slug: 'ita.1', afLeagueId: 135 },
      { slug: 'fra.1', afLeagueId: 61 },
      { slug: 'fifa.world', afLeagueId: 1 },
    ];
    const nearTermIds = new Set(nearTerm.map(m => matchSlug(m.homeTeam.name, m.awayTeam.name)));
    for (const { slug, afLeagueId } of ESPN_PREFETCH_LEAGUES) {
      for (let d = 0; d <= 2; d++) {
        const checkDate = new Date(today.getTime() + d * 24 * 60 * 60 * 1000);
        const ds = checkDate.toISOString().slice(0, 10).replace(/-/g, '');
        try {
          const espnRes = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${ds}&_cb=${Date.now()}`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36', 'Accept': 'application/json' }, cache: 'no-store' }
          );
          if (!espnRes.ok) continue;
          const board = await espnRes.json();
          for (const ev of (board.events ?? [])) {
            const comp = ev.competitions?.[0];
            if (!comp) continue;
            const homeC = comp.competitors?.find((c: any) => c.homeAway === 'home');
            const awayC = comp.competitors?.find((c: any) => c.homeAway === 'away');
            if (!homeC?.team?.displayName || !awayC?.team?.displayName) continue;
            const homeTeamName = homeC.team.displayName as string;
            const awayTeamName = awayC.team.displayName as string;
            const utcDate = ev.date as string;
            const hoursAway = (new Date(utcDate).getTime() - Date.now()) / 3_600_000;
            if (hoursAway < -2 || hoursAway > 24) continue;
            const slug2 = matchSlug(homeTeamName, awayTeamName);
            if (nearTermIds.has(slug2)) continue; // already have it from fd.org
            nearTermIds.add(slug2);
            nearTerm.push({ homeTeam: { name: homeTeamName }, awayTeam: { name: awayTeamName }, utcDate, afLeagueId });
          }
        } catch {}
      }
    }
    log(`[prefetch] ${nearTerm.length} near-term matches after ESPN supplement`);

    log(`[prefetch] ${nearTerm.length} near-term matches total (fd.org + ESPN)`);

    let done = 0, skipped = 0;
    for (const m of nearTerm) {
      const id = matchSlug(m.homeTeam.name, m.awayTeam.name);

      if (!force) {
        const existing = await kvGet<any>(`prefetch:${id}`);
        // Skip only if prefetched within the last 20h AND both teams have real AF data.
        // If either team's fixtureHistory is empty (7am lookup failed), re-run to retry —
        // the noon cron and on-demand sync retry both depend on this not being skipped.
        const homeOk = Object.keys(existing?.home?.fixtureHistory || {}).length > 0;
        const awayOk = Object.keys(existing?.away?.fixtureHistory || {}).length > 0;
        if (existing?.fetchedAt && homeOk && awayOk && Date.now() - existing.fetchedAt < 20 * 60 * 60 * 1000) {
          log(`[prefetch] skip (fresh): ${id}`);
          skipped++;
          continue;
        }
        if (existing?.fetchedAt && (!homeOk || !awayOk)) {
          log(`[prefetch] re-running (empty data: home:${homeOk} away:${awayOk}): ${id}`);
        }
      }

      const ok = await prefetchMatch(id, m.homeTeam.name, m.awayTeam.name, m.utcDate, afApiKey, log, m.afLeagueId);
      if (ok) {
        done++;
        // Mirror-save under the FC-stripped slug so the sync route (which derives match IDs
        // from ESPN team names that omit " FC") can hit the prefetch cache even when fd.org
        // supplied the original names. e.g. "Brighton & Hove Albion FC" → "Brighton & Hove Albion"
        const mirrorId = matchSlug(stripClubSuffix(m.homeTeam.name), stripClubSuffix(m.awayTeam.name));
        if (mirrorId !== id) {
          try {
            const blob = await kvGet<unknown>(`prefetch:${id}`);
            if (blob) {
              await kvSet(`prefetch:${mirrorId}`, blob);
              log(`[prefetch] mirror-saved under ESPN key: ${mirrorId}`);
            }
          } catch (mirrorErr: any) {
            log(`[prefetch] mirror-save failed: ${mirrorErr?.message}`);
          }
        }
      }
    }

    // ── Cache hygiene ─────────────────────────────────────────────────────
    // Component caches refresh by TTL but rows were never deleted, so the table
    // grows unbounded. Critically, the sync route's prefetch norm-scan reads at
    // most 60 prefetch:* rows — stale blobs would eventually crowd out fresh ones.
    // All of these are re-fetchable caches; ages are well past every read TTL.
    const CLEANUP: Array<[string, number]> = [
      ['prefetch:',   4 * 86_400_000],
      ['pc:odds:',    4 * 86_400_000],
      ['pc:ref:',     4 * 86_400_000],
      ['pc:hist:',    7 * 86_400_000],
      ['pc:squad:',   7 * 86_400_000],
      ['pc:players:', 7 * 86_400_000],
      ['standings:',  7 * 86_400_000],
      ['af:plid:',   30 * 86_400_000],
    ];
    let cleaned = 0;
    for (const [prefix, age] of CLEANUP) {
      cleaned += await kvDeleteOlderThan(prefix, age);
    }
    if (cleaned > 0) log(`[prefetch] cleanup: ${cleaned} stale cache rows deleted`);

    // Refresh api-sports player cache if stale — keeps sync from ever blocking on it mid-match
    const SPORTS_TTL = 23 * 60 * 60 * 1000;
    try {
      const sportsCached = await kvGet<{ scraped: number; players: unknown[] }>('api_sports_v2_cache');
      if (!sportsCached || Date.now() - sportsCached.scraped >= SPORTS_TTL) {
        log('[prefetch] refreshing api-sports player cache...');
        const index = await fetchApiSportsIndex(afApiKey);
        const players = Array.from(index.values());
        if (players.length > 0) {
          await kvSet('api_sports_v2_cache', { scraped: Date.now(), players });
          log(`[prefetch] api-sports cache saved — ${players.length} players`);
        }
      } else {
        const ageMin = Math.round((Date.now() - sportsCached.scraped) / 60000);
        log(`[prefetch] api-sports cache fresh — ${sportsCached.players?.length ?? 0} players, ${ageMin}m old`);
      }
    } catch (err: any) {
      log(`[prefetch] api-sports refresh failed (non-fatal): ${err.message}`);
    }

    log(`[prefetch] Done — ${done} fetched, ${skipped} skipped (fresh)`);
    return NextResponse.json({ ok: true, done, skipped, total: nearTerm.length, logs });
  } catch (err: any) {
    log(`[prefetch] Fatal: ${err.message}`);
    return NextResponse.json({ ok: false, error: err.message, logs }, { status: 500 });
  }
}
