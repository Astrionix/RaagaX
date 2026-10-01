import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AudioQualitySetting = "low" | "medium" | "high" | "lossless";
export type ThemeModeSetting = "oled" | "dark" | "system" | "light";
export type LyricsSourceSetting = "lrclib" | "musixmatch" | "kugou" | "genius";
export type LiquidGlassMode = "normal" | "dark" | "frosted";

export interface SettingsState {
  // Audio Quality
  wifiQuality: AudioQualitySetting;
  cellularQuality: AudioQualitySetting;
  meteredConnection: boolean;

  // Playback
  crossfadeSeconds: number;
  smartFadeEnabled: boolean;
  automixPerformanceMode: boolean;
  skipSilence: boolean;
  dolbyAtmos: boolean;
  spatialAudio: boolean;
  loudnessNormalization: boolean;
  outputPcmMode: "16-bit" | "32-bit float";
  swipeToPlayNext: boolean;
  dontRepeatSuggestions: boolean;

  // Appearance
  themeMode: ThemeModeSetting;
  dynamicBlur: boolean;
  liquidGlass: boolean;
  liquidGlassMode: LiquidGlassMode;
  lyricsBlur: boolean;
  fullBleedArtwork: boolean;
  meshGradientBackdrop: boolean;
  syncedLyrics: boolean;
  animatedCanvas: boolean;
  canvasOverCellular: boolean;

  // Sources & Addons
  youtubeMusicEnabled: boolean;
  jioSaavnEnabled: boolean;
  spotifyCanvasEnabled: boolean;
  discordRpcEnabled: boolean;

  // Lyrics & Translation
  primaryLyricsSource: LyricsSourceSetting;
  lyricsOffsetMs: number;
  translationLanguage: string;

  // Scrobbling
  lastfmEnabled: boolean;
  lastfmUsername: string;
  lastfmSessionKey: string;
  listenBrainzEnabled: boolean;
  listenBrainzToken: string;

  // Storage & Cache
  audioCacheLimitMb: number;

  // Performance & Misc
  highPerformanceMode: boolean;
  refreshRate: "60" | "90" | "120" | "auto";
  showNerdStats: boolean;
  appLanguage: string;

