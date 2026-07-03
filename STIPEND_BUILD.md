# STIPEND — Cursor Build Spec 

> **How to use this file:** This is the source of truth for the build. Every work session,
> open this file first. Find the first phase whose checkbox is unchecked, read its
> "RESUME HERE" note, and continue. Update the PROGRESS LOG at the bottom at the end of
> every session so any fresh context (new Cursor window, rate-limit reset, different model)
> can pick up exactly where you left off. Do NOT rely on chat memory — this file is memory.

---

## 0. ONE-PARAGRAPH CONTEXT (read this to any fresh AI before it touches code)

Stipend is a consumer app for the UXmaxx Hackathon (7702 Collective: Particle Network,
Magic Labs, ZeroDev, Openfort). It lets a user set **programmable money rules enforced by
their own wallet via EIP-7702** — a recipient, an amount, a frequency, a cap, a revocation
rule — with no intermediary (no Stripe, no bank) able to override them. Particle **Universal
Accounts** route value cross-chain (pay from any chain/token, receive on any chain). **Magic**
onboards recipients (human OR AI agent) with just an email and 7702-upgrades their EOA in
place. The wallet itself is "where spending limits fire" (Joan Alavedra / Openfort framing),
which is the layer beneath x402/MPP/ACP/AP2. Target prizes: **Universal Accounts Track (1st,
$2,500) + Magic Labs bonus ($500)**. Judging = UX 40%, prominent/novel UA+7702 use 30%,
adoption 20%, polish 10%. Lead every explanation with "wallet-enforced, NOT vault-based
streaming" or judges pattern-match to Sablier.

Three demo scenes in priority order: (1) **AI agent budget** — agent gets $50/wk, max $5/call,
pays x402 services within cap, never holds keys [HERO]; (2) **creator subscription** — recurring
tips that revoke instantly at wallet layer; (3) **allowance** — parent→student, the human closer.

---

## 1. TECH STACK (locked — do not swap without updating this section)

- Framework: **Next.js (App Router) + TypeScript**
- Chain lib: **viem** (+ wagmi if needed for React hooks)
- Chain abstraction: **Particle Universal Accounts SDK in EIP-7702 mode**
- Recipient onboarding / signer: **Magic embedded wallet** (`sign7702Authorization`,
  `send7702Transaction`)
