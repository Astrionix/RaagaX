import { Check, Copy, MoreHorizontal, Plus, Shuffle } from 'lucide-react';
import { useRef, useState } from 'react';
import { Menu, MenuHeader, MenuItem, MenuSeparator } from '@/components/Menu';
import { PrefetchLink } from '@/components/PrefetchLink';
import { PlayIcon } from '@/components/icons/Transport';
import { useSetListSaved, useSignedIn } from '@/data/music/queries';
import type { AppleMotion } from '@/data/apple/motionArt';
import type { HeaderInfo } from '@/data/music/types';
import { Artwork } from './Artwork';
import { ExplicitBadge } from './ExplicitBadge';
import { MotionArtwork } from './MotionArtwork';
import { artistHref } from './links';

export type SortOption =
  | 'default'
  | 'title-asc'
  | 'title-desc'
  | 'artist-asc'
  | 'date-added-desc'
  | 'date-added-asc';

interface DetailHeaderProps {
  info: HeaderInfo;
  onPlay: () => void;
  onShuffle: () => void;
  canPlay: boolean;
  /** More actions after the library toggle (a Spotify playlist's Import). */
  extra?: React.ReactNode;
  /** Apple's motion artwork for an album, over the cover once it plays. */
  motion?: AppleMotion | null;
  /** Current active sorting choice. */
  sort?: SortOption;
  /** Callback when user selects a sort option. Enables the three-dots button. */
  onSortChange?: (sort: SortOption) => void;
  /** Optional custom copy link or share handler. If omitted, copies window.location.href. */
  onShare?: () => void;
}

/** Shuffle (circle) · Play (pill), report §14; also the Spotify playlist's Import button. */
export const detailButton = {
  pill: 'inline-flex h-9 min-w-[150px] items-center justify-center gap-1.5 rounded-[24px] bg-pill-bg px-3 type-title-3-emphasized text-pill disabled:opacity-40 enabled:hover:opacity-90',
  circle:
    'grid size-9 place-items-center rounded-full border-[0.75px] border-quaternary bg-quinary text-primary disabled:opacity-40 enabled:hover:bg-quaternary',
};

/**
 * Album and playlist header (report §3, §14): artwork with its glow, title,
 * artist, metadata, a three-line description, then Shuffle · Play.
 */
