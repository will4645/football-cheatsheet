'use client';

import { useState } from 'react';
import Link from 'next/link';
import { matchData as staticMatchData, TeamData, Form } from '@/data/match';

type MatchData = typeof staticMatchData;

const formColor: Record<Form, string> = {
  good: '#4ade80',
  ok:   '#fbbf24',
  poor: '#f87171',
};

/* ── Probability bar ─────────────────────────────────── */
function ProbBar({ value }: { value: number }) {
  const barColor  = value >= 70 ? '#16a34a' : value >= 40 ? '#d97706' : '#dc2626';
  const textColor = value >= 70 ? '#4ade80' : value >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums" style={{ color: textColor }}>{value}%</span>
    </div>
  );
}

/* ── Stat group card ─────────────────────────────────── */
function StatGroup({ l1, v1, l2, v2, overLabel, prob }: {
  l1: string; v1: number; l2: string; v2: number; overLabel: string; prob: number;
}) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="grid grid-cols-2 gap-1 mb-2">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">{l1}</p>
          <p className="text-sm font-bold text-white">{v1.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">{l2}</p>
          <p className="text-sm font-bold text-white">{v2.toFixed(2)}</p>
        </div>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wide text-gray-600 mb-1">{overLabel}</p>
        <ProbBar value={prob} />
      </div>
    </div>
  );
}

/* ── Team stats panel ────────────────────────────────── */
function TeamStatsPanel({ team }: { team: TeamData }) {
  const { stats, primaryColor, name } = team;
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="px-4 py-2.5 text-center text-xs font-bold tracking-wide"
           style={{ background: primaryColor + '18', borderBottom: `1px solid ${primaryColor}30` }}>
        <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: primaryColor }} />
        {name}
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        <StatGroup l1="Goals For" v1={stats.goalsFor} l2="Goals Against" v2={stats.goalsAgainst} overLabel="Over 2.5 Goals" prob={stats.over25Goals} />
        <StatGroup l1="Corners For" v1={stats.cornersFor} l2="Corners Against" v2={stats.cornersAgainst} overLabel="Over 9.5 Corners" prob={stats.over95Corners} />
        <StatGroup l1="Shots For" v1={stats.shotsFor} l2="Shots Against" v2={stats.shotsAgainst} overLabel="Over 19.5 Shots" prob={stats.over195Shots} />
        <StatGroup l1="Shots on Target For" v1={stats.sotFor} l2="Shots on Target Against" v2={stats.sotAgainst} overLabel="Over 9.5 Shots on Target" prob={stats.over95SoT} />
        <StatGroup l1="Fouls Committed" v1={stats.foulsCommitted} l2="Fouls Won" v2={stats.foulsWon} overLabel="Over 15.5 Fouls" prob={stats.over155Fouls} />
        <StatGroup l1="Cards For" v1={stats.cardsFor} l2="Cards Against" v2={stats.cardsAgainst} overLabel="Over 4.5 Cards" prob={stats.over45Cards} />
      </div>
    </div>
  );
}

/* ── Last 5 games dots ───────────────────────────────── */
function Last5Dots({ data }: { data?: boolean[] | null }) {
  const safe = Array.isArray(data) ? data : [];
  const dots = [...safe, false, false, false, false, false].slice(0, 5);
  return (
    <div className="flex items-center gap-1">
      {dots.map((hit, i) => (
        <div key={i} className="w-2.5 h-2.5 rounded-full shrink-0"
             style={{ backgroundColor: hit ? '#22c55e' : '#ef4444' }} />
      ))}
    </div>
  );
}

/* ── Badge pill ──────────────────────────────────────── */
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[8px] font-black px-1 py-0.5 rounded"
          style={{ backgroundColor: color + '25', color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  );
}

