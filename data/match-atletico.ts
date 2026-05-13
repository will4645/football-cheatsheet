import type { TeamData } from './match';

export const atleticoMatchData: {
  competition: string; stage: string; date: string; kickoff: string;
  homeTeam: TeamData; awayTeam: TeamData;
  referee: { name: string; matchAvg: { fouls: number; cards: number } };
  probabilities: { btts: number; homeWin: number; draw: number; awayWin: number };
  aggregate?: { home: number; away: number } | null;
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
      tacklesFor: 19.82, tacklesAgainst: 16.44, over345Tackles: 75,
      offsidesFor: 2.41, offsidesAgainst: 1.88, over35Offsides: 55,
      freeKicksFor: 9.18, freeKicksAgainst: 11.16, over195FreeKicks: 80,
      goalKicksFor: 6.27, goalKicksAgainst: 5.33, over115GoalKicks: 55,
    },
    players: {
      defensive: [
        { name: 'Clément Lenglet',  mins: 78, foulsPerGame: 1.76, tacklesPerGame: 0.61, last5Fouls: [true,true,true,false,true],    yellowCards: 6, potentialOpponent: 'Torres',         form: 'ok'   },
        { name: 'Marcos Ruggeri',   mins: 69, foulsPerGame: 1.33, tacklesPerGame: 1.44, last5Fouls: [true,false,true,true,true],    yellowCards: 6, potentialOpponent: 'Yamal',          form: 'ok'   },
        { name: 'Marcos Llorente',  mins: 76, foulsPerGame: 1.02, tacklesPerGame: 1.48, last5Fouls: [true,true,false,true,true],    yellowCards: 7, potentialOpponent: 'Olmo',           form: 'poor' },
        { name: 'Julián Álvarez',   mins: 70, foulsPerGame: 0.99, tacklesPerGame: 0.62, last5Fouls: [false,true,false,true,false],  yellowCards: 2, potentialOpponent: 'Martin, García', form: 'good' },
        { name: 'Giovanni Simeone', mins: 75, foulsPerGame: 0.98, tacklesPerGame: 1.22, last5Fouls: [true,false,false,false,true],  yellowCards: 3, potentialOpponent: 'Fermín, Pedri',  form: 'good' },
        { name: 'Rodrigo De Paul',  mins: 71, foulsPerGame: 0.85, tacklesPerGame: 1.31, last5Fouls: [false,true,true,false,false],  yellowCards: 4, potentialOpponent: 'Pedri',          form: 'ok'   },
        { name: 'Antoine Griezmann',mins: 42, foulsPerGame: 0.72, tacklesPerGame: 0.44, last5Fouls: [true,false,false,true,false],  yellowCards: 2, potentialOpponent: 'Cubarsí',        form: 'ok'   },
        { name: 'Robin Le Normand', mins: 61, foulsPerGame: 0.55, tacklesPerGame: 1.05, last5Fouls: [false,false,true,false,true],  yellowCards: 3, potentialOpponent: 'Álvarez',        form: 'ok'   },
        { name: 'Koke',             mins: 69, foulsPerGame: 0.42, tacklesPerGame: 0.88, last5Fouls: [false,true,false,false,false], yellowCards: 2, potentialOpponent: 'Olmo',           form: 'poor' },
        { name: 'Reinildo Mandava', mins: 65, foulsPerGame: 0.38, tacklesPerGame: 0.92, last5Fouls: [false,false,false,true,false], yellowCards: 1, potentialOpponent: 'Yamal',          form: 'ok'   },
      ],
      offensive: [
        { name: 'Giovanni Simeone', mins: 75, foulsWonPerGame: 1.87, last5FoulsWon: [true,true,true,true,true],    potentialOpponent: 'Fermín, Pedri',  form: 'good' },
        { name: 'Ademola Lookman',  mins: 48, foulsWonPerGame: 1.00, last5FoulsWon: [true,false,true,true,false],  potentialOpponent: 'Gavi, Koundé',   form: 'ok'   },
        { name: 'Robin Le Normand', mins: 61, foulsWonPerGame: 0.93, last5FoulsWon: [false,true,true,false,true],  potentialOpponent: 'Torres',         form: 'ok'   },
        { name: 'Julián Álvarez',   mins: 70, foulsWonPerGame: 0.74, last5FoulsWon: [true,false,true,false,true],  potentialOpponent: 'Martin, García', form: 'good' },
        { name: 'Koke',             mins: 69, foulsWonPerGame: 0.73, last5FoulsWon: [true,true,false,false,true],  potentialOpponent: 'Olmo',           form: 'poor' },
        { name: 'Antoine Griezmann',mins: 42, foulsWonPerGame: 0.65, last5FoulsWon: [false,true,false,true,true],  potentialOpponent: 'Cubarsí',        form: 'ok'   },
        { name: 'Rodrigo De Paul',  mins: 71, foulsWonPerGame: 0.52, last5FoulsWon: [true,false,false,true,false],  potentialOpponent: 'Pedri',         form: 'ok'   },
        { name: 'Marcos Llorente',  mins: 76, foulsWonPerGame: 0.38, last5FoulsWon: [false,false,true,false,false], potentialOpponent: 'Olmo',          form: 'poor' },
        { name: 'Marcos Ruggeri',   mins: 69, foulsWonPerGame: 0.30, last5FoulsWon: [false,true,false,false,false], potentialOpponent: 'Yamal',         form: 'ok'   },
        { name: 'Reinildo Mandava', mins: 65, foulsWonPerGame: 0.22, last5FoulsWon: [false,false,false,false,true],  potentialOpponent: 'Yamal',        form: 'ok'   },
      ],
      shooting: [
        { name: 'Antoine Griezmann', mins: 42, sotPerGame: 1.51, last5SoT: [true,true,false,true,true],    shotsPerGame: 2.81, last5Shots: [true,true,true,false,true],   form: 'ok'   },
        { name: 'Julián Álvarez',    mins: 70, sotPerGame: 1.39, last5SoT: [true,false,true,true,true],    shotsPerGame: 2.85, last5Shots: [true,true,false,true,true],    form: 'good' },
        { name: 'Ademola Lookman',   mins: 48, sotPerGame: 0.86, last5SoT: [true,false,false,true,true],   shotsPerGame: 2.86, last5Shots: [true,false,true,true,false],   form: 'ok'   },
        { name: 'Giovanni Simeone',  mins: 75, sotPerGame: 0.55, last5SoT: [false,true,false,false,true],  shotsPerGame: 1.71, last5Shots: [true,false,true,false,true],   form: 'good' },
        { name: 'Marcos Llorente',   mins: 76, sotPerGame: 0.33, last5SoT: [false,false,true,false,false], shotsPerGame: 0.85, last5Shots: [false,true,false,false,false], form: 'poor' },
      ],
      goalscoring: [
        { name: 'Julián Álvarez',    mins: 70, goals: 17, assists: 8,  gaPerGame: 0.77, last5Goals: [true,true,false,true,false],   last5Assists: [false,true,false,false,false], form: 'good' },
        { name: 'Antoine Griezmann', mins: 42, goals: 8,  assists: 4,  gaPerGame: 0.65, last5Goals: [true,false,true,false,false],  last5Assists: [false,true,false,true,false],  form: 'ok'   },
        { name: 'Giovanni Simeone',  mins: 75, goals: 6,  assists: 7,  gaPerGame: 0.40, last5Goals: [false,true,false,false,false], last5Assists: [true,false,false,false,false], form: 'ok'   },
        { name: 'Marcos Llorente',   mins: 76, goals: 4,  assists: 4,  gaPerGame: 0.26, last5Goals: [false,false,true,false,false], last5Assists: [false,false,false,true,false], form: 'poor' },
        { name: 'Robin Le Normand',  mins: 61, goals: 3,  assists: 0,  gaPerGame: 0.13, last5Goals: [false,false,false,false,false],last5Assists: [false,false,false,false,false],form: 'poor' },
      ],
      cards: [
        { name: 'Marcos Ruggeri',    appearances: 25, yellowCards: 6, redCards: 0, cardsPerGame: 0.24, last5Cards: [false,true,true,false,true]  },
        { name: 'Clément Lenglet',   appearances: 29, yellowCards: 6, redCards: 1, cardsPerGame: 0.21, last5Cards: [true,false,true,false,true]  },
        { name: 'Marcos Llorente',   appearances: 33, yellowCards: 7, redCards: 0, cardsPerGame: 0.21, last5Cards: [false,true,false,true,false] },
        { name: 'Rodrigo De Paul',   appearances: 28, yellowCards: 4, redCards: 0, cardsPerGame: 0.18, last5Cards: [false,false,true,false,true] },
        { name: 'Giovanni Simeone',  appearances: 20, yellowCards: 3, redCards: 0, cardsPerGame: 0.15, last5Cards: [false,false,true,false,false]},
      ],
      gk: [
        { name: 'Jan Oblak', savesPerGame: 3.42, last5Saves: [true,true,false,true,true] },
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
      tacklesFor: 15.62, tacklesAgainst: 20.14, over345Tackles: 75,
      offsidesFor: 3.12, offsidesAgainst: 1.54, over35Offsides: 55,
      freeKicksFor: 11.76, freeKicksAgainst: 9.38, over195FreeKicks: 80,
      goalKicksFor: 4.88, goalKicksAgainst: 6.71, over115GoalKicks: 55,
    },
    players: {
      defensive: [
        { name: 'Fermín López',    mins: 62, foulsPerGame: 1.86, tacklesPerGame: 1.16, last5Fouls: [true,true,false,true,false],   yellowCards: 5, potentialOpponent: 'Simeone',        form: 'good' },
        { name: 'Gavi',            mins: 32, foulsPerGame: 1.84, tacklesPerGame: 1.38, last5Fouls: [false,true,false,true,false],  yellowCards: 2, potentialOpponent: 'Lookman',         form: 'ok'   },
        { name: 'Eric García',     mins: 78, foulsPerGame: 1.27, tacklesPerGame: 1.36, last5Fouls: [true,false,true,true,false],   yellowCards: 4, potentialOpponent: 'Álvarez',         form: 'ok'   },
        { name: 'Dani Olmo',       mins: 56, foulsPerGame: 1.09, tacklesPerGame: 1.00, last5Fouls: [false,false,true,false,false], yellowCards: 1, potentialOpponent: 'Llorente, Koke',  form: 'good' },
        { name: 'João Cancelo',    mins: 66, foulsPerGame: 1.02, tacklesPerGame: 1.82, last5Fouls: [true,false,false,true,false],  yellowCards: 2, potentialOpponent: 'Griezmann',       form: 'poor' },
      ],
      offensive: [
        { name: 'Gavi',            mins: 32, foulsWonPerGame: 4.13, last5FoulsWon: [true,true,true,true,true],    potentialOpponent: 'Lookman',         form: 'good' },
        { name: 'Pedri',           mins: 72, foulsWonPerGame: 2.33, last5FoulsWon: [true,true,false,true,true],   potentialOpponent: 'Simeone',         form: 'good' },
        { name: 'Lamine Yamal',    mins: 83, foulsWonPerGame: 2.30, last5FoulsWon: [true,false,true,true,true],   potentialOpponent: 'Ruggeri',         form: 'good' },
        { name: 'Dani Olmo',       mins: 56, foulsWonPerGame: 2.19, last5FoulsWon: [true,true,true,false,true],   potentialOpponent: 'Llorente, Koke',  form: 'good' },
        { name: 'Jules Koundé',    mins: 77, foulsWonPerGame: 1.00, last5FoulsWon: [false,true,true,false,true],  potentialOpponent: 'Lookman',         form: 'ok'   },
      ],
      shooting: [
        { name: 'Ferran Torres',   mins: 53, sotPerGame: 1.69, last5SoT: [true,true,true,false,true],    shotsPerGame: 3.37, last5Shots: [true,true,true,true,true],   form: 'good' },
        { name: 'Lamine Yamal',    mins: 83, sotPerGame: 1.47, last5SoT: [true,false,true,true,true],    shotsPerGame: 4.34, last5Shots: [true,true,true,false,true],   form: 'good' },
        { name: 'Fermín López',    mins: 62, sotPerGame: 1.28, last5SoT: [true,true,false,true,true],    shotsPerGame: 3.22, last5Shots: [true,true,false,true,true],   form: 'good' },
        { name: 'Dani Olmo',       mins: 56, sotPerGame: 1.05, last5SoT: [false,true,true,true,true],    shotsPerGame: 3.19, last5Shots: [true,false,true,true,true],   form: 'good' },
        { name: 'João Cancelo',    mins: 66, sotPerGame: 0.45, last5SoT: [false,true,false,false,true],  shotsPerGame: 1.59, last5Shots: [false,false,true,false,false], form: 'poor' },
      ],
      goalscoring: [
        { name: 'Lamine Yamal',    mins: 83, goals: 20, assists: 15, gaPerGame: 1.05, last5Goals: [true,true,false,true,true],   last5Assists: [true,true,false,true,false],  form: 'good' },
        { name: 'Fermín López',    mins: 62, goals: 11, assists: 12, gaPerGame: 0.95, last5Goals: [false,true,false,true,false], last5Assists: [true,false,true,false,false], form: 'good' },
        { name: 'Ferran Torres',   mins: 53, goals: 16, assists: 1,  gaPerGame: 0.77, last5Goals: [true,false,true,false,true],  last5Assists: [false,false,false,false,false],form: 'good' },
        { name: 'Dani Olmo',       mins: 56, goals: 8,  assists: 7,  gaPerGame: 0.68, last5Goals: [true,false,false,true,false], last5Assists: [false,true,false,false,true], form: 'good' },
        { name: 'Jules Koundé',    mins: 77, goals: 3,  assists: 4,  gaPerGame: 0.23, last5Goals: [false,false,false,false,false],last5Assists: [false,true,false,false,false],form: 'ok'  },
      ],
      cards: [
        { name: 'Fermín López',    appearances: 28, yellowCards: 5, redCards: 0, cardsPerGame: 0.18, last5Cards: [true,false,false,true,false]  },
        { name: 'Eric García',     appearances: 27, yellowCards: 4, redCards: 1, cardsPerGame: 0.15, last5Cards: [false,true,false,false,true]  },
        { name: 'Gavi',            appearances: 14, yellowCards: 2, redCards: 0, cardsPerGame: 0.14, last5Cards: [false,true,false,false,false] },
        { name: 'Jules Koundé',    appearances: 31, yellowCards: 4, redCards: 0, cardsPerGame: 0.13, last5Cards: [false,false,true,false,false] },
        { name: 'João Cancelo',    appearances: 27, yellowCards: 3, redCards: 0, cardsPerGame: 0.11, last5Cards: [false,false,false,true,false] },
      ],
      gk: [
        { name: 'Iñaki Peña', savesPerGame: 2.81, last5Saves: [true,false,true,true,true] },
      ],
    },
  },

  referee: { name: 'Clément Turpin', matchAvg: { fouls: 22.8, cards: 3.4 } },
  probabilities: { btts: 65, homeWin: 30, draw: 25, awayWin: 45 },
};
