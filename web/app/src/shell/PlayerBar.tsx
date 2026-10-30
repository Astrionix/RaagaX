import { useState, useEffect } from 'react';
import {
  BackwardIcon,
  ForwardIcon,
  LyricsActiveIcon,
  LyricsIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  UpNextIcon,
} from '@/components/icons/Transport';
import { FavoriteButton } from '@/components/music/FavoriteButton';
import { TrackMenu } from '@/components/music/TrackMenu';
import { ConnectIcon } from '@/components/icons/ConnectIcon';
import { useConnect } from '@/playback/connect/connectManager';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';
import { Lcd } from './Lcd';
import { fadeForVolume, VolumeControl } from './VolumeControl';

const control = 'grid place-items-center rounded-[6px] disabled:opacity-40 touch-manipulation select-none';
// Shuffle and repeat: secondary, and the key colour when on, as Apple's toggles.
const toggle = `${control} size-8 sm:size-7 text-secondary aria-pressed:text-key hover:text-primary active:scale-95 transition-transform`;
const transport = `${control} size-9 sm:size-8 text-primary active:scale-95 transition-transform`;
const action =
  'grid h-8 w-7 sm:h-7 sm:w-6 place-items-center rounded-[4px] text-primary aria-pressed:text-key touch-manipulation hover:text-primary active:scale-95 transition-transform';
// The actions the volume level slides in over: they fade out while it's open.
const fading = `${action} ${fadeForVolume}`;

