import { CommandManager } from './CommandManager';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';

export class HandoffManager {
  private static instance: HandoffManager;

  private constructor() {}

  public static getInstance(): HandoffManager {
    if (!HandoffManager.instance) {
      HandoffManager.instance = new HandoffManager();
    }
    return HandoffManager.instance;
  }

  // 1. Transactional Handoff from Local Device to Target Device
  public async switchPlaybackTo(
    connectionId: string,
    targetDeviceId: string
  ): Promise<{ success: boolean; reason?: string }> {
    const store = usePlayerStore.getState();
    const playback = PlaybackService.getInstance();
    const currentSong = store.currentSong || (store.queue && store.queue.length > 0 ? store.queue[0] : null);

    if (!currentSong) {
      // If no song is loaded or playing, target device selection is complete
      return { success: true };
    }

    let currentPosMs = (store.currentTime || 0) * 1000;
    try {
      const active = playback.getActiveAudio();
      if (active && !isNaN(active.currentTime) && active.currentTime >= 0) {
        currentPosMs = active.currentTime * 1000;
      }
    } catch {}

    const wasPlaying = store.isPlaying;

    try {
      // Step A: Send TRANSFER_PLAYBACK command to target device with full queue context
      const ack = await CommandManager.getInstance().sendCommand(
        connectionId,
        targetDeviceId,
        'TRANSFER_PLAYBACK',
        {
          track: currentSong,
          queue: store.queue && store.queue.length > 0 ? store.queue : [currentSong],
          queueIndex: typeof store.queueIndex === 'number' ? store.queueIndex : 0,
          positionMs: currentPosMs,
          isPlaying: wasPlaying,
          volume: Math.round((store.volume || 1) * 100),
          repeat: store.repeatMode || 'off',
          shuffle: Boolean(store.shuffleMode && store.shuffleMode !== 'OFF'),
        },
        7000
      );

      if (ack.status === 'accepted') {
        // Step B: Target confirmed playback! Deactivate local audio element smoothly without breaking store.isPlaying
        playback.pauseAudioElementOnly();
        return { success: true };
      } else {
        return { success: false, reason: ack.reason || 'Target refused playback transfer' };
      }
    } catch (err: any) {
      // Step C: If handoff fails, keep local device playing safely!
      return { success: false, reason: err?.message || 'Playback transfer timed out' };
    }
  }
}
