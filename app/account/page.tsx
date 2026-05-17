'use client';

import { useEffect, useState } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AccountPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetch('/api/user/subscription')
      .then(r => r.json())
      .then(({ subscribed: s, status, currentPeriodEnd }) => {
        if (!s) router.replace('/pricing');
        else { setSubscribed(s); setSubStatus(status); setPeriodEnd(currentPeriodEnd); }
      })
      .catch(() => {});
  }, [router]);

  async function openPortal() {
    setPortalLoading(true);
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setPortalLoading(false);
  }

  async function deleteAccount() {
    setDeleteLoading(true);
    try {
      await user?.delete();
      router.replace('/');
    } catch {
      setDeleteLoading(false);
      setDeleteConfirm(false);
    }
  }

  if (!isLoaded || subscribed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
        <div className="w-48 h-4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-10" style={{ background: '#080c14' }}>
      <div className="max-w-lg mx-auto">

        <div className="flex items-center gap-4 mb-10">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-400 transition-colors text-sm">← Dashboard</Link>
        </div>

        <h1 className="text-xl font-black text-white mb-8 tracking-tight">Account</h1>

        {/* Profile */}
        <div className="rounded-xl p-5 mb-4" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-4">Profile</p>
          <div className="flex items-center gap-4">
            <UserButton afterSignOutUrl="/" />
            <div>
              <p className="text-sm font-bold text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="rounded-xl p-5 mb-4" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-4">Subscription</p>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-white">Pro Plan</p>
              <p className="text-xs text-gray-500">
                {subStatus === 'trialing'
                  ? `Free trial${periodEnd ? ` · ends ${new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
                  : subStatus === 'past_due'
                  ? 'Payment past due'
                  : periodEnd
                  ? `Renews ${new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Auto-renews'}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
              style={{
                background: subStatus === 'trialing' ? 'rgba(59,130,246,0.15)' : subStatus === 'past_due' ? 'rgba(239,68,68,0.15)' : 'rgba(22,163,74,0.15)',
                color: subStatus === 'trialing' ? '#93c5fd' : subStatus === 'past_due' ? '#f87171' : '#4ade80',
                border: `1px solid ${subStatus === 'trialing' ? 'rgba(59,130,246,0.3)' : subStatus === 'past_due' ? 'rgba(239,68,68,0.3)' : 'rgba(22,163,74,0.3)'}`,
              }}>
              {subStatus === 'trialing' ? 'Trial' : subStatus === 'past_due' ? 'Past Due' : 'Active'}
            </span>
          </div>
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {portalLoading ? 'Opening...' : 'Manage billing & cancel'}
          </button>
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            You&apos;ll be taken to Stripe to manage your subscription.
          </p>
        </div>

        {/* Danger zone */}
        <div className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: 'rgba(239,68,68,0.6)' }}>Danger Zone</p>
          {!deleteConfirm ? (
            <>
              <p className="text-xs text-gray-500 mb-4">
                Permanently delete your account and all associated data. This cannot be undone.
                Cancel your subscription first to avoid further charges.
              </p>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:bg-red-500/10"
                style={{ color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                Delete account
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-white font-bold mb-2">Are you sure?</p>
              <p className="text-xs text-gray-500 mb-4">
                This will permanently delete your account. Cancel your Stripe subscription separately to stop charges.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={deleteAccount}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  {deleteLoading ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
