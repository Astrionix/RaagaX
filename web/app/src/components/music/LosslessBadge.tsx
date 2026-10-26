import { Headphones } from 'lucide-react';
import { useAddonStore } from '@/data/addon/addonStore';
import { usePlayer } from '@/state/player';

interface LosslessBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Clean Lossless / Hi-Res Quality indicator matching Desktop & Mobile app.
 * Prepend a headphone glyph ahead of "Lossless" or "Hi-Res Lossless".
 */
export function LosslessBadge({ className = '', size = 'sm' }: LosslessBadgeProps) {
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
  const iconSize = size === 'md' ? 14 : 11;

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 font-medium text-[12px] tracking-wide text-white/80 select-none ${className}`}
      title={isHiRes ? 'Hi-Res Lossless Studio Audio' : 'Lossless Audio'}
    >
      <Headphones size={iconSize} className="shrink-0 opacity-80" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
