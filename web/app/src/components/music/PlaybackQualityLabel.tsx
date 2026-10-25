import { Sparkles } from 'lucide-react';
import type { NerdStatsSnapshot } from '@/playback/nerdStats';

interface PlaybackQualityLabelProps {
  stats: NerdStatsSnapshot;
  className?: string;
  onClick?: () => void;
}

export function PlaybackQualityLabel({ stats, className = '', onClick }: PlaybackQualityLabelProps) {
  const isLossless = stats.isLossless;
  const isHiRes = stats.isHiRes;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide transition-all ${
        isHiRes
          ? 'bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 text-amber-300 border border-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
          : isLossless
            ? 'bg-gradient-to-r from-emerald-500/20 via-teal-400/25 to-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
            : stats.isHiQuality
              ? 'bg-white/10 text-white/90 border border-white/15'
              : 'bg-white/5 text-white/60 border border-white/10'
      } ${className}`}
      title={stats.tierLabel}
    >
      {(isLossless || isHiRes) && (
        <Sparkles size={11} className={isHiRes ? 'text-amber-300 animate-pulse' : 'text-emerald-300'} />
      )}
      <span className={isLossless ? 'animate-[shimmer_3s_infinite_linear] bg-clip-text' : ''}>
        {stats.tierLabel}
      </span>
      {stats.isLossless && stats.bitDepth && (
        <span className="text-[9px] opacity-75 font-mono">
          {stats.bitDepth}-bit/{stats.sampleRateHz ? Math.round(stats.sampleRateHz / 1000) : 48}kHz
        </span>
      )}
    </button>
  );
}
