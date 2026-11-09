import { useSearchParams } from 'react-router';
import { PrefetchLink } from '@/components/PrefetchLink';
import { Artwork } from '@/components/music/Artwork';
import { CategoryTiles } from '@/components/music/CategoryTiles';
import { hrefFor } from '@/components/music/links';
import { CircleLockup, SquareLockup, VideoLockup } from '@/components/music/Lockups';
import { playTrack } from '@/components/music/play';
import { SearchField } from '@/components/music/SearchField';
import { Shelves } from '@/components/music/ShelfView';
import { EmptyState, LoadError, NeedsExtension } from '@/components/music/States';
import type { SearchFilterType } from '@/data/music/api';
import { useCategories, useSearch, useYouTubeReady } from '@/data/music/queries';
import type { MusicItem, SearchResults, Shelf } from '@/data/music/types';
import { SkeletonBlock, SkeletonLine } from '@/components/Skeleton';
import { ShelfSkeleton } from '@/skeletons/ShelfSkeleton';
import { seeAllGrid } from './pageStyles';

const KIND_LABEL: Record<MusicItem['kind'], string> = {
  song: 'Song',
  video: 'Video',
  album: 'Album',
  playlist: 'Playlist',
  'spotify-playlist': 'Spotify Playlist',
  artist: 'Artist',
  episode: 'Episode',
  podcast: 'Podcast',
  unknown: '',
};

const FILTERS: { id: SearchFilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'playlist', label: 'Playlists' },
  { id: 'song', label: 'Songs' },
  { id: 'album', label: 'Albums' },
  { id: 'artist', label: 'Artists' },
  { id: 'video', label: 'Videos' },
];

/** Apple's result shelves, in its order, from results grouped by kind. */
function shelvesFor(results: SearchResults): Shelf[] {
  const shelf = (title: string, items: MusicItem[], layout: Shelf['layout']): Shelf | null =>
    items.length ? { title, strapline: null, layout, items, seeAll: null } : null;
  return [
    shelf('Artists', results.artists, 'circle'),
    shelf('Albums', results.albums, 'square'),
    shelf('Songs', results.songs, 'tracks'),
    shelf('Playlists', results.playlists, 'square'),
    shelf('Videos', results.videos, 'video'),
  ].filter((s): s is Shelf => !!s);
}

const sectionTitle = 'mx-(--body-gutter) mt-3 type-title-2-emphasized';
// Top Results: 3 columns, gap 20px; 118px cards with 90px artwork.
const topGrid =
  'mx-(--body-gutter) mt-3 mb-8 grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-[607px]:grid-cols-[minmax(0,1fr)] max-[607px]:gap-1';
const top =
  'grid min-h-[118px] grid-cols-[90px_minmax(0,1fr)] items-center gap-x-3.5 rounded-[8px] bg-quinary px-3 py-3.5 text-left hover:bg-quaternary';
const topText = 'flex min-w-0 flex-col gap-0.5';

function TopResult({ item }: { item: MusicItem }) {
  const href = hrefFor(item);
  const body = (
    <>
      <div className="w-[90px]">
        <Artwork src={item.thumbnail} displayWidth={90} radius={item.kind === 'artist' ? '50%' : 'var(--radius-artwork-small)'} />
      </div>
      <div className={topText}>
        <span className="line-clamp-2 type-title-3">{item.title}</span>
        <span className="truncate type-callout text-secondary">
          {[KIND_LABEL[item.kind], item.kind === 'artist' ? null : item.artists.map((a) => a.name).join(', ')].filter(Boolean).join(' · ')}
        </span>
      </div>
    </>
  );
  return href ? (
    <PrefetchLink to={href} className={top}>
      {body}
    </PrefetchLink>
  ) : (
    <button className={top} onClick={() => playTrack(item)}>
      {body}
    </button>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-busy="true">
      <div className={sectionTitle}>
        <SkeletonLine lineHeight={22} fontSize={17} width={130} />
      </div>
      <div className={topGrid} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={top}>
            <SkeletonBlock width={90} height={90} radius="var(--radius-artwork-small)" />
            <div className={topText}>
              <SkeletonLine lineHeight={20} fontSize={15} width="70%" />
              <SkeletonLine lineHeight={15} fontSize={12} width="40%" />
            </div>
          </div>
        ))}
      </div>
      <ShelfSkeleton kind="circle" />
      <ShelfSkeleton kind="square" />
    </div>
  );
}

