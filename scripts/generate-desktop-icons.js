/**
 * RaagaX Desktop Icon Generator
 * Generates:
 * 1. macOS native `public/brand/icon.icns` using Apple's iconutil
 * 2. Windows multi-resolution `public/brand/icon.ico` (16, 24, 32, 48, 64, 128, 256 px)
 * 3. High-res master `public/app-icon.png` (1024x1024)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');
const brandDir = path.join(rootDir, 'public', 'brand');

const masterIconSvg = `
<svg width="1024" height="1024" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="22" fill="#07090E"/>
  <defs>
    <linearGradient id="rxRedGradFull" x1="20" y1="18" x2="84" y2="82" gradientUnits="userSpaceOnUse">
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
  <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill="url(#rxRedGradFull)" filter="url(#rxGlow)"/>
  <!-- Inner Play Triangular Negative -->
  <path d="M50 31L66 42L50 53V31Z" fill="#07090E"/>
  <!-- Kinetic Forward Motion Kick -->
  <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill="#FF1E27" filter="url(#rxGlow)"/>
  <!-- Gold Sparkle Accent -->
  <path d="M82 12L84 17L89 19L84 21L82 26L80 21L75 19L80 17Z" fill="#FFD700"/>
</svg>
`;

/**
 * Packs multiple PNG buffers into a single Windows .ico file buffer
 */
function createIcoBuffer(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const directorySize = count * 16;
  let offset = headerSize + directorySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Image type: 1 = ICO
  header.writeUInt16LE(count, 4);  // Number of images

  const directoryEntries = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(16);

    entry.writeUInt8(size >= 256 ? 0 : size, 0); // Width (0 for 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // Height (0 for 256)
    entry.writeUInt8(0, 2);                      // Color count (0 = no color palette)
    entry.writeUInt8(0, 3);                      // Reserved
    entry.writeUInt16LE(1, 4);                   // Color planes
    entry.writeUInt16LE(32, 6);                  // Bits per pixel
    entry.writeUInt32LE(buf.length, 8);          // Image size in bytes
    entry.writeUInt32LE(offset, 12);             // File offset
    directoryEntries.push(entry);

    offset += buf.length;
  }

  return Buffer.concat([header, ...directoryEntries, ...pngBuffers]);
}

async function main() {
  fs.mkdirSync(brandDir, { recursive: true });
  console.log('[ICON] Generating high-resolution master icons for RaagaX Desktop...');

  // 1. Generate master PNG (1024x1024)
  const masterPngPath = path.join(rootDir, 'public', 'app-icon.png');
  await sharp(Buffer.from(masterIconSvg))
    .resize(1024, 1024)
    .png()
    .toFile(masterPngPath);
  console.log('✅ Generated master 1024x1024 PNG:', masterPngPath);

  // 2. Generate Windows .ico
  console.log('[ICON] Generating Windows .ico with multi-resolution embeds...');
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  for (const size of icoSizes) {
    const buf = await sharp(masterPngPath)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(buf);
  }

  const icoBuffer = createIcoBuffer(pngBuffers, icoSizes);
  const icoPath = path.join(brandDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  // Also update public/favicon.ico
  fs.writeFileSync(path.join(rootDir, 'public', 'favicon.ico'), icoBuffer);

  const outBrandDir = path.join(rootDir, 'out', 'brand');
  if (fs.existsSync(outBrandDir)) {
    fs.writeFileSync(path.join(outBrandDir, 'icon.ico'), icoBuffer);
    fs.writeFileSync(path.join(rootDir, 'out', 'favicon.ico'), icoBuffer);
  }
  console.log('✅ Generated Windows .ico:', icoPath);

  // 3. Generate macOS .icns using iconutil (if on macOS)
  if (process.platform === 'darwin') {
    console.log('[ICON] Generating native macOS .icns using iconutil...');
    const iconsetDir = path.join(brandDir, 'icon.iconset');
    if (fs.existsSync(iconsetDir)) {
      fs.rmSync(iconsetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(iconsetDir, { recursive: true });

    const macSizes = [
      { name: 'icon_16x16.png', size: 16 },
      { name: 'icon_16x16@2x.png', size: 32 },
      { name: 'icon_32x32.png', size: 32 },
      { name: 'icon_32x32@2x.png', size: 64 },
      { name: 'icon_128x128.png', size: 128 },
      { name: 'icon_128x128@2x.png', size: 256 },
      { name: 'icon_256x256.png', size: 256 },
      { name: 'icon_256x256@2x.png', size: 512 },
      { name: 'icon_512x512.png', size: 512 },
      { name: 'icon_512x512@2x.png', size: 1024 },
    ];

    for (const item of macSizes) {
      await sharp(masterPngPath)
        .resize(item.size, item.size)
        .png()
        .toFile(path.join(iconsetDir, item.name));
    }

    const icnsPath = path.join(brandDir, 'icon.icns');
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'inherit' });
    fs.rmSync(iconsetDir, { recursive: true, force: true });

    if (fs.existsSync(outBrandDir)) {
      fs.copyFileSync(icnsPath, path.join(outBrandDir, 'icon.icns'));
    }
    console.log('✅ Generated macOS native .icns:', icnsPath);
  } else {
    console.log('[ICON] Skipping .icns creation (non-macOS system). electron-builder will derive it from PNG.');
  }

  console.log('🎉 All desktop icons successfully generated!');
}

main().catch((err) => {
  console.error('❌ Failed to generate desktop icons:', err);
  process.exit(1);
});
