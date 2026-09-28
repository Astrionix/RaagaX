package com.music.aether.ui.performance

import android.view.Display
import kotlin.math.abs
import kotlin.math.roundToInt

private const val MIN_PERFORMANCE_REFRESH_RATE = 50
private const val MAX_REASONABLE_REFRESH_RATE = 240

/** Refresh rates the current display can actually select, normalized for UI labels. */
fun Display?.supportedPerformanceRefreshRates(): List<Int> {
    val fallback = this?.refreshRate?.roundToInt()?.coerceAtLeast(MIN_PERFORMANCE_REFRESH_RATE) ?: 60
    return this?.supportedModes
        ?.asSequence()
        ?.map { it.refreshRate.roundToInt() }
        ?.filter { it in MIN_PERFORMANCE_REFRESH_RATE..MAX_REASONABLE_REFRESH_RATE }
        ?.distinct()
        ?.sorted()
        ?.toList()
        ?.ifEmpty { listOf(fallback) }
        ?: listOf(fallback)
}

/** Maps a saved preference to a real mode, including preferences restored on another device. */
fun Display?.resolvePerformanceRefreshRate(preferred: Int): Int =
    supportedPerformanceRefreshRates().minBy { abs(it - preferred) }

/**
 * Finds the best [Display.Mode] matching the preferred refresh rate, preserving the
 * display's physical resolution. Setting preferredDisplayModeId with this mode is
 * required on many devices (e.g. Samsung, Xiaomi, OnePlus) where preferredRefreshRate
 * alone is ignored by the display hardware composer.
 */
fun Display?.resolvePerformanceMode(preferred: Int): Display.Mode? {
    if (this == null) return null
    val targetRate = resolvePerformanceRefreshRate(preferred)
    val currentMode = this.mode ?: return null
    return supportedModes
        ?.filter { it.refreshRate.roundToInt() == targetRate }
        ?.minByOrNull { mode ->
            abs(mode.physicalWidth - currentMode.physicalWidth) +
                abs(mode.physicalHeight - currentMode.physicalHeight)
        }
}