function Results({ query, filter }: { query: string; filter: SearchFilterType }) {
  const search = useSearch(query, filter);
  if (search.isError) return <LoadError error={search.error} onRetry={() => void search.refetch()} />;
  if (!search.data) return <ResultsSkeleton />;
  const results = search.data;

  // Filter-specific views
  if (filter === 'playlist') {
    if (!results.playlists.length) {
      return <EmptyState title="No Playlists Found" detail={`Try searching for something other than “${query}”.`} />;
    }
    return (
      <div className="mx-(--body-gutter) mt-4 mb-10">
        <h2 className={sectionTitle}>Playlists</h2>
        <ul className={seeAllGrid}>
          {results.playlists.map((item) => (
            <li key={item.id}>
              <SquareLockup item={item} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (filter === 'album') {
    if (!results.albums.length) {
      return <EmptyState title="No Albums Found" detail={`Try searching for something other than “${query}”.`} />;
    }
    return (
      <div className="mx-(--body-gutter) mt-4 mb-10">
        <h2 className={sectionTitle}>Albums</h2>
        <ul className={seeAllGrid}>
          {results.albums.map((item) => (
            <li key={item.id}>
              <SquareLockup item={item} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (filter === 'artist') {
    if (!results.artists.length) {
      return <EmptyState title="No Artists Found" detail={`Try searching for something other than “${query}”.`} />;
    }
    return (
      <div className="mx-(--body-gutter) mt-4 mb-10">
        <h2 className={sectionTitle}>Artists</h2>
        <ul className={seeAllGrid}>
          {results.artists.map((item) => (
            <li key={item.id}>
              <CircleLockup item={item} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (filter === 'video') {
    if (!results.videos.length) {
      return <EmptyState title="No Videos Found" detail={`Try searching for something other than “${query}”.`} />;
    }
    return (
      <div className="mx-(--body-gutter) mt-4 mb-10">
        <h2 className={sectionTitle}>Videos</h2>
        <ul className={seeAllGrid} data-wide="true">
          {results.videos.map((item) => (
            <li key={item.id}>
              <VideoLockup item={item} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (filter === 'song') {
    if (!results.songs.length) {
      return <EmptyState title="No Songs Found" detail={`Try searching for something other than “${query}”.`} />;
    }
    const shelf: Shelf = {
      title: 'Songs',
      strapline: null,
      layout: 'tracks',
      items: results.songs,
      seeAll: null,
    };
    return <Shelves shelves={[shelf]} />;
  }

  // "all" filter
  const shelves = shelvesFor(results);
  if (!results.top.length && !shelves.length) {
    return <EmptyState title="No Results" detail={`Try a new search for something other than “${query}”.`} />;
  }
  return (
    <>
      {results.top.length > 0 && (
        <section aria-label="Top Results">
          <h2 className={sectionTitle}>Top Results</h2>
          <div className={topGrid}>
            {results.top.map((item) => (
              <TopResult key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
      <Shelves shelves={shelves} />
    </>
  );
}

function Landing() {
  const categories = useCategories();
  if (categories.isError) return <LoadError error={categories.error} onRetry={() => void categories.refetch()} />;
  if (!categories.data) {
    return (
      <div className="mx-(--body-gutter) mt-[46px] mb-8 grid grid-cols-4 gap-5 max-lg:grid-cols-3 max-[607px]:grid-cols-2 max-[607px]:gap-2.5" aria-busy="true">
        {Array.from({ length: 12 }, (_, i) => (
          <SkeletonBlock key={i} aspectRatio="16 / 9" radius="var(--radius-artwork-large)" />
        ))}
      </div>
    );
  }
  return <CategoryTiles groups={categories.data.map((g) => ({ ...g, title: g.title || 'Browse Categories' }))} />;
}

/** Search (report §6): a sticky bar with the field, filter tabs, then categories or grouped results. */
export default function SearchPage() {
  const { missing } = useYouTubeReady();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const filter = (params.get('filter') as SearchFilterType) || 'all';

  return (
    <>
      {/*
        The sticky scope bar holding the field and filter chips. Its glass sits on
        a layer behind it, not on the bar: an element with a backdrop-filter is a backdrop root, so
        the suggestions inside it could only blur the bar itself and showed the page underneath unblurred.
      */}
      <div className="sticky top-0 z-[calc(var(--z-default)+5)] flex flex-col items-center px-(--body-gutter) py-2.5 before:absolute before:inset-0 before:-z-1 before:bg-header-material before:[backdrop-filter:saturate(180%)_blur(20px)]">
        <SearchField
          initial={query}
          onSearch={(q) => {
            const next = new URLSearchParams();
            if (q) next.set('q', q);
            if (filter !== 'all') next.set('filter', filter);
            setParams(next);
          }}
        />
        {query && (
          <div className="flex w-full max-w-[680px] items-center justify-center gap-2 overflow-x-auto pt-2.5 pb-0.5 no-scrollbar select-none">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`shrink-0 rounded-full px-3.5 py-1 text-[13px] font-medium transition-colors ${
                    active
                      ? 'bg-pill-bg text-pill shadow-xs'
                      : 'bg-quaternary text-primary hover:bg-quinary'
                  }`}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    if (f.id === 'all') next.delete('filter');
                    else next.set('filter', f.id);
                    setParams(next);
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {missing ? <NeedsExtension what="and search YouTube Music" /> : query ? <Results query={query} filter={filter} /> : <Landing />}
    </>
  );
}
