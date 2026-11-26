package com.music.raaga.ui.player

import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.graphics.ColorUtils
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.palette.graphics.Palette
import coil3.SingletonImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import com.music.raaga.data.settings.AppSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

private val FallbackColors = listOf(
    Color(0xFF3A1C71),
    Color(0xFFD76D77),
    Color(0xFF2B5876),
    Color(0xFFFFAF7B),
)

/** The four mesh colours, wrapped so the backdrop can skip recomposition. */
@Immutable
data class MeshPalette(val colors: List<Color>)

/**
 * The Apple Music "Now Playing" backdrop: four luminous colour blobs sampled
 * from the album art, drawn as soft radial gradients and blurred into a mesh.
 * Colour changes on track skip crossfade over ~1.4s instead of snapping.
 *
 * The blobs drift when there is a reason to — the player opening, or
 * [trackKey] changing — and then come to rest. They used to orbit forever,
 * which meant re-blurring a full-screen layer at display refresh rate for as
 * long as the player was up: the most expensive thing in the app, for motion
 * that reads as ambient at best and is invisible while the phone is in a
 * pocket. The settled frame looks the same; only the battery drain is gone.
 */
@Composable
fun MeshGradientBackground(
    palette: MeshPalette,
    modifier: Modifier = Modifier,
    trackKey: Any? = null,
    driftMillis: Int = 8_000,
    continuous: Boolean = false,
    blurRadius: Dp = 64.dp,
    animated: Boolean = true,
) {
    MeshGradientBackground(
        palette = palette,
        modifier = modifier,
        trackKey = trackKey,
        driftMillis = driftMillis,
        continuous = continuous,
        blurRadius = blurRadius,
        animated = animated,
        mix = null,
        snapKey = null,
        settled = false,
        currentIsOutgoing = false,
    )
}

