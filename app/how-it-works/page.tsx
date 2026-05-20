import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works | Cheat Sheets',
  description: 'Every section of a Cheat Sheet explained: team stats, match probabilities, player tables and more.',
};

const Section = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <section id={id} className="mb-20">
    <div className="flex items-center gap-3 mb-6">
      <span
        className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
        style={{ background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)' }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
    </div>
    {children}
  </section>
);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span
    className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded"
    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
  >
    {children}
  </span>
);

const Note = ({ color, title, children }: { color: string; title: string; children: React.ReactNode }) => (
  <div
    className="rounded-xl p-4 text-xs text-gray-400 leading-relaxed"
    style={{ background: `${color}10`, border: `1px solid ${color}30` }}
  >
    <strong className="text-gray-300 block mb-1">{title}</strong>
    {children}
  </div>
);

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen" style={{ background: '#080c14', color: '#e5e7eb' }}>
      <div className="max-w-4xl mx-auto px-6 py-12">

        <Link href="/" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">← Back to home</Link>

        <div className="mt-8 mb-16">
          <div
            className="inline-block text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)' }}
          >
            Guide
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">How It Works</h1>
          <p className="text-gray-500 text-base max-w-xl leading-relaxed">
            Every section of a Cheat Sheet explained. What it shows and how to read it quickly before kick-off.
          </p>
        </div>

        {/* Full sheet overview */}
        <div className="mb-20">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-4">Full sheet overview</p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <img
              src="/how-it-works-overview.png"
              alt="Full cheat sheet example showing Atlético de Madrid vs Barcelona"
              className="w-full"
              style={{ display: 'block' }}
            />
          </div>
          <p className="text-[11px] text-gray-600 mt-3 text-center">
            Example: Atlético de Madrid vs Barcelona, UEFA Champions League Quarter-Final
          </p>
        </div>

        {/* 1. Match Header */}
        <Section id="match-header" label="Section 1">
          <h2 className="text-xl font-black text-white mb-2 tracking-tight">Match Header</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">
            The strip at the top confirms the competition, round, date, and kick-off time. Team names and official club crests are shown for home and away sides.
          </p>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <img
              src="/how-it-works-overview.png"
              alt="Match header section"
              className="w-full"
              style={{ display: 'block', objectFit: 'cover', objectPosition: 'top', maxHeight: '130px' }}
            />
          </div>
        </Section>

        {/* 2. Team Stats */}
        <Section id="team-stats" label="Section 2">
          <h2 className="text-xl font-black text-white mb-2 tracking-tight">Team Stats Boxes</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">
            The two large panels show 15 key stats for each team, calculated from the confirmed starting XI. Goals for and against are averaged from the team&apos;s last 10 completed matches. All other stats (corners, shots, fouls, cards, offsides and free kicks) are season averages. Every stat card includes a market line and a probability bar showing how often that team clears it.
          </p>
          <div
            className="rounded-xl overflow-hidden mb-5"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <img
              src="/how-it-works-overview.png"
              alt="Team stats boxes section"
              className="w-full"
              style={{ display: 'block', objectFit: 'cover', objectPosition: 'top', maxHeight: '500px' }}
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Goals For / Against', desc: 'Average goals scored and conceded per game, based on the last 10 completed matches. Shown alongside an Over 2.5 Goals market bar.' },
              { label: 'Corners For / Against', desc: 'Average corners won and conceded per game. Market line set at 9.5 total corners.' },
              { label: 'Shots For / Against', desc: 'Total shots and shots on target averages. Markets shown for Over 19.5 shots and 6.5 on target.' },
              { label: 'Fouls Committed / Won', desc: 'Average fouls per game, both committed and drawn. Market at 15.5 fouls.' },
              { label: 'Cards For / Against', desc: 'Average yellow and red cards per game. Market line at 4.5 cards total.' },
              { label: 'Offsides / Free Kicks', desc: 'Average offsides caught and free kicks conceded. Markets at 3.5 offsides and 19.5 free kicks.' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[11px] font-bold text-white mb-1">{s.label}</p>
                <p className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <Note color="#4ade80" title="Probability bar colours">
            Green (70%+): this team clears the market line in 70% or more of their games this season.
            Amber (40–69%): borderline, roughly a coin flip.
            Red (under 40%): rarely clears this line.
          </Note>

          <div
            className="rounded-xl p-4 text-xs text-gray-400 mt-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <strong className="text-gray-300">Confirmed lineup only.</strong> All stats are calculated using only the players in the confirmed starting XI. If a key player is rested or injured the averages shift accordingly. You&apos;re always analysing the team that will actually play.
          </div>
        </Section>

        {/* 3. Referee */}
        <Section id="referee" label="Section 3">
          <h2 className="text-xl font-black text-white mb-2 tracking-tight">Referee Box</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">
            The centre panel shows the assigned referee with their season averages for fouls and cards per match. A quick read on whether the ref tends to let games flow or reach for the book.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Note color="#4ade80" title="Exp. Fouls">
              The referee&apos;s average number of fouls called per match this season.
            </Note>
            <Note color="#fbbf24" title="Exp. Cards">
              The referee&apos;s average number of cards shown per match this season. Displayed in amber to flag card risk at a glance.
            </Note>
          </div>
        </Section>

        {/* 4. Match Probabilities */}
        <Section id="probabilities" label="Section 4">
          <h2 className="text-xl font-black text-white mb-2 tracking-tight">Match Probabilities</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">
            Three markets shown as probability bars: match result, both teams to score, and over/under 2.5 goals. Match result percentages use bookmaker odds where available, with the overround removed. Goals and both-teams-to-score probabilities are derived from statistical modelling based on each team&apos;s goal averages. All outcomes within each market sum to 100%.
          </p>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: 'Match Result', items: ['Home Win', 'Draw', 'Away Win'], desc: 'Three-way outcome percentages for the full 90 minutes.' },
              { label: 'Both Teams to Score', items: ['Yes', 'No'], desc: 'Probability that both teams get on the scoresheet.' },
              { label: 'Over 2.5 Goals', items: ['Over', 'Under'], desc: 'Probability of 3 or more goals being scored in the match.' },
            ].map(m => (
              <div key={m.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[11px] font-bold text-white mb-1">{m.label}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {m.items.map(i => <Pill key={i}>{i}</Pill>)}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. Player Tables */}
        <Section id="player-tables" label="Section 5">
          <h2 className="text-xl font-black text-white mb-2 tracking-tight">Player Tables</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">
            Six tabbed views, one for each player market. Both starting XIs are shown side-by-side, ranked by the key stat for that tab. Player names are colour-coded by recent form: green means in form, red means cold.
          </p>

          <div
            className="rounded-xl overflow-hidden mb-5"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <img
              src="/how-it-works-players.png"
              alt="Player tables showing Defensive tab"
              className="w-full"
              style={{ display: 'block' }}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {[
              {
                tab: 'Defensive',
                color: '#ef4444',
                cols: ['Minutes played', 'Fouls committed per game', 'Tackles per game', 'Last 5 form dots (1+ foul)', "vs. today's opponent (historical matchup)"],
              },
              {
                tab: 'Offensive',
                color: '#60a5fa',
                cols: ['Fouls won per game', 'Last 5 form dots (1+ foul won)', "vs. today's opponent"],
              },
              {
                tab: 'Shooting',
                color: '#a78bfa',
                cols: ['Shots on target per game', 'Last 5 (1+ shot on target)', 'Total shots per game', 'Last 5 (2+ shots)'],
              },
              {
                tab: 'Goalscoring',
                color: '#4ade80',
                cols: ['Season goals', 'Season assists', 'Goals + assists per game', 'Last 5 goals dots', 'Last 5 assists dots'],
              },
              {
                tab: 'Cards',
                color: '#facc15',
                cols: ['Games played', 'Yellow cards', 'Red cards', 'Cards per game', 'Last 5 (carded) dots'],
              },
              {
                tab: 'GK',
                color: '#34d399',
                cols: ['Saves per game', 'Last 5 (3+ saves) dots'],
              },
            ].map(t => (
              <div key={t.tab} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                  <p className="text-[11px] font-black text-white uppercase tracking-wide">{t.tab}</p>
                </div>
                <ul className="space-y-1">
                  {t.cols.map(c => (
                    <li key={c} className="text-[11px] text-gray-500 flex items-start gap-1.5">
                      <span style={{ color: t.color }} className="mt-0.5 shrink-0">·</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Note color="#4ade80" title="How the Last 5 dots work">
            Each dot represents one of the player&apos;s last 5 appearances. Green means they hit the threshold in that game (e.g. 1+ foul committed, 1+ shot on target, scored a goal). Red means they did not. Ordered left to right, oldest to most recent. Five green dots means the player has hit the market in every one of their last 5 games.
          </Note>
        </Section>

        {/* CTA */}
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}
        >
          <p className="text-white font-black text-xl mb-2">Ready to use it?</p>
          <p className="text-gray-500 text-sm mb-6">Get access to live sheets for every major competition from £9.99/month.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110"
              style={{ background: '#16a34a', color: '#fff' }}
            >
              Start for £9.99/month
            </Link>
            <Link
              href="/preview"
              className="px-8 py-3 rounded-xl font-semibold text-sm border transition-colors hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
            >
              View live demo
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
