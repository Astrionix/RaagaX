package com.music.raaga.ui.player

import android.graphics.Bitmap
import android.os.Build
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.SingletonImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import com.music.raaga.data.settings.AppSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Collections
import kotlin.math.max

private const val AMBIENT_SOURCE_PX = 160
private const val AMBIENT_BLUR_BOX_PASSES = 3
private const val AMBIENT_CROSSFADE_MS = 900

@Immutable
data class AmbientBlurState(
    val bitmap: ImageBitmap? = null,
    val blurredFallbackBitmap: ImageBitmap? = null,
    val palette: AmbientArtworkPalette = AmbientArtworkPalette.Default,
)

/**
 * In-memory cache for processed ambient blur bitmaps and states.
 */
private val ambientStateCache: MutableMap<String, AmbientBlurState> =
    Collections.synchronizedMap(
        object : LinkedHashMap<String, AmbientBlurState>(24, 0.75f, true) {
            override fun removeEldestEntry(eldest: Map.Entry<String, AmbientBlurState>?): Boolean {
                return size > 32
            }
        },
    )

/**
 * Loads downsampled artwork, extracts its dynamic ambient palette, and prepares
 * hardware / software blur layers off the main thread.
 */
@Composable
fun rememberAmbientBlurState(
    imageUrl: String?,
    canvasFrame: Bitmap? = null,
): AmbientBlurState {
    val context = LocalContext.current
    val cacheKey = imageUrl ?: "frame_${canvasFrame.hashCode()}"

    var state by remember(cacheKey) {
        mutableStateOf(ambientStateCache[cacheKey] ?: AmbientBlurState())
    }

    LaunchedEffect(imageUrl) {
        if (imageUrl.isNullOrBlank()) {
            state = AmbientBlurState()
            return@LaunchedEffect
        }
        ambientStateCache[imageUrl]?.let {
            state = it
            return@LaunchedEffect
        }

        withContext(Dispatchers.IO) {
            val request = ImageRequest.Builder(context)
                .data(imageUrl)
                .size(AMBIENT_SOURCE_PX)
                .allowHardware(false)
                .build()
            val result = SingletonImageLoader.get(context).execute(request)
            val bitmap = (result as? SuccessResult)?.image?.toBitmap()
            if (bitmap != null) {
                val palette = ArtworkPaletteExtractor.extract(bitmap, imageUrl)
                val fallbackBlurred = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                    fastBoxBlur(bitmap, AMBIENT_BLUR_BOX_PASSES).asImageBitmap()
                } else null

                val computed = AmbientBlurState(
                    bitmap = bitmap.asImageBitmap(),
                    blurredFallbackBitmap = fallbackBlurred,
                    palette = palette,
                )
                ambientStateCache[imageUrl] = computed
                state = computed
            }
        }
    }

    LaunchedEffect(canvasFrame) {
        val frame = canvasFrame ?: return@LaunchedEffect
        withContext(Dispatchers.Default) {
            val palette = ArtworkPaletteExtractor.extract(frame, "frame_${frame.hashCode()}")
            val fallbackBlurred = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                fastBoxBlur(frame, AMBIENT_BLUR_BOX_PASSES).asImageBitmap()
            } else null

            state = AmbientBlurState(
                bitmap = frame.asImageBitmap(),
                blurredFallbackBitmap = fallbackBlurred,
                palette = palette,
            )
        }
    }

    return state
}

/**
 * Apple Music-inspired Premium Ambient Artwork Blur Renderer.
 *
 * Visual Layers:
 * 1. Base dark vignette floor matching artwork hue.
 * 2. Full-screen Gaussian-blurred artwork scaled 1.38x to eliminate border artifacts.
 * 3. Layered dynamic radial gradient atmospheric lighting (violet, blue, purple, magenta).
 * 4. Progressive contrast scrim ensuring white typography and playback controls are 100% legible.
 * 5. Smooth crossfading between tracks with zero flashes.
 */
