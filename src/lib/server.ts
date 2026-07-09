// Server-only helpers for the agent scene. Never import from client components.
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

export const PRICE_USDC = '0.05'; // per research call
export const PRICE_6 = parseUnits(PRICE_USDC, 6);

export const serverRpc =
  process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

export const serverPublicClient = createPublicClient({
  chain: base,
  transport: http(serverRpc),
});

export function getServiceAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_SERVICE_ADDRESS;
  if (!addr) throw new Error('NEXT_PUBLIC_SERVICE_ADDRESS not set');
  return addr as `0x${string}`;
}

export function getAgentAccount() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error('AGENT_PRIVATE_KEY not set (server env)');
  return privateKeyToAccount(pk as `0x${string}`);
}

export function getAgentWalletClient() {
  return createWalletClient({
    account: getAgentAccount(),
    chain: base,
    transport: http(serverRpc),
  });
}

// Replay protection for paid calls. In-memory is fine for the demo: a restart
// only lets old (already-mined, already-counted-on-chain) claims be reused for
// the fake data — the money side is enforced by the vault regardless.
const usedPaymentTxs = new Set<string>();

export function isPaymentTxUsed(hash: string): boolean {
  return usedPaymentTxs.has(hash.toLowerCase());
}

export function markPaymentTxUsed(hash: string) {
  usedPaymentTxs.add(hash.toLowerCase());
}
