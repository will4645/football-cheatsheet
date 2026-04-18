export type Form = 'good' | 'ok' | 'poor';

export interface DefensivePlayer {
  name: string; mins: number; foulsPerGame: number; tacklesPerGame: number;
  last5Fouls?: boolean[]; yellowCards: number; potentialOpponent: string; form: Form;
}
export interface OffensivePlayer {
  name: string; mins: number; foulsWonPerGame: number;
  last5FoulsWon?: boolean[]; potentialOpponent: string; form: Form;
}
export interface ShootingPlayer {
  name: string; mins: number; sotPerGame: number; last5SoT?: boolean[];
  shotsPerGame: number; last5Shots?: boolean[]; badges?: string[]; form: Form;
}
export interface GoalscoringPlayer {
  name: string; mins: number; goals: number; assists: number;
  gaPerGame: number; badges?: string[];
  last5Goals?: boolean[]; last5Assists?: boolean[]; form: Form;
}
export interface TeamData {
  name: string; primaryColor: string; badge: string;
  stats: {
    goalsFor: number; goalsAgainst: number; over25Goals: number;
    cornersFor: number; cornersAgainst: number; over95Corners: number;
    shotsFor: number; shotsAgainst: number; over195Shots: number;
    sotFor: number; sotAgainst: number; over95SoT: number;
    foulsCommitted: number; foulsWon: number; over155Fouls: number;
    cardsFor: number; cardsAgainst: number; over45Cards: number;
  };
  players: {
    defensive: DefensivePlayer[];
    offensive: OffensivePlayer[];
    shooting: ShootingPlayer[];
    goalscoring: GoalscoringPlayer[];
  };
}

