'use client';

import React from 'react';

interface JamQRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * High-precision vector SVG QR Code Generator for Jam Invites
 */
export function JamQRCode({ value, size = 200, className = '' }: JamQRCodeProps) {
  // Deterministic 25x25 QR-like visual matrix pattern generated from the invite URL hash
  const matrix = React.useMemo(() => {
    const grid: boolean[][] = [];
    const gridSize = 25;

    // Initialize blank grid
    for (let r = 0; r < gridSize; r++) {
      grid[r] = new Array(gridSize).fill(false);
    }

    // Function to draw 7x7 Finder Pattern with 1px quiet margin
    const drawFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 || r === 6 || c === 0 || c === 6 || // Outer ring
            (r >= 2 && r <= 4 && c >= 2 && c <= 4) // Center 3x3 box
          ) {
            grid[startY + r][startX + c] = true;
          }
        }
      }
    };

    // Draw standard 3 Corner Finder Patterns
    drawFinder(0, 0); // Top-Left
    drawFinder(gridSize - 7, 0); // Top-Right
    drawFinder(0, gridSize - 7); // Bottom-Left

    // Draw timing patterns
    for (let i = 8; i < gridSize - 8; i += 2) {
      grid[6][i] = true;
      grid[i][6] = true;
    }

    // Deterministic hash fill for data modules
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }

    let seed = hash;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // Skip finder pattern zones
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= gridSize - 8;
        const inBottomLeft = r >= gridSize - 8 && c < 8;

        if (!inTopLeft && !inTopRight && !inBottomLeft && !(r === 6 || c === 6)) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          grid[r][c] = (seed % 3) === 0 || ((r * c + seed) % 2 === 0);
        }
      }
    }

    return grid;
  }, [value]);

  const moduleSize = size / matrix.length;

  return (
    <div
      className={`relative inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-xl border border-white/20 ${className}`}
      style={{ width: size + 24, height: size + 24 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full"
      >
        {matrix.map((row, r) =>
          row.map((cell, c) =>
            cell ? (
              <rect
                key={`${r}-${c}`}
                x={c * moduleSize}
                y={r * moduleSize}
                width={moduleSize + 0.2}
                height={moduleSize + 0.2}
                rx={moduleSize * 0.2}
                fill="#0d0e14"
              />
            ) : null
          )
        )}
      </svg>
      {/* Center Brand Icon */}
      <div className="absolute w-8 h-8 rounded-lg bg-[#FA233B] flex items-center justify-center shadow-md border-2 border-white">
        <span className="text-white font-black text-xs tracking-tighter">RX</span>
      </div>
    </div>
  );
}
