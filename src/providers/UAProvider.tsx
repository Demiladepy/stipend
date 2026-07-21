'use client';

import {
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
  SUPPORTED_TOKEN_TYPE,
  type IAssetsResponse,
} from '@particle-network/universal-account-sdk';
import {
  useSign7702Authorization,
  useWallets,
} from '@privy-io/react-auth';
import { Signature } from 'ethers';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Hex,
} from 'viem';
import { base } from 'viem/chains';
import { stipendVaultAbi } from '@/lib/abi';
import {
  BASE_CHAIN_ID,
  USDC_ADDRESS,
  USDC_DECIMALS,
  VAULT_ADDRESS,
} from '@/lib/config';
import { computeStipendId, randomSalt } from '@/lib/vault';
import { useAuth } from './AuthProvider';

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
  createStipendCrossChain: (
    input: CreateStipendInput,
  ) => Promise<CreateStipendResult>;
  fundStipendCrossChain: (id: `0x${string}`, amount: string) => Promise<string>;
  revokeStipend: (id: `0x${string}`) => Promise<string>;
  claimStipend: (id: `0x${string}`, amount: string) => Promise<string>;
  modifyStipend: (
    id: `0x${string}`,
    amountPerPeriod: string,
    periodSeconds: number,
    totalCap: string,
  ) => Promise<string>;
  approveAgentOnStipend: (
    id: `0x${string}`,
    agent: `0x${string}`,
  ) => Promise<string>;
};

const UAContext = createContext<UAContextType>(null as any);
export const useUniversalAccount = () => useContext(UAContext);

export function UAProvider({ children }: { children: ReactNode }) {
  const { userAddress } = useAuth();
  const { signAuthorization } = useSign7702Authorization();
  const { wallets } = useWallets();

  // Same wallet Particle's 7702 demo uses: the Privy embedded EOA that owns the UA.
  const embeddedWallet = useMemo(() => {
    if (!userAddress) return undefined;
    return wallets?.find(
      (w) =>
        w.walletClientType === 'privy' &&
        w.address.toLowerCase() === userAddress.toLowerCase(),
    );
  }, [wallets, userAddress]);

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
        // Particle pays gas from unified balance when EOA has 0 Base ETH.
        universalGas: true,
      } as any,
    });
    setUniversalAccount(ua);
  }, [userAddress]);

  const refreshDelegationStatus = useCallback(async () => {
    if (!universalAccount) return;
    try {
      const deployments = await universalAccount.getEIP7702Deployments();
      const baseDep = (deployments as any[]).find(
        (d) => d.chainId === BASE_CHAIN_ID,
      );
      setIsDelegated(baseDep?.isDelegated ?? false);
    } catch (err) {
      console.warn('delegation status read failed:', err);
    }
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
    await refreshDelegationStatus();
  }, [universalAccount, refreshDelegationStatus]);

  // Sign inline EIP-7702 authorizations for any userOp that needs one, using
  // Privy's signAuthorization (no pre-delegation transaction needed — Particle
  // broadcasts the Type-4 with the auth attached). Reference:
  // reference/universal-accounts-7702/lib/eip7702.ts
  const sign7702Auths = useCallback(
    async (userOps: any[] | undefined) => {
      if (!userOps || !userAddress) return [];
      const authorizations: { userOpHash: string; signature: string }[] = [];
      // Key by chainId+nonce — cross-chain txs can share nonce 0 on different chains.
      const nonceMap = new Map<string, string>();

      for (const userOp of userOps) {
        if (userOp.eip7702Auth && !userOp.eip7702Delegated) {
          const chainId = Number(
            userOp.eip7702Auth.chainId ?? userOp.chainId,
          );
          const cacheKey = `${chainId}:${userOp.eip7702Auth.nonce}`;
          let serialized = nonceMap.get(cacheKey);
          if (!serialized) {
            const authorization = await signAuthorization(
              {
                contractAddress: userOp.eip7702Auth.address as `0x${string}`,
                chainId,
                nonce: userOp.eip7702Auth.nonce,
              },
              { address: userAddress },
            );
            const sig = Signature.from({
              r: authorization.r,
              s: authorization.s,
              v: authorization.v ?? BigInt(authorization.yParity),
              yParity: authorization.yParity as 0 | 1,
            });
            serialized = sig.serialized;
            nonceMap.set(cacheKey, serialized);
          }
          authorizations.push({
            userOpHash: userOp.userOpHash,
            signature: serialized,
          });
        }
      }
      return authorizations;
    },
    [signAuthorization, userAddress],
  );

  const signAndSend = useCallback(
    async (transaction: any): Promise<{ transactionId: string }> => {
      if (!universalAccount || !userAddress) throw new Error('Log in first');
      if (!embeddedWallet) {
        throw new Error('Privy wallet not ready — refresh and try again');
      }

      const authorizations = await sign7702Auths(transaction.userOps);

      // Particle validates rootHash as EIP-191 over the raw 32-byte hash
      // (`message: { raw }`), NOT as a UTF-8 string of the hex characters.
      // Using Privy useSignMessage(string) → AA24. Match Particle Dynamic demo.
      const provider = await embeddedWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: userAddress,
        chain: base,
        transport: custom(provider),
      });
      const signature = await walletClient.signMessage({
        message: { raw: transaction.rootHash as Hex },
      });

      try {
        return await universalAccount.sendTransaction(
          transaction,
          signature,
          authorizations.length > 0 ? authorizations : undefined,
        );
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (/AA24|signature/i.test(msg)) {
          throw new Error(
            `AA24 signature error — signed as ${userAddress.slice(0, 10)}… with ${authorizations.length} 7702 auth(s). Log out/in, confirm debug panel EOA matches funded wallet, then retry.`,
          );
        }
        throw err;
      }
    },
    [universalAccount, userAddress, embeddedWallet, sign7702Auths],
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

  const modifyStipend = useCallback(
    async (
      id: `0x${string}`,
      amountPerPeriod: string,
      periodSeconds: number,
      totalCap: string,
    ): Promise<string> => {
      if (!universalAccount) throw new Error('Log in first');
      const modifyData = encodeFunctionData({
        abi: stipendVaultAbi,
        functionName: 'modify',
        args: [
          id,
          parseUnits(amountPerPeriod, USDC_DECIMALS),
          BigInt(periodSeconds),
          parseUnits(totalCap, USDC_DECIMALS),
        ],
      });
      const tx = await universalAccount.createUniversalTransaction({
        chainId: BASE_CHAIN_ID,
        expectTokens: [],
        transactions: [{ to: VAULT_ADDRESS, data: modifyData }],
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
      createStipendCrossChain,
      fundStipendCrossChain,
      revokeStipend,
      claimStipend,
      modifyStipend,
      approveAgentOnStipend,
    }),
    [
      universalAccount,
      primaryAssets,
      isDelegated,
      loading,
      refreshBalance,
      createStipendCrossChain,
      fundStipendCrossChain,
      revokeStipend,
      claimStipend,
      modifyStipend,
      approveAgentOnStipend,
    ],
  );

  return <UAContext.Provider value={value}>{children}</UAContext.Provider>;
}
