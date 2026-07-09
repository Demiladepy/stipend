'use client';

import { ReactNode } from 'react';
import { MagicProvider } from './MagicProvider';
import { UAProvider } from './UAProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MagicProvider>
      <UAProvider>{children}</UAProvider>
    </MagicProvider>
  );
}
