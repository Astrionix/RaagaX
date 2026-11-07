package com.music.raaga.data.settings

import kotlinx.coroutines.flow.StateFlow

/**
 * Centralized, strongly-typed preferences store for RaagaX grouped into 6 reactive slices:
 *
 * 1. [Appearance]: Theme, Liquid Glass mode, blend effects, edge-to-edge covers, nav profile.
 * 2. [ContentPreferences]: Home feed sections (recents, videos, top picks, moods) and card formats.
 * 3. [PlaybackAndAudio]: Music-only audio, stream quality, automix, crossfade, hardware release, limiter.
 * 4. [SourcesAndAddons]: Direct stream routing, strict track-matching gate, addon stream tiers.
 * 5. [ConnectAndIntegrations]: Raaga Connect discovery, Discord rich presence, Last.fm scrobbling.
 * 6. [Diagnostics]: Stats for nerds technical overlay and live performance telemetry.
 *
 * Includes [resetToDefaults] which clears user preferences back to out-of-the-box defaults
 * without erasing authentication tokens, custom playlists, or downloaded music.
 */
object SettingsRepository {

    object Appearance {
        val playerTheme: StateFlow<PlayerTheme> get() = AppSettings.playerTheme
        val liquidGlassMode: StateFlow<LiquidGlassMode> get() = AppSettings.liquidGlassMode
        val disableBlendEffects: StateFlow<Boolean> get() = AppSettings.disableBlendEffects
        val fullScreenAlbumCover: StateFlow<Boolean> get() = AppSettings.fullBleedArtwork
        val compactNavIconsOnly: StateFlow<Boolean> get() = AppSettings.compactNavIconsOnly

        fun setPlayerTheme(theme: PlayerTheme) = AppSettings.setPlayerTheme(theme)
        fun setLiquidGlassMode(mode: LiquidGlassMode) = AppSettings.setLiquidGlassMode(mode)
        fun setDisableBlendEffects(value: Boolean) = AppSettings.setDisableBlendEffects(value)
        fun setFullScreenAlbumCover(value: Boolean) = AppSettings.setFullBleedArtwork(value)
        fun setCompactNavIconsOnly(value: Boolean) = AppSettings.setCompactNavIconsOnly(value)
    }

    object ContentPreferences {
        val showHomeRecents: StateFlow<Boolean> get() = AppSettings.showHomeRecents
        val showHomeVideos: StateFlow<Boolean> get() = AppSettings.showHomeVideos
        val showHomeTopPicks: StateFlow<Boolean> get() = AppSettings.showHomeTopPicks
        val showHomeMoods: StateFlow<Boolean> get() = AppSettings.showHomeMoods
        val squareVideoThumbnails: StateFlow<Boolean> get() = AppSettings.squareVideoThumbnails

        fun setShowHomeRecents(value: Boolean) = AppSettings.setShowHomeRecents(value)
        fun setShowHomeVideos(value: Boolean) = AppSettings.setShowHomeVideos(value)
        fun setShowHomeTopPicks(value: Boolean) = AppSettings.setShowHomeTopPicks(value)
        fun setShowHomeMoods(value: Boolean) = AppSettings.setShowHomeMoods(value)
        fun setSquareVideoThumbnails(value: Boolean) = AppSettings.setSquareVideoThumbnails(value)
    }

    object PlaybackAndAudio {
        val preferMusicOnlyVersion: StateFlow<Boolean> get() = AppSettings.preferMusicOnly
        val wifiQuality: StateFlow<AudioQuality> get() = AppSettings.audioQualityWifi
        val cellularQuality: StateFlow<AudioQuality> get() = AppSettings.audioQualityCellular
        val automixEnabled: StateFlow<Boolean> get() = AppSettings.smartFadeEnabled
        val crossfadeDurationSec: StateFlow<Int> get() = AppSettings.crossfadeSeconds
        val releaseHardwareOnPause: StateFlow<Boolean> get() = AppSettings.releaseHardwareOnPause
        val peakLimiterEnabled: StateFlow<Boolean> get() = AppSettings.peakLimiterEnabled

        fun setPreferMusicOnlyVersion(value: Boolean) = AppSettings.setPreferMusicOnly(value)
        fun setWifiQuality(quality: AudioQuality) = AppSettings.setAudioQualityWifi(quality)
        fun setCellularQuality(quality: AudioQuality) = AppSettings.setAudioQualityCellular(quality)
        fun setAutomixEnabled(value: Boolean) = AppSettings.setSmartFadeEnabled(value)
        fun setCrossfadeDurationSec(seconds: Int) = AppSettings.setCrossfadeSeconds(seconds)
        fun setReleaseHardwareOnPause(value: Boolean) = AppSettings.setReleaseHardwareOnPause(value)
        fun setPeakLimiterEnabled(value: Boolean) = AppSettings.setPeakLimiterEnabled(value)
    }

    object SourcesAndAddons {
        val directSourceStream: StateFlow<Boolean> get() = AppSettings.directSourceStream
        val strictTrackMatching: StateFlow<Boolean> get() = AppSettings.strictTrackMatching
        val addonQualityPreferences: StateFlow<Map<String, String>> get() = AppSettings.addonQualityPreferences

        fun setDirectSourceStream(value: Boolean) = AppSettings.setDirectSourceStream(value)
        fun setStrictTrackMatching(value: Boolean) = AppSettings.setStrictTrackMatching(value)
        fun setAddonQualityPreference(addonId: String, qualityTier: String) =
            AppSettings.setAddonQualityPreference(addonId, qualityTier)
    }

    object ConnectAndIntegrations {
        val raagaConnectAutoDiscovery: StateFlow<Boolean> get() = AppSettings.raagaConnectAutoDiscovery
        val discordRichPresence: StateFlow<Boolean> get() = AppSettings.discordRpcEnabled
        val lastFmScrobbling: StateFlow<Boolean> get() = AppSettings.lastfmScrobbleEnabled

        fun setRaagaConnectAutoDiscovery(value: Boolean) = AppSettings.setRaagaConnectAutoDiscovery(value)
        fun setDiscordRichPresence(value: Boolean) = AppSettings.setDiscordRpcEnabled(value)
        fun setLastFmScrobbling(value: Boolean) = AppSettings.setLastfmScrobbleEnabled(value)
    }

    object Diagnostics {
        val statsForNerdsOverlay: StateFlow<Boolean> get() = AppSettings.showNerdStats
        fun setStatsForNerdsOverlay(value: Boolean) = AppSettings.setShowNerdStats(value)
    }

    fun resetToDefaults() {
        AppSettings.resetToDefaults()
    }
}

