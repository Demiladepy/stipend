'use client';

import { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { DebugPanel } from '@/components/DebugPanel';

type Props = {
  children: ReactNode;
  /** Content max width */
  width?: 'narrow' | 'default' | 'wide';
  /** Show the build debug panel */
  debug?: boolean;
  /** Extra classes on the content wrapper */
  className?: string;
};

const widths = {
  narrow: 'max-w-xl',
  default: 'max-w-3xl',
  wide: 'max-w-5xl',
};

/** Shared chrome: header + padded content column. */
export function AppShell({
  children,
  width = 'default',
  debug = false,
  className = '',
}: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main
        className={`mx-auto w-full flex-1 px-6 py-10 sm:py-12 ${widths[width]} ${className}`}
      >
        {children}
      </main>
      {debug && <DebugPanel />}
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

/** Consistent page title row for app screens. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-edge/70 pb-6">
      <div className="min-w-0 max-w-xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
