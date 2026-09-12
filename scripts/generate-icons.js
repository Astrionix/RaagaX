const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Safe Adaptive Foreground (Fits within 66% circular safe zone)
const foregroundSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="neonFg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3157"/>
      <stop offset="50%" stop-color="#ff174f"/>
      <stop offset="100%" stop-color="#ff3157"/>
    </linearGradient>
    <filter id="glowFg" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g transform="translate(256, 256) scale(1.15) translate(-255, -272.5)">
    <g fill="none" stroke="url(#neonFg)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowFg)">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>

    <g fill="none" stroke="url(#neonFg)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>
  </g>
</svg>
`;

const fullIconWithBg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#07090E"/>
  <defs>
    <linearGradient id="neonFull" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3157"/>
      <stop offset="50%" stop-color="#ff174f"/>
      <stop offset="100%" stop-color="#ff3157"/>
    </linearGradient>
    <filter id="glowFull" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g transform="translate(256, 256) scale(1.18) translate(-255, -272.5)">
    <g fill="none" stroke="url(#neonFull)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowFull)">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>

    <g fill="none" stroke="url(#neonFull)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>
  </g>
</svg>
`;

const roundIconWithBg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="256" fill="#07090E"/>
  <defs>
    <linearGradient id="neonRound" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3157"/>
      <stop offset="50%" stop-color="#ff174f"/>
      <stop offset="100%" stop-color="#ff3157"/>
    </linearGradient>
    <filter id="glowRound" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g transform="translate(256, 256) scale(1.18) translate(-255, -272.5)">
    <g fill="none" stroke="url(#neonRound)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowRound)">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>

    <g fill="none" stroke="url(#neonRound)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>
  </g>
</svg>
`;

// 4K Splash Master Generator SVG
function makeSplashSvg(width, height) {
  const minDim = Math.min(width, height);
  const logoScale = (minDim * 0.38) / 215; // Scale logo to ~38% of shortest dimension
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#07090E"/>
  <defs>
    <linearGradient id="splashNeon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3157"/>
      <stop offset="50%" stop-color="#ff174f"/>
      <stop offset="100%" stop-color="#ff3157"/>
    </linearGradient>
    <radialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff3157" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#07090E" stop-opacity="0"/>
    </radialGradient>
    <filter id="glowSplash" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Central Soft Ambient Backlight -->
  <circle cx="${width / 2}" cy="${height / 2}" r="${minDim * 0.4}" fill="url(#ambientGlow)"/>

  <!-- Centered RaagaX 4K Master Note -->
  <g transform="translate(${width / 2}, ${height / 2}) scale(${logoScale}) translate(-255, -272.5)">
    <g fill="none" stroke="url(#splashNeon)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowSplash)">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>

    <g fill="none" stroke="url(#splashNeon)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>
  </g>
</svg>
`;
}

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const splashDirs = [
  { dir: 'drawable', w: 2048, h: 2048 },
  { dir: 'drawable-port-mdpi', w: 640, h: 960 },
  { dir: 'drawable-port-hdpi', w: 960, h: 1440 },
  { dir: 'drawable-port-xhdpi', w: 1280, h: 1920 },
  { dir: 'drawable-port-xxhdpi', w: 1920, h: 2880 },
  { dir: 'drawable-port-xxxhdpi', w: 2160, h: 3840 },
  { dir: 'drawable-land-mdpi', w: 960, h: 640 },
  { dir: 'drawable-land-hdpi', w: 1440, h: 960 },
  { dir: 'drawable-land-xhdpi', w: 1920, h: 1280 },
  { dir: 'drawable-land-xxhdpi', w: 2880, h: 1920 },
  { dir: 'drawable-land-xxxhdpi', w: 3840, h: 2160 },
];

async function generate() {
  const baseRes = path.resolve(__dirname, '../android/app/src/main/res');

  // 1. Generate Mipmap Launcher Icons
  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(baseRes, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await sharp(Buffer.from(fullIconWithBg))
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    await sharp(Buffer.from(roundIconWithBg))
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    await sharp(Buffer.from(foregroundSvg))
      .resize(Math.round(size * 1.5), Math.round(size * 1.5))
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`✓ Generated icons for ${folder} (${size}x${size})`);
  }

  // 2. Generate 4K Ultra-HD Splash Drawables
  for (const item of splashDirs) {
    const dir = path.join(baseRes, item.dir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const splashSvg = makeSplashSvg(item.w, item.h);
    await sharp(Buffer.from(splashSvg))
      .png()
      .toFile(path.join(dir, 'splash.png'));

    console.log(`✓ Generated 4K Splash for ${item.dir} (${item.w}x${item.h})`);
  }

  // 3. Generate Master Web & Desktop App Icons
  await sharp(Buffer.from(fullIconWithBg))
    .resize(512, 512)
    .png()
    .toFile(path.resolve(__dirname, '../public/app-icon.png'));

  await sharp(Buffer.from(fullIconWithBg))
    .resize(512, 512)
    .png()
    .toFile(path.resolve(__dirname, '../public/icon-512.png'));

  await sharp(Buffer.from(fullIconWithBg))
    .resize(192, 192)
    .png()
    .toFile(path.resolve(__dirname, '../public/icon-192.png'));

  console.log('🎉 Done generating all extra-large 4K crisp RaagaX master icons & splash surfaces!');
}

generate().catch(console.error);
