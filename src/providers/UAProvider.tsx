'use client';

import {
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
  SUPPORTED_TOKEN_TYPE,
  type IAssetsResponse,
} from '@particle-network/universal-account-sdk';
import { BrowserProvider, getBytes, Signature } from 'ethers';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { stipendVaultAbi } from '@/lib/abi';
import {
  BASE_CHAIN_ID,
  USDC_ADDRESS,
  USDC_DECIMALS,
  VAULT_ADDRESS,
} from '@/lib/config';
import { computeStipendId, randomSalt } from '@/lib/vault';
import { useMagic } from './MagicProvider';

type CreateStipendInput = {
  recipient: `0x${string}`;
  amountPerPeriod: string; // human USDC, e.g. "5"
  periodSeconds: number;
  totalCap: string;
  initialDeposit: string;
};

type CreateStipendResult = {
  id: `0x${string}`;
  salt: `0x${string}`;
  transactionId: string;
  mechanic: 'transfer-and-call';
};

type UAContextType = {
  universalAccount: UniversalAccount | null;
  primaryAssets: IAssetsResponse | null;
  isDelegated: boolean;
  loading: boolean;
  refreshBalance: () => Promise<void>;
  ensureDelegated: () => Promise<void>;
  undelegate: () => Promise<void>;
  createStipendCrossChain: (
    input: CreateStipendInput,
  ) => Promise<CreateStipendResult>;
  fundStipendCrossChain: (id: `0x${string}`, amount: string) => Promise<string>;
  revokeStipend: (id: `0x${string}`) => Promise<string>;
  claimStipend: (id: `0x${string}`, amount: string) => Promise<string>;
  approveAgentOnStipend: (
    id: `0x${string}`,
    agent: `0x${string}`,
  ) => Promise<string>;
};

const UAContext = createContext<UAContextType>(null as any);
export const useUniversalAccount = () => useContext(UAContext);

