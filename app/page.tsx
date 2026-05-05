'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { COMPETITION_CONFIG, nameToSlug } from '@/lib/competitions';

interface MatchSummary {
  id: string;
  competition: string;
  pending?: boolean;
}

const FAKE_MATCH = {
  homeTeam: { name: 'Arsenal', primaryColor: '#EF0107', badge: 'https://resources.premierleague.com/premierleague/badges/t3.png' },
  awayTeam: { name: 'Chelsea', primaryColor: '#034694', badge: 'https://resources.premierleague.com/premierleague/badges/t8.png' },
  stage: 'Matchday 38', date: '11 May 2025', kickoff: '16:00 BST',
};

export default function Home() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [showMods, setShowMods] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    function load() {
      fetch('/api/matches', { cache: 'no-store' })
        .then(r => r.json())
        .then(({ live, upcoming }) => {
          const all: MatchSummary[] = [
            ...(live ?? []),
            ...(upcoming ?? []).map((m: MatchSummary) => ({ ...m, pending: true })),
          ];
          const c: Record<string, number> = {};
          for (const m of all) {
            const slug = nameToSlug(m.competition);
            if (slug) c[slug] = (c[slug] ?? 0) + 1;
          }
          setCounts(c);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  function handleTitleClick() {
    const next = clickCount + 1;
    setClickCount(next);
    if (next >= 3) { setShowMods(v => !v); setClickCount(0); }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-10" style={{ background: '#080c14' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 sm:mb-10 text-center">
          <h1
            className="text-2xl font-black text-white tracking-tight mb-1 cursor-default select-none"
            onClick={handleTitleClick}
          >
            Cheat Sheets
          </h1>
          <p className="text-[11px] uppercase tracking-widest text-gray-600">Select a competition</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {COMPETITION_CONFIG.map(comp => {
            const count = counts[comp.slug] ?? 0;
            const hasFixtures = count > 0;
            return (
              <Link key={comp.slug} href={`/competition/${comp.slug}`}>
                <div
                  className="rounded-xl cursor-pointer transition-all hover:scale-[1.02] hover:brightness-110 flex items-center gap-3 p-4 sm:p-5"
                  style={{
                    background: '#111827',
                    border: `1px solid ${comp.color}50`,
                    boxShadow: hasFixtures ? `0 0 12px ${comp.color}18` : 'none',
                  }}
                >
                  {/* Text content */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: comp.color }}>
                      {comp.country}
                    </p>
                    <p className="text-sm sm:text-base font-black text-white leading-tight truncate">{comp.label}</p>
                    <div className="mt-0.5">
                      {hasFixtures ? (
                        <span
                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: comp.color + '22', color: comp.color }}
                        >
                          {count} {count === 1 ? 'match' : 'matches'}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.18)' }}>
                          {loaded ? 'No fixtures' : '—'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* League badge */}
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ background: comp.color + '15', border: `1px solid ${comp.color}35` }}
                  >
                    <img
                      src={comp.badge}
                      alt={comp.label}
                      className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {showMods && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600">Modifications</p>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <button
                onClick={() => setShowMods(false)}
                className="text-[10px] uppercase tracking-widest text-gray-700 hover:text-gray-400 transition-colors"
              >
                Hide
              </button>
            </div>
            <Link href="/preview">
              <div className="rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
                   style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.3)' }}>
                <div className="px-5 py-2 flex items-center justify-between"
                     style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Premier League &nbsp;•&nbsp; {FAKE_MATCH.stage} &nbsp;•&nbsp; {FAKE_MATCH.date} &nbsp;•&nbsp; {FAKE_MATCH.kickoff}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                        style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                    Demo
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center px-4 py-4 lg:px-8 lg:py-6">
                  <div className="flex items-center gap-2 lg:gap-4">
                    <div className="w-10 h-10 lg:w-16 lg:h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                         style={{ background: FAKE_MATCH.homeTeam.primaryColor + '12', border: `1px solid ${FAKE_MATCH.homeTeam.primaryColor}40` }}>
                      <img src={FAKE_MATCH.homeTeam.badge} alt={FAKE_MATCH.homeTeam.name} className="w-8 h-8 lg:w-12 lg:h-12 object-contain" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm lg:text-base font-black text-white leading-tight">{FAKE_MATCH.homeTeam.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 hidden sm:block">Home</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl lg:text-5xl font-black" style={{ color: 'rgba(255,255,255,0.06)' }}>VS</p>
                  </div>
                  <div className="flex items-center gap-2 lg:gap-4 justify-end">
                    <div className="text-right min-w-0">
                      <p className="text-sm lg:text-base font-black text-white leading-tight">{FAKE_MATCH.awayTeam.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 hidden sm:block">Away</p>
                    </div>
                    <div className="w-10 h-10 lg:w-16 lg:h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                         style={{ background: FAKE_MATCH.awayTeam.primaryColor + '12', border: `1px solid ${FAKE_MATCH.awayTeam.primaryColor}40` }}>
                      <img src={FAKE_MATCH.awayTeam.badge} alt={FAKE_MATCH.awayTeam.name} className="w-8 h-8 lg:w-12 lg:h-12 object-contain" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
