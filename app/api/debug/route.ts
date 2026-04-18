import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const id = req.nextUrl.searchParams.get('id') ?? 'brentford-fc-vs-fulham-fc';
  const key = `match:${id}`;

  // Get ALL matching rows (not just .single()) to detect duplicates
  const { data: allRows, error } = await sb.from('match_cache').select('key, updated_at, value').eq('key', key);

  if (error) return NextResponse.json({ error: error.message });

  return NextResponse.json({
    rowCount: (allRows ?? []).length,
    rows: (allRows ?? []).map((r: any) => ({
      key: r.key,
      updatedAt: r.updated_at,
      homeStats: r.value?.homeTeam?.stats ?? null,
      awayStats: r.value?.awayTeam?.stats ?? null,
    })),
  });
}
