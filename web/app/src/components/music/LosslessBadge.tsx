import { Headphones } from 'lucide-react';
import { AppleLosslessLogo } from '@/components/icons/AppleLosslessLogo';
import { SpatialAudioLogo } from '@/components/icons/SpatialAudioLogo';
import { AppleDigitalMasterLogo } from '@/components/icons/AppleDigitalMasterLogo';
import { FlacLogo } from '@/components/icons/FlacLogo';
import { MqaLogo } from '@/components/icons/MqaLogo';
import { DsdLogo } from '@/components/icons/DsdLogo';
import { CdQualityLogo } from '@/components/icons/CdQualityLogo';
import { useAddonStore } from '@/data/addon/addonStore';
import { usePlayer } from '@/state/player';

interface LosslessBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Clean Lossless / Hi-Res / Spatial Audio Quality indicator with official Apple Lossless wave logo.
 * Displays the 3 interlocking sine wave ribbons for Apple Lossless and Hi-Res Lossless,
 * or dedicated logos for Dolby/Spatial, Apple Digital Master, MQA, DSD, FLAC.
 */
export function LosslessBadge({
  className = '',
  size = 'sm',
  showLabel = true,
}: LosslessBadgeProps) {
  const upgradeState = useAddonStore((s) => s.upgradeState);
  const nowPlaying = usePlayer((s) => s.nowPlaying);

  const streamInfo = nowPlaying?.streamInfo?.toLowerCase() || '';
  const codec = nowPlaying?.stream?.codec?.toUpperCase() || '';

  const isFlac =
    codec === 'FLAC' ||
    codec === 'ALAC' ||
    upgradeState?.active ||
    streamInfo.includes('lossless') ||
    streamInfo.includes('flac') ||
    streamInfo.includes('alac');

  if (!isFlac && !upgradeState?.active) return null;

  const isDsd = codec.includes('DSD') || streamInfo.includes('dsd');
  const isMqa = codec.includes('MQA') || streamInfo.includes('mqa');
  const isAdm = streamInfo.includes('apple digital master') || streamInfo.includes('master');
  const isDolby = upgradeState?.quality === 'DOLBY' || streamInfo.includes('dolby') || streamInfo.includes('atmos');
  const isSpatial = streamInfo.includes('spatial');

  const isHiRes =
    upgradeState?.quality === 'HI_RES' ||
    (upgradeState?.format?.bitDepth ?? 0) > 16 ||
    (upgradeState?.format?.sampleRateHz ?? 0) > 48000 ||
    (nowPlaying?.stream?.bitDepth ?? 0) > 16 ||
    (nowPlaying?.stream?.sampleRateHz ?? 0) > 48000;

  const label = isDolby
    ? 'Dolby Atmos'
    : isSpatial
    ? 'Spatial Audio'
    : isAdm
    ? 'Apple Digital Master'
    : isDsd
    ? 'DSD'
    : isMqa
    ? 'MQA'
    : isHiRes
    ? 'Hi-Res Lossless'
    : 'Lossless';

  const iconHeight = size === 'lg' ? 14 : size === 'md' ? 12 : size === 'xs' ? 9 : 11;

  const renderIcon = () => {
    if (isDolby) {
      return <Headphones size={iconHeight} className="shrink-0 opacity-80" aria-hidden="true" />;
    }
    if (isSpatial) {
      return <SpatialAudioLogo size={iconHeight} className="shrink-0 text-white/90" />;
    }
    if (isAdm) {
      return <AppleDigitalMasterLogo size={iconHeight} className="shrink-0 text-white/90" />;
    }
    if (isDsd) {
      return <DsdLogo size={iconHeight} className="shrink-0 text-white/90" />;
    }
    if (isMqa) {
      return <MqaLogo size={iconHeight} className="shrink-0 text-white/90" />;
    }
    return <AppleLosslessLogo size={iconHeight} className="shrink-0 text-white/90" />;
  };

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full border border-white/10 bg-white/5 font-medium text-[11px] leading-none tracking-wide text-white/90 select-none shadow-sm backdrop-blur-sm transition-opacity ${className}`}
      title={
        isHiRes
          ? 'Hi-Res Lossless Studio Audio (up to 24-bit/192kHz)'
          : isDolby
          ? 'Dolby Atmos Spatial Audio'
          : isAdm
          ? 'Apple Digital Master'
          : isDsd
          ? 'Direct Stream Digital (DSD)'
          : isMqa
          ? 'Master Quality Authenticated (MQA)'
          : 'Apple Lossless Audio (24-bit/48kHz ALAC/FLAC)'
      }
    >
      {renderIcon()}
      {showLabel && <span>{label}</span>}
    </span>
  );
}

export {
  AppleLosslessLogo,
  SpatialAudioLogo,
  AppleDigitalMasterLogo,
  FlacLogo,
  MqaLogo,
  DsdLogo,
  CdQualityLogo,
};

export default LosslessBadge;
