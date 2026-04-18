import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // List all keys
  const { data: allKeys, error: keysError } = await sb.from('match_cache').select('key, updated_at');

  return NextResponse.json({
    env: { hasUrl, hasKey },
    keysError: keysError?.message ?? null,
    allKeys: (allKeys ?? []).map((r: any) => ({ key: r.key, updatedAt: r.updated_at })),
  });
}
