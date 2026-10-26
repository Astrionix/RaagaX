import { useAddonStore } from '@/data/addon/addonStore';
import { usePlayer } from '@/state/player';

interface LosslessBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Audiophile Lossless / Hi-Res Quality Badge matching Desktop & Mobile app.
 * A crisp white rounded border capsule with the lossless sparkle icon and label.
 */
export function LosslessBadge({ className = '', size = 'md' }: LosslessBadgeProps) {
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
  const label = isDolby ? 'DOLBY ATMOS' : isHiRes ? 'HI-RES LOSSLESS' : 'LOSSLESS';

  return (
    <span
      className={`inline-flex items-center gap-1.5 select-none rounded-[4px] border border-white/80 bg-white/5 backdrop-blur-xs transition-all ${
        size === 'sm'
          ? 'px-1.5 py-[1px] text-[9px]'
          : 'px-2 py-0.5 text-[10.5px]'
      } ${className}`}
      title={isHiRes ? 'Hi-Res Lossless Audio' : 'Lossless Audio'}
    >
      <svg
        className={`${size === 'sm' ? 'size-2.5' : 'size-3'} shrink-0 text-white`}
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 2.5c0 2.8-2.2 4.5-5 5 2.8.5 5 2.2 5 5 0-2.8 2.2-4.5 5-5-2.8-.5-5-2.2-5-5z" />
        <circle cx="4" cy="4" r="0.9" />
        <circle cx="12" cy="4" r="0.9" />
        <circle cx="4" cy="12" r="0.9" />
        <circle cx="12" cy="12" r="0.9" />
      </svg>
      <span className="font-sans font-bold tracking-wider uppercase text-white">
        {label}
      </span>
    </span>
  );
}
