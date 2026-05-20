import MatchSheet from '@/components/MatchSheet';
import { atleticoMatchData } from '@/data/match-atletico';

export default function PreviewPage() {
  return <MatchSheet data={atleticoMatchData} backHref="/" backLabel="Home" />;
}