@Composable
fun AmbientArtworkBlurBackdrop(
    imageUrl: String?,
    canvasFrame: Bitmap? = null,
    modifier: Modifier = Modifier,
    blurRadius: Dp = 80.dp,
) {
    val reduceAnimation by AppSettings.reduceAnimation.collectAsStateWithLifecycle()
    val reduceDynamicBlur by AppSettings.reduceDynamicBlur.collectAsStateWithLifecycle()
    val canGpuBlur = !reduceDynamicBlur && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    val currentState = rememberAmbientBlurState(imageUrl, canvasFrame)

    var shownState by remember { mutableStateOf(currentState) }
    var incomingState by remember { mutableStateOf<AmbientBlurState?>(null) }
    val crossfadeProgress = remember { Animatable(1f) }

    LaunchedEffect(currentState) {
        if (shownState.bitmap == null) {
            shownState = currentState
            crossfadeProgress.snapTo(1f)
            return@LaunchedEffect
        }
        if (currentState === shownState) return@LaunchedEffect

        if (reduceAnimation) {
            shownState = currentState
            incomingState = null
            crossfadeProgress.snapTo(1f)
            return@LaunchedEffect
        }

        incomingState = currentState
        crossfadeProgress.snapTo(0f)
        crossfadeProgress.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = AMBIENT_CROSSFADE_MS, easing = FastOutSlowInEasing),
        )
        shownState = currentState
        incomingState = null
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .clipToBounds()
            .background(shownState.palette.darkVignetteBase),
    ) {
        // Outgoing layer
        AmbientLayer(
            state = shownState,
            alpha = 1f,
            canGpuBlur = canGpuBlur,
            blurRadius = blurRadius,
            modifier = Modifier.fillMaxSize(),
        )

        // Incoming crossfading layer
        incomingState?.let { incoming ->
            AmbientLayer(
                state = incoming,
                alpha = crossfadeProgress.value,
                canGpuBlur = canGpuBlur,
                blurRadius = blurRadius,
                modifier = Modifier.fillMaxSize(),
            )
        }

        // Contrast and Readability Scrim (Vertical Gradient)
        // Calibrated to protect status bar icons, lyrics/title readability, and playback transport controls.
        Canvas(Modifier.fillMaxSize()) {
            drawRect(
                brush = Brush.verticalGradient(
                    0.0f to Color.Black.copy(alpha = 0.24f),
                    0.28f to Color.Black.copy(alpha = 0.08f),
                    0.60f to Color.Black.copy(alpha = 0.28f),
                    1.0f to Color.Black.copy(alpha = 0.65f),
                ),
            )
        }
    }
}

@Composable
private fun AmbientLayer(
    state: AmbientBlurState,
    alpha: Float,
    canGpuBlur: Boolean,
    blurRadius: Dp,
    modifier: Modifier = Modifier,
) {
    if (alpha <= 0.001f) return

    val palette = state.palette

    // Animate color transitions smoothly so lighting shifts organically
    val animDuration = if (alpha >= 0.99f) AMBIENT_CROSSFADE_MS else 0
    val colorSpec = tween<Color>(animDuration, easing = FastOutSlowInEasing)

    val animatedPrimary by animateColorAsState(palette.primaryGlow, colorSpec, label = "ambPrimary")
    val animatedSecondary by animateColorAsState(palette.secondaryGlow, colorSpec, label = "ambSecondary")
    val animatedAccent by animateColorAsState(palette.accentGlow, colorSpec, label = "ambAccent")

    Box(
        modifier = modifier
            .fillMaxSize()
            .graphicsLayer { this.alpha = alpha },
    ) {
        // 1. Blurred Artwork Foundation (Scaled beyond bounds to prevent clamped edge lines)
        if (canGpuBlur && state.bitmap != null) {
            Image(
                painter = BitmapPainter(state.bitmap),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = 1.38f
                        scaleY = 1.38f
                    }
                    .blur(blurRadius, BlurredEdgeTreatment.Unbounded),
            )
        } else if (state.blurredFallbackBitmap != null) {
            Image(
                painter = BitmapPainter(state.blurredFallbackBitmap),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = 1.35f
                        scaleY = 1.35f
                    },
            )
        }

        // 2. Layered Dynamic Radial Lighting Mesh matching the artwork's own tones
        Canvas(modifier = Modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height
            val maxDim = max(width, height)

            // Top-Right: Dynamic Primary / Vibrant Artwork Glow
            val trCenter = Offset(width * 0.85f, height * 0.16f)
            val trRadius = maxDim * 0.72f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(animatedPrimary.copy(alpha = 0.35f), Color.Transparent),
                    center = trCenter,
                    radius = trRadius,
                ),
                radius = trRadius,
                center = trCenter,
            )

            // Top-Left: Artwork's Secondary Atmospheric Tone
            val tlCenter = Offset(width * 0.15f, height * 0.32f)
            val tlRadius = maxDim * 0.75f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(animatedSecondary.copy(alpha = 0.30f), Color.Transparent),
                    center = tlCenter,
                    radius = tlRadius,
                ),
                radius = tlRadius,
                center = tlCenter,
            )

            // Bottom-Right: Artwork's Highlight / Accent Glow
            val brCenter = Offset(width * 0.80f, height * 0.72f)
            val brRadius = maxDim * 0.68f
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(animatedAccent.copy(alpha = 0.26f), Color.Transparent),
                    center = brCenter,
                    radius = brRadius,
                ),
                radius = brRadius,
                center = brCenter,
            )
        }
    }
}

