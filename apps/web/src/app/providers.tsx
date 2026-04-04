'use client';

import { CelebrationProvider } from '@/components/CelebrationProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import type { ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <CelebrationProvider>
        <ToastProvider>{children}</ToastProvider>
      </CelebrationProvider>
    </ThemeProvider>
  );
}
