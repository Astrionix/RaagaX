'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Sparkles,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  MessageSquare,
  ListMusic,
  Disc3,
  Maximize2,
  Radio,
  Speaker,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';
import { DeviceIdentityManager } from '@/lib/connect/DeviceIdentityManager';
import { useJam } from '@/hooks/useJam';

export function PlayerBar() {
  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<ChameleonPalette | null>(null);

  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    shuffleMode,
    repeatMode,
    togglePlayPause,
    playNext,
    playPrev,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    toggleLyrics,
    toggleQueue,
    isQueueOpen,
    rightPanelMode,
    setRightPanelMode,
    isLyricsOpen,
    isPlayerExpanded,
    togglePlayerExpanded,
    toggleConnectModal,
    isLocalPlayback,
    activePlaybackDeviceId,
  } = usePlayerStore();

  const [speakerDeviceName, setSpeakerDeviceName] = useState<string>('Remote Speaker');
  const [thisDeviceName, setThisDeviceName] = useState<string>('This Device');
  const [activeControllerName, setActiveControllerName] = useState<string | null>(null);
  const [hasRemoteSpeaker, setHasRemoteSpeaker] = useState<boolean>(false);
  const { isInJam, roomPin, participantCount } = useJam();

  useEffect(() => {
    setMounted(true);
    import('@/lib/playback/PlaybackService').then(({ PlaybackService }) => {
      PlaybackService.getInstance().syncLivePlayingState();
    }).catch(() => {});
  }, []);

  // Dynamic Tab Title Synchronization (Spotify / Apple Music standard)
  useEffect(() => {
    import('@/lib/sync/TabSyncCoordinator').then(({ TabSyncCoordinator }) => {
      TabSyncCoordinator.getInstance().updateDocumentTitle(currentSong, isPlaying);
    }).catch(() => {});
  }, [currentSong?.id, isPlaying]);

  // Track active speaker and controller device names dynamically
  useEffect(() => {
    let unsubRegistry: (() => void) | undefined;
    let unsubController: (() => void) | undefined;

    Promise.all([
      import('@/lib/connect/DeviceRegistry'),
      import('@/lib/connect/DeviceIdentityManager'),
    ]).then(([{ DeviceRegistry }, { DeviceIdentityManager }]) => {
      const updateSpeakerName = () => {
        const selfDev = DeviceIdentityManager.getInstance().getDevice();
        if (selfDev?.deviceName) {
          setThisDeviceName(selfDev.deviceName);
        }
        const activeDevId = usePlayerStore.getState().activePlaybackDeviceId;
        const otherDevs = DeviceRegistry.getInstance().getAllDevices(selfDev.deviceId);
        const dev = DeviceRegistry.getInstance().getDevice(activeDevId);

        if (dev?.deviceName && dev.deviceId !== selfDev.deviceId) {
          setSpeakerDeviceName(dev.deviceName);
          setHasRemoteSpeaker(true);
        } else if (otherDevs.length > 0 && otherDevs[0]?.deviceName) {
          setSpeakerDeviceName(otherDevs[0].deviceName);
          setHasRemoteSpeaker(true);
        } else {
          setHasRemoteSpeaker(false);
        }
      };

      unsubRegistry = DeviceRegistry.getInstance().subscribe(updateSpeakerName);
      updateSpeakerName();
    }).catch(() => {});

    import('@/lib/connect/ConnectEngine').then(({ connectEngine }) => {
      unsubController = connectEngine.onActiveControllerChange((controllerId) => {
        if (controllerId) {
          import('@/lib/connect/DeviceRegistry').then(({ DeviceRegistry }) => {
            const dev = DeviceRegistry.getInstance().getDevice(controllerId);
            setActiveControllerName(dev?.deviceName || 'Remote Controller');
          }).catch(() => {});
        } else {
          setActiveControllerName(null);
        }
      });
    }).catch(() => {});

    return () => {
      if (unsubRegistry) unsubRegistry();
      if (unsubController) unsubController();
    };
  }, [activePlaybackDeviceId, isLocalPlayback]);

  const handleToggleQueue = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1280) {
      if (isQueueOpen && rightPanelMode === 'queue') {
        toggleQueue();
      } else {
        setRightPanelMode('queue');
        if (!isQueueOpen) toggleQueue();
      }
    } else {
      toggleQueue();
    }
  };

  const handleToggleConnect = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1280) {
      if (isQueueOpen && rightPanelMode === 'connect') {
        toggleQueue();
      } else {
        setRightPanelMode('connect');
        if (!isQueueOpen) toggleQueue();
      }
    } else {
      toggleConnectModal(true);
    }
  };

  const activeSong = currentSong;
  const isPlayingActive = isPlaying;

  const handleTogglePlayPause = () => {
    togglePlayPause();
  };

  const handlePlayNext = () => {
    playNext();
  };

  const handlePlayPrev = () => {
    playPrev();
  };

  // Extract subtle dominant ambient glow from artwork
  useEffect(() => {
    let isSubscribed = true;
    if (activeSong?.coverUrl && !activeSong.coverUrl.includes('/null/')) {
      ArtworkColorExtractor.getInstance()
        .extractPalette(activeSong.coverUrl)
        .then((p) => {
          if (isSubscribed) setPalette(p);
        })
        .catch(() => {});
    } else {
      setPalette(null);
    }
    return () => {
      isSubscribed = false;
    };
  }, [activeSong?.coverUrl]);

  // Spacebar Desktop Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const tagName = target.tagName?.toLowerCase();
        const isInputField =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable;

        if (!isInputField) {
          e.preventDefault();
          usePlayerStore.getState().togglePlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!mounted || isPlayerExpanded) return null;

  if (!activeSong) return null;

  const themeColor = palette?.primary || '#FA233B';
  const glowColor = palette?.glow || 'rgba(250, 35, 59, 0.2)';

  const repeatState = (() => {
    const r = ((repeatMode || 'OFF') as string).toUpperCase();
    return r === 'ONE' || r === 'TRACK' ? 'ONE' : r === 'ALL' || r === 'CONTEXT' ? 'ALL' : 'OFF';
  })();

  const cleanTitle = activeSong ? SongFormatter.cleanSongTitle(activeSong.title) : 'Select a track to play';
  const cleanArtist = activeSong ? (SongFormatter.decodeHtml(activeSong.artist) || activeSong.artist || 'Unknown Artist') : '';
  const cleanAlbum = activeSong?.album ? SongFormatter.cleanAlbumTitle(activeSong.album) : '';
  const subtitle = cleanArtist && cleanAlbum ? `${cleanArtist} — ${cleanAlbum}` : (cleanArtist || cleanAlbum);

  return (
    <>
      {/* ── Spotify Connect Full-width Green Bottom Bar (Matches Spotify Desktop) ── */}
      {!isLocalPlayback && hasRemoteSpeaker && (
        <div
          onClick={handleToggleConnect}
          className="hidden md:flex fixed bottom-0 left-0 right-0 z-30 h-6 sm:h-6.5 bg-[#1ed760] text-black text-xs font-bold px-4 sm:px-6 items-center justify-end gap-2 cursor-pointer select-none hover:bg-[#1fdf64] transition-colors shadow-lg"
          title={`Playing on ${speakerDeviceName || 'Remote Device'}. Tap to manage devices.`}
        >
          <Volume2 className="w-3.5 h-3.5 text-black flex-shrink-0" />
          <span className="truncate">Playing on {speakerDeviceName || 'Remote Device'}</span>
        </div>
      )}

      <aside
        aria-label="Floating Media Player"
        className={`hidden md:flex fixed ${
          !isLocalPlayback && hasRemoteSpeaker
            ? 'bottom-[calc(2.25rem+env(safe-area-inset-bottom,0px))]'
            : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
        } z-40 group/player select-none items-center justify-between px-3.5 sm:px-4 py-1.5 backdrop-blur-2xl rounded-full transition-all duration-300 max-w-[calc(100vw-18rem)] md:max-w-[760px] lg:max-w-[840px] w-auto h-[54px] gap-2.5 sm:gap-4 -translate-x-1/2 bg-[#1c1c1e]/90 hover:bg-[#1c1c1e]/95 border border-white/10 hover:border-white/15 ring-1 ring-white/5 shadow-[0_12px_36px_rgba(0,0,0,0.65)] ${
          isQueueOpen
            ? 'left-[calc(50%+8rem)] xl:left-[calc(50%+8rem-180px)]'
            : 'left-[calc(50%+8rem)]'
        }`}
        style={{
          boxShadow: `0 12px 36px rgba(0,0,0,0.7), 0 0 25px ${glowColor}`,
        }}
      >

        {/* ── 1. LEFT CONTROLS: Shuffle, Prev, Play/Pause, Next, Repeat ── */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            title={`Shuffle: ${shuffleMode}`}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              shuffleMode !== 'OFF'
                ? 'text-[#FA233B] bg-[#FA233B]/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {shuffleMode === 'SMART' ? (
              <div className="relative">
                <Shuffle className="w-3.5 h-3.5" />
                <Sparkles className="w-2 h-2 absolute -top-1 -right-1 text-yellow-400" />
              </div>
            ) : (
              <Shuffle className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handlePlayPrev}
            aria-label="Previous track"
            title="Previous (K)"
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={handleTogglePlayPause}
            aria-label={isPlayingActive ? 'Pause' : 'Play'}
            title={isPlayingActive ? 'Pause (Space)' : 'Play (Space)'}
            className="p-1.5 text-white hover:scale-110 active:scale-95 transition-all cursor-pointer rounded-full hover:bg-white/10 flex items-center justify-center"
          >
            {isPlayingActive ? (
              <Pause className="w-4 h-4 fill-white text-white" />
            ) : (
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            )}
          </button>

          <button
            onClick={handlePlayNext}
            aria-label="Next track"
            title="Next (J)"
            className="p-1.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={cycleRepeatMode}
            aria-label="Repeat mode"
            title={`Repeat: ${repeatState}`}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              repeatState !== 'OFF'
                ? 'text-[#FA233B] bg-[#FA233B]/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {repeatState === 'ONE' ? (
              <Repeat1 className="w-3.5 h-3.5" />
            ) : (
              <Repeat className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* ── 2. CENTER: Album Art, Title, Artist • Album & More Menu ── */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 max-w-[280px] sm:max-w-[340px]">
          {activeSong ? (
            <>
              <div
                onClick={togglePlayerExpanded}
                className="relative w-8 h-8 rounded-md overflow-hidden shadow-sm border border-white/10 cursor-pointer group/art flex-shrink-0"
                title="Expand Player (F)"
              >
                <OptimizedImage
                  src={activeSong.coverUrl}
                  alt={activeSong.title}
                  size="thumb"
                  className="w-full h-full object-cover group-hover/art:scale-110 transition-transform duration-300"
                  fallbackSrc="/app-icon.png"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-3 h-3 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-hidden text-left">
                <h4
                  onClick={togglePlayerExpanded}
                  className="text-[12px] sm:text-[13px] font-semibold text-white truncate hover:underline cursor-pointer transition-colors leading-tight"
                  title={cleanTitle}
                >
                  {cleanTitle}
                </h4>
                <p
                  className="text-[10px] sm:text-[11px] text-zinc-400 truncate leading-tight mt-0.5 font-normal"
                  title={subtitle}
                >
                  <span>{subtitle}</span>
                </p>
              </div>

              <div className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors">
                <SongActionMenu song={activeSong} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium truncate">
              <Disc3 className="w-4 h-4 text-[#FA233B] animate-spin flex-shrink-0" style={{ animationDuration: '8s' }} />
              <span className="truncate">Select a track to play</span>
            </div>
          )}
        </div>

        {/* ── 3. RIGHT CONTROLS: Lyrics, Queue, Volume ── */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={toggleLyrics}
            aria-label="Open lyrics"
            title="Lyrics (L)"
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isLyricsOpen
                ? 'text-[#FA233B] bg-[#FA233B]/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleToggleQueue}
            aria-label="Open queue"
            title="Queue (Q)"
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isQueueOpen && rightPanelMode === 'queue'
                ? 'text-[#FA233B] bg-[#FA233B]/15'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
          </button>

          {/* Connect to Device Button (Spotify Clean Design with Jam indicator) */}
          <button
            onClick={handleToggleConnect}
            aria-label={isInJam ? `Jam Session Active (#${roomPin})` : "Connect to a device"}
            title={
              isInJam
                ? `Jam Active (#${roomPin}) • ${participantCount} listening. Tap to manage.`
                : !isLocalPlayback && hasRemoteSpeaker
                ? `Playing on ${speakerDeviceName || 'Remote Device'}. Tap to switch.`
                : "Connect to a device"
            }
            className={`p-1.5 rounded-full transition-colors cursor-pointer relative group ${
              isInJam
                ? 'text-[#1ed760] bg-[#1ed760]/20 ring-1 ring-[#1ed760]/50'
                : isQueueOpen && rightPanelMode === 'connect'
                ? 'text-[#1ed760] bg-[#1ed760]/25 ring-1 ring-[#1ed760]/40'
                : !isLocalPlayback && hasRemoteSpeaker
                ? 'text-[#1ed760] hover:bg-white/10'
                : 'text-zinc-400 hover:text-[#1ed760] hover:bg-[#1ed760]/10'
            }`}
          >
            {isInJam ? (
              <>
                <Radio className="w-3.5 h-3.5 text-[#1ed760] animate-pulse" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#1ed760] animate-ping opacity-75" />
              </>
            ) : (
              <>
                <Speaker className="w-3.5 h-3.5" />
                {!isLocalPlayback && hasRemoteSpeaker && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                )}
              </>
            )}
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={() => toggleMute()}
              aria-label="Volume"
              title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer flex-shrink-0"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-[#FA233B]" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            <div className="relative w-16 sm:w-20 h-4 flex items-center group/vol cursor-pointer">
              <div className="absolute left-0 right-0 h-1 rounded-full bg-white/20 group-hover/vol:h-1.5 transition-all" />
              <div
                className="absolute left-0 h-1 group-hover/vol:h-1.5 rounded-full pointer-events-none transition-all bg-[#FA233B]"
                style={{
                  width: `${(isMuted ? 0 : volume) * 100}%`,
                }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (isMuted && val > 0) {
                    toggleMute();
                  }
                }}
                aria-label="Volume slider"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>
          </div>
        </div>

        {/* ── 4. INTEGRATED PROGRESS BAR (Along Bottom Edge) ── */}
        {activeSong && (
          <div className="absolute left-5 right-5 -bottom-[1px] z-30 pointer-events-auto">
            <SeekBar
              className="w-full"
              height="h-[2px] group-hover/player:h-[3px] transition-all"
              thumbSize="w-2 h-2 opacity-0 group-hover/player:opacity-100"
              activeColor="bg-[#FA233B]"
            />
          </div>
        )}
      </aside>
    </>
  );
}
