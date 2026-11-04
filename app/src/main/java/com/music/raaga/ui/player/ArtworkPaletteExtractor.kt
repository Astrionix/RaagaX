package com.music.raaga.ui.player

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.core.graphics.ColorUtils
import androidx.palette.graphics.Palette
import coil3.SingletonImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Collections

/**
 * An ambient lighting colour palette extracted dynamically from album artwork,
 * preserving each album's true dominant, vibrant, secondary, and accent colors.
 */
@Immutable
data class AmbientArtworkPalette(
    val dominant: Color,
    val vibrant: Color,
    val secondary: Color,
    val accent: Color,
    val primaryGlow: Color,
    val secondaryGlow: Color,
    val accentGlow: Color,
    val darkVignetteBase: Color,
    val isMonochrome: Boolean = false,
) {
    companion object {
        /**
         * Fallback palette used when artwork is absent or during initial load.
         */
        val Default = AmbientArtworkPalette(
            dominant = Color(0xFF1E1B4B),
            vibrant = Color(0xFF4C1D95),
            secondary = Color(0xFF1E3A8A),
            accent = Color(0xFFC026D3),
            primaryGlow = Color(0xFF4C1D95),
            secondaryGlow = Color(0xFF1E3A8A),
            accentGlow = Color(0xFFC026D3),
            darkVignetteBase = Color(0xFF090A10),
            isMonochrome = false,
        )
    }
}

/**
 * High-performance dynamic colour engine that extracts and tunes album artwork colours
 * for the ambient player background, dynamically adapting to the album's actual colors.
 */
object ArtworkPaletteExtractor {

    private const val MAX_CACHE_ENTRIES = 48
    private const val THUMBNAIL_EXTRACTION_PX = 128
    private const val TARGET_BASE_DARK = 0xFF08080C.toInt()

    private val paletteCache: MutableMap<String, AmbientArtworkPalette> =
        Collections.synchronizedMap(
            object : LinkedHashMap<String, AmbientArtworkPalette>(32, 0.75f, true) {
                override fun removeEldestEntry(eldest: Map.Entry<String, AmbientArtworkPalette>?): Boolean {
                    return size > MAX_CACHE_ENTRIES
                }
            },
        )

    /**
     * Retrieves a cached palette or extracts a fresh one from [bitmap].
     */
    fun extract(bitmap: Bitmap?, cacheKey: String? = null): AmbientArtworkPalette {
        if (bitmap == null) return AmbientArtworkPalette.Default
        if (!cacheKey.isNullOrBlank()) {
            paletteCache[cacheKey]?.let { return it }
        }

        val palette = computePalette(bitmap)
        if (!cacheKey.isNullOrBlank()) {
            paletteCache[cacheKey] = palette
        }
        return palette
    }

    /**
     * Loads a thumbnail via Coil and computes its ambient palette.
     */
    suspend fun extractFromUrl(context: Context, imageUrl: String?): AmbientArtworkPalette {
        if (imageUrl.isNullOrBlank()) return AmbientArtworkPalette.Default
        paletteCache[imageUrl]?.let { return it }

        return withContext(Dispatchers.IO) {
            val request = ImageRequest.Builder(context)
                .data(imageUrl)
                .size(THUMBNAIL_EXTRACTION_PX)
                .allowHardware(false)
                .build()
            val result = SingletonImageLoader.get(context).execute(request)
            val bitmap = (result as? SuccessResult)?.image?.toBitmap()
            if (bitmap != null) {
                val computed = computePalette(bitmap)
                paletteCache[imageUrl] = computed
                computed
            } else {
                AmbientArtworkPalette.Default
            }
        }
    }

