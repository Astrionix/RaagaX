export interface ConnectIconProps {
  size?: number;
  className?: string;
  connected?: boolean;
}

/**
 * Universal Connect to Device icon (Spotify Connect / Material Devices glyph).
 * Highlights and renders active signal waves when a remote speaker is connected.
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
      {/* Desktop / Speaker monitor */}
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      {connected ? (
        <>
          <circle cx="12" cy="10" r="2" fill="currentColor" stroke="none" />
          <path d="M7 10a5 5 0 0 1 10 0" strokeWidth="1.8" />
        </>
      ) : (
        <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
      )}
    </svg>
  );
}
