'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie-notice-dismissed')) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem('cookie-notice-dismissed', '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-5 py-3 text-xs"
      style={{
        background: '#111827',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.45)',
      }}
    >
      <p className="flex-1">
        This site uses strictly necessary cookies to keep you signed in.{' '}
        <Link href="/privacy#cookies" className="underline hover:text-gray-300 transition-colors">
          Learn more
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors hover:bg-white/10"
        style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
      >
        OK
      </button>
    </div>
  );
}
