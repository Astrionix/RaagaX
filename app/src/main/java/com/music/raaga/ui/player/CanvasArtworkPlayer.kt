package com.music.raaga.ui.player

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlendMode
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RenderEffect
import android.graphics.Shader
import android.graphics.SurfaceTexture
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.PixelCopy
import android.view.Surface
import android.view.TextureView
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.RequiresApi
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.music.raaga.data.Http
import com.music.raaga.data.canvas.CanvasArtwork
import com.music.raaga.data.canvas.CanvasCache
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.ui.graphics.FADE_CURVE_STOPS
import com.music.raaga.ui.graphics.smootherStep
import com.music.raaga.ui.rememberIsForeground
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.math.ceil
import kotlin.math.roundToInt
import java.util.Locale

private const val TAG = "CanvasArtworkPlayer"

/**
 * How long a clip gets to paint itself onto a surface it was just handed back
 * before the still art is brought in behind it instead. Long enough to cover a
 * decoder being re-created from cold, short enough that a clip which is never
 * coming back does not sit there as a hole for the length of a glance.
 */
private const val REPAINT_TIMEOUT_MS = 700L

/** How long after a clip leaves the screen its player is released — see its onDispose. */
private const val DEFERRED_RELEASE_MS = 1_000L

private val mainHandler = Handler(Looper.getMainLooper())

/** Whether and when a clip plays on — see the playback gate and onResumed. */
private class ResumeGate {
    /** Whether the last pause was for a transition; starts true for the player opening. */
    var heldForTransition = true

    /** Whether the frame on screen is one a caller holds a still of. */
    var holdingStill = false
}

/** What a clip's player needs to leave the screen without blocking it. */
private class Teardown {
    var disposed = false

    /**
     * A surface taken away while the player was closing or collapsing, kept
     * alive rather than handed back to ExoPlayer. Told the surface is gone,
     * ExoPlayer blocks the main thread until the decoder has stopped writing
     * to it, which is the decoder being torn down. Left holding a surface
     * that still exists, it can be stopped and released at leisure, or move
     * onto the next surface it is given; this one is released after either.
     */
    var orphan: SurfaceTexture? = null

    fun releaseOrphan() {
        orphan?.release()
        orphan = null
    }
}

/** How a clip fills the bounds supplied by its caller. */
enum class CanvasContentMode {
    CROP,
    FIT_PORTRAIT,
}

/**
 * The looping video that plays over a track's cover art, sized to fill and
 * clipped by whatever laid it out.
 */
