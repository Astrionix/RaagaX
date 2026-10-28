/** Build-time configuration, from Vite's `VITE_*` environment variables. */
export const config = {
  /** Pinned in development by the manifest `key` (web/extension/wxt.config.ts). */
  chromiumExtensionId: import.meta.env.VITE_EXTENSION_ID_CHROMIUM || DEV_EXTENSION_ID,
  /** The extension packages (web/extension: `pnpm package` copies them into public/downloads). */
  extensionChromeUrl: import.meta.env.VITE_EXTENSION_CHROME_URL || '/downloads/raaga-extension-chrome.zip',
  extensionFirefoxUrl: import.meta.env.VITE_EXTENSION_FIREFOX_URL || '/downloads/raaga-extension-firefox.zip',
  /** The version the zips above hold, for the "update available" notice. */
  extensionManifestUrl: import.meta.env.VITE_EXTENSION_MANIFEST_URL || '/downloads/extension.json',
  androidAppUrl: import.meta.env.VITE_ANDROID_APP_URL || 'https://github.com/Astrionix/RaagaX/releases/latest',
  /** Raaga's Discord community server invite. */
  discordCommunityUrl: import.meta.env.VITE_DISCORD_COMMUNITY_URL || 'https://discord.gg/yGV2HqhSk',
  /** Raaga's Listen Together primary server. */
  partyServerUrl: import.meta.env.VITE_PARTY_SERVER_URL || 'https://raagax.onrender.com',
  /** Raaga's Listen Together backup servers for automatic fallback. */
  partyBackupServerUrls: (import.meta.env.VITE_PARTY_BACKUP_SERVER_URLS || 'https://raagax-qdfh.onrender.com,https://raagax-y8jx.onrender.com')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean),
  /** Desktop Compose Multiplatform release downloads (Windows, macOS, Linux). */
  desktopDownloads: {
    version: 'v1.9.8',
    windowsSetup: 'https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-windows-setup.exe',
    macArm64: 'https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-macos-arm64.dmg',
    macX64: 'https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-macos-x64.dmg',
    linuxAppImage: 'https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-linux-x86_64.AppImage',
    linuxDeb: 'https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-linux-amd64.deb',
    releasePage: 'https://github.com/Astrionix/RaagaX/releases/tag/v1.9.8',
  },
} as const;
