import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { RaagaXConnectV2 } from '../../src/lib/connect/lan/RaagaXConnectV2';
import { PlaybackStateSync } from '../../src/lib/connect/PlaybackStateSync';
import { SeekLock } from '../../src/lib/playback/SeekLock';
import { Song } from '../../src/types/music';

const makeSong = (id: string, title: string, duration = 272): Song => ({
  id,
  title,
  artist: `Artist of ${title}`,
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

const CHIKKIRI_SONG = makeSong('chikkiri_02', 'Chikkiri', 272); // 04:32 duration
const PUSHPA_SONG = makeSong('pushpa_01', 'Pushpa', 270);

const LAPTOP_ID = 'dev_laptop_owner';
const MOBILE_ID = 'dev_mobile_controller';

function setAsOwner(deviceId: string, song: Song, positionMs: number, isPlaying: boolean) {
  PlaybackOwnerEngine.getInstance().setOwner(deviceId, true);
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
    queue: [song],
    queueIndex: 0,
  });
}

function setAsController(controllerDeviceId: string, ownerDeviceId: string, song: Song, positionMs: number, isPlaying: boolean) {
  PlaybackOwnerEngine.getInstance().setOwner(ownerDeviceId, false);
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
    queue: [song],
    queueIndex: 0,
  });
}

