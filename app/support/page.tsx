'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SupportPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
      } else {
        setStatus('sent');
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '13px',
    padding: '10px 12px',
    width: '100%',
    outline: 'none',
  } as React.CSSProperties;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#080c14' }}>
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Link href="/home" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">← Back</Link>
      </div>

      <div className="w-full max-w-md">
        <h1 className="text-2xl font-black text-white tracking-tight mb-1">Contact Support</h1>
        <p className="text-sm text-gray-500 mb-8">We&apos;ll get back to you as soon as possible.</p>

        {status === 'sent' ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)' }}
          >
            <p className="text-green-400 font-bold mb-1">Message sent</p>
            <p className="text-sm text-gray-400">Thanks for reaching out. We&apos;ll be in touch soon.</p>
            <Link href="/home" className="inline-block mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors">← Back to dashboard</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
                className="placeholder-gray-700 focus:border-green-800"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
                className="placeholder-gray-700 focus:border-green-800"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="How can we help?"
                required
                rows={5}
                maxLength={2000}
                style={{ ...inputStyle, resize: 'none' }}
                className="placeholder-gray-700 focus:border-green-800"
              />
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-xs">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#16a34a', color: '#fff' }}
            >
              {status === 'sending' ? 'Sending...' : 'Send message'}
            </button>
          </form>
        )}

        <div
          className="mt-8 rounded-xl p-4 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-[11px] text-gray-600 mb-1">Prefer to email directly?</p>
          <a
            href="mailto:support@cheatsheets.co.uk"
            className="text-xs font-semibold hover:text-green-400 transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            support@cheatsheets.co.uk
          </a>
        </div>
      </div>
    </div>
  );
}
