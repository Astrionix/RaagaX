package com.music.raaga.data.settings

import androidx.annotation.StringRes
import com.music.raaga.R

/**
 * The visual presentation modes available for the Now Playing player background.
 *
 * - [NEW]: Full-screen ambient artwork Gaussian blur with layered radial atmospheric lighting
 *   (blue, violet, purple, magenta) inspired by the Apple Music player experience.
 * - [LEGACY]: Seam-aware reflected mesh gradient continuing from the cover's bottom edge (ArtworkMeshBackdrop).
 * - [OLD]: Original v1.5 classic 4-blob drifting quantised mesh gradient (MeshGradientBackground).
 */
enum class NowPlayingBlurStyle(
    val key: String,
    @get:StringRes val titleRes: Int,
    @get:StringRes val subtitleRes: Int,
) {
    NEW(
        key = "new",
        titleRes = R.string.blur_style_new,
        subtitleRes = R.string.blur_style_new_subtitle,
    ),
    LEGACY(
        key = "legacy",
        titleRes = R.string.blur_style_legacy,
        subtitleRes = R.string.blur_style_legacy_subtitle,
    ),
    OLD(
        key = "old",
        titleRes = R.string.blur_style_old,
        subtitleRes = R.string.blur_style_old_subtitle,
    );

    companion object {
        fun fromKey(key: String?): NowPlayingBlurStyle {
            if (key.isNullOrBlank()) return NEW
            return entries.firstOrNull {
                it.key.equals(key, ignoreCase = true) || it.name.equals(key, ignoreCase = true)
            } ?: NEW
        }
    }
}

