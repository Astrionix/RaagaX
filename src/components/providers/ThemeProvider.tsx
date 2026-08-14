'use client';

import React, { useEffect } from 'react';
import { useThemeStore } from '@/context/useThemeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { initThemeListener } = useThemeStore();

  useEffect(() => {
    const cleanup = initThemeListener();
    return cleanup;
  }, [initThemeListener]);

  return <>{children}</>;
}
