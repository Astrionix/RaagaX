import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Users } from 'lucide-react';
import { useParty } from '@/party/listenTogether';
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
  VolumeIcon,
} from '@/components/icons/Transport';
import { FavoriteButton } from '@/components/music/FavoriteButton';
import { useLyrics } from '@/lyrics/useLyrics';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';
import { Lcd } from './Lcd';

const control = 'grid place-items-center rounded-[6px] disabled:opacity-40';
// Shuffle and repeat: secondary, and the key colour when on, as Apple's toggles.
const toggle = `${control} size-7 text-secondary aria-pressed:text-key`;
const transport = `${control} size-7 text-primary`;
const action = 'grid h-7 w-6 place-items-center rounded-[4px] text-primary aria-pressed:text-key';
// The actions the volume level slides in over: they fade out while it's open.
const fading = `${action} transition-opacity group-data-volume-open/actions:pointer-events-none group-data-volume-open/actions:opacity-0`;

const slider = [
  'absolute top-1/2 right-[33px] mx-0 mb-0 -mt-2 block h-4 w-24 cursor-pointer appearance-none bg-transparent',
  'pointer-events-none translate-x-2 opacity-0 transition-[opacity,translate]',
  'data-open:pointer-events-auto data-open:translate-none data-open:opacity-100',
  '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-[2px] [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--systemPrimary)_var(--fill),var(--systemQuaternary)_var(--fill))]',
  '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-[2px] [&::-moz-range-track]:bg-[linear-gradient(to_right,var(--systemPrimary)_var(--fill),var(--systemQuaternary)_var(--fill))]',
  '[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_2px_#0006]',
  '[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_0_2px_#0006]',
].join(' ');

/**
 * Apple's volume control: the speaker mutes, and hovering it slides the level
 * in where the other actions were (they fade out while it's open).
 */
