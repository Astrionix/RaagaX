package com.music.raaga.desktop

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class DesktopArtworkPalette(
    val primary: Color,
    val secondary: Color,
) {
    companion object {
        val Default = DesktopArtworkPalette(Color(0xFF242731), Color(0xFF3B4050))
    }
}

@Composable
fun rememberDesktopArtworkPalette(url: String?): DesktopArtworkPalette {
    val palette by produceState(DesktopArtworkPalette.Default, key1 = url) {
        value = DesktopArtworkPalette.Default
        value = withContext(Dispatchers.IO) { DesktopArtworkPalette.from(DesktopArtworkCache.load(url)) }
    }
    return palette
}

private fun DesktopArtworkPalette.Companion.from(bitmap: ImageBitmap?): DesktopArtworkPalette {
    if (bitmap == null || bitmap.width == 0 || bitmap.height == 0) return DesktopArtworkPalette.Default
    val pixels = IntArray(bitmap.width * bitmap.height)
    bitmap.readPixels(pixels)

    // Hue buckets (12 bins: 30° each) to group pixels by color family
    class HueBucket {
        var count = 0
        var weight = 0f
        var rSum = 0.0
        var gSum = 0.0
        var bSum = 0.0
        var maxSat = 0f
    }

    val buckets = Array(12) { HueBucket() }
    var chromaticCount = 0
    var totalSampled = 0
    val tempHsl = FloatArray(3)

    // Sample pixels across the artwork
    val step = (pixels.size / 1024).coerceIn(1, 16)
    for (i in pixels.indices step step) {
        val pixel = pixels[i]
        val r = (pixel shr 16 and 0xFF) / 255f
        val g = (pixel shr 8 and 0xFF) / 255f
        val b = (pixel and 0xFF) / 255f

        val max = maxOf(r, g, b)
        val min = minOf(r, g, b)
        val l = (max + min) / 2f
        val d = max - min
        val s = if (max == min) 0f else if (l > 0.5f) d / (2f - max - min) else d / (max + min)

        totalSampled++
        // Ignore crushed black and blown white noise
        if (l < 0.08f || l > 0.94f || s < 0.13f) continue

        var h = when {
            max == min -> 0f
            max == r -> ((g - b) / d + (if (g < b) 6f else 0f)) * 60f
            max == g -> ((b - r) / d + 2f) * 60f
            else -> ((r - g) / d + 4f) * 60f
        }
        if (h < 0f) h += 360f

        val bin = ((h % 360f) / 30f).toInt().coerceIn(0, 11)
        val lumWeight = 1.0f - kotlin.math.abs(l - 0.50f) * 0.7f
        val w = s * lumWeight.coerceAtLeast(0.2f)

        val bucket = buckets[bin]
        bucket.count++
        bucket.weight += w
        bucket.rSum += r
        bucket.gSum += g
        bucket.bSum += b
        if (s > bucket.maxSat) bucket.maxSat = s
        chromaticCount++
    }

    if (totalSampled == 0) return DesktopArtworkPalette.Default

    val hasColor = chromaticCount >= (totalSampled * 0.05f)
    if (!hasColor) {
        // Clean neutral monochrome
        return DesktopArtworkPalette(Color(0xFF282C37), Color(0xFF404658))
    }

    val sortedBuckets = buckets.filter { it.count > 0 }.sortedByDescending { it.weight }
    val primaryBucket = sortedBuckets.firstOrNull() ?: return DesktopArtworkPalette.Default

    val pR = (primaryBucket.rSum / primaryBucket.count).toFloat().coerceIn(0f, 1f)
    val pG = (primaryBucket.gSum / primaryBucket.count).toFloat().coerceIn(0f, 1f)
    val pB = (primaryBucket.bSum / primaryBucket.count).toFloat().coerceIn(0f, 1f)

    val primaryColor = Color(pR, pG, pB, 1f)

    // For secondary: use the second distinct color family if present, or an enhanced vibrant variant
    val secondaryBucket = sortedBuckets.getOrNull(1)?.takeIf { it.count >= primaryBucket.count * 0.25f }
    val secondaryColor = if (secondaryBucket != null) {
        val sR = (secondaryBucket.rSum / secondaryBucket.count).toFloat().coerceIn(0f, 1f)
        val sG = (secondaryBucket.gSum / secondaryBucket.count).toFloat().coerceIn(0f, 1f)
        val sB = (secondaryBucket.bSum / secondaryBucket.count).toFloat().coerceIn(0f, 1f)
        Color(sR, sG, sB, 1f)
    } else {
        // Boost saturation and lift lightness harmoniously without artificial purple bias
        val max = maxOf(pR, pG, pB)
        val min = minOf(pR, pG, pB)
        val l = ((max + min) / 2f).coerceIn(0.40f, 0.70f)
        val boost = 1.25f
        Color(
            red = (pR * boost).coerceIn(0f, 1f),
            green = (pG * boost).coerceIn(0f, 1f),
            blue = (pB * boost).coerceIn(0f, 1f),
            alpha = 1f,
        )
    }

    return DesktopArtworkPalette(
        primary = primaryColor,
        secondary = secondaryColor,
    )
}
