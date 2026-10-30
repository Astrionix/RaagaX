import { JamIcon } from '@/components/icons/JamIcon';
import { DesktopDownloadButton } from '@/components/DesktopDownloadButton';
import { useNearbyJams, useParty } from '@/party/listenTogether';
import { useUi } from '@/state/ui';

/**
 * Top-right action controls:
 * Places the Desktop Download button and Jam button side-by-side cleanly
 * without any overlapping or full desktop top bar.
 */
export function JamTopButton() {
  const toggleSidePanel = useUi((s) => s.toggleSidePanel);
  const sidePanel = useUi((s) => s.sidePanel);
  const inParty = useParty((s) => Boolean(s.code));
  const memberCount = useParty((s) => s.members.length);
  const nearbyJams = useNearbyJams((s) => s.nearbyJams);
  const hasNearbyJam = !inParty && nearbyJams.length > 0;

  return (
    <div
      className="fixed top-6 z-[calc(var(--z-web-chrome)+1)] hidden lg:flex items-center gap-2.5 transition-[right] duration-300 ease-out"
      style={{
        right: sidePanel ? 'calc(var(--side-panel-width) + 20px)' : '28px',
      }}
    >
      {/* Desktop Download button */}
      <DesktopDownloadButton />

      {/* Jam (Listen Together) button */}
      <button
        id="jam-top-bar-button"
        onClick={() => toggleSidePanel('jam')}
        aria-label="Jam (Listen Together)"
        aria-pressed={sidePanel === 'jam'}
        title={
          inParty
            ? `Live Jam: ${memberCount} listening together`
            : hasNearbyJam
              ? `Nearby Jam detected on Wi-Fi! Tap to join`
              : 'Jam (Listen Together)'
        }
        className={`group relative grid size-10 place-items-center rounded-full border-[0.75px] transition-all duration-200 active:scale-95 shadow-sm cursor-pointer select-none touch-manipulation ${
          sidePanel === 'jam'
            ? 'border-key bg-key/15 text-key ring-2 ring-key/30'
            : inParty
              ? 'border-green/50 bg-green/15 text-green shadow-[0_0_12px_rgba(34,197,94,0.25)]'
              : hasNearbyJam
                ? 'border-green/60 bg-green/10 text-green shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                : 'border-quaternary bg-quinary text-primary hover:bg-quaternary hover:text-primary'
        }`}
      >
        <JamIcon size={19} className={inParty || hasNearbyJam ? 'text-green' : 'currentColor'} />

        {/* Glowing Indicator Dot: Green for active party, pulsing beacon for nearby discovered Jam on Wi-Fi */}
        {inParty ? (
          <span className="absolute -top-0.5 -right-0.5 flex size-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-75 animate-ping" />
            <span className="relative inline-flex size-3 rounded-full bg-green border-2 border-page" />
          </span>
        ) : hasNearbyJam ? (
          <span className="absolute -top-0.5 -right-0.5 flex size-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-80 animate-ping" />
            <span className="relative inline-flex size-2.5 rounded-full bg-green border border-page" />
          </span>
        ) : null}
      </button>
    </div>
  );
}
