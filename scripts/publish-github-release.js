const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const REPO = 'Astrionix/RaagaX';
const TAG = 'v1.3.3';
const RELEASE_NAME = 'RaagaX v1.3.3 — Detail View Navigation & Artwork Display Fixes';
const APK_PATH = path.resolve(__dirname, '../RaagaX.apk');

const bodyText = `## 🚀 RaagaX v1.3.3 Release Notes

### 🔄 Detail View Back Navigation Fix
- Resolved stack unwinding issues when pressing Back inside Playlist, Album, and Artist detail views across mobile, tablet, and desktop layouts.

### 🖼️ Artwork Resolution & Uncropped Display
- Support for external high-res CDN images (\`ytimg.com\`, \`googleusercontent.com\`, \`mzstatic.com\`, \`scdn.co\`).
- Changed player cover display mode to full \`contain\` fit to prevent cropping on non-square album artwork.

### 📦 Download Release
- **Android APK:** \`RaagaX.apk\` (v1.3.3 / versionCode 16)
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
