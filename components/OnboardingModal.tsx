'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STEPS = [
  {
    icon: '⚡',
    title: 'Pick a competition',
    body: 'From the dashboard, select any competition. Cards light up green when live matches are available.',
  },
  {
    icon: '●',
    title: 'Open a cheat sheet',
    body: 'Each match shows the confirmed lineup with player stats. The 5 dots next to each player show their last 5 games. Filled dot = hit the threshold.',
  },
  {
    icon: '%',
    title: 'Read the stat markets',
    body: 'Scroll down for Poisson-model probabilities on shots, corners, cards, goals, and more, built from actual season averages.',
  },
];

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem('onboarding-done')) {
      setVisible(true);
    }
  }, []);

  function finish() {
    localStorage.setItem('onboarding-done', '1');
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-8 relative"
           style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors"
                 style={{ background: i <= step ? '#4ade80' : 'rgba(255,255,255,0.12)' }} />
          ))}
        </div>

        <div className="text-center mb-8">
          <div className="text-3xl mb-4 font-black" style={{ color: '#4ade80', fontFamily: 'monospace' }}>
            {current.icon}
          </div>
          <h2 className="text-lg font-black text-white mb-3 tracking-tight">{current.title}</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{current.body}</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={isLast ? finish : () => setStep(s => s + 1)}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110"
            style={{ background: '#16a34a', color: '#fff' }}
          >
            {isLast ? "Got it, let's go" : 'Next'}
          </button>
          {!isLast && (
            <button onClick={finish}
              className="w-full py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
