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
- Onboarding / signer: **Privy embedded wallet** (`@privy-io/react-auth` — email OTP,
  `useSign7702Authorization` for inline 7702 auths, `useSignMessage` for rootHash).
  **MAGIC IS DROPPED (Jul 14): paywall + unresponsive team. Magic bonus no longer targeted.**
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
- `github.com/soos3d/workshop-demo-02` (**Davide's official kickoff-workshop template** — UA SDK
  v2, Magic auth, undelegate flow, delegation guide in docs/. Cloned to
  `reference/workshop-demo-02`. His closing slide endorses exactly our extension path:
  "swap the target — createTransferTransaction() / createUniversalTransaction()".)
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
**RESUME HERE NOTE:** _**PIVOTED TO PRIVY (Jul 14)** — Magic dropped (paywall + unresponsive).
Privy wired per `reference/universal-accounts-7702` (Particle's own Privy repo, cloned):
PrivyProvider (email login, embedded wallet createOnLogin all-users) → AuthProvider →
UAProvider. KEY SIMPLIFICATION vs Magic: NO pre-delegation tx — Privy's
`useSign7702Authorization().signAuthorization` signs auths INLINE per userOp
(`eip7702Auth && !eip7702Delegated`), serialized via ethers `Signature.from({r,s,v ??
BigInt(yParity), yParity})`; rootHash signed with Privy `useSignMessage`; Particle broadcasts
the Type-4. `ensureDelegated`/`undelegate` removed (Magic-only plumbing). Debug panel
(`src/components/DebugPanel.tsx`, on / and /dashboard, hide via NEXT_PUBLIC_SHOW_DEBUG=0)
shows email/EOA/7702-status/UA balance. Build green; guard screen verified when app id
missing. **LIVE GATE STILL PENDING — needs user: create Privy app (dashboard.privy.io →
enable Email + embedded wallets) → NEXT_PUBLIC_PRIVY_APP_ID in .env.local → real login →
confirm EOA + UA balance in debug panel. Then check this box.** Old Magic arbitrary-target
question is MOOT (Privy signs arbitrary targets; enforcement is Plan B anyway)._

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
**RESUME HERE NOTE:** _Contract WRITTEN + fully TESTED + deploy script READY; **mainnet broadcast
BLOCKED** until `contracts/.env` exists with a **funded dedicated dev wallet** (~0.001 ETH on
Base). Foundry project at `contracts/` (Soldeer, no submodules). Contract:
`contracts/src/StipendVault.sol` (PLAN B). Tests: **21/21 PASS**. Deploy:
`contracts/script/Deploy.s.sol` — simulates clean on Base 8453. To deploy: (1) `cp
contracts/.env.example contracts/.env` and fill `PRIVATE_KEY` + `BASE_RPC_URL`; (2) from
`contracts/`, run `.\deploy.ps1` OR `forge script script/Deploy.s.sol:DeployStipendVault
--rpc-url base --broadcast -vvvv`; (3) copy address into `contracts/.env` +
`NEXT_PUBLIC_STIPEND_VAULT_ADDRESS` in root `.env.local`; (4) check this box. Deviations:
`initialDeposit` arg on createStipend; `approveAgent` for agent claims; whole-period rollover._

---

### [ ] PHASE 3 — Sender flow + UA cross-chain funding (2–3 DAYS)
**Goal:** A sender logs in, creates a Stipend, and FUNDS it cross-chain via UA — i.e. the
sender pays from USDC/ETH on Arbitrum or Ethereum, and the value lands in the StipendVault
contract on Base. This cross-chain deposit IS the UA Track requirement ("at least one
cross-chain operation moving value via UA"). Enforcement already lives in the contract (Plan B),
so UA's job here is purely routing the funds in.

**The critical mechanic (read carefully):**
The sender's funds are on chain X (Arb/ETH). StipendVault lives on Base. We need UA to move
value from chain X and call `createStipend`/`fund` on Base in one abstracted flow. Two ways,
try in this order:
  1. **UA transfer-and-call:** if the UA SDK supports routing value to a destination contract
     call, target StipendVault.fund(id) on Base with USDC sourced cross-chain. Preferred —
     single user action, true chain abstraction, best demo.
  2. **UA deposit → then contract call:** if (1) isn't supported, use UA to bridge USDC to the
     sender's UA balance on Base, then a second tx calls fund(id). Two steps but still
     UA-powered and still cross-chain. Acceptable fallback.
Confirm which the SDK supports early (Discord Q3 covers this). Do NOT block on the answer —
test (1), fall back to (2) if it fails.

**Tasks:**
1. Magic email login for sender → 7702-upgraded UA (reuse the ua-7702-magic-demo flow).
2. "Create Stipend" form: recipient (email or address), token (USDC), amountPerPeriod,
   periodSeconds (daily/weekly/monthly presets), totalCap, initial funding amount.
   ZERO jargon — say "how much per week", "total budget", not "periodSeconds"/"cap".
3. On submit: UA sources the funding amount from the sender's balance on Arb/ETH and lands it
   in StipendVault on Base via createStipend/fund. Show the cross-chain route resolving in UI.
4. "My Stipends" dashboard: list active rules with amount available this period, total
   remaining, top-up / modify / revoke buttons. Revoke shows the refund landing back.
5. Capture the funding tx hash + cross-chain route for the demo/README.

**DONE WHEN:** sender creates a Stipend funded by a REAL cross-chain UA transfer
(Arb/ETH → Base, mainnet), the funds are custodied in StipendVault, and the dashboard shows
the active rule. Record the tx hash + which route worked (mechanic 1 or 2) in PROGRESS LOG.
**RESUME HERE NOTE:** _Frontend BUILT + compiles green (`npx next build`); **live cross-chain
funding test PENDING** — blocked on (a) StipendVault deploy (Phase 2 box) and (b) Magic/Particle
keys in `.env.local`. Next.js App Router app at repo root: `app/` (landing/create/dashboard) +
`src/` (providers/lib/components). Mechanic 1 CONFIRMED SUPPORTED in SDK typings:
`createUniversalTransaction({chainId, expectTokens, transactions})` → approve+createStipend in
one cross-chain flow (implemented in `src/providers/UAProvider.tsx`). Dashboard reads via
localStorage ids + StipendCreated log recovery; revoke + top-up wired through UA. To go live:
(1) deploy contract, put address in `.env.local` `NEXT_PUBLIC_STIPEND_VAULT_ADDRESS` (+
`NEXT_PUBLIC_VAULT_DEPLOY_BLOCK` for log recovery); (2) fill Magic/Particle keys; (3) run
`pnpm dev`, login, create+fund a real stipend Arb/ETH→Base; (4) record tx hash here + check box._

**PHASE 3 CURSOR PROMPT (paste when Phase 2 contract is deployed):**
```
Read STIPEND_BUILD.md fully. Phase 2 StipendVault is deployed on Base (address in .env).
Starting PHASE 3: sender flow + UA cross-chain funding.

Base the app on the ua-7702-magic-demo reference (Magic email login → 7702 UA). Build in the
Next.js App Router frontend:

1. A "Create Stipend" page with a jargon-free form: recipient (email or 0x address), amount
   per period, period (daily/weekly/monthly buttons), total budget, initial funding amount.
   Map friendly inputs to contract params (weekly = 604800 periodSeconds, etc).

2. On submit, use the Particle Universal Accounts SDK to fund StipendVault on Base with USDC
   sourced cross-chain from the sender's balance on Arbitrum or Ethereum. FIRST try a UA
   transfer-that-targets-a-destination-contract-call (route value + call StipendVault.fund(id)
   on Base in one flow). IF the SDK doesn't support transfer-and-call, FALL BACK to: UA bridges
   USDC to the sender's UA balance on Base, then a second call invokes createStipend/fund.
   Log clearly in the UI which path executed and show the cross-chain route resolving.

3. A "My Stipends" dashboard reading from StipendVault: active policies, available-this-period,
   total remaining, with top-up / modify / revoke actions wired to the contract.

Keep all user-facing copy jargon-free (no "EOA", "delegation", "periodSeconds"). Use viem for
contract reads/writes. Do NOT hardcode secrets — read from .env, dedicated dev wallet only.

When a real cross-chain funding tx lands on Base mainnet and the dashboard shows the active
Stipend, update the PHASE 3 RESUME NOTE + PROGRESS LOG with the tx hash and which UA mechanic
worked. Do not start Phase 4 until this is green.
```

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
**RESUME HERE NOTE:** _Code BUILT + compiles green; **live run PENDING** (needs vault deploy +
`AGENT_PRIVATE_KEY` + `NEXT_PUBLIC_SERVICE_ADDRESS` in `.env.local`, agent wallet needs
~0.0005 ETH on Base gas). Design: stipend recipient = the paid service's address; agent is an
`approveAgent`-approved claimer → vault pays the service DIRECTLY per call; agent never
custodies funds. Endpoints: `/api/research` (x402-style: 402 + price/payTo unpaid → verifies
Claimed event on Base via `X-Payment-Tx` header, replay-protected), `/api/agent/step`
(server-side agent wallet: quote → simulate+claim → retry with proof; decodes custom errors
so OverPeriodCap/OverTotalCap render as "BLOCKED ON-CHAIN"), `/api/agent/info`. UI: `/agent`
(approve agent, run calls, live activity log, budget readout), `/claim` (recipient views
stipends addressed to them via logs, claims via UA — gasless for them). Demo script: create
stipend w/ recipient=service, approve agent, run calls until the over-cap call reverts._

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
- ~~BONUS: Magic Labs challenge ($500)~~ DROPPED Jul 14 (Magic paywall + unresponsive team;
  switched to Privy — same auth UX, same 7702 path, matches Particle's own reference repo)
- Incubation candidacy: Particle (UA-Track winners considered)

## KEY DEADLINES (confirm against the live Encode page — these may have shifted)
- Project outline / description milestone: ~Jun 29
- Mid-hackathon checkpoint: ~Jul 5
- Final submission: ~Jul 19 (midnight Sunday)
- Finale & prizegiving: ~Jul 30

---

## PROGRESS LOG (append every session — newest at top)
<!-- FORMAT: [DATE] Phase X — what got done, what's blocking, exact next step -->

- [TUE-Jul14-2] Privy app LIVE in the app — App ID `cmrpjqesu…e7b4` in `.env.local`
  (app secret NOT stored anywhere — frontend doesn't need it). Verified in browser:
  PrivyProvider reaches ready state, debug panel renders (privy: logged out / EOA — /
  7702 not delegated / UA balance —), clicking "Continue with email" OPENS THE PRIVY
  LOGIN MODAL on localhost with zero console errors. Phase 1 gate now needs only the
  human step: user logs in with their email OTP → debug panel should show email + EOA +
  UA balance. Then: vault deploy (still the critical path), agent env, live cross-chain
  run. 5 days to submission.

- [TUE-Jul14 #2] MAGIC → PRIVY PIVOT (full migration in one session) — Magic dropped
  (paywall + unresponsive team; Magic bonus prize abandoned). Cloned Particle's own Privy
  reference (`reference/universal-accounts-7702`) and mirrored its pattern exactly:
  PrivyProvider (email OTP modal, embedded wallet on login, dark theme + accent) →
  new `AuthProvider` (useAuth: email/EOA/login/logout) → UAProvider rewritten for INLINE
  7702 auths (signAuthorization per userOp + signMessage over rootHash; ethers Signature
  serialization with yParity). Deleted MagicProvider; removed ensureDelegated/undelegate
  everywhere (not needed with Privy — Particle broadcasts Type-4 with inline auth). All 6
  pages migrated; landing now opens Privy modal. Added `DebugPanel` (email, EOA, 7702
  status, UA balance; NEXT_PUBLIC_SHOW_DEBUG=0 hides). Webpack: aliased Privy optional
  deps (@stripe/crypto, @farcaster/mini-app-solana) to false. Build green; guard screen
  verified. **PHASE 1 LIVE GATE now needs: Privy App ID (user creates at dashboard.privy.io,
  Email + embedded wallets enabled) in .env.local, then real login → debug panel shows EOA
  + UA balance. Vault deploy STILL pending (unchanged). Did Privy login work live: NOT YET
  TESTED (no app id). Friction so far: none beyond optional-dep aliasing.**

- [TUE-Jul14] Phase 5 partial + README + modify — Wrote the full README (wallet-enforced
  line up top, mermaid architecture, contract table, env table, 90-sec demo script, prize
  mapping, roadmap incl. Mezo/7702-everywhere line). Added the missing `modify` action
  (UAProvider.modifyStipend + inline "Change rule" editor on dashboard — spec Phase 3
  required top-up/modify/revoke). Added undelegate to dashboard ("Your wallet, your exit"
  — reversibility demo point). Landing: 3-step how-it-works strip + footer with pitch line
  + GitHub link. App icon (S-mark) + OG metadata. Build green, all pages verified, no
  console errors. Committed + pushed. **5 days left. STILL USER-BLOCKED (unchanged since
  Jul 9): (1) vault deploy — contracts/.env with funded dev wallet (~0.002 ETH Base) then
  deploy.ps1; (2) AGENT_PRIVATE_KEY + NEXT_PUBLIC_SERVICE_ADDRESS in .env.local; (3) first
  email login test. Until (1) lands nothing can run live — this is THE critical path.**
  Remaining after that: live e2e + tx hashes → Vercel deploy → Magic dashboard branding →
  video + deck → submit by Jul 18.

- [THU-Jul9] Phase 4 code COMPLETE (live run pending) + keys wired — `.env.local` now has
  Magic pk + Particle project/client/app ids (user created dashboards; Particle app domain
  registered as stipend.vercel.app — add localhost if origin errors appear). App boots clean
  with real keys. Built the AGENT HERO SCENE: x402-style paid API (`/api/research`, 402 →
  on-chain payment verification via Claimed event), server-side agent runner
  (`/api/agent/step`, simulate-first so policy reverts decode to named errors), `/agent`
  demo page (activity log + budget bar + BLOCKED-ON-CHAIN moment), `/claim` recipient page
  (log-scan by recipient, gasless claim via UA). Architecture: stipend recipient = service
  address, agent approved via approveAgent → vault pays service directly, agent never holds
  funds. UAProvider gained claimStipend + approveAgentOnStipend. Build green, all routes
  verified rendering. REMAINING TO GO LIVE (user): (1) deploy vault (funded dev wallet →
  `contracts/.env` → deploy.ps1), (2) `AGENT_PRIVATE_KEY` (fresh key, ~0.0005 ETH Base) +
  `NEXT_PUBLIC_SERVICE_ADDRESS` in `.env.local`, (3) email login test, (4) live cross-chain
  create+fund → record tx. Timeline to Jul 19: live e2e by Jul 12, polish Jul 13–15,
  submission assets Jul 16–18.

- [WED-Jul8] Workshop video intel + SDK v2 upgrade — User watched the Particle kickoff
  workshop (Davide Zambiasi). His template repo `soos3d/workshop-demo-02` cloned to
  `reference/workshop-demo-02`. VALIDATIONS: (a) our two-provider architecture (Magic +
  UA) is exactly the workshop's blessed pattern; (b) closing slide says "swap the target:
  createTransferTransaction()/createUniversalTransaction()" → our mechanic-1 transfer-and-
  call is the officially endorsed extension point; (c) "swap the wallet → straight at the
  bounties" confirms Magic-signer = Magic bonus play. CHANGES MADE: upgraded app to UA SDK
  **v2.0.3** (workshop version; v1→v2 drop-in for our APIs — only `universalGas` removed
  from ITradeConfig; bundle −114 kB), added `undelegate()` to UAProvider (zero-address
  authorization reverts EOA to plain wallet — reversibility talking point + Phase 5 UI
  candidate). Build green, UI verified, no console errors. `docs/eip7702-delegation-guide.md`
  in the workshop repo is the canonical write-up of the delegation flow (incl. the
  nonce+1 and personal_sign-over-rootHash gotchas we already handle). STILL BLOCKING LIVE
  TEST: contract deploy (funded dev wallet) + Magic/Particle keys in `.env.local`.

- [SUN-Jul5] Phase 3 frontend BUILT — Next.js 14 App Router app scaffolded at repo root
  (pnpm; magic-sdk + @magic-ext/evm + UA SDK + viem + ethers + tailwind). Pages: landing
  (email login), /create (jargon-free form → UA cross-chain funding), /dashboard (live
  policy reads, top-up, revoke-with-refund). Providers ported from reference demo
  (`src/providers/MagicProvider.tsx`, `UAProvider.tsx` — 7702 mode, ensureDelegated,
  signAndSend). ABI auto-generated from forge output (`src/lib/abi.ts`). KEY FINDING:
  UA SDK supports MECHANIC 1 (transfer-and-call) — `createUniversalTransaction` takes
  `expectTokens` + arbitrary `transactions[]` on the destination chain, so approve +
  createStipend execute atomically with USDC sourced cross-chain. Implemented for create,
  fund (top-up), and revoke. Build green; UI verified rendering in browser (no console
  errors). TS gotcha solved: UA SDK package.json exports lacks `types` condition → fixed
  via tsconfig `paths` mapping to its dist/index.d.ts. STILL BLOCKING LIVE TEST: contract
  deploy (needs funded dev wallet in `contracts/.env`) + Magic/Particle dashboard keys in
  `.env.local`. Mid-hackathon checkpoint due TONIGHT 23:59 — submit progress write-up.
  Next: user funds wallet → deploy → live cross-chain funding tx → record hash.

- [SAT-2] Phase 2 deploy prep — Wrote `contracts/script/Deploy.s.sol` + `contracts/deploy.ps1`,
  added Base RPC/etherscan to `foundry.toml`, created `contracts/.env.example` + root
  `.env.example` (USDC `0x833589…2913` on Base). Script simulates successfully on Base mainnet
  (chain 8453). **Broadcast blocked:** no `contracts/.env` with funded dev wallet PRIVATE_KEY.
  Next: user creates `contracts/.env`, runs `.\deploy.ps1` from `contracts/`, records address,
  checks Phase 2 box, starts Phase 3.
- [FRI-2] TRACK DECISION: registered for General + Magic + UA on the platform, but General and
  UA are MUTUALLY EXCLUSIVE main tracks ("submit to one main track"). COMMITTING: Universal
  Accounts Track as sole main track + Magic Labs bonus. Drop General (and its Openfort/ZeroDev
  subtracks) — they'd require 3 sponsor stacks and dilute the build. Keep x402 in the agent
  scene as a DESIGN element for pitch language, NOT as an Openfort subtrack entry (Openfort
  subtrack needs Openfort backend wallets, conflicts with the Magic-onboards-everyone story).
  Max stack: $2,500 UA 1st + $500 Magic = $3,000 + Particle incubation candidacy.
  Phase 3 spec expanded with UA cross-chain funding mechanic + Cursor prompt.
- [SAT] Phase 2 (PLAN B) — Scaffolded Foundry project at `contracts/` using **Soldeer** (no git
  submodules — deps vendored under `contracts/dependencies/`: OZ 5.1.0 + forge-std 1.9.5). Wrote
  `src/StipendVault.sol`: custody-based enforcement (createStipend/fund/claim/revoke/modify/
  approveAgent + views available/balanceOf/getPolicy), SafeERC20 + ReentrancyGuard, native +
  ERC20 (USDC) support, whole-period rollover, custom errors. Wrote `test/StipendVault.t.sol` →
  **21/21 tests PASS** covering every required case: happy claim, over-period-cap, over-total-cap,
  revoked, rollover reset + whole-period alignment, insufficient balance, revoke-refunds-remainder,
  modify + non-sender revert + cap-below-spent, non-recipient/non-agent revert, agent claim,
  native path, deposit accounting, reentrancy guard. Deviations: added `initialDeposit` arg to
  createStipend (ERC20 funding at creation); added agent-approval mechanism. NOT deployed (per
  instruction). Blocking Phase 2 completion: Base mainnet deploy. Next action: write `Deploy.s.sol`,
  deploy to Base 8453 with dedicated dev wallet, record address in this log + frontend `.env`.
- [FRI] Chain config LOCKED: mainnet only, EVM triangle ETH(1)/Arbitrum(42161)/Base(8453),
  contract on Base. No testnet, no Solana. DevRel: "in 7702 mode the EOA IS the UA, logic on
  the EOA works automatically" → resolves address-topology (no 2-hop) but NOT enforcement
  location. Defaulting to PLAN B (custody-based: funds held in Stipend contract, released
  within policy, UA does cross-chain routing). Upgrade to PLAN A only if DevRel confirms an
  on-chain UA hook/permission. STILL PENDING: (a) run arbitrary-target sign test for Magic
  whitelist answer; (b) confirm on-chain enforcement question with Particle DevRel.
  Next action: finish Phase 1 15-min live test (Magic keys + $0.01 ETH on Base), report pass/fail.
- [INIT] Spec created. Idea locked: Stipend. Next action: PHASE 1, clone ua-7702-magic-demo.
