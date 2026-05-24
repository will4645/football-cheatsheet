import { NextRequest, NextResponse } from 'next/server';

// CDN-cached: Vercel edge serves this to all users for 55s before revalidating.
// The sync cron writes a new sheet every 5 min, so max staleness is ~55s + propagation.
// stale-while-revalidate=300 means the edge revalidates in the background — zero cold-cache
// latency for any user.
export const dynamic = 'force-static';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Read from Supabase directly
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      global: { fetch: (url: RequestInfo | URL, opts?: RequestInit) => fetch(url, { ...opts, cache: 'no-store' }) },
    });
    const { data } = await sb.from('match_cache').select('value').eq('key', `match:${id}`).single();
    if (data?.value) return NextResponse.json(data.value, {
      headers: { 'Cache-Control': 'public, s-maxage=55, stale-while-revalidate=300' },
    });
  }

  // Fallback: serve hardcoded demo data
  if (id === 'fulham-vs-getafe-cf') {
    const { matchData } = await import('@/data/match');
    return NextResponse.json(matchData);
  }
  if (id === 'atletico-vs-barcelona' || id === 'atletico-de-madrid-vs-barcelona') {
    const { atleticoMatchData } = await import('@/data/match-atletico');
    return NextResponse.json(atleticoMatchData);
  }

  return NextResponse.json({ error: 'Match not found' }, { status: 404 });
}
