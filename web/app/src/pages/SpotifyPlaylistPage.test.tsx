// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import * as useExtensionMod from '@/extension/useExtension';
import * as useSpotifyAuthMod from '@/extension/useSpotifyAuth';
import * as spotifyQueriesMod from '@/data/spotify/queries';
import SpotifyPlaylistPage from './SpotifyPlaylistPage';

describe('SpotifyPlaylistPage re-render', () => {
  it('re-renders when info and rows arrive without error #310', async () => {
    const queryClient = new QueryClient();

    // Mock useExtension
    vi.spyOn(useExtensionMod, 'useExtension').mockReturnValue({
      state: 'present',
      extension: {
        info: { capabilities: ['spotify', 'yt', 'yt.auth'] },
        bridge: { call: vi.fn(), subscribe: vi.fn(() => () => {}) },
      } as any,
    });

    // Mock useSpotifySignedIn
    vi.spyOn(useSpotifyAuthMod, 'useSpotifySignedIn').mockReturnValue(true);

    // Initial state: loading
    const infoSpy = vi.spyOn(spotifyQueriesMod, 'useSpotifyPlaylistInfo').mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    const rowsSpy = vi.spyOn(spotifyQueriesMod, 'useSpotifyRows').mockReturnValue({
      status: 'loading',
      error: null,
      rows: [],
      total: 0,
      matching: 0,
      retry: vi.fn(),
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/spotify/playlist/liked']}>
            <Routes>
              <Route path="/spotify/playlist/:id" element={<SpotifyPlaylistPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    // Second render: info and rows arrive
    infoSpy.mockReturnValue({
      data: {
        name: 'Liked Songs',
        owner: null,
        imageUrl: 'https://misc.scdn.co/liked-songs/liked-songs-640.png',
        total: 2,
      },
      isLoading: false,
    } as any);

    rowsSpy.mockReturnValue({
      status: 'ready',
      error: null,
      rows: [
        { videoId: 'v1', title: 'Song 1', artists: [{ name: 'A', id: null }], album: null, durationSec: 180, explicit: false, thumbnail: '', index: 1, plays: null, unavailable: undefined },
        { videoId: 'v2', title: 'Song 2', artists: [{ name: 'B', id: null }], album: null, durationSec: 200, explicit: false, thumbnail: '', index: 2, plays: null, unavailable: undefined },
      ],
      total: 2,
      matching: 0,
      retry: vi.fn(),
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/spotify/playlist/liked']}>
            <Routes>
              <Route path="/spotify/playlist/:id" element={<SpotifyPlaylistPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    expect(container.innerHTML).toContain('Liked Songs');
  });
});