@Composable
fun CanvasArtworkPlayer(
    canvas: CanvasArtwork,
    isPlaying: Boolean,
    modifier: Modifier = Modifier,
    contentMode: CanvasContentMode = CanvasContentMode.CROP,
    /** Align a contained portrait clip to the top; other callers retain centered FIT. */
    alignPortraitTop: Boolean = false,
    /** The decoded video's display aspect, or zero until Media3 knows it. */
    onAspectRatioChanged: (Float) -> Unit = {},
    /** The full player bounds required before a portrait hero may reveal its first frame. */
    portraitRevealBounds: IntSize = IntSize.Zero,
    /** Fades a full-player portrait clip away as the existing sleeve collapses. */
    presentationAlpha: () -> Float = { 1f },
    /** Optional spatial reveal for a compatible incoming slot. */
    organicReveal: CanvasOrganicReveal? = null,
    /** Fires once the clip has an actual frame on screen, and again if it drops back to none. */
    onRenderedChanged: (Boolean) -> Unit = {},
    /** A single frame off the playing clip, for callers that want to re-tint around it. */
    onFrameCaptured: (Bitmap) -> Unit = {},
    refreshFrameEveryMs: Long? = null,
    frameCapturePx: Int = FRAME_CAPTURE_PX,
    onCoverChanged: (Float) -> Unit = {},
    bottomFade: Float = 0f,
    bottomFadeEndPx: Float? = null,
    pausedForTransition: Boolean = false,
    /** How long the clip holds still after [pausedForTransition] lifts before it plays on. */
    resumeDelayMs: Long = 0L,
    /** Where in the clip to start — a still's position, so its first frame is that still. */
    startPositionMs: Long = 0L,
    /** Shows the first frame at once rather than fading it in: there is a still under it that it matches. */
    revealInstantly: Boolean = false,
    /**
     * Asks for the frame on screen, once each time this turns true, through
     * [onStillCaptured] with the position it was taken at — null if it could
     * not be read. Only while [pausedForTransition], so the frame holds still.
     */
    captureStill: Boolean = false,
    onStillCaptured: (ImageBitmap?, Long) -> Unit = { _, _ -> },
    /** The clip has moved on from the frame it was last captured or started at. */
    onResumed: () -> Unit = {},
    nowPlaying: Boolean = false,
) {
    key(canvas.url.takeIf { nowPlaying }) {
        CanvasArtworkPlayerContents(
            canvas = canvas,
            isPlaying = isPlaying,
            modifier = modifier,
            contentMode = contentMode,
            alignPortraitTop = alignPortraitTop,
            onAspectRatioChanged = onAspectRatioChanged,
            portraitRevealBounds = portraitRevealBounds,
            presentationAlpha = presentationAlpha,
            organicReveal = organicReveal,
            onRenderedChanged = onRenderedChanged,
            onFrameCaptured = onFrameCaptured,
            refreshFrameEveryMs = refreshFrameEveryMs,
            frameCapturePx = frameCapturePx,
            onCoverChanged = onCoverChanged,
            bottomFade = bottomFade,
            bottomFadeEndPx = bottomFadeEndPx,
            pausedForTransition = pausedForTransition,
            resumeDelayMs = resumeDelayMs,
            startPositionMs = startPositionMs,
            revealInstantly = revealInstantly,
            captureStill = captureStill,
            onStillCaptured = onStillCaptured,
            onResumed = onResumed,
            nowPlaying = nowPlaying,
        )
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun CanvasArtworkPlayerContents(
    canvas: CanvasArtwork,
    isPlaying: Boolean,
    modifier: Modifier,
    contentMode: CanvasContentMode,
    alignPortraitTop: Boolean,
    onAspectRatioChanged: (Float) -> Unit,
    portraitRevealBounds: IntSize,
    presentationAlpha: () -> Float,
    organicReveal: CanvasOrganicReveal?,
    onRenderedChanged: (Boolean) -> Unit,
    onFrameCaptured: (Bitmap) -> Unit,
    refreshFrameEveryMs: Long?,
    frameCapturePx: Int,
    onCoverChanged: (Float) -> Unit,
    bottomFade: Float,
    bottomFadeEndPx: Float?,
    pausedForTransition: Boolean,
    resumeDelayMs: Long,
    startPositionMs: Long,
    revealInstantly: Boolean,
    captureStill: Boolean,
    onStillCaptured: (ImageBitmap?, Long) -> Unit,
    onResumed: () -> Unit,
    nowPlaying: Boolean,
) {
    val context = LocalContext.current

    var url by remember(canvas) { mutableStateOf(canvas.url) }
    var rendered by remember(canvas) { mutableStateOf(false) }
    var clipAspect by remember(canvas) { mutableFloatStateOf(0f) }
    var bounds by remember { mutableStateOf(IntSize.Zero) }
    var textureView by remember(canvas) { mutableStateOf<TextureView?>(null) }
    var lastMediaTimestamp by remember { mutableLongStateOf(0L) }
    var pendingTextureFrame by remember { mutableStateOf<SurfaceTexture?>(null) }
    var frameTick by remember(canvas) { mutableIntStateOf(0) }
    var surfaceGeneration by remember(canvas) { mutableIntStateOf(0) }
    val currentContentMode by rememberUpdatedState(contentMode)
    val currentAlignPortraitTop by rememberUpdatedState(alignPortraitTop)
    val currentPortraitRevealBounds by rememberUpdatedState(portraitRevealBounds)
    val currentPresentationAlpha by rememberUpdatedState(presentationAlpha)
    val currentPausedForTransition by rememberUpdatedState(pausedForTransition)
    val reportAspect by rememberUpdatedState(onAspectRatioChanged)
    val currentStartPositionMs by rememberUpdatedState(startPositionMs)
    val currentResumeDelayMs by rememberUpdatedState(resumeDelayMs)
    val reportResumed by rememberUpdatedState(onResumed)
    val teardown = remember { Teardown() }
    val gate = remember { ResumeGate() }

    val owned = if (nowPlaying) rememberNowPlayingDecoder(context, teardown) else null
    val player = if (nowPlaying) owned?.player ?: return else remember { newCanvasDecoder(context) }

    fun confirmTextureFrame(surface: SurfaceTexture): Boolean {
        if (owned?.closed == true) return false
        val view = textureView ?: return false
        if (nowPlaying && (surface !== view.surfaceTexture || surface.timestamp == lastMediaTimestamp ||
                player.playerError != null || clipAspect <= 0f)
        ) return false
        if (gate.holdingStill && player.playWhenReady) {
            gate.holdingStill = false
            reportResumed()
        }
        if (rendered) return true
        val transformed = view.applyContentTransform(clipAspect, currentContentMode, currentAlignPortraitTop)
        val portrait = currentContentMode == CanvasContentMode.FIT_PORTRAIT && clipAspect > 0f && clipAspect < 1f
        val expected = currentPortraitRevealBounds
        val layoutReady = !portrait ||
            (expected != IntSize.Zero && view.width == expected.width && view.height == expected.height)
        if (!layoutReady || (currentContentMode != CanvasContentMode.CROP && !transformed)) return false
        rendered = true
        frameTick++
        return true
    }

    LaunchedEffect(pendingTextureFrame, url) {
        val surface = pendingTextureFrame ?: return@LaunchedEffect
        withTimeoutOrNull(REPAINT_TIMEOUT_MS) {
            do {
                withFrameMillis { }
            } while (textureView?.surfaceTexture === surface && !confirmTextureFrame(surface))
        }
        pendingTextureFrame = null
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onVideoSizeChanged(videoSize: VideoSize) {
                val width = videoSize.width * videoSize.pixelWidthHeightRatio
                val aspect = if (width.isFinite() && width > 0f && videoSize.height > 0) {
                    width / videoSize.height
                } else 0f
                if (aspect != clipAspect) rendered = false
                clipAspect = aspect
                reportAspect(aspect)
                textureView?.applyContentTransform(clipAspect, currentContentMode, currentAlignPortraitTop)
            }

            override fun onPlayerError(error: PlaybackException) {
                val alternate = canvas.fallbackUrl
                if (nowPlaying) {
                    pendingTextureFrame = null
                    lastMediaTimestamp = textureView?.surfaceTexture?.timestamp ?: 0L
                }
                rendered = false
                if (alternate != null && alternate != url) {
                    url = alternate
                }
            }
        }
        player.addListener(listener)
        onDispose {
            if (owned?.closed != true) player.removeListener(listener)
            teardown.disposed = true
            if (!nowPlaying) {
                player.stop()
                mainHandler.postDelayed(
                    {
                        player.release()
                        teardown.releaseOrphan()
                    },
                    DEFERRED_RELEASE_MS,
                )
            }
        }
    }

    LaunchedEffect(url) {
        if (nowPlaying) lastMediaTimestamp = textureView?.surfaceTexture?.timestamp ?: 0L
        rendered = false
        clipAspect = 0f
        reportAspect(0f)
        val item = MediaItem.Builder().setUri(url)
        mimeTypeOf(url)?.let { item.setMimeType(it) }
        val startAt = currentStartPositionMs
        gate.holdingStill = startAt > 0L
        if (nowPlaying) {
            runCatching {
                player.setMediaItem(item.build(), startAt)
                player.prepare()
            }.onFailure { rendered = false }
        } else {
            player.setMediaItem(item.build(), startAt)
            player.prepare()
        }
    }

    val foreground = rememberIsForeground()
    LaunchedEffect(foreground, pausedForTransition) {
        val play = foreground && !pausedForTransition
        val afterTransition = gate.heldForTransition
        gate.heldForTransition = pausedForTransition
        if (play && afterTransition && currentResumeDelayMs > 0L) delay(currentResumeDelayMs)
        player.playWhenReady = play
    }

    val reportStill by rememberUpdatedState(onStillCaptured)
    LaunchedEffect(captureStill) {
        if (!captureStill) return@LaunchedEffect
        withFrameMillis { }
        withFrameMillis { }
        val view = textureView
        if (!rendered || view == null) return@LaunchedEffect
        val surface = view.surfaceTexture ?: return@LaunchedEffect
        val report = reportStill
        val position = player.currentPosition
        val capturedUrl = url
        val still = view.copyStill(player.videoSize, clipAspect, contentMode, alignPortraitTop)
        if (!isActive || !rendered || url != capturedUrl || view.surfaceTexture !== surface) {
            still?.recycle()
            return@LaunchedEffect
        }
        if (still != null) gate.holdingStill = true
        report(still?.asImageBitmap(), position)
    }

    LaunchedEffect(surfaceGeneration) {
        if (surfaceGeneration == 0) return@LaunchedEffect
        if (!nowPlaying) rendered = false
        val before = frameTick
        if (player.playbackState != Player.STATE_IDLE) {
            player.seekTo(player.currentPosition)
        }
        delay(REPAINT_TIMEOUT_MS)
        if (frameTick == before) {
            rendered = false
        }
    }

    val reportRendered by rememberUpdatedState(onRenderedChanged)
    LaunchedEffect(rendered) {
        reportRendered(rendered)
    }
    val reportFrame by rememberUpdatedState(onFrameCaptured)
    LaunchedEffect(rendered, frameCapturePx) {
        if (!rendered) return@LaunchedEffect
        if (frameCapturePx <= 0) return@LaunchedEffect
        withFrameMillis { }
        val view = textureView ?: return@LaunchedEffect
        val bitmap = view.captureAt(frameCapturePx, clipAspect, contentMode, alignPortraitTop)
        if (bitmap != null) {
            Log.d(TAG, "frame captured after rendered=true, size=${bitmap.width}x${bitmap.height}")
            reportFrame(bitmap)
        } else {
            Log.w(TAG, "frame capture returned null after rendered=true")
        }
    }

    LaunchedEffect(
        rendered, refreshFrameEveryMs, frameCapturePx, clipAspect, contentMode, alignPortraitTop,
        isPlaying, pausedForTransition,
    ) {
        val interval = refreshFrameEveryMs ?: return@LaunchedEffect
        if (frameCapturePx <= 0) return@LaunchedEffect
        if (!rendered || !isPlaying || pausedForTransition) return@LaunchedEffect
        while (isActive) {
            delay(interval)
            val view = textureView ?: continue
            val bitmap = view.captureAt(frameCapturePx, clipAspect, contentMode, alignPortraitTop)
            if (bitmap != null) {
                Log.d(TAG, "periodic frame captured, size=${bitmap.width}x${bitmap.height}")
                reportFrame(bitmap)
            } else {
                Log.w(TAG, "periodic frame capture returned null")
            }
        }
    }

    val alpha by animateFloatAsState(
        targetValue = if (rendered) 1f else 0f,
        animationSpec = if (revealInstantly) snap() else tween(durationMillis = 320),
        label = "canvasAlpha",
    )

    val reportCover by rememberUpdatedState(onCoverChanged)
    val reportsCover = organicReveal == null
    LaunchedEffect(reportsCover) {
        if (reportsCover) snapshotFlow { alpha * currentPresentationAlpha() }.collect { reportCover(it) }
    }
    DisposableEffect(Unit) {
        onDispose {
            reportRendered(false)
            reportCover(0f)
            reportAspect(0f)
        }
    }

    val reducedMotion = if (organicReveal?.allowSpatialMask == true) AppSettings.reduceAnimation.collectAsState() else null
    val systemMotion = if (organicReveal?.allowSpatialMask == true) rememberCoroutineScope().coroutineContext[MotionDurationScale] else null
    AndroidView(
        factory = { viewContext ->
            val texture = TextureView(viewContext).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                isOpaque = false
                if (nowPlaying) setLayerPaint(Paint().apply { this.alpha = 0 }) else this.alpha = 0f
                player.setVideoTextureView(this)
                val delegate = surfaceTextureListener
                surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                    private var replacing = false

                    override fun onSurfaceTextureAvailable(
                        surface: SurfaceTexture,
                        width: Int,
                        height: Int,
                    ) {
                        if (nowPlaying) lastMediaTimestamp = 0L
                        delegate?.onSurfaceTextureAvailable(surface, width, height)
                        teardown.releaseOrphan()
                        if (!replacing) return
                        replacing = false
                        Log.d(TAG, "surface recreated (gen $surfaceGeneration), waiting for frame")
                        surfaceGeneration++
                    }

                    override fun onSurfaceTextureSizeChanged(
                        surface: SurfaceTexture,
                        width: Int,
                        height: Int,
                    ) {
                        delegate?.onSurfaceTextureSizeChanged(surface, width, height)
                        if (currentContentMode == CanvasContentMode.FIT_PORTRAIT && clipAspect in 0f..1f) {
                            rendered = false
                        }
                    }

                    override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
                        replacing = true
                        Log.d(TAG, "surface destroyed, rendered=$rendered")
                        rendered = false
                        pendingTextureFrame = null
                        if (owned?.released == true) return true
                        if (currentPausedForTransition || teardown.disposed) {
                            teardown.orphan = surface
                            return false
                        }
                        return delegate?.onSurfaceTextureDestroyed(surface) ?: true
                    }

                    override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {
                        delegate?.onSurfaceTextureUpdated(surface)
                        if (!confirmTextureFrame(surface) && nowPlaying && !rendered && owned?.closed != true) {
                            pendingTextureFrame = surface
                        }
                    }
                }
            }
            textureView = texture
            FadingBottomFrame(viewContext).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
                addView(texture)
            }
        },
        update = { frame ->
            val view = frame.getChildAt(0) as TextureView
            val applied = frame.applied
            val visibility = if ((nowPlaying && !rendered) ||
                (contentMode == CanvasContentMode.FIT_PORTRAIT && clipAspect <= 0f)
            ) {
                0f
            } else {
                alpha * presentationAlpha()
            }
            val progress = organicReveal?.progress?.invoke() ?: 1f
            val outgoingStill = organicReveal?.outgoingStill
            if (applied.transformDiffers(clipAspect, contentMode, alignPortraitTop, view.width, view.height)) {
                view.applyContentTransform(clipAspect, contentMode, alignPortraitTop)
            }
            val masked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val fadeChanged = applied.fadeDiffers(bottomFade, bounds, bottomFadeEndPx)
                if (fadeChanged) frame.updateBottomFade(bottomFade, bounds, bottomFadeEndPx)
                val generation = organicReveal?.generation?.takeIf {
                    organicReveal.allowSpatialMask && nowPlaying && visibility > 0f &&
                        reducedMotion?.value != true && systemMotion?.scaleFactor != 0f
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    frame.applyOrganicReveal(view, generation, progress, fadeChanged, outgoingStill)
                } else {
                    if (fadeChanged) view.setRenderEffect(frame.bottomEffect)
                    false
                }
            } else {
                frame.fadeFraction = bottomFade
                frame.fadeEndPx = bottomFadeEndPx
                false
            }
            val opacity = when {
                outgoingStill != null -> if (masked) alpha * outgoingStill.presentationAlpha() else visibility
                masked -> visibility
                else -> visibility * progress
            }
            if (nowPlaying) frame.setTextureOpacity(view, opacity) else view.alpha = opacity
        },
        modifier = modifier.onSizeChanged { bounds = it },
    )
}

