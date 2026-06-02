import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isSubscribed } from '@/lib/subscription';

// Keep dynamic — params.id is needed at runtime. Vercel CDN caching is driven by the
// Cache-Control s-maxage header below, not by the dynamic export.
export const dynamic = 'force-dynamic';

const DEMO_IDS = new Set([
  'fulham-vs-getafe-cf',
  'atletico-vs-barcelona',
  'atletico-de-madrid-vs-barcelona',
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Demo matches are public (used on the preview/landing page).
  // All real match sheets require an active subscription.
  if (!DEMO_IDS.has(id)) {
    try {
      const { userId } = await auth();
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const subscribed = await isSubscribed(userId);
      if (!subscribed) return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    } catch (authErr: any) {
      console.error('[matches/id] auth error:', authErr?.message ?? authErr);
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }
  }

  // Read from Supabase directly
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        global: { fetch: (url: RequestInfo | URL, opts?: RequestInit) => fetch(url, { ...opts, cache: 'no-store' }) },
      });
      const { data } = await sb.from('match_cache').select('value').eq('key', `match:${id}`).single();
      if (data?.value) return NextResponse.json(data.value, {
        // private: CDN must not cache — auth-gated content must never be shared across users
        headers: { 'Cache-Control': 'private, max-age=55, stale-while-revalidate=300' },
      });
    } catch (e: any) {
      console.error('[matches/id] Supabase error:', e.message);
    }
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