  // Setters
  setWifiQuality: (q: AudioQualitySetting) => void;
  setCellularQuality: (q: AudioQualitySetting) => void;
  setMeteredConnection: (v: boolean) => void;
  setCrossfadeSeconds: (s: number) => void;
  setSmartFadeEnabled: (v: boolean) => void;
  setAutomixPerformanceMode: (v: boolean) => void;
  setSkipSilence: (v: boolean) => void;
  setDolbyAtmos: (v: boolean) => void;
  setSpatialAudio: (v: boolean) => void;
  setLoudnessNormalization: (v: boolean) => void;
  setOutputPcmMode: (m: "16-bit" | "32-bit float") => void;
  setSwipeToPlayNext: (v: boolean) => void;
  setDontRepeatSuggestions: (v: boolean) => void;
  setThemeMode: (m: ThemeModeSetting) => void;
  setDynamicBlur: (v: boolean) => void;
  setLiquidGlass: (v: boolean) => void;
  setLiquidGlassMode: (m: LiquidGlassMode) => void;
  setLyricsBlur: (v: boolean) => void;
  setFullBleedArtwork: (v: boolean) => void;
  setMeshGradientBackdrop: (v: boolean) => void;
  setSyncedLyrics: (v: boolean) => void;
  setAnimatedCanvas: (v: boolean) => void;
  setCanvasOverCellular: (v: boolean) => void;
  setYoutubeMusicEnabled: (v: boolean) => void;
  setJioSaavnEnabled: (v: boolean) => void;
  setSpotifyCanvasEnabled: (v: boolean) => void;
  setDiscordRpcEnabled: (v: boolean) => void;
  setPrimaryLyricsSource: (s: LyricsSourceSetting) => void;
  setLyricsOffsetMs: (offset: number) => void;
  setTranslationLanguage: (lang: string) => void;
  setLastfmEnabled: (v: boolean) => void;
  setLastfmCredentials: (username: string, sessionKey: string) => void;
  setListenBrainzEnabled: (v: boolean) => void;
  setListenBrainzToken: (token: string) => void;
  setAudioCacheLimitMb: (limit: number) => void;
  setHighPerformanceMode: (v: boolean) => void;
  setRefreshRate: (rate: "60" | "90" | "120" | "auto") => void;
  setShowNerdStats: (v: boolean) => void;
  setAppLanguage: (lang: string) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  wifiQuality: "lossless" as AudioQualitySetting,
  cellularQuality: "high" as AudioQualitySetting,
  meteredConnection: false,
  crossfadeSeconds: 4,
  smartFadeEnabled: true,
  automixPerformanceMode: false,
  skipSilence: false,
  dolbyAtmos: false,
  spatialAudio: true,
  loudnessNormalization: true,
  outputPcmMode: "32-bit float" as const,
  swipeToPlayNext: true,
  dontRepeatSuggestions: true,
  themeMode: "oled" as ThemeModeSetting,
  dynamicBlur: true,
  liquidGlass: true,
  liquidGlassMode: "dark" as LiquidGlassMode,
  lyricsBlur: true,
  fullBleedArtwork: true,
  meshGradientBackdrop: true,
  syncedLyrics: true,
  animatedCanvas: true,
  canvasOverCellular: false,
  youtubeMusicEnabled: true,
  jioSaavnEnabled: true,
  spotifyCanvasEnabled: true,
  discordRpcEnabled: false,
  primaryLyricsSource: "lrclib" as LyricsSourceSetting,
  lyricsOffsetMs: 0,
  translationLanguage: "en",
  lastfmEnabled: false,
  lastfmUsername: "",
  lastfmSessionKey: "",
  listenBrainzEnabled: false,
  listenBrainzToken: "",
  audioCacheLimitMb: 2048,
  highPerformanceMode: false,
  refreshRate: "auto" as const,
  showNerdStats: false,
  appLanguage: "en",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setWifiQuality: (wifiQuality) => set({ wifiQuality }),
      setCellularQuality: (cellularQuality) => set({ cellularQuality }),
      setMeteredConnection: (meteredConnection) => set({ meteredConnection }),
      setCrossfadeSeconds: (crossfadeSeconds) => set({ crossfadeSeconds }),
      setSmartFadeEnabled: (smartFadeEnabled) => set({ smartFadeEnabled }),
      setAutomixPerformanceMode: (automixPerformanceMode) => set({ automixPerformanceMode }),
      setSkipSilence: (skipSilence) => set({ skipSilence }),
      setDolbyAtmos: (dolbyAtmos) => set({ dolbyAtmos }),
      setSpatialAudio: (spatialAudio) => set({ spatialAudio }),
      setLoudnessNormalization: (loudnessNormalization) => set({ loudnessNormalization }),
      setOutputPcmMode: (outputPcmMode) => set({ outputPcmMode }),
      setSwipeToPlayNext: (swipeToPlayNext) => set({ swipeToPlayNext }),
      setDontRepeatSuggestions: (dontRepeatSuggestions) => set({ dontRepeatSuggestions }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setDynamicBlur: (dynamicBlur) => set({ dynamicBlur }),
      setLiquidGlass: (liquidGlass) => set({ liquidGlass }),
      setLiquidGlassMode: (liquidGlassMode) => set({ liquidGlassMode }),
      setLyricsBlur: (lyricsBlur) => set({ lyricsBlur }),
      setFullBleedArtwork: (fullBleedArtwork) => set({ fullBleedArtwork }),
      setMeshGradientBackdrop: (meshGradientBackdrop) => set({ meshGradientBackdrop }),
      setSyncedLyrics: (syncedLyrics) => set({ syncedLyrics }),
      setAnimatedCanvas: (animatedCanvas) => set({ animatedCanvas }),
      setCanvasOverCellular: (canvasOverCellular) => set({ canvasOverCellular }),
      setYoutubeMusicEnabled: (youtubeMusicEnabled) => set({ youtubeMusicEnabled }),
      setJioSaavnEnabled: (jioSaavnEnabled) => set({ jioSaavnEnabled }),
      setSpotifyCanvasEnabled: (spotifyCanvasEnabled) => set({ spotifyCanvasEnabled }),
      setDiscordRpcEnabled: (discordRpcEnabled) => set({ discordRpcEnabled }),
      setPrimaryLyricsSource: (primaryLyricsSource) => set({ primaryLyricsSource }),
      setLyricsOffsetMs: (lyricsOffsetMs) => set({ lyricsOffsetMs }),
      setTranslationLanguage: (translationLanguage) => set({ translationLanguage }),
      setLastfmEnabled: (lastfmEnabled) => set({ lastfmEnabled }),
      setLastfmCredentials: (lastfmUsername, lastfmSessionKey) =>
        set({ lastfmUsername, lastfmSessionKey, lastfmEnabled: true }),
      setListenBrainzEnabled: (listenBrainzEnabled) => set({ listenBrainzEnabled }),
      setListenBrainzToken: (listenBrainzToken) =>
        set({ listenBrainzToken, listenBrainzEnabled: true }),
      setAudioCacheLimitMb: (audioCacheLimitMb) => set({ audioCacheLimitMb }),
      setHighPerformanceMode: (highPerformanceMode) => set({ highPerformanceMode }),
      setRefreshRate: (refreshRate) => set({ refreshRate }),
      setShowNerdStats: (showNerdStats) => set({ showNerdStats }),
      setAppLanguage: (appLanguage) => set({ appLanguage }),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "raaga-app-settings",
    }
  )
);
