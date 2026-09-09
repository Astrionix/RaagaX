const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgCode = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3157"/>
      <stop offset="50%" stop-color="#ff174f"/>
      <stop offset="100%" stop-color="#ff3157"/>
    </linearGradient>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g transform="translate(256, 256) scale(1.80) translate(-255, -272.5)">
    <g fill="none" stroke="url(#neon)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>

    <g fill="none" stroke="url(#neon)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="220" cy="326" r="42"/>
      <path d="M 262 326 L 262 178 L 330 216"/>
    </g>
  </g>
</svg>
`;

const foregroundSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="neonFg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3157"/>
      <stop offset="50%" stop-color="#ff174f"/>
      <stop offset="100%" stop-color="#ff3157"/>
    </linearGradient>
  </defs>
  <g transform="translate(256, 256) scale(1.65) translate(-255, -272.5)">
    <g fill="none" stroke="url(#neonFg)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">
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

  <g transform="translate(256, 256) scale(1.80) translate(-255, -272.5)">
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

  <g transform="translate(256, 256) scale(1.80) translate(-255, -272.5)">
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

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generate() {
  const baseRes = path.resolve(__dirname, '../android/app/src/main/res');

  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(baseRes, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.png
    await sharp(Buffer.from(fullIconWithBg))
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png
    await sharp(Buffer.from(roundIconWithBg))
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png
    await sharp(Buffer.from(foregroundSvg))
      .resize(Math.round(size * 1.5), Math.round(size * 1.5))
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`Generated icons for ${folder} (${size}x${size})`);
  }

  // Also save master app icon for web / desktop
  await sharp(Buffer.from(fullIconWithBg))
    .resize(512, 512)
    .png()
    .toFile(path.resolve(__dirname, '../public/app-icon.png'));

  console.log('Done generating all extra-large crisp RaagaX master icons!');
}

generate().catch(console.error);
