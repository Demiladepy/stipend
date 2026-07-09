'use client';

import { EVMExtension } from '@magic-ext/evm';
import { Magic as MagicBase } from 'magic-sdk';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BASE_CHAIN_ID, BASE_RPC_URL } from '@/lib/config';

export type Magic = MagicBase<[EVMExtension]>;

type MagicContextType = {
  magic: Magic | null;
  userAddress: `0x${string}` | null;
  loggingIn: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const MagicContext = createContext<MagicContextType>({
  magic: null,
  userAddress: null,
  loggingIn: false,
  login: async () => {},
  logout: async () => {},
});

export const useMagic = () => useContext(MagicContext);

const USER_KEY = 'stipend.user';

export function MagicProvider({ children }: { children: ReactNode }) {
  const [magic, setMagic] = useState<Magic | null>(null);
  const [userAddress, setUserAddress] = useState<`0x${string}` | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_MAGIC_API_KEY) return;
    const m = new MagicBase(process.env.NEXT_PUBLIC_MAGIC_API_KEY, {
      extensions: [
        new EVMExtension([
          { rpcUrl: BASE_RPC_URL, chainId: BASE_CHAIN_ID, default: true },
        ]),
      ],
    });
    setMagic(m as Magic);
    const cached = localStorage.getItem(USER_KEY);
    if (cached) setUserAddress(cached as `0x${string}`);
  }, []);

  const login = useCallback(
    async (email: string) => {
      if (!magic) throw new Error('Wallet not ready yet — try again in a second');
      setLoggingIn(true);
      try {
        await magic.auth.loginWithEmailOTP({ email });
        const info = await magic.user.getInfo();
        const address = info?.wallets?.ethereum?.publicAddress as
          | `0x${string}`
          | undefined;
        if (!address) throw new Error('Login failed — no wallet address returned');
        localStorage.setItem(USER_KEY, address);
        setUserAddress(address);
      } finally {
        setLoggingIn(false);
      }
    },
    [magic],
  );

  const logout = useCallback(async () => {
    localStorage.removeItem(USER_KEY);
    setUserAddress(null);
    try {
      await magic?.user.logout();
    } catch {
      // session may already be gone; local state is cleared either way
    }
  }, [magic]);

  const value = useMemo(
    () => ({ magic, userAddress, loggingIn, login, logout }),
    [magic, userAddress, loggingIn, login, logout],
  );

  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
}
