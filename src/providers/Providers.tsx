'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { UAProvider } from './UAProvider';

export function Providers({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center text-sm text-zinc-500">
        Missing NEXT_PUBLIC_PRIVY_APP_ID — create an app at dashboard.privy.io
        and add it to .env.local
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      {...(clientId ? { clientId } : {})}
      config={{
        loginMethods: ['email'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
        },
        appearance: {
          theme: 'dark',
          accentColor: '#34d399',
        },
      }}
    >
      <AuthProvider>
        <UAProvider>{children}</UAProvider>
      </AuthProvider>
    </PrivyProvider>
  );
}
