import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { DetailHeader, type SortOption } from '@/components/music/DetailHeader';
import { playList, shuffleList } from '@/components/music/play';
import { LoadError, LoadMoreError, NeedsExtension } from '@/components/music/States';
import { TrackList } from '@/components/music/TrackList';
import { usePlaylist, useYouTubeReady } from '@/data/music/queries';
import { useArtworkColor } from '@/lib/artworkColor';
import { usePageTint } from '@/lib/usePageTint';
import { PlaylistSkeleton } from '@/skeletons/PageSkeletons';
import { detailFooter } from './pageStyles';

/** A playlist (report §14): header, then the artwork track list, loading on as you scroll. */
export default function PlaylistPage() {
  const id = decodeURIComponent(useParams().id ?? '');
  const { missing } = useYouTubeReady();
  const playlist = usePlaylist(id);
  const header = playlist.data?.pages[0]?.header ?? null;
  usePageTint(useArtworkColor(header?.thumbnail));

  const [sort, setSort] = useState<SortOption>(() => {
    try {
      return (localStorage.getItem(`raaga:playlist:sort:${id}`) as SortOption) || 'default';
    } catch {
      return 'default';
    }
  });

  const handleSortChange = useCallback((newSort: SortOption) => {
    setSort(newSort);
    try {
      localStorage.setItem(`raaga:playlist:sort:${id}`, newSort);
    } catch {}
  }, [id]);

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = playlist;
  const onNearEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  if (missing) return <NeedsExtension />;
  if (playlist.isError && !playlist.data) return <LoadError error={playlist.error} onRetry={() => void playlist.refetch()} />;
  if (!playlist.data || !header) return <PlaylistSkeleton />;

  const rawTracks = playlist.data.pages.flatMap((page) => page.tracks);
  const tracks = useMemo(() => {
    if (!rawTracks || rawTracks.length === 0 || sort === 'default') return rawTracks;
    switch (sort) {
      case 'title-asc':
        return [...rawTracks].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
      case 'title-desc':
        return [...rawTracks].sort((a, b) => (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' }));
      case 'artist-asc':
        return [...rawTracks].sort((a, b) => {
          const aArtist = a.artists?.map((x) => x.name).join(', ') || '';
          const bArtist = b.artists?.map((x) => x.name).join(', ') || '';
          return aArtist.localeCompare(bArtist, undefined, { sensitivity: 'base' });
        });
      case 'date-added-desc':
        return [...rawTracks].reverse();
      case 'date-added-asc':
        return [...rawTracks];
      default:
        return rawTracks;
    }
  }, [rawTracks, sort]);

  const context = { source: { title: header.title, type: 'playlist' as const, id } };
  return (
    <>
      <DetailHeader
        info={header}
        canPlay={tracks.length > 0}
        onPlay={() => playList(tracks, 0, context)}
        onShuffle={() => shuffleList(tracks, context)}
        sort={sort}
        onSortChange={handleSortChange}
      />
      <TrackList tracks={tracks} variant="playlist" onNearEnd={onNearEnd} source={context.source} />
      {isFetchingNextPage && <div className="flex justify-center py-5 type-callout text-secondary">Loading more songs…</div>}
      {playlist.isFetchNextPageError && <LoadMoreError onRetry={() => void fetchNextPage()} />}
      <footer className={detailFooter}>
        <p>{header.meta}</p>
      </footer>
    </>
  );
}
