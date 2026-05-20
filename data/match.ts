export type Form = 'good' | 'ok' | 'poor';

export interface DefensivePlayer {
  name: string; mins: number; foulsPerGame: number; tacklesPerGame: number;
  last5Fouls?: boolean[] | null; yellowCards: number; potentialOpponent: string; form: Form;
}
export interface OffensivePlayer {
  name: string; mins: number; foulsWonPerGame: number;
  last5FoulsWon?: boolean[] | null; potentialOpponent: string; form: Form;
}
export interface ShootingPlayer {
  name: string; mins: number; sotPerGame: number; last5SoT?: boolean[] | null;
  shotsPerGame: number; last5Shots?: boolean[] | null; form: Form;
}
export interface GoalscoringPlayer {
  name: string; mins: number; goals: number; assists: number;
  gaPerGame: number;
  last5Goals?: boolean[] | null; last5Assists?: boolean[] | null; form: Form;
}
export interface CardsPlayer {
  name: string; appearances: number;
  yellowCards: number; redCards: number; cardsPerGame: number;
  last5Cards?: ('yellow' | 'red' | false)[] | null;
}
export interface GkPlayer {
  name: string;
  savesPerGame: number;
  last5Saves?: boolean[] | null;
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
    tacklesFor: number; tacklesAgainst: number; over345Tackles: number;
    offsidesFor: number; offsidesAgainst: number; over35Offsides: number;
    freeKicksFor: number; freeKicksAgainst: number; over195FreeKicks: number;
    savesFor: number; savesAgainst: number; over75Saves: number;
  };
  players: {
    defensive: DefensivePlayer[];
    offensive: OffensivePlayer[];
    shooting: ShootingPlayer[];
    goalscoring: GoalscoringPlayer[];
    cards: CardsPlayer[];
    gk: GkPlayer[];
  };
}

