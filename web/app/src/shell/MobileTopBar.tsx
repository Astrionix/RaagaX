import { Menu, Search } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { JamIcon } from '@/components/icons/JamIcon';
import { useParty } from '@/party/listenTogether';
import { useUi } from '@/state/ui';

/** On tablets in portrait and phones (< 1000px), the sidebar folds into this bar and drawer. */
export function MobileTopBar() {
  const setDrawerOpen = useUi((s) => s.setDrawerOpen);
  const toggleSidePanel = useUi((s) => s.toggleSidePanel);
  const sidePanel = useUi((s) => s.sidePanel);
  const inParty = useParty((s) => Boolean(s.code));

  return (
    <header className="hidden max-lg:absolute max-lg:inset-x-0 max-lg:top-0 max-lg:z-[calc(var(--z-web-chrome)-2)] max-lg:grid max-lg:h-(--mobile-top-bar-height) max-lg:pt-[env(safe-area-inset-top,0px)] max-lg:grid-cols-[48px_1fr_auto] max-lg:items-center max-lg:px-3 sm:max-lg:px-4 max-lg:pl-[max(12px,env(safe-area-inset-left,12px))] max-lg:pr-[max(12px,env(safe-area-inset-right,12px))] max-lg:glass-material border-b border-white/[0.05] select-none touch-manipulation">
      <button
        className="grid size-11 place-items-center rounded-full hover:bg-quinary text-primary transition-colors active:scale-95 touch-manipulation"
        aria-label="Open menu"
        onClick={() => setDrawerOpen(true)}
      >
        <Menu size={22} strokeWidth={2} />
      </button>
      <PrefetchLink to="/home" className="inline-flex items-center justify-self-center py-0.5 active:scale-98 transition-transform" aria-label="Raaga, Home">
        <picture className="inline-flex items-center">
          <source srcSet="/raaga_icon.png" media="(prefers-color-scheme: dark)" />
          <img
            src="/raaga_logo_dark.png"
            alt="Raaga"
            className="h-7 sm:h-7.5 w-auto max-w-[130px] sm:max-w-[150px] object-contain drop-shadow-[0_1px_6px_rgba(239,68,68,0.25)]"
          />
        </picture>
      </PrefetchLink>
      <div className="flex items-center gap-1 justify-self-end">
        <button
          onClick={() => toggleSidePanel('jam')}
          aria-label="Jam (Listen Together)"
          aria-pressed={sidePanel === 'jam'}
          className={`relative grid size-10 place-items-center rounded-full active:scale-95 transition-all ${
            sidePanel === 'jam'
              ? 'bg-white/20 text-white'
              : inParty
                ? 'bg-green/15 text-green'
                : 'text-secondary hover:text-primary hover:bg-quinary'
          }`}
        >
          <JamIcon size={19} className={inParty ? 'text-green' : 'currentColor'} />
          {inParty && (
            <span className="absolute 1 top-1 right-1 flex size-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-75 animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-green" />
            </span>
          )}
        </button>
        <PrefetchLink
          to="/search"
          className="grid size-10 place-items-center rounded-full hover:bg-quinary text-secondary hover:text-primary transition-colors active:scale-95 touch-manipulation"
          aria-label="Search"
        >
          <Search size={20} strokeWidth={2} />
        </PrefetchLink>
      </div>
    </header>
  );
}
