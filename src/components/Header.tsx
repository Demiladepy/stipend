'use client';

import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { useUniversalAccount } from '@/providers/UAProvider';

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Header() {
  const { userAddress, email, logout } = useAuth();
  const { primaryAssets } = useUniversalAccount();

  return (
    <header className="border-b border-edge">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          stipend<span className="text-accent">.</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {userAddress ? (
            <>
              <Link href="/create" className="text-zinc-400 hover:text-zinc-100">
                New stipend
              </Link>
              <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-100">
                My stipends
              </Link>
              <Link href="/claim" className="text-zinc-400 hover:text-zinc-100">
                For you
              </Link>
              <Link href="/agent" className="text-zinc-400 hover:text-zinc-100">
                Agent
              </Link>
              {primaryAssets && (
                <span className="rounded-lg border border-edge px-2.5 py-1 font-mono text-xs text-accent">
                  ${primaryAssets.totalAmountInUSD?.toFixed(2)}
                </span>
              )}
              <button
                onClick={() => logout()}
                className="text-xs text-zinc-500 hover:text-zinc-200"
                title={email ?? userAddress}
              >
                {short(userAddress)} · sign out
              </button>
            </>
          ) : (
            <span className="text-xs text-zinc-600">not signed in</span>
          )}
        </nav>
      </div>
    </header>
  );
}
