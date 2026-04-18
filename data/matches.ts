export interface MatchSummary {
  id: string;
  competition: string;
  stage: string;
  date: string;
  kickoff: string;
  homeTeam: { name: string; badge: string; primaryColor: string };
  awayTeam: { name: string; badge: string; primaryColor: string };
}

export const matches: MatchSummary[] = [
  {
    id: 'atletico-vs-barcelona',
    competition: 'UEFA Champions League',
    stage: 'Quarter-Final',
    date: '18 April 2026',
    kickoff: '20:00 BST',
    homeTeam: { name: 'Atlético de Madrid', badge: 'https://crests.football-data.org/78.svg',  primaryColor: '#CE1126' },
    awayTeam: { name: 'Barcelona',           badge: 'https://crests.football-data.org/81.svg',  primaryColor: '#004D98' },
  },
];
