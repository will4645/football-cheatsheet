import { NextRequest, NextResponse } from 'next/server';
import { prefetchMatch } from '@/lib/prefetch';
import { fetchAfFixturesByDateRange } from '@/lib/api-football';
import { kvGet } from '@/lib/store';

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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  const afApiKey = (process.env.API_SPORTS_KEY ?? '').trim();
  if (!afApiKey) return NextResponse.json({ error: 'no API_SPORTS_KEY' }, { status: 500 });

  const force = req.nextUrl.searchParams.get('force') === '1';

  // fd.org competition code → AF domestic league ID (cups omitted — guessDomesticLeagueId handles those)
  const FD_CODE_TO_AF_LEAGUE: Record<string, number> = {
    PL: 39, PD: 140, BL1: 78, SA: 135, FL1: 61,
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
    if (!res.ok) return NextResponse.json({ error: `fd.org ${res.status}` }, { status: 500 });

    const data = await res.json();
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

    // Also prefetch AF-supplement leagues (Championship, Scottish Prem, etc.)
    const AF_PREFETCH_LEAGUES = [40];
    const afFixtureBatches = await Promise.all(
      AF_PREFETCH_LEAGUES.map(id =>
        fetchAfFixturesByDateRange(id, fmt(from), fmt(to), 2025, afApiKey).catch(() => []).then(fixes => ({ id, fixes }))
      )
    );
    for (const { id: lgId, fixes } of afFixtureBatches) {
      for (const fix of fixes) {
        if (!fix.home.name || !fix.away.name) continue;
        const hoursAway = (new Date(fix.utcDate).getTime() - Date.now()) / 3_600_000;
        if (hoursAway > -2 && hoursAway < 24) {
          nearTerm.push({ homeTeam: { name: fix.home.name }, awayTeam: { name: fix.away.name }, utcDate: fix.utcDate, afLeagueId: lgId });
        }
      }
    }
    log(`[prefetch] ${nearTerm.length} near-term matches (fd.org + AF leagues)`);

    let done = 0, skipped = 0;
    for (const m of nearTerm) {
      const id = matchSlug(m.homeTeam.name, m.awayTeam.name);

      if (!force) {
        const existing = await kvGet<any>(`prefetch:${id}`);
        // Skip if prefetched within the last 20 hours (component caches own freshness)
        if (existing?.fetchedAt && Date.now() - existing.fetchedAt < 20 * 60 * 60 * 1000) {
          log(`[prefetch] skip (fresh): ${id}`);
          skipped++;
          continue;
        }
      }

      const ok = await prefetchMatch(id, m.homeTeam.name, m.awayTeam.name, m.utcDate, afApiKey, log, m.afLeagueId);
      if (ok) done++;
    }

    log(`[prefetch] Done — ${done} fetched, ${skipped} skipped (fresh)`);
    return NextResponse.json({ ok: true, done, skipped, total: nearTerm.length, logs });
  } catch (err: any) {
    log(`[prefetch] Fatal: ${err.message}`);
    return NextResponse.json({ ok: false, error: err.message, logs }, { status: 500 });
  }
}
