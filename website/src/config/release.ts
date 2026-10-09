/**
 * RaagaX Central Release and Project Configuration
 * Single source of truth for versions, download links, metadata, and repository references.
 */

export interface DesktopConfig {
  version: string;
  releaseNotesUrl: string;
  windows: {
    setupExe: string;
    portableZip: string;
    size: string;
  };
  macOS: {
    arm64Dmg: string;
    x64Dmg: string;
    size: string;
  };
  linux: {
    appImage: string;
    deb: string;
    rpm: string;
    size: string;
  };
}

export interface ReleaseConfig {
  appName: string;
  tagline: string;
  versionName: string;
  versionCode: number;
  minAndroid: string;
  targetAndroid: string;
  ndkVersion: string;
  cmakeVersion: string;
  fileSize: string;
  releaseDate: string;
  buildType: string;
  directApkUrl: string;
  apkDownloadUrl: string;
  releaseNotesUrl: string;
  githubRepoUrl: string;
  liveDomainUrl: string;
  authorName: string;
  authorHandle: string;
  authorRole: string;
  license: string;
  // Desktop (Windows, macOS, Linux)
  desktop: DesktopConfig;
  stats: {
    unitTests: number;
    acceptanceScenarios: number;
    supportedScreens: number;
    maxPartyCapacity: number;
  };
}

export const RAAGAX_CONFIG: ReleaseConfig = {
  appName: "RaagaX",
  tagline: "Music playback, engineered beyond the surface.",
  versionName: "v1.9.6",
  versionCode: 38,
  minAndroid: "Android 8.0+ (Oreo, API 26)",
  targetAndroid: "Android 15+ (Vanilla Ice Cream, API 36)",
  ndkVersion: "27.2.12479018",
  cmakeVersion: "3.22.1",
  fileSize: "~54 MB",
  releaseDate: "October 2026",
  buildType: "Release Signed (R8 Minified, NDK 27)",
  // Mobile APK configurations
  directApkUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/app-prod-universal-release.apk",
  apkDownloadUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/app-prod-arm64-v8a-release.apk",
  releaseNotesUrl: "https://github.com/Astrionix/RaagaX/releases/tag/v1.9.6",
  githubRepoUrl: "https://github.com/Astrionix/RaagaX",
  liveDomainUrl: "https://raaga.me",
  authorName: "Chandra Reddy",
  authorHandle: "@Astrionix",
  authorRole: "Lead Mobile Systems & Full-Stack Architect",
  license: "GNU General Public License v3.0",
  // Dedicated Desktop Applications Configuration (Windows, macOS, Linux)
  desktop: {
    version: "v1.9.6",
    releaseNotesUrl: "https://github.com/Astrionix/RaagaX/releases/tag/v1.9.6",
    windows: {
      setupExe: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/Raaga-1.9.6-windows-setup.exe",
      portableZip: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/Raaga-1.9.6-windows-portable.zip",
      size: "~300 MB",
    },
    macOS: {
      arm64Dmg: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/Raaga-1.9.6-macos-arm64.dmg",
      x64Dmg: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/Raaga-1.9.6-macos-x64.dmg",
      size: "~180 MB",
    },
    linux: {
      appImage: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/Raaga-1.9.6-linux-x86_64.AppImage",
      deb: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/Raaga-1.9.6-linux-amd64.deb",
      rpm: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.6/Raaga-1.9.6-linux-x86_64.rpm",
      size: "~160 MB",
    },
  },
  stats: {
    unitTests: 84,
    acceptanceScenarios: 30,
    supportedScreens: 10,
    maxPartyCapacity: 5,
  },
};

export type FeatureStatus = "IMPLEMENTED" | "BETA" | "EXPERIMENTAL" | "PLANNED / SPECIFICATION";
