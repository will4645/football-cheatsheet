import { notFound } from 'next/navigation';
import { matchData as staticMatchData } from '@/data/match';
import { getMatch } from '@/lib/store';
import MatchSheet from '@/components/MatchSheet';

export const dynamic = 'force-dynamic';

export default async function MatchPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const liveData = await getMatch(id);
  if (liveData) return <MatchSheet data={liveData as typeof staticMatchData} />;

  if (id === 'atletico-vs-barcelona') return <MatchSheet data={staticMatchData} />;

  notFound();
}
