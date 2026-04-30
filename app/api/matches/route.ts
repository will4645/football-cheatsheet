import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseKickoff(match: any): Date | null {
  try {
    const [day, month, year] = (match.date || '').split(' ');
    const months: Record<string, number> = { January:0,February:1,March:2,April:3,May:4,June:5,July:6,August:7,September:8,October:9,November:10,December:11 };
    const parts = (match.kickoff || '').split(' ');
    const [h, m] = parts[0].split(':').map(Number);
    const offset = parts[1] === 'BST' ? 1 : 0; // BST=UTC+1, GMT=UTC+0
    const d = new Date(Date.UTC(Number(year), months[month], Number(day), h - offset, m));
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

export async function GET() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const [live, upcoming] = await Promise.all([
      sb.from('match_cache').select('value').eq('key', 'matches').single(),
      sb.from('match_cache').select('value').eq('key', 'upcoming').single(),
    ]);
    const now = Date.now();
    const liveFiltered = (live.data?.value ?? []).filter((m: any) => {
      const ko = parseKickoff(m);
      if (!ko) return true;
      return (now - ko.getTime()) < 3 * 60 * 60 * 1000; // remove if >3h past kickoff
    });
    const rawUpcoming = upcoming.data?.value ?? [];
    console.log('[matches] raw upcoming count:', rawUpcoming.length);
    if (rawUpcoming[0]) console.log('[matches] sample:', JSON.stringify({ date: rawUpcoming[0].date, kickoff: rawUpcoming[0].kickoff, ko: parseKickoff(rawUpcoming[0])?.toISOString(), now: new Date(now).toISOString() }));
    const upcomingFiltered = rawUpcoming.filter((m: any) => {
      const ko = parseKickoff(m);
      if (!ko) return true;
      return ko.getTime() > now;
    });
    return NextResponse.json({
      live: liveFiltered,
      upcoming: upcomingFiltered,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  }
  return NextResponse.json({ live: [], upcoming: [] });
}
