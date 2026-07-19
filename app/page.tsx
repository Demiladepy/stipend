'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { DebugPanel } from '@/components/DebugPanel';
import { CountUp, Marquee, Reveal } from '@/components/Motion';
import { useAuth } from '@/providers/AuthProvider';

const Hero3D = dynamic(() => import('@/components/Hero3D'), { ssr: false });

const SCENES = [
  {
    title: 'AI agent budgets',
    eyebrow: 'Hero scene',
    body: 'Give an agent a weekly pot and a per-call limit. It pays for research APIs itself — and the contract rejects anything over the cap. The agent never holds your keys or your funds.',
    detail: 'Demo path: create a stipend → approve the agent → run paid calls until an overspend is blocked on-chain.',
    href: '/agent',
    cta: 'Open agent demo',
    image: '/images/home-agent.jpg',
    alt: 'Laptop in a dark room with a soft emerald glow on a terminal screen',
  },
  {
    title: 'Subscriptions you control',
    eyebrow: 'Creators',
    body: 'Recurring support for a creator with an instant cut-off. When you stop the rule, the unspent balance refunds to you — no platform middleman to beg.',
    detail: 'Same create flow. Recipient is the creator’s wallet. Revoke from My stipends anytime.',
    href: '/create',
    cta: 'Set up a subscription rule',
    image: '/images/home-creator.jpg',
    alt: 'Quiet desk with notebook, coffee, and a soft phone glow',
  },
  {
    title: 'Allowances',
    eyebrow: 'Families',
    body: 'Send a weekly allowance that cannot be spent all at once. Top up, change the amount, or stop and take the remainder back.',
    detail: 'Period caps and lifetime caps live in the contract. The app only helps you write the rule.',
    href: '/create',
    cta: 'Create an allowance',
    image: '/images/home-allowance.jpg',
    alt: 'Morning light on a kitchen table with keys and an envelope',
  },
] as const;

