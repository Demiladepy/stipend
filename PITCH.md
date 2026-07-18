# Stipend — Pitch Deck Draft (Phase 6)

> Slides in order. Speaker notes in blockquotes. Fill `⟨tx⟩` placeholders after the live run.

---

## 1 · Title
**Stipend — money with the rules built in.**
Wallet-enforced budgets for people and AI agents.

> Ten words before the judges categorize you: "This is wallet-enforced delegation,
> not vault-based streaming like Sablier."

## 2 · Problem
- You can send money, or you can trust someone with money. **There's nothing in between.**
- Subscriptions: the processor enforces the rule, not you. Cancellation is a support ticket.
- Allowances: all-at-once or constant manual sends.
- **AI agents (the new one): you either give an agent your keys — unlimited — or nothing.**
  Every agent-payments standard (x402, AP2, ACP) assumes a budget primitive that doesn't exist.

## 3 · Solution
One rule: **who · how much · how often · hard lifetime cap · revocable.**
- Enforced by the contract that **holds the funds** on Base — not by our app, not by a keeper.
- Funded from **any chain** in one signature (Particle Universal Accounts, EIP-7702 mode).
- Recipients onboard with an **email address** (Privy embedded wallet). No seed phrase, no gas.

## 4 · The hero demo (agent on a budget)
1. Sender creates a $0.25/day rule for a paid research API — funded with USDC that
   lived on **Arbitrum**, landing in the vault on **Base** in one signature. `⟨funding tx⟩`
2. AI agent pays the API per call from the stipend — **the vault pays the service
   directly; the agent never holds a cent.** `⟨claim txs⟩`
3. The call that would cross the cap: **rejected on-chain — `OverPeriodCap()`.**
   No payment. No data. No app logic involved. `⟨blocked call screenshot⟩`
4. Sender clicks revoke: remaining balance refunds instantly. `⟨revoke tx⟩`

> This is the moment. Pause on the red BLOCKED line.

## 5 · Why EIP-7702 + Universal Accounts (novelty)
- The email-login EOA **is** the Universal Account — upgraded in place, same address,
  authorization signed inline with the first transaction (Privy `useSign7702Authorization`).
- Cross-chain funding uses `createUniversalTransaction` — **transfer-and-call**:
  USDC sourced cross-chain + `approve` + `createStipend` execute atomically on Base.
  (The extension point Particle's own workshop points builders at — we built a product on it.)
- Not session-keys-for-trading, not another swap UI: a **consumer money primitive**.

## 6 · Where enforcement lives (the honest architecture slide)
- 7702 gives an EOA one delegation slot; Particle's UA occupies it. So we enforce at the
  **asset layer**: funds sit in StipendVault; nothing can leave outside the rule.
- No keeper. No off-chain watcher. Bypass our app entirely — the rule still holds.
- 21/21 Foundry tests; ~250 lines of Solidity; custom errors the UI surfaces by name.

> If a judge asks "what stops a direct call?" — this slide is the answer: nothing to
> bypass, the money itself is inside the policy.

## 7 · Three scenes, one primitive
| | |
|---|---|
| 🤖 Agent budgets | $50/wk, $5/call — the chain says no on overspend |
| 🎨 Subscriptions | recurring support, one-click revoke + instant refund |
| 👨‍👧 Allowance | weekly, can never be blown in a day, gasless email claim |

## 8 · Judging-criteria fit
- **UX 40%**: email login → funded rule in under a minute; zero jargon; recipients never see gas.
- **Novel UA+7702 use 30%**: 7702 UA as *enforceable budget rail*, transfer-and-call funding.
- **Adoption 20%**: agent payments are exploding; every x402 service needs a budget layer.
- **Polish 10%**: consumer-grade UI, live 3D, named on-chain errors in plain English.

## 9 · Roadmap
- **Scoped policies v2** — gate *what* a claim pays for (merchant lists, categories).
- **Universal Agent Accounts** — when Particle ships agent-native accounts, Stipend is the
  budget layer on top: *we built the consumer MVP of the pattern before the infra shipped.*
- **Everywhere 7702 goes** — the standard is spreading (even Bitcoin-secured chains like
  Mezo ship type-0x04 at genesis). BTC-backed allowances are one deploy away.

## 10 · Ask
Universal Accounts Track. Live at stipend.vercel.app · contract on Base `⟨vault addr⟩` ·
every claim in this deck is a clickable transaction.

---

## 90-second video script
| t | shot | line |
|---|---|---|
| 0–8s | landing, 3D hero | "Money today is all-or-nothing: send it, or trust someone with it." |
| 8–20s | email login → debug-free create form | "Stipend adds the in-between: a rule. Who, how much, how often, hard cap." |
| 20–35s | create + route resolving | "Funded with one signature — from USDC sitting on a different chain." |
| 35–60s | agent page, calls running | "This AI agent pays a research API from its budget. It never holds the money." |
| 60–72s | the blocked call | "And when it tries to overspend — the chain itself says no. Not our app. The chain." |
| 72–85s | revoke + refund landing | "Change your mind? Revoke. The rest comes straight back." |
| 85–90s | logo + tagline | "Stipend. Money with the rules built in." |
