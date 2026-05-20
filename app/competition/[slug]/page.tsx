'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { slugToConfig } from '@/lib/competitions';

interface AnyMatch {
  id: string;
  competition: string;
  stage: string;
  date: string;
  kickoff: string;
  utcDate?: string;
  homeTeam: { name: string; badge: string; primaryColor: string };
  awayTeam: { name: string; badge: string; primaryColor: string };
  pending?: boolean;
}

function matchesComp(matchComp: string, apiNames: string[]): boolean {
  const lower = matchComp.toLowerCase();
  return apiNames.some(n => lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower));
}

export default function CompetitionPage() {
  const params = useParams();
  const slug = params.slug as string;
  const comp = slugToConfig(slug);
  const router = useRouter();

  const [matches, setMatches] = useState<AnyMatch[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Subscription gate
  useEffect(() => {
    fetch('/api/user/subscription')
      .then(r => r.json())
      .then(({ subscribed }) => { if (!subscribed) router.replace('/pricing'); })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!comp) return;
    function load() {
      fetch('/api/matches', { cache: 'no-store' })
        .then(r => r.json())
        .then(({ live, upcoming }) => {
          const now = Date.now();
          const liveIds = new Set((live ?? []).map((m: AnyMatch) => m.id));
          const pending = (upcoming ?? [])
            .filter((m: AnyMatch) => !liveIds.has(m.id))
            .filter((m: AnyMatch) => !m.utcDate || new Date(m.utcDate).getTime() > now - 5 * 60_000)
            .map((m: AnyMatch) => ({ ...m, pending: true }));
          const activeLive = live ?? [];
          const all: AnyMatch[] = [...activeLive, ...pending];
          const filtered = all.filter(m => matchesComp(m.competition, comp!.apiNames));
          filtered.sort((a, b) => {
            const ta = a.utcDate ? new Date(a.utcDate).getTime() : 0;
            const tb = b.utcDate ? new Date(b.utcDate).getTime() : 0;
            return ta - tb;
          });
          setMatches(filtered);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [slug]);

  if (!comp) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
        <p className="text-gray-500 text-sm">Competition not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-10" style={{ background: '#080c14' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-400 transition-colors text-sm">
            ← Back
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: comp.color }}>
              {comp.country}
            </p>
            <h1 className="text-xl font-black text-white tracking-tight">{comp.label}</h1>
          </div>
          <Link href="/home"
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Home
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {matches.map(match =>
            match.pending ? (
              <div key={match.id} className="rounded-xl overflow-hidden opacity-50"
                   style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
                <MatchCard match={match} pending accentColor={comp.color} />
              </div>
            ) : (
              <Link key={match.id} href={`/match/${match.id}`}>
                <div className="rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
                     style={{ background: '#111827', border: `1px solid ${comp.color}30` }}>
                  <MatchCard match={match} accentColor={comp.color} />
                </div>
              </Link>
            )
          )}

          {loaded && matches.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-600 text-sm">No upcoming fixtures.</p>
              <p className="text-gray-700 text-[11px] mt-2">Lineups are usually confirmed 1 hour before kickoff.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, pending = false, accentColor }: { match: AnyMatch; pending?: boolean; accentColor: string }) {
  return (
    <>
      <div className="px-5 py-2 flex items-center justify-between"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          {match.stage} &nbsp;•&nbsp; {match.date} &nbsp;•&nbsp; {match.kickoff}
        </span>
        {pending && (
          <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
            Lineups Pending
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 items-center px-4 py-4 lg:px-8 lg:py-6">
        <div className="flex items-center gap-2 lg:gap-4">
          <div className="w-10 h-10 lg:w-16 lg:h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
               style={{ background: match.homeTeam.primaryColor + '12', border: `1px solid ${match.homeTeam.primaryColor}40` }}>
            <img src={match.homeTeam.badge} alt={match.homeTeam.name} className="w-8 h-8 lg:w-12 lg:h-12 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-sm lg:text-base font-black text-white leading-tight truncate">{match.homeTeam.name}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 hidden sm:block">Home</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-3xl lg:text-5xl font-black" style={{ color: 'rgba(255,255,255,0.06)' }}>VS</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-4 justify-end">
          <div className="text-right min-w-0">
            <p className="text-sm lg:text-base font-black text-white leading-tight truncate">{match.awayTeam.name}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 hidden sm:block">Away</p>
          </div>
          <div className="w-10 h-10 lg:w-16 lg:h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
               style={{ background: match.awayTeam.primaryColor + '12', border: `1px solid ${match.awayTeam.primaryColor}40` }}>
            <img src={match.awayTeam.badge} alt={match.awayTeam.name} className="w-8 h-8 lg:w-12 lg:h-12 object-contain" />
          </div>
        </div>
      </div>
    </>
  );
}
