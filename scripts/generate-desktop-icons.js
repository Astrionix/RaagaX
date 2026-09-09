/**
 * RaagaX Desktop & Web Icon Generator
 * Generates:
 * 1. macOS native `public/brand/icon.icns` using Apple's iconutil
 * 2. Windows multi-resolution `public/brand/icon.ico` (16, 24, 32, 48, 64, 128, 256 px)
 * 3. Transparent browser tab `public/favicon.ico` and `public/favicon.svg` (Spotify / ChatGPT style)
 * 4. High-res master `public/app-icon.png` (1024x1024)
 * 5. PWA icons `public/icon-192.png`, `public/icon-512.png`, `public/logo-dark.png`, `public/logo-light.png`
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');
const brandDir = path.join(rootDir, 'public', 'brand');

// Master App Icon (for desktop/mobile app shortcuts with dark container & large bold 1.80x note)
const masterIconSvg = `
<svg width="1024" height="1024" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#07090E"/>
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

// Transparent Master Favicon (for browser tabs - Spotify/ChatGPT style)
const faviconSvg = `
<svg width="512" height="512" viewBox="135 152 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="neonFav" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3157"/>
      <stop offset="50%" stop-color="#ff174f"/>
      <stop offset="100%" stop-color="#ff3157"/>
    </linearGradient>
    <filter id="glowFav" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g fill="none" stroke="url(#neonFav)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowFav)">
    <circle cx="220" cy="326" r="42"/>
    <path d="M 262 326 L 262 178 L 330 216"/>
  </g>

  <g fill="none" stroke="url(#neonFav)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="220" cy="326" r="42"/>
    <path d="M 262 326 L 262 178 L 330 216"/>
  </g>
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
  console.log('[ICON] Generating extra-large high-resolution master icons for RaagaX Desktop & Web...');

  // Save public/favicon.svg
  fs.writeFileSync(path.join(rootDir, 'public', 'favicon.svg'), faviconSvg.trim());

  // 1. Generate master PNG (1024x1024)
  const masterPngPath = path.join(rootDir, 'public', 'app-icon.png');
  await sharp(Buffer.from(masterIconSvg))
    .resize(1024, 1024)
    .png()
    .toFile(masterPngPath);
  console.log('✅ Generated master 1024x1024 PNG:', masterPngPath);

  // PWA and brand icons
  await sharp(masterPngPath).resize(512, 512).png().toFile(path.join(rootDir, 'public', 'icon-512.png'));
  await sharp(masterPngPath).resize(192, 192).png().toFile(path.join(rootDir, 'public', 'icon-192.png'));
  await sharp(masterPngPath).resize(512, 512).png().toFile(path.join(rootDir, 'public', 'logo-dark.png'));
  await sharp(masterPngPath).resize(512, 512).png().toFile(path.join(rootDir, 'public', 'logo-light.png'));
  console.log('✅ Generated PWA and brand logos (192, 512, logo-dark, logo-light)');

  // 2. Generate Transparent Browser Favicon .ico
  console.log('[ICON] Generating transparent browser tab .ico (Spotify style)...');
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  const favPngMaster = await sharp(Buffer.from(faviconSvg)).resize(512, 512).png().toBuffer();

  for (const size of icoSizes) {
    const buf = await sharp(favPngMaster)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push(buf);
  }

  const icoBuffer = createIcoBuffer(pngBuffers, icoSizes);
  const icoPath = path.join(brandDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  // Update public/favicon.ico with transparent favicon
  fs.writeFileSync(path.join(rootDir, 'public', 'favicon.ico'), icoBuffer);

  const outBrandDir = path.join(rootDir, 'out', 'brand');
  if (fs.existsSync(outBrandDir)) {
    fs.writeFileSync(path.join(outBrandDir, 'icon.ico'), icoBuffer);
    fs.writeFileSync(path.join(rootDir, 'out', 'favicon.ico'), icoBuffer);
  }
  console.log('✅ Generated transparent browser .ico:', icoPath);

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
  }

  console.log('🎉 All desktop & web icons successfully generated at extra-large size!');
}

main().catch((err) => {
  console.error('❌ Failed to generate desktop icons:', err);
  process.exit(1);
});