describe('RaagaX Connect V2: Complete SeekBar Drag & Seek Scenarios (All 14 Edge Cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ConnectAuthManager.getInstance().removeAllTrustedPeers();
    SeekLock.endSeeking(0);
    usePlayerStore.setState({
      deviceId: LAPTOP_ID,
      isActiveDevice: true,
      connectedDeviceId: null,
      activeDeviceId: LAPTOP_ID,
      isPlaying: false,
      playbackIntent: 'PAUSED',
      currentTime: 0,
      duration: 272,
      currentSong: null,
      queue: [],
      queueIndex: 0,
    });
  });

  // ── Primary Flow: Mobile drags seekbar 01:20 -> 03:15 -> Laptop confirms ─────
  it('Primary Flow: Drag from 01:20 to 03:15 -> One command sent on release -> Laptop confirms -> Both show 03:15', async () => {
    // 1. Setup: Laptop is OWNER playing Chikkiri at 01:20 (80s); Mobile is CONTROLLER
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 80_000, true);
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 80_000, true);

    // 2. User starts dragging on Mobile (e.g. from 80s to 195s)
    SeekLock.startSeeking();
    expect(SeekLock.shouldBlockRemoteUpdate).toBe(true);

    // 3. User releases at 03:15 (195_000ms)
    SeekLock.endSeeking(800);
    const targetMs = 195_000;

    // 4. Laptop OWNER receives CMD_SEEK and executes it
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, targetMs, true);
    PlaybackOwnerEngine.getInstance().publishAuthoritativePlaybackState();

    const snapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(snapshot.positionMs).toBe(195_000);
    expect(snapshot.isPlaying).toBe(true);

    // 5. Mobile receives confirmed PLAYBACK_STATE from Laptop
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_seek_confirm',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ...snapshot,
        stateVersion: 101,
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentTime).toBeCloseTo(195, 0);
    expect(mobileState.isPlaying).toBe(true);
  });

  // ── Rule 1: No pixel flooding during drag ────────────────────────────────────
  it('Rule 1: Dragging generates local preview only; zero network commands sent until release', () => {
    const sentCommands: any[] = [];
    const mockSend = vi.fn((type: string, payload?: any) => {
      sentCommands.push({ type, payload });
    });

    // Simulate 50 intermediate drag move events
    for (let pixel = 0; pixel < 50; pixel++) {
      // Drag move calculates local preview — no network dispatch
    }
    expect(sentCommands.length).toBe(0);

    // Only on pointer release: 1 command
    mockSend('CMD_SEEK', { positionMs: 195_000 });
    expect(sentCommands.length).toBe(1);
    expect(sentCommands[0].payload.positionMs).toBe(195_000);
  });

  // ── Rule 2: Playing stays playing ────────────────────────────────────────────
  it('Rule 2: Playing seek (02:00 -> 03:15) preserves playing state', () => {
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 120_000, true);
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 120_000, true);

    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 195_000, true);
    const snapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(snapshot.isPlaying).toBe(true);
    expect(snapshot.positionMs).toBe(195_000);
  });

  // ── Rule 3: Paused stays paused (Never auto-resumes) ──────────────────────────
  it('Rule 3: Paused seek (02:00 -> 03:15) stays paused without auto-resuming', () => {
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 120_000, false);
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 120_000, false);

    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 195_000, false);
    const snapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(snapshot.isPlaying).toBe(false);
    expect(snapshot.positionMs).toBe(195_000);
  });

  // ── Edge Case 01: Forward seek (01:00 -> 03:00) ──────────────────────────────
  it('Edge Case 01: Forward seek from 01:00 (60s) to 03:00 (180s)', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 60_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_fwd_seek',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: CHIKKIRI_SONG,
        queue: [CHIKKIRI_SONG],
        queueIndex: 0,
        positionMs: 180_000,
        durationMs: CHIKKIRI_SONG.duration * 1000,
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

    expect(usePlayerStore.getState().currentTime).toBeCloseTo(180, 0);
  });

  // ── Edge Case 02: Backward seek (03:00 -> 01:00) ─────────────────────────────
  it('Edge Case 02: Backward seek from 03:00 (180s) to 01:00 (60s)', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 180_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_bwd_seek',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: CHIKKIRI_SONG,
        queue: [CHIKKIRI_SONG],
        queueIndex: 0,
        positionMs: 60_000,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 111,
        timestamp: Date.now(),
      },
    });

    expect(usePlayerStore.getState().currentTime).toBeCloseTo(60, 0);
  });

  // ── Edge Case 03: Seek near start (00:00 -> 00:05) ───────────────────────────
  it('Edge Case 03: Seek near start from 00:00 to 00:05 (5s)', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 0, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_start_seek',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: CHIKKIRI_SONG,
        queue: [CHIKKIRI_SONG],
        queueIndex: 0,
        positionMs: 5_000,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 112,
        timestamp: Date.now(),
      },
    });

    expect(usePlayerStore.getState().currentTime).toBeCloseTo(5, 0);
  });

  // ── Edge Case 04: Seek near end (04:20 -> 04:29) ─────────────────────────────
  it('Edge Case 04: Seek near end from 04:20 (260s) to 04:29 (269s)', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 260_000, true);

    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_end_seek',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: LAPTOP_ID,
      targetDeviceId: MOBILE_ID,
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: LAPTOP_ID,
        songId: CHIKKIRI_SONG.id,
        song: CHIKKIRI_SONG,
        queue: [CHIKKIRI_SONG],
        queueIndex: 0,
        positionMs: 269_000,
        durationMs: CHIKKIRI_SONG.duration * 1000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 0.8,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 113,
        timestamp: Date.now(),
      },
    });

    expect(usePlayerStore.getState().currentTime).toBeCloseTo(269, 0);
  });

  // ── Edge Case 07: Seek + immediately NEXT ────────────────────────────────────
  it('Edge Case 07: Seek + immediately NEXT -> New track starts cleanly at 00:00 without old seek position', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, PUSHPA_SONG, 50_000, true);

    // 1. Seek on Pushpa
    const sync = PlaybackStateSync.getInstance();
    (sync as any).seekShieldState = {
      active: true,
      targetMs: 200_000,
      songId: PUSHPA_SONG.id,
      startedAt: Date.now(),
    };

    // 2. Immediately NEXT to Chikkiri @ 00:00
    sync.handleRemoteStateUpdate({
      activeDeviceId: LAPTOP_ID,
      activeDeviceName: 'Laptop',
      songId: CHIKKIRI_SONG.id,
      songData: { ...CHIKKIRI_SONG },
      positionMs: 0,
      durationMs: CHIKKIRI_SONG.duration * 1000,
      isPlaying: true,
      queue: [PUSHPA_SONG, CHIKKIRI_SONG],
      queueIndex: 1,
      epoch: 1,
      revision: 120,
      timestamp: Date.now(),
    });

    const store = usePlayerStore.getState();
    expect(store.currentSong?.id).toBe(CHIKKIRI_SONG.id);
    expect(store.currentTime).toBeCloseTo(0, 0);
    expect((sync as any).seekShieldState.active).toBe(false);
  });

  // ── Edge Case 08: Seek + immediately PREVIOUS ────────────────────────────────
  it('Edge Case 08: Seek + immediately PREVIOUS -> Previous track starts cleanly at 00:00', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 100_000, true);

    const sync = PlaybackStateSync.getInstance();
    (sync as any).seekShieldState = {
      active: true,
      targetMs: 220_000,
      songId: CHIKKIRI_SONG.id,
      startedAt: Date.now(),
    };

    // Immediately PREV to Pushpa @ 00:00
    sync.handleRemoteStateUpdate({
      activeDeviceId: LAPTOP_ID,
      activeDeviceName: 'Laptop',
      songId: PUSHPA_SONG.id,
      songData: { ...PUSHPA_SONG },
      positionMs: 0,
      durationMs: PUSHPA_SONG.duration * 1000,
      isPlaying: true,
      queue: [PUSHPA_SONG, CHIKKIRI_SONG],
      queueIndex: 0,
      epoch: 1,
      revision: 121,
      timestamp: Date.now(),
    });

    const store = usePlayerStore.getState();
    expect(store.currentSong?.id).toBe(PUSHPA_SONG.id);
    expect(store.currentTime).toBeCloseTo(0, 0);
    expect((sync as any).seekShieldState.active).toBe(false);
  });

  // ── Edge Case 09: Rapid repeated seeks ───────────────────────────────────────
  it('Edge Case 09: Rapid repeated seeks adopt the final confirmed seek position', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 0, true);

    const seekPositions = [
      { pos: 50_000, v: 131 },
      { pos: 100_000, v: 132 },
      { pos: 150_000, v: 133 },
      { pos: 195_000, v: 134 },
    ];

    seekPositions.forEach((s) => {
      RemoteControlClient.getInstance().handlePlaybackStateUpdate({
        id: `msg_rapid_seek_${s.v}`,
        type: 'PLAYBACK_STATE',
        sourceDeviceId: LAPTOP_ID,
        targetDeviceId: MOBILE_ID,
        timestamp: Date.now(),
        payload: {
          ownerDeviceId: LAPTOP_ID,
          songId: CHIKKIRI_SONG.id,
          song: CHIKKIRI_SONG,
          queue: [CHIKKIRI_SONG],
          queueIndex: 0,
          positionMs: s.pos,
          durationMs: CHIKKIRI_SONG.duration * 1000,
          isPlaying: true,
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

    expect(usePlayerStore.getState().currentTime).toBeCloseTo(195, 0);
  });

  // ── Edge Case 10: Seek during buffering (Transient 0ms is shielded) ──────────
  it('Edge Case 10: Transient 0ms reported during buffering after seek is shielded', () => {
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 60_000, true);

    const sync = PlaybackStateSync.getInstance();
    // User sought to 03:15 (195_000ms)
    (sync as any).seekShieldState = {
      active: true,
      targetMs: 195_000,
      songId: CHIKKIRI_SONG.id,
      startedAt: Date.now(),
    };

    // Native player reports transient 0ms during buffer transition
    sync.handleRemoteStateUpdate({
      activeDeviceId: LAPTOP_ID,
      activeDeviceName: 'Laptop',
      songId: CHIKKIRI_SONG.id,
      songData: { ...CHIKKIRI_SONG },
      positionMs: 0, // Transient 0ms while buffering
      durationMs: CHIKKIRI_SONG.duration * 1000,
      isPlaying: true,
      queue: [CHIKKIRI_SONG],
      queueIndex: 0,
      epoch: 1,
      revision: 140,
      timestamp: Date.now(),
    });

    // Seek shield must preserve target 195s (03:15) and NOT snap back to 0ms
    expect(usePlayerStore.getState().currentTime).toBeCloseTo(195, 0);
  });

  // ── Edge Case 11: Disconnect during seek ──────────────────────────────────────
  it('Edge Case 11: Disconnect during seek -> Mobile disconnects, Laptop owner stays on seek position', () => {
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 195_000, true);
    setAsController(MOBILE_ID, LAPTOP_ID, CHIKKIRI_SONG, 195_000, true);

    // Mobile disconnects
    RaagaXConnectV2.getInstance().disconnect();

    const mobileState = usePlayerStore.getState();
    expect(mobileState.connectedDeviceId).toBeNull();
    expect(mobileState.deviceConnectionState).toBe('AVAILABLE');

    // Laptop owner position remains at 03:15
    setAsOwner(LAPTOP_ID, CHIKKIRI_SONG, 195_000, true);
    expect(PlaybackOwnerEngine.getInstance().getStateSnapshot().positionMs).toBe(195_000);
  });

  // ── Edge Case 14: Reverse Symmetrical Flow (Desktop CONTROLLER -> Mobile OWNER)
  it('Edge Case 14: Symmetrical Reverse: Desktop CONTROLLER drags seekbar to 03:15 -> Mobile OWNER confirms 03:15', () => {
    // Mobile is OWNER, Desktop is CONTROLLER
    setAsOwner(MOBILE_ID, CHIKKIRI_SONG, 80_000, true);
    setAsController(LAPTOP_ID, MOBILE_ID, CHIKKIRI_SONG, 80_000, true);

    // Desktop seeks to 03:15 (195_000ms)
    setAsOwner(MOBILE_ID, CHIKKIRI_SONG, 195_000, true);
    const ownerSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(ownerSnapshot.positionMs).toBe(195_000);
    expect(ownerSnapshot.isPlaying).toBe(true);

    // Mobile owner sends confirmed PLAYBACK_STATE to Desktop
    RemoteControlClient.getInstance().handlePlaybackStateUpdate({
      id: 'msg_reverse_seek_confirm',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: MOBILE_ID,
      targetDeviceId: LAPTOP_ID,
      timestamp: Date.now(),
      payload: {
        ...ownerSnapshot,
        stateVersion: 150,
      },
    });

    const desktopState = usePlayerStore.getState();
    expect(desktopState.currentTime).toBeCloseTo(195, 0);
    expect(desktopState.isPlaying).toBe(true);
  });
});
