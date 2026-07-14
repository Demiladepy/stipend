import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Providers } from '@/providers/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stipend — money with rules built in',
  description:
    'Set a rule — who, how much, how often — and your wallet enforces it on-chain. No bank, no middleman, no way around it.',
  openGraph: {
    title: 'Stipend — money with rules built in',
    description:
      'Wallet-enforced budgets for people and AI agents. Fund from any chain, revoke any time, enforced on-chain on Base.',
    siteName: 'Stipend',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-zinc-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
