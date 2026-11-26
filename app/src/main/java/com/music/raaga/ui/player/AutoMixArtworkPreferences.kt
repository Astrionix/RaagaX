package com.music.raaga.ui.player

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.data.settings.AppSettings

/** Saved choices plus in-memory fences for mixes interrupted by a preference change. */
data class AutoMixArtworkPreferences(
    val artTransition: Boolean = false,
    val miniPlayerTransition: Boolean = false,
    val skipArtworkThrough: Long = 0L,
    val skipMiniThrough: Long = 0L,
) {
    internal fun gate(automix: Boolean, mini: Boolean = false) = AutoMixArtworkGate(
        enabled = automix && (if (mini) miniPlayerTransition else artTransition),
        skipThrough = if (mini) skipMiniThrough else skipArtworkThrough,
    )

    fun allows(automix: Boolean, generation: Long, mini: Boolean = false): Boolean =
        gate(automix, mini).allows(generation)
}

internal data class AutoMixArtworkGate(val enabled: Boolean = true, val skipThrough: Long = 0L) {
    fun allows(generation: Long) = enabled && generation > skipThrough
}

@Composable
internal fun autoMixArtworkGate(mini: Boolean = false): AutoMixArtworkGate {
    val automix by AppSettings.smartFadeEnabled.collectAsStateWithLifecycle()
    val preferences by AppSettings.autoMixArtwork.collectAsStateWithLifecycle()
    return preferences.gate(automix, mini)
}
