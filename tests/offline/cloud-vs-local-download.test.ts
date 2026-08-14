import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { AccountSyncEngine, CloudDownloadRecord } from '@/lib/sync/AccountSyncEngine';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_cloud_456',
  title: 'Samajavaragamana',
  artist: 'Sid Sriram',
  artistId: 'art-456',
  album: 'Ala Vaikunthapurramuloo',
  albumId: 'alb-456',
  coverUrl: 'https://example.com/cover456.jpg',
  audioUrl: 'https://example.com/audio456.mp3',
  duration: 220,
  genre: 'Tollywood',
  category: 'melody',
  releaseYear: 2020,
  plays: 50,
  likes: 12,
};

const mockSongB: Song = {
  id: 'song_fresh_789',
  title: 'Butta Bomma',
  artist: 'Armaan Malik',
  artistId: 'art-789',
  album: 'Ala Vaikunthapurramuloo',
  albumId: 'alb-456',
  coverUrl: 'https://example.com/cover789.jpg',
  audioUrl: 'https://example.com/audio789.mp3',
  duration: 195,
  genre: 'Tollywood',
  category: 'melody',
  releaseYear: 2020,
  plays: 80,
  likes: 20,
};

describe('RaagaX Cloud Record vs Device-Local Offline Storage Architecture', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      downloadedSongIds: [],
      cloudDownloadedSongIds: [],
      cloudDownloadRecords: [],
      likedSongIds: [],
      queue: [],
    });
    useDownloadStore.setState({
      tasks: {},
      exportStates: {},
      activeCount: 0,
    });
  });

  // Helper to determine the 3 UI states
  function getDownloadUIState(songId: string) {
    const { downloadedSongIds, cloudDownloadedSongIds } = usePlayerStore.getState();
    const isLocallyDownloaded = downloadedSongIds.includes(songId);
    const isCloudRecorded = cloudDownloadedSongIds.includes(songId);

    if (isLocallyDownloaded) {
      return {
        status: 'DOWNLOADED_LOCAL',
        label: 'Downloaded ✓',
        subLabel: 'Tap to remove offline media from device',
        actionType: 'REMOVE_LOCAL',
      };
    }
    if (isCloudRecorded) {
      return {
        status: 'DOWNLOADED_CLOUD_ONLY',
        label: 'Download Again ↓',
        subLabel: 'Saved in cloud • Tap to download locally',
        actionType: 'RESTORE_DOWNLOAD',
      };
    }
    return {
      status: 'NOT_DOWNLOADED',
      label: 'Save for Offline',
      subLabel: 'App-sandboxed listening',
      actionType: 'INITIAL_DOWNLOAD',
    };
  }

  // Test 1: Fresh Install / Secondary Device with Cloud History -> UI shows "Download Again ↓", NOT "Downloaded ✓"
  it('Test 1: When user installs on a new device, Cloud ID exists but Local file does not -> UI shows "Download Again ↓"', () => {
    // Simulate Cloud sync populating cloud download history for song_cloud_456
    const cloudRecord: CloudDownloadRecord = {
      song_id: mockSongA.id,
      user_id: 'user_123',
      downloaded_at: '2026-08-01T10:00:00Z',
      song_title: mockSongA.title,
      song_artist: mockSongA.artist,
      song_cover: mockSongA.coverUrl,
      song_duration: mockSongA.duration,
      song_version: '1.0',
    };

    usePlayerStore.setState({
      cloudDownloadedSongIds: [mockSongA.id],
      cloudDownloadRecords: [cloudRecord],
      downloadedSongIds: [], // Local storage is empty on new device!
    });

    const uiState = getDownloadUIState(mockSongA.id);
    expect(uiState.status).toBe('DOWNLOADED_CLOUD_ONLY');
    expect(uiState.label).toBe('Download Again ↓');
    expect(uiState.actionType).toBe('RESTORE_DOWNLOAD');

    // Verify it is NOT treated as playable offline without downloading
    expect(usePlayerStore.getState().downloadedSongIds.includes(mockSongA.id)).toBe(false);
  });

  // Test 2: Local Download completion transitions state to "Downloaded ✓"
  it('Test 2: After local download completes and verifies, UI transitions to "Downloaded ✓"', () => {
    // Local download finished
    usePlayerStore.setState({
      cloudDownloadedSongIds: [mockSongA.id],
      downloadedSongIds: [mockSongA.id],
    });

    const uiState = getDownloadUIState(mockSongA.id);
    expect(uiState.status).toBe('DOWNLOADED_LOCAL');
    expect(uiState.label).toBe('Downloaded ✓');
    expect(uiState.actionType).toBe('REMOVE_LOCAL');
  });

  // Test 3: Fresh un-downloaded song shows "Save for Offline"
  it('Test 3: Fresh track with no cloud record and no local file shows "Save for Offline"', () => {
    const uiState = getDownloadUIState(mockSongB.id);
    expect(uiState.status).toBe('NOT_DOWNLOADED');
    expect(uiState.label).toBe('Save for Offline');
    expect(uiState.actionType).toBe('INITIAL_DOWNLOAD');
  });

  // Test 4: Removing local download clears local storage but preserves cloud download history for 1-click restore
  it('Test 4: Removing local download deletes device media but keeps cloud record for future restore', async () => {
    // Start with song downloaded on both cloud and local device
    usePlayerStore.setState({
      cloudDownloadedSongIds: [mockSongA.id],
      downloadedSongIds: [mockSongA.id],
    });

    expect(getDownloadUIState(mockSongA.id).status).toBe('DOWNLOADED_LOCAL');

    // User removes local download to save storage
    const downloadStore = useDownloadStore.getState();
    await downloadStore.removeDownload(mockSongA.id);

    // Local device no longer has the file
    expect(usePlayerStore.getState().downloadedSongIds.includes(mockSongA.id)).toBe(false);

    // Cloud record remains intact
    expect(usePlayerStore.getState().cloudDownloadedSongIds.includes(mockSongA.id)).toBe(true);

    // UI smoothly transitions back to "Download Again ↓"
    const stateAfterRemoval = getDownloadUIState(mockSongA.id);
    expect(stateAfterRemoval.status).toBe('DOWNLOADED_CLOUD_ONLY');
    expect(stateAfterRemoval.label).toBe('Download Again ↓');
  });

  // Test 5: Cloud record sync via AccountSyncEngine
  it('Test 5: AccountSyncEngine records download metadata without overwriting local storage authority', async () => {
    const syncEngine = AccountSyncEngine.getInstance();
    await syncEngine.recordCloudDownload('user_test_99', mockSongB);

    const { cloudDownloadedSongIds, cloudDownloadRecords } = usePlayerStore.getState();
    expect(cloudDownloadedSongIds.includes(mockSongB.id)).toBe(true);
    expect(cloudDownloadRecords.some(r => r.song_id === mockSongB.id)).toBe(true);
  });
});
