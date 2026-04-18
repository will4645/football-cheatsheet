import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Read from Supabase directly
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await sb.from('match_cache').select('value').eq('key', `match:${id}`).single();
    if (data?.value) return NextResponse.json(data.value, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }

  // Fallback: serve the hardcoded Atletico vs Barcelona data
  if (id === 'atletico-vs-barcelona' || id === 'atletico-de-madrid-vs-barcelona') {
    const { matchData } = await import('@/data/match');
    return NextResponse.json(matchData);
  }

  return NextResponse.json({ error: 'Match not found' }, { status: 404 });
}
