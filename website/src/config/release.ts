/**
 * RaagaX Central Release and Project Configuration
 * Single source of truth for versions, download links, metadata, and repository references.
 */

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
  versionName: "v1.9.1",
  versionCode: 33,
  minAndroid: "Android 8.0+ (Oreo, API 26)",
  targetAndroid: "Android 15+ (Vanilla Ice Cream, API 36)",
  ndkVersion: "27.2.12479018",
  cmakeVersion: "3.22.1",
  fileSize: "~38.4 MB",
  releaseDate: "October 2026",
  buildType: "Release Signed (R8 Minified, NDK 27)",
  // Direct APK file served locally on the website
  directApkUrl: "/raaga-v1.9.1.apk",
  // Centralized APK download link pointing to official GitHub Releases
  apkDownloadUrl: "https://github.com/Astrionix/RaagaX/releases/download/v1.9.1/app-release.apk",
  releaseNotesUrl: "https://github.com/Astrionix/RaagaX/releases/tag/v1.9.1",
  githubRepoUrl: "https://github.com/Astrionix/RaagaX",
  liveDomainUrl: "https://raaga.me",
  authorName: "Chandra Reddy",
  authorHandle: "@Astrionix",
  authorRole: "Lead Mobile Systems & Full-Stack Architect",
  license: "GNU General Public License v3.0",
  stats: {
    unitTests: 84, // Verified test suites across Android app and Go backend
    acceptanceScenarios: 30, // Formally verified CD-001 to CD-030 cross-device test specs
    supportedScreens: 10,
    maxPartyCapacity: 5, // JAM_MAX_MEMBERS configured party capacity
  },
};

export type FeatureStatus = "IMPLEMENTED" | "BETA" | "EXPERIMENTAL" | "PLANNED / SPECIFICATION";
