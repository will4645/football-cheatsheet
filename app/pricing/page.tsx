'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function subscribe() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      if (res.status === 401) { router.push('/sign-up'); return; }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#080c14' }}>

      {/* Back */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Link href="/" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
          ← Back
        </Link>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-white tracking-tight mb-3">Get Full Access</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          Unlock every cheat sheet across all competitions, updated automatically with confirmed lineups.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(22,163,74,0.3)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3 text-center" style={{ color: '#4ade80' }}>Pro</p>
        <div className="flex items-baseline justify-center gap-1 mb-1">
          <span className="text-4xl font-black text-white">£9.99</span>
          <span className="text-sm text-gray-500">/month</span>
        </div>
        <p className="text-xs text-gray-600 mb-6 text-center">Cancel any time</p>

        <ul className="space-y-2.5 mb-8">
          {[
            'All competitions & matches',
            'Real-time lineup stats',
            'Player form last-5 dots',
            '15+ stat markets + probabilities',
            'GK saves tracking',
            'Auto-updates every 2 hours',
          ].map(item => (
            <li key={item} className="flex items-center gap-2 text-xs text-gray-300">
              <span style={{ color: '#4ade80' }}>✓</span> {item}
            </li>
          ))}
        </ul>

        <button
          onClick={subscribe}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: '#16a34a', color: '#fff' }}
        >
          {loading ? 'Redirecting...' : 'Subscribe for £9.99/mo'}
        </button>
        {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
        <p className="text-[10px] text-gray-700 text-center mt-3">Secure payment via Stripe</p>
      </div>

      <div className="mt-6">
        <Link href="/preview" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          View demo first →
        </Link>
      </div>
    </div>
  );
}
