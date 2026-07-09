'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Header } from '@/components/Header';
import { useMagic } from '@/providers/MagicProvider';

export default function Home() {
  const { userAddress, login, loggingIn, magic } = useMagic();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email');
      return;
    }
    try {
      await login(email);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Login failed — try again');
    }
  };

  return (
    <main>
      <Header />
      <section className="mx-auto max-w-4xl px-6 py-20">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Money with the rules <span className="text-accent">built in.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-zinc-400">
          Set a rule — who gets paid, how much, how often, with a hard limit —
          and it&apos;s enforced on-chain by the contract holding the funds. Not
          by an app. Not by a bank. Pay from any chain; revoke any time.
        </p>

        <div className="mt-12 max-w-md">
          {userAddress ? (
            <div className="card">
              <p className="text-sm text-zinc-400">You&apos;re signed in.</p>
              <div className="mt-4 flex gap-3">
                <button
                  className="btn-primary"
                  onClick={() => router.push('/create')}
                >
                  Create a stipend
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => router.push('/dashboard')}
                >
                  My stipends
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <label className="label" htmlFor="email">
                Sign in with email — no seed phrase, no extension
              </label>
              <div className="flex gap-2">
                <input
                  id="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  disabled={loggingIn}
                />
                <button
                  className="btn-primary shrink-0"
                  onClick={handleLogin}
                  disabled={loggingIn || !magic}
                >
                  {loggingIn ? 'Check your inbox…' : 'Continue'}
                </button>
              </div>
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>
          )}
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'AI agent budgets',
              body: 'Give an agent $50/week, $5 per call. It pays for services itself — and the chain rejects anything over the cap.',
            },
            {
              title: 'Subscriptions you control',
              body: 'Recurring support for a creator that you can cut off instantly. The refund comes straight back to you.',
            },
            {
              title: 'Allowances',
              body: 'Send a weekly allowance that can never be blown in one day. Top up or change the rule any time.',
            },
          ].map((f) => (
            <div key={f.title} className="card">
              <h3 className="font-semibold text-accent">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
