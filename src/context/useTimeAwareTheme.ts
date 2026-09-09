'use client';

import { useState, useEffect } from 'react';
import { useThemeStore } from '@/context/useThemeStore';

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeThemeDetails {
  period: TimePeriod;
  greeting: string;       // e.g. "GOOD MORNING"
  subtitle: string;       // contextual subtitle
  icon: string;           // emoji
  timeTheme: string;      // e.g. 'morning-dark'
  resolvedTheme: 'dark' | 'light';
  minuteOfDay: number;    // 0 to 1439
  periodProgress: number; // 0.0 to 1.0 within current period
  isQuietNight: boolean;  // true after 23:00 until 05:00
  sunMoonPosition: {
    xPct: number;        // 0 to 100 (% horizontally across sky)
    yPct: number;        // 0 to 100 (% vertically, 0 = horizon/top, 100 = bottom)
    isVisible: boolean;  // whether sun or moon is visible
    type: 'sun' | 'moon';
  };
}

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

/**
 * Calculates continuous 24-hour celestial trajectory and period progress
 */
export function getTimeThemeDetails(date = new Date(), resolvedTheme: 'dark' | 'light'): TimeThemeDetails {
  const period = getTimePeriod(date);
  const { icon, greeting, subtitle } = TIME_THEMES[period];

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const minuteOfDay = hours * 60 + minutes;

  const isQuietNight = hours >= 23 || hours < 5;

  // Period start/end in minutes for progress calculation
  let periodStart = 5 * 60;   // 300
  let periodEnd = 12 * 60;    // 720

  if (period === 'morning') {
    periodStart = 5 * 60;   // 05:00
    periodEnd = 12 * 60;    // 12:00
  } else if (period === 'afternoon') {
    periodStart = 12 * 60;  // 12:00
    periodEnd = 17 * 60;    // 17:00
  } else if (period === 'evening') {
    periodStart = 17 * 60;  // 17:00
    periodEnd = 21 * 60;    // 21:00
  } else {
    // Night: 21:00 to 05:00 (8 hours total = 480 mins)
    const minsSince21 = hours >= 21 ? (hours - 21) * 60 + minutes : (hours + 3) * 60 + minutes;
    periodStart = 0;
    periodEnd = 8 * 60;
    const progress = Math.min(1, Math.max(0, minsSince21 / periodEnd));

    // Moon trajectory across night (21:00 to 05:00)
    const xPct = 10 + progress * 80; // 10% to 90%
    const arcHeight = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
    const yPct = 75 - arcHeight * 55; // 75% down to 20% top back to 75%

    return {
      period,
      greeting,
      subtitle,
      icon,
      timeTheme: `${period}-${resolvedTheme}`,
      resolvedTheme,
      minuteOfDay,
      periodProgress: progress,
      isQuietNight,
      sunMoonPosition: {
        xPct,
        yPct,
        isVisible: true,
        type: 'moon',
      },
    };
  }

  const periodProgress = Math.min(1, Math.max(0, (minuteOfDay - periodStart) / (periodEnd - periodStart)));

  // Sun trajectory (05:00 to 21:00 = 16 hours)
  const dayMins = minuteOfDay - 5 * 60;
  const dayProgress = Math.min(1, Math.max(0, dayMins / (16 * 60)));
  const xPct = 10 + dayProgress * 80;
  const sunArc = Math.sin(dayProgress * Math.PI);
  const yPct = 80 - sunArc * 65;

  return {
    period,
    greeting,
    subtitle,
    icon,
    timeTheme: `${period}-${resolvedTheme}`,
    resolvedTheme,
    minuteOfDay,
    periodProgress,
    isQuietNight,
    sunMoonPosition: {
      xPct,
      yPct,
      isVisible: true,
      type: 'sun',
    },
  };
}

export function useTimeAwareTheme(): TimeThemeDetails {
  const { resolvedTheme } = useThemeStore();
  const [timeDetails, setTimeDetails] = useState<TimeThemeDetails>(() =>
    getTimeThemeDetails(new Date(), resolvedTheme)
  );

  useEffect(() => {
    const sync = () => {
      setTimeDetails(getTimeThemeDetails(new Date(), resolvedTheme));
    };
    sync();
    const t = setInterval(sync, 30_000); // 30s update
    return () => clearInterval(t);
  }, [resolvedTheme]);

  // Write data attrs to <html> so CSS [data-time-theme="..."] rules fire
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-time-period', timeDetails.period);
    root.setAttribute('data-time-theme', timeDetails.timeTheme);
    root.setAttribute('data-quiet-night', timeDetails.isQuietNight ? 'true' : 'false');
  }, [timeDetails]);

  return timeDetails;
}