private fun TextureView.captureAt(
    maxPx: Int,
    clipAspect: Float,
    contentMode: CanvasContentMode,
    alignPortraitTop: Boolean,
): Bitmap? {
    val viewWidth = width
    val viewHeight = height
    if (viewWidth <= 0 || viewHeight <= 0) return null
    val scale = maxPx.toFloat() / maxOf(viewWidth, viewHeight)
    return runCatching {
        val frame = if (scale >= 1f) {
            getBitmap()
        } else {
            getBitmap(
                (viewWidth * scale).roundToInt().coerceAtLeast(1),
                (viewHeight * scale).roundToInt().coerceAtLeast(1),
            )
        } ?: return null
        if (contentMode != CanvasContentMode.FIT_PORTRAIT || clipAspect >= 1f || clipAspect <= 0f) {
            return frame
        }
        val viewAspect = viewWidth.toFloat() / viewHeight
        val contentWidth = if (clipAspect < viewAspect) frame.height * clipAspect else frame.width.toFloat()
        val contentHeight = if (clipAspect < viewAspect) frame.height.toFloat() else frame.width / clipAspect
        val left = ceil((frame.width - contentWidth) / 2f).toInt().coerceIn(0, frame.width - 1)
        val top = if (alignPortraitTop) 0 else
            ceil((frame.height - contentHeight) / 2f).toInt().coerceIn(0, frame.height - 1)
        val right = (frame.width - left).coerceAtLeast(left + 1)
        val bottom = if (alignPortraitTop) contentHeight.toInt().coerceIn(1, frame.height) else
            (frame.height - top).coerceAtLeast(top + 1)
        Bitmap.createBitmap(frame, left, top, right - left, bottom - top)
    }.getOrNull()
}

