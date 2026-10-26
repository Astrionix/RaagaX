// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { TrackShelf, trackItem } from './ShelfView';
import type { Track } from '@/data/music/types';

const mockTracks: Track[] = [
  {
    videoId: 'v1',
    title: 'Song One',
    artists: [{ name: 'Artist A', id: 'UC123' }],
    album: { name: 'Album X', id: 'MPRE1' },
    durationSec: 210,
    explicit: false,
    thumbnail: 'https://example.com/thumb1.jpg',
    index: 1,
    plays: null,
  },
  {
    videoId: 'v2',
    title: 'Song Two',
    artists: [{ name: 'Artist B', id: null }],
    album: null,
    durationSec: 180,
    explicit: true,
    thumbnail: 'https://example.com/thumb2.jpg',
    index: 2,
    plays: null,
  },
];

describe('TrackShelf View Toggle', () => {
  it('correctly maps Track to MusicItem with artist fallback', () => {
    const item1 = trackItem(mockTracks[0]);
    expect(item1.id).toBe('v1');
    expect(item1.title).toBe('Song One');
    expect(item1.subtitle).toBe('Album X');

    const item2 = trackItem(mockTracks[1]);
    expect(item2.id).toBe('v2');
    expect(item2.title).toBe('Song Two');
    expect(item2.subtitle).toBe('Artist B');
  });

  it('renders list view with 4-boxes grid toggle button', () => {
    const toggle = vi.fn();
    const html = renderToString(
      <MemoryRouter>
        <TrackShelf
          title="Recently Played"
          tracks={mockTracks}
          source={{ title: 'Recently Played', type: 'home' }}
          viewType="list"
          onToggleView={toggle}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('Recently Played');
    expect(html).toContain('Switch to grid view');
    expect(html).toContain('Song One');
    expect(html).toContain('Song Two');
  });

  it('renders grid view with large covers and list toggle button', () => {
    const toggle = vi.fn();
    const html = renderToString(
      <MemoryRouter>
        <TrackShelf
          title="Recently Played"
          tracks={mockTracks}
          source={{ title: 'Recently Played', type: 'home' }}
          viewType="grid"
          onToggleView={toggle}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('Recently Played');
    expect(html).toContain('Switch to list view');
    expect(html).toContain('Song One');
    expect(html).toContain('Song Two');
  });

  it('does not render toggle button when onToggleView is not passed', () => {
    const html = renderToString(
      <MemoryRouter>
        <TrackShelf
          title="Top Songs"
          tracks={mockTracks}
          source={{ title: 'Top Songs', type: 'home' }}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('Top Songs');
    expect(html).not.toContain('Switch to grid view');
    expect(html).not.toContain('Switch to list view');
  });
});