export default function Home() {
  const { userAddress, login, ready } = useAuth();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero — brand, headline, line, CTA only */}
      <section className="relative isolate overflow-hidden border-b border-edge/60">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
          <div className="absolute inset-x-0 top-0 h-full max-h-[640px]">
            <Hero3D />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/70 to-ink" />
        </div>

        <div className="mx-auto flex min-h-[72vh] max-w-5xl flex-col justify-center px-6 py-20 sm:py-28">
          <p className="anim-up font-display text-sm font-medium tracking-[0.2em] text-accent uppercase">
            stipend.
          </p>
          <h1 className="anim-up anim-d1 mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1.1] tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
            Money with the rules{' '}
            <span className="text-shimmer">built in.</span>
          </h1>
          <p className="anim-up anim-d2 mt-5 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
            Who gets paid, how much, how often — enforced on-chain. Fund from
            any chain. Revoke any time.
          </p>

          <div className="anim-up anim-d2 mt-10 flex flex-wrap items-center gap-3">
            {userAddress ? (
              <>
                <button
                  className="btn-primary"
                  onClick={() => router.push('/create')}
                >
                  Create a stipend
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => router.push('/dashboard')}
                >
                  My stipends
                </button>
              </>
            ) : (
              <button
                className="btn-primary"
                onClick={() => login()}
                disabled={!ready}
              >
                {ready ? 'Continue with email' : 'Loading…'}
              </button>
            )}
          </div>
          {!userAddress && (
            <p className="anim-up anim-d2 mt-3 text-xs text-zinc-600">
              Email sign-in — no seed phrase, no extension.
            </p>
          )}
        </div>
      </section>

      {/* Stack marquee */}
      <div className="border-b border-edge/60 bg-panel/30">
        <Marquee
          items={[
            'EIP-7702',
            'Particle Universal Accounts',
            'Base',
            'Arbitrum',
            'Ethereum',
            'USDC',
            'x402 payments',
            'Privy email wallets',
            'on-chain enforcement',
            'one-signature funding',
          ]}
        />
      </div>

      {/* Pitch line + live stats */}
      <section className="relative overflow-hidden border-b border-edge/60 bg-panel/40">
        <div className="orb -left-24 top-0 h-72 w-72" />
        <div className="mx-auto max-w-5xl px-6 py-10">
          <Reveal>
            <p className="max-w-3xl font-display text-xl leading-snug text-zinc-200 sm:text-2xl">
              This is wallet-enforced delegation — not vault-based streaming like
              Sablier. The contract holds the funds. The limits fire there.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-8 grid grid-cols-2 gap-6 border-t border-edge/60 pt-8 sm:grid-cols-4">
              {[
                [<CountUp key="t" to={21} suffix="/21" />, 'contract tests passing'],
                [<CountUp key="c" to={3} />, 'chains, one balance'],
                [<CountUp key="s" to={1} />, 'signature to fund cross-chain'],
                [<span key="g" className="font-mono">&lt;1¢</span>, 'to enforce a rule on Base'],
              ].map(([stat, label], i) => (
                <div key={i}>
                  <p className="text-2xl font-semibold text-accent">{stat}</p>
                  <p className="mt-1 text-xs text-zinc-500">{label as string}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden border-b border-edge/60">
        <div className="orb -right-32 bottom-0 h-80 w-80" />
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">
            How it works
          </p>
          <h2 className="mt-3 max-w-xl font-display text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Three steps. One signature. Hard limits.
          </h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              [
                '01',
                'Set the rule',
                'Name who gets paid, how much per period, how often, and a lifetime hard limit — in plain words.',
              ],
              [
                '02',
                'Fund from anywhere',
                'USDC on Arbitrum, Ethereum, or Base — your Universal Account routes it into the rule on Base.',
              ],
              [
                '03',
                'The chain enforces it',
                'Overspends revert on-chain. Stop the rule and the remainder refunds to you. No app can override it.',
              ],
            ].map(([n, t, b], i) => (
              <li key={n}>
                <Reveal delay={i * 120} className="flex flex-col gap-3">
                  <span className="font-mono text-xs text-accent">{n}</span>
                  <h3 className="font-display text-lg font-semibold text-zinc-100">
                    {t}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-500">{b}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Scenes with images */}
      <section className="border-b border-edge/60">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">
            Built for
          </p>
          <h2 className="mt-3 max-w-xl font-display text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            One product. Three demo scenes.
          </h2>

          <div className="mt-12 space-y-16">
            {SCENES.map((scene, i) => (
              <Reveal key={scene.title}>
              <article
                className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-12 ${
                  i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-edge">
                  <Image
                    src={scene.image}
                    alt={scene.alt}
                    fill
                    className="object-cover transition-transform duration-700 ease-out hover:scale-[1.03]"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority={i === 0}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                </div>
                <div>
                  <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">
                    {scene.eyebrow}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-zinc-50">
                    {scene.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                    {scene.body}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    {scene.detail}
                  </p>
                  <button
                    className="btn-ghost mt-6"
                    onClick={() =>
                      userAddress ? router.push(scene.href) : login()
                    }
                  >
                    {userAddress ? scene.cta : 'Sign in to try'}
                  </button>
                </div>
              </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What the chain does */}
      <section className="border-b border-edge/60">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">
            Under the hood
          </p>
          <h2 className="mt-3 max-w-xl font-display text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Enforcement is custody, not vibes.
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div className="card edge-glow">
              <h3 className="font-display text-base font-semibold text-zinc-100">
                StipendVault on Base
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Funds sit in the contract. Claims check period cap, lifetime
                cap, balance, and revocation before a single USDC moves. That is
                the moat — not an off-chain keeper.
              </p>
            </div>
            <div className="card edge-glow">
              <h3 className="font-display text-base font-semibold text-zinc-100">
                Universal Account routing
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Your email wallet upgrades in place with EIP-7702. Particle UA
                sources value from Arbitrum or Ethereum and lands it in the
                vault on Base in one flow.
              </p>
            </div>
            <div className="card edge-glow">
              <h3 className="font-display text-base font-semibold text-zinc-100">
                Agent never holds funds
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                The agent is an approved claimer. The vault pays the service
                address directly. Over-cap calls decode as on-chain blocks in
                the activity log.
              </p>
            </div>
            <div className="card edge-glow">
              <h3 className="font-display text-base font-semibold text-zinc-100">
                Revoke = refund
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Stop a rule from My stipends. Remaining custodied balance
                returns to you. The recipient cannot pull after revoke.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section>
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-lg">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Ready when your wallet is funded.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                Sign in, create a rule, fund it cross-chain. Every button in the
                app is wired — the live delay is only gas and USDC on your
                embedded wallet.
              </p>
            </div>
            <button
              className="btn-primary shrink-0"
              onClick={() =>
                userAddress ? router.push('/create') : login()
              }
              disabled={!ready && !userAddress}
            >
              {userAddress ? 'Create a stipend' : ready ? 'Continue with email' : 'Loading…'}
            </button>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-edge/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Wallet-enforced rules — not vault-based streaming. Enforced on Base;
            funded cross-chain via Universal Accounts.
          </p>
          <p>
            <a
              className="underline hover:text-zinc-400"
              href="https://github.com/Demiladepy/stipend"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>{' '}
            · UXmaxx 2026 · Particle UA Track
          </p>
        </div>
      </footer>

      <DebugPanel />
    </div>
  );
}