export function UAProvider({ children }: { children: ReactNode }) {
  const { magic, userAddress } = useMagic();
  const [universalAccount, setUniversalAccount] =
    useState<UniversalAccount | null>(null);
  const [primaryAssets, setPrimaryAssets] = useState<IAssetsResponse | null>(
    null,
  );
  const [isDelegated, setIsDelegated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) {
      setUniversalAccount(null);
      setPrimaryAssets(null);
      setIsDelegated(false);
      return;
    }
    const ua = new UniversalAccount({
      projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
      projectClientKey: process.env.NEXT_PUBLIC_CLIENT_KEY!,
      projectAppUuid: process.env.NEXT_PUBLIC_APP_ID!,
      smartAccountOptions: {
        useEIP7702: true,
        name: 'UNIVERSAL',
        version: UNIVERSAL_ACCOUNT_VERSION,
        ownerAddress: userAddress,
      },
      tradeConfig: {
        slippageBps: 100,
      },
    });
    setUniversalAccount(ua);
  }, [userAddress]);

  const refreshDelegationStatus = useCallback(async () => {
    if (!universalAccount) return;
    const deployments = await universalAccount.getEIP7702Deployments();
    const baseDep = (deployments as any[]).find(
      (d) => d.chainId === BASE_CHAIN_ID,
    );
    setIsDelegated(baseDep?.isDelegated ?? false);
  }, [universalAccount]);

  useEffect(() => {
    if (!universalAccount) return;
    (async () => {
      setLoading(true);
      try {
        await refreshDelegationStatus();
        setPrimaryAssets(await universalAccount.getPrimaryAssets());
      } catch (err) {
        console.error('UA data fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [universalAccount, refreshDelegationStatus]);

  const refreshBalance = useCallback(async () => {
    if (!universalAccount) return;
    setPrimaryAssets(await universalAccount.getPrimaryAssets());
  }, [universalAccount]);

  const signEip7702Auth = useCallback(
    async (contractAddress: string, chainId: number, nonce?: number) => {
      if (!magic) throw new Error('Magic not ready');
      return (magic as any).wallet.sign7702Authorization({
        contractAddress,
        chainId,
        ...(nonce !== undefined && { nonce }),
      });
    },
    [magic],
  );

  // Submit a Type-4 (EIP-7702) transaction from the EOA on Base.
  // `resolveTarget(auth)` picks the delegation target: the UA implementation
  // to delegate, or the zero address to undelegate. Magic cannot sign
  // chain-agnostic chainId-0 authorizations, so delegation is chain-specific.
  const submit7702Delegation = useCallback(
    async (resolveTarget: (auth: any) => string) => {
      if (!universalAccount || !magic || !userAddress) {
        throw new Error('Log in first');
      }
      await (magic as any).evm.switchChain(BASE_CHAIN_ID);
      const [auth] = await universalAccount.getEIP7702Auth([BASE_CHAIN_ID]);
      const authorization = await signEip7702Auth(
        resolveTarget(auth),
        BASE_CHAIN_ID,
        auth.nonce + 1,
      );
      await (magic as any).wallet.send7702Transaction({
        to: userAddress,
        data: '0x',
        authorizationList: [authorization],
      });
      await refreshDelegationStatus();
    },
    [universalAccount, magic, userAddress, signEip7702Auth, refreshDelegationStatus],
  );

  const ensureDelegated = useCallback(async () => {
    if (!universalAccount) throw new Error('Log in first');
    const deployments = await universalAccount.getEIP7702Deployments();
    const baseDep = (deployments as any[]).find(
      (d) => d.chainId === BASE_CHAIN_ID,
    );
    if (!baseDep || baseDep.isDelegated) {
      await refreshDelegationStatus();
      return;
    }
    await submit7702Delegation((auth) => auth.address);
  }, [universalAccount, refreshDelegationStatus, submit7702Delegation]);

  // An authorization targeting the zero address clears the delegation,
  // reverting the EOA to a plain wallet. Reversibility is part of the pitch.
  const undelegate = useCallback(async () => {
    if (!universalAccount) throw new Error('Log in first');
    const deployments = await universalAccount.getEIP7702Deployments();
    const baseDep = (deployments as any[]).find(
      (d) => d.chainId === BASE_CHAIN_ID,
    );
    if (!baseDep || !baseDep.isDelegated) {
      await refreshDelegationStatus();
      return;
    }
    await submit7702Delegation(
      () => '0x0000000000000000000000000000000000000000',
    );
  }, [universalAccount, refreshDelegationStatus, submit7702Delegation]);

  const signAndSend = useCallback(
    async (transaction: any): Promise<{ transactionId: string }> => {
      if (!universalAccount || !magic || !userAddress) {
        throw new Error('Log in first');
      }
      const authorizations: { userOpHash: string; signature: string }[] = [];
      const nonceMap = new Map<number, string>();

      if (transaction.userOps) {
        for (const userOp of transaction.userOps) {
          if (userOp.eip7702Auth && !userOp.eip7702Delegated) {
            let serialized = nonceMap.get(userOp.eip7702Auth.nonce);
            if (!serialized) {
              const authorization = await signEip7702Auth(
                userOp.eip7702Auth.address,
                userOp.eip7702Auth.chainId || userOp.chainId,
                userOp.eip7702Auth.nonce,
              );
              serialized = Signature.from({
                r: authorization.r,
                s: authorization.s,
                v: authorization.v,
              }).serialized;
              nonceMap.set(userOp.eip7702Auth.nonce, serialized);
            }
            authorizations.push({
              userOpHash: userOp.userOpHash,
              signature: serialized,
            });
          }
        }
      }

      const provider = new BrowserProvider((magic as any).rpcProvider);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(getBytes(transaction.rootHash));
      return universalAccount.sendTransaction(
        transaction,
        signature,
        authorizations.length > 0 ? authorizations : undefined,
      );
    },
    [universalAccount, magic, userAddress, signEip7702Auth],
  );

  // MECHANIC 1 (transfer-and-call): one universal transaction sources USDC
  // cross-chain onto Base and executes approve + createStipend atomically.
  const createStipendCrossChain = useCallback(
    async (input: CreateStipendInput): Promise<CreateStipendResult> => {
      if (!universalAccount || !userAddress) throw new Error('Log in first');
      if (!VAULT_ADDRESS) throw new Error('Vault address not configured');

      const salt = randomSalt();
      const deposit6 = parseUnits(input.initialDeposit, USDC_DECIMALS);
      const perPeriod6 = parseUnits(input.amountPerPeriod, USDC_DECIMALS);
      const totalCap6 = parseUnits(input.totalCap, USDC_DECIMALS);

      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [VAULT_ADDRESS, deposit6],
      });
      const createData = encodeFunctionData({
        abi: stipendVaultAbi,
        functionName: 'createStipend',
        args: [
          USDC_ADDRESS,
          input.recipient,
          perPeriod6,
          BigInt(input.periodSeconds),
          totalCap6,
          salt,
          deposit6,
        ],
      });

      const tx = await universalAccount.createUniversalTransaction({
        chainId: BASE_CHAIN_ID,
        expectTokens: [
          { type: SUPPORTED_TOKEN_TYPE.USDC, amount: input.initialDeposit },
        ],
        transactions: [
          { to: USDC_ADDRESS, data: approveData },
          { to: VAULT_ADDRESS, data: createData },
        ],
      });
      const { transactionId } = await signAndSend(tx);

      return {
        id: computeStipendId(userAddress, input.recipient, salt),
        salt,
        transactionId,
        mechanic: 'transfer-and-call',
      };
    },
    [universalAccount, userAddress, signAndSend],
  );

  const fundStipendCrossChain = useCallback(
    async (id: `0x${string}`, amount: string): Promise<string> => {
      if (!universalAccount) throw new Error('Log in first');
      const amount6 = parseUnits(amount, USDC_DECIMALS);
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [VAULT_ADDRESS, amount6],
      });
      const fundData = encodeFunctionData({
        abi: stipendVaultAbi,
        functionName: 'fund',
        args: [id, amount6],
      });
      const tx = await universalAccount.createUniversalTransaction({
        chainId: BASE_CHAIN_ID,
        expectTokens: [{ type: SUPPORTED_TOKEN_TYPE.USDC, amount }],
        transactions: [
          { to: USDC_ADDRESS, data: approveData },
          { to: VAULT_ADDRESS, data: fundData },
        ],
      });
      const { transactionId } = await signAndSend(tx);
      return transactionId;
    },
    [universalAccount, signAndSend],
  );

  const revokeStipend = useCallback(
    async (id: `0x${string}`): Promise<string> => {
      if (!universalAccount) throw new Error('Log in first');
      const revokeData = encodeFunctionData({
        abi: stipendVaultAbi,
        functionName: 'revoke',
        args: [id],
      });
      const tx = await universalAccount.createUniversalTransaction({
        chainId: BASE_CHAIN_ID,
        expectTokens: [],
        transactions: [{ to: VAULT_ADDRESS, data: revokeData }],
      });
      const { transactionId } = await signAndSend(tx);
      return transactionId;
    },
    [universalAccount, signAndSend],
  );

  // Recipient pulls what's available — a plain destination-chain call through
  // the UA, so the recipient needs no ETH for gas.
  const claimStipend = useCallback(
    async (id: `0x${string}`, amount: string): Promise<string> => {
      if (!universalAccount) throw new Error('Log in first');
      const claimData = encodeFunctionData({
        abi: stipendVaultAbi,
        functionName: 'claim',
        args: [id, parseUnits(amount, USDC_DECIMALS)],
      });
      const tx = await universalAccount.createUniversalTransaction({
        chainId: BASE_CHAIN_ID,
        expectTokens: [],
        transactions: [{ to: VAULT_ADDRESS, data: claimData }],
      });
      const { transactionId } = await signAndSend(tx);
      return transactionId;
    },
    [universalAccount, signAndSend],
  );

  const approveAgentOnStipend = useCallback(
    async (id: `0x${string}`, agent: `0x${string}`): Promise<string> => {
      if (!universalAccount) throw new Error('Log in first');
      const approveData = encodeFunctionData({
        abi: stipendVaultAbi,
        functionName: 'approveAgent',
        args: [id, agent, true],
      });
      const tx = await universalAccount.createUniversalTransaction({
        chainId: BASE_CHAIN_ID,
        expectTokens: [],
        transactions: [{ to: VAULT_ADDRESS, data: approveData }],
      });
      const { transactionId } = await signAndSend(tx);
      return transactionId;
    },
    [universalAccount, signAndSend],
  );

  const value = useMemo(
    () => ({
      universalAccount,
      primaryAssets,
      isDelegated,
      loading,
      refreshBalance,
      ensureDelegated,
      undelegate,
      createStipendCrossChain,
      fundStipendCrossChain,
      revokeStipend,
      claimStipend,
      approveAgentOnStipend,
    }),
    [
      universalAccount,
      primaryAssets,
      isDelegated,
      loading,
      refreshBalance,
      ensureDelegated,
      undelegate,
      createStipendCrossChain,
      fundStipendCrossChain,
      revokeStipend,
      claimStipend,
      approveAgentOnStipend,
    ],
  );

  return <UAContext.Provider value={value}>{children}</UAContext.Provider>;
}