@Composable
internal fun MeshGradientBackground(
    palette: MeshPalette,
    modifier: Modifier,
    trackKey: Any? = null,
    driftMillis: Int = 8_000,
    continuous: Boolean = false,
    blurRadius: Dp = 64.dp,
    animated: Boolean = true,
    colorFadeMillis: Int = 1400,
    paused: Boolean = false,
    mix: AutoMixAmbientMix?,
    snapKey: Any?,
    settled: Boolean,
    currentIsOutgoing: Boolean,
    directStill: Boolean = false,
) {
    val reduceAnimation by AppSettings.reduceAnimation.collectAsStateWithLifecycle()

    val lastDrawn = remember { LastLegacyAmbientColors() }
    val held = remember(mix) {
        if (mix == null) null else lastDrawn.colors ?: run {
            val slots = (cachedArtworkPalette(mix.outgoingUrl)
                ?: if (currentIsOutgoing) palette else MeshPalette(FallbackColors)).tunedSlots()
            LegacyAmbientColors(slots, slots.first().dimmed())
        }
    }
    val tuned = held?.slots ?: palette.tunedSlots()

    // Each colour slot crossfades independently when the track (palette) changes,
    // unless "reduce animation" is on, in which case colours snap straight to target.
    val colorSpec: AnimationSpec<Color> = if (directStill || reduceAnimation || !animated) snap() else tween(colorFadeMillis)
    val (animatedColors, baseColor) = key(snapKey) {
        val slots = tuned.mapIndexed { index, color ->
            animateColorAsState(color, colorSpec, label = "meshColor$index")
        }
        slots to animateColorAsState(held?.base ?: tuned.first().dimmed(), colorSpec, label = "meshBase")
    }
    val target = remember(mix) {
        mix?.prepared?.palette?.tunedSlots()?.let { LegacyAmbientColors(it, it.first().dimmed()) }
    }

    // Read in the draw lambda, not here: an Animatable read during draw
    // invalidates only the drawing, leaving composition out of the loop.
    val phase = remember { Animatable(0f) }
    LaunchedEffect(trackKey, reduceAnimation, continuous, animated, paused, mix, settled) {
        when {
            !animated || reduceAnimation -> phase.snapTo(0f)
            paused || mix != null || settled -> Unit
            continuous -> while (isActive) {
                phase.animateTo(
                    targetValue = phase.value + (2 * PI).toFloat(),
                    animationSpec = tween(driftMillis * 4, easing = LinearEasing),
                )
            }
            else -> phase.animateTo(
                targetValue = phase.value + DRIFT_RADIANS,
                animationSpec = tween(driftMillis, easing = FastOutSlowInEasing),
            )
        }
    }

    val useGpuBlur = animated && !reduceAnimation && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .clipToBounds()
            .then(
                if (useGpuBlur) {
                    Modifier
                        .graphicsLayer {
                            scaleX = 1.3f
                            scaleY = 1.3f
                        }
                        .then(
                            if (held == null || mix == null) {
                                Modifier.background(if (directStill) tuned.first().dimmed() else baseColor.value)
                            } else {
                                Modifier.drawBehind {
                                    drawRect(ambientColor(held.base, target?.base, mix.ease()))
                                }
                            },
                        )
                        .blur(blurRadius)
                } else {
                    if (held == null || mix == null) {
                        Modifier.background(if (directStill) tuned.first().dimmed() else baseColor.value)
                    } else {
                        Modifier.drawBehind {
                            drawRect(ambientColor(held.base, target?.base, mix.ease()))
                        }
                    }
                },
            ),
    ) {
        val anchors = listOf(
            Offset(0.20f, 0.25f),
            Offset(0.80f, 0.20f),
            Offset(0.75f, 0.80f),
            Offset(0.25f, 0.75f),
        )
        val speeds = listOf(1f, -0.7f, 0.85f, -1.15f)
        val drift = phase.value

        val e = mix?.ease() ?: 0f
        val slots = held?.slots ?: if (directStill) tuned else animatedColors.map { it.value }
        if (held == null && trackKey != null) {
            lastDrawn.colors = LegacyAmbientColors(slots, if (directStill) tuned.first().dimmed() else baseColor.value)
        }
        slots.forEachIndexed { index, slot ->
            val color = ambientColor(slot, target?.slots?.get(index), e)
            val anchor = anchors[index]
            val center = Offset(
                x = (anchor.x + 0.16f * cos(drift * speeds[index] + index * 1.7f)) * size.width,
                y = (anchor.y + 0.16f * sin(drift * speeds[index] * 0.9f + index * 2.3f)) * size.height,
            )
            val radius = size.maxDimension * 0.62f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(color.copy(alpha = 0.85f), color.copy(alpha = 0f)),
                    center = center,
                    radius = radius,
                ),
                radius = radius,
                center = center,
            )
        }

        // Gentle scrim so white text stays legible over bright art.
        drawRect(
            brush = Brush.verticalGradient(
                colors = listOf(
                    Color.Black.copy(alpha = 0.10f),
                    Color.Black.copy(alpha = 0.38f),
                ),
            ),
        )
    }
}

private class LastLegacyAmbientColors(var colors: LegacyAmbientColors? = null)
private class LegacyAmbientColors(val slots: List<Color>, val base: Color)

private fun MeshPalette.tunedSlots(): List<Color> =
    (colors.ifEmpty { FallbackColors } + FallbackColors).take(4).map { it.tuned() }

private fun ambientColor(from: Color, to: Color?, e: Float): Color = when {
    to == null || e <= 0f -> from
    e >= 1f -> to
    else -> lerp(from, to, e)
}

@Composable
fun rememberArtworkColors(imageUrl: String?, canvasFrame: Bitmap? = null): MeshPalette =
    rememberArtworkColors(imageUrl, canvasFrame, seed = null)

