import { Sparkles } from 'lucide-react';
import { useAddonStore } from '@/data/addon/addonStore';

interface LosslessBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Audiophile Lossless / Hi-Res Quality Badge.
 * Displayed next to track titles when an Addon has upgraded playback to studio FLAC.
 */
export function LosslessBadge({ className = '', size = 'sm' }: LosslessBadgeProps) {
  const upgradeState = useAddonStore((s) => s.upgradeState);

  if (!upgradeState?.active) return null;

  const isHiRes = upgradeState.quality === 'HI_RES' || (upgradeState.format?.sampleRateHz ?? 0) > 48000;
  const isDolby = upgradeState.quality === 'DOLBY';
  const label = isDolby ? 'DOLBY' : isHiRes ? 'HI-RES' : 'LOSSLESS';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-bold tracking-wider uppercase select-none rounded-[3px] border transition-all ${
        size === 'sm'
          ? 'px-1 py-[1px] text-[9px] leading-[10px]'
          : 'px-1.5 py-0.5 text-[10px] leading-[12px]'
      } ${
        isDolby
          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.25)]'
          : isHiRes
          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
          : 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
      } ${className}`}
      title={`Bit-Perfect Lossless audio via Addon: ${upgradeState.addonName}`}
    >
      <Sparkles size={size === 'sm' ? 8 : 10} className="shrink-0 animate-pulse" />
      <span>{label}</span>
    </span>
  );
}
