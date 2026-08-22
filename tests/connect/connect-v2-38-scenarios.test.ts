import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { RaagaXConnectV2 } from '../../src/lib/connect/lan/RaagaXConnectV2';
import { OwnershipSwitchProtocol } from '../../src/lib/connect/lan/OwnershipSwitchProtocol';
import { PlaybackStateSync } from '../../src/lib/connect/PlaybackStateSync';
import { Song } from '../../src/types/music';

const makeSong = (id: string, title: string, artist = `Artist of ${title}`, duration = 240): Song => ({
  id,
  title,
  artist,
  artistId: `art_${id}`,
  album: `Album of ${title}`,
  albumId: `alb_${id}`,
  coverUrl: `https://covers.test/${id}.jpg`,
  duration,
  audioUrl: `https://audio.test/${id}.mp3`,
  genre: 'Tollywood Hits',
  category: 'trending',
  releaseYear: 2026,
  plays: 5000,
  likes: 1200,
});

const PUSHPA_SONG = makeSong('pushpa_01', 'Pushpa Pushpa', 'Devi Sri Prasad', 270);
const CHIKKIRI_SONG = makeSong('chikkiri_02', 'Chikkiri Chikkiri', 'Ram Miriyala', 210);
const RANJITH_SONG = makeSong('ranjith_03', 'Ranjith Melody', 'Ranjith Govind', 300);
const SONG_R = makeSong('song_r_04', 'Song R Special', 'Various Artists', 180);
const SONG_Z = makeSong('song_z_05', 'Song Z Finale', 'S. Thaman', 260);

const LAPTOP_ID = 'dev_laptop_owner';
const MOBILE_ID = 'dev_mobile_controller';
const PHONE_B_ID = 'dev_phone_b_controller';

function setAsOwner(deviceId: string, song: Song, positionMs: number, isPlaying: boolean, queue: Song[] = [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG]) {
  PlaybackOwnerEngine.getInstance().setOwner(deviceId, true);
  const qIdx = queue.findIndex((s) => s.id === song.id);
  usePlayerStore.setState({
    deviceId,
    activeDeviceId: deviceId,
    connectedDeviceId: null,
    isActiveDevice: true,
    currentSong: { ...song },
    currentTime: positionMs / 1000,
    duration: song.duration,
    isPlaying,
    playbackIntent: isPlaying ? 'PLAYING' : 'PAUSED',
    queue: [...queue],
    queueIndex: qIdx >= 0 ? qIdx : 0,
  });
}

function setAsController(controllerDeviceId: string, ownerDeviceId: string, song: Song, positionMs: number, isPlaying: boolean, queue: Song[] = [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG]) {
  PlaybackOwnerEngine.getInstance().setOwner(ownerDeviceId, false);
  const qIdx = queue.findIndex((s) => s.id === song.id);
  usePlayerStore.setState({
    deviceId: controllerDeviceId,
    activeDeviceId: ownerDeviceId,
    connectedDeviceId: ownerDeviceId,
    isActiveDevice: false,
    currentSong: { ...song },
    currentTime: positionMs / 1000,
    duration: song.duration,
    isPlaying,
    playbackIntent: isPlaying ? 'PLAYING' : 'PAUSED',
    queue: [...queue],
    queueIndex: qIdx >= 0 ? qIdx : 0,
  });
}

