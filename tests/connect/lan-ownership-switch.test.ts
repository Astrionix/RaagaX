import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OwnershipSwitchProtocol } from '../../src/lib/connect/lan/OwnershipSwitchProtocol';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { Song } from '../../src/types/music';

const mockSong: Song = {
  id: 'song_switch_test',
  title: 'Switch Track',
  artist: 'Switch Artist',
  artistId: 'art_switch_1',
  album: 'Switch Album',
  albumId: 'alb_switch_1',
  coverUrl: '/cover.png',
  duration: 300,
  audioUrl: 'https://audio.raagax.test/switch.mp3',
  genre: 'Classical',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 200,
  likes: 80,
};

describe('RaagaX Connect V2: 4-Way Atomic Ownership Switch Protocol', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_d1',
      activeDeviceId: 'dev_d1',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong: mockSong,
      queue: [mockSong],
      queueIndex: 0,
      isPlaying: true,
      currentTime: 120, // 2:00
      duration: 300,
    });

    PlaybackOwnerEngine.getInstance().setOwner('dev_d1', true);
  });

  it('completes successful 4-way switch handshake from D1 to M1', async () => {
    const switchProto = OwnershipSwitchProtocol.getInstance();
    const transport = DirectLANTransport.getInstance();

    // Mock direct message loopback
    const sentMessages: any[] = [];
    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg) => {
      sentMessages.push(msg);
      // Simulate asynchronous peer response
      setTimeout(() => {
        if (msg.type === 'SWITCH_OFFER') {
          // M1 receives offer from D1, prepares, and responds with SWITCH_READY
          transport.handleIncomingMessage({
            id: 'rdy_1',
            type: 'SWITCH_READY',
            sourceDeviceId: 'dev_m1',
            targetDeviceId: 'dev_d1',
            transferId: (msg as any).transferId,
            readyPositionMs: 120000,
            timestamp: Date.now(),
          });
        } else if (msg.type === 'SWITCH_REQUEST') {
          // D1 responds with offer
          transport.handleIncomingMessage({
            id: 'off_1',
            type: 'SWITCH_OFFER',
            sourceDeviceId: 'dev_d1',
            targetDeviceId: 'dev_m1',
            transferId: (msg as any).transferId,
            snapshot: {
              song: mockSong,
              queue: [mockSong],
              queueIndex: 0,
              positionMs: 120000,
              durationMs: 300000,
              isPlaying: true,
              playbackRate: 1.0,
              stateVersion: 5,
            },
            timestamp: Date.now(),
          });
        } else if (msg.type === 'SWITCH_READY') {
          // D1 confirms commit
          transport.handleIncomingMessage({
            id: 'cmt_1',
            type: 'SWITCH_COMMIT',
            sourceDeviceId: 'dev_d1',
            targetDeviceId: 'dev_m1',
            transferId: (msg as any).transferId,
            newOwnerDeviceId: 'dev_m1',
            finalPositionMs: 120000,
            stateVersion: 6,
            timestamp: Date.now(),
          });
        }
      }, 10);
      return true;
    });

    const success = await switchProto.switchPlayback('dev_m1');
    expect(success).toBe(true);
  });

  it('executes failure protection rollback when target fails to load track without interrupting owner', async () => {
    const switchProto = OwnershipSwitchProtocol.getInstance();
    const transport = DirectLANTransport.getInstance();

    // D1 is playing at 2:00
    expect(PlaybackOwnerEngine.getInstance().isOwner()).toBe(true);
    expect(usePlayerStore.getState().currentTime).toBe(120);

    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg) => {
      setTimeout(() => {
        if (msg.type === 'SWITCH_OFFER' || msg.type === 'SWITCH_REQUEST') {
          // Simulate target failing to load track (e.g. network timeout or unsupported codec)
          transport.handleIncomingMessage({
            id: 'fail_1',
            type: 'SWITCH_FAILED',
            sourceDeviceId: 'dev_m1',
            targetDeviceId: 'dev_d1',
            transferId: (msg as any).transferId,
            reason: 'Audio stream load error',
            errorCode: 'PLAYBACK_ERROR',
            timestamp: Date.now(),
          });
        }
      }, 10);
      return true;
    });

    const success = await switchProto.switchPlayback('dev_m1');
    expect(success).toBe(false);

    // D1 must still remain OWNER and maintain its playback state uninterrupted
    expect(PlaybackOwnerEngine.getInstance().isOwner()).toBe(true);
    expect(usePlayerStore.getState().currentSong?.title).toBe('Switch Track');
  });
});
