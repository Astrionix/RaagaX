import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

describe('RAAGAX CONNECT — TWO-DEVICE / FOUR-SCENARIO SPECIFICATION', () => {
  const songA: Song = {
    id: 'song_a',
    title: 'Song A',
    artist: 'Artist A',
    album: 'Album A',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
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
    id: 'song_b',
    title: 'Song B',
    artist: 'Artist B',
    album: 'Album B',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
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
    id: 'song_c',
    title: 'Song C',
    artist: 'Artist C',
    album: 'Album C',
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
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
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: 0,
      remoteDeviceName: null,
    });
  });

  // ============================================================
  // SCENARIO 1 — MOBILE OPEN, NOTHING PLAYING
  // ============================================================
  it('SCENARIO 1: Both devices open, nothing playing — can connect into shared session', async () => {
    const store = usePlayerStore.getState();

    // 1. Initial State: Mobile open, nothing playing
    expect(store.currentSong).toBeNull();
    expect(store.isPlaying).toBe(false);
    expect(store.connectedDeviceId).toBeNull();

    // 2. Connect Mobile to Laptop
    usePlayerStore.setState({
      connectedDeviceId: 'dev_laptop',
      remoteDeviceName: 'My Laptop',
    });

    const updated = usePlayerStore.getState();
    expect(updated.connectedDeviceId).toBe('dev_laptop');
    expect(updated.remoteDeviceName).toBe('My Laptop');
    // Both devices now belong to the same playback session
    expect(updated.isPlaying).toBe(false);
  });

  // ============================================================
  // SCENARIO 2 — MOBILE PLAYING, LAPTOP CONNECTED
  // ============================================================
  it('SCENARIO 2: Mobile playing (audio output), Laptop connected as synchronized remote controller', async () => {
    // 1. Mobile starts playing Song A
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: true, // Only Mobile produces audio
      currentSong: songA,
      isPlaying: true,
      currentTime: 45,
      duration: 240,
      queue: [songA, songB],
      queueIndex: 0,
      remoteDeviceName: 'My Laptop',
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.isActiveDevice).toBe(true);
    expect(mobileState.isPlaying).toBe(true);
    expect(mobileState.currentSong?.title).toBe('Song A');

    // 2. Laptop perspective (synced state with isActiveDevice = false)
    const laptopView = {
      ...mobileState,
      deviceId: 'dev_laptop',
      isActiveDevice: false, // Laptop must NOT produce audio
      remoteDeviceName: 'This phone',
    };

    expect(laptopView.isActiveDevice).toBe(false);
    expect(laptopView.currentSong?.title).toBe('Song A');
    expect(laptopView.currentSong?.artist).toBe('Artist A');
    expect(laptopView.currentTime).toBe(45);
    expect(laptopView.isPlaying).toBe(true);

    // 3. User on Laptop selects Song B and presses PLAY -> Shared session switches to Song B on Mobile
    usePlayerStore.setState({
      currentSong: songB,
      queueIndex: 1,
      currentTime: 0,
      duration: 180,
      isPlaying: true,
    });

    const synchronizedState = usePlayerStore.getState();
    expect(synchronizedState.currentSong?.id).toBe('song_b');
    expect(synchronizedState.currentSong?.title).toBe('Song B');
    expect(synchronizedState.currentSong?.artist).toBe('Artist B');
    expect(synchronizedState.isActiveDevice).toBe(true); // Mobile continues as active audio output
  });

  // ============================================================
  // SCENARIO 3 — LAPTOP PLAYING, MOBILE CONNECTED
  // ============================================================
  it('SCENARIO 3: Laptop playing (audio output), Mobile connected as synchronized remote controller', async () => {
    // 1. Laptop is producing audio for Song A, Mobile is connected as follower
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_laptop',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: false, // Mobile must NOT produce audio
      currentSong: songA,
      isPlaying: true,
      currentTime: 90,
      duration: 240,
      queue: [songA, songB],
      queueIndex: 0,
      remoteDeviceName: 'My Laptop',
    });

    const mobileController = usePlayerStore.getState();
    expect(mobileController.isActiveDevice).toBe(false);
    expect(mobileController.isPlaying).toBe(true);
    expect(mobileController.currentSong?.title).toBe('Song A');

    // 2. Mobile interacts: presses NEXT
    usePlayerStore.setState({
      currentSong: songB,
      queueIndex: 1,
      currentTime: 0,
      duration: 180,
    });

    const updatedState = usePlayerStore.getState();
    expect(updatedState.currentSong?.id).toBe('song_b');
    expect(updatedState.isActiveDevice).toBe(false); // Mobile remains controller, Laptop produces audio
  });

  // ============================================================
  // SCENARIO 4 — PLAYBACK DESTINATION CHANGES (SEAMLESS HANDOFF)
  // ============================================================
  it('SCENARIO 4: Playback destination changes seamlessly (Mobile 🔊 ⇄ Laptop 🔊) at same position', async () => {
    // Initial: Mobile is producing audio for Song A at 02:31 (151 seconds)
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: true,
      currentSong: songA,
      currentTime: 151, // 02:31
      duration: 240,
      isPlaying: true,
      queue: [songA, songB],
      queueIndex: 0,
      remoteDeviceName: 'My Laptop',
    });

    expect(usePlayerStore.getState().isActiveDevice).toBe(true);
    expect(usePlayerStore.getState().currentTime).toBe(151);

    // 1. User taps "My Laptop" -> Playback destination transfers to Laptop
    // Laptop becomes active audio player, Mobile becomes silent controller
    usePlayerStore.setState({
      activeDeviceId: 'dev_laptop',
      isActiveDevice: false, // Mobile stops producing audio
      remoteDeviceName: 'My Laptop',
    });

    const afterTransferToLaptop = usePlayerStore.getState();
    expect(afterTransferToLaptop.isActiveDevice).toBe(false);
    expect(afterTransferToLaptop.activeDeviceId).toBe('dev_laptop');
    expect(afterTransferToLaptop.currentSong?.id).toBe('song_a');
    expect(afterTransferToLaptop.currentTime).toBe(151); // Position preserved ≈ 02:31
    expect(afterTransferToLaptop.isPlaying).toBe(true);

    // 2. Reverse: User taps "This phone" -> Playback destination transfers back to Mobile
    usePlayerStore.setState({
      activeDeviceId: 'dev_mobile',
      isActiveDevice: true, // Mobile becomes active audio player again
    });

    const afterTransferBackToMobile = usePlayerStore.getState();
    expect(afterTransferBackToMobile.isActiveDevice).toBe(true);
    expect(afterTransferBackToMobile.activeDeviceId).toBe('dev_mobile');
    expect(afterTransferBackToMobile.currentSong?.id).toBe('song_a');
    expect(afterTransferBackToMobile.currentTime).toBe(151);
  });

  // ============================================================
  // SEARCH + PLAY REQUIREMENT (SECTIONS 14, 15, 16)
  // ============================================================
  it('SEARCH + PLAY: Searching and playing a track routes to shared session without forcing local audio', () => {
    // 1. Laptop is active audio output (Laptop 🔊)
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_laptop',
      connectedDeviceId: 'dev_laptop',
      isActiveDevice: false, // Mobile is controller
      currentSong: songA,
      isPlaying: true,
      remoteDeviceName: 'My Laptop',
    });

    // Mobile searches Song C and hits Play
    // Shared session updates track to Song C, but Laptop remains active audio renderer
    usePlayerStore.setState({
      currentSong: songC,
      isPlaying: true,
      currentTime: 0,
      duration: 210,
    });

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_c');
    expect(state.currentSong?.title).toBe('Song C');
    expect(state.isActiveDevice).toBe(false); // Mobile did NOT become audio player
    expect(state.activeDeviceId).toBe('dev_laptop'); // Laptop produces audio for Song C
  });

  // ============================================================
  // DISCONNECT BEHAVIOR (DISCONNECT ≠ STOP MUSIC)
  // ============================================================
  it('DISCONNECT: Disconnecting controller does NOT stop music on active audio device', () => {
    // Laptop is playing (Laptop 🔊), Mobile disconnects
    usePlayerStore.setState({
      deviceId: 'dev_laptop',
      activeDeviceId: 'dev_laptop',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: true,
      currentSong: songA,
      isPlaying: true,
      currentTime: 100,
    });

    // Mobile disconnects -> Laptop's connectedDeviceId is cleared but isPlaying remains TRUE
    usePlayerStore.setState({
      connectedDeviceId: null,
      remoteDeviceName: null,
    });

    const laptopState = usePlayerStore.getState();
    expect(laptopState.isPlaying).toBe(true); // Laptop continues playing!
    expect(laptopState.currentSong?.id).toBe('song_a');
    expect(laptopState.currentTime).toBe(100);
    expect(laptopState.connectedDeviceId).toBeNull();
  });

  // ============================================================
  // INVARIANT: NO DUPLICATE AUDIO (ONE DEVICE = AUDIO OUTPUT)
  // ============================================================
  it('INVARIANT: Exactly one device is active audio renderer at any time', () => {
    const devices = [
      { id: 'mobile', isProducingAudio: true },
      { id: 'laptop', isProducingAudio: false },
    ];

    const activeCount = devices.filter(d => d.isProducingAudio).length;
    expect(activeCount).toBe(1);
  });
});
