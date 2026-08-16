const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgCode = `
<svg width="512" height="512" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rxRedGrad" x1="20" y1="18" x2="84" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF2E38"/>
      <stop offset="60%" stop-color="#E50914"/>
      <stop offset="100%" stop-color="#A80008"/>
    </linearGradient>
    <filter id="rxGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#E50914" flood-opacity="0.5"/>
    </filter>
  </defs>
  <!-- Vertical Sound-Stem -->
  <rect x="20" y="18" width="12" height="64" rx="6" fill="#FFFFFF"/>
  <!-- Sound Loop + Play Geometry -->
  <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill="url(#rxRedGrad)" filter="url(#rxGlow)"/>
  <!-- Inner Play Triangular Negative -->
  <path d="M50 31L66 42L50 53V31Z" fill="#060709"/>
  <!-- Kinetic Forward Motion Kick -->
  <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill="#FF1E27" filter="url(#rxGlow)"/>
  <!-- Gold Sparkle Accent -->
  <path d="M82 12L84 17L89 19L84 21L82 26L80 21L75 19L80 17Z" fill="#FFD700"/>
</svg>
`;

const foregroundSvg = `
<svg width="512" height="512" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rxRedGradFg" x1="20" y1="18" x2="84" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF2E38"/>
      <stop offset="60%" stop-color="#E50914"/>
      <stop offset="100%" stop-color="#A80008"/>
    </linearGradient>
  </defs>
  <g transform="translate(10, 10) scale(0.88)">
    <!-- Vertical Sound-Stem -->
    <rect x="20" y="18" width="12" height="64" rx="6" fill="#FFFFFF"/>
    <!-- Sound Loop + Play Geometry -->
    <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill="url(#rxRedGradFg)"/>
    <!-- Inner Play Triangular Negative -->
    <path d="M50 31L66 42L50 53V31Z" fill="#060709"/>
    <!-- Kinetic Forward Motion Kick -->
    <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill="#FF1E27"/>
    <!-- Gold Sparkle Accent -->
    <path d="M82 12L84 17L89 19L84 21L82 26L80 21L75 19L80 17Z" fill="#FFD700"/>
  </g>
</svg>
`;

const fullIconWithBg = `
<svg width="512" height="512" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="22" fill="#07090E"/>
  <defs>
    <linearGradient id="rxRedGradFull" x1="20" y1="18" x2="84" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF2E38"/>
      <stop offset="60%" stop-color="#E50914"/>
      <stop offset="100%" stop-color="#A80008"/>
    </linearGradient>
  </defs>
  <!-- Vertical Sound-Stem -->
  <rect x="20" y="18" width="12" height="64" rx="6" fill="#FFFFFF"/>
  <!-- Sound Loop + Play Geometry -->
  <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill="url(#rxRedGradFull)"/>
  <!-- Inner Play Triangular Negative -->
  <path d="M50 31L66 42L50 53V31Z" fill="#07090E"/>
  <!-- Kinetic Forward Motion Kick -->
  <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill="#FF1E27"/>
  <!-- Gold Sparkle Accent -->
  <path d="M82 12L84 17L89 19L84 21L82 26L80 21L75 19L80 17Z" fill="#FFD700"/>
</svg>
`;

const roundIconWithBg = `
<svg width="512" height="512" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="50" fill="#07090E"/>
  <defs>
    <linearGradient id="rxRedGradRound" x1="20" y1="18" x2="84" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF2E38"/>
      <stop offset="60%" stop-color="#E50914"/>
      <stop offset="100%" stop-color="#A80008"/>
    </linearGradient>
  </defs>
  <!-- Vertical Sound-Stem -->
  <rect x="20" y="18" width="12" height="64" rx="6" fill="#FFFFFF"/>
  <!-- Sound Loop + Play Geometry -->
  <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill="url(#rxRedGradRound)"/>
  <!-- Inner Play Triangular Negative -->
  <path d="M50 31L66 42L50 53V31Z" fill="#07090E"/>
  <!-- Kinetic Forward Motion Kick -->
  <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill="#FF1E27"/>
  <!-- Gold Sparkle Accent -->
  <path d="M82 12L84 17L89 19L84 21L82 26L80 21L75 19L80 17Z" fill="#FFD700"/>
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

  console.log('Done generating all crisp RaagaX master icons!');
}

generate().catch(console.error);