function VolumeControl({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const level = muted ? 0 : volume;
  return (
    <>
      <input
        className={slider}
        data-open={open || undefined}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={level}
        aria-label="Volume"
        tabIndex={open ? 0 : -1}
        style={{ '--fill': `${level * 100}%` } as React.CSSProperties}
        onChange={(e) => setVolume(Number(e.currentTarget.value))}
      />
      <button
        className={action}
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={muted}
        onClick={toggleMute}
        onPointerEnter={onOpen}
        onFocus={onOpen}
      >
        <VolumeIcon level={level} size={20} />
      </button>
    </>
  );
}

import { sizedArtwork } from '@/lib/artwork';
import { useScrubber } from './useScrubber';

/** Dedicated touch-optimized mini player for mobile devices (<640px) */
function MobileMiniPlayer() {
  const nowPlaying = usePlayer((s) => s.nowPlaying);
  const playing = usePlayer((s) => s.status === 'playing' || s.status === 'buffering');
  const hasNext = usePlayer((s) => s.index + 1 < s.queue.length || s.repeat !== 'off' || (s.autoplay && s.index >= 0));
  const { togglePlay, next } = usePlayer.getState();
  const setFullScreen = useUi((s) => s.setFullScreen);
  const { bar } = useScrubber();
  const partyCode = useParty((s) => s.code);
  const navigate = useNavigate();

  if (!nowPlaying) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+8px)] z-[calc(var(--z-web-chrome)-1)] sm:hidden"
      role="region"
      aria-label="Mobile Mini Player"
    >
      <div className="glass-pill relative flex h-14 w-full items-center justify-between overflow-hidden rounded-2xl border border-white/10 px-3 py-1.5 shadow-2xl backdrop-blur-2xl">
        {/* Track info and artwork: tap to open full screen */}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:opacity-80 cursor-pointer"
          onClick={() => setFullScreen(true)}
          aria-label="Open full screen player"
        >
          {nowPlaying.artworkUrl ? (
            <img
              src={sizedArtwork(nowPlaying.artworkUrl, 44)}
              alt=""
              className="size-10 flex-none rounded-lg object-cover shadow-sm"
              loading="lazy"
            />
          ) : (
            <div className="size-10 flex-none rounded-lg bg-white/10 grid place-items-center text-primary">
              <PlayIcon size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1 pr-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-semibold text-primary leading-tight">
                {nowPlaying.title}
              </p>
              {partyCode && (
                <span className="flex-none rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                  JAM
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-secondary leading-tight mt-0.5">
              {nowPlaying.artist || 'Raaga Music'}
            </p>
          </div>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-none pl-1">
          {partyCode && (
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-emerald-400 active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/jam');
              }}
              title={`In Jam (${partyCode})`}
            >
              <Users size={17} />
            </button>
          )}
          <FavoriteButton videoId={nowPlaying.videoId} className="grid size-8 place-items-center rounded-full text-primary active:scale-95" />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full bg-white/15 hover:bg-white/20 text-primary active:scale-95 transition-all shadow-sm"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-primary disabled:opacity-30 active:scale-95 transition-transform"
            aria-label="Next track"
            disabled={!hasNext}
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            <ForwardIcon size={20} />
          </button>
        </div>

        {/* Subtle mini progress bar along bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10 overflow-hidden" aria-hidden="true">
          <div ref={bar} className="size-full origin-left scale-x-(--progress) bg-key [--progress:0] transition-transform duration-75" />
        </div>
      </div>
    </div>
  );
}

/** The floating glass player pill (report §1). */
export function PlayerBar() {
  const sidePanel = useUi((s) => s.sidePanel);
  const toggleSidePanel = useUi((s) => s.toggleSidePanel);
  const lyrics = useLyrics();
  const hasLyrics = !!lyrics.data || sidePanel === 'lyrics';
  const hasTrack = usePlayer((s) => s.nowPlaying !== null);
  const videoId = usePlayer((s) => s.nowPlaying?.videoId ?? null);
  const playing = usePlayer((s) => s.status === 'playing' || s.status === 'buffering');
  const hasNext = usePlayer((s) => s.index + 1 < s.queue.length || s.repeat !== 'off' || (s.autoplay && s.index >= 0));
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const { togglePlay, next, previous, toggleShuffle, cycleRepeat } = usePlayer.getState();
  const [volumeOpen, setVolumeOpen] = useState(false);
  const partyCode = useParty((s) => s.code);
  const partyMembers = useParty((s) => s.members.length);
  const navigate = useNavigate();

  return (
    <>
      <MobileMiniPlayer />
      {/* Desktop & Tablet Pill: The side panel overlays the page; the pill re-centres in what's left. */}
      <div
        className="pointer-events-none absolute right-0 bottom-(--player-bottom-offset) left-(--web-navigation-width) z-[calc(var(--z-web-chrome)-1)] hidden sm:flex justify-center px-4 transition-[padding-inline-end] duration-(--duration-panel) ease-panel min-[1140px]:data-[panel-open=true]:pe-[calc(var(--side-panel-width)+20px)]"
        data-panel-open={sidePanel !== null}
      >
        <div
          className="glass-pill group/pill pointer-events-auto relative grid h-(--player-pill-height) w-[min(668px,100%)] grid-cols-[auto_minmax(140px,1fr)_auto] md:grid-cols-[184px_minmax(180px,427px)_minmax(57px,auto)] items-center rounded-pill px-3 sm:px-4"
          role="region"
          aria-label="Player"
        >
          <div className="flex items-center justify-between pr-2 gap-1 sm:gap-1.5">
            <button className={`${toggle} max-md:hidden`} aria-label="Shuffle" aria-pressed={shuffle} onClick={toggleShuffle}>
              <ShuffleIcon size={28} />
            </button>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button className={transport} disabled={!hasTrack} aria-label="Previous" onClick={previous}>
                <BackwardIcon size={26} />
              </button>
              <button className={transport} disabled={!hasTrack} aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
                {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
              </button>
              <button className={transport} disabled={!hasTrack || !hasNext} aria-label="Next" onClick={next}>
                <ForwardIcon size={26} />
              </button>
            </div>
            <button
              className={`${toggle} max-md:hidden`}
              aria-label={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat'}
              aria-pressed={repeat !== 'off'}
              onClick={cycleRepeat}
            >
              {repeat === 'one' ? <RepeatOneIcon size={28} /> : <RepeatIcon size={28} />}
            </button>
          </div>

          <div className="h-full min-w-0 px-2 sm:px-4">
            <Lcd />
          </div>

          <div
            className="group/actions relative flex items-center justify-end gap-[9px]"
            data-volume-open={volumeOpen || undefined}
            onPointerLeave={() => setVolumeOpen(false)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setVolumeOpen(false);
            }}
          >
            <FavoriteButton videoId={videoId} className={fading} />
            <button
              className={`${fading} ${partyCode ? 'text-emerald-400!' : ''}`}
              aria-label="Raaga Jam"
              title={partyCode ? `In Jam (${partyCode}) · ${partyMembers} listening` : 'Start or Join Raaga Jam'}
              onClick={() => navigate('/jam')}
            >
              <span className="relative grid place-items-center">
                <Users size={17} />
                {partyCode && (
                  <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-emerald-400 ring-2 ring-black animate-pulse" />
                )}
              </span>
            </button>
            {hasLyrics && (
              <button
                className={fading}
                aria-label="Lyrics"
                aria-pressed={sidePanel === 'lyrics'}
                onClick={() => toggleSidePanel('lyrics')}
              >
                {sidePanel === 'lyrics' ? <LyricsActiveIcon size={18} /> : <LyricsIcon size={18} />}
              </button>
            )}
            <button
              className={fading}
              aria-label="Up Next"
              aria-pressed={sidePanel === 'up-next'}
              onClick={() => toggleSidePanel('up-next')}
            >
              <UpNextIcon size={18} />
            </button>
            <VolumeControl open={volumeOpen} onOpen={() => setVolumeOpen(true)} />
          </div>
        </div>
      </div>
    </>
  );
}
