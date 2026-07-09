// A minimal x402-style paid API. Without payment proof it answers HTTP 402
// with the price and payee; with a valid on-chain claim tx it serves the data.
// Payment lands directly from the StipendVault (the vault pays the service),
// so "did I get paid" is a pure on-chain check.
import { NextRequest, NextResponse } from 'next/server';
import { decodeEventLog } from 'viem';
import { stipendVaultAbi } from '@/lib/abi';
import { VAULT_ADDRESS } from '@/lib/config';
import {
  PRICE_6,
  PRICE_USDC,
  getServiceAddress,
  isPaymentTxUsed,
  markPaymentTxUsed,
  serverPublicClient,
} from '@/lib/server';

const RESEARCH_SNIPPETS = [
  'EIP-7702 delegations on Base crossed 1.2M unique EOAs this quarter.',
  'Stablecoin agent payments grew 34% month over month across x402 endpoints.',
  'Cross-chain USDC routing latency P50 is now under 9 seconds on major routes.',
  'Consumer wallets with programmable spend rules retain users 2.1x longer.',
  'AI agent transaction volume is on pace to pass human DeFi volume by 2027.',
];

function paymentRequired(reason: string) {
  return NextResponse.json(
    {
      error: 'payment_required',
      reason,
      price: PRICE_USDC,
      currency: 'USDC',
      chainId: 8453,
      payTo: getServiceAddress(),
      method:
        'claim from a StipendVault policy whose recipient is payTo, then retry with X-Payment-Tx: <claim tx hash>',
    },
    { status: 402 },
  );
}

export async function GET(req: NextRequest) {
  try {
    getServiceAddress();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
  const payTx = req.headers.get('x-payment-tx');
  if (!payTx) return paymentRequired('no payment attached');
  if (isPaymentTxUsed(payTx)) return paymentRequired('payment already spent');

  let receipt;
  try {
    receipt = await serverPublicClient.getTransactionReceipt({
      hash: payTx as `0x${string}`,
    });
  } catch {
    return paymentRequired('payment tx not found on Base');
  }
  if (receipt.status !== 'success') {
    return paymentRequired('payment tx reverted');
  }

  const service = getServiceAddress().toLowerCase();
  let paid = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({
        abi: stipendVaultAbi,
        data: log.data,
        topics: log.topics,
      });
      if (
        ev.eventName === 'Claimed' &&
        (ev.args as any).recipient.toLowerCase() === service
      ) {
        paid += (ev.args as any).amount as bigint;
      }
    } catch {
      // not a vault event we care about
    }
  }

  if (paid < PRICE_6) {
    return paymentRequired(
      `insufficient payment: got ${paid.toString()} (needed ${PRICE_6.toString()})`,
    );
  }

  markPaymentTxUsed(payTx);
  const snippet =
    RESEARCH_SNIPPETS[Math.floor(Math.random() * RESEARCH_SNIPPETS.length)];
  return NextResponse.json({
    data: snippet,
    paidWith: payTx,
    amount: PRICE_USDC,
  });
}
