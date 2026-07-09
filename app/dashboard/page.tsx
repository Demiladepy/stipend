'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { parseAbiItem } from 'viem';
import { Header } from '@/components/Header';
import { periodLabel, VAULT_ADDRESS } from '@/lib/config';
import { loadStipends, saveStipend } from '@/lib/store';
import {
  fmtUsdc,
  getAvailable,
  getPolicy,
  publicClient,
  type PolicyView,
} from '@/lib/vault';
import { useMagic } from '@/providers/MagicProvider';
import { useUniversalAccount } from '@/providers/UAProvider';

type Row = {
  id: `0x${string}`;
  policy: PolicyView;
  available: bigint;
};

const createdEvent = parseAbiItem(
  'event StipendCreated(bytes32 indexed id, address indexed sender, address indexed recipient, address token, uint256 amountPerPeriod, uint256 periodSeconds, uint256 totalCap)',
);

export default function DashboardPage() {
  const { userAddress } = useMagic();
  const { revokeStipend, fundStipendCrossChain, ensureDelegated } =
    useUniversalAccount();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>(''); // id currently being acted on
  const [notice, setNotice] = useState('');
  const [topUpFor, setTopUpFor] = useState<`0x${string}` | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');

  const refresh = useCallback(async () => {
    if (!userAddress || !VAULT_ADDRESS) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ids = new Set<`0x${string}`>(loadStipends().map((s) => s.id));

      // Best-effort on-chain recovery: any stipend this sender ever created.
      try {
        const fromBlock = BigInt(
          process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK || '0',
        );
        const logs = await publicClient.getLogs({
          address: VAULT_ADDRESS,
          event: createdEvent,
          args: { sender: userAddress },
          fromBlock,
          toBlock: 'latest',
        });
        for (const log of logs) {
          const id = log.args.id as `0x${string}`;
          ids.add(id);
          saveStipend({
            id,
            salt: '0x' as `0x${string}`,
            recipient: log.args.recipient as `0x${string}`,
            createdAt: Date.now(),
          });
        }
      } catch (e) {
        console.warn('log recovery skipped (RPC range limit?):', e);
      }

      const out: Row[] = [];
      for (const id of ids) {
        try {
          const [policy, available] = await Promise.all([
            getPolicy(id),
            getAvailable(id),
          ]);
          if (policy.sender.toLowerCase() === userAddress.toLowerCase()) {
            out.push({ id, policy, available });
          }
        } catch (e) {
          console.warn('read failed for', id, e);
        }
      }
      out.sort((a, b) => (a.policy.revoked === b.policy.revoked ? 0 : a.policy.revoked ? 1 : -1));
      setRows(out);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onRevoke = async (id: `0x${string}`) => {
    if (!confirm('Stop this stipend? The unspent balance comes straight back to you.'))
      return;
    setBusy(id);
    setNotice('');
    try {
      await ensureDelegated();
      const txId = await revokeStipend(id);
      setNotice(`Stipend stopped — refund on its way. (tx ${txId.slice(0, 10)}…)`);
      await refresh();
    } catch (e: any) {
      setNotice(e?.message || 'Could not revoke — try again');
    } finally {
      setBusy('');
    }
  };

  const onTopUp = async (id: `0x${string}`) => {
    if (!topUpAmount || Number(topUpAmount) <= 0) return;
    setBusy(id);
    setNotice('');
    try {
      await ensureDelegated();
      const txId = await fundStipendCrossChain(id, topUpAmount);
      setNotice(`Top-up routed. (tx ${txId.slice(0, 10)}…)`);
      setTopUpFor(null);
      setTopUpAmount('');
      await refresh();
    } catch (e: any) {
      setNotice(e?.message || 'Top-up failed — nothing was charged');
    } finally {
      setBusy('');
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
            to see your stipends.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">My stipends</h1>
          <Link href="/create" className="btn-primary">
            New stipend
          </Link>
        </div>

        {notice && (
          <p className="mt-4 rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-accent">
            {notice}
          </p>
        )}

        {loading ? (
          <p className="mt-10 text-sm text-zinc-500">Reading the chain…</p>
        ) : rows.length === 0 ? (
          <div className="card mt-8 text-center">
            <p className="text-zinc-400">No stipends yet.</p>
            <p className="mt-1 text-sm text-zinc-600">
              Create one and it&apos;ll appear here with its live balance.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map(({ id, policy, available }) => (
              <div
                key={id}
                className={`card ${policy.revoked ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-zinc-500">
                      to {policy.recipient.slice(0, 8)}…{policy.recipient.slice(-6)}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      ${fmtUsdc(policy.amountPerPeriod)}{' '}
                      <span className="text-sm font-normal text-zinc-400">
                        {periodLabel(Number(policy.periodSeconds))}
                      </span>
                    </p>
                  </div>
                  {policy.revoked ? (
                    <span className="rounded-lg bg-red-950/50 px-2.5 py-1 text-xs text-red-400">
                      stopped
                    </span>
                  ) : (
                    <span className="rounded-lg bg-emerald-950/50 px-2.5 py-1 text-xs text-accent">
                      active
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-zinc-600">Available now</p>
                    <p className="font-mono">${fmtUsdc(available)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">In the pot</p>
                    <p className="font-mono">${fmtUsdc(policy.balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">Lifetime left</p>
                    <p className="font-mono">
                      ${fmtUsdc(policy.totalCap - policy.spent)}
                    </p>
                  </div>
                </div>

                {!policy.revoked && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {topUpFor === id ? (
                      <>
                        <input
                          className="input w-32"
                          placeholder="USDC"
                          inputMode="decimal"
                          value={topUpAmount}
                          onChange={(e) => setTopUpAmount(e.target.value)}
                        />
                        <button
                          className="btn-primary"
                          disabled={busy === id}
                          onClick={() => onTopUp(id)}
                        >
                          {busy === id ? 'Routing…' : 'Confirm top-up'}
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => setTopUpFor(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-ghost"
                          disabled={!!busy}
                          onClick={() => setTopUpFor(id)}
                        >
                          Top up
                        </button>
                        <button
                          className="btn-danger"
                          disabled={!!busy}
                          onClick={() => onRevoke(id)}
                        >
                          {busy === id ? 'Stopping…' : 'Stop & refund'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
