'use client';

import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { DebugPanel } from '@/components/DebugPanel';
import { useAuth } from '@/providers/AuthProvider';

export default function Home() {
  const { userAddress, login, ready } = useAuth();
  const router = useRouter();

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
              <label className="label">
                Sign in with email — no seed phrase, no extension
              </label>
              <button
                className="btn-primary w-full"
                onClick={() => login()}
                disabled={!ready}
              >
                {ready ? 'Continue with email' : 'Loading…'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-16 grid gap-3 sm:grid-cols-3">
          {[
            ['1', 'Set the rule', 'Who, how much, how often, hard limit. Plain words, no jargon.'],
            ['2', 'Fund from anywhere', 'Your money routes itself — any chain, one signature.'],
            ['3', 'The chain enforces it', 'Overspends revert. Revoke refunds. No middleman to ask.'],
          ].map(([n, t, b]) => (
            <div key={n} className="flex items-start gap-3 rounded-2xl border border-edge/60 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-sm font-bold text-ink">
                {n}
              </span>
              <div>
                <p className="text-sm font-semibold">{t}</p>
                <p className="mt-1 text-xs text-zinc-500">{b}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
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

        <footer className="mt-24 border-t border-edge/60 pt-6 text-xs text-zinc-600">
          <p>
            Wallet-enforced delegation — not vault-based streaming. Rules are
            enforced on-chain on Base; funding routes cross-chain via your
            Universal Account.
          </p>
          <p className="mt-1">
            <a
              className="underline hover:text-zinc-400"
              href="https://github.com/Demiladepy/stipend"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>{' '}
            · UXmaxx Hackathon 2026
          </p>
        </footer>
      </section>
      <DebugPanel />
    </main>
  );
}
