import {
  createPublicClient,
  encodeAbiParameters,
  formatUnits,
  http,
  keccak256,
  parseAbiParameters,
} from 'viem';
import { base } from 'viem/chains';
import { stipendVaultAbi } from './abi';
import { BASE_RPC_URL, USDC_DECIMALS, VAULT_ADDRESS } from './config';

export const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

export type PolicyView = {
  token: `0x${string}`;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  amountPerPeriod: bigint;
  periodSeconds: bigint;
  totalCap: bigint;
  spent: bigint;
  lastPeriodStart: bigint;
  periodSpent: bigint;
  balance: bigint;
  revoked: boolean;
};

export function computeStipendId(
  sender: `0x${string}`,
  recipient: `0x${string}`,
  salt: `0x${string}`,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, address, bytes32'), [
      sender,
      recipient,
      salt,
    ]),
  );
}

export function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')) as `0x${string}`;
}

export async function getPolicy(id: `0x${string}`): Promise<PolicyView> {
  const p = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: stipendVaultAbi,
    functionName: 'getPolicy',
    args: [id],
  });
  return p as PolicyView;
}

export async function getAvailable(id: `0x${string}`): Promise<bigint> {
  return (await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: stipendVaultAbi,
    functionName: 'available',
    args: [id],
  })) as bigint;
}

export function fmtUsdc(v: bigint): string {
  const n = Number(formatUnits(v, USDC_DECIMALS));
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
