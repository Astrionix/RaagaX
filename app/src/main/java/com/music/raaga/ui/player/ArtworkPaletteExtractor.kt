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
            dominant = Color(0xFF181A22),
            vibrant = Color(0xFF2C3240),
            secondary = Color(0xFF202430),
            accent = Color(0xFF4C556C),
            primaryGlow = Color(0xFF2C3240),
            secondaryGlow = Color(0xFF202430),
            accentGlow = Color(0xFF4C556C),
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

        val hslMap = swatches.associateWith { s ->
            FloatArray(3).also { ColorUtils.colorToHSL(s.rgb, it) }
        }
        val totalPop = swatches.sumOf { it.population }.coerceAtLeast(1)

        val chromaticSwatches = swatches.filter { s ->
            val hsl = hslMap.getValue(s)
            hsl[1] >= 0.13f && hsl[2] in 0.08f..0.92f
        }
        val chromaticPop = chromaticSwatches.sumOf { it.population }
        val hasSignificantColor = chromaticPop >= (totalPop * 0.05f) ||
            chromaticSwatches.any { it.population >= (totalPop * 0.08f) }
        val isMonochrome = !hasSignificantColor || chromaticSwatches.isEmpty()

        if (isMonochrome) {
            // For monochrome covers (pencil sketches, vintage B&W photos),
            // preserve the artwork's dominant tone as the foundation with subtle slate/charcoal tones.
            val dominantRgb = swatches.first().rgb
            val liftedDominant = liftColor(dominantRgb, minLuminance = 0.12f, maxLuminance = 0.35f)

            return AmbientArtworkPalette(
                dominant = Color(liftedDominant),
                vibrant = Color(0xFF384357), // Slate neutral
                secondary = Color(0xFF1E293B),
                accent = Color(0xFF64748B),
                primaryGlow = Color(0xFF475569),
                secondaryGlow = Color(0xFF334155),
                accentGlow = Color(0xFF64748B),
                darkVignetteBase = Color(ColorUtils.blendARGB(liftedDominant, TARGET_BASE_DARK, 0.90f)),
                isMonochrome = true,
            )
        }

        // 2. Multi-color dynamic artwork extraction: pick true chromatic notes without
        // discarding warm colors or picking up near-black chroma noise.
        val dominantSwatch = chromaticSwatches.maxByOrNull { s ->
            val hsl = hslMap.getValue(s)
            val lumWeight = 1.0f - kotlin.math.abs(hsl[2] - 0.45f) * 0.7f
            s.population.toFloat() * Math.pow(hsl[1].toDouble(), 0.75).toFloat() * lumWeight.coerceAtLeast(0.2f)
        } ?: swatches.first()

        val vibrantSwatch = chromaticSwatches.maxByOrNull { s ->
            val hsl = hslMap.getValue(s)
            val lumWeight = 1.0f - kotlin.math.abs(hsl[2] - 0.55f) * 0.8f
            Math.pow(hsl[1].toDouble(), 1.2).toFloat() * Math.sqrt(s.population.toDouble()).toFloat() * lumWeight.coerceAtLeast(0.2f)
        } ?: dominantSwatch

        val secondarySwatch = chromaticSwatches.firstOrNull { s ->
            if (s.rgb == dominantSwatch.rgb || s.rgb == vibrantSwatch.rgb) return@firstOrNull false
            val hslA = hslMap.getValue(s)
            val hslB = hslMap.getValue(dominantSwatch)
            val hueDiff = Math.abs(hslA[0] - hslB[0]).let { Math.min(it, 360f - it) }
            hueDiff >= 20f || Math.abs(hslA[2] - hslB[2]) >= 0.15f
        } ?: chromaticSwatches.getOrNull(1) ?: dominantSwatch

        val accentSwatch = chromaticSwatches.maxByOrNull { s ->
            if (s.rgb == dominantSwatch.rgb) 0f else hslMap.getValue(s)[1]
        } ?: vibrantSwatch

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
     * Prevents amplifying low-saturation noise into fake purple or green.
     */
    private fun liftColor(rgb: Int, minLuminance: Float, maxLuminance: Float): Int {
        val hsl = FloatArray(3)
        ColorUtils.colorToHSL(rgb, hsl)
        if (hsl[1] >= 0.12f) {
            hsl[1] = (hsl[1] * 1.15f).coerceIn(0.20f, 0.95f)
        }
        hsl[2] = hsl[2].coerceIn(minLuminance, maxLuminance)
        return ColorUtils.HSLToColor(hsl)
    }

    fun clearCache() {
        paletteCache.clear()
    }
}
