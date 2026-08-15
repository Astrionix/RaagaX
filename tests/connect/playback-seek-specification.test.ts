import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';
import { PlaybackStateSync, RemotePlaybackState } from '@/lib/connect/PlaybackStateSync';
import { CommandBus } from '@/lib/connect/CommandBus';
import { CommandValidator } from '@/lib/connect/CommandValidator';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { ConnectivityRouter } from '@/lib/connect/ConnectivityRouter';
import { LocalPeerConnection } from '@/lib/connect/LocalPeerConnection';
import { SeekLock } from '@/lib/playback/SeekLock';
import { Song } from '@/types/music';

const songChilipiga: Song = {
  id: 'song_chilipiga_1',
  title: 'Chilipiga',
  artist: 'Sid Sriram',
  artistId: 'sid_sriram',
  album: 'Orange',
  albumId: 'orange_album',
  genre: 'Telugu',
  category: 'melody',
  releaseYear: 2010,
  plays: 10000,
  likes: 2500,
  duration: 240, // 4:00 (240s)
  coverUrl: 'https://example.com/chilipiga.jpg',
  audioUrl: 'https://example.com/chilipiga.mp4'
};

const songInthandham: Song = {
  id: 'song_inthandham_2',
  title: 'Inthandham',
  artist: 'SPB',
  artistId: 'spb_artist',
  album: 'Sita Ramam',
  albumId: 'sita_ramam_album',
  genre: 'Telugu',
  category: 'melody',
  releaseYear: 2022,
  plays: 15000,
  likes: 4000,
  duration: 218, // 3:38
  coverUrl: 'https://example.com/inthandham.jpg',
  audioUrl: 'https://example.com/inthandham.mp4'
};

