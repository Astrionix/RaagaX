import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { NavigationStack } from '@/lib/navigation/NavigationStack';
import { Song } from '@/types/music';

const mockSong = (id: string, title: string, artist: string, album: string, artistId?: string, albumId?: string): Song => ({
  id,
  title,
  artist,
  artistId: artistId || `art_${artist}`,
  album,
  albumId: albumId || `alb_${album}`,
  duration: 240,
  coverUrl: 'https://example.com/cover.jpg',
  audioUrl: 'https://example.com/stream.mp3',
  category: 'global_trending',
  genre: 'Soundtrack',
  releaseYear: 2024,
  plays: 10,
  likes: 5,
});

describe('RaagaX Expanded Player Navigation & PlaybackSession Independence', () => {
  beforeEach(() => {
    NavigationStack.getInstance().resetToInitial('home');
    usePlayerStore.setState({
      activeTab: 'home',
      selectedAlbumId: null,
      selectedArtistId: null,
      selectedPlaylistId: null,
      isPlayerExpanded: false,
      currentSong: null,
      currentTime: 0,
      duration: 240,
      isPlaying: false,
      queue: [],
      queueIndex: 0,
    });
  });

  it('1. Navigating from Expanded Player to Album Detail and pressing Back returns directly to Expanded Player', () => {
    const song = mockSong('song_1', 'Chinni Chinni Aasalu', 'Shreya Ghoshal', 'Manam');

    // 1. User starts playback on Home
    usePlayerStore.setState({
      activeTab: 'home',
      currentSong: song,
      currentTime: 42,
      isPlaying: true,
      queue: [song],
      queueIndex: 0,
    });

    // 2. User opens Expanded Player
    usePlayerStore.getState().togglePlayerExpanded(true);
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);

    // 3. User taps "Go to Album" from Expanded Player More menu
    usePlayerStore.getState().navigateFromPlayer({ tab: 'album', albumId: 'alb_manam' });

    // Verify: Album detail is active, player overlay is temporarily dismissed to show content
    expect(usePlayerStore.getState().activeTab).toBe('album');
    expect(usePlayerStore.getState().selectedAlbumId).toBe('alb_manam');
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(false);

    // Verify PlaybackSession is 100% untouched
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_1');
    expect(usePlayerStore.getState().currentTime).toBe(42);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // 4. User presses Back on Album Detail
    const handled = NavigationStack.getInstance().goBack((target) => {
      usePlayerStore.setState({
        activeTab: target.activeTab,
        selectedAlbumId: target.selectedAlbumId,
        selectedArtistId: target.selectedArtistId,
        selectedPlaylistId: target.selectedPlaylistId,
        isPlayerExpanded: target.isPlayerExpanded,
      });
    });

    // Verify: Navigation returned directly to Expanded Player!
    expect(handled).toBe(true);
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);
    expect(usePlayerStore.getState().selectedAlbumId).toBeNull();
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_1');
    expect(usePlayerStore.getState().currentTime).toBe(42);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('2. Navigating from Expanded Player to Artist Detail and pressing Back returns to Expanded Player', () => {
    const song = mockSong('song_2', 'Fear Song', 'Anirudh Ravichander', 'Devara');

    usePlayerStore.setState({
      activeTab: 'home',
      currentSong: song,
      currentTime: 85,
      isPlaying: true,
      queue: [song],
      queueIndex: 0,
    });

    // Open Expanded Player
    usePlayerStore.getState().togglePlayerExpanded(true);
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);

    // Go to Artist
    usePlayerStore.getState().navigateFromPlayer({ tab: 'artist', artistId: 'art_anirudh' });

    expect(usePlayerStore.getState().activeTab).toBe('artist');
    expect(usePlayerStore.getState().selectedArtistId).toBe('art_anirudh');
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(false);

    // Back returns to Expanded Player
    NavigationStack.getInstance().goBack((target) => {
      usePlayerStore.setState({
        activeTab: target.activeTab,
        selectedAlbumId: target.selectedAlbumId,
        selectedArtistId: target.selectedArtistId,
        selectedPlaylistId: target.selectedPlaylistId,
        isPlayerExpanded: target.isPlayerExpanded,
      });
    });

    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);
    expect(usePlayerStore.getState().selectedArtistId).toBeNull();
  });

  it('3. Multi-hop navigation: Player -> Artist -> Album -> Back -> Artist -> Back -> Player -> Back -> Home', () => {
    const song = mockSong('song_3', 'Chaleya', 'Arijit Singh', 'Jawan');

    usePlayerStore.setState({
      activeTab: 'home',
      currentSong: song,
      currentTime: 100,
      isPlaying: true,
      queue: [song],
      queueIndex: 0,
    });

    // Step 1: Open Expanded Player
    usePlayerStore.getState().togglePlayerExpanded(true);
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);

    // Step 2: Go to Artist from Player
    usePlayerStore.getState().navigateFromPlayer({ tab: 'artist', artistId: 'art_arijit' });
    expect(usePlayerStore.getState().activeTab).toBe('artist');
    expect(usePlayerStore.getState().selectedArtistId).toBe('art_arijit');
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(false);

    // Step 3: From Artist page, user clicks an album
    usePlayerStore.getState().setSelectedAlbumId('alb_jawan');
    expect(usePlayerStore.getState().activeTab).toBe('album');
    expect(usePlayerStore.getState().selectedAlbumId).toBe('alb_jawan');

    // Step 4: Back from Album -> Returns to Artist
    NavigationStack.getInstance().goBack((target) => {
      usePlayerStore.setState({
        activeTab: target.activeTab,
        selectedAlbumId: target.selectedAlbumId,
        selectedArtistId: target.selectedArtistId,
        selectedPlaylistId: target.selectedPlaylistId,
        isPlayerExpanded: target.isPlayerExpanded,
      });
    });
    expect(usePlayerStore.getState().activeTab).toBe('artist');
    expect(usePlayerStore.getState().selectedArtistId).toBe('art_arijit');
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(false);

    // Step 5: Back from Artist -> Returns to Expanded Player!
    NavigationStack.getInstance().goBack((target) => {
      usePlayerStore.setState({
        activeTab: target.activeTab,
        selectedAlbumId: target.selectedAlbumId,
        selectedArtistId: target.selectedArtistId,
        selectedPlaylistId: target.selectedPlaylistId,
        isPlayerExpanded: target.isPlayerExpanded,
      });
    });
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);

    // Step 6: Back/Minimize Expanded Player -> Returns to Home
    NavigationStack.getInstance().goBack((target) => {
      usePlayerStore.setState({
        activeTab: target.activeTab,
        selectedAlbumId: target.selectedAlbumId,
        selectedArtistId: target.selectedArtistId,
        selectedPlaylistId: target.selectedPlaylistId,
        isPlayerExpanded: target.isPlayerExpanded,
      });
    });
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(false);
    expect(usePlayerStore.getState().activeTab).toBe('home');
  });

  it('4. Exact ID Navigation: Song X with artistId=ARTIST_123 & albumId=ALBUM_456 navigates by exact ID', () => {
    const songX = mockSong('song_x', 'Track Title', 'Artist Name', 'Album Name', 'ARTIST_123', 'ALBUM_456');

    usePlayerStore.setState({
      activeTab: 'home',
      currentSong: songX,
      currentTime: 120,
      isPlaying: true,
      queue: [songX],
      queueIndex: 0,
    });

    usePlayerStore.getState().togglePlayerExpanded(true);
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);

    // Go to Artist uses songX.artistId ('ARTIST_123')
    usePlayerStore.getState().navigateFromPlayer({ tab: 'artist', artistId: songX.artistId });
    expect(usePlayerStore.getState().activeTab).toBe('artist');
    expect(usePlayerStore.getState().selectedArtistId).toBe('ARTIST_123');

    // Back returns to Expanded Player
    NavigationStack.getInstance().goBack((target) => {
      usePlayerStore.setState({
        activeTab: target.activeTab,
        selectedAlbumId: target.selectedAlbumId,
        selectedArtistId: target.selectedArtistId,
        selectedPlaylistId: target.selectedPlaylistId,
        isPlayerExpanded: target.isPlayerExpanded,
      });
    });
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);

    // Go to Album uses songX.albumId ('ALBUM_456')
    usePlayerStore.getState().navigateFromPlayer({ tab: 'album', albumId: songX.albumId });
    expect(usePlayerStore.getState().activeTab).toBe('album');
    expect(usePlayerStore.getState().selectedAlbumId).toBe('ALBUM_456');

    // Back returns to Expanded Player
    NavigationStack.getInstance().goBack((target) => {
      usePlayerStore.setState({
        activeTab: target.activeTab,
        selectedAlbumId: target.selectedAlbumId,
        selectedArtistId: target.selectedArtistId,
        selectedPlaylistId: target.selectedPlaylistId,
        isPlayerExpanded: target.isPlayerExpanded,
      });
    });
    expect(usePlayerStore.getState().isPlayerExpanded).toBe(true);

    // Verify audio state unchanged
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_x');
    expect(usePlayerStore.getState().currentTime).toBe(120);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});
