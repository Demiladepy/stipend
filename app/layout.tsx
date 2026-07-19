import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { DM_Sans, Syne } from 'next/font/google';
import { Providers } from '@/providers/Providers';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

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
    <html lang="en" className={`${dmSans.variable} ${syne.variable}`}>
      <body className="min-h-screen bg-ink font-sans text-zinc-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
