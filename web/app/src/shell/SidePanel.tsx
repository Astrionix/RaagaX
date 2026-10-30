import { lazy, Suspense } from 'react';
import { useUi } from '@/state/ui';
import { UpNext } from './UpNext';

// am-lyrics is large; it loads the first time the panel opens (prompt §3).
const LyricsPanel = lazy(() => import('./LyricsPanel').then((m) => ({ default: m.LyricsPanel })));
const JamPanel = lazy(() => import('./JamPanel').then((m) => ({ default: m.JamPanel })));
const ConnectPanel = lazy(() => import('./ConnectPanel').then((m) => ({ default: m.ConnectPanel })));

/** Up Next / Lyrics / Jam / Connect glass panel */
export function SidePanel() {
  const panel = useUi((s) => s.sidePanel);
  const toggleSidePanel = useUi((s) => s.toggleSidePanel);
  // Hidden under the full-screen player, which has its own lyrics: one am-lyrics at a time.
  const fullScreen = useUi((s) => s.fullScreen);
  if (!panel || fullScreen) return null;

  return (
    <>
      <div
        className="absolute inset-0 z-[calc(var(--z-web-chrome)-1)] hidden bg-black/45 backdrop-blur-xs max-lg:block animate-fade"
        onClick={() => toggleSidePanel(panel)}
        aria-hidden="true"
      />
      <aside
        className="absolute inset-y-0 right-0 z-(--z-web-chrome) flex w-(--side-panel-width) animate-slide-in flex-col glass-material shadow-glass max-lg:w-[min(380px,88vw)] max-sm:w-full pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pr-[env(safe-area-inset-right,0px)]"
        aria-label={
          panel === 'up-next'
            ? 'Up Next'
            : panel === 'jam'
            ? 'Jam'
            : panel === 'connect'
            ? 'Connect to Device'
            : 'Lyrics'
        }
      >
        {panel === 'up-next' ? (
          <UpNext />
        ) : panel === 'jam' ? (
          <Suspense fallback={null}>
            <JamPanel />
          </Suspense>
        ) : panel === 'connect' ? (
          <Suspense fallback={null}>
            <ConnectPanel />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <LyricsPanel />
          </Suspense>
        )}
      </aside>
    </>
  );
}
