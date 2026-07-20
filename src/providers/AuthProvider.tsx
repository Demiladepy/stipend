'use client';

// Privy-based auth. Email OTP via Privy's modal; an embedded wallet (EOA) is
// created for every user. That EOA becomes the 7702 Universal Account.
import {
  useCreateWallet,
  useLogin,
  usePrivy,
  useUser,
  useWallets,
} from '@privy-io/react-auth';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

type AuthContextType = {
  ready: boolean;
  authenticated: boolean;
  email: string | null;
  userAddress: `0x${string}` | null;
  login: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  ready: false,
  authenticated: false,
  email: null,
  userAddress: null,
  login: () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { login } = useLogin();
  const { user } = useUser();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const walletCreationAttempted = useRef(false);

  // A Privy user can have multiple embedded wallets; prefer the one named in
  // env (the funded demo wallet), else the first.
  const preferred = process.env.NEXT_PUBLIC_PREFERRED_EOA?.toLowerCase();
  const privyWallets = wallets?.filter((w) => w.walletClientType === 'privy') ?? [];
  const embeddedWallet =
    (preferred && privyWallets.find((w) => w.address.toLowerCase() === preferred)) ||
    privyWallets[0];
  const userAddress = (embeddedWallet?.address as `0x${string}`) ?? null;

  // Safety net: if a user somehow has no embedded wallet, create one.
  useEffect(() => {
    if (!ready || !authenticated || embeddedWallet) return;
    if (walletCreationAttempted.current) return;
    walletCreationAttempted.current = true;
    createWallet().catch((err) => {
      console.error('embedded wallet creation failed:', err);
      walletCreationAttempted.current = false;
    });
  }, [ready, authenticated, embeddedWallet, createWallet]);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      email: user?.email?.address ?? null,
      userAddress: authenticated ? userAddress : null,
      login,
      logout,
    }),
    [ready, authenticated, user, userAddress, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
