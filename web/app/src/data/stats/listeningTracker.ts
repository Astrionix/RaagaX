import { getAudio, usePlayer, type NowPlaying } from '@/state/player';
import { useListeningStore } from './listeningStore';

const FLUSH_INTERVAL_SEC = 10;

/**
 * Tracks local playback on this device/browser and feeds listening statistics.
 * Runs continuously in the background during AppShell lifetime.
 */
export function startListeningTracker(): () => void {
  let activeTrack: NowPlaying | null = null;
  let lastPosition = 0;
  let accumulatedForTrack = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  function flushCurrent(track: NowPlaying | null, seconds: number) {
    if (!track || seconds <= 0) return;
    useListeningStore.getState().recordPlay(
      {
        videoId: track.videoId,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
        durationSec: track.durationSec,
      },
      seconds,
    );
  }

  function sample() {
    const audio = getAudio();
    const { nowPlaying, status } = usePlayer.getState();

    if (!audio || !nowPlaying || status !== 'playing') {
      lastPosition = audio?.currentTime ?? 0;
      return;
    }

    const currentPos = audio.currentTime;
    const delta = currentPos - lastPosition;

    // Plausible forward playback (ignore large seeks backwards/forwards > 15s)
    if (delta > 0 && delta <= 15) {
      accumulatedForTrack += delta;
    }
    lastPosition = currentPos;

    if (accumulatedForTrack >= FLUSH_INTERVAL_SEC) {
      flushCurrent(activeTrack, accumulatedForTrack);
      accumulatedForTrack = 0;
    }
  }

  timer = setInterval(sample, 4_000);

  const unsubscribe = usePlayer.subscribe((state, prev) => {
    const nextTrack = state.nowPlaying;
    const prevTrack = prev.nowPlaying;

    if (nextTrack?.videoId !== prevTrack?.videoId) {
      // Song switched; flush remainder for previous song
      if (activeTrack && accumulatedForTrack > 0) {
        flushCurrent(activeTrack, accumulatedForTrack);
      }
      activeTrack = nextTrack;
      accumulatedForTrack = 0;
      const audio = getAudio();
      lastPosition = audio?.currentTime ?? 0;
    }
  });

  return () => {
    if (timer) clearInterval(timer);
    unsubscribe();
    if (activeTrack && accumulatedForTrack > 0) {
      flushCurrent(activeTrack, accumulatedForTrack);
    }
  };
}
