'use client';

import { type ReactNode } from 'react';
import AuthGate from '../auth/AuthGate';
import { AuthProvider } from '../auth/AuthProvider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
