'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { COMPETITION_CONFIG, nameToSlug } from '@/lib/competitions';
import OnboardingModal from '@/components/OnboardingModal';

interface MatchSummary {
  id: string;
  competition: string;
  pending?: boolean;
}

export default function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get('subscribed') === '1';

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

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-10" style={{ background: '#080c14' }}>
      <div className="max-w-4xl mx-auto">

        <OnboardingModal />

        {/* Header */}
        <div className="flex items-center mb-8 sm:mb-10">
          <div className="flex-1" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <img src="/logo-icon.png" alt="" className="w-7 h-7" />
              <h1 className="text-2xl font-black text-white tracking-tight">Cheat Sheets</h1>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-gray-600">Select a competition</p>
          </div>
          <div className="flex-1 flex items-center justify-end gap-2">
            <Link href="/account"
              className="hidden sm:block text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Account
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>

        {justSubscribed && (
          <div className="mb-6 rounded-xl px-4 py-3 text-sm font-medium text-center"
            style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', color: '#4ade80' }}>
            Welcome! Your subscription is active.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {!loaded && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 sm:p-5 flex items-center gap-3 animate-pulse"
                 style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex-1 space-y-2">
                <div className="h-2 w-16 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-4 w-28 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-2 w-10 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
              </div>
              <div className="w-12 h-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
            </div>
          ))}
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
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: comp.color }}>
                      {comp.country}
                    </p>
                    <p className="text-sm sm:text-base font-black text-white leading-tight truncate">{comp.label}</p>
                    <div className="mt-0.5">
                      {hasFixtures ? (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: comp.color + '22', color: comp.color }}>
                          {count} {count === 1 ? 'match' : 'matches'}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.18)' }}>
                          {loaded ? 'No fixtures' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ background: comp.color + '15', border: `1px solid ${comp.color}35` }}>
                    <img src={comp.badge} alt={comp.label}
                      className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {loading ? '...' : 'Billing'}
    </button>
  );
}