private suspend fun TextureView.copyStill(
    video: VideoSize,
    clipAspect: Float,
    contentMode: CanvasContentMode,
    alignPortraitTop: Boolean,
): Bitmap? {
    val texture = surfaceTexture ?: return null
    val videoWidth = (video.width * video.pixelWidthHeightRatio).roundToInt()
    val videoHeight = video.height
    if (videoWidth <= 0 || videoHeight <= 0 || width <= 0 || height <= 0) return null
    val contained = contentMode == CanvasContentMode.FIT_PORTRAIT && clipAspect > 0f && clipAspect < 1f
    val scale = minOf(
        1f,
        if (contained) {
            width.toFloat() / videoWidth
        } else {
            maxOf(width.toFloat() / videoWidth, height.toFloat() / videoHeight)
        },
    )
    val bitmap = Bitmap.createBitmap(
        (videoWidth * scale).roundToInt().coerceAtLeast(1),
        (videoHeight * scale).roundToInt().coerceAtLeast(1),
        Bitmap.Config.ARGB_8888,
    )
    val result = suspendCancellableCoroutine<Int> { continuation ->
        val surface = Surface(texture)
        try {
            PixelCopy.request(
                surface,
                bitmap,
                { res ->
                    surface.release()
                    if (continuation.isActive) continuation.resume(res) else bitmap.recycle()
                },
                mainHandler,
            )
        } catch (_: IllegalArgumentException) {
            surface.release()
            continuation.resume(PixelCopy.ERROR_SOURCE_INVALID)
        }
    }
    if (result == PixelCopy.SUCCESS) return bitmap
    Log.w(TAG, "still copy failed ($result), reading the view instead")
    bitmap.recycle()
    val fallback = captureAt(maxOf(width, height), clipAspect, contentMode, alignPortraitTop) ?: return null
    if (fallback.getPixel(fallback.width / 2, fallback.height / 2) ushr 24 == 0) {
        fallback.recycle()
        return null
    }
    return fallback
}

