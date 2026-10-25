import { Menu } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { LogoMark } from '@/components/icons/LogoMark';
import { useUi } from '@/state/ui';

/** Below 484px the sidebar folds into this bar and a drawer (report §11). */
export function MobileTopBar() {
  const setDrawerOpen = useUi((s) => s.setDrawerOpen);
  return (
    <header className="hidden max-sm:absolute max-sm:inset-x-0 max-sm:top-0 max-sm:z-[calc(var(--z-web-chrome)-2)] max-sm:grid max-sm:h-(--mobile-top-bar-height) max-sm:grid-cols-[44px_1fr_44px] max-sm:items-center max-sm:px-3.5 max-sm:glass-material">
      <button className="grid size-11 place-items-center rounded-full" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
        <Menu size={22} strokeWidth={2} />
      </button>
      <PrefetchLink to="/home" className="inline-flex items-center justify-self-center py-0.5 select-none" aria-label="Raaga, Home">
        <picture className="inline-flex items-center">
          <source srcSet="/raaga_icon.png" media="(prefers-color-scheme: dark)" />
          <img
            src="/raaga_logo_dark.png"
            alt="Raaga"
            className="h-7 w-auto max-w-[130px] object-contain drop-shadow-[0_1px_6px_rgba(239,68,68,0.25)]"
          />
        </picture>
      </PrefetchLink>
      <span className="w-11" />
    </header>
  );
}
