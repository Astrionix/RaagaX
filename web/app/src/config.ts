declare const DEV_EXTENSION_ID: string | undefined;

// The dev-key extension ID generated from dev-key/public-key.txt
export const PINNED_DEV_KEY_EXTENSION_ID = 'pkddffeebcmhhanjcigilehaeonkkfih';

const candidateIds = [
  import.meta.env.VITE_EXTENSION_ID_CHROMIUM,
  typeof DEV_EXTENSION_ID !== 'undefined' ? DEV_EXTENSION_ID : '',
  PINNED_DEV_KEY_EXTENSION_ID,
].filter((id): id is string => Boolean(id && typeof id === 'string' && id.trim().length > 0));

/** Build-time configuration, from Vite's `VITE_*` environment variables. */
export const config = {
  /** Pinned in development by the manifest `key` (web/extension/wxt.config.ts). */
  chromiumExtensionId: candidateIds[0] || PINNED_DEV_KEY_EXTENSION_ID,
  chromiumExtensionIds: [...new Set(candidateIds)],
  /** The extension packages (web/extension: `pnpm package` copies them into public/downloads). */
  extensionChromeUrl: import.meta.env.VITE_EXTENSION_CHROME_URL || '/downloads/raaga-extension-chrome.zip',
  extensionFirefoxUrl: import.meta.env.VITE_EXTENSION_FIREFOX_URL || '/downloads/raaga-extension-firefox.zip',
  /** The version the zips above hold, for the "update available" notice. */
  extensionManifestUrl: import.meta.env.VITE_EXTENSION_MANIFEST_URL || '/downloads/extension.json',
  androidAppUrl: import.meta.env.VITE_ANDROID_APP_URL || 'https://github.com/Astrionix/RaagaX/releases/latest',
} as const;
