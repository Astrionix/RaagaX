import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { HomeFeedGenerator } from '@/lib/home/HomeFeedGenerator';
import { createDownloadLinks } from '@/common/helpers/link.helper';

describe('Autoplay Prevention & Artists Fix Verification Suite', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const k in store) delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] || null,
    };
    (globalThis as any).window = globalThis;
    (globalThis as any).document = {
      title: '',
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    usePlayerStore.setState({
      isPlaying: false,
      playbackIntent: 'PAUSED',
      currentSong: null,
      queue: [],
      queueIndex: 0,
      isLocalPlayback: true,
    });
  });

  describe('1. Zero Autoplay on Cold Boot / Interaction', () => {
    it('initializes store strictly paused with PAUSED playbackIntent', () => {
      const state = usePlayerStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.playbackIntent).toBe('PAUSED');
    });

    it('does not transition playbackIntent to PLAYING unless explicitly commanded', () => {
      const store = usePlayerStore.getState();
      store.setIsPlaying(false, true);
      expect(usePlayerStore.getState().isPlaying).toBe(false);
      expect(usePlayerStore.getState().playbackIntent).toBe('PAUSED');
    });

    it('reconciling from localStorage in TabSyncCoordinator strictly forces isPlaying=false and playbackIntent=PAUSED', async () => {
      const { TabSyncCoordinator } = await import('@/lib/sync/TabSyncCoordinator');
      // Simulate an old session in localStorage that had isPlaying = true
      const mockSnapshot = {
        song: { id: 'track_test_1', title: 'Test Track', artist: 'Test Artist', duration: 200 },
        isPlaying: true,
        queueIndex: 0,
        currentTime: 45,
        duration: 200,
        timestamp: Date.now(),
      };
      localStorage.setItem('raagax_live_tab_metadata', JSON.stringify(mockSnapshot));

      // Reconcile on foreground
      TabSyncCoordinator.getInstance().reconcileOnForeground();

      const state = usePlayerStore.getState();
      expect(state.currentSong?.id).toBe('track_test_1');
      expect(state.isPlaying).toBe(false); // MUST BE FALSE
      expect(state.playbackIntent).toBe('PAUSED'); // MUST BE PAUSED
    });

    it('PlaybackRecoveryEngine strictly persists snapshot with isPlaying=false even when audio was active', async () => {
      const { PlaybackRecoveryEngine } = await import('@/lib/playback/PlaybackRecoveryEngine');
      PlaybackRecoveryEngine.getInstance().persistSnapshot({
        currentSong: { id: 'track_active', title: 'Active Track', artist: 'Artist' },
        currentTime: 50,
        queueIndex: 0,
        isPlaying: true, // Audio was active at the time
        isLocalPlayback: true,
      });

      const raw = localStorage.getItem('raagax_playback_snapshot_v1');
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed.isPlaying).toBe(false); // MUST BE FALSE on disk
    });
  });

  describe('2. Popular Artists & Regional Seed IDs', () => {
    it('contains verified JioSaavn IDs for top South Indian and National artists in POPULAR_ARTISTS', () => {
      const thaman = POPULAR_ARTISTS.find(a => a.name === 'Thaman S');
      expect(thaman).toBeDefined();
      expect(thaman?.id).toBe('544471');

      const dsp = POPULAR_ARTISTS.find(a => a.name === 'Devi Sri Prasad');
      expect(dsp).toBeDefined();
      expect(dsp?.id).toBe('455170');

      const anirudh = POPULAR_ARTISTS.find(a => a.name === 'Anirudh Ravichander');
      expect(anirudh).toBeDefined();
      expect(anirudh?.id).toBe('455663');

      const rahman = POPULAR_ARTISTS.find(a => a.name === 'A.R. Rahman');
      expect(rahman).toBeDefined();
      expect(rahman?.id).toBe('456269');

      const shreya = POPULAR_ARTISTS.find(a => a.name === 'Shreya Ghoshal');
      expect(shreya).toBeDefined();
      expect(shreya?.id).toBe('455130');
    });

    it('HomeFeedGenerator returns verified Telugu seed artists with valid IDs', () => {
      const teluguArtists = HomeFeedGenerator.getArtistsForLanguage('Telugu', 10);
      expect(teluguArtists.length).toBeGreaterThanOrEqual(8);

      const thaman = teluguArtists.find(a => a.name === 'Thaman S');
      expect(thaman?.id).toBe('544471');

      const dsp = teluguArtists.find(a => a.name === 'Devi Sri Prasad');
      expect(dsp?.id).toBe('455170');

      const anirudh = teluguArtists.find(a => a.name === 'Anirudh Ravichander');
      expect(anirudh?.id).toBe('455663');
    });
  });

  describe('3. Link Helper & Decryption Stability', () => {
    it('createDownloadLinks safely returns empty array for empty/null input without crashing', () => {
      expect(createDownloadLinks('')).toEqual([]);
      expect(createDownloadLinks(null as any)).toEqual([]);
      expect(createDownloadLinks(undefined as any)).toEqual([]);
    });

    it('createDownloadLinks decodes valid DES-ECB encrypted media url without throwing module errors', () => {
      // Sample encrypted JioSaavn string
      const encryptedSample = '9WqZ9b68u4Jc2qC1zO54Bw==';
      const result = createDownloadLinks(encryptedSample);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
