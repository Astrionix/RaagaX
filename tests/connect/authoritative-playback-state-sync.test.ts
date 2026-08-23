import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { PlaybackStateSync, RemotePlaybackState } from '@/lib/connect/PlaybackStateSync';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { CommandBus } from '@/lib/connect/CommandBus';
import { CommandValidator } from '@/lib/connect/CommandValidator';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  const mockChannel = {
    send: vi.fn().mockResolvedValue('ok'),
    subscribe: vi.fn((cb: (status: string) => void) => {
      cb('SUBSCRIBED');
      return mockChannel;
    }),
    unsubscribe: vi.fn().mockResolvedValue('ok'),
    on: vi.fn(() => mockChannel),
    state: 'joined',
    topic: 'realtime:mock_topic'
  };

  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      getChannels: vi.fn(() => []),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        match: vi.fn().mockReturnThis(),
        delete: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      })),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null })
      }
    },
    isSupabaseConfigured: vi.fn(() => true)
  };
});

describe('RAAGAX CONNECT — TWO-WAY PLAYBACK CONTROL & AUTHORITATIVE STATE SYNC', () => {
  const songA: Song = {
    id: 'HPY9vvdV',
    title: 'Song A',
    artist: 'Artist A',
    album: 'Album A',
    coverUrl: 'https://images.raagax.test/cover_a.jpg',
    duration: 240,
    audioUrl: 'https://example.com/song_a.mp3',
    artistId: 'art_a',
    albumId: 'alb_a',
    genre: 'Pop',
    category: 'global_trending',
    releaseYear: 2024,
    plays: 1000,
    likes: 500,
  };

  const songB: Song = {
    id: '7mV2egOd',
    title: 'Song B',
    artist: 'Artist B',
    album: 'Album B',
    coverUrl: 'https://images.raagax.test/cover_b.jpg',
    duration: 180,
    audioUrl: 'https://example.com/song_b.mp3',
    artistId: 'art_b',
    albumId: 'alb_b',
    genre: 'Rock',
    category: 'global_trending',
    releaseYear: 2024,
    plays: 1000,
    likes: 500,
  };

  const songC: Song = {
    id: 'song_c_search',
    title: 'Song C',
    artist: 'Artist C',
    album: 'Album C',
    coverUrl: 'https://images.raagax.test/cover_c.jpg',
    duration: 210,
    audioUrl: 'https://example.com/song_c.mp3',
    artistId: 'art_c',
    albumId: 'alb_c',
    genre: 'Electronic',
    category: 'global_trending',
    releaseYear: 2024,
    plays: 1000,
    likes: 500,
  };

  beforeEach(() => {
    CommandValidator.getInstance().reset();
    CommandSequencer.getInstance().setEpoch(1);

    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong: songA,
      isPlaying: true,
      playbackIntent: 'PLAYING',
      currentTime: 151, // 02:31
      duration: 240,
      queue: [songA, songB],
      queueIndex: 0,
      remoteDeviceName: null,
      deviceConnectionState: 'AVAILABLE',
      lastReceivedPlaybackRevision: 0,
    });
  });

  // ============================================================
  // TEST 1: Mobile Active, Laptop Connected -> Laptop Sends PAUSE
  // ============================================================
  it('TEST 1: Mobile active, Laptop connected -> Laptop PAUSE pauses Mobile and syncs state', async () => {
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: true,
      isPlaying: true,
      playbackIntent: 'PLAYING',
    });

    await CommandBus.getInstance().handleIncomingCommand({
      commandId: 'cmd_pause_test1',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_laptop',
      targetDeviceId: 'dev_mobile',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: { positionMs: 151000 }
    });

    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().playbackIntent).toBe('PAUSED');
  });

  // ============================================================
  // TEST 2: Laptop Active, Mobile Connected -> Mobile Sends PAUSE
  // ============================================================
  it('TEST 2: Laptop active, Mobile connected -> Mobile PAUSE pauses Laptop and syncs state', async () => {
    usePlayerStore.setState({
      deviceId: 'dev_laptop',
      activeDeviceId: 'dev_laptop',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: true,
      isPlaying: true,
      playbackIntent: 'PLAYING',
    });

    await CommandBus.getInstance().handleIncomingCommand({
      commandId: 'cmd_pause_test2',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_mobile',
      targetDeviceId: 'dev_laptop',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: { positionMs: 120000 }
    });

    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().playbackIntent).toBe('PAUSED');
  });

  // ============================================================
  // TEST 3: Mobile Active, Laptop Connected -> Laptop Sends NEXT
  // ============================================================
  it('TEST 3: Mobile active, Laptop connected -> Laptop NEXT advances Mobile queue atomically', async () => {
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: true,
      currentSong: songA,
      queue: [songA, songB],
      queueIndex: 0,
      isPlaying: true,
      playbackIntent: 'PLAYING',
    });

    await CommandBus.getInstance().handleIncomingCommand({
      commandId: 'cmd_next_test3',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_laptop',
      targetDeviceId: 'dev_mobile',
      type: 'NEXT',
      sentAt: Date.now(),
      payload: {}
    });

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe(songB.id);
    expect(state.currentSong?.title).toBe('Song B');
    expect(state.currentSong?.coverUrl).toBe('https://images.raagax.test/cover_b.jpg');
    expect(state.isPlaying).toBe(true);
    expect(state.queueIndex).toBe(1);
  });

  // ============================================================
  // TEST 4: Laptop Active, Mobile Connected -> Mobile Sends NEXT
  // ============================================================
  it('TEST 4: Laptop active, Mobile connected -> Mobile NEXT advances Laptop queue atomically', async () => {
    usePlayerStore.setState({
      deviceId: 'dev_laptop',
      activeDeviceId: 'dev_laptop',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: true,
      currentSong: songA,
      queue: [songA, songB],
      queueIndex: 0,
      isPlaying: true,
      playbackIntent: 'PLAYING',
    });

    await CommandBus.getInstance().handleIncomingCommand({
      commandId: 'cmd_next_test4',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_mobile',
      targetDeviceId: 'dev_laptop',
      type: 'NEXT',
      sentAt: Date.now(),
      payload: {}
    });

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe(songB.id);
    expect(state.isPlaying).toBe(true);
    expect(state.queueIndex).toBe(1);
  });

  // ============================================================
  // TEST 5: Mobile Active, Laptop Connected -> Laptop Sends SEEK
  // ============================================================
  it('TEST 5: Mobile active, Laptop connected -> Laptop SEEK updates authoritative position without spam', async () => {
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: true,
      currentTime: 30,
      isPlaying: true,
    });

    await CommandBus.getInstance().handleIncomingCommand({
      commandId: 'cmd_seek_test5',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_laptop',
      targetDeviceId: 'dev_mobile',
      type: 'SEEK',
      sentAt: Date.now(),
      payload: { positionMs: 185000, songId: songA.id }
    });

    expect(usePlayerStore.getState().currentTime).toBe(185);
  });

  // ============================================================
  // TEST 6: Laptop searches Song B -> PLAY (Mobile active)
  // ============================================================
  it('TEST 6: Laptop searching Song B routes PLAY to Mobile active renderer without local audio', async () => {
    usePlayerStore.setState({
      deviceId: 'dev_laptop',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: false,
    });

    const connectManager = ConnectManager.getInstance();
    const sendSpy = vi.spyOn(connectManager, 'dispatchPlaybackCommand').mockResolvedValue({ success: true });

    await usePlayerStore.getState().playSong(songB);

    expect(usePlayerStore.getState().currentSong?.id).toBe(songB.id);
    expect(sendSpy).toHaveBeenCalledWith('PLAY', expect.objectContaining({
      song: expect.objectContaining({ id: songB.id })
    }));
    expect(usePlayerStore.getState().isActiveDevice).toBe(false);
  });

  // ============================================================
  // TEST 7: Mobile searches Song C -> PLAY (Laptop active)
  // ============================================================
  it('TEST 7: Mobile searching Song C routes PLAY to Laptop active renderer without local audio', async () => {
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_laptop',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: false,
    });

    const connectManager = ConnectManager.getInstance();
    const sendSpy = vi.spyOn(connectManager, 'dispatchPlaybackCommand').mockResolvedValue({ success: true });

    await usePlayerStore.getState().playSong(songC);

    expect(usePlayerStore.getState().currentSong?.id).toBe(songC.id);
    expect(sendSpy).toHaveBeenCalledWith('PLAY', expect.objectContaining({
      song: expect.objectContaining({ id: songC.id })
    }));
    expect(usePlayerStore.getState().isActiveDevice).toBe(false);
  });

  // ============================================================
  // TEST 8: Immediate Command Dispatch during Valid Session
  // ============================================================
  it('TEST 8: Command validator accepts valid sequence and epoch during active session', () => {
    const validator = CommandValidator.getInstance();
    const valid = validator.validate({
      commandId: 'cmd_valid_1',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_laptop',
      targetDeviceId: 'dev_mobile',
      type: 'PLAY',
      sentAt: Date.now(),
      payload: {}
    });
    expect(valid).toBe(true);
  });

  // ============================================================
  // TEST 9: Disconnect -> Stale Duplicate/Stale Command is Rejected
  // ============================================================
  it('TEST 9: Stale command with duplicate commandId or lower sequence is rejected', () => {
    const validator = CommandValidator.getInstance();
    validator.validate({
      commandId: 'cmd_seq_10',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 10,
      sourceDeviceId: 'dev_laptop',
      targetDeviceId: 'dev_mobile',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: {}
    });

    // Older sequence 5 must be rejected
    const staleResult = validator.validate({
      commandId: 'cmd_seq_5',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 5,
      sourceDeviceId: 'dev_laptop',
      targetDeviceId: 'dev_mobile',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: {}
    });
    expect(staleResult).toBe(false);
  });

  // ============================================================
  // TEST 10: Reconnect -> Old Epoch/Generation Command is Rejected
  // ============================================================
  it('TEST 10: Reconnecting to epoch 2 rejects stale epoch 1 commands without affecting connection', () => {
    const validator = CommandValidator.getInstance();
    CommandSequencer.getInstance().setEpoch(2);

    // Old epoch 1 command arriving after reconnect
    const staleEpochResult = validator.validate({
      commandId: 'cmd_old_epoch_1',
      sessionId: 'sess_old',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_laptop',
      targetDeviceId: 'dev_mobile',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: {}
    });
    expect(staleEpochResult).toBe(false);
  });

  // ============================================================
  // TEST 11: Natural Track Transition Protection
  // ============================================================
  it('TEST 11: Natural track transition must NOT trigger intermediate pause or set isPlaying=false during loading', async () => {
    usePlayerStore.setState({
      isPlaying: true,
      playbackIntent: 'PLAYING',
      isActiveDevice: true
    });

    const { PlaybackService } = await import('@/lib/playback/PlaybackService');
    const service = PlaybackService.getInstance();
    
    // Set activeTag to A
    (service as any).activeTag = 'A';

    // Simulate active track transition in progress
    (service as any).isTransitioning = true;

    // Trigger browser pause event on activeTag
    (service as any).handleNativePlayState('A', false);

    // Verify that the store is STILL playing and the playback intent is still PLAYING
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().playbackIntent).toBe('PLAYING');

    // Simulate transition end / playback started
    (service as any).isTransitioning = false;
    (service as any).handleNativePlayState('A', true);

    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().playbackIntent).toBe('PLAYING');
  });
});

