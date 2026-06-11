import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Ops tool: proxy a single API-Football GET so AF data can be inspected without
// the key leaving Vercel. Gated by SYNC_SECRET. Example:
//   /api/af-debug?secret=...&path=/fixtures?team=770%26last=15%26season=2026
export async function GET(req: NextRequest) {
  const syncSecret = (process.env.SYNC_SECRET ?? '').trim();
  const q = req.nextUrl.searchParams.get('secret');
  if (!syncSecret || q !== syncSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!path.startsWith('/')) {
    return NextResponse.json({ error: 'path must start with /' }, { status: 400 });
  }
  const apiKey = (process.env.API_SPORTS_KEY ?? '').trim();
  if (!apiKey) return NextResponse.json({ error: 'no API_SPORTS_KEY' }, { status: 500 });
  try {
    const res = await fetch(`https://v3.football.api-sports.io${path}`, {
      headers: { 'x-apisports-key': apiKey },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