@Composable
internal fun rememberArtworkColors(
    imageUrl: String?,
    canvasFrame: Bitmap?,
    seed: MeshPalette?,
    clipKey: Any? = imageUrl,
): MeshPalette {
    val context = LocalContext.current
    var palette by remember(imageUrl, clipKey) { mutableStateOf(seed ?: MeshPalette(FallbackColors)) }

    LaunchedEffect(imageUrl, clipKey) {
        if (imageUrl == null || seed != null) return@LaunchedEffect
        val next = cachedArtworkPalette(imageUrl) ?: run {
            val bitmap = loadArtworkPaletteBitmap(context, imageUrl) ?: return@LaunchedEffect
            withContext(Dispatchers.Default) { MeshPalette(paletteOf(bitmap)) }
        }
        artworkPaletteCache[imageUrl] = next
        palette = next
    }

    LaunchedEffect(imageUrl, clipKey, canvasFrame) {
        val frame = canvasFrame ?: return@LaunchedEffect
        if (isLikelyBlackFrame(frame)) return@LaunchedEffect
        val colors = withContext(Dispatchers.Default) { paletteOf(frame) }
        palette = MeshPalette(colors)
    }
    return palette
}

private val artworkPaletteCache = object : LinkedHashMap<String, MeshPalette>(0, 0.75f, true) {
    override fun removeEldestEntry(eldest: Map.Entry<String, MeshPalette>) = size > 8
}

internal fun cachedArtworkPalette(imageUrl: String?): MeshPalette? = imageUrl?.let(artworkPaletteCache::get)

internal suspend fun prefetchArtworkPalette(context: Context, imageUrl: String): MeshPalette? {
    cachedArtworkPalette(imageUrl)?.let { return it }
    val bitmap = loadArtworkPaletteBitmap(context, imageUrl) ?: return null
    val palette = withContext(Dispatchers.Default) { MeshPalette(paletteOf(bitmap)) }
    artworkPaletteCache[imageUrl] = palette
    return palette
}

private suspend fun loadArtworkPaletteBitmap(context: Context, imageUrl: String): Bitmap? {
    val request = ImageRequest.Builder(context)
        .data(imageUrl)
        .size(128)
        .allowHardware(false)
        .build()
    val result = SingletonImageLoader.get(context).execute(request)
    return (result as? SuccessResult)?.image?.toBitmap()
}

/**
 * How far the blobs travel in one settle. A shade under half a turn: enough
 * that the backdrop visibly reacts to a track change, short of a full orbit
 * that would land the blobs back where they started.
 */
private const val DRIFT_RADIANS = (PI * 0.45f).toFloat()

/**
 * Four mesh colours drawn from the artwork.
 *
 * The named swatches — vibrant, muted and friends — are a convenience over the
 * full set, and on dark or desaturated sleeves every vibrant slot comes back
 * null: Karan Aujla's marble interior fills two of the five. Topping the rest
 * up from [FallbackColors] is what left those covers sitting under the stock
 * purple. So the whole swatch list is read instead, and any shortfall is
 * derived from the art's own colours rather than borrowed.
 */

/**
 * The player's four mesh colours for [bitmap], for surfaces that draw the mesh
 * somewhere this code doesn't run — the watch app is sent these rather than
 * running Palette on a watch.
 */
fun artworkMeshColors(bitmap: androidx.compose.ui.graphics.ImageBitmap): List<Color> =
    paletteOf(bitmap.asAndroidBitmap())

fun artworkMeshColors(bitmap: Bitmap): List<Color> = paletteOf(bitmap)

private fun paletteOf(bitmap: Bitmap): List<Color> {
    fun swatchesOf(builder: Palette.Builder): List<Color> =
        builder.maximumColorCount(24).generate().swatches
            .sortedByDescending { it.population }
            .map { Color(it.rgb) }

    val found = swatchesOf(Palette.from(bitmap)).ifEmpty {
        // The default filter discards near-black and near-white, which on a
        // monochrome sleeve can be everything there is.
        swatchesOf(Palette.from(bitmap).clearFilters())
    }

    val distinct = found.distinctEnough()
    return when {
        distinct.isEmpty() -> FallbackColors
        distinct.size >= 4 -> distinct.take(4)
        else -> distinct.expandedToFour()
    }
}

/** Drop near-duplicates, so the four blobs don't collapse into one wash. */
private fun List<Color>.distinctEnough(): List<Color> {
    val kept = mutableListOf<Color>()
    forEach { color -> if (kept.none { it.isCloseTo(color) }) kept += color }
    return kept
}

