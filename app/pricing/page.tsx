'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const MONTHLY_FEATURES = [
  'All competitions & matches',
  'Real-time lineup stats',
  'Player form last-5 dots',
  '15+ stat markets + probabilities',
  'GK saves tracking',
  'Automatic updates',
];

const YEARLY_FEATURES = [
  'Everything in Monthly',
  'Save £39.89 compared to monthly',
];

function PlanCard({
  label,
  price,
  sub,
  note,
  billing,
  highlighted,
  features,
}: {
  label: string;
  price: string;
  sub: string;
  note?: string;
  billing: 'monthly' | 'annual';
  highlighted?: boolean;
  features: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function subscribe() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing }),
      });
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
    <div
      className="flex-1 rounded-2xl p-7 flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: highlighted ? '1px solid rgba(22,163,74,0.4)' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: highlighted ? '0 0 32px rgba(22,163,74,0.1)' : 'none',
      }}
    >
      {highlighted && (
        <div className="text-center mb-3">
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(22,163,74,0.15)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.3)' }}
          >
            Best value
          </span>
        </div>
      )}

      <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: '#4ade80' }}>{label}</p>

      <div className="flex items-baseline justify-center gap-1 mb-0.5">
        <span className="text-4xl font-black text-white">{price}</span>
        <span className="text-sm text-gray-500">{sub}</span>
      </div>

      {note && (
        <p className="text-xs text-center mt-1 mb-1" style={{ color: '#4ade80' }}>{note}</p>
      )}

      <p className="text-xs text-gray-600 mb-1 text-center mt-2">
        7-day free trial · Cancel any time
      </p>
      {billing === 'annual' && (
        <p className="text-[10px] text-center mb-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Non-refundable once payment is taken
        </p>
      )}
      {billing !== 'annual' && <div className="mb-6" />}

      <ul className="space-y-2.5 mb-8 flex-1">
        {features.map(item => (
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
        {loading ? 'Redirecting...' : 'Start 7-day free trial'}
      </button>

      {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}

      <p className="text-[10px] text-gray-700 text-center mt-3">Secure payment via Stripe · No charge for 7 days</p>
      <p className="text-[10px] text-gray-700 text-center mt-2 leading-relaxed">
        By subscribing you agree to our{' '}
        <Link href="/terms" className="hover:text-gray-500 transition-colors">Terms of Service</Link>
        {' '}and{' '}
        <Link href="/privacy" className="hover:text-gray-500 transition-colors">Privacy Policy</Link>.
        {billing === 'annual' ? ' Billed annually.' : ' Subscription renews monthly.'} Cancel any time.
      </p>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#080c14' }}>

      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Link href="/" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">← Back</Link>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-white tracking-tight mb-3">Get Full Access</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          Unlock every cheat sheet across all competitions, updated automatically with confirmed lineups.
        </p>
      </div>

      <div className="w-full max-w-xl flex flex-col sm:flex-row gap-4">
        <PlanCard
          label="Monthly"
          price="£9.99"
          sub="/month"
          billing="monthly"
          features={MONTHLY_FEATURES}
        />
        <PlanCard
          label="Yearly"
          price="£6.66"
          sub="/mo"
          note="Billed as £79.99 / year · Save 33%"
          billing="annual"
          highlighted
          features={YEARLY_FEATURES}
        />
      </div>

      <div className="mt-6">
        <Link href="/preview" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          View demo first →
        </Link>
      </div>
    </div>
  );
}
