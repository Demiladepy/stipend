#!/usr/bin/env bash
# One-shot: deploy vault -> wire env (local + Vercel) -> redeploy frontend.
# Run from repo root once the deploy wallet has ETH on Base.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${1:-https://base-rpc.publicnode.com}"

echo "== 1/5 Deploying StipendVault to Base =="
export PATH="$HOME/.foundry/bin:$PATH"
(cd contracts && forge script script/Deploy.s.sol:DeployStipendVault --rpc-url "$RPC" --broadcast -vv)

echo "== 2/5 Extracting address + block from broadcast =="
ADDR=$(node -e "
const j = require('./contracts/broadcast/Deploy.s.sol/8453/run-latest.json');
const tx = j.transactions.find(t => t.transactionType === 'CREATE');
console.log(tx.contractAddress);
")
BLOCK=$(node -e "
const j = require('./contracts/broadcast/Deploy.s.sol/8453/run-latest.json');
const r = j.receipts && j.receipts[0];
console.log(r ? parseInt(r.blockNumber, 16) : 0);
")
echo "vault: $ADDR  block: $BLOCK"
[ -n "$ADDR" ] && [ "$ADDR" != "undefined" ] || { echo "FATAL: no contract address"; exit 1; }

echo "== 3/5 Writing env files =="
node -e "
const fs = require('fs');
const upsert = (file, kv) => {
  let s = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const [k, v] of Object.entries(kv)) {
    const re = new RegExp('^' + k + '=.*$', 'm');
    s = re.test(s) ? s.replace(re, k + '=' + v) : s.trimEnd() + '\n' + k + '=' + v + '\n';
  }
  fs.writeFileSync(file, s);
};
upsert('.env.local', {
  NEXT_PUBLIC_STIPEND_VAULT_ADDRESS: '$ADDR',
  NEXT_PUBLIC_VAULT_DEPLOY_BLOCK: '$BLOCK',
});
upsert('contracts/.env', { STIPEND_VAULT_ADDRESS: '$ADDR' });
console.log('env files updated');
"

echo "== 4/5 Updating Vercel env =="
npx vercel env rm NEXT_PUBLIC_STIPEND_VAULT_ADDRESS production --yes >/dev/null 2>&1 || true
npx vercel env rm NEXT_PUBLIC_VAULT_DEPLOY_BLOCK production --yes >/dev/null 2>&1 || true
printf '%s' "$ADDR" | npx vercel env add NEXT_PUBLIC_STIPEND_VAULT_ADDRESS production
printf '%s' "$BLOCK" | npx vercel env add NEXT_PUBLIC_VAULT_DEPLOY_BLOCK production

echo "== 5/5 Redeploying frontend to production =="
npx vercel deploy --prod --yes 2>&1 | tail -3

echo ""
echo "LIVE. Vault: https://basescan.org/address/$ADDR"
