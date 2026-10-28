export interface JamIconProps {
  size?: number;
  className?: string;
}

/**
 * Spotify-style Jam / Listen Together 3-person collaborative session icon.
 * Matches the official Jam glyph (Image 1 & 2).
 */
export function JamIcon({ size = 20, className = '' }: JamIconProps) {
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
      {/* Foreground center person */}
      <circle cx="12" cy="14" r="3" />
      <path d="M7 21v-.6a5 5 0 0 1 10 0v.6" />

      {/* Background left person */}
      <circle cx="6.5" cy="7" r="2.6" />
      <path d="M2.5 14.5a4.5 4.5 0 0 1 5.7-3.9" />

      {/* Background right person */}
      <circle cx="17.5" cy="7" r="2.6" />
      <path d="M15.8 10.6a4.5 4.5 0 0 1 5.7 3.9" />
    </svg>
  );
}