/* ── Stat column (bordered box wrapping header + values) ─ */
function StatCol({ width, header, right = false, children }: {
  width: string; header: string; right?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col ${width} shrink-0 rounded overflow-hidden`}
         style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
      <div className={`flex items-end ${right ? 'justify-end' : ''} px-2 h-9 pb-1.5 text-[9px] uppercase tracking-wide leading-tight`}
           style={{ color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {header}
      </div>
      {children}
    </div>
  );
}

/* ── Player tables ───────────────────────────────────── */
type Tab = 'defensive' | 'offensive' | 'shooting' | 'goalscoring';

function PlayerTable({ team, tab }: { team: TeamData; tab: Tab }) {
  const c = team.primaryColor;
  const ROW = 'flex items-center px-2 h-8';

  if (tab === 'defensive') {
    const ps = team.players.defensive;
    return (
      <div className="flex gap-1.5">
        <div className="flex flex-col w-[18px] shrink-0">
          <div className="h-9" />
          {ps.map((_, i) => <div key={i} className="flex items-center h-8 text-[10px] font-bold text-gray-600">{i + 1}</div>)}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-end h-9 pb-1.5 text-[9px] uppercase tracking-wide text-gray-500">Player</div>
          {ps.map((p, i) => <div key={i} className="flex items-center h-8"><span className="text-[11px] font-medium truncate" style={{ color: formColor[p.form] }}>{p.name}</span></div>)}
        </div>
        <StatCol width="w-[55px]" header="Minutes" right>
          {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[10px] text-gray-500`}>{p.mins}'</div>)}
        </StatCol>
        <StatCol width="w-[68px]" header="Fouls p/g" right>
          {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[11px] font-semibold text-white`}>{p.foulsPerGame.toFixed(2)}</div>)}
        </StatCol>
        <StatCol width="w-[62px]" header="Tackles" right>
          {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[10px] text-gray-400`}>{p.tacklesPerGame.toFixed(2)}</div>)}
        </StatCol>
        <StatCol width="w-[90px]" header="Last 5 (1+ Foul)">
          {ps.map((p, i) => <div key={i} className={ROW}><Last5Dots data={p.last5Fouls} /></div>)}
        </StatCol>
        <StatCol width="w-[110px]" header="vs Opponent">
          {ps.map((p, i) => <div key={i} className={`${ROW} text-[9px] text-gray-500 truncate`}>{p.potentialOpponent}</div>)}
        </StatCol>
      </div>
    );
  }

  if (tab === 'offensive') {
    const ps = team.players.offensive;
    return (
      <div className="flex gap-1.5">
        <div className="flex flex-col w-[18px] shrink-0">
          <div className="h-9" />
          {ps.map((_, i) => <div key={i} className="flex items-center h-8 text-[10px] font-bold text-gray-600">{i + 1}</div>)}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-end h-9 pb-1.5 text-[9px] uppercase tracking-wide text-gray-500">Player</div>
          {ps.map((p, i) => <div key={i} className="flex items-center h-8"><span className="text-[11px] font-medium truncate" style={{ color: formColor[p.form] }}>{p.name}</span></div>)}
        </div>
        <StatCol width="w-[72px]" header="Fouls Won p/g" right>
          {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[11px] font-semibold text-white`}>{p.foulsWonPerGame.toFixed(2)}</div>)}
        </StatCol>
        <StatCol width="w-[90px]" header="Last 5 (1+ Won)">
          {ps.map((p, i) => <div key={i} className={ROW}><Last5Dots data={p.last5FoulsWon} /></div>)}
        </StatCol>
        <StatCol width="w-[110px]" header="vs Opponent">
          {ps.map((p, i) => <div key={i} className={`${ROW} text-[9px] text-gray-500 truncate`}>{p.potentialOpponent}</div>)}
        </StatCol>
      </div>
    );
  }

  if (tab === 'shooting') {
    const ps = team.players.shooting;
    return (
      <div className="flex gap-1.5">
        <div className="flex flex-col w-[18px] shrink-0">
          <div className="h-9" />
          {ps.map((_, i) => <div key={i} className="flex items-center h-8 text-[10px] font-bold text-gray-600">{i + 1}</div>)}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-end h-9 pb-1.5 text-[9px] uppercase tracking-wide text-gray-500">Player</div>
          {ps.map((p, i) => (
            <div key={i} className="flex items-center h-8 gap-1">
              <span className="text-[11px] font-medium truncate" style={{ color: formColor[p.form] }}>{p.name}</span>
              {p.badges?.map(b => <Badge key={b} label={b} color={c} />)}
            </div>
          ))}
        </div>
        <StatCol width="w-[72px]" header="Shots on Target p/g" right>
          {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[11px] font-semibold text-white`}>{p.sotPerGame.toFixed(2)}</div>)}
        </StatCol>
        <StatCol width="w-[90px]" header="Last 5 (1+ SoT)">
          {ps.map((p, i) => <div key={i} className={ROW}><Last5Dots data={p.last5SoT} /></div>)}
        </StatCol>
        <StatCol width="w-[68px]" header="Shots p/g" right>
          {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[10px] text-gray-400`}>{p.shotsPerGame.toFixed(2)}</div>)}
        </StatCol>
        <StatCol width="w-[90px]" header="Last 5 (2+ Shots)">
          {ps.map((p, i) => <div key={i} className={ROW}><Last5Dots data={p.last5Shots} /></div>)}
        </StatCol>
      </div>
    );
  }

  // goalscoring
  const ps = team.players.goalscoring;
  return (
    <div className="flex gap-1.5">
      <div className="flex flex-col w-[18px] shrink-0">
        <div className="h-9" />
        {ps.map((_, i) => <div key={i} className="flex items-center h-8 text-[10px] font-bold text-gray-600">{i + 1}</div>)}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-end h-9 pb-1.5 text-[9px] uppercase tracking-wide text-gray-500">Player</div>
        {ps.map((p, i) => (
          <div key={i} className="flex items-center h-8 gap-1">
            <span className="text-[11px] font-medium truncate" style={{ color: formColor[p.form] }}>{p.name}</span>
            {p.badges?.map(b => <Badge key={b} label={b} color={c} />)}
          </div>
        ))}
      </div>
      <StatCol width="w-[50px]" header="Goals" right>
        {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[11px] font-bold text-white`}>{p.goals}</div>)}
      </StatCol>
      <StatCol width="w-[55px]" header="Assists" right>
        {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[10px] text-gray-400`}>{p.assists}</div>)}
      </StatCol>
      <StatCol width="w-[68px]" header="G+A p/g" right>
        {ps.map((p, i) => <div key={i} className={`${ROW} justify-end text-[11px] font-semibold text-white`}>{p.gaPerGame.toFixed(2)}</div>)}
      </StatCol>
      <StatCol width="w-[90px]" header="Last 5 Goals">
        {ps.map((p, i) => <div key={i} className={ROW}><Last5Dots data={p.last5Goals} /></div>)}
      </StatCol>
      <StatCol width="w-[90px]" header="Last 5 Assists">
        {ps.map((p, i) => <div key={i} className={ROW}><Last5Dots data={p.last5Assists} /></div>)}
      </StatCol>
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */
export default function MatchSheet({ data }: { data?: MatchData }) {
  const [activeTab, setActiveTab] = useState<Tab>('defensive');
  const { homeTeam, awayTeam, referee, competition, stage, date, kickoff, probabilities } = data ?? staticMatchData;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'defensive',   label: 'Defensive' },
    { key: 'offensive',   label: 'Offensive' },
    { key: 'shooting',    label: 'Shooting' },
    { key: 'goalscoring', label: 'Goalscoring' },
  ];

  return (
    <div className="min-h-screen p-4 lg:p-6" style={{ background: '#080c14' }}>
      <div className="max-w-[1400px] mx-auto space-y-4">

        {/* ── Back button ── */}
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            All Matches
          </Link>
        </div>

        {/* ── Match header ── */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-center py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500"
               style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {competition} &nbsp;•&nbsp; {stage} &nbsp;•&nbsp; {date} &nbsp;•&nbsp; {kickoff}
          </div>
          <div className="grid grid-cols-3 items-center px-6 py-5">
            {/* Home */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                   style={{ background: homeTeam.primaryColor + '12', border: `1px solid ${homeTeam.primaryColor}40` }}>
                <img src={homeTeam.badge} alt={homeTeam.name} className="w-11 h-11 object-contain" />
              </div>
              <div>
                <p className="text-lg font-black text-white leading-tight">{homeTeam.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Home</p>
              </div>
            </div>

            {/* VS */}
            <div className="text-center">
              <p className="text-4xl font-black" style={{ color: 'rgba(255,255,255,0.07)' }}>VS</p>
              <p className="text-[10px] text-gray-600 mt-1">Kick off {kickoff}</p>
            </div>

            {/* Away */}
            <div className="flex items-center gap-4 justify-end">
              <div className="text-right">
                <p className="text-lg font-black text-white leading-tight">{awayTeam.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Away</p>
              </div>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                   style={{ background: awayTeam.primaryColor + '12', border: `1px solid ${awayTeam.primaryColor}40` }}>
                <img src={awayTeam.badge} alt={awayTeam.name} className="w-11 h-11 object-contain" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Team stats + referee ── */}
        <div className="grid grid-cols-[1fr_180px_1fr] gap-4">
          <TeamStatsPanel team={homeTeam} />

          {/* Referee card */}
          <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 font-black text-[10px]"
                   style={{ background: 'rgba(234,179,8,0.15)', border: '2px solid rgba(234,179,8,0.4)', color: '#facc15' }}>
                REF
              </div>
              <p className="text-xs font-bold text-white">{referee.name}</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">Referee</p>
            </div>

            {[
              { label: 'Current Season', data: referee.currentSeason },
              { label: 'Career',         data: referee.career },
            ].map(({ label, data }) => (
              <div key={label}>
                <p className="text-[9px] uppercase tracking-wide text-gray-600 mb-2">{label}</p>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <p className="text-[9px] text-gray-500">Yellows</p>
                    <p className="text-sm font-bold text-yellow-400">{data.yellows}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500">Reds</p>
                    <p className="text-sm font-bold text-red-400">{data.reds}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500">Fouls p/g</p>
                    <p className="text-sm font-bold text-white">{data.foulsPg}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* BTTS */}
            <div>
              <p className="text-[9px] uppercase tracking-wide text-gray-600 mb-2">Both Teams to Score</p>
              <ProbBar value={probabilities.btts} />
            </div>

            {/* Win / Draw / Loss */}
            <div>
              <p className="text-[9px] uppercase tracking-wide text-gray-600 mb-2">Result Probability</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-gray-500 w-10 shrink-0">Home</span>
                  <div className="flex-1"><ProbBar value={probabilities.homeWin} /></div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-gray-500 w-10 shrink-0">Draw</span>
                  <div className="flex-1"><ProbBar value={probabilities.draw} /></div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-gray-500 w-10 shrink-0">Away</span>
                  <div className="flex-1"><ProbBar value={probabilities.awayWin} /></div>
                </div>
              </div>
            </div>
          </div>

          <TeamStatsPanel team={awayTeam} />
        </div>

        {/* ── Player sections ── */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-all"
                style={{
                  color: activeTab === t.key ? '#fff' : '#6b7280',
                  borderBottom: activeTab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
                  background: activeTab === t.key ? 'rgba(59,130,246,0.06)' : 'transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Two-column player tables */}
          <div className="grid grid-cols-2">
            <div className="p-4" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: homeTeam.primaryColor }} />
                <span className="text-xs font-bold text-white">{homeTeam.name}</span>
              </div>
              <PlayerTable team={homeTeam} tab={activeTab} />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: awayTeam.primaryColor }} />
                <span className="text-xs font-bold text-white">{awayTeam.name}</span>
              </div>
              <PlayerTable team={awayTeam} tab={activeTab} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-700 pb-2">
          Stats based on season averages &nbsp;•&nbsp; For reference only
        </p>
      </div>
    </div>
  );
}