export const matchData: {
  competition: string; stage: string; date: string; kickoff: string;
  homeTeam: TeamData; awayTeam: TeamData;
  referee: { name: string; currentSeason: { yellows: number; reds: number; foulsPg: number }; career: { yellows: number; reds: number; foulsPg: number } };
  probabilities: { btts: number; homeWin: number; draw: number; awayWin: number };
} = {
  competition: 'UEFA Champions League',
  stage: 'Quarter-Final',
  date: '17 April 2026',
  kickoff: '20:00 BST',

  homeTeam: {
    name: 'Atlético de Madrid',
    primaryColor: '#CE1126',
    badge: 'https://crests.football-data.org/78.svg',
    stats: {
      goalsFor: 1.91, goalsAgainst: 1.27, over25Goals: 60,
      cornersFor: 4.18, cornersAgainst: 4.52, over95Corners: 40,
      shotsFor: 13.66, shotsAgainst: 11.68, over195Shots: 80,
      sotFor: 5.48, sotAgainst: 4.16, over95SoT: 80,
      foulsCommitted: 11.16, foulsWon: 8.91, over155Fouls: 100,
      cardsFor: 2.05, cardsAgainst: 2.20, over45Cards: 40,
    },
    players: {
      defensive: [
        { name: 'Clément Lenglet',  mins: 78, foulsPerGame: 1.76, tacklesPerGame: 0.61, last5Fouls: [true,true,true,false,true],   yellowCards: 6, potentialOpponent: 'Torres',         form: 'ok' },
        { name: 'Marcos Ruggeri',   mins: 69, foulsPerGame: 1.33, tacklesPerGame: 1.44, last5Fouls: [true,false,true,true,true],   yellowCards: 6, potentialOpponent: 'Yamal',          form: 'ok' },
        { name: 'Marcos Llorente',  mins: 76, foulsPerGame: 1.02, tacklesPerGame: 1.48, last5Fouls: [true,true,false,true,true],   yellowCards: 7, potentialOpponent: 'Olmo',           form: 'poor' },
        { name: 'Julián Álvarez',   mins: 70, foulsPerGame: 0.99, tacklesPerGame: 0.62, last5Fouls: [false,true,false,true,false], yellowCards: 2, potentialOpponent: 'Martin, García', form: 'good' },
        { name: 'Giovanni Simeone', mins: 75, foulsPerGame: 0.98, tacklesPerGame: 1.22, last5Fouls: [true,false,false,false,true], yellowCards: 3, potentialOpponent: 'Fermín, Pedri',  form: 'good' },
      ],
      offensive: [
        { name: 'Giovanni Simeone', mins: 75, foulsWonPerGame: 1.87, last5FoulsWon: [true,true,true,true,true],  potentialOpponent: 'Fermín, Pedri',  form: 'good' },
        { name: 'Ademola Lookman',  mins: 48, foulsWonPerGame: 1.00, last5FoulsWon: [true,false,true,true,false], potentialOpponent: 'Gavi, Koundé',   form: 'ok' },
        { name: 'Robin Le Normand', mins: 61, foulsWonPerGame: 0.93, last5FoulsWon: [false,true,true,false,true], potentialOpponent: 'Torres',         form: 'ok' },
        { name: 'Julián Álvarez',   mins: 70, foulsWonPerGame: 0.74, last5FoulsWon: [true,false,true,false,true], potentialOpponent: 'Martin, García', form: 'good' },
        { name: 'Koke',             mins: 69, foulsWonPerGame: 0.73, last5FoulsWon: [true,true,false,false,true], potentialOpponent: 'Olmo',           form: 'poor' },
      ],
      shooting: [
        { name: 'Antoine Griezmann', mins: 42, sotPerGame: 1.51, last5SoT: [true,true,false,true,true],   shotsPerGame: 2.81, last5Shots: [true,true,true,false,true],   badges: [],         form: 'ok' },
        { name: 'Julián Álvarez',    mins: 70, sotPerGame: 1.39, last5SoT: [true,false,true,true,true],   shotsPerGame: 2.85, last5Shots: [true,true,false,true,true],   badges: ['PK','FK'], form: 'good' },
        { name: 'Ademola Lookman',   mins: 48, sotPerGame: 0.86, last5SoT: [true,false,false,true,true],  shotsPerGame: 2.86, last5Shots: [true,false,true,true,false],  badges: [],         form: 'ok' },
        { name: 'Giovanni Simeone',  mins: 75, sotPerGame: 0.55, last5SoT: [false,true,false,false,true], shotsPerGame: 1.71, last5Shots: [true,false,true,false,true],  badges: [],         form: 'good' },
        { name: 'Marcos Llorente',   mins: 76, sotPerGame: 0.33, last5SoT: [false,false,true,false,false],shotsPerGame: 0.85, last5Shots: [false,true,false,false,false],badges: [],         form: 'poor' },
      ],
      goalscoring: [
        { name: 'Julián Álvarez',    mins: 70, goals: 17, assists: 8,  gaPerGame: 0.77, badges: ['PK','FK'], last5Goals: [true,true,false,true,false],  last5Assists: [false,true,false,false,false], form: 'good' },
        { name: 'Antoine Griezmann', mins: 42, goals: 8,  assists: 4,  gaPerGame: 0.65, badges: [],          last5Goals: [true,false,true,false,false],  last5Assists: [false,true,false,true,false],  form: 'ok' },
        { name: 'Giovanni Simeone',  mins: 75, goals: 6,  assists: 7,  gaPerGame: 0.40, badges: [],          last5Goals: [false,true,false,false,false],  last5Assists: [true,false,false,false,false], form: 'ok' },
        { name: 'Marcos Llorente',   mins: 76, goals: 4,  assists: 4,  gaPerGame: 0.26, badges: [],          last5Goals: [false,false,true,false,false],  last5Assists: [false,false,false,true,false], form: 'poor' },
        { name: 'Robin Le Normand',  mins: 61, goals: 3,  assists: 0,  gaPerGame: 0.13, badges: [],          last5Goals: [false,false,false,false,false], last5Assists: [false,false,false,false,false],form: 'poor' },
      ],
    },
  },

  awayTeam: {
    name: 'Barcelona',
    primaryColor: '#004D98',
    badge: 'https://crests.football-data.org/81.svg',
    stats: {
      goalsFor: 2.71, goalsAgainst: 1.17, over25Goals: 75,
      cornersFor: 6.69, cornersAgainst: 4.10, over95Corners: 80,
      shotsFor: 18.98, shotsAgainst: 9.36,  over195Shots: 80,
      sotFor: 7.21,  sotAgainst: 3.79,  over95SoT: 100,
      foulsCommitted: 9.38, foulsWon: 11.76, over155Fouls: 80,
      cardsFor: 1.69, cardsAgainst: 2.57, over45Cards: 60,
    },
    players: {
      defensive: [
        { name: 'Fermín López',  mins: 62, foulsPerGame: 1.86, tacklesPerGame: 1.16, last5Fouls: [true,true,false,true,false],  yellowCards: 5, potentialOpponent: 'Simeone',       form: 'good' },
        { name: 'Gavi',          mins: 32, foulsPerGame: 1.84, tacklesPerGame: 1.38, last5Fouls: [false,true,false,true,false], yellowCards: 2, potentialOpponent: 'Lookman',        form: 'ok' },
        { name: 'Eric García',   mins: 78, foulsPerGame: 1.27, tacklesPerGame: 1.36, last5Fouls: [true,false,true,true,false],  yellowCards: 4, potentialOpponent: 'Álvarez',        form: 'ok' },
        { name: 'Dani Olmo',     mins: 56, foulsPerGame: 1.09, tacklesPerGame: 1.00, last5Fouls: [false,false,true,false,false],yellowCards: 1, potentialOpponent: 'Llorente, Koke', form: 'good' },
        { name: 'João Cancelo',  mins: 66, foulsPerGame: 1.02, tacklesPerGame: 1.82, last5Fouls: [true,false,false,true,false], yellowCards: 2, potentialOpponent: 'Griezmann',      form: 'poor' },
      ],
      offensive: [
        { name: 'Gavi',         mins: 32, foulsWonPerGame: 4.13, last5FoulsWon: [true,true,true,true,true],  potentialOpponent: 'Lookman',        form: 'good' },
        { name: 'Pedri',        mins: 72, foulsWonPerGame: 2.33, last5FoulsWon: [true,true,false,true,true], potentialOpponent: 'Simeone',        form: 'good' },
        { name: 'Lamine Yamal', mins: 83, foulsWonPerGame: 2.30, last5FoulsWon: [true,false,true,true,true], potentialOpponent: 'Ruggeri',        form: 'good' },
        { name: 'Dani Olmo',    mins: 56, foulsWonPerGame: 2.19, last5FoulsWon: [true,true,true,false,true], potentialOpponent: 'Llorente, Koke', form: 'good' },
        { name: 'Jules Koundé', mins: 77, foulsWonPerGame: 1.00, last5FoulsWon: [false,true,true,false,true],potentialOpponent: 'Lookman',        form: 'ok' },
      ],
      shooting: [
        { name: 'Ferran Torres', mins: 53, sotPerGame: 1.69, last5SoT: [true,true,true,false,true],  shotsPerGame: 3.37, last5Shots: [true,true,true,true,true],  badges: [],          form: 'good' },
        { name: 'Lamine Yamal',  mins: 83, sotPerGame: 1.47, last5SoT: [true,false,true,true,true],  shotsPerGame: 4.34, last5Shots: [true,true,true,false,true],  badges: ['PK','FK'], form: 'good' },
        { name: 'Fermín López',  mins: 62, sotPerGame: 1.28, last5SoT: [true,true,false,true,true],  shotsPerGame: 3.22, last5Shots: [true,true,false,true,true],  badges: [],          form: 'good' },
        { name: 'Dani Olmo',     mins: 56, sotPerGame: 1.05, last5SoT: [false,true,true,true,true],  shotsPerGame: 3.19, last5Shots: [true,false,true,true,true],  badges: [],          form: 'good' },
        { name: 'João Cancelo',  mins: 66, sotPerGame: 0.45, last5SoT: [false,true,false,false,true],shotsPerGame: 1.59, last5Shots: [false,false,true,false,false],badges: [],          form: 'poor' },
      ],
      goalscoring: [
        { name: 'Lamine Yamal',  mins: 83, goals: 20, assists: 15, gaPerGame: 1.05, badges: ['PK','FK'], last5Goals: [true,true,false,true,true],  last5Assists: [true,true,false,true,false], form: 'good' },
        { name: 'Ferran Torres', mins: 53, goals: 16, assists: 1,  gaPerGame: 0.77, badges: [],          last5Goals: [true,false,true,false,true],  last5Assists: [false,false,false,false,false],form: 'good' },
        { name: 'Fermín López',  mins: 62, goals: 11, assists: 12, gaPerGame: 0.95, badges: [],          last5Goals: [false,true,false,true,false],  last5Assists: [true,false,true,false,false],  form: 'good' },
        { name: 'Dani Olmo',     mins: 56, goals: 8,  assists: 7,  gaPerGame: 0.68, badges: [],          last5Goals: [true,false,false,true,false],  last5Assists: [false,true,false,false,true],  form: 'good' },
        { name: 'Jules Koundé',  mins: 77, goals: 3,  assists: 4,  gaPerGame: 0.23, badges: [],          last5Goals: [false,false,false,false,false], last5Assists: [false,true,false,false,false], form: 'ok' },
      ],
    },
  },

  referee: {
    name: 'Clément Turpin',
    currentSeason: { yellows: 3.16, reds: 0.28, foulsPg: 21.92 },
    career:        { yellows: 3.23, reds: 0.27, foulsPg: 25.91 },
  },
  probabilities: {
    btts:     65,
    homeWin:  30,
    draw:     25,
    awayWin:  45,
  },
};
