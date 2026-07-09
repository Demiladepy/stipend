export const BASE_CHAIN_ID = 8453;

export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_STIPEND_VAULT_ADDRESS ||
  '') as `0x${string}`;

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`;

export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

export const USDC_DECIMALS = 6;

export const PERIOD_PRESETS = [
  { label: 'Daily', seconds: 86_400 },
  { label: 'Weekly', seconds: 604_800 },
  { label: 'Monthly', seconds: 2_592_000 },
] as const;

export function periodLabel(seconds: number): string {
  const hit = PERIOD_PRESETS.find((p) => p.seconds === seconds);
  if (hit) return hit.label.toLowerCase();
  if (seconds % 86_400 === 0) return `every ${seconds / 86_400} days`;
  return `every ${Math.round(seconds / 3600)} hours`;
}