/**
 * Fast CPU multi-pass box blur for Android < API 31 fallback and low-power devices.
 */
private fun fastBoxBlur(source: Bitmap, passes: Int): Bitmap {
    val width = source.width
    val height = source.height
    if (width < 4 || height < 4) return source

    val pixels = IntArray(width * height)
    source.getPixels(pixels, 0, width, 0, 0, width, height)
    val temp = IntArray(pixels.size)
    val radius = (max(width, height) / 10).coerceIn(4, 24)

    repeat(passes) {
        horizontalBlur(pixels, temp, width, height, radius)
        verticalBlur(temp, pixels, width, height, radius)
    }

    return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
}

private fun horizontalBlur(src: IntArray, dst: IntArray, w: Int, h: Int, r: Int) {
    val window = r * 2 + 1
    for (y in 0 until h) {
        var red = 0; var green = 0; var blue = 0
        val rowOffset = y * w
        for (i in -r..r) {
            val c = src[rowOffset + i.coerceIn(0, w - 1)]
            red += (c shr 16) and 0xFF
            green += (c shr 8) and 0xFF
            blue += c and 0xFF
        }
        for (x in 0 until w) {
            dst[rowOffset + x] = (0xFF shl 24) or ((red / window) shl 16) or ((green / window) shl 8) or (blue / window)
            val left = src[rowOffset + (x - r).coerceIn(0, w - 1)]
            val right = src[rowOffset + (x + r + 1).coerceIn(0, w - 1)]
            red += ((right shr 16) and 0xFF) - ((left shr 16) and 0xFF)
            green += ((right shr 8) and 0xFF) - ((left shr 8) and 0xFF)
            blue += (right and 0xFF) - (left and 0xFF)
        }
    }
}

private fun verticalBlur(src: IntArray, dst: IntArray, w: Int, h: Int, r: Int) {
    val window = r * 2 + 1
    for (x in 0 until w) {
        var red = 0; var green = 0; var blue = 0
        for (i in -r..r) {
            val c = src[i.coerceIn(0, h - 1) * w + x]
            red += (c shr 16) and 0xFF
            green += (c shr 8) and 0xFF
            blue += c and 0xFF
        }
        for (y in 0 until h) {
            dst[y * w + x] = (0xFF shl 24) or ((red / window) shl 16) or ((green / window) shl 8) or (blue / window)
            val top = src[(y - r).coerceIn(0, h - 1) * w + x]
            val bottom = src[(y + r + 1).coerceIn(0, h - 1) * w + x]
            red += ((bottom shr 16) and 0xFF) - ((top shr 16) and 0xFF)
            green += ((bottom shr 8) and 0xFF) - ((top shr 8) and 0xFF)
            blue += (bottom and 0xFF) - (top and 0xFF)
        }
    }
}

