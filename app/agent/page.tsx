'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { fmtUsdc, getAvailable, getPolicy } from '@/lib/vault';
import { loadStipends } from '@/lib/store';
import { useMagic } from '@/providers/MagicProvider';
import { useUniversalAccount } from '@/providers/UAProvider';

type Entry = {
  kind: 'info' | 'pay' | 'ok' | 'blocked' | 'error';
  msg: string;
  txHash?: string;
  data?: string;
};

type AgentInfo = {
  agentAddress: `0x${string}`;
  agentGasEth: string;
  serviceAddress: `0x${string}`;
  pricePerCall: string;
};

export default function AgentPage() {
  const { userAddress } = useMagic();
  const { approveAgentOnStipend, ensureDelegated } = useUniversalAccount();

  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [infoError, setInfoError] = useState('');
  const [stipendId, setStipendId] = useState('');
  const [available, setAvailable] = useState<bigint | null>(null);
  const [potBalance, setPotBalance] = useState<bigint | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/agent/info')
      .then((r) => r.json())
      .then((d) => (d.error ? setInfoError(d.error) : setInfo(d)))
      .catch((e) => setInfoError(String(e)));
    // Prefill with the most recent stipend this browser created
    const last = loadStipends()[0];
    if (last) setStipendId(last.id);
  }, []);

  const refreshBudget = useCallback(async (id: string) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return;
    try {
      const [a, p] = await Promise.all([
        getAvailable(id as `0x${string}`),
        getPolicy(id as `0x${string}`),
      ]);
      setAvailable(a);
      setPotBalance(p.balance);
    } catch {
      setAvailable(null);
      setPotBalance(null);
    }
  }, []);

  useEffect(() => {
    refreshBudget(stipendId);
  }, [stipendId, refreshBudget]);

  const approve = async () => {
    if (!info || !/^0x[0-9a-fA-F]{64}$/.test(stipendId)) return;
    setApproving(true);
    setNotice('');
    try {
      await ensureDelegated();
      await approveAgentOnStipend(
        stipendId as `0x${string}`,
        info.agentAddress,
      );
      setNotice('Agent approved on this stipend — it can now spend within the rule.');
    } catch (e: any) {
      setNotice(e?.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const runCall = async () => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(stipendId)) return;
    setRunning(true);
    try {
      const res = await fetch('/api/agent/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stipendId }),
      });
      const body = await res.json();
      setLog((prev) => [...prev, ...(body.log || [])]);
      await refreshBudget(stipendId);
    } catch (e: any) {
      setLog((prev) => [...prev, { kind: 'error', msg: e?.message || String(e) }]);
    } finally {
      setRunning(false);
    }
  };

  const entryStyle: Record<Entry['kind'], string> = {
    info: 'text-zinc-400',
    pay: 'text-amber-300',
    ok: 'text-accent',
    blocked: 'text-red-400 font-semibold',
    error: 'text-red-300',
  };

  return (
    <main>
      <Header />
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">
          Agent on a budget
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          This AI agent pays a research API per call — straight from a stipend.
          It never holds the money. When it tries to spend past the rule, the
          chain itself says no.
        </p>

        {infoError && (
          <p className="mt-6 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            Agent not configured: {infoError}. Set AGENT_PRIVATE_KEY and
            NEXT_PUBLIC_SERVICE_ADDRESS in .env.local.
          </p>
        )}

        {info && (
          <div className="card mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-zinc-600">Agent wallet</p>
              <p className="font-mono text-xs">{info.agentAddress.slice(0, 10)}…</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {Number(info.agentGasEth).toFixed(5)} ETH gas
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">Paid service</p>
              <p className="font-mono text-xs">{info.serviceAddress.slice(0, 10)}…</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                ${info.pricePerCall} per call
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">Budget left this period</p>
              <p className="font-mono">
                {available !== null ? `$${fmtUsdc(available)}` : '—'}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                pot: {potBalance !== null ? `$${fmtUsdc(potBalance)}` : '—'}
              </p>
            </div>
          </div>
        )}

        <div className="card mt-4 space-y-4">
          <div>
            <label className="label">Stipend rule id</label>
            <input
              className="input font-mono text-xs"
              placeholder="0x… (create one with the agent's service as recipient)"
              value={stipendId}
              onChange={(e) => setStipendId(e.target.value.trim())}
            />
            <p className="mt-1 text-xs text-zinc-600">
              Setup: <Link href="/create" className="text-accent underline">create a stipend</Link>{' '}
              whose recipient is the service address above, then approve the
              agent below (one-time, you must be the stipend&apos;s creator).
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn-ghost"
              onClick={approve}
              disabled={!userAddress || !info || approving}
            >
              {approving ? 'Approving…' : '1 · Approve agent on this stipend'}
            </button>
            <button
              className="btn-primary"
              onClick={runCall}
              disabled={running || !info}
            >
              {running ? 'Agent working…' : '2 · Run a paid research call'}
            </button>
          </div>
          {notice && <p className="text-sm text-accent">{notice}</p>}
        </div>

        <div className="card mt-4 min-h-[200px]">
          <p className="label">Agent activity</p>
          {log.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No calls yet. Run one — then keep running them until the budget
              runs out and watch the chain reject the overspend.
            </p>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              {log.map((e, i) => (
                <div key={i} className={entryStyle[e.kind]}>
                  <span className="text-zinc-700">[{String(i + 1).padStart(2, '0')}]</span>{' '}
                  {e.msg}
                  {e.txHash && (
                    <a
                      className="ml-2 text-zinc-500 underline"
                      href={`https://basescan.org/tx/${e.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tx↗
                    </a>
                  )}
                  {e.data && (
                    <div className="mt-1 rounded-lg border border-edge bg-ink px-3 py-2 text-zinc-300">
                      “{e.data}”
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
