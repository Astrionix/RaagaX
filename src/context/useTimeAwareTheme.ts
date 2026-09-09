'use client';

import { useState, useEffect } from 'react';
import { useThemeStore } from '@/context/useThemeStore';

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeThemeDetails {
  period: TimePeriod;
  greeting: string;       // e.g. "GOOD MORNING"
  subtitle: string;       // contextual subtitle (no arrow, no period)
  icon: string;           // emoji
  timeTheme: string;      // e.g. 'morning-dark'
  resolvedTheme: 'dark' | 'light';
}

// Time boundaries per spec
export function getTimePeriod(date = new Date()): TimePeriod {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

const TIME_THEMES: Record<TimePeriod, { icon: string; greeting: string; subtitle: string }> = {
  morning:   { icon: '🌅', greeting: 'GOOD MORNING',   subtitle: 'Start your day with some music' },
  afternoon: { icon: '☀️', greeting: 'GOOD AFTERNOON', subtitle: "What's playing today?" },
  evening:   { icon: '🌆', greeting: 'GOOD EVENING',   subtitle: 'Set the mood for tonight' },
  night:     { icon: '🌙', greeting: 'GOOD NIGHT',     subtitle: 'Wind down with some music' },
};

export function getTimeThemeDetails(period: TimePeriod, resolvedTheme: 'dark' | 'light'): TimeThemeDetails {
  const { icon, greeting, subtitle } = TIME_THEMES[period];
  return {
    period,
    greeting,
    subtitle,
    icon,
    timeTheme: `${period}-${resolvedTheme}`,
    resolvedTheme,
  };
}

export function useTimeAwareTheme(): TimeThemeDetails {
  const { resolvedTheme } = useThemeStore();
  const [period, setPeriod] = useState<TimePeriod>(() => getTimePeriod());

  useEffect(() => {
    const sync = () => {
      const next = getTimePeriod();
      setPeriod(prev => (prev !== next ? next : prev));
    };
    sync();
    const t = setInterval(sync, 60_000);
    return () => clearInterval(t);
  }, []);

  // Write data attrs to <html> so CSS [data-time-theme="..."] rules fire
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const combined = `${period}-${resolvedTheme}`;
    root.setAttribute('data-time-period', period);
    root.setAttribute('data-time-theme', combined);
  }, [period, resolvedTheme]);

  return getTimeThemeDetails(period, resolvedTheme);
}
