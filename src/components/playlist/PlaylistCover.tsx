'use client';

import React, { useMemo, useState } from 'react';
import { generatePlaylistVisual, PlaylistVisualSpec } from '@/lib/playlist/playlistVisualGenerator';
import { PlaylistCoverMesh } from './PlaylistCoverMesh';
import { PlaylistCoverOverlay } from './PlaylistCoverOverlay';
import { PlaylistCoverTitle } from './PlaylistCoverTitle';

export interface PlaylistCoverProps {
  /** Canonical playlist ID (used for deterministic generation) */
  playlistId: string;
  /** Playlist display title */
  playlistName: string;
  /** Optional song count metadata */
  songCount?: number;
  /** Dimension scale: 'small' (48-64px), 'medium' (160-240px), 'large' (260-360px), 'hero' (380px+) */
  size?: 'small' | 'medium' | 'large' | 'hero';
  /** Whether the fluid aurora mesh animation is active (default: true) */
  animated?: boolean;
  /** Whether mouse/touch parallax is enabled (default: true for large/hero) */
  interactive?: boolean;
  /** Whether to render the title on the cover itself (default: true) */
  showTitle?: boolean;
  /** Whether this playlist is currently active / selected */
  isActive?: boolean;
  /** Additional custom classes */
  className?: string;
  /** Optional click handler */
  onClick?: () => void;
}

export function PlaylistCover({
  playlistId,
  playlistName,
  songCount,
  size = 'medium',
  animated = true,
  interactive,
  showTitle = true,
  isActive = false,
  className = '',
  onClick,
}: PlaylistCoverProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Deterministically compute visual specification (cached in memory)
  const spec: PlaylistVisualSpec = useMemo(() => {
    return generatePlaylistVisual(playlistId, playlistName);
  }, [playlistId, playlistName]);

  const isInteractive = interactive !== undefined ? interactive : size === 'large' || size === 'hero';

  // Corner rounding matched to size
  const roundedClass =
    size === 'small'
      ? 'rounded-xl'
      : size === 'medium'
      ? 'rounded-2xl'
      : size === 'large'
      ? 'rounded-3xl'
      : 'rounded-3xl sm:rounded-[32px]';

  // Hover and active states
  const hoverScaleClass =
    onClick || isInteractive
      ? 'hover:scale-[1.025] hover:brightness-[1.08] active:scale-[0.98]'
      : '';

  const activeGlowClass = isActive
    ? 'ring-2 ring-white/60 shadow-[0_0_24px_rgba(255,255,255,0.25)]'
    : 'shadow-[0_12px_36px_rgba(0,0,0,0.55)] hover:shadow-[0_18px_44px_rgba(0,0,0,0.75)]';

  return (
    <div
      role="img"
      aria-label={`${playlistName} playlist cover`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative aspect-square overflow-hidden select-none transition-all duration-300 ease-out ${roundedClass} ${hoverScaleClass} ${activeGlowClass} ${className}`}
      style={{ backgroundColor: spec.palette.darkBase }}
    >
      {/* ── 1. BASE LAYER: Deterministic Kinetic Aurora Mesh Canvas ── */}
      <PlaylistCoverMesh
        spec={spec}
        size={size}
        animated={animated}
        interactive={isInteractive && isHovered}
      />

      {/* ── 2. MID LAYER: Vignette, Readability Scrim, and Specular Rim Light ── */}
      <PlaylistCoverOverlay size={size} showTitle={showTitle} />

      {/* ── 3. TOP LAYER: Bottom-Left Modern Typography ── */}
      {showTitle && (
        <PlaylistCoverTitle
          title={playlistName}
          songCount={songCount}
          size={size}
        />
      )}
    </div>
  );
}
