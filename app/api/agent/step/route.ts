// One step of the agent loop, executed server-side with the agent's own key.
// The agent never holds the budget: it claims the exact price per call and the
// vault pays the service directly. Anything over the policy reverts on-chain —
// that revert (decoded) is the demo's money shot.
import { NextRequest, NextResponse } from 'next/server';
import { BaseError, ContractFunctionRevertedError } from 'viem';
import { stipendVaultAbi } from '@/lib/abi';
import { VAULT_ADDRESS } from '@/lib/config';
import {
  PRICE_6,
  PRICE_USDC,
  getAgentAccount,
  getAgentWalletClient,
  serverPublicClient,
} from '@/lib/server';

type Entry = {
  kind: 'info' | 'pay' | 'ok' | 'blocked' | 'error';
  msg: string;
  txHash?: string;
  data?: string;
};

const FRIENDLY_ERRORS: Record<string, string> = {
  OverPeriodCap: 'this call would exceed the per-period budget',
  OverTotalCap: 'this call would exceed the lifetime budget',
  InsufficientBalance: 'the stipend pot is empty',
  IsRevoked: 'the stipend was revoked by its owner',
  NotAuthorized: 'this agent is not approved on the stipend',
};

export async function POST(req: NextRequest) {
  const log: Entry[] = [];
  try {
    const { stipendId } = await req.json();
    if (!/^0x[0-9a-fA-F]{64}$/.test(stipendId || '')) {
      return NextResponse.json({ log: [{ kind: 'error', msg: 'bad stipend id' }] });
    }

    const agent = getAgentAccount();
    log.push({
      kind: 'info',
      msg: `agent ${agent.address.slice(0, 8)}… calling research API`,
    });

    // 1. Hit the paid API with no payment — collect the 402 quote.
    const origin = req.nextUrl.origin;
    const quoteRes = await fetch(`${origin}/api/research`);
    const quote = await quoteRes.json();
    if (quoteRes.status !== 402) {
      log.push({ kind: 'error', msg: 'expected a 402 quote, got ' + quoteRes.status });
      return NextResponse.json({ log });
    }
    log.push({
      kind: 'info',
      msg: `402 Payment Required — $${quote.price} USDC to ${String(quote.payTo).slice(0, 8)}…`,
    });

    // 2. Pay from the stipend: claim(price) — the vault sends to the service.
    //    Simulate first so a policy violation surfaces as a decoded error.
    try {
      const { request } = await serverPublicClient.simulateContract({
        account: agent,
        address: VAULT_ADDRESS,
        abi: stipendVaultAbi,
        functionName: 'claim',
        args: [stipendId as `0x${string}`, PRICE_6],
      });
      const wallet = getAgentWalletClient();
      const txHash = await wallet.writeContract(request);
      log.push({
        kind: 'pay',
        msg: `paid $${PRICE_USDC} from stipend (on-chain claim)`,
        txHash,
      });
      await serverPublicClient.waitForTransactionReceipt({ hash: txHash });

      // 3. Retry the API with proof of payment.
      const paidRes = await fetch(`${origin}/api/research`, {
        headers: { 'X-Payment-Tx': txHash },
      });
      const body = await paidRes.json();
      if (paidRes.ok) {
        log.push({ kind: 'ok', msg: '200 OK — data received', data: body.data });
      } else {
        log.push({ kind: 'error', msg: `service rejected payment: ${body.reason}` });
      }
    } catch (err) {
      const revert =
        err instanceof BaseError
          ? err.walk((e) => e instanceof ContractFunctionRevertedError)
          : null;
      if (revert instanceof ContractFunctionRevertedError) {
        const name = revert.data?.errorName ?? 'Reverted';
        log.push({
          kind: 'blocked',
          msg: `BLOCKED ON-CHAIN: ${name}() — ${FRIENDLY_ERRORS[name] ?? 'the policy said no'}. The service was not paid and no data was served.`,
        });
      } else {
        throw err;
      }
    }

    return NextResponse.json({ log });
  } catch (err: any) {
    log.push({ kind: 'error', msg: err?.message || String(err) });
    return NextResponse.json({ log }, { status: 500 });
  }
}
