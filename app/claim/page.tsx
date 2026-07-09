'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { parseAbiItem } from 'viem';
import { Header } from '@/components/Header';
import { periodLabel, VAULT_ADDRESS } from '@/lib/config';
import {
  fmtUsdc,
  getAvailable,
  getPolicy,
  publicClient,
  type PolicyView,
} from '@/lib/vault';
import { useMagic } from '@/providers/MagicProvider';
import { useUniversalAccount } from '@/providers/UAProvider';

type Row = { id: `0x${string}`; policy: PolicyView; available: bigint };

const createdEvent = parseAbiItem(
  'event StipendCreated(bytes32 indexed id, address indexed sender, address indexed recipient, address token, uint256 amountPerPeriod, uint256 periodSeconds, uint256 totalCap)',
);

export default function ClaimPage() {
  const { userAddress } = useMagic();
  const { claimStipend, ensureDelegated } = useUniversalAccount();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!userAddress || !VAULT_ADDRESS) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fromBlock = BigInt(
        process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK || '0',
      );
      const logs = await publicClient.getLogs({
        address: VAULT_ADDRESS,
        event: createdEvent,
        args: { recipient: userAddress },
        fromBlock,
        toBlock: 'latest',
      });
      const out: Row[] = [];
      for (const log of logs) {
        const id = log.args.id as `0x${string}`;
        try {
          const [policy, available] = await Promise.all([
            getPolicy(id),
            getAvailable(id),
          ]);
          out.push({ id, policy, available });
        } catch (e) {
          console.warn('read failed for', id, e);
        }
      }
      setRows(out);
    } catch (e) {
      console.warn('log scan failed:', e);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onClaim = async (row: Row) => {
    setBusy(row.id);
    setNotice('');
    try {
      await ensureDelegated();
      const human = (Number(row.available) / 1e6).toString();
      const txId = await claimStipend(row.id, human);
      setNotice(`Claimed $${fmtUsdc(row.available)} — it's on the way. (tx ${txId.slice(0, 10)}…)`);
      await refresh();
    } catch (e: any) {
      setNotice(e?.message || 'Claim failed');
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
            with the email that received the stipend.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">For you</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Money set aside for you, released on the sender&apos;s schedule.
          Claiming costs you nothing — no gas, no setup.
        </p>

        {notice && (
          <p className="mt-4 rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-accent">
            {notice}
          </p>
        )}

        {loading ? (
          <p className="mt-10 text-sm text-zinc-500">Reading the chain…</p>
        ) : rows.length === 0 ? (
          <div className="card mt-8 text-center">
            <p className="text-zinc-400">Nothing addressed to your wallet yet.</p>
            <p className="mt-1 text-sm text-zinc-600">
              When someone creates a stipend for this address, it shows up here.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`card ${row.policy.revoked ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-zinc-500">
                      from {row.policy.sender.slice(0, 8)}…{row.policy.sender.slice(-6)}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      ${fmtUsdc(row.policy.amountPerPeriod)}{' '}
                      <span className="text-sm font-normal text-zinc-400">
                        {periodLabel(Number(row.policy.periodSeconds))}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Available now:{' '}
                      <span className="font-mono text-zinc-200">
                        ${fmtUsdc(row.available)}
                      </span>
                    </p>
                  </div>
                  {row.policy.revoked ? (
                    <span className="rounded-lg bg-red-950/50 px-2.5 py-1 text-xs text-red-400">
                      ended by sender
                    </span>
                  ) : (
                    <button
                      className="btn-primary"
                      disabled={row.available === 0n || busy === row.id}
                      onClick={() => onClaim(row)}
                    >
                      {busy === row.id
                        ? 'Claiming…'
                        : row.available === 0n
                          ? 'Nothing to claim yet'
                          : `Claim $${fmtUsdc(row.available)}`}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
