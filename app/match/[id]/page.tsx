'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import MatchSheet from '@/components/MatchSheet';

export default function MatchPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'notfound'>('loading');

  // Subscription gate
  useEffect(() => {
    fetch('/api/user/subscription')
      .then(r => r.json())
      .then(({ subscribed }) => { if (!subscribed) router.replace('/pricing'); })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    function load() {
      fetch(`/api/matches/${id}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && !d.error) { setData(d); setStatus('found'); }
          else setStatus('notfound');
        })
        .catch(() => setStatus('notfound'));
    }
    load();
    const interval = setInterval(load, 120_000);
    return () => clearInterval(interval);
  }, [id]);

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  );

  if (status === 'notfound') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
      <p className="text-gray-500 text-sm">Match not found.</p>
    </div>
  );

  return <MatchSheet data={data} />;
}
