'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AnyMatch {
  id: string;
  competition: string;
  stage: string;
  date: string;
  kickoff: string;
  homeTeam: { name: string; badge: string; primaryColor: string };
  awayTeam: { name: string; badge: string; primaryColor: string };
  pending?: boolean;
}

function groupByCompetition(matches: AnyMatch[]) {
  const order: string[] = [];
  const map = new Map<string, AnyMatch[]>();
  for (const m of matches) {
    if (!map.has(m.competition)) { map.set(m.competition, []); order.push(m.competition); }
    map.get(m.competition)!.push(m);
  }
  return order.map(competition => ({ competition, matches: map.get(competition)! }));
}

export default function Home() {
  const [allMatches, setAllMatches] = useState<AnyMatch[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/matches', { cache: 'no-store' })
      .then(r => r.json())
      .then(({ live, upcoming }) => {
        const liveIds = new Set((live ?? []).map((m: AnyMatch) => m.id));
        const pending = (upcoming ?? []).filter((m: AnyMatch) => !liveIds.has(m.id)).map((m: AnyMatch) => ({ ...m, pending: true }));
        setAllMatches([...(live ?? []), ...pending]);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const groups = groupByCompetition(allMatches);

  return (
    <div className="min-h-screen p-6 lg:p-10" style={{ background: '#080c14' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black text-white tracking-tight mb-1">Cheat Sheets</h1>
          <p className="text-[11px] uppercase tracking-widest text-gray-600">Select a match to view</p>
        </div>

        <div className="flex flex-col gap-8">
          {groups.map(({ competition, matches }) => (
            <div key={competition}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">{competition}</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div className="flex flex-col gap-3">
                {matches.map(match =>
                  match.pending ? (
                    <div key={match.id} className="rounded-xl overflow-hidden opacity-50"
                         style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <MatchCard match={match} pending />
                    </div>
                  ) : (
                    <Link key={match.id} href={`/match/${match.id}`}>
                      <div className="rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
                           style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <MatchCard match={match} />
                      </div>
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}

          {loaded && allMatches.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-600 text-sm">No upcoming matches found.</p>
              <p className="text-gray-700 text-[11px] mt-2">The sync bot checks every 5 minutes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, pending = false }: { match: AnyMatch; pending?: boolean }) {
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