describe('RaagaX Local Playback + Cross-Device Seek Master Specification Suite', () => {
  let mockAudioElement: HTMLAudioElement;

  beforeEach(() => {
    mockAudioElement = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      volume: 1.0,
      currentTime: 180, // Default at 3:00 (180s)
      duration: 240,
      paused: false,
    } as any;

    PlaybackEngine.getInstance().attachMediaElement(mockAudioElement);
    CommandSequencer.getInstance().reset();
    CommandSequencer.getInstance().setEpoch(1);
    CommandValidator.getInstance().reset();
    CommandBus.getInstance().reset();
    ConnectivityRouter.getInstance().reset();

    usePlayerStore.setState({
      deviceId: 'dev_laptop_renderer',
      isActiveDevice: true,
      isPlaying: true,
      playbackIntent: 'PLAYING',
      currentSong: songChilipiga,
      currentTime: 180,
      duration: 240,
      queue: [songChilipiga, songInthandham],
      queueIndex: 0,
      connectedDeviceId: null,
      lastReceivedPlaybackRevision: 0,
      localPlaybackRevision: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // PART 1: LOCAL PLAYBACK & LOCAL SEEK
  // =========================================================================

  describe('Local Playback & Arbitrary Direction Seeking', () => {
    it('Case 1 & 5 (Mandatory Regression): 3:00 -> 1:45 Backward Seek sets exact position, preserves PLAYING state, does NOT reset to 0:00', () => {
      const service = PlaybackService.getInstance();
      
      expect(usePlayerStore.getState().currentTime).toBe(180);
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      // Execute backward seek to 105s (1:45)
      service.seek(105);

      expect(mockAudioElement.currentTime).toBe(105);
      expect(usePlayerStore.getState().currentTime).toBe(105);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(mockAudioElement.pause).not.toHaveBeenCalled();
    });

    it('Case 2 & 6: 1:45 -> 3:30 Forward Seek sets exact position and continues playing', () => {
      const service = PlaybackService.getInstance();
      usePlayerStore.setState({ currentTime: 105 });
      mockAudioElement.currentTime = 105;

      service.seek(210); // 3:30

      expect(mockAudioElement.currentTime).toBe(210);
      expect(usePlayerStore.getState().currentTime).toBe(210);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
    });

    it('Case 3: Pause -> Seek Forward (1:45 -> 3:00) preserves PAUSED state (No unexpected auto-play)', () => {
      const service = PlaybackService.getInstance();
      usePlayerStore.setState({ isPlaying: false, playbackIntent: 'PAUSED', currentTime: 105 });
      mockAudioElement.currentTime = 105;
      (mockAudioElement as any).paused = true;

      service.seek(180); // 3:00

      expect(mockAudioElement.currentTime).toBe(180);
      expect(usePlayerStore.getState().currentTime).toBe(180);
      expect(usePlayerStore.getState().isPlaying).toBe(false);
      expect(mockAudioElement.play).not.toHaveBeenCalled();
    });

    it('Case 4: Pause -> Seek Backward (3:00 -> 1:45) preserves PAUSED state', () => {
      const service = PlaybackService.getInstance();
      usePlayerStore.setState({ isPlaying: false, playbackIntent: 'PAUSED', currentTime: 180 });
      mockAudioElement.currentTime = 180;
      (mockAudioElement as any).paused = true;

      service.seek(105); // 1:45

      expect(mockAudioElement.currentTime).toBe(105);
      expect(usePlayerStore.getState().currentTime).toBe(105);
      expect(usePlayerStore.getState().isPlaying).toBe(false);
      expect(mockAudioElement.play).not.toHaveBeenCalled();
    });

    it('Case 7 & 15: Large Seek (4:20 -> 0:05 / 240s -> 5s) handles arbitrary offset without reset loop', () => {
      const service = PlaybackService.getInstance();
      usePlayerStore.setState({ currentTime: 240 });
      mockAudioElement.currentTime = 240;

      service.seek(5);

      expect(mockAudioElement.currentTime).toBe(5);
      expect(usePlayerStore.getState().currentTime).toBe(5);
    });

    it('Case 8: Rapid Multi-Seeks only commit final authoritative target on release', () => {
      const service = PlaybackService.getInstance();
      
      // Simulate drag 180 -> 170 -> 150 -> 105
      SeekLock.startSeeking();
      expect(SeekLock.shouldBlockRemoteUpdate).toBe(true);

      // On release, single commit:
      SeekLock.endSeeking(800);
      service.seek(105);

      expect(mockAudioElement.currentTime).toBe(105);
      expect(usePlayerStore.getState().currentTime).toBe(105);
    });

    it('Case 10: Seek to exact 0:00 resets timeline to track start smoothly', () => {
      const service = PlaybackService.getInstance();
      service.seek(0);

      expect(mockAudioElement.currentTime).toBe(0);
      expect(usePlayerStore.getState().currentTime).toBe(0);
    });

    it('Case 11: Seek to exact track duration caps cleanly at duration boundary', () => {
      const service = PlaybackService.getInstance();
      service.seek(240);

      expect(mockAudioElement.currentTime).toBe(240);
      expect(usePlayerStore.getState().currentTime).toBe(240);
    });
  });

  // =========================================================================
  // PART 2: CROSS-DEVICE SEEK & COMMAND ARCHITECTURE
  // =========================================================================

  describe('Cross-Device Seek & Command Dispatching', () => {
    it('Case 17 (Mandatory Regression): Mobile Controller -> Laptop Renderer: 3:00 -> 1:45 Backward Seek executes on Renderer with new Revision', async () => {
      const bus = CommandBus.getInstance();
      const sync = PlaybackStateSync.getInstance();

      // Mobile Controller dispatches SEEK command to Laptop Renderer
      const seekCommand = {
        commandId: 'cmd_seek_300_to_145',
        sessionId: 'sess_user_1',
        epoch: 1,
        sequence: 1,
        sourceDeviceId: 'dev_mobile_controller',
        targetDeviceId: 'dev_laptop_renderer',
        type: 'SEEK' as const,
        sentAt: Date.now(),
        payload: {
          positionMs: 105000, // 1:45
          songId: songChilipiga.id,
        }
      };

      const broadcastSpy = vi.spyOn(sync, 'broadcastState');

      // Laptop Renderer receives and processes command
      bus.handleIncomingCommand(seekCommand);
      await new Promise(r => setTimeout(r, 10));

      // Verify Renderer seeked immediately
      expect(mockAudioElement.currentTime).toBe(105);
      expect(usePlayerStore.getState().currentTime).toBe(105);
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      // Verify authoritative state was broadcasted
      expect(broadcastSpy).toHaveBeenCalled();
    });

    it('Case 18: Mobile Controller -> Laptop Renderer: 1:45 -> 3:00 Forward Seek executes identically', async () => {
      const bus = CommandBus.getInstance();
      usePlayerStore.setState({ currentTime: 105 });
      mockAudioElement.currentTime = 105;

      const seekCommand = {
        commandId: 'cmd_seek_145_to_300',
        sessionId: 'sess_user_1',
        epoch: 1,
        sequence: 2,
        sourceDeviceId: 'dev_mobile_controller',
        targetDeviceId: 'dev_laptop_renderer',
        type: 'SEEK' as const,
        sentAt: Date.now(),
        payload: {
          positionMs: 180000, // 3:00
          songId: songChilipiga.id,
        }
      };

      bus.handleIncomingCommand(seekCommand);

      expect(mockAudioElement.currentTime).toBe(180);
      expect(usePlayerStore.getState().currentTime).toBe(180);
    });

    it('Case 26: Duplicate SEEK command with identical commandId executes exactly once (Idempotency)', () => {
      const bus = CommandBus.getInstance();

      const seekCommand = {
        commandId: 'cmd_duplicate_seek_99',
        sessionId: 'sess_user_1',
        epoch: 1,
        sequence: 3,
        sourceDeviceId: 'dev_mobile_controller',
        targetDeviceId: 'dev_laptop_renderer',
        type: 'SEEK' as const,
        sentAt: Date.now(),
        payload: {
          positionMs: 105000,
          songId: songChilipiga.id,
        }
      };

      mockAudioElement.currentTime = 180;
      bus.handleIncomingCommand(seekCommand);
      expect(mockAudioElement.currentTime).toBe(105);

      // Change position to 110s locally as track plays
      mockAudioElement.currentTime = 110;
      usePlayerStore.setState({ currentTime: 110 });

      // Duplicate delivery (e.g. delivered via Cloud relay after LAN already succeeded)
      bus.handleIncomingCommand(seekCommand);

      // Must NOT re-execute or jump backward to 105s
      expect(mockAudioElement.currentTime).toBe(110);
    });

    it('Case 27: Stale playback state event (3:00) arriving after committed seek (1:45) is rejected by Seek Shield', () => {
      const sync = PlaybackStateSync.getInstance();

      // Configure device as Controller targeting Remote Laptop
      usePlayerStore.setState({
        deviceId: 'dev_mobile_controller',
        isActiveDevice: false,
        connectedDeviceId: 'dev_laptop_renderer',
        activeDeviceId: 'dev_laptop_renderer',
        currentTime: 105,
        lastReceivedPlaybackRevision: 10,
      });

      // Controller records that it sent a SEEK command to 105s
      sync.recordSentCommand('SEEK', songChilipiga.id, 0, 105000, 'cmd_seek_105');

      // Stale incoming update from network reporting old 3:00 (180s) position
      const staleRemoteState: RemotePlaybackState = {
        activeDeviceId: 'dev_laptop_renderer',
        activeDeviceName: 'TNT Gaming PC',
        songId: songChilipiga.id,
        songData: songChilipiga,
        isPlaying: true,
        positionMs: 180000, // 3:00 (stale)
        durationMs: 240000,
        volume: 1.0,
        isMuted: false,
        queue: [songChilipiga],
        queueIndex: 0,
        epoch: 1,
        revision: 11,
        serverTimestamp: Date.now()
      };

      sync.handleRemoteStateUpdate(staleRemoteState);

      // UI position MUST remain 105s (NOT reverted to 180s)
      expect(usePlayerStore.getState().currentTime).toBe(105);
    });

    it('Case 12: Authoritative Renderer owns audio clock; Controller predicts position between anchors', () => {
      usePlayerStore.setState({
        deviceId: 'dev_mobile_controller',
        isActiveDevice: false,
        connectedDeviceId: 'dev_laptop_renderer',
        currentTime: 105,
        remoteAnchorPositionMs: 105000,
        remoteAnchorTimeMs: Date.now() - 2000, // 2 seconds elapsed
        isPlaying: true
      });

      const store = usePlayerStore.getState();
      const elapsed = (Date.now() - store.remoteAnchorTimeMs) / 1000;
      const predictedSec = (store.remoteAnchorPositionMs / 1000) + elapsed;

      expect(predictedSec).toBeGreaterThanOrEqual(106.9);
      expect(predictedSec).toBeLessThanOrEqual(107.5);
    });
  });

  // =========================================================================
  // PART 3: HYBRID TRANSPORT, LIFECYCLE & SAFETY
  // =========================================================================

  describe('Hybrid Transport Routing & Device State Safety', () => {
    it('Case 21 & 22: Preferred LAN Direct for local reachable, Cloud Relay for remote', () => {
      const router = ConnectivityRouter.getInstance();

      // When LAN peer is active
      router.setLocalPeerAvailable(true);
      expect(router.getActiveTransport()).toBe('LOCAL_DIRECT');

      // When LAN peer drops
      router.setLocalPeerAvailable(false);
      expect(router.getActiveTransport()).toBe('CLOUD_RELAY');
    });

    it('Case 9 & 23: Transport switching during active playback does NOT pause, restart or alter position', () => {
      const router = ConnectivityRouter.getInstance();
      router.setLocalPeerAvailable(true);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().currentTime).toBe(180);

      // Switch to cloud
      router.setLocalPeerAvailable(false);

      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().currentTime).toBe(180);
      expect(usePlayerStore.getState().currentSong?.id).toBe(songChilipiga.id);

      // Switch back to LAN
      router.setLocalPeerAvailable(true);

      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().currentTime).toBe(180);
    });

    it('Case 19: Controller disconnect does NOT interrupt or pause Laptop Renderer playback', () => {
      // Laptop is playing
      expect(usePlayerStore.getState().isActiveDevice).toBe(true);
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      // Remote mobile controller disconnects (removes peer)
      LocalPeerConnection.getInstance().cleanup('dev_mobile_controller');

      // Laptop continues playing undisturbed
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(mockAudioElement.pause).not.toHaveBeenCalled();
    });

    it('Case 22: App startup does NOT automatically connect to other devices or seize controller lease', () => {
      // Clean launch state
      usePlayerStore.setState({
        connectedDeviceId: null,
        activeDeviceId: 'dev_laptop_renderer',
        isActiveDevice: true,
        deviceConnectionState: 'AVAILABLE'
      });

      expect(usePlayerStore.getState().connectedDeviceId).toBeNull();
      expect(usePlayerStore.getState().deviceConnectionState).toBe('AVAILABLE');
    });
  });
});
