import { useCallback, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
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

  const rawTracks = useMemo(() => playlist.data?.pages.flatMap((page) => page.tracks) ?? [], [playlist.data]);
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

  const [searchQuery, setSearchQuery] = useState('');

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = searchQuery.trim().toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artists.some((a) => a.name.toLowerCase().includes(q))
    );
  }, [tracks, searchQuery]);

  if (missing) return <NeedsExtension />;
  if (playlist.isError && !playlist.data) return <LoadError error={playlist.error} onRetry={() => void playlist.refetch()} />;
  if (!playlist.data || !header) return <PlaylistSkeleton />;

  const context = { source: { title: header.title, type: 'playlist' as const, id } };
  return (
    <>
      <DetailHeader
        info={header}
        canPlay={tracks.length > 0}
        onPlay={() => playList(filteredTracks.length > 0 ? filteredTracks : tracks, 0, context)}
        onShuffle={() => shuffleList(filteredTracks.length > 0 ? filteredTracks : tracks, context)}
        sort={sort}
        onSortChange={handleSortChange}
      />
      {tracks.length > 0 && (
        <div className="mx-(--body-gutter) mt-4 mb-2 flex items-center justify-between gap-3">
          <div className="relative flex max-w-sm flex-1 items-center">
            <Search size={15} strokeWidth={2.2} className="pointer-events-none absolute left-3 text-secondary" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in playlist…"
              className="h-8 w-full rounded-lg border border-search-border bg-quinary pr-8 pl-8.5 type-callout text-primary placeholder:text-tertiary focus:border-primary/40 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-secondary hover:text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery && (
            <span className="type-caption text-secondary">
              {filteredTracks.length} of {tracks.length}
            </span>
          )}
        </div>
      )}
      <TrackList tracks={filteredTracks} variant="playlist" onNearEnd={onNearEnd} source={context.source} />
      {isFetchingNextPage && <div className="flex justify-center py-5 type-callout text-secondary">Loading more songs…</div>}
      {playlist.isFetchNextPageError && <LoadMoreError onRetry={() => void fetchNextPage()} />}
      <footer className={detailFooter}>
        <p>{header.meta}</p>
      </footer>
    </>
  );
}