private const val FRAME_CAPTURE_PX = 128

private fun TextureView.applyContentTransform(
    clipAspect: Float,
    contentMode: CanvasContentMode,
    alignPortraitTop: Boolean,
): Boolean {
    val bounds = IntSize(width, height)
    if (bounds.width <= 0 || bounds.height <= 0 || !clipAspect.isFinite() || clipAspect <= 0f) {
        setTransform(Matrix())
        return false
    }
    val viewAspect = bounds.width.toFloat() / bounds.height
    val pivotX = bounds.width / 2f
    val pivotY = if (alignPortraitTop && contentMode == CanvasContentMode.FIT_PORTRAIT && clipAspect < 1f) {
        0f
    } else bounds.height / 2f
    val matrix = Matrix().apply {
        val fit = contentMode == CanvasContentMode.FIT_PORTRAIT && clipAspect < 1f
        if (fit && clipAspect > viewAspect) {
            setScale(1f, viewAspect / clipAspect, pivotX, pivotY)
        } else if (fit) {
            setScale(clipAspect / viewAspect, 1f, pivotX, pivotY)
        } else if (clipAspect > viewAspect) {
            setScale(clipAspect / viewAspect, 1f, pivotX, pivotY)
        } else {
            setScale(1f, viewAspect / clipAspect, pivotX, pivotY)
        }
    }
    setTransform(matrix)
    return true
}

