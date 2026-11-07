package com.music.raaga.desktop

import com.music.raaga.data.settings.PlayerTheme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * The toggles read far from the Settings sheet that sets them.
 *
 * Mirrors Android's `AppSettings` for these few: a composable deep in the player or the lyrics
 * pane can collect one without it being threaded down through every caller.
 */
internal object DesktopAppearanceSettings {

    private fun flag(key: String, default: Boolean) =
        MutableStateFlow(DesktopPersistence().boolean(key, default))

    private val _reduceAnimation = flag(KEY_REDUCE_ANIMATION, false)
    private val _reduceDynamicBlur = flag(KEY_REDUCE_DYNAMIC_BLUR, false)
    private val _disableBlendEffects = flag(KEY_DISABLE_BLEND_EFFECTS, false)
    private val _hideVolumeBar = flag(KEY_HIDE_VOLUME_BAR, false)
    private val _ambientBackdrop = flag(KEY_AMBIENT_BACKDROP, false)
    private val _preferMusicOnlyAudio = flag(KEY_PREFER_MUSIC_ONLY_AUDIO, true)
    private val _playerTheme = MutableStateFlow(
        runCatching {
            val persistence = DesktopPersistence()
            val savedTheme = persistence.string(KEY_PLAYER_THEME, "")
            if (savedTheme.isNotBlank()) {
                PlayerTheme.valueOf(savedTheme)
            } else if (persistence.boolean("legacy_mesh_gradient", false)) {
                PlayerTheme.LEGACY
            } else {
                PlayerTheme.DEFAULT
            }
        }.getOrDefault(PlayerTheme.DEFAULT)
    )

    /** Freezes the main player's gradient instead of drifting. */
    val reduceAnimation: StateFlow<Boolean> = _reduceAnimation

    /** Swaps frosted glass for solid fills across the app. */
    val reduceDynamicBlur: StateFlow<Boolean> = _reduceDynamicBlur

    /** Draws player icons, text and menus in plain white instead of tinting with artwork. */
    val disableBlendEffects: StateFlow<Boolean> = _disableBlendEffects

    /** What the main player stands on below the artwork. */
    val playerTheme: StateFlow<PlayerTheme> = _playerTheme

    /** Removes the volume slider from the main player. */
    val hideVolumeBar: StateFlow<Boolean> = _hideVolumeBar

    /** Diffuses current artwork colors under the window glass chrome like Apple Music. */
    val ambientBackdrop: StateFlow<Boolean> = _ambientBackdrop

    /** Prefers catalogue pure audio tracks over video overhead. */
    val preferMusicOnlyAudio: StateFlow<Boolean> = _preferMusicOnlyAudio

    fun setPreferMusicOnlyAudio(value: Boolean) = write(KEY_PREFER_MUSIC_ONLY_AUDIO, value, _preferMusicOnlyAudio)

    fun setReduceAnimation(value: Boolean) = write(KEY_REDUCE_ANIMATION, value, _reduceAnimation)

    fun setReduceDynamicBlur(value: Boolean) = write(KEY_REDUCE_DYNAMIC_BLUR, value, _reduceDynamicBlur)

    fun setDisableBlendEffects(value: Boolean) = write(KEY_DISABLE_BLEND_EFFECTS, value, _disableBlendEffects)

    fun setPlayerTheme(value: PlayerTheme) {
        val persistence = DesktopPersistence()
        persistence.saveString(KEY_PLAYER_THEME, value.name)
        persistence.saveBoolean("legacy_mesh_gradient", value == PlayerTheme.LEGACY)
        _playerTheme.value = value
    }

    fun setHideVolumeBar(value: Boolean) = write(KEY_HIDE_VOLUME_BAR, value, _hideVolumeBar)

    fun setAmbientBackdrop(value: Boolean) = write(KEY_AMBIENT_BACKDROP, value, _ambientBackdrop)

    private fun write(key: String, value: Boolean, into: MutableStateFlow<Boolean>) {
        DesktopPersistence().saveBoolean(key, value)
        into.value = value
    }

    internal const val KEY_REDUCE_ANIMATION = "reduce_animation"
    internal const val KEY_REDUCE_DYNAMIC_BLUR = "reduce_dynamic_blur"
    internal const val KEY_DISABLE_BLEND_EFFECTS = "disable_blend_effects"
    internal const val KEY_PLAYER_THEME = "player_theme"
    internal const val KEY_HIDE_VOLUME_BAR = "hide_volume_bar"
    internal const val KEY_AMBIENT_BACKDROP = "ambient_backdrop"
    internal const val KEY_PREFER_MUSIC_ONLY_AUDIO = "prefer_music_only_audio"
}
