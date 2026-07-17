'use client';

import Link from 'next/link';
import { useState } from 'react';
import { isAddress } from 'viem';
import { Header } from '@/components/Header';
import { PERIOD_PRESETS } from '@/lib/config';
import { saveStipend } from '@/lib/store';
import { useAuth } from '@/providers/AuthProvider';
import { useUniversalAccount } from '@/providers/UAProvider';

type Step = 'form' | 'routing' | 'done';

export default function CreatePage() {
  const { userAddress } = useAuth();
  const { createStipendCrossChain, refreshBalance } = useUniversalAccount();

  const [recipient, setRecipient] = useState('');
  const [perPeriod, setPerPeriod] = useState('');
  const [periodSeconds, setPeriodSeconds] = useState<number>(604_800);
  const [totalCap, setTotalCap] = useState('');
  const [deposit, setDeposit] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ id: string; txId: string } | null>(
    null,
  );

  const validate = (): string => {
    if (!isAddress(recipient)) return 'Recipient must be a wallet address (0x…)';
    const p = Number(perPeriod);
    const t = Number(totalCap);
    const d = Number(deposit);
    if (!p || p <= 0) return 'Enter an amount per period';
    if (!t || t <= 0) return 'Enter a total budget';
    if (t < p) return 'Total budget must be at least one period&apos;s amount';
    if (!d || d <= 0) return 'Enter how much to fund now';
    if (d > t) return 'Initial funding can&apos;t exceed the total budget';
    return '';
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError('');
    try {
      setStep('routing');
      const res = await createStipendCrossChain({
        recipient: recipient as `0x${string}`,
        amountPerPeriod: perPeriod,
        periodSeconds,
        totalCap,
        initialDeposit: deposit,
      });

      saveStipend({
        id: res.id,
        salt: res.salt,
        recipient: recipient as `0x${string}`,
        createdAt: Date.now(),
        fundingTxId: res.transactionId,
      });
      console.log(
        `[stipend] funding mechanic: ${res.mechanic}, txId: ${res.transactionId}`,
      );
      setResult({ id: res.id, txId: res.transactionId });
      setStep('done');
      refreshBalance().catch(() => {});
    } catch (e: any) {
      console.error('create stipend failed:', e);
      setError(e?.message || 'Something went wrong — nothing was charged');
      setStep('form');
    }
  };

  if (!userAddress) {
    return (
      <main>
        <Header />
        <section className="mx-auto max-w-xl px-6 py-20 text-center">
          <p className="text-zinc-400">
            <Link href="/" className="text-accent underline">
              Sign in
            </Link>{' '}
            to create a stipend.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <section className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">New stipend</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your money funds this rule from whichever chain it lives on — we
          route it automatically. The rule is enforced on-chain from the moment
          it&apos;s created.
        </p>

        {step === 'done' && result ? (
          <div className="card mt-8">
            <h2 className="font-semibold text-accent">Stipend live ✓</h2>
            <p className="mt-2 text-sm text-zinc-400">
              The rule is on-chain and funded. The recipient can start drawing
              from it — within your limits, and only within your limits.
            </p>
            <div className="mt-4 space-y-1 font-mono text-xs text-zinc-500">
              <p>rule id: {result.id}</p>
              <p>funding tx: {result.txId}</p>
            </div>
            <div className="mt-5 flex gap-3">
              <Link href="/dashboard" className="btn-primary">
                View my stipends
              </Link>
              <a
                className="btn-ghost"
                href={`https://universalx.app/activity/details?id=${result.txId}`}
                target="_blank"
                rel="noreferrer"
              >
                See the route it took ↗
              </a>
            </div>
          </div>
        ) : (
          <div className="card mt-8 space-y-5">
            <div>
              <label className="label">Who gets it</label>
              <input
                className="input font-mono"
                placeholder="0x… their wallet address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                disabled={step !== 'form'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">How much (USDC)</label>
                <input
                  className="input"
                  placeholder="5.00"
                  inputMode="decimal"
                  value={perPeriod}
                  onChange={(e) => setPerPeriod(e.target.value)}
                  disabled={step !== 'form'}
                />
              </div>
              <div>
                <label className="label">How often</label>
                <div className="flex gap-1.5">
                  {PERIOD_PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      type="button"
                      onClick={() => setPeriodSeconds(p.seconds)}
                      disabled={step !== 'form'}
                      className={`btn flex-1 px-2 py-2 text-xs ${
                        periodSeconds === p.seconds
                          ? 'bg-accent text-ink'
                          : 'border border-edge text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Total budget (USDC)</label>
                <input
                  className="input"
                  placeholder="50.00"
                  inputMode="decimal"
                  value={totalCap}
                  onChange={(e) => setTotalCap(e.target.value)}
                  disabled={step !== 'form'}
                />
                <p className="mt-1 text-xs text-zinc-600">
                  Lifetime hard limit — it can never pay out more than this.
                </p>
              </div>
              <div>
                <label className="label">Fund now (USDC)</label>
                <input
                  className="input"
                  placeholder="10.00"
                  inputMode="decimal"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  disabled={step !== 'form'}
                />
                <p className="mt-1 text-xs text-zinc-600">
                  Pulled from your balance on any chain. Top up later any time.
                </p>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              className="btn-primary w-full"
              onClick={submit}
              disabled={step !== 'form'}
            >
              {step === 'form' && 'Create & fund'}
              {step === 'routing' && 'Routing your money across chains…'}
            </button>
            {step === 'routing' && (
              <p className="text-center text-xs text-zinc-500">
                Finding the best route for your USDC and landing it in the rule
                on Base — approve the signature when prompted.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