@RequiresApi(Build.VERSION_CODES.S)
private fun createBottomFade(fraction: Float, bounds: IntSize, endPx: Float?): LinearGradient? {
    val endY = endPx?.coerceIn(0f, bounds.height.toFloat()) ?: bounds.height.toFloat()
    if (fraction <= 0.001f || endY <= 0f) return null
    return LinearGradient(
        0f,
        endY * (1f - fraction.coerceAtMost(1f)),
        0f,
        endY,
        IntArray(FADE_CURVE_STOPS + 1) { i ->
            android.graphics.Color.argb(1f - smootherStep(i / FADE_CURVE_STOPS.toFloat()), 0f, 0f, 0f)
        },
        FloatArray(FADE_CURVE_STOPS + 1) { i -> i / FADE_CURVE_STOPS.toFloat() },
        Shader.TileMode.CLAMP,
    )
}

private class AppliedLook {
    private var aspect = Float.NaN
    private var mode: CanvasContentMode? = null
    private var alignTop = false
    private var width = -1
    private var height = -1

    private var fade = Float.NaN
    private var fadeBounds = IntSize(-1, -1)
    private var fadeEnd: Float? = Float.NaN

    fun transformDiffers(
        clipAspect: Float,
        contentMode: CanvasContentMode,
        alignPortraitTop: Boolean,
        viewWidth: Int,
        viewHeight: Int,
    ): Boolean {
        if (clipAspect == aspect && contentMode == mode && alignPortraitTop == alignTop &&
            viewWidth == width && viewHeight == height
        ) return false
        aspect = clipAspect
        mode = contentMode
        alignTop = alignPortraitTop
        width = viewWidth
        height = viewHeight
        return true
    }

