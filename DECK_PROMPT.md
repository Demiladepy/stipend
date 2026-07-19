# Prompt for Claude chat — Stipend pitch deck

Paste everything below the line into claude.ai. Fill the ⟨placeholders⟩ first if the live
run has happened; otherwise leave them and regenerate later.

---

Create a pitch deck as a single self-contained HTML artifact: 12 slides, 16:9, dark theme,
navigable with arrow keys and clickable dots, subtle slide-in animations. No external
libraries or fonts — system font stack with a monospace accent.

**Visual system (match exactly — this mirrors our product and the sponsor's own workshop
slides):** background #0b0b0f, panels #141419 with 1px #26262f borders and 16px radius,
primary accent emerald #34d399 (glows, highlights, links), supporting badge colors for
numbered steps: emerald #34d399, blue #60a5fa, violet #a78bfa (small filled circles with
dark numerals, like conference slides). Small uppercase eyebrow labels in accent color above
each slide title (e.g. "THE GAP", "ONE IDEA", "THE CORE"). Big bold titles. Code snippets
in dark blocks with emerald/blue syntax tints. Each slide's footer: "Stipend · UXmaxx 2026 ·
Universal Accounts Track" + slide number.

**Product context:** Stipend = programmable money rules enforced on-chain. A sender sets
who/how-much/how-often/lifetime-cap; funds are custodied in our StipendVault contract on
Base mainnet, which only releases within the rule — no app, keeper, or bank can override it.
Funding is cross-chain in one signature via Particle Universal Accounts in EIP-7702 mode
(email-login EOA IS the universal account, upgraded in place via Privy's
useSign7702Authorization — authorization signed inline with the first transaction). Hero
demo: an AI agent pays an x402-style paid API per call from its stipend — the vault pays
the service directly, the agent never holds funds — and the call that exceeds the budget
reverts on-chain with OverPeriodCap(). Live app: https://stipend-five.vercel.app · repo:
github.com/Demiladepy/stipend · contract: ⟨vault address⟩ on Base.

**The judges must see we did our research — weave these receipts in verbatim where noted:**
- Judging rubric (slide "Built for this rubric"): UX 40% · prominent/novel UA+7702 use 30% ·
  adoption 20% · polish 10%. Map one line of evidence to each.
- From Particle's kickoff workshop (Davide Zambiasi): the closing "Now go build" slide told
  builders to extend the template by "swapping the target —
  createTransferTransaction() / createUniversalTransaction()". We built our entire funding
  mechanic on createUniversalTransaction (transfer-and-call: cross-chain USDC + approve +
  createStipend atomically). Quote the slide, then show our call in a code block.
- Workshop line "The signature MetaMask can't make" (about sign7702Authorization) — reuse
  as the title of the 7702 slide.
- Positioning language (use verbatim, one per slide as a pull-quote): "The wallet is where
  spending limits actually fire" (Joan Alavedra, Openfort) · "EIP-7702 is the quiet unlock"
  (7702 Collective report) · "Asset-centric, not chain-centric" (Derek Chiang, ZeroDev).
- Differentiation line, first content slide, big: "Wallet-enforced delegation — NOT
  vault-based streaming like Sablier."

**Slide order:**
1. Title — logo wordmark "stipend." + tagline "Money with the rules built in." + live URL.
2. Problem — "send it or trust them: nothing in between"; card subscriptions, allowances,
   and the new one: AI agents get your keys or nothing (x402/AP2 assume a budget primitive
   that doesn't exist).
3. Solution — one rule (who · how much · how often · hard cap · revocable), three colored
   numbered points: enforced by the contract holding funds / funded from any chain in one
   signature / email onboarding, recipients never need gas.
4. Demo: the agent scene — 4-step timeline with tx links ⟨funding tx⟩ ⟨claim tx⟩
   ⟨blocked call⟩ ⟨revoke tx⟩; render the blocked step in red monospace:
   "BLOCKED ON-CHAIN: OverPeriodCap() — no payment, no data."
5. "The signature MetaMask can't make" — EIP-7702 + Privy inline auth + code block of the
   authorization flow; "same address, same keys, reversible."
6. "Swap the target" — the workshop quote + our createUniversalTransaction code block;
   caption: "we built our product on the exact extension point the sponsor pointed at."
7. Where enforcement lives — honest architecture: 7702 gives one delegation slot; Particle's
   UA occupies it; so the rule lives at the asset layer (custody). "Bypass our app entirely —
   the rule still holds." 21/21 Foundry tests badge.
8. Three scenes, one primitive — agent budgets / revocable subscriptions / allowances.
9. Built for this rubric — the 40/30/20/10 mapping.
10. Traction surface — every x402 service needs a budget layer; agent payments growth.
11. Roadmap — scoped policies v2 · Universal Agent Accounts ("we built the consumer MVP of
    the pattern before the infra shipped") · everywhere 7702 goes (Mezo ships type-0x04 at
    genesis — BTC-backed allowances one deploy away).
12. Close — tagline, live URL, repo, contract address, "every claim in this deck is a
    clickable transaction."