- Sender auth in reference demo uses Privy; we use **Magic** to also qualify for Magic bonus
- Routing under UA: **LI.FI** (as used in Particle's 7702 reference repo)
- Policy enforcement: **custom Stipend delegation-target contract** (Solidity, Foundry)
- Agent scene: a minimal **x402-payable endpoint** the agent calls
- Package manager: **pnpm**
- Deploy: **Vercel** (frontend), testnet contracts (chain TBD in Phase 1)

Reference repos to clone and study FIRST (Phase 1):
- `github.com/Particle-Network/universal-accounts-7702` (UA + 7702, Privy auth, LI.FI routing)
- `github.com/Particle-Network/ua-7702-magic-demo` (UA + 7702 + Magic — closest to our stack)
- `github.com/Particle-Network/universal-account-example` (UA quickstart)

Docs (keep open):
- developers.particle.network/universal-accounts/cha/overview
- developers.particle.network/universal-accounts/cha/web-quickstart
- docs.magic.link/embedded-wallets/wallets/features/eip-7702
- eips.ethereum.org/EIPS/eip-7702

---

## 2. SCOPE DISCIPLINE (the #1 way this build fails is scope creep)

**v1 policy contract enforces ONLY three things:** (a) per-period amount cap,
(b) frequency/interval, (c) total lifetime cap + revocation. NO merchant whitelist,
NO on-chain KYC, NO multi-sig in v1. Those are "future work" slides, not code.

If you are behind schedule, cut in this order: allowance scene → creator scene →
polish animations. NEVER cut: the agent scene, the 7702 upgrade flow, or one working
cross-chain route (that's the UA Track requirement).

---

## PHASES (work top to bottom; each has a resume note)

### [ ] PHASE 1 — Validate the foundation (HALF A DAY, do before anything else)
**Goal:** Prove the risky integration works before building on it.
**Tasks:**
1. Clone `ua-7702-magic-demo`, install with pnpm, run locally.
2. Confirm: Magic email login → EOA created → `sign7702Authorization` succeeds → EOA
   acts as a Universal Account.
3. Confirm which testnet chains the UA-7702 demo supports AND which chains Magic supports
   7702 on. Record the INTERSECTION here → that's our deployable chain set.
4. **CRITICAL unknown to resolve:** Does Magic's `sign7702Authorization` allow an ARBITRARY
   delegation target (our Stipend contract), or does Magic whitelist targets? Test by trying
   to delegate to a dummy contract address. If whitelisted, note the workaround (may need to
   deploy through Particle's UA delegate and enforce policy differently).
**DONE WHEN:** you have a local app where a Magic email login controls a 7702 UA, and you've
written the supported-chain intersection + the arbitrary-target answer into the PROGRESS LOG.
**RESUME HERE NOTE:** _Clone/install/build/dev ✅ in `reference/ua-7702-magic-demo/ua-7702-demo`. Dev server: `pnpm run dev` → localhost:3000. **BLOCKED:** live login + arbitrary-target test need `.env` (Magic + Particle keys) — copy `.env.example`, fill keys, click "Phase 1: test arbitrary delegate target" on Delegation card. Full report: `reference/PHASE1_REPORT.md`. Chain intersection: **8453 Base** primary; alternates 42161/1/10; Sepolia 11155111 for testnet. Arbitrary target: SDK accepts any address (no client whitelist); live Y/N pending. **Architecture flag:** 7702 = one delegate slot — Particle UA vs Stipend policy contract cannot both be targets; likely policy enforced via calls from UA-delegated wallet._

---

### [ ] PHASE 2 — Stipend policy contract v1 (2–3 DAYS)
**Goal:** The delegation-target contract an EOA points to via 7702, enforcing the rule.
**Design (minimal):**
```
struct Policy {
  address token;        // asset to send (or address(0) for native)
  address recipient;    // who receives
  uint256 amountPerPeriod;
  uint256 periodSeconds;
  uint256 totalCap;     // lifetime max
  uint256 spent;        // running total
  uint256 lastPeriodStart;
  uint256 periodSpent;  // spent in current period
  bool    revoked;
}
```
Functions:
- `createStipend(Policy)` — sender defines the rule (store keyed by an id / recipient).
- `execute(id, amount)` — enforces: not revoked, within period cap, within total cap,
  period rollover logic; transfers; updates counters. Callable by recipient (pull) OR a
  keeper. Reverts if any check fails. **The enforcement lives here — this is the moat.**
- `revoke(id)` / `modify(id, newPolicy)` — sender-only.
- View helpers: `available(id)`, `getPolicy(id)`.
**Tests (Foundry):** happy path, over-period-cap revert, over-total-cap revert, revoked
revert, period rollover, modify, unauthorized-caller revert.
**DONE WHEN:** `forge test` green on all cases; contract deployed to the Phase-1 testnet;
address recorded in PROGRESS LOG + `.env`.
**RESUME HERE NOTE:** _<fill in: contract address, which tests pass, any TODO>_

---

### [ ] PHASE 3 — Sender flow + UA cross-chain (2–3 DAYS)
**Goal:** A user creates a Stipend and funds/executes it cross-chain via UA.
**Tasks:**
1. Magic login for sender → 7702-upgraded UA.
2. UI: "Create Stipend" form (recipient, amount, frequency, total cap).
3. Wire form → `createStipend` on the policy contract.
4. Use Particle UA to source the value from any chain/token and settle to recipient's
   chain (this satisfies the "at least one cross-chain operation via UA" requirement).
5. "My Stipends" list: active rules, amount available, modify/revoke buttons.
**DONE WHEN:** you can create a Stipend and execute at least ONE real cross-chain transfer
end-to-end on testnet, visible in the UI.
**RESUME HERE NOTE:** _<fill in: which chains routed, tx hash, UI state>_

---

### [ ] PHASE 4 — Recipient flow + the AI AGENT hero scene (2–3 DAYS)
**Goal:** The scene that wins. An agent onboards and spends within its budget.
**Tasks:**
1. Recipient onboarding: email link → Magic → 7702 upgrade → "you have X available".
2. Build a minimal **x402-payable endpoint** (a fake "research API" that returns data for
   a small USDC charge).
3. Build a tiny agent loop: given a Stipend budget ($50/wk, $5/call cap), the agent calls
   the x402 endpoint, pays via its Stipend allowance, and the POLICY CONTRACT blocks any
   call that would exceed the cap. Show a blocked call in the demo — that's the wow.
**DONE WHEN:** agent makes several successful paid calls, then a call that exceeds the cap
is rejected ON-CHAIN by the policy contract, all visible in the UI.
**RESUME HERE NOTE:** _<fill in: endpoint URL, agent script path, cap-block demonstrated y/n>_

---

### [ ] PHASE 5 — Design polish (Magic judges on this) (2 DAYS)
**Goal:** Consumer-product feel, not crypto-app feel. Sean Li is a designer; Magic bonus
rewards UX polish.
**Tasks:**
1. Study Magic Passport/Newton UI + Particle UniversalX BEFORE designing screens.
2. Clean visual system: one accent color, generous spacing, zero jargon on primary screens
   (no "EOA", no "delegation" in user-facing copy — say "your wallet", "your rule").
3. Landing page with the tagline + subtle audio cue (per your note — keep it tasteful).
4. Empty states, loading states, success states for all three scenes.
**DONE WHEN:** a non-crypto person could use the create + agent flows without confusion.
**RESUME HERE NOTE:** _<fill in: screens done, screens left>_

---

### [ ] PHASE 6 — Submission assets (1–2 DAYS)
**Goal:** Win the pitch, not just the code.
**Tasks:**
1. 90-second demo video: agent scene → creator scene → allowance scene.
2. Pitch deck: problem → solution → why 7702 (novel, not session-keys-for-trading) →
   what-wins-each-prize slide → roadmap (name-drop Universal Agent Accounts: "we built the
   consumer MVP of the pattern you're shipping in Q3").
3. README with architecture diagram + the "wallet-enforced NOT vault-based" line up top.
4. Deploy frontend to Vercel; verify live demo works from a clean browser.
**DONE WHEN:** submission form filled, video uploaded, live URL works incognito.
**RESUME HERE NOTE:** _<fill in: deck link, video link, live URL>_

---

## PITCH LANGUAGE CHEAT-SHEET (use verbatim, these are tribal signals)
- "Asset-centric, not chain-centric" (Derek Chiang / ZeroDev)
- "The wallet is where spending limits actually fire" (Joan Alavedra / Openfort)
- "A code of law for your money and your agents" (Sean Li / Magic)
- "EIP-7702 is the quiet unlock" (7702 Collective report)
- "We built the consumer MVP of Universal Agent Accounts before the infra shipped" (Particle roadmap)
- ALWAYS lead with: "This is wallet-enforced delegation, not vault-based streaming like Sablier."

## PRIZE TARGETS
- PRIMARY: Universal Accounts Track — 1st ($2,500)
- BONUS: Magic Labs challenge ($500)
- Incubation candidacy: Particle (UA-Track winners considered)

## KEY DEADLINES (confirm against the live Encode page — these may have shifted)
- Project outline / description milestone: ~Jun 29
- Mid-hackathon checkpoint: ~Jul 5
- Final submission: ~Jul 19 (midnight Sunday)
- Finale & prizegiving: ~Jul 30

---

## PROGRESS LOG (append every session — newest at top)
<!-- FORMAT: [DATE] Phase X — what got done, what's blocking, exact next step -->

- [2026-07-01] Phase 1 (partial) — Cloned `ua-7702-magic-demo` to `reference/`, `pnpm install` + `pnpm build` green, dev server runs on :3000. Documented chain intersection (Base 8453 primary; Magic 7702: ETH/Sepolia/Arbitrum/Base/Optimism). Added arbitrary-target sign-only test button to reference demo DelegationCard. SDK has no client-side whitelist; live sign test + full login→delegate E2E **blocked on Magic + Particle API keys in `.env`**. Architecture flag: single 7702 delegate slot — Particle UA target vs Stipend policy contract; likely enforce policy via UA wallet calling Stipend contract. **Next:** copy `.env.example` → `.env`, run live test, check Phase 1 box if pass.
- [INIT] Spec created. Idea locked: Stipend. Next action: PHASE 1, clone ua-7702-magic-demo.