    fun fadeDiffers(fraction: Float, bounds: IntSize, endPx: Float?): Boolean {
        if (fraction == fade && bounds == fadeBounds && endPx == fadeEnd) return false
        fade = fraction
        fadeBounds = bounds
        fadeEnd = endPx
        return true
    }
}

private class FadingBottomFrame(context: Context) : FrameLayout(context) {
    val applied = AppliedLook()
    private var bottomShader: LinearGradient? = null
    var bottomEffect: RenderEffect? = null
        private set
    private var textureOpacity = 0
    private var reveal: LiveAutoMixMask? = null
    private var revealFailed = false
    private var revealProgress = 0f
    private var revealBounds = IntSize.Zero
    private var revealGeneration: Long? = null
    private var outgoingMask: OutgoingStillRevealMask? = null
    private var outgoingMaskFailed = false
    private var stillBounds = IntSize.Zero
    private var stillFraction = 0f
    private var stillShader: LinearGradient? = null
    private var outgoingEffectApplied = false

    @RequiresApi(Build.VERSION_CODES.S)
    fun updateBottomFade(fraction: Float, bounds: IntSize, endPx: Float?) {
        bottomShader = createBottomFade(fraction, bounds, endPx)
        bottomEffect = bottomShader?.let {
            RenderEffect.createBlendModeEffect(
                RenderEffect.createOffsetEffect(0f, 0f),
                RenderEffect.createShaderEffect(it),
                BlendMode.DST_IN,
            )
        }
    }

    @RequiresApi(Build.VERSION_CODES.TIRAMISU)
    fun applyOrganicReveal(
        view: TextureView,
        generation: Long?,
        progress: Float,
        fadeChanged: Boolean,
        outgoingStill: CanvasStillRevealTarget?,
    ): Boolean {
        val bounds = IntSize(view.width, view.height)
        if (generation == null || !view.isHardwareAccelerated || !(progress > 0f && progress < 1f) ||
            bounds.width <= 0 || bounds.height <= 0
        ) {
            restoreBottomEffect(view, fadeChanged)
            return false
        }
        if (outgoingStill != null) {
            if (outgoingMaskFailed || !stillRevealMaskAvailable() || outgoingStill.bounds.width != bounds.width ||
                outgoingStill.bounds.height !in 1..bounds.height
            ) {
                restoreBottomEffect(view, fadeChanged)
                return false
            }
            val stillChanged = stillBounds != outgoingStill.bounds || stillFraction != outgoingStill.bottomFade
            if (stillChanged) {
                stillBounds = outgoingStill.bounds
                stillFraction = outgoingStill.bottomFade
                stillShader = createBottomFade(stillFraction, stillBounds, null)
            }
            val feather = stillShader
            if (feather == null) {
                restoreBottomEffect(view, fadeChanged)
                return false
            }
            if (!fadeChanged && !stillChanged && outgoingEffectApplied &&
                progress == revealProgress && bounds == revealBounds && generation == revealGeneration
            ) return true
            return runCatching {
                val mask = outgoingMask ?: OutgoingStillRevealMask().also { outgoingMask = it }
                view.setRenderEffect(
                    mask.effect(stillBounds.width.toFloat(), stillBounds.height.toFloat(), progress, generation, bottomShader, feather),
                )
                outgoingEffectApplied = true
                revealProgress = progress
                revealBounds = bounds
                revealGeneration = generation
                true
            }.getOrElse {
                outgoingMaskFailed = true
                restoreBottomEffect(view, fadeChanged)
                false
            }
        }
        if (revealFailed) {
            restoreBottomEffect(view, fadeChanged)
            return false
        }
        if (!fadeChanged && !outgoingEffectApplied && progress == revealProgress &&
            bounds == revealBounds && generation == revealGeneration
        ) return true
        return runCatching {
            val mask = reveal ?: LiveAutoMixMask().also { reveal = it }
            view.setRenderEffect(mask.effect(bounds.width.toFloat(), bounds.height.toFloat(), progress, generation, bottomShader))
            outgoingEffectApplied = false
            revealProgress = progress
            revealBounds = bounds
            revealGeneration = generation
            true
        }.getOrElse {
            revealFailed = true
            restoreBottomEffect(view, fadeChanged)
            false
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private fun restoreBottomEffect(view: TextureView, fadeChanged: Boolean) {
        if (revealProgress == 0f && !fadeChanged) return
        view.setRenderEffect(bottomEffect)
        revealProgress = 0f
        outgoingEffectApplied = false
    }

    fun setTextureOpacity(view: TextureView, opacity: Float) {
        val alpha = (opacity.coerceIn(0f, 1f) * 255).roundToInt()
        if (alpha == textureOpacity) return
        textureOpacity = alpha
        view.setLayerPaint(if (alpha == 255) null else Paint().apply { this.alpha = alpha })
    }

    var fadeFraction: Float = 0f
        set(value) {
            val clamped = value.coerceIn(0f, 1f)
            if (clamped == field) return
            field = clamped
            gradient = null
            invalidate()
        }
    var fadeEndPx: Float? = null
        set(value) {
            if (value == field) return
            field = value
            gradient = null
            invalidate()
        }

    private val maskPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
    }
    private var gradient: LinearGradient? = null
    private var gradientHeight = 0

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        gradient = null
    }

