'use client';

// Build-time debug panel (Phase 1 gate): email, EOA, 7702 delegation status,
// UA unified balance. Jargon is allowed HERE and only here. Hide before demo
// by setting NEXT_PUBLIC_SHOW_DEBUG=0.
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useUniversalAccount } from '@/providers/UAProvider';

export function DebugPanel() {
  // Collapsed by default on small screens so it never buries the UI.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(min-width: 640px)').matches) setOpen(true);
  }, []);
  const { ready, authenticated, email, userAddress } = useAuth();
  const { primaryAssets, isDelegated, loading, refreshBalance } =
    useUniversalAccount();

  if (process.env.NEXT_PUBLIC_SHOW_DEBUG === '0') return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-edge bg-panel/95 font-mono text-[11px] shadow-xl backdrop-blur">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-zinc-400"
        onClick={() => setOpen(!open)}
      >
        <span>🛠 phase-1 debug</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-edge px-3 py-2 text-zinc-300">
          <p>
            privy: <b>{!ready ? 'loading' : authenticated ? 'authed' : 'logged out'}</b>
          </p>
          <p className="truncate">email: {email ?? '—'}</p>
          <p className="truncate" title={userAddress ?? ''}>
            EOA: {userAddress ?? '—'}
          </p>
          <p className="text-[10px] text-zinc-500">
            Must match funded wallet (preferred:{' '}
            {process.env.NEXT_PUBLIC_PREFERRED_EOA
              ? `${process.env.NEXT_PUBLIC_PREFERRED_EOA.slice(0, 8)}…`
              : 'none'}
            )
          </p>
          <p>
            7702 on Base:{' '}
            <b className={isDelegated ? 'text-accent' : 'text-amber-400'}>
              {isDelegated ? 'DELEGATED' : 'not delegated (inline auth on 1st tx)'}
            </b>
          </p>
          <p>
            UA balance:{' '}
            {loading
              ? 'loading…'
              : primaryAssets
                ? `$${primaryAssets.totalAmountInUSD?.toFixed(4)}`
                : '—'}
          </p>
          <button
            className="mt-1 rounded-lg border border-edge px-2 py-1 text-zinc-400 hover:text-zinc-100"
            onClick={() => refreshBalance()}
          >
            refresh
          </button>
        </div>
      )}
    </div>
  );
}
