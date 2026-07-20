'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell, PageHeader } from '@/components/AppShell';
import { VAULT_ADDRESS } from '@/lib/config';
import { fmtUsdc, getAvailable, getPolicy } from '@/lib/vault';
import { loadStipends } from '@/lib/store';
import { useAuth } from '@/providers/AuthProvider';
import { useUniversalAccount } from '@/providers/UAProvider';

const STIPEND_ID_RE = /^0x[0-9a-fA-F]{64}$/;

function isValidStipendId(id: string): id is `0x${string}` {
  return STIPEND_ID_RE.test(id);
}

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
  const { userAddress } = useAuth();
  const { approveAgentOnStipend } = useUniversalAccount();

  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState('');
  const [stipendId, setStipendId] = useState('');
  const [available, setAvailable] = useState<bigint | null>(null);
  const [potBalance, setPotBalance] = useState<bigint | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setInfoLoading(true);
    fetch('/api/agent/info')
      .then((r) => r.json())
      .then((d) => (d.error ? setInfoError(d.error) : setInfo(d)))
      .catch((e) => setInfoError(String(e)))
      .finally(() => setInfoLoading(false));
    // Prefill with the most recent stipend this browser created
    const last = loadStipends()[0];
    if (last) setStipendId(last.id);
  }, []);

  const refreshBudget = useCallback(async (id: string) => {
    if (!isValidStipendId(id) || !VAULT_ADDRESS) return;
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
    if (!info) return;
    if (!isValidStipendId(stipendId)) {
      setNotice(
        'Paste a valid stipend rule id first (0x + 64 hex chars). Create one on /create with the service address as recipient.',
      );
      return;
    }
    if (!VAULT_ADDRESS) {
      setNotice('Vault address not configured — deploy StipendVault and set NEXT_PUBLIC_STIPEND_VAULT_ADDRESS.');
      return;
    }
    setApproving(true);
    setNotice('');
    try {
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
    if (!info) return;
    if (!isValidStipendId(stipendId)) {
      setLog((prev) => [
        ...prev,
        {
          kind: 'error',
          msg: 'No valid stipend rule id. Create one on /create with the paid service address as recipient, then paste the id here.',
        },
      ]);
      return;
    }
    if (!VAULT_ADDRESS) {
      setLog((prev) => [
        ...prev,
        {
          kind: 'error',
          msg: 'Vault not configured. Deploy StipendVault on Base and set NEXT_PUBLIC_STIPEND_VAULT_ADDRESS in .env.local.',
        },
      ]);
      return;
    }
    setRunning(true);
    setLog((prev) => [
      ...prev,
      {
        kind: 'info',
        msg: 'Agent starting — fetching 402 quote, then claiming from the stipend on Base…',
      },
    ]);
    try {
      const res = await fetch('/api/agent/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stipendId }),
      });
      const body = await res.json().catch(() => ({}));
      const entries: Entry[] = body.log?.length
        ? body.log
        : [{ kind: 'error', msg: body.error || `Server error (${res.status})` }];
      setLog((prev) => [...prev, ...entries]);
      await refreshBudget(stipendId);
    } catch (e: any) {
      setLog((prev) => [
        ...prev,
        { kind: 'error', msg: e?.message || String(e) },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const agentGasLow =
    info !== null && Number(info.agentGasEth) < 0.0002;
  const stipendIdOk = isValidStipendId(stipendId);

  const entryStyle: Record<Entry['kind'], string> = {
    info: 'text-zinc-400',
    pay: 'text-amber-300',
    ok: 'text-accent',
    blocked: 'text-red-400 font-semibold',
    error: 'text-red-300',
  };

  return (
    <AppShell>
      <PageHeader
        title="Agent on a budget"
        description="This agent pays a research API per call from a stipend. It never holds the money. Past the rule, the chain says no."
      />

        {!VAULT_ADDRESS && (
          <p className="mb-6 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            StipendVault address missing — set NEXT_PUBLIC_STIPEND_VAULT_ADDRESS in
            .env.local after deploying the contract on Base.
          </p>
        )}

        {infoLoading && (
          <p className="mb-6 rounded-xl border border-edge bg-card px-4 py-3 text-sm text-zinc-400">
            Loading agent config…
          </p>
        )}

        {infoError && (
          <p className="mb-6 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            Agent not configured: {infoError}. Set AGENT_PRIVATE_KEY and
            NEXT_PUBLIC_SERVICE_ADDRESS in .env.local, then restart the dev server.
          </p>
        )}

        {info && (
          <div className="card mb-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-zinc-600">Agent wallet</p>
              <p className="font-mono text-xs">{info.agentAddress.slice(0, 10)}…</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {Number(info.agentGasEth).toFixed(5)} ETH gas
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-600">Paid service (use as recipient on /create)</p>
              <p className="font-mono text-xs break-all">{info.serviceAddress}</p>
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

        {info && agentGasLow && (
          <p className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Agent wallet is low on Base ETH ({Number(info.agentGasEth).toFixed(6)} ETH).
            Send ~0.001 ETH on Base to {info.agentAddress} so claim transactions can be sent.
          </p>
        )}

        <div className="card mb-4 space-y-4">
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
            {stipendId && !stipendIdOk && (
              <p className="mt-2 text-xs text-red-400">
                Invalid id — must be 0x followed by 64 hex characters.
              </p>
            )}
            {!stipendId && (
              <p className="mt-2 text-xs text-amber-400">
                No stipend id yet — create and fund one first, or paste an existing rule id.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn-ghost"
              onClick={approve}
              disabled={!userAddress || !info || approving || infoLoading}
            >
              {approving ? 'Approving…' : '1 · Approve agent on this stipend'}
            </button>
            <button
              className="btn-primary"
              onClick={runCall}
              disabled={running || !info || infoLoading}
            >
              {running ? 'Agent working… (on-chain step can take 30–60s)' : '2 · Run a paid research call'}
            </button>
          </div>
          {!userAddress && info && (
            <p className="text-xs text-zinc-500">
              Log in to approve the agent (step 1). Step 2 runs server-side and does not require login.
            </p>
          )}
          {notice && <p className="text-sm text-accent">{notice}</p>}
        </div>

        <div className="card min-h-[200px]">
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
    </AppShell>
  );
}
