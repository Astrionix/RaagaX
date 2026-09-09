'use client';

import React, { useEffect } from 'react';
import { useThemeStore } from '@/context/useThemeStore';
import { useTimeAwareTheme } from '@/context/useTimeAwareTheme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { initThemeListener } = useThemeStore();
  useTimeAwareTheme();

  useEffect(() => {
    const cleanup = initThemeListener();
    return cleanup;
  }, [initThemeListener]);

  return <>{children}</>;
}