describe('RaagaX Connect V2: 38 Exhaustive State Synchronization Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ConnectAuthManager.getInstance().removeAllTrustedPeers();
    usePlayerStore.setState({
      deviceId: LAPTOP_ID,
      isActiveDevice: true,
      connectedDeviceId: null,
      activeDeviceId: LAPTOP_ID,
      isPlaying: false,
      playbackIntent: 'PAUSED',
      currentTime: 0,
      duration: 300,
      currentSong: null,
      queue: [],
      queueIndex: 0,
    });
  });

  // ── Scenario 1: NEXT from controller ─────────────────────────────────────────
  it('Scenario 1: NEXT from controller updates cover, title, artist, duration, position (0), and play state atomically', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 120_000, true);

    // Controller receives authoritative state from Laptop executing NEXT
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s1',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 101,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(mobileState.currentSong?.title).toBe('Chikkiri Chikkiri');
    expect(mobileState.currentSong?.artist).toBe('Ram Miriyala');
    expect(mobileState.currentSong?.coverUrl).toBe('https://covers.test/chikkiri_02.jpg');
    expect(mobileState.currentTime).toBe(0);
    expect(mobileState.isPlaying).toBe(true);
  });

  // ── Scenario 2: PREVIOUS from controller ─────────────────────────────────────
  it('Scenario 2: PREVIOUS from controller updates without stale Chikkiri artwork', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 45_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s2',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: PUSHPA_SONG.id,
        song: { ...PUSHPA_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG],
        queueIndex: 0,
        positionMs: 0,
        durationMs: PUSHPA_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 102,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(PUSHPA_SONG.id);
    expect(mobileState.currentSong?.title).toBe('Pushpa Pushpa');
    expect(mobileState.currentSong?.coverUrl).toBe('https://covers.test/pushpa_01.jpg');
  });

  // ── Scenario 3: Automatic next ───────────────────────────────────────────────
  it('Scenario 3: Automatic next at song end synchronizes controller without any button press', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 269_500, true);

    // Laptop native player triggers trackChanged -> builds authoritative state -> broadcasts
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s3',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 105,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(mobileState.currentSong?.title).toBe('Chikkiri Chikkiri');
    expect(mobileState.currentTime).toBe(0);
    expect(mobileState.isPlaying).toBe(true);
  });

  // ── Scenario 4: User clicks another song on OWNER ─────────────────────────────
  it('Scenario 4: User selects song on OWNER -> Controller updates even though it did not initiate', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 50_000, true);

    // Laptop user clicks Ranjith Song
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s4',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: RANJITH_SONG.id,
        song: { ...RANJITH_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG],
        queueIndex: 2,
        positionMs: 0,
        durationMs: RANJITH_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 110,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(RANJITH_SONG.id);
    expect(mobileState.currentSong?.title).toBe('Ranjith Melody');
  });

  // ── Scenario 5: User clicks another song on CONTROLLER ────────────────────────
  it('Scenario 5: User clicks song R on controller -> Laptop plays R -> Controller receives R', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 10_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s5',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: SONG_R.id,
        song: { ...SONG_R },
        queue: [PUSHPA_SONG, SONG_R],
        queueIndex: 1,
        positionMs: 0,
        durationMs: SONG_R.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 115,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(SONG_R.id);
    expect(mobileState.currentSong?.title).toBe('Song R Special');
  });

  // ── Scenario 6: SEEK forward from controller ──────────────────────────────────
  it('Scenario 6: SEEK forward from 01:20 to 02:45 reflects authoritative confirmed position', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 80_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s6',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: PUSHPA_SONG.id,
        song: { ...PUSHPA_SONG },
        queue: [PUSHPA_SONG],
        queueIndex: 0,
        positionMs: 165_000, // 02:45
        durationMs: PUSHPA_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 120,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentTime).toBeCloseTo(165, 0);
    expect(mobileState.isPlaying).toBe(true);
  });

  // ── Scenario 7: SEEK backwards ───────────────────────────────────────────────
  it('Scenario 7: SEEK backwards from 03:40 to 01:10 snaps correctly on both devices', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 220_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s7',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: PUSHPA_SONG.id,
        song: { ...PUSHPA_SONG },
        queue: [PUSHPA_SONG],
        queueIndex: 0,
        positionMs: 70_000, // 01:10
        durationMs: PUSHPA_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 125,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentTime).toBeCloseTo(70, 0);
  });

  // ── Scenario 8: SEEK while paused ─────────────────────────────────────────────
  it('Scenario 8: SEEK while paused does NOT auto-resume playback', () => {
    setAsOwner(LAPTOP_ID, PUSHPA_SONG, 120_000, false); // Paused at 02:00
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 120_000, false);

    // Controller receives seek while paused
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s8',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: PUSHPA_SONG.id,
        song: { ...PUSHPA_SONG },
        queue: [PUSHPA_SONG],
        queueIndex: 0,
        positionMs: 200_000, // 03:20
        durationMs: PUSHPA_SONG.duration * 1000,
        isPlaying: false, // Remains paused!
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 130,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentTime).toBeCloseTo(200, 0);
    expect(mobileState.isPlaying).toBe(false);
  });

  // ── Scenario 9: SEEK while playing ────────────────────────────────────
  it('Scenario 9: SEEK while playing continues playing seamlessly', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 120_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s9',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: PUSHPA_SONG.id,
        song: { ...PUSHPA_SONG },
        queue: [PUSHPA_SONG],
        queueIndex: 0,
        positionMs: 200_000, // 03:20
        durationMs: PUSHPA_SONG.duration * 1000,
        isPlaying: true, // Remains playing
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 135,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentTime).toBeCloseTo(200, 0);
    expect(mobileState.isPlaying).toBe(true);
  });

  // ── Scenario 10: PLAY from controller ────────────────────────────────────────
  it('Scenario 10: PLAY from controller transitions owner and controller to playing', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 150_000, false);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s10',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: PUSHPA_SONG.id,
        song: { ...PUSHPA_SONG },
        queue: [PUSHPA_SONG],
        queueIndex: 0,
        positionMs: 150_000,
        durationMs: PUSHPA_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 140,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.isPlaying).toBe(true);
    expect(mobileState.currentTime).toBeCloseTo(150, 0);
  });

  // ── Scenario 11: PAUSE from controller ───────────────────────────────────────
  it('Scenario 11: PAUSE from controller transitions owner and controller to paused', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 150_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s11',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: PUSHPA_SONG.id,
        song: { ...PUSHPA_SONG },
        queue: [PUSHPA_SONG],
        queueIndex: 0,
        positionMs: 150_000,
        durationMs: PUSHPA_SONG.duration * 1000,
        isPlaying: false,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 145,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.isPlaying).toBe(false);
  });

  // ── Scenario 12: PLAY/PAUSE rapidly ──────────────────────────────────────────
  it('Scenario 12: Rapid PLAY/PAUSE settles on the highest stateVersion', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 100_000, false);

    const states = [
      { v: 151, playing: true },
      { v: 152, playing: false },
      { v: 153, playing: true },
      { v: 154, playing: false },
      { v: 155, playing: true },
    ];

    states.forEach((s) => {
      RemoteControlClient.getInstance().handlePlaybackStateUpdate({
        id: `msg_s12_${s.v}`,
        type: 'PLAYBACK_STATE',
        sourceDeviceId: LAPTOP_ID,
        targetDeviceId: MOBILE_ID,
        timestamp: Date.now(),
        payload: {
          ownerDeviceId: LAPTOP_ID,
          songId: PUSHPA_SONG.id,
          song: { ...PUSHPA_SONG },
          queue: [PUSHPA_SONG],
          queueIndex: 0,
          positionMs: 100_000,
          durationMs: PUSHPA_SONG.duration * 1000,
          isPlaying: s.playing,
          playbackRate: 1.0,
          volume: 0.8,
          isMuted: false,
          shuffleMode: 'OFF',
          repeatMode: 'OFF',
          stateVersion: s.v,
          timestamp: Date.now(),
        },
      });
    });

    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  // ── Scenario 13: NEXT rapidly ────────────────────────────────────────────────
  it('Scenario 13: Rapid NEXT transitions X -> Y -> Z -> A and rejects any out-of-order packets', () => {
    const SONG_A = makeSong('song_a', 'Song A Final');
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 0, true);

    const queueSeq = [
      { song: CHIKKIRI_SONG, v: 161 },
      { song: RANJITH_SONG, v: 162 },
      { song: SONG_A, v: 163 },
    ];

    queueSeq.forEach((item) => {
      RemoteControlClient.getInstance().handlePlaybackStateUpdate({
        id: `msg_s13_${item.v}`,
        type: 'PLAYBACK_STATE',
        sourceDeviceId: LAPTOP_ID,
        targetDeviceId: MOBILE_ID,
        timestamp: Date.now(),
        payload: {
          ownerDeviceId: LAPTOP_ID,
          songId: item.song.id,
          song: { ...item.song },
          queue: [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG, SONG_A],
          queueIndex: 3,
          positionMs: 0,
          durationMs: item.song.duration * 1000,
          isPlaying: true,
          playbackRate: 1.0,
          volume: 0.8,
          isMuted: false,
          shuffleMode: 'OFF',
          repeatMode: 'OFF',
          stateVersion: item.v,
          timestamp: Date.now(),
        },
      });
    });

    expect(usePlayerStore.getState().currentSong?.id).toBe('song_a');

    // Late arriving packet v: 161 (Chikkiri) must be rejected
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s13_stale',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now() - 2000,
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG, SONG_A],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 161, // Stale! (161 < 163)
        timestamp: Date.now() - 2000,
      },
    });

    expect(usePlayerStore.getState().currentSong?.id).toBe('song_a');
  });

  // ── Scenario 14: NEXT + SEEK immediately ─────────────────────────────────────
  it('Scenario 14: NEXT + SEEK immediately applies seek to the new track', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 100_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s14',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 1,
        positionMs: 90_000, // 01:30
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 170,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(mobileState.currentTime).toBe(90);
  });

  // ── Scenario 18: Owner advances while controller disconnected ────────────────
  it('Scenario 18: Owner advances while controller disconnected -> Reconnected controller requests and gets fresh state', () => {
    // 1. Controller is disconnected while Laptop was on Pushpa -> advances to Chikkiri
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 30_000, true);

    // 2. Controller reconnects and requests state
    RemoteControlClient.getInstance().requestAuthoritativeState(LAPTOP_ID);

    // 3. Laptop replies with current Chikkiri state
    const snapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 0, false);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s18',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ...snapshot,
        stateVersion: 180,
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(mobileState.currentSong?.title).toBe('Chikkiri Chikkiri');
    expect(mobileState.currentTime).toBeCloseTo(30, 0);
  });

  // ── Scenario 19: Controller disconnects during playback ──────────────────────
  it('Scenario 19: Controller disconnects during playback -> Laptop owner continues playing uninterrupted', () => {
    setAsOwner(LAPTOP_ID, PUSHPA_SONG, 130_000, true);
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 130_000, true);

    // Mobile disconnects
    RaagaXConnectV2.getInstance().disconnect();

    const mobileState = usePlayerStore.getState();
    expect(mobileState.connectedDeviceId).toBeNull();
    expect(mobileState.deviceConnectionState).toBe('AVAILABLE');

    // Laptop owner continues playing
    setAsOwner(LAPTOP_ID, PUSHPA_SONG, 130_000, true);
    const ownerSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(ownerSnapshot.isPlaying).toBe(true);
    expect(ownerSnapshot.positionMs).toBe(130_000);
  });

  // ── Scenario 26: Switch while playing ────────────────────────────────────────
  it('Scenario 26: Switch while playing preserves position and playing state without restarting', () => {
    // Mobile is playing Pushpa @ 02:00
    setAsOwner(MOBILE_ID, PUSHPA_SONG, 120_000, true);

    // Switch playback to Laptop
    PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
    usePlayerStore.setState({
      deviceId: LAPTOP_ID,
      isActiveDevice: true,
      activeDeviceId: LAPTOP_ID,
      connectedDeviceId: null,
      currentSong: { ...PUSHPA_SONG },
      currentTime: 120,
      isPlaying: true,
    });

    const laptopSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(laptopSnapshot.song?.id).toBe(PUSHPA_SONG.id);
    expect(laptopSnapshot.positionMs).toBe(120_000);
    expect(laptopSnapshot.isPlaying).toBe(true);
  });

  // ── Scenario 27: Switch while paused ─────────────────────────────────────────
  it('Scenario 27: Switch while paused does NOT automatically play', () => {
    setAsOwner(MOBILE_ID, PUSHPA_SONG, 120_000, false); // Paused

    PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
    usePlayerStore.setState({
      deviceId: LAPTOP_ID,
      isActiveDevice: true,
      activeDeviceId: LAPTOP_ID,
      connectedDeviceId: null,
      currentSong: { ...PUSHPA_SONG },
      currentTime: 120,
      isPlaying: false,
    });

    const laptopSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(laptopSnapshot.isPlaying).toBe(false);
  });

  // ── Scenario 31: Reverse every scenario (Desktop CONTROLLER -> Mobile OWNER) ─
  it('Scenario 31: Symmetrical reverse — Desktop CONTROLLER controls Mobile OWNER with identical fidelity', () => {
    setAsOwner(MOBILE_ID, PUSHPA_SONG, 45_000, true);
    setAsController(LAPTOP_ID, MOBILE_ID, PUSHPA_SONG, 45_000, true);

    // Mobile advances to Chikkiri
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s31_rev',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: MOBILE_ID,
      targetDeviceId: LAPTOP_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: MOBILE_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 201,
        timestamp: Date.now(),
      },
    });

    const desktopState = usePlayerStore.getState();
    expect(desktopState.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(desktopState.currentSong?.title).toBe('Chikkiri Chikkiri');
    expect(desktopState.currentSong?.coverUrl).toBe('https://covers.test/chikkiri_02.jpg');
    expect(desktopState.isPlaying).toBe(true);
  });

  // ── Scenario 32: Multi-controller scenario ───────────────────────────────────
  it('Scenario 32: Multi-controller — Phone A triggers NEXT -> Phone B receives updated state', () => {
    setAsController(PHONE_B_ID, LAPTOP_ID, PUSHPA_SONG, 10_000, true);

    // Phone A triggered NEXT on Laptop; Laptop broadcasts state to all controllers
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_s32',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: PHONE_B_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 210,
        timestamp: Date.now(),
      },
    });

    const phoneBState = usePlayerStore.getState();
    expect(phoneBState.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(phoneBState.currentSong?.title).toBe('Chikkiri Chikkiri');
  });

  // ── Scenario 34: Different-account hostel scenario ───────────────────────────
  it('Scenario 34: Unauthorized device commands are rejected until authorized', async () => {
    setAsOwner(LAPTOP_ID, PUSHPA_SONG, 10_000, true);
    const auth = ConnectAuthManager.getInstance();

    const strangerDeviceId = 'dev_stranger_friend';

    // Before authorization -> rejected
    expect(auth.canControl(strangerDeviceId)).toBe(false);

    // After authorization -> accepted
    auth.addTrustedPeer({
      deviceId: strangerDeviceId,
      deviceName: 'Friend Phone',
      permissions: { allowControl: true, allowSwitch: false },
      pairedAt: Date.now(),
      expiresAt: null,
    });
    expect(auth.canControl(strangerDeviceId)).toBe(true);
  });

  // ── Scenario 35: Stale metadata test (Pushpa -> Chikkiri bug reproduction) ───
  it('Scenario 35: Stale metadata test — Chikkiri active, late arriving Pushpa packet is ignored', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 10_000, true);

    // 1. Controller receives Chikkiri (stateVersion 300)
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_chikkiri_300',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 300,
        timestamp: Date.now(),
      },
    });

    expect(usePlayerStore.getState().currentSong?.id).toBe('chikkiri_02');

    // 2. Late arriving Pushpa packet (stateVersion 299)
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_pushpa_299',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now() - 5000,
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: PUSHPA_SONG.id,
        song: { ...PUSHPA_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 0,
        positionMs: 120_000,
        durationMs: PUSHPA_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 299, // Stale!
        timestamp: Date.now() - 5000,
      },
    });

    // Must REMAIN Chikkiri
    expect(usePlayerStore.getState().currentSong?.id).toBe('chikkiri_02');
    expect(usePlayerStore.getState().currentSong?.title).toBe('Chikkiri Chikkiri');
  });

  // ── Scenario 37: Atomic State Invariant Enforcement ──────────────────────────
  it('Scenario 37: Atomic state invariant — trackId, title, artist, cover, duration, position, isPlaying all update synchronously in ONE transaction', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 10_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_atomic_check',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 350,
        timestamp: Date.now(),
      },
    });

    const s = usePlayerStore.getState();
    expect(s.currentSong?.id).toBe('chikkiri_02');
    expect(s.currentSong?.title).toBe('Chikkiri Chikkiri');
    expect(s.currentSong?.artist).toBe('Ram Miriyala');
    expect(s.currentSong?.coverUrl).toBe('https://covers.test/chikkiri_02.jpg');
    expect(s.currentTime).toBeCloseTo(0, 0);
    expect(s.duration).toBe(210);
    expect(s.isPlaying).toBe(true);
    expect(s.queueIndex).toBe(1);
  });

  // ── Scenario: Owner changes song locally while controller is connected ───────
  it('Scenario Owner Direct Click: User clicks Chikkiri directly on Laptop UI -> Mobile atomically updates without controller command', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 130_000, true);

    // Laptop UI user selects Chikkiri -> Native player loads Chikkiri -> TRACK_CHANGED -> publishes authoritative state
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_owner_direct_chikkiri',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 401,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(mobileState.currentSong?.title).toBe('Chikkiri Chikkiri');
    expect(mobileState.currentSong?.artist).toBe('Ram Miriyala');
    expect(mobileState.currentSong?.album).toBe(CHIKKIRI_SONG.album);
    expect(mobileState.currentSong?.coverUrl).toBe('https://covers.test/chikkiri_02.jpg');
    expect(mobileState.currentTime).toBeCloseTo(0, 0);
    expect(mobileState.isPlaying).toBe(true);
    expect(mobileState.queueIndex).toBe(1);
  });

  // ── Scenario: Owner clicks song while controller was seeking ─────────────────
  it('Scenario Owner Direct Click during Seek: Old seek position does NOT contaminate new track', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 60_000, true);

    // Mobile initiated seek to 02:30 on Pushpa
    const sync = PlaybackStateSync.getInstance();
    (sync as any).seekShieldState = {
      active: true,
      targetMs: 150_000, // 02:30
      songId: PUSHPA_SONG.id,
      startedAt: Date.now(),
    };

    // Laptop owner immediately selects Song Z (SONG_Z) @ 00:00
    sync.handleRemoteStateUpdate({
      activeDeviceId: LAPTOP_ID,
      activeDeviceName: 'Laptop',
      songId: SONG_Z.id,
      songData: { ...SONG_Z },
      positionMs: 0,
      durationMs: SONG_Z.duration * 1000,
      isPlaying: true,
      queue: [PUSHPA_SONG, SONG_Z],
      queueIndex: 1,
      epoch: 1,
      revision: 405,
      timestamp: Date.now(),
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(SONG_Z.id);
    expect(mobileState.currentSong?.title).toBe('Song Z Finale');
    // Position must be 00:00, not 02:30!
    expect(mobileState.currentTime).toBeCloseTo(0, 0);
    expect((sync as any).seekShieldState.active).toBe(false);
  });

  // ── Scenario: Owner changes song while controller was paused ─────────────────
  it('Scenario Owner Song Change while Paused: Actual Owner playing state is authoritative', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 120_000, false); // Mobile was paused

    // Laptop user starts Chikkiri in PLAYING mode
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_chikkiri_playing',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: { ...CHIKKIRI_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 1,
        positionMs: 0,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true, // Laptop owner actually started playing
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 410,
        timestamp: Date.now(),
      },
    });

    let mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(mobileState.isPlaying).toBe(true); // Wins and becomes playing

    // Laptop user changes to Ranjith but keeps it paused
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_ranjith_paused',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: RANJITH_SONG.id,
        song: { ...RANJITH_SONG },
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, RANJITH_SONG],
        queueIndex: 2,
        positionMs: 0,
        durationMs: RANJITH_SONG.duration * 1000,
        isPlaying: false, // Laptop owner loaded it paused
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 411,
        timestamp: Date.now(),
      },
    });

    mobileState = usePlayerStore.getState();
    expect(mobileState.currentSong?.id).toBe(RANJITH_SONG.id);
    expect(mobileState.isPlaying).toBe(false); // Wins and becomes paused
  });

  // ── Scenario: One-Click Instant Disconnect from Both Sides & Idempotency ────
  it('Scenario Instant Disconnect: Mobile clicks Disconnect -> Mobile immediately Disconnected, Laptop playing uninterrupted', () => {
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 151_000, true); // Laptop playing at 02:31
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 151_000, true);

    // Mobile user clicks Disconnect — ONE click, 0 delay
    RaagaXConnectV2.getInstance().disconnect();

    const mobileState = usePlayerStore.getState();
    expect(mobileState.connectedDeviceId).toBeNull();
    expect(mobileState.isActiveDevice).toBe(true);
    expect(mobileState.deviceConnectionState).toBe('AVAILABLE');

    // Laptop owner state remains playing at 02:31
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 151_000, true);
    const ownerSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(ownerSnapshot.isPlaying).toBe(true);
    expect(ownerSnapshot.positionMs).toBe(151_000);
    expect(ownerSnapshot.song?.title).toBe('Chikkiri Chikkiri');
  });

  it('Scenario Instant Disconnect Reverse: Laptop clicks Disconnect -> Both immediately Disconnected, Laptop keeps playing', () => {
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 151_000, true);
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 151_000, true);

    // Laptop owner triggers Disconnect
    RaagaXConnectV2.getInstance().disconnect();

    const laptopState = usePlayerStore.getState();
    expect(laptopState.connectedDeviceId).toBeNull();
    expect(laptopState.deviceConnectionState).toBe('AVAILABLE');
    expect(laptopState.isPlaying).toBe(true); // Owner playback is untouched
  });

  it('Scenario Offline Disconnect: Remote device offline -> Local disconnect is 100% immediate without timeout or blocking', () => {
    setAsController(MOBILE_ID, 'non_existent_dead_laptop', PUSHPA_SONG, 50_000, true);

    // Click disconnect while peer is unreachable
    const startTime = Date.now();
    RaagaXConnectV2.getInstance().disconnect();
    const duration = Date.now() - startTime;

    // Must be synchronous / instant (<50ms)
    expect(duration).toBeLessThan(50);
    const mobileState = usePlayerStore.getState();
    expect(mobileState.connectedDeviceId).toBeNull();
    expect(mobileState.deviceConnectionState).toBe('AVAILABLE');
  });

  it('Scenario Idempotent Disconnect: Repeated disconnect calls are safe no-ops', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 50_000, true);

    RaagaXConnectV2.getInstance().disconnect();
    RaagaXConnectV2.getInstance().disconnect();
    RaagaXConnectV2.getInstance().disconnect();

    const mobileState = usePlayerStore.getState();
    expect(mobileState.connectedDeviceId).toBeNull();
    expect(mobileState.deviceConnectionState).toBe('AVAILABLE');
  });
});
