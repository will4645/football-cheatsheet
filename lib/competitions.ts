export interface CompetitionConfig {
  slug: string;
  label: string;
  country: string;
  apiNames: string[];
  color: string;
  badge: string;
}

export const COMPETITION_CONFIG: CompetitionConfig[] = [
  { slug: 'premier-league',    label: 'Premier League',   country: 'England', apiNames: ['Premier League'],               color: '#7E22CE', badge: 'https://crests.football-data.org/PL.png' },
  { slug: 'champions-league',  label: 'Champions League', country: 'Europe',  apiNames: ['UEFA Champions League'],        color: '#3B82F6', badge: '/badges/cl.png' },
  { slug: 'europa-league',     label: 'Europa League',    country: 'Europe',  apiNames: ['UEFA Europa League'],           color: '#F36F21', badge: 'https://crests.football-data.org/EL.png' },
  { slug: 'conference-league', label: 'Conference League',country: 'Europe',  apiNames: ['UEFA Europa Conference League'],color: '#00A551', badge: '/badges/ecl.png' },
  { slug: 'la-liga',           label: 'La Liga',          country: 'Spain',   apiNames: ['Primera Division', 'La Liga'], color: '#FF4B44', badge: 'https://crests.football-data.org/PD.png' },
  { slug: 'bundesliga',        label: 'Bundesliga',       country: 'Germany', apiNames: ['Bundesliga'],                  color: '#D00027', badge: 'https://crests.football-data.org/BL1.png' },
  { slug: 'serie-a',           label: 'Serie A',          country: 'Italy',   apiNames: ['Serie A'],                     color: '#009FE3', badge: 'https://crests.football-data.org/SA.png' },
  { slug: 'ligue-1',           label: 'Ligue 1',          country: 'France',  apiNames: ['Ligue 1'],                     color: '#DFFE00', badge: 'https://crests.football-data.org/FL1.png' },
];

export function slugToConfig(slug: string): CompetitionConfig | undefined {
  return COMPETITION_CONFIG.find(c => c.slug === slug);
}

export function nameToSlug(name: string): string | undefined {
  const lower = name.toLowerCase();
  return COMPETITION_CONFIG.find(c => c.apiNames.some(n => lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower)))?.slug;
}
