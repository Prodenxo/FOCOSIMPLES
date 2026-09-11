'use client';

import { AuthProvider } from '@/context/AuthProvider';
import { ThemeProvider } from '@/context/ThemeProvider';
import { DevHmrRecovery } from '@/components/dev/DevHmrRecovery';

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DevHmrRecovery />
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
