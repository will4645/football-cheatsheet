import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const [live, upcoming] = await Promise.all([
      sb.from('match_cache').select('value').eq('key', 'matches').single(),
      sb.from('match_cache').select('value').eq('key', 'upcoming').single(),
    ]);
    return NextResponse.json({
      live: live.data?.value ?? [],
      upcoming: upcoming.data?.value ?? [],
    });
  }
  return NextResponse.json({ live: [], upcoming: [] });
}