export function DetailHeader({ info, onPlay, onShuffle, canPlay, extra, motion, sort = 'default', onSortChange, onShare }: DetailHeaderProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const signedIn = useSignedIn();
  const setSaved = useSetListSaved();
  const library = signedIn ? info.library : null;

  const handleCopy = () => {
    if (onShare) {
      onShare();
    } else {
      void navigator.clipboard.writeText(window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setMenuOpen(false);
  };
  return (
    // Artwork beside the headings, description and actions; stacked and centred below 768px.
    <div className="mx-(--body-gutter) mb-10 grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-x-[34px] pt-11 [grid-template-areas:'artwork_headings'_'artwork_description'_'artwork_actions'] max-md:grid-cols-[1fr] max-md:grid-rows-[auto] max-md:justify-items-center max-md:pt-4 max-md:text-center max-md:[grid-template-areas:'artwork'_'headings'_'actions'_'description']">
      <div className="relative w-[270px] self-start rounded-artwork-lg shadow-[0_10px_20px_0_var(--radiosityShadowColor)] [grid-area:artwork] max-lg:w-[220px] max-md:w-[min(270px,70vw)]">
        {info.thumbnail && (
          // A blurred copy behind the artwork: Apple's radiosity glow.
          <div className="absolute inset-0 -z-1 scale-88 opacity-30 blur-[20px] saturate-200" aria-hidden="true">
            <Artwork src={info.thumbnail} displayWidth={80} radius="var(--radius-artwork-large)" />
          </div>
        )}
        <Artwork src={info.thumbnail} displayWidth={270} radius="var(--radius-artwork-large)" eager />
        {/* Apple's motion artwork, over the cover once it's playing. */}
        {motion && (
          <MotionArtwork
            key={motion.url}
            motion={motion}
            className="absolute inset-0 size-full rounded-artwork-lg object-cover opacity-0 transition-opacity duration-600 ease-in data-ready:opacity-100"
          />
        )}
      </div>
      <div className="flex flex-col pt-[37px] [grid-area:headings] max-md:items-center max-md:pt-5">
        <h1 className="flex items-center type-large-title-emphasized leading-[30px] max-md:justify-center">
          {info.title}
          {info.explicit && <ExplicitBadge size={16} />}
        </h1>
        {info.artists.length > 0 && (
          <div className="type-large-title leading-[30px] text-primary">
            {info.artists.map((artist, i) => {
              const href = artistHref(artist.id);
              return (
                <span key={`${artist.name}-${i}`}>
                  {i > 0 && ', '}
                  {href ? (
                    <PrefetchLink to={href} className="hover:underline">
                      {artist.name}
                    </PrefetchLink>
                  ) : (
                    artist.name
                  )}
                </span>
              );
            })}
          </div>
        )}
        <div className="mt-1 type-callout-emphasized text-secondary">{[info.subtitle, info.meta].filter(Boolean).join(' · ')}</div>
      </div>
      {info.description && (
        <div className="mt-[38px] flex max-w-[440px] items-end type-body-tall text-secondary [grid-area:description] max-md:mt-5">
          <p className={expanded ? 'min-w-0' : 'min-w-0 line-clamp-3'}>
            {info.description}
          </p>
          {!expanded && info.description.length > 180 && (
            <button className="shrink-0 ps-[5px] type-subhead-emphasized text-primary" onClick={() => setExpanded(true)}>
              MORE
            </button>
          )}
        </div>
      )}
      <div className="mt-3.5 flex items-center gap-3.5 self-end [grid-area:actions]">
        <button className={detailButton.circle} aria-label="Shuffle" onClick={onShuffle} disabled={!canPlay}>
          <Shuffle size={18} strokeWidth={2.2} />
        </button>
        <button className={detailButton.pill} onClick={onPlay} disabled={!canPlay}>
          <PlayIcon size={18} />
          <span>Play</span>
        </button>
        {library && (
          <button
            className={detailButton.circle}
            aria-label={library.saved ? 'Remove from Library' : 'Add to Library'}
            aria-pressed={library.saved}
            title={library.saved ? 'In your library' : 'Add to Library'}
            disabled={setSaved.isPending}
            onClick={() => setSaved.mutate({ playlistId: library.playlistId, saved: !library.saved })}
          >
            {library.saved ? <Check size={18} strokeWidth={2.4} /> : <Plus size={18} strokeWidth={2.4} />}
          </button>
        )}
        {onSortChange && (
          <>
            <button
              ref={moreRef}
              className={detailButton.circle}
              aria-label="More options"
              title="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} strokeWidth={2.2} />
            </button>
            {menuOpen && moreRef.current && (
              <Menu
                anchor={moreRef.current}
                placement="below-end"
                onClose={() => setMenuOpen(false)}
                label="Playlist options"
              >
                <MenuHeader>Sort By</MenuHeader>
                <MenuItem
                  checked={sort === 'default'}
                  onSelect={() => {
                    onSortChange('default');
                    setMenuOpen(false);
                  }}
                >
                  Default order
                </MenuItem>
                <MenuItem
                  checked={sort === 'title-asc'}
                  onSelect={() => {
                    onSortChange('title-asc');
                    setMenuOpen(false);
                  }}
                >
                  Alphabetical (A to Z)
                </MenuItem>
                <MenuItem
                  checked={sort === 'title-desc'}
                  onSelect={() => {
                    onSortChange('title-desc');
                    setMenuOpen(false);
                  }}
                >
                  Alphabetical (Z to A)
                </MenuItem>
                <MenuItem
                  checked={sort === 'artist-asc'}
                  onSelect={() => {
                    onSortChange('artist-asc');
                    setMenuOpen(false);
                  }}
                >
                  Artist (A to Z)
                </MenuItem>
                <MenuItem
                  checked={sort === 'date-added-desc'}
                  onSelect={() => {
                    onSortChange('date-added-desc');
                    setMenuOpen(false);
                  }}
                >
                  Date added (newest first)
                </MenuItem>
                <MenuItem
                  checked={sort === 'date-added-asc'}
                  onSelect={() => {
                    onSortChange('date-added-asc');
                    setMenuOpen(false);
                  }}
                >
                  Date added (oldest first)
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
                  onSelect={handleCopy}
                >
                  {copied ? 'Link copied!' : 'Copy link'}
                </MenuItem>
              </Menu>
            )}
          </>
        )}
        {extra}
      </div>
    </div>
  );
}