/** The floating glass player pill with Connect to Device support */
export function PlayerBar() {
  const sidePanel = useUi((s) => s.sidePanel);
  const toggleSidePanel = useUi((s) => s.toggleSidePanel);
  const hasLocalTrack = usePlayer((s) => s.nowPlaying !== null);
  const videoId = usePlayer((s) => s.nowPlaying?.videoId ?? null);

  // Connect to Device state
  const activeRemoteDevice = useConnect((s) => s.activeRemoteDevice);
  const remoteStatus = useConnect((s) => s.remoteStatus);
  const sendControl = useConnect((s) => s.sendControl);
  const startConnect = useConnect((s) => s.start);

  useEffect(() => {
    startConnect();
  }, [startConnect]);

  const isRemote = Boolean(activeRemoteDevice);
  const hasTrack = isRemote ? Boolean(remoteStatus?.track || hasLocalTrack) : hasLocalTrack;
  const isPlaying = isRemote
    ? Boolean(remoteStatus?.isPlaying)
    : usePlayer((s) => s.status === 'playing' || s.status === 'buffering');

  // The queue's entry for what's playing: the track menu needs the full track.
  const track = usePlayer((s) => {
    const entry = s.queue[s.index]?.track;
    return entry && entry.videoId === s.nowPlaying?.videoId ? entry : null;
  });

  const hasNext = usePlayer((s) => s.index + 1 < s.queue.length || s.repeat !== 'off' || (s.autoplay && s.index >= 0));
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const { togglePlay, next, previous, toggleShuffle, cycleRepeat } = usePlayer.getState();
  const [volumeOpen, setVolumeOpen] = useState(false);

  const handleTogglePlay = () => {
    if (isRemote) {
      sendControl('TOGGLE');
    } else {
      togglePlay();
    }
  };

  const handleNext = () => {
    if (isRemote) {
      sendControl('NEXT');
    } else {
      next();
    }
  };

  const handlePrevious = () => {
    if (isRemote) {
      sendControl('PREV');
    } else {
      previous();
    }
  };

  return (
    // The side panel overlays the page; the pill re-centres in what's left.
    // On tablet portrait (< 1024px) the pill is centered across the whole viewport.
    <div
      className="pointer-events-none absolute right-0 bottom-[max(var(--player-bottom-offset),env(safe-area-inset-bottom,16px))] left-(--web-navigation-width) max-lg:left-0 z-[calc(var(--z-web-chrome)-1)] flex justify-center px-3.5 sm:px-5 transition-[padding-inline-end] duration-(--duration-panel) ease-panel data-[panel-open=true]:pe-[calc(var(--side-panel-width)+20px)] max-lg:data-[panel-open=true]:pe-3.5 select-none"
      data-panel-open={sidePanel !== null}
    >
      <div
        className="glass-pill group/pill pointer-events-auto relative grid h-(--player-pill-height) w-[min(680px,100%)] grid-cols-[184px_minmax(160px,1fr)_minmax(57px,auto)] max-sm:grid-cols-[1fr_auto] items-center rounded-pill px-3.5 sm:px-4 shadow-glass transition-all duration-200"
        role="region"
        aria-label="Player"
      >
        {/* Full controls on tablet and desktop (>= 484px / sm) */}
        <div className="flex items-center justify-between pr-2 max-sm:hidden">
          <button className={toggle} aria-label="Shuffle" aria-pressed={shuffle} onClick={toggleShuffle}>
            <ShuffleIcon size={28} />
          </button>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button className={transport} disabled={!hasTrack} aria-label="Previous" onClick={handlePrevious}>
              <BackwardIcon size={26} />
            </button>
            <button
              className={`${transport} size-9 sm:size-8`}
              disabled={!hasTrack}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={handleTogglePlay}
            >
              {isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
            </button>
            <button className={transport} disabled={!hasTrack || (!hasNext && !isRemote)} aria-label="Next" onClick={handleNext}>
              <ForwardIcon size={26} />
            </button>
          </div>
          <button
            className={toggle}
            aria-label={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat'}
            aria-pressed={repeat !== 'off'}
            onClick={cycleRepeat}
          >
            {repeat === 'one' ? <RepeatOneIcon size={28} /> : <RepeatIcon size={28} />}
          </button>
        </div>

        {/* LCD with Track title, artist, seekbar */}
        <div className="h-full min-w-0 px-2 sm:px-4">
          <Lcd />
        </div>

        {/* Actions on tablet and desktop (>= sm) */}
        <div
          className="group/actions relative hidden sm:flex items-center justify-end gap-[7px] md:gap-[9px]"
          data-volume-open={volumeOpen || undefined}
          onPointerLeave={() => setVolumeOpen(false)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setVolumeOpen(false);
          }}
        >
          <FavoriteButton videoId={videoId} className={fading} />
          {track && <TrackMenu track={track} className={fading} placement="above-end" />}
          <button
            className={fading}
            aria-label="Lyrics"
            aria-pressed={sidePanel === 'lyrics'}
            onClick={() => toggleSidePanel('lyrics')}
          >
            {sidePanel === 'lyrics' ? <LyricsActiveIcon size={18} /> : <LyricsIcon size={18} />}
          </button>
          {/* Replaced Jam with Connect to Device button */}
          <button
            className={`${fading} ${
              isRemote
                ? 'text-emerald-400 aria-pressed:text-emerald-400'
                : sidePanel === 'connect'
                ? 'text-key'
                : ''
            }`}
            aria-label="Connect to a Device"
            aria-pressed={sidePanel === 'connect'}
            onClick={() => toggleSidePanel('connect')}
            title={activeRemoteDevice ? `Connected to ${activeRemoteDevice.name}` : 'Connect to a Device'}
          >
            <ConnectIcon size={18} connected={isRemote} />
          </button>
          <button
            className={fading}
            aria-label="Up Next"
            aria-pressed={sidePanel === 'up-next'}
            onClick={() => toggleSidePanel('up-next')}
          >
            <UpNextIcon size={18} />
          </button>
          <VolumeControl open={volumeOpen} onOpen={() => setVolumeOpen(true)} className={action} />
        </div>

        {/* Compact quick transport on mobile (< sm) */}
        <div className="flex sm:hidden items-center gap-1 pl-1">
          <button
            className={`${transport} size-9`}
            disabled={!hasTrack}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={handleTogglePlay}
          >
            {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
          <button
            className={`${transport} size-9`}
            disabled={!hasTrack || (!hasNext && !isRemote)}
            aria-label="Next"
            onClick={handleNext}
          >
            <ForwardIcon size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
