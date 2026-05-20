'use client';

import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-10" style={{ background: '#080c14' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="relative flex items-center min-h-[60px] mb-10">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2">
              <img src="/logo-icon.png" alt="" className="w-7 h-7" />
              <span className="text-xl font-black text-white tracking-tight">Cheat Sheets</span>
            </div>
          </div>
          <div className="ml-auto relative z-10 flex flex-col items-center sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <UserButton afterSignOutUrl="/" />
            <Link
              href="/account"
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Account
            </Link>
          </div>
        </div>

        {user && (
          <p className="text-gray-600 text-sm mb-6">
            Welcome back{user.firstName ? `, ${user.firstName}` : ''}.
          </p>
        )}

        <div className="space-y-3">

          {/* Leagues */}
          <Link href="/dashboard">
            <div
              className="rounded-2xl p-6 flex items-center justify-between transition-all hover:brightness-110 hover:scale-[1.01] cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #0f1e14 0%, #111827 100%)',
                border: '1px solid rgba(22,163,74,0.35)',
                boxShadow: '0 0 40px rgba(22,163,74,0.1), inset 0 1px 0 rgba(22,163,74,0.08)',
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#4ade80' }}>Leagues</p>
                <p className="text-lg font-black text-white mb-1">Today&apos;s Fixtures</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Confirmed lineups, player form and stats across every major competition.
                </p>
              </div>
              <div
                className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center ml-4 text-2xl"
                style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)', boxShadow: '0 0 16px rgba(22,163,74,0.15)' }}
              >
                ⚽
              </div>
            </div>
          </Link>

          {/* Demo + How It Works */}
          <div className="grid grid-cols-2 gap-3">

            <Link href="/preview">
              <div
                className="rounded-2xl p-5 h-full flex flex-col gap-3 transition-all hover:brightness-110 hover:scale-[1.01] cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #0d1525 0%, #111827 100%)',
                  border: '1px solid rgba(96,165,250,0.25)',
                  boxShadow: '0 0 32px rgba(96,165,250,0.07), inset 0 1px 0 rgba(96,165,250,0.06)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}
                >
                  📋
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#60a5fa' }}>Demo</p>
                  <p className="text-sm font-black text-white mb-1.5">Live Example Sheet</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    See a full cheat sheet for a real match before you dive in.
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/how-it-works">
              <div
                className="rounded-2xl p-5 h-full flex flex-col gap-3 transition-all hover:brightness-110 hover:scale-[1.01] cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #171208 0%, #111827 100%)',
                  border: '1px solid rgba(251,191,36,0.22)',
                  boxShadow: '0 0 32px rgba(251,191,36,0.06), inset 0 1px 0 rgba(251,191,36,0.05)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}
                >
                  📖
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#fbbf24' }}>Guide</p>
                  <p className="text-sm font-black text-white mb-1.5">How It Works</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    What every section shows and how to read it quickly.
                  </p>
                </div>
              </div>
            </Link>

          </div>

          {/* Quick tip */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'linear-gradient(135deg, #0e1320 0%, #111827 100%)',
              border: '1px solid rgba(167,139,250,0.2)',
              boxShadow: '0 0 32px rgba(167,139,250,0.05)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#a78bfa' }}>Quick tip</p>
            <p className="text-sm font-bold text-white mb-1">Check the referee before anything else</p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
              The referee box shows their season average for fouls and cards per game. A high-card ref changes the value of every cards market on the sheet.
            </p>
          </div>

          {/* Account + Contact */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/account">
              <div
                className="rounded-xl p-4 flex flex-col gap-1 transition-all hover:brightness-110 hover:scale-[1.01] cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 0 20px rgba(255,255,255,0.02)',
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Account</p>
                <p className="text-xs font-semibold text-white">Manage subscription</p>
              </div>
            </Link>
            <a href="mailto:support@cheatsheets.co.uk">
              <div
                className="rounded-xl p-4 flex flex-col gap-1 transition-all hover:brightness-110 hover:scale-[1.01] cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 0 20px rgba(255,255,255,0.02)',
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Support</p>
                <p className="text-xs font-semibold text-white">Contact us</p>
              </div>
            </a>
          </div>

          {/* Legal links */}
          <div className="flex items-center justify-center gap-4 pt-2 pb-1">
            <Link href="/privacy" className="text-[11px] transition-colors" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Privacy Policy
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
            <Link href="/terms" className="text-[11px] transition-colors" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Terms of Service
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