    private fun computePalette(bitmap: Bitmap): AmbientArtworkPalette {
        val workingBitmap = if (bitmap.width > THUMBNAIL_EXTRACTION_PX || bitmap.height > THUMBNAIL_EXTRACTION_PX) {
            Bitmap.createScaledBitmap(bitmap, THUMBNAIL_EXTRACTION_PX, THUMBNAIL_EXTRACTION_PX, true)
        } else {
            bitmap
        }

        val palette = Palette.from(workingBitmap)
            .maximumColorCount(24)
            .clearFilters()
            .generate()

        val swatches = palette.swatches.sortedByDescending { it.population }
        if (swatches.isEmpty()) return AmbientArtworkPalette.Default

        // 1. Detect if the artwork is monochrome / black & white
        var maxSaturation = 0f
        for (s in swatches.take(6)) {
            val hsl = FloatArray(3)
            ColorUtils.colorToHSL(s.rgb, hsl)
            if (hsl[1] > maxSaturation) {
                maxSaturation = hsl[1]
            }
        }
        val isMonochrome = maxSaturation < 0.08f

        if (isMonochrome) {
            // For monochrome covers (pencil sketches, vintage B&W photos),
            // preserve the artwork's dominant tone as the foundation with subtle slate/charcoal tones.
            val dominantRgb = swatches.first().rgb
            val liftedDominant = liftColor(dominantRgb, minLuminance = 0.12f, maxLuminance = 0.35f)

            return AmbientArtworkPalette(
                dominant = Color(liftedDominant),
                vibrant = Color(0xFF384357), // Slate blue
                secondary = Color(0xFF1E293B),
                accent = Color(0xFF64748B),
                primaryGlow = Color(0xFF475569),
                secondaryGlow = Color(0xFF334155),
                accentGlow = Color(0xFF64748B),
                darkVignetteBase = Color(ColorUtils.blendARGB(liftedDominant, TARGET_BASE_DARK, 0.90f)),
                isMonochrome = true,
            )
        }

        // 2. Multi-color dynamic artwork extraction 100% true to the cover art
        val dominantSwatch = palette.dominantSwatch ?: swatches.first()
        val vibrantSwatch = palette.vibrantSwatch
            ?: palette.lightVibrantSwatch
            ?: palette.darkVibrantSwatch
            ?: dominantSwatch
        val secondarySwatch = palette.mutedSwatch
            ?: palette.lightMutedSwatch
            ?: swatches.getOrNull(1)
            ?: dominantSwatch
        val accentSwatch = palette.lightVibrantSwatch
            ?: palette.darkVibrantSwatch
            ?: palette.darkMutedSwatch
            ?: vibrantSwatch

        val domRgb = liftColor(dominantSwatch.rgb, minLuminance = 0.12f, maxLuminance = 0.50f)
        val vibRgb = liftColor(vibrantSwatch.rgb, minLuminance = 0.25f, maxLuminance = 0.75f)
        val secRgb = liftColor(secondarySwatch.rgb, minLuminance = 0.18f, maxLuminance = 0.60f)
        val accRgb = liftColor(accentSwatch.rgb, minLuminance = 0.28f, maxLuminance = 0.80f)

        // Dark vignette floor matching the artwork's own dominant tone
        val vignetteBase = ColorUtils.blendARGB(domRgb, TARGET_BASE_DARK, 0.88f)

        return AmbientArtworkPalette(
            dominant = Color(domRgb),
            vibrant = Color(vibRgb),
            secondary = Color(secRgb),
            accent = Color(accRgb),
            primaryGlow = Color(vibRgb),
            secondaryGlow = Color(secRgb),
            accentGlow = Color(accRgb),
            darkVignetteBase = Color(vignetteBase),
            isMonochrome = false,
        )
    }

    /**
     * Normalizes luminance and saturation so colors stay vivid and visible behind the blur
     * without blowing out contrast or muddying into pitch black.
     */
    private fun liftColor(rgb: Int, minLuminance: Float, maxLuminance: Float): Int {
        val hsl = FloatArray(3)
        ColorUtils.colorToHSL(rgb, hsl)
        hsl[1] = (hsl[1] * 1.15f).coerceIn(0.25f, 0.95f)
        hsl[2] = hsl[2].coerceIn(minLuminance, maxLuminance)
        return ColorUtils.HSLToColor(hsl)
    }

    fun clearCache() {
        paletteCache.clear()
    }
}
