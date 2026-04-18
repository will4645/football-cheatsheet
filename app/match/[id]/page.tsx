'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import MatchSheet from '@/components/MatchSheet';

export default function MatchPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'notfound'>('loading');

  useEffect(() => {
    fetch(`/api/matches/${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && !d.error) { setData(d); setStatus('found'); }
        else setStatus('notfound');
      })
      .catch(() => setStatus('notfound'));
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