private fun Color.isCloseTo(other: Color): Boolean {
    val a = hsl()
    val b = other.hsl()
    val hueGap = abs(a[0] - b[0]).let { min(it, 360f - it) }
    return hueGap < 15f && abs(a[2] - b[2]) < 0.12f
}

/** Fill the empty slots off the art itself, fanning hue and lightness out. */
private fun List<Color>.expandedToFour(): List<Color> {
    val out = toMutableList()
    var step = 1
    while (out.size < 4) {
        out += this[(out.size - size) % size].shifted(24f * step, 0.12f * step)
        step++
    }
    return out
}

private fun Color.shifted(hue: Float, lightness: Float): Color {
    val hsl = hsl()
    hsl[0] = (hsl[0] + hue) % 360f
    hsl[2] = (hsl[2] + lightness).coerceIn(0.2f, 0.7f)
    return Color(ColorUtils.HSLToColor(hsl))
}

private fun Color.hsl(): FloatArray =
    FloatArray(3).also { ColorUtils.colorToHSL(toArgb(), it) }

/** Boost saturation and clamp lightness so any artwork yields a rich, non-muddy mesh. */
private fun Color.tuned(): Color {
    val hsl = FloatArray(3)
    ColorUtils.colorToHSL(toArgb(), hsl)
    hsl[1] = (hsl[1] * 1.35f).coerceAtMost(1f)
    hsl[2] = hsl[2].coerceIn(0.28f, 0.58f)
    return Color(ColorUtils.HSLToColor(hsl))
}

private fun Color.dimmed(): Color {
    val hsl = FloatArray(3)
    ColorUtils.colorToHSL(toArgb(), hsl)
    hsl[2] = 0.12f
    return Color(ColorUtils.HSLToColor(hsl))
}

/**
 * How long each palette in a [cyclingMeshPalette] is held, which is also how
 * long the fade into it takes — pass it as `colorFadeMillis` so one crossfade
 * runs straight into the next and the colour is never at rest.
 */
const val MESH_CYCLE_MILLIS = 3_600

/**
 * Raaga's own colours, for surfaces that have no artwork to take them
 * from: the welcome pages and sign-in cards. Starts on vivid red and wanders
 * through ambient auroras.
 */
val WelcomeMeshPalettes: List<MeshPalette> = listOf(
    // Red, violet, ember.
    MeshPalette(listOf(Color(0xFFFA2D48), Color(0xFF7B2FF7), Color(0xFFFF7A45), Color(0xFF2E1A8A))),
    // Sunset.
    MeshPalette(listOf(Color(0xFFFF4E8A), Color(0xFFFF9A3C), Color(0xFFE0245E), Color(0xFF6A1B9A))),
    // Ocean.
    MeshPalette(listOf(Color(0xFF1E88E5), Color(0xFF00BFA5), Color(0xFF5E35B1), Color(0xFF0D47A1))),
    // Aurora.
    MeshPalette(listOf(Color(0xFF00C853), Color(0xFF00B8D4), Color(0xFF7C4DFF), Color(0xFF1A237E))),
    // Grape and rose.
    MeshPalette(listOf(Color(0xFFD500F9), Color(0xFFFF4081), Color(0xFF651FFF), Color(0xFF4A148C))),
    // Gold.
    MeshPalette(listOf(Color(0xFFFFB300), Color(0xFFFF5252), Color(0xFFF06292), Color(0xFF6D2E46))),
)

/**
 * Steps through [palettes] for as long as the caller is composed, one every
 * [stepMillis].
 */
@Composable
fun cyclingMeshPalette(palettes: List<MeshPalette>, stepMillis: Int = MESH_CYCLE_MILLIS): MeshPalette {
    var step by remember { androidx.compose.runtime.mutableIntStateOf(0) }
    LaunchedEffect(stepMillis) {
        while (isActive) {
            kotlinx.coroutines.delay(stepMillis.toLong())
            step++
        }
    }
    return palettes[step % palettes.size]
}

