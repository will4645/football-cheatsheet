'use client';

import { useSignUp } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [stage, setStage] = useState<'form' | 'verify'>('form');
  const [fields, setFields] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setFields(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    const { firstName, lastName, email, password } = fields;
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp.create({ firstName, lastName, emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStage('verify');
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/pricing');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? 'Invalid code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#080c14' }}>

      {/* Left — live demo preview */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <iframe
          src="/preview"
          className="w-full h-full border-0 pointer-events-none"
          style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '118%', height: '118%' }}
          title="Demo preview"
        />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent 50%, #080c14 100%)' }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, #080c14 0%, transparent 8%, transparent 92%, #080c14 100%)' }} />
      </div>

      {/* Right — sign-up panel */}
      <div className="w-full lg:w-[480px] shrink-0 flex flex-col justify-center items-center lg:items-start px-6 py-12"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <Link href="/" className="inline-block">
              <span className="text-xl font-black text-white tracking-tight">Cheat Sheets</span>
            </Link>
            <p className="text-xs text-gray-600 mt-1 uppercase tracking-widest">Football match analysis</p>
          </div>

          {stage === 'form' ? (
            <>
              <h2 className="text-xl font-black text-white mb-1">Create an account</h2>
              <p className="text-sm text-gray-500 mb-6">
                Already have one? <Link href="/sign-in" className="text-green-400 hover:text-green-300">Sign in</Link>
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">First name</label>
                    <input
                      type="text" required value={fields.firstName} onChange={set('firstName')}
                      placeholder="Joe"
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-500/50"
                      style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Last name</label>
                    <input
                      type="text" required value={fields.lastName} onChange={set('lastName')}
                      placeholder="Smith"
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-500/50"
                      style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Email</label>
                  <input
                    type="email" required value={fields.email} onChange={set('email')}
                    placeholder="joe@example.com"
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-500/50"
                    style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Password</label>
                  <input
                    type="password" required value={fields.password} onChange={set('password')}
                    placeholder="Min 8 characters"
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-500/50"
                    style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 disabled:opacity-60"
                  style={{ background: '#16a34a', color: '#fff' }}>
                  {loading ? 'Creating account...' : 'Create account & start free trial'}
                </button>
                <p className="text-[11px] text-gray-600 text-center">4-day free trial · No charge until day 5 · Cancel any time</p>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-white mb-1">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">We sent a code to <span className="text-white">{fields.email}</span></p>
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Verification code</label>
                  <input
                    type="text" required value={code} onChange={e => setCode(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-500/50 tracking-widest text-center text-lg"
                    style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 disabled:opacity-60"
                  style={{ background: '#16a34a', color: '#fff' }}>
                  {loading ? 'Verifying...' : 'Verify email'}
                </button>
                <button type="button" onClick={() => { setStage('form'); setError(''); }}
                  className="w-full py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  Back
                </button>
              </form>
            </>
          )}

          <p className="mt-8 text-xs text-gray-700 text-center leading-relaxed">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="text-gray-500 hover:text-gray-400">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-gray-500 hover:text-gray-400">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
