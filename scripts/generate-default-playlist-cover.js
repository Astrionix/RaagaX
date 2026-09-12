const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const width = 1024;
const height = 1024;

const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#0A0C14"/>
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1A1D2B"/>
      <stop offset="50%" stop-color="#0E101A"/>
      <stop offset="100%" stop-color="#07090E"/>
    </linearGradient>

    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3157"/>
      <stop offset="50%" stop-color="#ff174f"/>
      <stop offset="100%" stop-color="#ff3157"/>
    </linearGradient>

    <radialGradient id="centerGlow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#ff3157" stop-opacity="0.42"/>
      <stop offset="60%" stop-color="#e50914" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0A0C14" stop-opacity="0"/>
    </radialGradient>

    <filter id="glowFilter" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <linearGradient id="glassBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.03"/>
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>

  <!-- Subtle Radial Backlight Glow -->
  <circle cx="512" cy="460" r="420" fill="url(#centerGlow)"/>

  <!-- Inner Glass Frame -->
  <rect x="36" y="36" width="952" height="952" rx="48" fill="none" stroke="url(#glassBorder)" stroke-width="2"/>

  <!-- Master RaagaX Neon Emblem -->
  <g transform="translate(512, 450) scale(2.35) translate(-255, -272.5)">
    <!-- Glow Outline -->
    <g fill="none" stroke="url(#neonGrad)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowFilter)">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>

    <!-- Clean Note -->
    <g fill="none" stroke="url(#neonGrad)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>
  </g>

  <!-- Subtitle Tagline Badge -->
  <g transform="translate(512, 850)">
    <rect x="-120" y="-22" width="240" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1"/>
    <text x="0" y="6" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.90" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" letter-spacing="5">RAAGAX PLAYLIST</text>
  </g>
</svg>
`;

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const targetPath = path.join(rootDir, 'public', 'default-playlist-cover.png');

  await sharp(Buffer.from(svg))
    .png()
    .toFile(targetPath);

  console.log('✓ Successfully created 1024x1024 default playlist cover image:', targetPath);
}

main().catch(console.error);
