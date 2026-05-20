import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isSubscribed } from '@/lib/subscription';
import Link from 'next/link';

export default async function LandingPage() {
  // Send logged-in subscribers straight to dashboard
  const { userId } = await auth();
  if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY && await isSubscribed(userId)) {
    redirect('/home');
  }

  return (
    <div className="min-h-screen" style={{ background: '#080c14', color: '#fff' }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo-icon.png" alt="Cheat Sheets" className="w-7 h-7" />
          <span className="text-base font-black tracking-tight text-white">Cheat Sheets</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/how-it-works" className="text-sm text-gray-500 hover:text-white transition-colors px-3 py-1.5 hidden sm:block">
            How it works
          </Link>
          <Link href="/sign-in" className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link href="/sign-up" className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
            style={{ background: '#16a34a', color: '#fff' }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-6 pb-20 max-w-3xl mx-auto">
        {/* Brand logo */}
        <div className="mb-4">
          <img
            src="/logo-icon.png"
            alt="Cheat Sheets"
            className="mx-auto"
            style={{ height: '180px', width: 'auto' }}
          />
          <p className="text-3xl sm:text-4xl font-black tracking-[0.18em] text-white mt-3">CHEAT SHEETS</p>
          <p className="text-xs font-bold tracking-[0.45em] mt-1" style={{ color: '#4ade80' }}>KNOW THE GAME.</p>
        </div>
        <div className="inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-6"
          style={{ background: 'rgba(22,163,74,0.15)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.3)' }}>
          Real-time football intelligence
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5 tracking-tight">
          The Football Analyst's<br />
          <span style={{ color: '#4ade80' }}>Cheat Sheet</span>
        </h1>
        <p className="text-base sm:text-lg text-gray-400 mb-8 leading-relaxed max-w-xl mx-auto">
          Confirmed lineups, player form, and statistical analysis across every major competition. All in one place before kick-off.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/sign-up"
            className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
            style={{ background: '#16a34a', color: '#fff', boxShadow: '0 0 24px rgba(22,163,74,0.4)' }}>
            Start for £9.99/month
          </Link>
          <Link href="/preview"
            className="px-8 py-3 rounded-xl font-semibold text-sm border transition-colors hover:bg-white/5"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
            View live demo
          </Link>
        </div>
        <Link href="/how-it-works" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mt-4 inline-block">
          See how every section works →
        </Link>
      </section>

      {/* Feature strip */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              title: 'Confirmed Lineups',
              desc: 'Stats built from the actual starting XI. No guesswork, no wasted analysis.',
              icon: '⚡',
            },
            {
              title: 'Player Form Dots',
              desc: 'Last 5 game dots for shots, fouls, cards and goals. Spot in-form players instantly.',
              icon: '●',
            },
            {
              title: '15+ Stat Markets',
              desc: 'Corners, shots, fouls, cards, offsides and free kicks as season averages. Goals from last 10 games. All with market-calibrated probabilities.',
              icon: '%',
            },
          ].map(f => (
            <div key={f.title} className="rounded-xl p-5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-2xl mb-3 font-black" style={{ color: '#4ade80', fontFamily: 'monospace' }}>{f.icon}</div>
              <h3 className="font-bold text-sm text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Competitions */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <p className="text-center text-[10px] uppercase tracking-widest text-gray-600 mb-8">Covers all major competitions</p>

        <div className="space-y-6">
          {/* Leagues */}
          <div>
            <div className="flex justify-center mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)' }}>
                Leagues
              </span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Premier League', 'Championship', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Primeira Liga', 'Eredivisie', 'Belgian Pro League', 'Scottish Premiership', 'Süper Lig'].map(c => (
                <span key={c} className="text-[11px] font-medium px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Cups */}
          <div>
            <div className="flex justify-center mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)' }}>
                Cups
              </span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Champions League', 'Europa League', 'Conference League'].map(c => (
                <span key={c} className="text-[11px] font-medium px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-xl mx-auto px-6 pb-24">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-6 text-center">Pricing</p>
        <div className="flex flex-col sm:flex-row gap-4">

          {/* Monthly */}
          <div className="flex-1 rounded-2xl p-7 flex flex-col"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: '#4ade80' }}>Monthly</p>
            <div className="flex items-baseline justify-center gap-1 mb-4">
              <span className="text-4xl font-black text-white">£9.99</span>
              <span className="text-sm text-gray-500">/month</span>
            </div>
            <ul className="text-left space-y-2 mb-8 flex-1">
              {[
                'All competitions & matches',
                'Real-time lineup stats',
                'Player form last-5 dots',
                '15+ stat markets with probabilities',
                'GK saves tracking',
                'Automatic updates',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-gray-300">
                  <span style={{ color: '#4ade80' }}>✓</span> {item}
                </li>
              ))}
            </ul>
            <Link href="/sign-up"
              className="block w-full py-3 rounded-xl font-bold text-sm text-center transition-all hover:brightness-110"
              style={{ background: '#16a34a', color: '#fff' }}>
              Get Started
            </Link>
          </div>

          {/* Yearly */}
          <div className="flex-1 rounded-2xl p-7 flex flex-col"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(22,163,74,0.4)', boxShadow: '0 0 32px rgba(22,163,74,0.1)' }}>
            <div className="text-center mb-3">
              <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(22,163,74,0.15)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.3)' }}>
                Best value
              </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 text-center" style={{ color: '#4ade80' }}>Yearly</p>
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-4xl font-black text-white">£6.66</span>
              <span className="text-sm text-gray-500">/mo</span>
            </div>
            <p className="text-xs text-center mb-1" style={{ color: '#4ade80' }}>Billed as £79.99 / year · Save 33%</p>
            <p className="text-[10px] text-center mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Non-refundable once payment is taken</p>
            <ul className="text-left space-y-2 mb-8 flex-1">
              {[
                'Everything in Monthly',
                'Save £39.89 compared to monthly',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-gray-300">
                  <span style={{ color: '#4ade80' }}>✓</span> {item}
                </li>
              ))}
            </ul>
            <Link href="/sign-up"
              className="block w-full py-3 rounded-xl font-bold text-sm text-center transition-all hover:brightness-110"
              style={{ background: '#16a34a', color: '#fff' }}>
              Get Started
            </Link>
          </div>

        </div>
      </section>

    </div>
  );
}
