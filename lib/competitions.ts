export interface CompetitionConfig {
  slug: string;
  label: string;
  country: string;
  apiNames: string[];
  color: string;
  badge: string;
}

const AF = (id: number) => `https://media.api-sports.io/football/leagues/${id}.png`;

export const COMPETITION_CONFIG: CompetitionConfig[] = [
  { slug: 'premier-league',    label: 'Premier League',    country: 'England',     apiNames: ['Premier League'],                         color: '#7E22CE', badge: AF(39)  },
  { slug: 'champions-league',  label: 'Champions League',  country: 'Europe',      apiNames: ['UEFA Champions League'],                  color: '#3B82F6', badge: AF(2)   },
  { slug: 'europa-league',     label: 'Europa League',     country: 'Europe',      apiNames: ['UEFA Europa League'],                     color: '#F36F21', badge: AF(3)   },
  { slug: 'conference-league', label: 'Conference League', country: 'Europe',      apiNames: ['UEFA Europa Conference League'],           color: '#00A551', badge: AF(848) },
  { slug: 'la-liga',           label: 'La Liga',           country: 'Spain',       apiNames: ['Primera Division', 'La Liga'],            color: '#FF4B44', badge: AF(140) },
  { slug: 'bundesliga',        label: 'Bundesliga',        country: 'Germany',     apiNames: ['Bundesliga'],                             color: '#D00027', badge: AF(78)  },
  { slug: 'serie-a',           label: 'Serie A',           country: 'Italy',       apiNames: ['Serie A'],                                color: '#009FE3', badge: AF(135) },
  { slug: 'ligue-1',           label: 'Ligue 1',           country: 'France',      apiNames: ['Ligue 1'],                                color: '#DFFE00', badge: AF(61)  },
  { slug: 'eredivisie',        label: 'Eredivisie',        country: 'Netherlands', apiNames: ['Eredivisie'],                             color: '#EE7C0E', badge: AF(88)  },
  { slug: 'primeira-liga',     label: 'Primeira Liga',     country: 'Portugal',    apiNames: ['Primeira Liga'],                          color: '#009A44', badge: AF(94)  },
  { slug: 'championship',      label: 'Championship',      country: 'England',     apiNames: ['EFL Championship', 'Championship'],        color: '#0057A8', badge: AF(40)  },
  { slug: 'scottish-prem',     label: 'Scottish Prem',     country: 'Scotland',    apiNames: ['Scottish Premiership', 'Premiership'],     color: '#003087', badge: AF(179) },
  { slug: 'belgian-pro-league',label: 'Belgian Pro League',country: 'Belgium',     apiNames: ['Belgian Pro League', 'First Division A'], color: '#FDDA24', badge: AF(144) },
  { slug: 'super-lig',         label: 'Süper Lig',         country: 'Turkey',      apiNames: ['Süper Lig', 'Super Lig'],                  color: '#E30A17', badge: AF(203) },
];

export function slugToConfig(slug: string): CompetitionConfig | undefined {
  return COMPETITION_CONFIG.find(c => c.slug === slug);
}

export function nameToSlug(name: string): string | undefined {
  const lower = name.toLowerCase();
  return COMPETITION_CONFIG.find(c => c.apiNames.some(n => lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower)))?.slug;
}
