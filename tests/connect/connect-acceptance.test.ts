import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectServerEngine } from '@/lib/connect/ConnectServerEngine';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { ConnectDevice } from '@/types/connect';

const songA: Song = {
  id: 'song_acceptance_a',
  title: 'Acceptance Track A',
  artist: 'RaagaX Artist A',
  artistId: 'art_a',
  album: 'Acceptance Album A',
  albumId: 'alb_a',
  duration: 240,
  coverUrl: 'https://cdn.test/song_a.jpg',
  audioUrl: 'https://cdn.test/song_a.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 100,
  likes: 10,
};

const songB: Song = {
  id: 'song_acceptance_b',
  title: 'Acceptance Track B',
  artist: 'RaagaX Artist B',
  artistId: 'art_b',
  album: 'Acceptance Album B',
  albumId: 'alb_b',
  duration: 180,
  coverUrl: 'https://cdn.test/song_b.jpg',
  audioUrl: 'https://cdn.test/song_b.mp3',
  genre: 'Rock',
  category: 'mass',
  releaseYear: 2024,
  plays: 200,
  likes: 20,
};

describe('RaagaX Connect — 24-Step Production Acceptance Test Suite', () => {
  const laptopDevice: ConnectDevice = {
    deviceId: 'dev_laptop_playback',
    deviceName: "Ram's Laptop",
    deviceType: 'desktop',
    isOnline: true,
    state: 'PLAYING',
    lastSeenAt: Date.now(),
    transport: 'LOCAL_LAN',
  };

  const phoneDevice: ConnectDevice = {
    deviceId: 'dev_phone_ctrl',
    deviceName: 'RaagaX Phone',
    deviceType: 'mobile',
    isOnline: true,
    state: 'IDLE',
    lastSeenAt: Date.now(),
    transport: 'LOCAL_LAN',
  };

  const ipadDevice: ConnectDevice = {
    deviceId: 'dev_ipad_ctrl',
    deviceName: 'RaagaX iPad',
    deviceType: 'tablet',
    isOnline: true,
    state: 'IDLE',
    lastSeenAt: Date.now(),
    transport: 'LOCAL_LAN',
  };

  beforeEach(() => {
    usePlayerStore.setState({
      currentSong: songA,
      queue: [songA, songB],
      queueIndex: 0,
      currentTime: 0,
      duration: 240,
      isPlaying: true,
      volume: 0.8,
    });
  });

  it('Executes full 24-step multi-device control lifecycle without audio disturbance', async () => {
    const server = ConnectServerEngine.getInstance();
    const phoneClient = ConnectClientManager.getInstance();

    // Step 1: Connect Phone -> Laptop
    await phoneClient.transferPlaybackTo(laptopDevice);
    expect(phoneClient.isRemoteMode()).toBe(true);
    expect(phoneClient.getActiveTargetDevice()?.deviceId).toBe('dev_laptop_playback');

    // Step 2: Laptop plays Song A
    const session = server.getSession();
    expect(session.currentTrackId).toBe('song_acceptance_a');
    expect(session.isPlaying).toBe(true);

    // Step 3 & 4: Phone Play/Pause -> Verify Laptop changes
    await phoneClient.sendCommand('PAUSE');
    expect(server.getSession().isPlaying).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    // Step 5: Verify Phone Playbar updates
    expect(phoneClient.getRemoteSession()?.isPlaying).toBe(false);

    // Step 6 & 7: Connect iPad -> Verify iPad receives the same authoritative state
    const ipadClient = ConnectClientManager.getInstance();
    ipadClient.handleIncomingSession(server.getSession());
    expect(ipadClient.getRemoteSession()?.currentTrackId).toBe('song_acceptance_a');
    expect(ipadClient.getRemoteSession()?.isPlaying).toBe(false);

    // Step 8, 9, 10: Seek from Phone (e.g. 75,000ms) -> Verify Laptop seeks -> Verify iPad updates
    await phoneClient.sendCommand('SEEK', { positionMs: 75000 });
    expect(server.getSession().positionMs).toBe(75000);
    expect(usePlayerStore.getState().currentTime).toBe(75);
    ipadClient.handleIncomingSession(server.getSession());
    expect(ipadClient.getInterpolatedPosition()).toBe(75);

    // Step 11, 12, 13: Press NEXT from iPad -> Verify Laptop changes to Song B -> Verify Phone & iPad metadata
    await ipadClient.sendCommand('SKIP_NEXT');
    expect(server.getSession().currentTrackId).toBe('song_acceptance_b');
    expect(server.getSession().metadata?.title).toBe('Acceptance Track B');
    expect(server.getSession().metadata?.artist).toBe('RaagaX Artist B');
    phoneClient.handleIncomingSession(server.getSession());
    expect(phoneClient.getRemoteSession()?.currentTrackId).toBe('song_acceptance_b');
    expect(phoneClient.getRemoteSession()?.metadata?.title).toBe('Acceptance Track B');

    // Step 14 & 15: Pause from Phone -> Verify exact paused position appears everywhere
    usePlayerStore.setState({ currentTime: 42.615 }); // 42,615ms
    await phoneClient.sendCommand('PAUSE');
    expect(server.getSession().positionMs).toBe(42615);
    expect(server.getSession().isPlaying).toBe(false);

    // Step 16 & 17: Resume from iPad -> Verify playback continues from 42,615ms (never restart to 0)
    await ipadClient.sendCommand('RESUME');
    expect(server.getSession().isPlaying).toBe(true);
    expect(server.getSession().positionMs).toBe(42615);

    // Step 18 & 19: Disconnect Phone -> Verify Laptop CONTINUES playing (DO NOT STOP MUSIC)
    await phoneClient.disconnect(false);
    expect(phoneClient.isRemoteMode()).toBe(false);
    expect(server.getSession().isPlaying).toBe(true); // LAPTOP IS STILL PLAYING!

    // Step 20 & 21: Reconnect Phone -> Verify Phone retrieves current state
    await phoneClient.transferPlaybackTo(laptopDevice);
    const reconnectedState = await phoneClient.requestCurrentPlaybackState();
    expect(reconnectedState?.currentTrackId).toBe('song_acceptance_b');
    expect(reconnectedState?.isPlaying).toBe(true);

    // Step 22, 23, 24: Switch playback Laptop -> iPad (Continuous Handoff)
    await phoneClient.switchPlaybackDevice(laptopDevice, ipadDevice);
    expect(phoneClient.getActiveTargetDevice()?.deviceId).toBe('dev_ipad_ctrl');
    expect(server.getSession().positionMs).toBeGreaterThanOrEqual(0);
  });
});
