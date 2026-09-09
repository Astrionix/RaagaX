'use client';

import { useState, useEffect } from 'react';
import { useThemeStore } from '@/context/useThemeStore';

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeThemeDetails {
  period: TimePeriod;
  greeting: string;
  subtitle: string;
  icon: string;
  timeTheme: string; // e.g. 'morning-dark', 'evening-light'
  resolvedTheme: 'dark' | 'light';
}

export function getTimePeriod(date = new Date()): TimePeriod {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) return 'morning';
  if (hours >= 12 && hours < 17) return 'afternoon';
  if (hours >= 17 && hours < 21) return 'evening';
  return 'night';
}

export function getTimeThemeDetails(period: TimePeriod, resolvedTheme: 'dark' | 'light'): TimeThemeDetails {
  let greeting = 'GOOD MORNING';
  let subtitle = 'Continue where you left off ↓';
  let icon = '🌅';

  switch (period) {
    case 'morning':
      greeting = 'GOOD MORNING';
      subtitle = 'Continue where you left off';
      icon = '🌅';
      break;
    case 'afternoon':
      greeting = 'GOOD AFTERNOON';
      subtitle = "What's playing today?";
      icon = '☀️';
      break;
    case 'evening':
      greeting = 'GOOD EVENING';
      subtitle = 'Set the mood for tonight';
      icon = '🌆';
      break;
    case 'night':
      greeting = 'GOOD NIGHT';
      subtitle = 'Wind down with some music';
      icon = '🌙';
      break;
  }

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
    const updateTime = () => {
      const currentPeriod = getTimePeriod();
      setPeriod((prev) => (prev !== currentPeriod ? currentPeriod : prev));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Update HTML data attributes dynamically whenever period or theme changes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const timeTheme = `${period}-${resolvedTheme}`;
    
    root.setAttribute('data-time-period', period);
    root.setAttribute('data-time-theme', timeTheme);
  }, [period, resolvedTheme]);

  return getTimeThemeDetails(period, resolvedTheme);
}
