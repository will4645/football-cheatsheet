import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serverNow = new Date().toISOString();

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Live write test — proves whether writes work from this Vercel context
  const testTs = Date.now();
  const { error: writeErr } = await sb.from('match_cache').upsert(
    { key: '__debug_test__', value: { ts: testTs }, updated_at: serverNow },
    { onConflict: 'key' }
  );
  const { data: testRow, error: readErr } = await sb.from('match_cache')
    .select('value').eq('key', '__debug_test__').single();
  const testReadBack = testRow?.value?.ts;

  // List all keys
  const { data: allKeys, error: keysError } = await sb.from('match_cache').select('key, updated_at');

  const id = req.nextUrl.searchParams.get('id') ?? 'newcastle-united-fc-vs-afc-bournemouth';
  const { data: matchRow } = await sb.from('match_cache').select('value').eq('key', `match:${id}`).single();

  return NextResponse.json({
    serverNow,
    writeTest: {
      wrote: testTs,
      readBack: testReadBack,
      match: testReadBack === testTs,
      writeErr: writeErr?.message ?? null,
      readErr: readErr?.message ?? null,
    },
    env: { hasUrl, hasKey },
    keysError: keysError?.message ?? null,
    allKeys: (allKeys ?? []).map((r: any) => ({ key: r.key, updatedAt: r.updated_at })),
    matchStats: matchRow?.value ? {
      homeCorners: matchRow.value.homeTeam?.stats?.cornersFor,
      awayCorners: matchRow.value.awayTeam?.stats?.cornersFor,
      homeShots: matchRow.value.homeTeam?.stats?.shotsFor,
    } : null,
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
