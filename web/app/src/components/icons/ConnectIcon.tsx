export interface ConnectIconProps {
  size?: number;
  className?: string;
  connected?: boolean;
}

/**
 * Spotify Connect Style icon (Monitor + Speaker).
 * Features a desktop display in the background and a smart speaker in the foreground.
 * When connected, highlights the speaker driver and animates sound waves.
 */
export function ConnectIcon({ size = 20, className = '', connected = false }: ConnectIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Background Monitor / TV screen */}
      <path d="M7 6H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" />
      <path d="M5 19h3" />
      <path d="M6 16v3" />

      {/* Speaker unit in foreground */}
      <rect width="9" height="15" x="11" y="5" rx="2" />
      {/* Speaker Tweeter dot */}
      <circle cx="15.5" cy="8.5" r="0.75" fill="currentColor" stroke="none" />
      {/* Speaker Subwoofer / Driver */}
      <circle
        cx="15.5"
        cy="14"
        r={connected ? 2.2 : 2}
        fill={connected ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Active Audio Signal Broadcast Waves */}
      {connected && (
        <path
          d="M21.5 8.5a4.5 4.5 0 0 1 0 7.5"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="opacity-90"
        />
      )}
    </svg>
  );
}
