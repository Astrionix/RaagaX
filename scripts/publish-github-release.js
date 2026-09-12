const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const REPO = 'Astrionix/RaagaX';
const TAG = 'v1.3.2';
const RELEASE_NAME = 'RaagaX v1.3.2 — 4K Splash Screen & Playlist Cloud Sync';
const APK_PATH = path.resolve(__dirname, '../RaagaX.apk');

const bodyText = `## 🚀 RaagaX v1.3.2 Release Notes

### 🎨 4K Splash Screen & Icon Precision Fix
- **Zero-Cropping Safe Zone**: Fixed Android 12+ circular mask clipping by introducing a native \`VectorDrawable\` (\`ic_splash_logo.xml\`) strictly bounded within the 160dp inner circular safe zone (~62% scale with ~9dp safety margin).
- **True 4K UHD Clarity**: Replaced stretched low-res raster icons with infinite-resolution vector drawables and ultra-high-density 4K splash surfaces (\`2160x3840\`, \`3840x2160\`, \`2048x2048\`).
- **Adaptive Icon Layers**: Added \`mipmap-anydpi-v26\` adaptive icon definitions to ensure flawless rendering on Samsung OneUI, Google Pixel, and third-party Android launchers.

### ☁️ Playlist Cloud & Cross-Device Sync (APK ⇄ Desktop ⇄ Web)
- **Supabase Schema Fix**: Aligned playlist metadata schema columns (\`title\` and \`owner_id\`) across \`usePlaylistStore.ts\` and \`AccountSyncEngine.ts\`.
- **Realtime Postgres Subscription**: Enabled instant cross-device realtime synchronization for \`playlists\` and \`playlist_songs\` tables.
- **Default Master Playlist Cover**: Introduced a constant 1024x1024 master cover (\`default-playlist-cover.png\`) for playlists without custom artwork.

### 📦 Download Release
- **Android APK:** \`RaagaX.apk\` (v1.3.2 / versionCode 15)
`;

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      if (Buffer.isBuffer(postData)) req.write(postData);
      else req.write(postData);
    }
    req.end();
  });
}

async function publish() {
  console.log(`🚀 Creating GitHub Release ${TAG} on ${REPO}...`);

  // Step 1: Create GitHub Release
  const releasePayload = JSON.stringify({
    tag_name: TAG,
    target_commitish: 'main',
    name: RELEASE_NAME,
    body: bodyText,
    draft: false,
    prerelease: false
  });

  const createRes = await request({
    hostname: 'api.github.com',
    path: `/repos/${REPO}/releases`,
    method: 'POST',
    headers: {
      'User-Agent': 'RaagaX-Publish-Script',
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(releasePayload)
    }
  }, releasePayload);

  if (createRes.status !== 201) {
    console.error('❌ Failed to create GitHub Release:', createRes.data || createRes.raw);
    process.exit(1);
  }

  const releaseData = createRes.data;
  console.log(`✓ Created GitHub Release ID ${releaseData.id}: ${releaseData.html_url}`);

  // Step 2: Upload RaagaX.apk asset
  if (!fs.existsSync(APK_PATH)) {
    console.error('❌ RaagaX.apk not found at:', APK_PATH);
    process.exit(1);
  }

  const apkStats = fs.statSync(APK_PATH);
  console.log(`📦 Uploading RaagaX.apk (${(apkStats.size / (1024*1024)).toFixed(2)} MB)...`);

  const uploadUrlRaw = releaseData.upload_url.split('{')[0]; // e.g. https://uploads.github.com/repos/Astrionix/RaagaX/releases/12345/assets
  const uploadUrl = new URL(uploadUrlRaw);
  uploadUrl.searchParams.append('name', 'RaagaX.apk');

  const fileBuffer = fs.readFileSync(APK_PATH);

  const uploadRes = await request({
    hostname: uploadUrl.hostname,
    path: uploadUrl.pathname + uploadUrl.search,
    method: 'POST',
    headers: {
      'User-Agent': 'RaagaX-Publish-Script',
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': fileBuffer.length
    }
  }, fileBuffer);

  if (uploadRes.status === 201) {
    console.log(`🎉 [SUCCESS] Uploaded RaagaX.apk asset: ${uploadRes.data.browser_download_url}`);
    console.log(`\n✨ Official Release Page: ${releaseData.html_url}`);
  } else {
    console.error('❌ Failed to upload asset:', uploadRes.data || uploadRes.raw);
  }
}

publish().catch(console.error);
