// Public info about the demo agent: its address (derived from the server key)
// and gas balance, so the UI can show setup state without exposing the key.
import { NextResponse } from 'next/server';
import { formatEther } from 'viem';
import {
  PRICE_USDC,
  getAgentAccount,
  getServiceAddress,
  serverPublicClient,
} from '@/lib/server';

export async function GET() {
  try {
    const agent = getAgentAccount();
    const balance = await serverPublicClient.getBalance({
      address: agent.address,
    });
    return NextResponse.json({
      agentAddress: agent.address,
      agentGasEth: formatEther(balance),
      serviceAddress: getServiceAddress(),
      pricePerCall: PRICE_USDC,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
