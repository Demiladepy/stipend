# Phase 1 Report — Validate the foundation

**Date:** 2026-07-01  
**Repo:** `reference/ua-7702-magic-demo/ua-7702-demo`

## What ran successfully (no API keys required)

| Step | Result |
|------|--------|
| Clone `ua-7702-magic-demo` → `reference/` | ✅ |
| `pnpm install` | ✅ (11m) |
| `pnpm run build` | ✅ compiles clean |
| `pnpm run dev` | ✅ http://localhost:3000 |

## What still needs your API keys (15 min)

Copy `ua-7702-demo/.env.example` → `ua-7702-demo/.env` and fill:

- `NEXT_PUBLIC_MAGIC_API_KEY` — [dashboard.magic.link](https://dashboard.magic.link)
- `NEXT_PUBLIC_PROJECT_ID`, `NEXT_PUBLIC_CLIENT_KEY`, `NEXT_PUBLIC_APP_ID` — [dashboard.particle.network](https://dashboard.particle.network)
- `NEXT_PUBLIC_BASE_RPC_URL` — Alchemy/Infura Base mainnet RPC

Then:

1. Open http://localhost:3000
2. Email OTP login → confirm EOA address appears
3. Click **Delegate on Base** → confirm status turns green (needs ~$0.01 ETH on Base for gas)
4. Click **Phase 1: test arbitrary delegate target** → records whether Magic signs for `0x…dEaD`

Update `STIPEND_BUILD.md` PROGRESS LOG with pass/fail from step 4.

---

## Chain intersection (deployable set)

### Particle UA SDK — EVM chains in SDK enum

`1` Ethereum, `10` Optimism, `56` BNB, `137` Polygon, `143` Monad, `146` Sonic, `196` X Layer, `8453` Base, `42161` Arbitrum, `43114` Avalanche, `5000` Mantle, `59144` Linea, `80094` Berachain, + others (see `CHAIN_ID` in `@particle-network/universal-account-sdk`).

Cross-chain UA also routes to **Solana (101)**.

### Magic EIP-7702 — documented networks

Per [Magic EIP-7702 docs](https://docs.magic.link/embedded-wallets/wallets/features/eip-7702):

- Ethereum Mainnet, **Sepolia**, **Arbitrum**, **Base**, **Optimism**
- Any EVM chain with 7702 support if configured via custom `rpcUrl` + `chainId` in Magic `EVMExtension`

### This demo — actual config

| Layer | Chain | Notes |
|-------|-------|-------|
| Magic default EOA | **Base mainnet (8453)** | `MagicProvider.tsx` |
| 7702 delegation target | **Base (8453)** | `ensureDelegated()` |
| Cross-chain convert demo | Base → **Solana** | `UniversalAccountCard.tsx` |

### Recommended intersection for Stipend v1

**Primary:** `8453` Base mainnet (matches reference demo, Magic + Particle both support 7702)

**Alternates (Magic 7702 docs):** `42161` Arbitrum, `1` Ethereum, `10` Optimism

**Testnet option:** `11155111` Sepolia (Magic docs; reconfigure `MagicProvider` + `BASE_CHAIN_ID`)

**Not in Magic 7702 docs:** Polygon, BNB, etc. — UA may route there but Magic 7702 signing on those chains is unverified.

---

## Critical unknown: arbitrary delegation target

### SDK surface (pre-live)

- `magic.wallet.sign7702Authorization({ contractAddress, chainId, nonce? })` accepts **any** `contractAddress` string
- No client-side whitelist in `magic-sdk@33.7.1` bundle (grep: no `whitelist` / `allowlist`)
- Magic Express API also takes arbitrary `address` in POST body

### Live test (added to reference demo)

`DelegationCard` now has **Phase 1: test arbitrary delegate target** — signs auth for `0x000…dEaD` on Base without broadcasting. Result tells us if Magic **server** enforces a whitelist.

### Architectural constraint (even if Magic allows arbitrary targets)

**EIP-7702 allows ONE delegation target per EOA at a time.**

Particle UA requires delegating to **Particle's UA implementation** (`getEIP7702Auth()` address). Stipend spec Phase 2 proposes delegating to a **custom policy contract**.

These cannot both be the 7702 target simultaneously. Likely architecture for hackathon:

```
EOA --7702--> Particle UA delegate --calls--> Stipend policy contract (execute/enforce)
```

Policy enforcement lives in Stipend contract; Particle delegate stays the 7702 target for UA Track prize. **Update Phase 2 spec** if live arbitrary-target test passes but single-slot constraint blocks "policy AS delegate."

### If Magic whitelists targets (live test fails)

Workarounds (in priority order):

1. **Policy contract called by UA wallet** (not the 7702 target) — keeps UA + Magic bonus
2. **Policy logic as module** inside approved delegate (heavy; unlikely in hackathon window)
3. **Contact Magic** for allowlist add (slow; don't bet on it)

---

## Magic caveat (from reference demo)

Magic cannot sign `chainId: 0` (chain-agnostic). UA SDK may return chain-agnostic auths; workaround is pre-delegate per chain with explicit `chainId` before cross-chain ops (`UniversalAccountProvider.tsx` comment).

---

## Next step

1. Add `.env` credentials → finish live login + arbitrary-target button
2. If arbitrary target **passes**: revise Phase 2 to "policy contract enforced by UA-delegated wallet" (not "policy AS 7702 target")
3. If arbitrary target **fails**: policy-via-UA-calls is the only path; document in pitch as "enforcement primitive, UA for routing"