    override fun dispatchDraw(canvas: Canvas) {
        val fade = fadeFraction
        val endY = fadeEndPx?.coerceIn(0f, height.toFloat()) ?: height.toFloat()
        if (fade <= 0.001f || endY <= 0f) {
            super.dispatchDraw(canvas)
            return
        }
        val shader = gradient?.takeIf { gradientHeight == height } ?: LinearGradient(
            0f,
            endY * (1f - fade),
            0f,
            endY,
            IntArray(FADE_CURVE_STOPS + 1) { i ->
                android.graphics.Color.argb(1f - smootherStep(i / FADE_CURVE_STOPS.toFloat()), 0f, 0f, 0f)
            },
            FloatArray(FADE_CURVE_STOPS + 1) { i -> i / FADE_CURVE_STOPS.toFloat() },
            Shader.TileMode.CLAMP,
        ).also {
            gradient = it
            gradientHeight = height
        }
        maskPaint.shader = shader
        val layer = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
        super.dispatchDraw(canvas)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), maskPaint)
        canvas.restoreToCount(layer)
    }
}

internal fun mimeTypeOf(url: String): String? {
    val path = url.substringBefore('?').lowercase(Locale.ROOT)
    return when {
        path.endsWith(".m3u8") -> MimeTypes.APPLICATION_M3U8
        path.endsWith(".mp4") -> MimeTypes.VIDEO_MP4
        else -> null
    }
}

/** Shared by the displayed clip and the AutoMix standby; silent and no audio focus. */
internal fun newCanvasDecoder(context: Context): ExoPlayer {
    val player = ExoPlayer.Builder(context)
        .setMediaSourceFactory(
            DefaultMediaSourceFactory(CanvasCache.dataSourceFactory(OkHttpDataSource.Factory(Http.client))),
        )
        .build()
    try {
        player.volume = 0f
        player.repeatMode = Player.REPEAT_MODE_ONE
        player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
            .apply { CanvasPlaybackLimits.maxFrameRate?.let(::setMaxVideoFrameRate) }
            .build()
        return player
    } catch (e: Exception) {
        runCatching { player.release() }
        throw e
    }
}

@Composable
private fun rememberNowPlayingDecoder(context: Context, teardown: Teardown): NowPlayingCanvasDecoders.Lease? {
    var lease by remember(context) { mutableStateOf<NowPlayingCanvasDecoders.Lease?>(null) }
    LaunchedEffect(context) {
        NowPlayingCanvasDecoders.awaitCapacity()
        val opened = NowPlayingCanvasDecoders.open(context) ?: return@LaunchedEffect
        try {
            lease = opened
            awaitCancellation()
        } finally {
            teardown.disposed = true
            opened.close { teardown.releaseOrphan() }
        }
    }
    return lease
}

object CanvasPlaybackLimits {
    @Volatile
    var maxFrameRate: Int? = null
}
