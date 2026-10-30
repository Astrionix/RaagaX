import { Headphones } from 'lucide-react';
import { AppleLosslessLogo } from '@/components/icons/AppleLosslessLogo';
import { useAddonStore } from '@/data/addon/addonStore';
import { usePlayer } from '@/state/player';

interface LosslessBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Clean Lossless / Hi-Res Quality indicator with official Apple Lossless wave logo.
 * Displays the 3 interlocking sine wave ribbons for Apple Lossless and Hi-Res Lossless.
 */
export function LosslessBadge({
  className = '',
  size = 'sm',
  showLabel = true,
}: LosslessBadgeProps) {
  const upgradeState = useAddonStore((s) => s.upgradeState);
  const nowPlaying = usePlayer((s) => s.nowPlaying);

  const isFlac =
    nowPlaying?.stream?.codec?.toUpperCase() === 'FLAC' ||
    upgradeState?.active ||
    nowPlaying?.streamInfo?.toLowerCase().includes('lossless') ||
    nowPlaying?.streamInfo?.toLowerCase().includes('flac');

  if (!isFlac && !upgradeState?.active) return null;

  const isHiRes =
    upgradeState?.quality === 'HI_RES' ||
    (upgradeState?.format?.bitDepth ?? 0) > 16 ||
    (upgradeState?.format?.sampleRateHz ?? 0) > 48000 ||
    (nowPlaying?.stream?.bitDepth ?? 0) > 16 ||
    (nowPlaying?.stream?.sampleRateHz ?? 0) > 48000;

  const isDolby = upgradeState?.quality === 'DOLBY';
  const label = isDolby ? 'Dolby Atmos' : isHiRes ? 'Hi-Res Lossless' : 'Lossless';
  
  const iconHeight = size === 'lg' ? 14 : size === 'md' ? 12 : size === 'xs' ? 9 : 11;

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full border border-white/10 bg-white/5 font-medium text-[11px] leading-none tracking-wide text-white/90 select-none shadow-sm backdrop-blur-sm transition-opacity ${className}`}
      title={
        isHiRes
          ? 'Hi-Res Lossless Studio Audio (up to 24-bit/192kHz)'
          : isDolby
          ? 'Dolby Atmos Spatial Audio'
          : 'Apple Lossless Audio (24-bit/48kHz ALAC/FLAC)'
      }
    >
      {isDolby ? (
        <Headphones size={iconHeight} className="shrink-0 opacity-80" aria-hidden="true" />
      ) : (
        <AppleLosslessLogo size={iconHeight} className="shrink-0 text-white/90" />
      )}
      {showLabel && <span>{label}</span>}
    </span>
  );
}

export default LosslessBadge;
