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

export interface TvConfig {
  version: string;
  directApkUrl: string;
  universalApkUrl: string;
  arm64ApkUrl: string;
  armeabiV7aApkUrl: string;
  x86_64ApkUrl: string;
  size: string;
  minAndroid: string;
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
  // Android TV
  tv: TvConfig;
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
  appName: "Raaga",
  tagline: "Your Music. Without Limits.",
  versionName: "v1.9.8",
  versionCode: 40,
  minAndroid: "Android 8.0+ (Oreo, API 26)",
  targetAndroid: "Android 15+ (Vanilla Ice Cream, API 36)",
  ndkVersion: "27.2.12479018",
  cmakeVersion: "3.22.1",
  fileSize: "~60 MB",
  releaseDate: "October 2026",
  buildType: "Release Signed (R8 Minified, NDK 27)",
  // Mobile APK configurations
  directApkUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/app-prod-arm64-v8a-release.apk",
  apkDownloadUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/app-prod-arm64-v8a-release.apk",
  releaseNotesUrl: "https://github.com/Astrionix/RaagaX/releases/tag/v1.9.8",
  githubRepoUrl: "https://github.com/Astrionix/RaagaX",
  liveDomainUrl: "https://raaga.me",
  authorName: "Chandra Reddy",
  authorHandle: "@Astrionix",
  authorRole: "Lead Systems & Audio Architect",
  license: "GNU General Public License v3.0",
  // Android TV Builds (Google TV, Fire TV, Android TV)
  tv: {
    version: "v1.9.8",
    directApkUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/tv-prod-universal-debug.apk",
    universalApkUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/tv-prod-universal-debug.apk",
    arm64ApkUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/tv-prod-arm64-v8a-debug.apk",
    armeabiV7aApkUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/tv-prod-armeabi-v7a-debug.apk",
    x86_64ApkUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/tv-prod-x86_64-debug.apk",
    size: "~87 MB",
    minAndroid: "Android TV 8.0+ / Google TV / Fire TV",
  },
  // Dedicated Desktop Applications Configuration (Windows, macOS, Linux)
  desktop: {
    version: "v1.9.8",
    releaseNotesUrl: "https://github.com/Astrionix/RaagaX/releases/tag/v1.9.8",
    windows: {
      setupExe: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-windows-setup.exe",
      portableZip: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-windows-setup.msi",
      size: "~315 MB",
    },
    macOS: {
      arm64Dmg: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-macos-arm64.dmg",
      x64Dmg: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-macos-x64.dmg",
      size: "~180 MB",
    },
    linux: {
      appImage: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-linux-x86_64.AppImage",
      deb: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-linux-amd64.deb",
      rpm: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.8/Raaga-1.9.8-linux-x86_64.rpm",
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
    category: "Casting & Ecosystem",
    badge: "Google Cast",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    title: "Google Cast & Chromecast Audio Streaming",
    description: "Native Google Cast sender subsystem. Discover Chromecasts, Google Nest speakers, and smart displays on local Wi-Fi with instant route selection, synchronized volume control, and continuous ExoPlayer queue forwarding.",
    platforms: ["Android"],
  },
  {
    category: "Web & Cross-Platform",
    badge: "Web Player",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    title: "Modern Web Player & Companion Extension",
    description: "Full-fidelity React 19 and Tailwind CSS v4 web player with synchronized full-screen lyrics over dynamic mesh gradients, Apple Music motion artwork, music video playback, and companion browser extension.",
    platforms: ["Web", "Chrome", "Firefox"],
  },
  {
    category: "Audio Experience",
    badge: "Liquid Glass",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
    title: "Liquid Glass Audio Output Sheet",
    description: "Frosted liquid glass output selector accessible on both Home and expanded Now Playing screens. Switch on-the-fly between Speakers, Bluetooth devices, USB DACs, Google Cast receivers, and wired headphones.",
    platforms: ["Android", "Windows", "macOS", "Linux"],
  },
  {
    category: "Interactions",
    badge: "Micro-Gestures",
    badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    title: "Swipe-to-Queue, Star Favorites & Artist Signatures",
    description: "Smooth gesture swipe-to-queue on songs and search history, Apple Music-style star favorite toggle in player and notifications, and authentic ink signature rendering on artist profile headers.",
    platforms: ["Android", "Desktop"],
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

