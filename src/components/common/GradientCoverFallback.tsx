'use client';

import React, { useMemo } from 'react';
import { Music2 } from 'lucide-react';

export interface GradientCoverFallbackProps {
  /** Text seed used to deterministically pick gradient (e.g. song title, artist, album name) */
  seed?: string | null;
  /** Alt text for accessibility */
  alt?: string;
  /** Component size context: 'thumb' (small list row/mini player), 'card' (grid items), 'full' (large views), 'hero' (player screen) */
  size?: 'thumb' | 'card' | 'full' | 'hero';
  /** Custom CSS classes */
  className?: string;
  /** Whether to render the first letter of title if space permits */
  showInitial?: boolean;
}

// 10 Vibrant, high-contrast modern music streaming gradient presets
const PRESET_GRADIENTS = [
  {
    name: 'Electric Cyberpunk',
    gradient: 'from-[#4F46E5] via-[#7C3AED] to-[#EC4899]',
    glow: 'rgba(236, 72, 153, 0.4)',
  },
  {
    name: 'Sunset Crimson',
    gradient: 'from-[#F43F5E] via-[#E11D48] to-[#F59E0B]',
    glow: 'rgba(244, 63, 94, 0.4)',
  },
  {
    name: 'Oceanic Sapphire',
    gradient: 'from-[#0284C7] via-[#2563EB] to-[#4F46E5]',
    glow: 'rgba(37, 99, 235, 0.4)',
  },
  {
    name: 'Emerald Aurora',
    gradient: 'from-[#10B981] via-[#0D9488] to-[#1E40AF]',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  {
    name: 'Neon Magenta',
    gradient: 'from-[#D946EF] via-[#A855F7] to-[#6366F1]',
    glow: 'rgba(217, 70, 239, 0.4)',
  },
  {
    name: 'Solar Flare',
    gradient: 'from-[#F59E0B] via-[#EA580C] to-[#E11D48]',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  {
    name: 'Cosmic Dusk',
    gradient: 'from-[#8B5CF6] via-[#6D28D9] to-[#0F172A]',
    glow: 'rgba(139, 92, 246, 0.4)',
  },
  {
    name: 'Raaga Signature',
    gradient: 'from-[#FA233B] via-[#C026D3] to-[#4338CA]',
    glow: 'rgba(250, 35, 59, 0.4)',
  },
  {
    name: 'Cyber Mint',
    gradient: 'from-[#06B6D4] via-[#059669] to-[#0F766E]',
    glow: 'rgba(6, 182, 212, 0.4)',
  },
  {
    name: 'Royal Plum',
    gradient: 'from-[#7E22CE] via-[#B91C1C] to-[#431407]',
    glow: 'rgba(126, 34, 206, 0.4)',
  },
];

/**
 * Deterministically compute a numeric hash for any input string
 */
function hashString(str?: string | null): number {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function GradientCoverFallback({
  seed,
  alt = 'Song Cover',
  size = 'card',
  className = '',
  showInitial = true,
}: GradientCoverFallbackProps) {
  const seedText = seed || alt || 'RaagaX';

  const { preset, initial } = useMemo(() => {
    const hash = hashString(seedText);
    const index = hash % PRESET_GRADIENTS.length;
    const selectedPreset = PRESET_GRADIENTS[index];

    // Extract first alphanumeric character for initial
    const cleanStr = seedText.replace(/[^a-zA-Z0-9]/g, '').trim();
    const char = cleanStr.charAt(0).toUpperCase() || '♪';

    return { preset: selectedPreset, initial: char };
  }, [seedText]);

  // Adjust icon size and typography based on container size
  const iconSizeClass =
    size === 'thumb'
      ? 'w-4 h-4'
      : size === 'card'
      ? 'w-7 h-7 sm:w-8 sm:h-8'
      : 'w-12 h-12 sm:w-16 sm:h-16';

  const badgeSizeClass =
    size === 'thumb'
      ? 'w-6 h-6'
      : size === 'card'
      ? 'w-10 h-10 sm:w-12 sm:h-12'
      : 'w-16 h-16 sm:w-24 sm:h-24';

  const initialTextSizeClass =
    size === 'thumb'
      ? 'text-[10px]'
      : size === 'card'
      ? 'text-xs sm:text-sm'
      : 'text-lg sm:text-2xl font-black';

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none bg-gradient-to-br ${preset.gradient} ${className}`}
    >
      {/* Dynamic specular lighting scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/20 pointer-events-none" />

      {/* Decorative ambient aura center blur */}
      <div
        className="absolute w-3/4 h-3/4 rounded-full blur-2xl opacity-40 pointer-events-none"
        style={{ backgroundColor: preset.glow }}
      />

      {/* Subtle vinyl groove texture lines */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:12px_12px] opacity-30 pointer-events-none" />

      {/* Glassmorphic central music emblem badge */}
      {size === 'thumb' ? (
        <Music2 className={`${iconSizeClass} text-white/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-10`} />
      ) : (
        <div
          className={`relative z-10 flex flex-col items-center justify-center ${badgeSizeClass} rounded-2xl sm:rounded-3xl bg-white/15 backdrop-blur-md border border-white/25 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-transform duration-300 group-hover:scale-105`}
        >
          <Music2 className={`${iconSizeClass} text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]`} />
          {showInitial && size !== 'card' && (
            <span className={`mt-1 text-white/90 ${initialTextSizeClass} tracking-wider uppercase font-semibold drop-shadow`}>
              {initial}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
