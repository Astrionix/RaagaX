const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateTVBanner() {
  console.log('🎨 Generating 16:9 Android TV Launcher Banner (1920x1080 UHD)...');

  const width = 1920;
  const height = 1080;

  // Render high-res 16:9 Apple TV style banner SVG with glass gradient, RaagaX logo & typography
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f0f15" />
          <stop offset="40%" stop-color="#181824" />
          <stop offset="100%" stop-color="#09090d" />
        </linearGradient>
        <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FA233B" />
          <stop offset="100%" stop-color="#B91C1C" />
        </linearGradient>
        <radialGradient id="glow" cx="30%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#FA233B" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#FA233B" stop-opacity="0" />
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="20" stdDeviation="30" flood-color="#000000" flood-opacity="0.8"/>
        </filter>
      </defs>

      <!-- 1. Background Surface -->
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
      
      <!-- 2. Ambient Lighting Glow -->
      <circle cx="500" cy="540" r="700" fill="url(#glow)" />
      
      <!-- 3. Glassmorphic Decorative Card -->
      <rect x="120" y="120" width="${width - 240}" height="${height - 240}" rx="60" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="3" filter="url(#shadow)"/>

      <!-- 4. RaagaX Logo Icon -->
      <g transform="translate(320, 360)">
        <rect width="360" height="360" rx="90" fill="url(#redGrad)" filter="url(#shadow)"/>
        <!-- Note Symbol inside Icon -->
        <path d="M220 110 V230 C220 252 202 270 180 270 C158 270 140 252 140 230 C140 208 158 190 180 190 C190 190 199 194 206 200 V140 L130 160 V250 C130 272 112 290 90 290 C68 290 50 272 50 250 C50 228 68 210 90 210 C100 210 109 214 116 220 V120 L220 90 Z" fill="#FFFFFF"/>
      </g>

      <!-- 5. RaagaX Brand Typography & TV Tagline -->
      <g transform="translate(760, 480)">
        <text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="140" fill="#FFFFFF" letter-spacing="-3">RaagaX</text>
        <text y="90" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="42" fill="#FA233B" letter-spacing="8">LOSSLESS MUSIC FOR TV</text>
      </g>
    </svg>
  `;

  const outputDir = path.resolve(__dirname, '../android/app/src/main/res/drawable');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'tv_banner.png');

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`✨ Generated 16:9 TV Banner at: ${outputPath}`);
}

generateTVBanner().catch(console.error);
