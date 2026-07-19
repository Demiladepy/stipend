'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useUniversalAccount } from '@/providers/UAProvider';

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const NAV = [
  { href: '/create', label: 'Create' },
  { href: '/dashboard', label: 'My stipends' },
  { href: '/claim', label: 'For you' },
  { href: '/agent', label: 'Agent' },
] as const;

export function Header() {
  const pathname = usePathname();
  const { userAddress, email, logout } = useAuth();
  const { primaryAssets } = useUniversalAccount();

  return (
    <header className="sticky top-0 z-40 border-b border-edge/80 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-zinc-50"
        >
          stipend<span className="text-accent">.</span>
        </Link>

        {userAddress ? (
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-3">
            <nav className="hidden items-center gap-0.5 md:flex">
              {NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-panel text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {primaryAssets && (
              <span className="hidden rounded-lg border border-edge px-2.5 py-1 font-mono text-xs text-accent sm:inline">
                ${primaryAssets.totalAmountInUSD?.toFixed(2)}
              </span>
            )}

            <button
              onClick={() => logout()}
              className="truncate rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-200"
              title={email ?? userAddress}
            >
              {short(userAddress)}
            </button>
          </div>
        ) : (
          <span className="text-xs text-zinc-600">Sign in to continue</span>
        )}
      </div>

      {/* Mobile nav — only when signed in */}
      {userAddress && (
        <nav className="flex gap-1 overflow-x-auto border-t border-edge/60 px-4 py-2 md:hidden">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${
                  active
                    ? 'bg-panel text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
