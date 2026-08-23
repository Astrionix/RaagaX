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

describe('RAAGAX CONNECT — AUTHORITATIVE PLAYBACK STATE SYNCHRONIZATION', () => {
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
  // TEST A: Connection Does NOT Pause Active Playback
  // ============================================================
  it('TEST A: Connecting Laptop while Mobile is playing preserves active playback without pause or restart', async () => {
    const connectManager = ConnectManager.getInstance();
    vi.spyOn(connectManager, 'sendTargetedCommand').mockResolvedValue(undefined);

    // Initial: Mobile is playing Song A at 02:31
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().playbackIntent).toBe('PLAYING');
    expect(usePlayerStore.getState().isActiveDevice).toBe(true);

    // Laptop connects to Mobile
    usePlayerStore.setState({
      deviceConnectionState: 'CONNECTED',
      connectedDeviceId: 'dev_laptop',
      activeDeviceId: 'dev_mobile', // Mobile remains active renderer
      isActiveDevice: true,
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.isPlaying).toBe(true);
    expect(mobileState.playbackIntent).toBe('PLAYING');
    expect(mobileState.isActiveDevice).toBe(true);
    expect(mobileState.currentTime).toBe(151);
    expect(mobileState.currentSong?.id).toBe('HPY9vvdV');

    // Laptop receives the authoritative state snapshot
    const snapshot: RemotePlaybackState = {
      activeDeviceId: 'dev_mobile',
      activeDeviceName: 'This phone',
      songId: songA.id,
      songData: songA,
      isPlaying: true,
      positionMs: 151000,
      durationMs: 240000,
      volume: 1.0,
      isMuted: false,
      queue: [songA, songB],
      queueIndex: 0,
      serverTimestamp: Date.now(),
      epoch: 1,
      revision: 10,
    };

    // Simulate Laptop adopting remote snapshot
    usePlayerStore.setState({
      deviceId: 'dev_laptop',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: false, // Laptop is controller
    });

    PlaybackStateSync.getInstance().adoptRemoteState(snapshot);

    const updatedLaptop = usePlayerStore.getState();
    expect(updatedLaptop.currentSong?.title).toBe('Song A');
    expect(updatedLaptop.currentSong?.coverUrl).toBe('https://images.raagax.test/cover_a.jpg');
    expect(updatedLaptop.currentSong?.artist).toBe('Artist A');
    expect(updatedLaptop.currentTime).toBeCloseTo(151, 1);
    expect(updatedLaptop.isPlaying).toBe(true);
    expect(updatedLaptop.isActiveDevice).toBe(false); // Laptop must NOT produce local audio
  });

  // ============================================================
  // TEST B: Laptop Connects while Mobile is Paused
  // ============================================================
  it('TEST B: Connecting while Mobile is paused preserves paused state (no auto-play)', () => {
    usePlayerStore.setState({
      isPlaying: false,
      playbackIntent: 'PAUSED',
      currentTime: 45,
    });

    const snapshot: RemotePlaybackState = {
      activeDeviceId: 'dev_mobile',
      activeDeviceName: 'This phone',
      songId: songA.id,
      songData: songA,
      isPlaying: false,
      positionMs: 45000,
      durationMs: 240000,
      volume: 1.0,
      isMuted: false,
      queue: [songA, songB],
      queueIndex: 0,
      serverTimestamp: Date.now(),
      epoch: 1,
      revision: 11,
    };

    usePlayerStore.setState({
      deviceId: 'dev_laptop',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: false,
    });

    PlaybackStateSync.getInstance().adoptRemoteState(snapshot);

    const laptopState = usePlayerStore.getState();
    expect(laptopState.isPlaying).toBe(false);
    expect(laptopState.playbackIntent).toBe('PAUSED');
    expect(laptopState.currentTime).toBeCloseTo(45, 1);
  });

  // ============================================================
  // TEST C: Two-Way Control (Laptop pauses Mobile)
  // ============================================================
  it('TEST C: Laptop pressing PAUSE dispatches command, pauses Mobile, and updates state', async () => {
    // 1. Laptop issues PAUSE command
    const connectManager = ConnectManager.getInstance();
    vi.spyOn(connectManager, 'sendTargetedCommand').mockResolvedValue(undefined);

    // 2. Mobile receives PAUSE command in CommandBus
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: true,
      isPlaying: true,
      playbackIntent: 'PLAYING',
    });

    await CommandBus.getInstance().handleIncomingCommand({
      commandId: 'cmd_pause_1',
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
  // TEST D: Atomic Metadata Update on Track Change
  // ============================================================
  it('TEST D: Track change Song A -> Song B applies title, artist, artwork and duration atomically', () => {
    usePlayerStore.setState({
      deviceId: 'dev_laptop',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: false,
      currentSong: songA,
    });

    const nextState: RemotePlaybackState = {
      activeDeviceId: 'dev_mobile',
      activeDeviceName: 'This phone',
      songId: songB.id,
      songData: songB,
      isPlaying: true,
      positionMs: 0,
      durationMs: 180000,
      volume: 1.0,
      isMuted: false,
      queue: [songA, songB],
      queueIndex: 1,
      serverTimestamp: Date.now(),
      epoch: 1,
      revision: 12,
    };

    PlaybackStateSync.getInstance().adoptRemoteState(nextState);

    const updated = usePlayerStore.getState();
    // Verify complete atomicity: no mixed metadata
    expect(updated.currentSong?.id).toBe('7mV2egOd');
    expect(updated.currentSong?.title).toBe('Song B');
    expect(updated.currentSong?.artist).toBe('Artist B');
    expect(updated.currentSong?.album).toBe('Album B');
    expect(updated.currentSong?.coverUrl).toBe('https://images.raagax.test/cover_b.jpg');
    expect(updated.duration).toBe(180);
    expect(updated.queueIndex).toBe(1);
  });

  // ============================================================
  // TEST E: Search & Play from Remote Controller
  // ============================================================
  it('TEST E: Laptop searching Song C and playing routes command to Mobile active renderer without local audio', async () => {
    // Laptop is controller, Mobile is active audio renderer
    usePlayerStore.setState({
      deviceId: 'dev_laptop',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: false,
    });

    const connectManager = ConnectManager.getInstance();
    const sendSpy = vi.spyOn(connectManager, 'dispatchPlaybackCommand').mockResolvedValue({ success: true });

    // Laptop calls playSong(songC)

    await usePlayerStore.getState().playSong(songC);

    // Controller updates optimistic preview & dispatches command
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_c_search');
    expect(sendSpy).toHaveBeenCalledWith('PLAY', expect.objectContaining({
      song: expect.objectContaining({ id: 'song_c_search' })
    }));

    // Laptop remains controller (isActiveDevice: false) and does NOT start local audio
    expect(usePlayerStore.getState().isActiveDevice).toBe(false);
  });
});