export const matchData: {
  competition: string; stage: string; date: string; kickoff: string;
  homeTeam: TeamData; awayTeam: TeamData;
  referee: { name: string; matchAvg: { fouls: number; cards: number } };
  probabilities: { btts: number; over25: number; homeWin: number; draw: number; awayWin: number; homeOdd?: number; drawOdd?: number; awayOdd?: number; bttsYesOdd?: number; bttsNoOdd?: number; over25Odd?: number; under25Odd?: number };
  aggregate?: { home: number; away: number } | null;
} = {
  competition: 'UEFA Conference League',
  stage: 'Round of 16',
  date: '12 March 2026',
  kickoff: '18:45 GMT',

  homeTeam: {
    name: 'Fulham',
    primaryColor: '#CC0000',
    badge: 'https://crests.football-data.org/63.svg',
    stats: {
      goalsFor: 1.42, goalsAgainst: 1.28, over25Goals: 38,
      cornersFor: 4.85, cornersAgainst: 4.22, over95Corners: 46,
      shotsFor: 12.82, shotsAgainst: 11.44, over195Shots: 62,
      sotFor: 4.35, sotAgainst: 3.88, over95SoT: 72,
      foulsCommitted: 10.65, foulsWon: 10.22, over155Fouls: 78,
      cardsFor: 1.62, cardsAgainst: 1.55, over45Cards: 22,
      tacklesFor: 22.14, tacklesAgainst: 19.88, over345Tackles: 72,
      offsidesFor: 1.82, offsidesAgainst: 2.05, over35Offsides: 45,
      freeKicksFor: 10.22, freeKicksAgainst: 10.65, over195FreeKicks: 72,
      savesFor: 3.85, savesAgainst: 4.12, over75Saves: 62,
    },
    players: {
      defensive: [
        { name: 'Sander Berge',     mins: 88, foulsPerGame: 1.45, tacklesPerGame: 2.12, last5Fouls: [true,true,true,false,true],    yellowCards: 7, potentialOpponent: 'Mayoral, Greenwood',  form: 'ok'   },
        { name: 'Antonee Robinson', mins: 88, foulsPerGame: 1.22, tacklesPerGame: 1.82, last5Fouls: [false,true,true,false,true],   yellowCards: 5, potentialOpponent: 'Mayoral, Rodríguez',  form: 'ok'   },
        { name: 'Calvin Bassey',    mins: 86, foulsPerGame: 1.18, tacklesPerGame: 2.32, last5Fouls: [true,false,true,true,false],   yellowCards: 5, potentialOpponent: 'Mayoral, Greenwood',  form: 'poor' },
        { name: 'Joachim Andersen', mins: 87, foulsPerGame: 0.95, tacklesPerGame: 1.72, last5Fouls: [true,true,false,false,true],   yellowCards: 4, potentialOpponent: 'Greenwood, Aleñá',   form: 'poor' },
        { name: 'Andreas Pereira',  mins: 82, foulsPerGame: 0.88, tacklesPerGame: 1.52, last5Fouls: [false,true,false,true,false],  yellowCards: 4, potentialOpponent: 'Mayoral, Rodríguez',  form: 'ok'   },
        { name: 'Harry Wilson',     mins: 82, foulsPerGame: 0.72, tacklesPerGame: 0.85, last5Fouls: [true,false,false,true,false],  yellowCards: 3, potentialOpponent: 'Suárez, Arambarri',   form: 'ok'   },
        { name: 'Alex Iwobi',       mins: 85, foulsPerGame: 0.65, tacklesPerGame: 1.22, last5Fouls: [false,false,true,false,true],  yellowCards: 2, potentialOpponent: 'Suárez, Alderete',    form: 'ok'   },
        { name: 'Emile Smith Rowe', mins: 84, foulsPerGame: 0.58, tacklesPerGame: 0.72, last5Fouls: [true,false,false,false,true],  yellowCards: 2, potentialOpponent: 'Arambarri, Suárez',   form: 'good' },
        { name: 'Raúl Jiménez',     mins: 85, foulsPerGame: 0.52, tacklesPerGame: 0.48, last5Fouls: [false,true,false,false,false], yellowCards: 2, potentialOpponent: 'Alderete, Álvarez',   form: 'good' },
        { name: 'Kenny Tete',       mins: 85, foulsPerGame: 0.45, tacklesPerGame: 1.45, last5Fouls: [false,false,false,true,false], yellowCards: 2, potentialOpponent: 'Greenwood, Aleñá',   form: 'ok'   },
      ],
      offensive: [
        { name: 'Raúl Jiménez',     mins: 85, foulsWonPerGame: 1.76, last5FoulsWon: [true,true,false,true,true],    potentialOpponent: 'Arambarri, Alderete', form: 'good' },
        { name: 'Emile Smith Rowe', mins: 84, foulsWonPerGame: 1.31, last5FoulsWon: [true,false,true,true,false],   potentialOpponent: 'Arambarri, Suárez',   form: 'good' },
        { name: 'Alex Iwobi',       mins: 85, foulsWonPerGame: 1.02, last5FoulsWon: [false,true,false,true,true],   potentialOpponent: 'Suárez, Alderete',    form: 'ok'   },
        { name: 'Harry Wilson',     mins: 82, foulsWonPerGame: 0.88, last5FoulsWon: [true,false,false,true,false],  potentialOpponent: 'Suárez, Arambarri',   form: 'ok'   },
        { name: 'Andreas Pereira',  mins: 82, foulsWonPerGame: 0.72, last5FoulsWon: [false,true,false,false,true],  potentialOpponent: 'Arambarri, Alderete', form: 'ok'   },
        { name: 'Sander Berge',     mins: 88, foulsWonPerGame: 0.55, last5FoulsWon: [false,false,true,false,true],  potentialOpponent: 'Arambarri, Maksimović',form: 'ok'  },
        { name: 'Antonee Robinson', mins: 88, foulsWonPerGame: 0.45, last5FoulsWon: [false,true,false,false,false], potentialOpponent: 'Greenwood, Arambarri',form: 'ok'   },
        { name: 'Kenny Tete',       mins: 85, foulsWonPerGame: 0.38, last5FoulsWon: [true,false,false,false,false], potentialOpponent: 'Greenwood, Suárez',   form: 'ok'   },
        { name: 'Calvin Bassey',    mins: 86, foulsWonPerGame: 0.22, last5FoulsWon: [false,false,false,true,false], potentialOpponent: 'Mayoral, Arambarri',  form: 'poor' },
        { name: 'Joachim Andersen', mins: 87, foulsWonPerGame: 0.18, last5FoulsWon: [false,false,false,false,true], potentialOpponent: 'Mayoral, Greenwood',  form: 'poor' },
      ],
      shooting: [
        { name: 'Raúl Jiménez',     mins: 85, sotPerGame: 1.82, last5SoT: [true,true,false,true,true],     shotsPerGame: 2.95, last5Shots: [true,true,true,true,true],    form: 'good' },
        { name: 'Harry Wilson',     mins: 82, sotPerGame: 1.24, last5SoT: [true,false,true,false,true],    shotsPerGame: 2.41, last5Shots: [true,true,false,true,true],    form: 'ok'   },
        { name: 'Emile Smith Rowe', mins: 84, sotPerGame: 0.95, last5SoT: [false,true,false,true,false],   shotsPerGame: 1.88, last5Shots: [true,false,true,false,true],   form: 'good' },
        { name: 'Alex Iwobi',       mins: 85, sotPerGame: 0.72, last5SoT: [false,false,true,false,true],   shotsPerGame: 1.52, last5Shots: [false,true,false,true,true],   form: 'ok'   },
        { name: 'Sander Berge',     mins: 88, sotPerGame: 0.48, last5SoT: [false,true,false,false,false],  shotsPerGame: 1.12, last5Shots: [true,false,true,false,false],  form: 'ok'   },
        { name: 'Andreas Pereira',  mins: 82, sotPerGame: 0.38, last5SoT: [false,false,true,false,false],  shotsPerGame: 1.05, last5Shots: [false,true,false,false,true],  form: 'ok'   },
        { name: 'Kenny Tete',       mins: 85, sotPerGame: 0.18, last5SoT: [false,false,false,true,false],  shotsPerGame: 0.55, last5Shots: [false,false,true,false,false], form: 'ok'   },
        { name: 'Antonee Robinson', mins: 88, sotPerGame: 0.15, last5SoT: [false,true,false,false,false],  shotsPerGame: 0.48, last5Shots: [false,false,false,true,false], form: 'ok'   },
        { name: 'Joachim Andersen', mins: 87, sotPerGame: 0.10, last5SoT: [false,false,false,false,true],  shotsPerGame: 0.32, last5Shots: [false,false,false,false,true], form: 'poor' },
        { name: 'Calvin Bassey',    mins: 86, sotPerGame: 0.05, last5SoT: [false,false,false,false,false], shotsPerGame: 0.18, last5Shots: [false,true,false,false,false], form: 'poor' },
      ],
      goalscoring: [
        { name: 'Raúl Jiménez',     mins: 85, goals: 12, assists: 5, gaPerGame: 0.53, last5Goals: [false,true,true,false,true],   last5Assists: [false,false,true,false,false],  form: 'good' },
        { name: 'Emile Smith Rowe', mins: 84, goals: 7,  assists: 8, gaPerGame: 0.48, last5Goals: [true,false,false,true,false],  last5Assists: [false,true,false,false,true],   form: 'good' },
        { name: 'Andreas Pereira',  mins: 82, goals: 4,  assists: 9, gaPerGame: 0.41, last5Goals: [false,false,true,false,false], last5Assists: [true,false,false,true,false],   form: 'ok'   },
        { name: 'Alex Iwobi',       mins: 85, goals: 5,  assists: 6, gaPerGame: 0.37, last5Goals: [false,true,false,false,true],  last5Assists: [true,false,false,false,false],  form: 'ok'   },
        { name: 'Harry Wilson',     mins: 82, goals: 6,  assists: 4, gaPerGame: 0.34, last5Goals: [false,false,true,false,false], last5Assists: [false,true,false,false,true],   form: 'ok'   },
        { name: 'Antonee Robinson', mins: 88, goals: 2,  assists: 3, gaPerGame: 0.16, last5Goals: [false,false,false,false,true], last5Assists: [false,false,false,true,false],  form: 'ok'   },
        { name: 'Sander Berge',     mins: 88, goals: 3,  assists: 2, gaPerGame: 0.15, last5Goals: [false,false,false,true,false], last5Assists: [false,false,true,false,false],  form: 'ok'   },
        { name: 'Kenny Tete',       mins: 85, goals: 1,  assists: 2, gaPerGame: 0.10, last5Goals: [false,false,false,false,false],last5Assists: [false,true,false,false,false],  form: 'ok'   },
        { name: 'Joachim Andersen', mins: 87, goals: 1,  assists: 0, gaPerGame: 0.03, last5Goals: [false,false,false,false,false],last5Assists: [false,false,false,false,false], form: 'poor' },
        { name: 'Calvin Bassey',    mins: 86, goals: 0,  assists: 0, gaPerGame: 0.00, last5Goals: [false,false,false,false,false],last5Assists: [false,false,false,false,false], form: 'poor' },
      ],
      cards: [
        { name: 'Sander Berge',     appearances: 33, yellowCards: 7, redCards: 0, cardsPerGame: 0.21, last5Cards: [false,'yellow',false,'yellow',false]  },
        { name: 'Antonee Robinson', appearances: 32, yellowCards: 5, redCards: 1, cardsPerGame: 0.16, last5Cards: [false,false,'red',false,'yellow']     },
        { name: 'Calvin Bassey',    appearances: 33, yellowCards: 5, redCards: 0, cardsPerGame: 0.15, last5Cards: [false,'yellow',false,false,false]      },
        { name: 'Joachim Andersen', appearances: 31, yellowCards: 4, redCards: 0, cardsPerGame: 0.13, last5Cards: [false,false,false,'yellow',false]      },
        { name: 'Andreas Pereira',  appearances: 32, yellowCards: 4, redCards: 0, cardsPerGame: 0.13, last5Cards: ['yellow',false,false,false,false]      },
        { name: 'Harry Wilson',     appearances: 30, yellowCards: 3, redCards: 0, cardsPerGame: 0.10, last5Cards: [false,false,'yellow',false,false]      },
        { name: 'Alex Iwobi',       appearances: 30, yellowCards: 2, redCards: 0, cardsPerGame: 0.07, last5Cards: [false,false,false,false,'yellow']      },
        { name: 'Raúl Jiménez',     appearances: 32, yellowCards: 2, redCards: 0, cardsPerGame: 0.06, last5Cards: [false,'yellow',false,false,false]      },
        { name: 'Emile Smith Rowe', appearances: 31, yellowCards: 2, redCards: 0, cardsPerGame: 0.06, last5Cards: [false,false,false,'yellow',false]      },
        { name: 'Kenny Tete',       appearances: 32, yellowCards: 2, redCards: 0, cardsPerGame: 0.06, last5Cards: [false,false,false,false,false]         },
      ],
      gk: [
        { name: 'Bernd Leno', savesPerGame: 3.82, last5Saves: [true,false,true,true,false] },
      ],
    },
  },

  awayTeam: {
    name: 'Getafe CF',
    primaryColor: '#003DA5',
    badge: 'https://crests.football-data.org/95.svg',
    stats: {
      goalsFor: 0.95, goalsAgainst: 0.92, over25Goals: 28,
      cornersFor: 3.48, cornersAgainst: 4.55, over95Corners: 38,
      shotsFor: 9.42, shotsAgainst: 11.85, over195Shots: 52,
      sotFor: 3.05, sotAgainst: 3.95, over95SoT: 58,
      foulsCommitted: 13.82, foulsWon: 9.95, over155Fouls: 85,
      cardsFor: 2.28, cardsAgainst: 1.55, over45Cards: 32,
      tacklesFor: 17.55, tacklesAgainst: 21.32, over345Tackles: 68,
      offsidesFor: 1.48, offsidesAgainst: 2.38, over35Offsides: 42,
      freeKicksFor: 9.95, freeKicksAgainst: 13.82, over195FreeKicks: 88,
      savesFor: 4.22, savesAgainst: 3.65, over75Saves: 58,
    },
    players: {
      defensive: [
        { name: 'Mauro Arambarri',    mins: 88, foulsPerGame: 2.12, tacklesPerGame: 3.12, last5Fouls: [true,true,true,true,true],    yellowCards: 11, potentialOpponent: 'Jiménez, Smith Rowe', form: 'ok'   },
        { name: 'Nemanja Maksimović', mins: 86, foulsPerGame: 1.76, tacklesPerGame: 2.52, last5Fouls: [true,false,true,true,true],   yellowCards: 8,  potentialOpponent: 'Jiménez, Iwobi',      form: 'ok'   },
        { name: 'Damián Suárez',      mins: 87, foulsPerGame: 1.45, tacklesPerGame: 1.92, last5Fouls: [false,true,true,false,true],  yellowCards: 7,  potentialOpponent: 'Smith Rowe, Wilson',  form: 'poor' },
        { name: 'Johan Alderete',     mins: 87, foulsPerGame: 1.22, tacklesPerGame: 2.02, last5Fouls: [true,false,false,true,true],  yellowCards: 6,  potentialOpponent: 'Jiménez, Iwobi',      form: 'poor' },
        { name: 'Gastón Álvarez',     mins: 85, foulsPerGame: 0.98, tacklesPerGame: 1.82, last5Fouls: [false,true,false,false,true], yellowCards: 4,  potentialOpponent: 'Smith Rowe, Jiménez', form: 'poor' },
        { name: 'Mason Greenwood',    mins: 85, foulsPerGame: 0.82, tacklesPerGame: 1.12, last5Fouls: [true,false,true,false,false], yellowCards: 3,  potentialOpponent: 'Andersen, Bassey',    form: 'good' },
        { name: 'Diego Rico',         mins: 84, foulsPerGame: 0.72, tacklesPerGame: 1.52, last5Fouls: [false,true,false,true,false], yellowCards: 4,  potentialOpponent: 'Smith Rowe, Wilson',  form: 'ok'   },
        { name: 'Óscar Rodríguez',    mins: 82, foulsPerGame: 0.65, tacklesPerGame: 0.88, last5Fouls: [false,false,true,false,true], yellowCards: 3,  potentialOpponent: 'Berge, Andersen',     form: 'ok'   },
        { name: 'Carles Aleñá',       mins: 84, foulsPerGame: 0.58, tacklesPerGame: 1.22, last5Fouls: [true,false,false,false,false],yellowCards: 2,  potentialOpponent: 'Berge, Pereira',      form: 'ok'   },
        { name: 'Borja Mayoral',      mins: 82, foulsPerGame: 0.52, tacklesPerGame: 0.62, last5Fouls: [false,false,false,true,false],yellowCards: 2,  potentialOpponent: 'Bassey, Andersen',    form: 'good' },
      ],
      offensive: [
        { name: 'Borja Mayoral',      mins: 82, foulsWonPerGame: 1.88, last5FoulsWon: [true,true,false,true,true],    potentialOpponent: 'Berge, Bassey',      form: 'good' },
        { name: 'Óscar Rodríguez',    mins: 82, foulsWonPerGame: 1.24, last5FoulsWon: [false,true,true,false,true],   potentialOpponent: 'Berge, Robinson',    form: 'ok'   },
        { name: 'Mason Greenwood',    mins: 85, foulsWonPerGame: 1.05, last5FoulsWon: [true,false,true,false,true],   potentialOpponent: 'Robinson, Andersen', form: 'good' },
        { name: 'Carles Aleñá',       mins: 84, foulsWonPerGame: 0.82, last5FoulsWon: [false,false,true,false,true],  potentialOpponent: 'Berge, Pereira',     form: 'ok'   },
        { name: 'Nemanja Maksimović', mins: 86, foulsWonPerGame: 0.65, last5FoulsWon: [true,false,false,true,false],  potentialOpponent: 'Berge, Robinson',    form: 'ok'   },
        { name: 'Mauro Arambarri',    mins: 88, foulsWonPerGame: 0.48, last5FoulsWon: [false,false,true,false,false], potentialOpponent: 'Pereira, Iwobi',     form: 'ok'   },
        { name: 'Diego Rico',         mins: 84, foulsWonPerGame: 0.42, last5FoulsWon: [false,true,false,false,false], potentialOpponent: 'Wilson, Iwobi',      form: 'ok'   },
        { name: 'Damián Suárez',      mins: 87, foulsWonPerGame: 0.35, last5FoulsWon: [true,false,false,false,false], potentialOpponent: 'Smith Rowe, Wilson', form: 'poor' },
        { name: 'Gastón Álvarez',     mins: 85, foulsWonPerGame: 0.28, last5FoulsWon: [false,false,false,false,true], potentialOpponent: 'Jiménez, Berge',     form: 'poor' },
        { name: 'Johan Alderete',     mins: 87, foulsWonPerGame: 0.22, last5FoulsWon: [false,false,false,true,false], potentialOpponent: 'Jiménez, Iwobi',     form: 'poor' },
      ],
      shooting: [
        { name: 'Mason Greenwood',    mins: 85, sotPerGame: 1.42, last5SoT: [false,true,true,false,true],    shotsPerGame: 2.85, last5Shots: [true,true,true,false,true],   form: 'good' },
        { name: 'Borja Mayoral',      mins: 82, sotPerGame: 1.18, last5SoT: [true,false,true,false,false],   shotsPerGame: 2.24, last5Shots: [true,false,true,true,false],  form: 'good' },
        { name: 'Óscar Rodríguez',    mins: 82, sotPerGame: 0.92, last5SoT: [false,true,false,true,false],   shotsPerGame: 1.75, last5Shots: [false,true,false,true,true],  form: 'ok'   },
        { name: 'Carles Aleñá',       mins: 84, sotPerGame: 0.58, last5SoT: [false,false,true,false,false],  shotsPerGame: 1.22, last5Shots: [true,false,false,true,false], form: 'ok'   },
        { name: 'Mauro Arambarri',    mins: 88, sotPerGame: 0.35, last5SoT: [false,false,false,true,false],  shotsPerGame: 0.88, last5Shots: [false,true,false,false,true], form: 'ok'   },
        { name: 'Nemanja Maksimović', mins: 86, sotPerGame: 0.22, last5SoT: [false,true,false,false,false],  shotsPerGame: 0.72, last5Shots: [false,false,true,false,false],form: 'ok'   },
        { name: 'Damián Suárez',      mins: 87, sotPerGame: 0.15, last5SoT: [false,false,false,false,true],  shotsPerGame: 0.55, last5Shots: [false,false,false,true,false],form: 'poor' },
        { name: 'Diego Rico',         mins: 84, sotPerGame: 0.12, last5SoT: [false,false,true,false,false],  shotsPerGame: 0.45, last5Shots: [false,true,false,false,false],form: 'ok'   },
        { name: 'Gastón Álvarez',     mins: 85, sotPerGame: 0.08, last5SoT: [false,false,false,false,false], shotsPerGame: 0.28, last5Shots: [false,false,false,false,true],form: 'poor' },
        { name: 'Johan Alderete',     mins: 87, sotPerGame: 0.05, last5SoT: [false,false,false,false,false], shotsPerGame: 0.18, last5Shots: [false,false,true,false,false], form: 'poor' },
      ],
      goalscoring: [
        { name: 'Mason Greenwood',    mins: 85, goals: 8,  assists: 6, gaPerGame: 0.47, last5Goals: [false,true,false,true,true],   last5Assists: [true,false,false,false,true],   form: 'good' },
        { name: 'Borja Mayoral',      mins: 82, goals: 9,  assists: 3, gaPerGame: 0.41, last5Goals: [true,false,true,false,false],  last5Assists: [false,false,false,true,false],  form: 'good' },
        { name: 'Óscar Rodríguez',    mins: 82, goals: 4,  assists: 7, gaPerGame: 0.38, last5Goals: [false,false,true,false,false], last5Assists: [false,true,false,false,true],   form: 'ok'   },
        { name: 'Carles Aleñá',       mins: 84, goals: 3,  assists: 5, gaPerGame: 0.27, last5Goals: [false,false,false,true,false], last5Assists: [false,false,true,false,false],  form: 'ok'   },
        { name: 'Mauro Arambarri',    mins: 88, goals: 2,  assists: 2, gaPerGame: 0.13, last5Goals: [false,false,false,false,false],last5Assists: [false,true,false,false,false],  form: 'ok'   },
        { name: 'Nemanja Maksimović', mins: 86, goals: 1,  assists: 2, gaPerGame: 0.10, last5Goals: [false,false,false,false,false],last5Assists: [false,false,false,true,false],  form: 'ok'   },
        { name: 'Diego Rico',         mins: 84, goals: 1,  assists: 2, gaPerGame: 0.10, last5Goals: [false,false,false,false,false],last5Assists: [false,false,true,false,false],  form: 'ok'   },
        { name: 'Damián Suárez',      mins: 87, goals: 1,  assists: 1, gaPerGame: 0.06, last5Goals: [false,false,false,false,false],last5Assists: [true,false,false,false,false],  form: 'poor' },
        { name: 'Gastón Álvarez',     mins: 85, goals: 0,  assists: 1, gaPerGame: 0.03, last5Goals: [false,false,false,false,false],last5Assists: [false,false,false,false,true],  form: 'poor' },
        { name: 'Johan Alderete',     mins: 87, goals: 0,  assists: 0, gaPerGame: 0.00, last5Goals: [false,false,false,false,false],last5Assists: [false,false,false,false,false], form: 'poor' },
      ],
      cards: [
        { name: 'Mauro Arambarri',    appearances: 29, yellowCards: 11, redCards: 1, cardsPerGame: 0.38, last5Cards: [false,'yellow',false,'red','yellow']  },
        { name: 'Nemanja Maksimović', appearances: 31, yellowCards: 8,  redCards: 0, cardsPerGame: 0.26, last5Cards: ['yellow',false,false,false,'yellow']    },
        { name: 'Damián Suárez',      appearances: 32, yellowCards: 7,  redCards: 0, cardsPerGame: 0.22, last5Cards: [false,false,'yellow',false,false]       },
        { name: 'Johan Alderete',     appearances: 30, yellowCards: 6,  redCards: 0, cardsPerGame: 0.20, last5Cards: [false,'yellow',false,false,false]       },
        { name: 'Gastón Álvarez',     appearances: 30, yellowCards: 4,  redCards: 1, cardsPerGame: 0.13, last5Cards: [false,false,false,'yellow',false]       },
        { name: 'Diego Rico',         appearances: 31, yellowCards: 4,  redCards: 0, cardsPerGame: 0.13, last5Cards: [false,false,'yellow',false,false]       },
        { name: 'Mason Greenwood',    appearances: 30, yellowCards: 3,  redCards: 0, cardsPerGame: 0.10, last5Cards: [false,false,false,false,'yellow']       },
        { name: 'Óscar Rodríguez',    appearances: 29, yellowCards: 3,  redCards: 0, cardsPerGame: 0.10, last5Cards: [false,'yellow',false,false,false]       },
        { name: 'Carles Aleñá',       appearances: 30, yellowCards: 2,  redCards: 0, cardsPerGame: 0.07, last5Cards: [false,false,false,false,false]          },
        { name: 'Borja Mayoral',      appearances: 29, yellowCards: 2,  redCards: 0, cardsPerGame: 0.07, last5Cards: [false,false,false,false,false]          },
      ],
      gk: [
        { name: 'David Soria', savesPerGame: 4.22, last5Saves: [true,true,false,true,true] },
      ],
    },
  },

  referee: { name: 'Glenn Nyberg', matchAvg: { fouls: 22.4, cards: 3.8 } },
  probabilities: {
    btts: 40, over25: 48, homeWin: 42, draw: 26, awayWin: 32,
    homeOdd: 2.38, drawOdd: 3.85, awayOdd: 3.13,
    bttsYesOdd: 2.50, bttsNoOdd: 1.67,
    over25Odd: 2.08, under25Odd: 1.92,
  },
  aggregate: null,
};
