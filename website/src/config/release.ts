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
  versionName: "v1.9.7",
  versionCode: 39,
  minAndroid: "Android 8.0+ (Oreo, API 26)",
  targetAndroid: "Android 15+ (Vanilla Ice Cream, API 36)",
  ndkVersion: "27.2.12479018",
  cmakeVersion: "3.22.1",
  fileSize: "~54 MB",
  releaseDate: "October 2026",
  buildType: "Release Signed (R8 Minified, NDK 27)",
  // Mobile APK configurations
  directApkUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/app-prod-universal-release.apk",
  apkDownloadUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/app-prod-arm64-v8a-release.apk",
  releaseNotesUrl: "https://github.com/Astrionix/RaagaX/releases/tag/v1.9.7",
  githubRepoUrl: "https://github.com/Astrionix/RaagaX",
  liveDomainUrl: "https://raaga.me",
  authorName: "Chandra Reddy",
  authorHandle: "@Astrionix",
  authorRole: "Lead Mobile Systems & Full-Stack Architect",
  license: "GNU General Public License v3.0",
  // Dedicated Desktop Applications Configuration (Windows, macOS, Linux)
  desktop: {
    version: "v1.9.7",
    releaseNotesUrl: "https://github.com/Astrionix/RaagaX/releases/tag/v1.9.7",
    windows: {
      setupExe: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/Raaga-1.9.7-windows-setup.exe",
      portableZip: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/Raaga-1.9.7-windows-portable.zip",
      size: "~300 MB",
    },
    macOS: {
      arm64Dmg: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/Raaga-1.9.7-macos-arm64.dmg",
      x64Dmg: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/Raaga-1.9.7-macos-x64.dmg",
      size: "~180 MB",
    },
    linux: {
      appImage: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/Raaga-1.9.7-linux-x86_64.AppImage",
      deb: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/Raaga-1.9.7-linux-amd64.deb",
      rpm: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.7/Raaga-1.9.7-linux-x86_64.rpm",
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

export interface ChangelogItem {
  category: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  platforms: string[];
}

export const V197_CHANGELOG: ChangelogItem[] = [
  {
    category: "Audio Experience",
    badge: "Liquid Glass",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
    title: "Liquid Glass Audio Output Sheet",
    description: "Frosted liquid glass output selector accessible on both Home and expanded Now Playing screens. Switch on-the-fly between Speakers, Bluetooth devices, USB DACs, and wired headphones.",
    platforms: ["Android", "Windows", "macOS", "Linux"],
  },
  {
    category: "Desktop UX",
    badge: "Work Area",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    title: "Taskbar & Dock Work Area Preservation",
    description: "Maximized and full-screen window states now strictly preserve the Windows 10/11 taskbar and macOS Dock work area, ensuring system taskbars remain completely accessible without overlap.",
    platforms: ["Windows", "macOS"],
  },
  {
    category: "Updates & Delivery",
    badge: "OTA Engine",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    title: "Silent Background In-App OTA Updates",
    description: "Automatic background update verification across Android (universal/arm64 APKs) and Desktop (Windows setup & portable, macOS ARM64/x64 DMG, Linux AppImage/deb/rpm) with seamless installation and auto-relaunch.",
    platforms: ["Android", "Windows", "macOS", "Linux"],
  },
  {
    category: "Cloud Telemetry",
    badge: "Supabase Live",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    title: "Real-Time Activity & Auto-Pruning",
    description: "Graceful player lifecycle teardown on app exit prevents ghost playing sessions in Supabase. Admin dashboard auto-prunes stale sessions (>15 min) continuously so live listener counts reflect real-time active users.",
    platforms: ["Android", "Cloud"],
  },
];
