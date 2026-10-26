import { useAddonStore } from '@/data/addon/addonStore';
import { usePlayer } from '@/state/player';

interface LosslessBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Clean plain-text Lossless / Hi-Res Quality indicator matching Desktop & Mobile app.
 * Plain centered text with no box and no star symbol.
 */
export function LosslessBadge({ className = '' }: LosslessBadgeProps) {
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

  return (
    <span
      className={`text-center font-medium text-[12px] tracking-wide text-white/80 select-none ${className}`}
      title={isHiRes ? 'Hi-Res Lossless Studio Audio' : 'Lossless Audio'}
    >
      {label}
    </span>
  );
}
