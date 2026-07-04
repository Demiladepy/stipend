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
- Deploy: **Vercel** (frontend), **MAINNET contracts** (see chain config below)

### CHAIN CONFIG (LOCKED — mainnet only)
- **Cross-chain demo triangle: Ethereum (1) / Arbitrum (42161) / Base (8453)** — EVM-only,
  deepest UA routing liquidity, easiest cross-chain to test.
- Stipend policy contract deploys on **Base (8453)** (cheapest gas, reference demo default).
- Cross-chain leg for the UA Track requirement: route value **Arbitrum/Ethereum → Base**
  (or Base → Arbitrum) via UA. Pick whichever pair DevRel says is most reliable this week.
- **NO testnet, NO Solana** for the build. Real funds. Budget ~$30–50 in ETH/USDC across the
  three chains for iteration + a clean finale run. Guard keys; use a dedicated dev wallet, not
  a personal one.
- Practical: keep small ETH on Base for delegation gas + small USDC on Arb/ETH/Base for routing.

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
**RESUME HERE NOTE:** _Clone/install/build/dev ✅ in `reference/ua-7702-magic-demo/ua-7702-demo`
(run `pnpm run dev` → localhost:3000). Chain config now LOCKED (see §1): mainnet EVM triangle
ETH/Arb/Base, contract on Base 8453. Arbitrary-target: SDK accepts any address, no client-side
whitelist found in magic-sdk bundle; **live sign-only test still PENDING** — needs Magic +
Particle keys in `.env`, then click "Phase 1: test arbitrary delegate target" on the Delegation
card (button already added to reference demo). Full write-up: `reference/PHASE1_REPORT.md`.
Also PENDING: Particle DevRel on-chain-enforcement question (see ARCHITECTURE DECISION). Given
the mainnet/enforcement pivot to PLAN B (custody), the Magic arbitrary-target answer is no
longer blocking for Phase 2 — but still record it. **Next:** fill `.env`, run live login →
delegate on Base → arbitrary-target test, log pass/fail, then check this box._

---

### ARCHITECTURE DECISION (resolve BEFORE writing Phase 2 Solidity)
DevRel confirmed: **in 7702 mode the EOA _is_ the UA** — the delegation slot points at
Particle's UA implementation; there is NO separate UA smart-account address. Good: no two-hop
address problem. BUT this does NOT by itself confirm WHERE rule enforcement lives. "Any logic
applied to the EOA works" is ambiguous between:
  - Interp 1 (wins): UA can call out to / be gated by a policy contract → enforcement on-chain
    in our code. Moat intact.
  - Interp 2 (kills pitch): "logic" = app-level logic in our dApp that builds the UA txns; the
    EOA enforces nothing → off-chain enforcement → judge asks "what stops a direct call?" →
    no answer.
**Outstanding question to Particle DevRel (ask + confirm before Solidity):** "Can spend rules
be enforced ON-CHAIN in the UA execution path (a hook/module/guardian contract, or a scoped
permission), such that a value transfer that bypasses my app is still blocked? Or does the UA
execute any well-formed transaction it's given?"

**Because the delegation slot is taken by Particle's UA, our enforcement almost certainly must
live at the ASSET layer, not the delegation slot. This is likely the cleanest design anyway:**

**PLAN B (custody-based, delegation-slot-agnostic) — DEFAULT unless DevRel enables a hook:**
Funds to be disbursed are held IN the Stipend contract. The contract only ever releases within
the rule (per-period cap, total cap, revocation). It does NOT matter what the EOA's 7702 slot
points at, because nobody can pull more than the contract allows — the contract holds the money.
The UA's job shrinks to what the UA Track actually requires: **cross-chain routing** of the
deposit in and/or the payout out. This sidesteps the whole one-slot fight.
  - Sender deposits into Stipend contract (funded cross-chain via UA from ETH/Arb → Base).
  - Recipient/agent pulls within policy; contract enforces; UA can route payout to their chain.
  - "Wallet is where limits fire" still true in spirit: the on-chain contract is the enforcer,
    not any off-chain keeper. Pitch stays honest.

**PLAN A (hook-based) — ONLY if DevRel confirms a supported UA hook/permission:**
Keep the delegation-target/policy-in-execution-path design below. Stronger "wallet-native"
story, but depends on Particle exposing a gating mechanism. Do NOT assume it exists.

> Decision rule: default to PLAN B now (it's unblocked and honest). Upgrade to PLAN A only if
> DevRel confirms an on-chain hook/permission before you start the contract. Record the answer
> in the PROGRESS LOG.

---

### [ ] PHASE 2 — Stipend policy contract v1 (2–3 DAYS)
**Goal:** The policy contract that enforces the rule on-chain. Under PLAN B it CUSTODIES funds
and releases within policy; under PLAN A it sits in the UA execution path as a delegation target.
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
  **PLAN B:** sender also DEPOSITS the funding amount into the contract here (or via a separate
  `fund(id)` call). Add a `balance` field to Policy to track custodied funds.
- `claim(id, amount)` — [PLAN B name; PLAN A = `execute`] enforces: not revoked, within period
  cap, within total cap, sufficient custodied balance, period rollover logic; transfers from
  contract to recipient; updates counters. Callable by recipient (pull) or agent. Reverts if
  any check fails. **The enforcement lives here — this is the moat.**
- `revoke(id)` — sender-only. **PLAN B:** refunds remaining custodied balance to sender.
- `modify(id, newPolicy)` — sender-only.
- View helpers: `available(id)`, `getPolicy(id)`, `balanceOf(id)`.
**Tests (Foundry):** happy path, over-period-cap revert, over-total-cap revert, revoked
revert, period rollover, modify, unauthorized-caller revert. **PLAN B adds:** insufficient
custodied balance revert, revoke-refunds-remainder, deposit accounting.
**DONE WHEN:** `forge test` green on all cases; contract deployed to **Base mainnet (8453)**;
address recorded in PROGRESS LOG + `.env`. (Deploy costs real ETH — small on Base.)
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
end-to-end on **mainnet (Arb/ETH → Base via UA)**, visible in the UI, with a tx hash.
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

- [FRI] Chain config LOCKED: mainnet only, EVM triangle ETH(1)/Arbitrum(42161)/Base(8453),
  contract on Base. No testnet, no Solana. DevRel: "in 7702 mode the EOA IS the UA, logic on
  the EOA works automatically" → resolves address-topology (no 2-hop) but NOT enforcement
  location. Defaulting to PLAN B (custody-based: funds held in Stipend contract, released
  within policy, UA does cross-chain routing). Upgrade to PLAN A only if DevRel confirms an
  on-chain UA hook/permission. STILL PENDING: (a) run arbitrary-target sign test for Magic
  whitelist answer; (b) confirm on-chain enforcement question with Particle DevRel.
  Next action: finish Phase 1 15-min live test (Magic keys + $0.01 ETH on Base), report pass/fail.
- [INIT] Spec created. Idea locked: Stipend. Next action: PHASE 1, clone ua-7702-magic-demo.
