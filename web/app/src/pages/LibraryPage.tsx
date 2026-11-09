import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Navigate, useParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { CircleLockup, SquareLockup, VideoLockup } from '@/components/music/Lockups';
import { EmptyState, LoadError, LoadMoreError, NeedsExtension } from '@/components/music/States';
import { TrackList } from '@/components/music/TrackList';
import { ReplayCardRow } from '@/components/replay/ReplayCardRow';
import { isLibrarySection, LIBRARY_SECTIONS } from '@/data/music/library';
import { useLibrary, useSignedIn, useYouTubeReady } from '@/data/music/queries';
import { useYtAuth } from '@/extension/useYtAuth';
import { PlainSkeleton } from '@/skeletons/PageSkeletons';
import { seeAllGrid, seeAllTracks } from './pageStyles';

/** Asks for the next page when [target] scrolls into view. */
function useLoadMore(onVisible: (() => void) | null) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = target.current;
    if (!node || !onVisible) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onVisible(), {
      rootMargin: '600px 0px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible]);
  return target;
}

/** A library section (prompt §5.3): Recently Played, Artists, Albums, Songs, Made for You, All Playlists. */
export default function LibraryPage() {
  const section = useParams().section ?? '';
  const { missing } = useYouTubeReady();
  const auth = useYtAuth();
  const signedIn = useSignedIn();
  const library = useLibrary(isLibrarySection(section) ? section : 'playlists');
  const loadMore = useLoadMore(
    library.hasNextPage && !library.isFetchingNextPage && !library.isFetchNextPageError
      ? () => void library.fetchNextPage()
      : null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const rawGrid = useMemo(() => library.data?.pages.flatMap((page) => page.data.grid) ?? [], [library.data]);
  const rawTracks = useMemo(() => library.data?.pages.flatMap((page) => page.data.tracks) ?? [], [library.data]);

  const grid = useMemo(() => {
    if (!searchQuery.trim()) return rawGrid;
    const q = searchQuery.trim().toLowerCase();
    return rawGrid.filter(
      (item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
    );
  }, [rawGrid, searchQuery]);

  const tracks = useMemo(() => {
    if (!searchQuery.trim()) return rawTracks;
    const q = searchQuery.trim().toLowerCase();
    return rawTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artists.some((a) => a.name.toLowerCase().includes(q)) ||
        (t.album?.name && t.album.name.toLowerCase().includes(q))
    );
  }, [rawTracks, searchQuery]);

  if (!isLibrarySection(section)) return <Navigate to="/home" replace />;
  const title = LIBRARY_SECTIONS[section].title;
  if (missing) {
    return (
      <>
        <PageHeader title={title} />
        {section === 'recent' && <ReplayCardRow />}
        <NeedsExtension what="your library" />
      </>
    );
  }
  if (auth.state === 'ready' && !signedIn) {
    return (
      <>
        <PageHeader title={title} />
        {section === 'recent' && <ReplayCardRow />}
        <EmptyState
          title="Sign in to see your library"
          detail="Raaga uses the YouTube Music account this browser is signed in to. Sign in on music.youtube.com, then come back."
        />
      </>
    );
  }
  if (library.isError && !library.data) return <LoadError error={library.error} onRetry={() => void library.refetch()} />;
  if (!library.data) return <PlainSkeleton />;

  return (
    <>
      <PageHeader title={title} />
      {section === 'recent' && <ReplayCardRow />}

      {(rawGrid.length > 0 || rawTracks.length > 0) && (
        <div className="mx-(--body-gutter) mt-1 mb-4 flex max-w-sm items-center gap-2 rounded-lg border border-search-border bg-quinary px-3 py-1.5">
          <Search size={15} strokeWidth={2.2} className="text-secondary" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={section === 'playlists' ? 'Search in playlists…' : `Search in ${title.toLowerCase()}…`}
            className="w-full bg-transparent type-callout text-primary placeholder:text-tertiary focus:outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="text-secondary hover:text-primary">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {!rawGrid.length && !rawTracks.length && <EmptyState title="Nothing here yet" />}
      {rawGrid.length > 0 && !grid.length && <EmptyState title="No results found" detail={`No items match “${searchQuery}”.`} />}
      {grid.length > 0 && (
        <ul className={seeAllGrid} data-wide={grid.every((i) => i.wide) || undefined}>
          {grid.map((item, i) => (
            <li key={`${item.id}-${i}`}>
              {item.kind === 'artist' ? (
                <CircleLockup item={item} />
              ) : item.wide ? (
                <VideoLockup item={item} />
              ) : (
                <SquareLockup item={item} />
              )}
            </li>
          ))}
        </ul>
      )}
      {tracks.length > 0 && (
        <div className={seeAllTracks}>
          <TrackList
            tracks={tracks}
            variant="playlist"
            source={{ title, type: 'library', id: section }}
            onNearEnd={
              library.hasNextPage && !library.isFetchingNextPage && !library.isFetchNextPageError
                ? () => void library.fetchNextPage()
                : undefined
            }
          />
        </div>
      )}
      {grid.length > 0 && <div ref={loadMore} aria-hidden="true" />}
      {library.isFetchNextPageError && <LoadMoreError onRetry={() => void library.fetchNextPage()} />}
    </>
  );
}
