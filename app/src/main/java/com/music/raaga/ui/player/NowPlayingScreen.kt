package com.music.raaga.ui.player

import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.snapshots.Snapshot
import kotlinx.coroutines.flow.collectLatest
import androidx.compose.ui.graphics.ImageBitmap

import androidx.compose.animation.core.VectorConverter
import androidx.compose.ui.unit.isSpecified
import com.music.raaga.data.settings.PlayerTheme

import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.offset
import androidx.compose.ui.unit.constrain
import androidx.compose.ui.unit.Constraints
import com.music.raaga.playback.PlaybackPosition
import com.music.raaga.ui.components.copyOnLongPress
import com.music.raaga.ui.components.AddonQualityPickerSheet
import com.music.raaga.data.podcast.PodcastEpisodeStore
import androidx.compose.runtime.saveable.rememberSaveable
import com.music.raaga.R

import android.graphics.Bitmap
import android.os.Build
import android.view.View
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.activity.compose.BackHandler
import androidx.annotation.RequiresApi
import androidx.compose.animation.Crossfade
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.core.Animatable
import kotlinx.coroutines.launch
import kotlinx.coroutines.channels.Channel
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.snap
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitVerticalTouchSlopOrCancellation
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.verticalDrag
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material.icons.rounded.AutoAwesome
import com.music.raaga.ui.components.MixViewDialog
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.draw.alpha
import kotlinx.coroutines.delay
import kotlin.math.abs
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Undo
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.MutableFloatState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.input.pointer.AwaitPointerEventScope
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.input.pointer.util.addPointerInputChange
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
import com.music.raaga.ui.theme.StatusBarIcons
import com.music.raaga.ui.theme.rememberArtworkTopBandLuminance
import com.music.raaga.ui.theme.topBandScrimAlpha
import com.music.raaga.ui.LyricsProviderState
import com.music.raaga.ui.components.optimizedHazeEffect
import com.music.raaga.ui.components.rememberRemoteArtworkUrl
import com.music.raaga.ui.components.AudioPipelineDialog
import com.music.raaga.ui.components.LiveAudioPipelineSheet
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.rememberHaptics
import com.music.raaga.ui.icons.RaagaIcons
import com.music.raaga.ui.connect.SocialJamSheet
import com.music.raaga.ui.connect.ConnectJamSheet
import com.music.raaga.ui.connect.ConnectJamTab
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.data.canvas.CanvasArtwork
import com.music.raaga.data.canvas.CanvasSource
import com.music.raaga.data.model.QueueEntryIdentity
import com.music.raaga.playback.AutoMixVisualFeed
import com.music.raaga.ui.graphics.FADE_CURVE_STOPS
import com.music.raaga.ui.graphics.smootherStep
import kotlinx.coroutines.flow.first
import com.music.raaga.data.lyrics.LyricLine
import com.music.raaga.data.lyrics.LyricsSource
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.settings.LastPlayerScreen
import com.music.raaga.data.settings.NowPlayingBlurStyle
import com.music.raaga.data.model.LikeStatus
import com.music.raaga.data.model.PlaybackSourceType
import com.music.raaga.data.model.PLAYER_ART_PX
import com.music.raaga.data.model.Song
import com.music.raaga.playback.BACK_RESTARTS_AFTER_MS
import dev.chrisbanes.haze.HazeInputScale
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.ExperimentalHazeApi
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.materials.ExperimentalHazeMaterialsApi
import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.roundToInt


/** Collapsed-header geometry, shared by the layout and its animation. */
/**
 * Comfortably over the sleeve's drawn size on a phone, without wasting bytes.
 *
 * A rung on the app-wide ladder rather than a number of the player's own, so a
 * large home-screen widget asks for the same copy — see [PLAYER_ART_PX].
 */
internal const val ART_PX = PLAYER_ART_PX

/**
 * How many further goes a cover that failed to load gets.
 *
 * Small on purpose. This is here for the connection that drops for a moment or
 * the request that loses a race with the app coming back to the foreground, not
 * for a track whose artwork has genuinely gone: past a few tries the answer is
 * not going to change, and the placeholder tile is the honest thing to draw.
 */
internal const val ART_RETRIES = 3

/** How long to leave it before trying a failed cover again. */
internal const val ART_RETRY_DELAY_MS = 1_500L

/**
 * How long a canvas lookup waits for the track's album name before giving up
 * on it. Long enough to cover the album lookup on a normal connection, short
 * enough not to be noticed on a track that has no album to find.
 */
internal const val ALBUM_SETTLE_MS = 700L

/** Long enough for the post-upgrade rollback cue to be noticed without lingering. */
private const val REVERT_CUE_MS = 2_600L

/**
 * How close the player's reported position has to get to a released scrub
 * handle before the handle stops being drawn where it was dropped. Wide enough
 * to swallow a coarse progress tick, tight enough that the handle doesn't hand
 * over while it is still visibly wrong.
 */
internal const val SEEK_SETTLE_TOLERANCE_MS = 1_500L

/**
 * How long that handle is held at the drop point regardless. A backstop, not a
 * schedule: a seek normally settles in a tick or two, and this only decides how
 * long a seek that never settles can freeze the bar for. Generous enough that a
 * slow buffer still hands over smoothly rather than snapping back.
 */
internal const val SEEK_SETTLE_TIMEOUT_MS = 4_000L

private val THUMB_SIZE = 54.dp
private val HEADER_HEIGHT = 60.dp
private val ART_TITLE_GAP = 20.dp

/** How much lower the sleeve's foot (stats, Best Part) sits over full-screen art than on the card. */
private val BANNER_FOOT_DROP = 26.dp
/**
 * How long the sleeve takes to travel the whole way between the full player and
 * the queue's header.
 *
 * Spent in proportion rather than in full: a drag released four fifths of the
 * way up has a fifth of the journey left and gets a fifth of the time for it.
 * Only the toggle, which travels end to end, ever spends all of it.
 */
private const val QUEUE_TRAVEL_MS = 420
/**
 * How far up the sleeve has to have been dragged for a release to carry on
 * opening the queue rather than falling back, as a share of the sleeve's travel.
 *
 * Well under half, because the gesture is only ever *started* deliberately —
 * there is nothing else an upward drag on the artwork could have meant — so the
 * doubt a halfway line exists to settle isn't there.
 */
private const val QUEUE_CARRY_FRACTION = 0.3f
/**
 * How fast a release has to be moving, in pixels a second, to decide the queue
 * on its own and overrule [QUEUE_CARRY_FRACTION].
 *
 * A flick is a whole gesture in its own right: it says "open" without ever
 * asking the finger to travel, and the distance it covered is beside the point.
 */
private const val QUEUE_FLICK_VELOCITY = 450f
/**
 * The handle strip above the artwork, which always hands drags to the sheet.
 *
 * It isn't the only place that does — the artwork and the credits under it pass
 * theirs on as well, which is what makes the whole top of the player closable
 * rather than just its topmost 32dp. See the dismiss band in `NowPlayingScreen`.
 */
private val DISMISS_STRIP_HEIGHT = 32.dp
/** The breathing room above the sleeve, needed twice: once to apply, once to measure past. */
private val ART_BOX_TOP_PAD = 8.dp
/**
 * How far below the sleeve's top edge the video/audio pill floats.
 *
 * Far enough to clear the artwork's rounded corners, so the pill reads as
 * something laid on the cover rather than something clipped by it.
 */
private val VERSION_PILL_ART_INSET = 12.dp
/**
 * Share of the motion-artwork banner's height given over to its dissolve.
 *
 * Generous on purpose: the banner has no card edge to stop at, so anything
 * short enough to still be reading as artwork where it ends reads as a picture
 * that was cut off rather than one that ran out.
 */
private const val HERO_FADE_FRACTION = 0.42f
/** Kept transparent so the cover remains edge-to-edge, while aiding icon contrast. */
/** A modest floor while a subview replaces the hero with its artwork-derived mesh. */
private const val SUBVIEW_STATUS_SCRIM_MIN_ALPHA = 0.40f

/**
 * How often the backdrop re-reads the colours of a playing Canvas clip.
 *
 * Every three seconds, with `MESH_FADE_MS` easing each read into the last so
 * the backdrop arrives at its new colour rather than cutting to it. The read is
 * the expensive half — a texture readback off the GPU — and this is the number
 * that decides how many of them there are; the fade is the cheap half and is
 * over well inside the gap, which leaves the backdrop still for most of it.
 */
private const val MESH_REFRESH_MS = 3_000L

/** How long the mesh's seam takes to reach a clip's edge, in step with the clip's own fade. */
private const val MESH_SEAM_MOVE_MS = 320

private const val CANVAS_FRAME_CAPTURE_PX = 128
private const val SPOTIFY_CANVAS_RESUME_DELAY_MS = 1_000L
private const val AUTOMIX_CANVAS_RETIRE_MS = 700

/**
 * The widest portrait clip that still gets [PortraitClipScrim]. Narrower than a
 * 3:4 cover, which stops above the controls and has the mesh to stand on there.
 */
private const val PORTRAIT_SCRIM_MAX_ASPECT = 0.7f

private val PortraitClipScrim = Brush.verticalGradient(
    0f to Color.Transparent,
    0.40f to Color.Transparent,
    1f to Color.Black.copy(alpha = 0.70f),
)

/**
 * The default theme's backdrop — see [ArtworkMeshBackdrop] — in a scope of its
 * own: a clip's new frame every few seconds, and the seam moving, reach only
 * this rather than the whole of the player.
 */
@Composable
private fun PlayerMeshBackdrop(
    trackKey: String,
    imageUrl: String?,
    canvasFrame: () -> Bitmap?,
    canvasKey: Any?,
    seamTarget: () -> Dp,
    alpha: () -> Float,
    modifier: Modifier = Modifier,
    ambient: AutoMixAmbient,
    entry: QueueEntryIdentity?,
) {
    val seed = ambient.incoming?.mesh
    val snapKey = rememberAmbientSnapKey(ambient.snapKey(seed != null))
    val mix = ambient.mixFor(seed != null)
    val url = imageUrl ?: ambient.incoming?.resolvedUrl
    val frame = canvasFrame()
    val mesh = key(entry ?: trackKey, snapKey) { rememberArtworkMesh(url, frame, ART_PX, seed, canvasKey) }
    val currentSeamTarget by rememberUpdatedState(seamTarget)
    val seam = remember { Animatable(Snapshot.withoutReadObservation { seamTarget() }, Dp.VectorConverter) }
    // Glides to a clip's edge as the clip fades in, and is put straight where
    // the first measure says: nothing should be seen settling as the player opens.
    LaunchedEffect(seam) {
        snapshotFlow { currentSeamTarget() }.collectLatest { target ->
            if (seam.value == 0.dp || target == 0.dp) {
                seam.snapTo(target)
            } else {
                seam.animateTo(target, tween(MESH_SEAM_MOVE_MS, easing = FastOutSlowInEasing))
            }
        }
    }
    key(snapKey) {
        ArtworkMeshBackdrop(
            mesh = mesh,
            seam = { seam.value },
            modifier = modifier.graphicsLayer { this.alpha = alpha() },
            mix = mix,
            currentIsOutgoing = entry == mix?.outgoing,
            directSelection = ambient.direct,
            directStill = ambient.direct != null && frame == null,
        )
    }
}

/** The legacy theme's backdrop, in a scope of its own for the same reason. */
@Composable
private fun LegacyMeshBackdrop(
    imageUrl: String?,
    canvasFrame: () -> Bitmap?,
    canvasKey: Any?,
    trackKey: String,
    modifier: Modifier,
    ambient: AutoMixAmbient,
    entry: QueueEntryIdentity?,
) {
    val url = imageUrl ?: ambient.incoming?.resolvedUrl
    val settled = ambient.incoming?.palette
    val requestedSnap = ambient.snapKey(settled != null)
    val snapKey = rememberAmbientSnapKey(requestedSnap)
    val seed = settled ?: cachedArtworkPalette(url).takeIf { ambient.cancelled || ambient.direct != null }
    val frame = canvasFrame()
    val palette = key(snapKey) { rememberArtworkColors(url, frame, seed, canvasKey) }
    val mix = ambient.mixFor(settled != null)
    MeshGradientBackground(
        palette = palette,
        trackKey = trackKey,
        modifier = modifier,
        mix = mix,
        snapKey = snapKey,
        settled = requestedSnap != null,
        currentIsOutgoing = entry == mix?.outgoing,
        directStill = ambient.direct != null && frame == null,
    )
}

internal fun DrawScope.drawCropped(image: ImageBitmap, alpha: Float = 1f) {
    if (size.width <= 0f || size.height <= 0f) return
    val scale = maxOf(size.width / image.width, size.height / image.height)
    val srcWidth = (size.width / scale).roundToInt().coerceIn(1, image.width)
    val srcHeight = (size.height / scale).roundToInt().coerceIn(1, image.height)
    drawImage(
        image = image,
        srcOffset = IntOffset((image.width - srcWidth) / 2, (image.height - srcHeight) / 2),
        srcSize = IntSize(srcWidth, srcHeight),
        dstSize = IntSize(size.width.roundToInt(), size.height.roundToInt()),
        alpha = alpha,
    )
}

private val TileShape = RoundedCornerShape(8.dp)

internal fun autoMixStaticSleeveShare(fullBleed: Boolean, settledShare: Float, revealing: Boolean): Float =
    if (!revealing) settledShare else if (fullBleed) 1f else 0f

private fun Modifier.artworkBottomFade(shown: () -> Float, fraction: () -> Float): Modifier = drawWithContent {
    drawContent()
    val share = shown()
    if (share > 0f) {
        drawRect(
            brush = Brush.verticalGradient(
                colorStops = Array(FADE_CURVE_STOPS + 1) { i ->
                    val t = i / FADE_CURVE_STOPS.toFloat()
                    t to Color.Black.copy(alpha = 1f - share * smootherStep(t))
                },
                startY = size.height * (1f - fraction()),
                endY = size.height,
            ),
            blendMode = BlendMode.DstIn,
        )
    }
}

@Composable
private fun WhileShown(shown: () -> Boolean, content: @Composable () -> Unit) {
    if (shown()) content()
}


/** The player's side margin. Scrollable panels reach back across it. */
internal val PLAYER_GUTTER = 30.dp
/**
 * How wide the player's content is ever allowed to get. A sleeve and a volume
 * slider stretched right across a tablet aren't a bigger player, just a coarser
 * one; past this the column stops growing and centres itself instead. Phones
 * are narrower than this, so for them it does nothing.
 */
internal val PLAYER_MAX_WIDTH = 560.dp
/**
 * The width from which the player counts as tablet-sized: its backdrop is
 * the full-cover blur in every state rather than the phone's seam-aware
 * mesh, and Settings keeps the full-bleed artwork switch listed — see
 * [fullBleedArtworkAvailable].
 *
 * 700dp is the figure the docked-player layout used to call "tablet sized"
 * (a 360dp page beside a 340dp pane). That layout is gone; the number stays,
 * so removing it moved no breakpoint.
 */
private val TABLET_PLAYER_MIN_WIDTH = 700.dp

/**
 * The least a landscape window has to offer before the player splits into its
 * two columns: enough that each half still holds what it is given — the sleeve
 * above the lyrics / output / queue row on the left, the credits and transport
 * on the right — with the bottom row's three-up capsule still fitting across
 * the narrower half.
 *
 * Low enough to take in a phone turned sideways, which is the point: a phone in
 * landscape and a tablet in landscape are the same shape, and they get the same
 * layout rather than the portrait player squashed into a window it was never
 * drawn for.
 */
private val LANDSCAPE_PLAYER_MIN_WIDTH = 560.dp

/**
 * The artwork's own play/pause/scrub pose in the landscape layout. Three flat
 * scales and one priority rule: paused always wins outright over a scrub in
 * progress, rather than the two combining — there is one artwork, in one of
 * three settled poses, never a blend of two.
 */
private const val ARTWORK_EXPANDED_SCALE = 1f
private const val ARTWORK_PAUSE_SHRINK_SCALE = 0.88f
private const val ARTWORK_DRAG_SHRINK_SCALE = 0.94f

/**
 * The curve and duration those three poses move between — an ease-out cubic
 * over 500ms rather than a spring. A spring reads wrong for a press-and-release
 * gesture specifically: it visibly lags a quick scrub and keeps settling after
 * the finger has already lifted.
 *
 * The phone layout keeps its own bouncy spring ([artScale]) — it is answering a
 * different thing there, a sleeve that also collapses into a header, and the
 * bounce is the signature.
 */
private val ArtworkScaleEasing = CubicBezierEasing(0.215f, 0.61f, 0.355f, 1f)
private const val ARTWORK_SCALE_DURATION_MS = 500

/**
 * How far a tall screen is allowed to push the transport from the blocks either
 * side of it.
 *
 * The spare height has to land somewhere, and above and below the play button is
 * where it reads as room rather than as a hole. Past this it stops reading as one
 * group of controls, so the rest goes back to the artwork block.
 */
private val CONTROL_GAP_SPREAD_MAX = 24.dp
/**
 * The spread [NowPlayingScreen] settled on the last time it was laid out.
 *
 * It follows from the window, so it is very nearly the same answer on every open
 * — and the player is torn down with its sheet, so without this the first frame
 * of each open would show the unspread gaps and then step to the real ones. Only
 * a head start: the frame after re-derives it either way. A plain var because
 * that is all it is, a cache of a measurement, not state anything observes.
 */
private var lastControlSpread: Dp = 0.dp

/**
 * Whether the full-bleed artwork switch is worth listing in Settings for a
 * window this wide. Public so the settings sheet can leave the switch out
 * entirely where it would do nothing.
 *
 * A window narrow enough that the player fills it is where the setting
 * acts: edge to edge there means the artwork *is* the screen. The tablet
 * half is left from the docked player, whose phone-width pane ran the
 * artwork edge to edge too; with the pane gone the portrait player no
 * longer goes full bleed at these widths, but the switch is still listed
 * there, unchanged, until that is decided on its own.
 */
fun fullBleedArtworkAvailable(windowWidth: Dp): Boolean =
    playerFillsWindow(windowWidth) || tabletSizedPlayer(windowWidth)

/**
 * Whether a player given the whole of a window this wide is still narrow enough
 * to run its artwork edge to edge.
 */
private fun playerFillsWindow(windowWidth: Dp): Boolean =
    windowWidth <= PLAYER_MAX_WIDTH + PLAYER_GUTTER * 2

/**
 * Whether the player is tablet-sized — see [TABLET_PLAYER_MIN_WIDTH].
 *
 * [windowWidth] is the width of the *window*, measured rather than read off
 * `Configuration.screenWidthDp`: in a freeform or desktop window that can
 * report the display instead of the window, and it lands a beat late when
 * the window is dragged.
 */
private fun tabletSizedPlayer(windowWidth: Dp): Boolean =
    windowWidth >= TABLET_PLAYER_MIN_WIDTH

/**
 * Whether the player takes its landscape shape: the sleeve and the lyrics /
 * output / queue row in the left column, and the right column showing the
 * credits and transport, the lyrics or the queue — one of the three at a time.
 *
 * The same answer for a tablet and a phone on its side. Both are asked the
 * same question, the window's own proportions, rather than what kind of
 * device this is.
 *
 * Width alone isn't enough: a tablet held upright can be as wide as a phone
 * held sideways, and the two-column layout is a landscape shape, not a "wide
 * enough" one. Upright, every device gets the portrait player — a tall window
 * is the shape it was drawn for.
 */
fun landscapePlayerAvailable(windowWidth: Dp, windowHeight: Dp): Boolean =
    windowWidth > windowHeight && windowWidth >= LANDSCAPE_PLAYER_MIN_WIDTH

/** How long the player stands under the lyrics untouched before standing down. */
private const val LYRICS_CONTROLS_IDLE_MS = 5_000L
/** Default Spotify Canvas delay before its optional automatic collapse. */
private const val SPOTIFY_CANVAS_CONTROLS_IDLE_MS = 5_000L
/** One shared travel time keeps the deck, credits and stats moving as a unit. */
private const val SPOTIFY_CANVAS_CONTROLS_ANIMATION_MS = 420
/** Shared top-only scrim transition for the Canvas lower deck. */
private const val SPOTIFY_DECK_TOP_FADE_FRACTION = 0.28f

// The lower glass and the controls use one piece of motion. Keeping the slide
// specification here prevents a busy frame from exposing slightly different
// timings between the surface and the player drawn over it.
private fun playerDeckSlideIn() = slideInVertically(
    animationSpec = tween(
        SPOTIFY_CANVAS_CONTROLS_ANIMATION_MS,
        easing = FastOutSlowInEasing,
    ),
    initialOffsetY = { it },
)

private fun playerDeckSlideOut() = slideOutVertically(
    animationSpec = tween(
        SPOTIFY_CANVAS_CONTROLS_ANIMATION_MS,
        easing = FastOutSlowInEasing,
    ),
    targetOffsetY = { it },
)

/**
 * One lower-deck component, with one animation value owning both its pixels
 * and the space it occupies.
 *
 * A slide-only AnimatedVisibility kept the full height until its last frame;
 * combining slide and size transitions fixed that but let two transition
 * layers overlap when the presentation mode changed while returning to main.
 * This layout reports a fraction of the deck's real height instead. Since the
 * weighted player/panel above it consumes the remainder, the deck's top and
 * everything drawn from it move together. The subtree is removed only after
 * the exit reaches zero, retaining neither an invisible player nor a duplicate.
 */
@Composable
private fun SlidingPlayerDeck(
    visible: Boolean,
    reveal: Animatable<Float, AnimationVector1D>,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var mounted by remember { mutableStateOf(visible) }

    LaunchedEffect(visible) {
        if (visible) {
            mounted = true
            reveal.animateTo(
                1f,
                tween(
                    SPOTIFY_CANVAS_CONTROLS_ANIMATION_MS,
                    easing = FastOutSlowInEasing,
                ),
            )
        } else {
            reveal.animateTo(
                0f,
                tween(
                    SPOTIFY_CANVAS_CONTROLS_ANIMATION_MS,
                    easing = FastOutSlowInEasing,
                ),
            )
            mounted = false
        }
    }

    if (mounted) {
        Box(
            modifier = modifier.layout { measurable, constraints ->
                val placeable = measurable.measure(constraints.copy(minHeight = 0))
                val animatedHeight = (placeable.height * reveal.value)
                    .roundToInt()
                    .coerceIn(constraints.minHeight, constraints.maxHeight)
                layout(placeable.width, animatedHeight) {
                    // No second translation: the weighted sibling above moves
                    // this component's origin as its reported height changes.
                    placeable.placeRelative(0, 0)
                }
            }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) awaitPointerEvent()
                }
            },
        ) {
            content()
        }
    }
}

/**
 * Apple Music's Now Playing, closely: artwork that shrinks when paused, a
 * hairline scrubber with elapsed / remaining either side, oversized transport
 * glyphs, a volume capsule flanked by speaker icons, and lyrics / AirPlay /
 * queue along the bottom.
 */
/** Draws as usual, and keeps what it drew in [layer] for a still taken later. */
private fun Modifier.recordBackdrop(layer: GraphicsLayer): Modifier = drawWithContent {
    layer.record { this@drawWithContent.drawContent() }
    drawLayer(layer)
}

@Composable
@OptIn(ExperimentalHazeApi::class, ExperimentalHazeMaterialsApi::class)
fun NowPlayingScreen(
    song: Song,
    /** Who selected this track in the active Listen Together session. */
    playedBy: String? = null,
    isPlaying: Boolean,
    isLoading: Boolean,
    /**
     * The playhead, read only where it is drawn — never here. Passed as the
     * object rather than its value because a value read at this level is a
     * read in this function's own scope, and it ticks twice a second: the whole
     * player recomposed with it. See [PlaybackPosition].
     */
    position: PlaybackPosition,
    durationMs: Long,
    /** A version switch (video vs audio-only), triggered from the player's
     * menu, is fetching and measuring the target cut. */
    audioVersionSwitching: Boolean,
    /** The player has just swapped this item to a higher-quality source. */
    qualityUpgraded: Boolean,
    queue: List<Song>,
    queueIndex: Int,
    hasPrevious: Boolean,
    hasNext: Boolean,
    repeatMode: Int,
    shuffleEnabled: Boolean,
    autoplayEnabled: Boolean,
    signedIn: Boolean,
    accountName: String?,
    likeStatus: LikeStatus,
    onToggleLike: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    /** The live transport decision, including the receiver's position when casting. */
    previousRestarts: () -> Boolean = { true },
    /** Read at dispatch so automatic advance cannot turn one swipe into two skips. */
    currentPlaybackSong: () -> Song? = { song },
    /**
     * A control the host has taken away was reached for anyway.
     *
     * The buttons are gone while a party is locked, but a swipe has no button
     * to remove — so the gesture answers instead of silently doing nothing.
     */
    onBlockedControl: () -> Unit,
    onSeek: (Long) -> Unit,
    /**
     * Seek to a fraction of the track, for the scrubber.
     *
     * Separate from [onSeek] because the scrubber is the one caller that knows
     * *where along the bar* it wants to go rather than a time. Converting that
     * here would use this screen's cached duration, which lags a track change by
     * however long the session takes to report the new one — long enough to drop
     * the handle on a bar still scaled to the previous song and seek to the
     * wrong fraction of the current one. The conversion belongs wherever the
     * freshest duration is.
     */
    onSeekFraction: (Float) -> Unit,
    onToggleShuffle: () -> Unit,
    onCycleRepeat: () -> Unit,
    onToggleAutoplay: () -> Unit,
    onJumpTo: (Int) -> Unit,
    onRemoveFromQueue: (Int) -> Unit,
    onMoveInQueue: (Int, Int) -> Unit,
    /**
     * A queue row started or stopped being dragged.
     *
     * Lets the caller tell a jam's party sync that a reorder is in progress, so
     * it can hold its publish until the row is dropped instead of sending one
     * for every neighbour the drag crosses. See [PartySync.beginQueueDrag].
     */
    onQueueDragActiveChange: (Boolean) -> Unit = {},
    onClearQueue: () -> Unit,
    onOpenMenu: () -> Unit,
    onOpenAlbum: (String) -> Unit,
    onOpenArtist: (String) -> Unit,
    /** Return to the queue-level page named by the caption above the player. */
    onOpenPlaybackSource: () -> Unit,
    /**
     * Open Listen Together, from the party half of the output capsule.
     *
     * The player does not decide whether it has to get out of the way first:
     * the settings page it opens is drawn under the player sheet, and closing
     * the sheet is the caller's business.
     */
    onListenTogether: () -> Unit,
    lyrics: List<LyricLine>?,
    lyricsSource: LyricsSource?,
    lyricsProviderStates: Map<LyricsSource, LyricsProviderState>,
    onSelectLyricsProvider: (LyricsSource) -> Unit,
    lyricsUnavailable: Boolean,
    lyricsOffsetOpen: Boolean,
    onDismissLyricsOffset: () -> Unit,
    /** The width of the window the player is in — see [fullBleedArtworkAvailable]. */
    windowWidth: Dp,
    /**
     * The window's height, alongside [windowWidth] — needed for exactly one
     * thing: telling a portrait window apart from a landscape one, in
     * [landscapePlayerAvailable]. Width alone can't; a big tablet's portrait
     * width comfortably clears a phone's landscape width.
     */
    windowHeight: Dp,
    onPlayFrom: ((List<Song>, Int, String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val haptics = rememberHaptics()

    // Remote tracks whose art lives inside the file resolve it here, once —
    // every surface below reads the same value rather than each triggering
    // its own extraction.
    val remoteArt = rememberRemoteArtworkUrl(song)
    // This is produced by the palette's existing 128 px decode and cache. It
    // samples the upper band rather than the whole sleeve because that is what
    // lies beneath the status bar when the player expands to full bleed.
    val artTopLuminance = rememberArtworkTopBandLuminance(remoteArt, ART_PX)
    val artworkStatusScrimAlpha = topBandScrimAlpha(artTopLuminance)

    // Media-player convention: the player always owns light status icons. The
    // top treatment below, rather than a window-flag flip per cover, provides
    // their contrast and stays visually stable through artwork transitions.
    StatusBarIcons(dark = false)

    // Kept local to the player: a modal player is not in the page's Haze
    // source tree, so it needs its own source for the same frosted material as
    // the bottom navigation pill.
    val playerHaze = remember { HazeState() }
    val drawerHaze = remember { HazeState() }
    var showSocialJamSheet by remember { mutableStateOf(false) }
    var socialJamInitialTab by remember { mutableStateOf(ConnectJamTab.JAM) }
    var showAudioPipeline by remember { mutableStateOf(false) }
    var showQualityPickerSheet by remember { mutableStateOf(false) }
    var showMixView by remember { mutableStateOf(false) }
    var lyricsShareRequest by remember { mutableStateOf<LyricsShareRequest?>(null) }
    var showAudioOutput by remember { mutableStateOf(false) }
    var showLyricsProviders by remember { mutableStateOf(false) }

    var lastSavedPodcastPos by remember(song.videoId) { mutableLongStateOf(0L) }
    LaunchedEffect(song.videoId, position.positionMs) {
        if (position.positionMs > 5_000L && durationMs > 60_000L) {
            if (kotlin.math.abs(position.positionMs - lastSavedPodcastPos) >= 5_000L) {
                lastSavedPodcastPos = position.positionMs
                PodcastEpisodeStore.savePosition(song.videoId, position.positionMs, durationMs)
            }
        }
    }
    // Gated on the Bluetooth permission the first time — see [rememberOutputPicker].
    val openAudioOutput = rememberOutputPicker {
        showAudioOutput = true
    }
    // Listening in a party whose host has taken the controls: the transport
    // keeps only play/pause, which from here moves this device alone.
    val controlsLocked = rememberControlsLocked()
    var showListenTogetherMembers by remember { mutableStateOf(false) }
    val openSocialSheet: () -> Unit = {
        socialJamInitialTab = ConnectJamTab.JAM
        showSocialJamSheet = true
    }

    val syncedLyricsEnabled by AppSettings.syncedLyrics.collectAsStateWithLifecycle()
    val lyricsPreviewEnabled by AppSettings.lyricsPreview.collectAsStateWithLifecycle()
    val adaptiveTrackInfoEnabled by AppSettings.adaptiveTrackInfo.collectAsStateWithLifecycle()
    val showLyricsPreview = syncedLyricsEnabled && lyricsPreviewEnabled
    val lyricsOffsetMs by AppSettings.lyricsOffsetMs.collectAsStateWithLifecycle()
    // A lambda, not a value: read by the lyric strip and panel in scopes of
    // their own, so a tick recomposes them and not the player around them.
    val lyricsPosition: () -> Long = { adjustedLyricsPosition(position.positionMs, lyricsOffsetMs) }
    val seekToLyric: (Long) -> Unit = { lineTimeMs ->
        onSeek(adjustedLyricsSeekTarget(lineTimeMs, lyricsOffsetMs))
    }
    val hideVolumeBar by AppSettings.hideVolumeBar.collectAsStateWithLifecycle()
    val hideSongStatus by AppSettings.hideSongStatus.collectAsStateWithLifecycle()

    // Animated cover art: the looping video some labels publish alongside a
    // release, laid over the sleeve. A miss is the normal answer — see
    // CanvasRepository, which is also where the "is this actually the right
    // track" check lives.
    val spotifyCanvasAutoHide by AppSettings.spotifyCanvasAutoHide.collectAsStateWithLifecycle()
    val fullCanvasWindow = playerFillsWindow(windowWidth)
    val fullBleedArt by AppSettings.fullBleedArtwork.collectAsStateWithLifecycle()
    val sessionCanvas = rememberCanvasArtwork(song)?.nowPlayingRendition(fullCanvasWindow)
    val coverEntry = remember(song.videoId, song.queueEntryId, queue, queueIndex) {
        coverOccurrence(song, queue, queueIndex)
    }
    val sideways = landscapePlayerAvailable(windowWidth, windowHeight)
    val artworkGate = autoMixArtworkGate()
    val canvasPair = rememberAutoMixCanvasPair(coverEntry, queue, isPlaying, sideways, fullCanvasWindow, fullBleedArt, artworkGate)
    val pair = canvasPair.visual?.takeIf { artworkGate.allows(it.generation) && it.contains(coverEntry) }
    val promotedCanvas = canvasPair.promoted?.takeIf { it.incoming == coverEntry }
    // An outgoing Spotify Canvas fades back to its cover as the mix starts, well
    // before the reveal; the reveal then runs cover to cover. See [AutoMixCanvasPair.beginMix].
    val retiringCanvas = pair?.retiringClip?.takeIf { pair.started }
    val canvasRetire = remember { Animatable(0f) }
    LaunchedEffect(retiringCanvas?.url) {
        canvasRetire.snapTo(0f)
        if (retiringCanvas != null) {
            canvasRetire.animateTo(1f, tween(AUTOMIX_CANVAS_RETIRE_MS, easing = FastOutSlowInEasing))
        }
    }
    val canvasRetired by remember { derivedStateOf { canvasRetire.value >= 1f } }
    val canvasRetiring = retiringCanvas != null && !canvasRetired
    // Read from draw/update lambdas only, so the fade does not recompose the screen.
    val retiringCanvasAlpha: () -> Float = { 1f - canvasRetire.value }
    val canvas = if (pair?.started == true) {
        pair.pinnedClip ?: retiringCanvas.takeIf { canvasRetiring }
    } else promotedCanvas?.incomingClip ?: sessionCanvas
    val staticCanvasMix = pair?.started == true && !pair.liveOutgoing
    // A non-Spotify outgoing clip stops on its frame as the reveal begins.
    val freezeOutgoingCanvas = pair?.liveOutgoing == true && pair.freezeOutgoing
    val incomingFullWindow = !sideways && fullCanvasWindow && pair?.incomingClip?.source == CanvasSource.SPOTIFY
    var canvasAspect by remember(canvas?.url) { mutableFloatStateOf(promotedCanvas?.incomingAspect ?: 0f) }
    val canvasRenderedState = remember(canvas?.url) { mutableStateOf(promotedCanvas?.incomingReady == true) }
    var canvasSurfaceRendered by canvasRenderedState
    val canvasRendered = canvasSurfaceRendered && !staticCanvasMix
    RememberDisplayedAutoMixCanvas(canvasPair, coverEntry, canvas, canvasRendered)
    var canvasFrame by remember(coverEntry, remoteArt, canvas?.url) { mutableStateOf<Bitmap?>(null) }
    val canvasOwnsAmbient = pair?.started != true
    val ambientCanvasKey = canvas?.url?.takeIf { canvasOwnsAmbient }?.let { Triple(coverEntry, remoteArt, it) }
    // Spotify's phone presentation starts with the full control deck over its
    // video. It leaves on a Canvas tap, or after the optional idle timeout.
    var spotifyCanvasControlsOpen by remember(canvas?.url) { mutableStateOf(true) }
    // Captured while the deck is fully laid out. SlidingPlayerDeck collapses
    // that deck's measured height, which makes the weighted region grow;
    // retaining both measurements keeps the credits' destination stationary.
    var spotifyCanvasDeckHeight by remember(canvas?.url) { mutableStateOf(0.dp) }
    var spotifyCanvasExpandedTopHeight by remember(canvas?.url) { mutableStateOf(0.dp) }
    // How much of the still artwork the clip is covering, reported by the clip
    // itself. Read from a draw scope rather than in composition: it moves every
    // frame of the fade, and the still art it governs is an AsyncImage whose
    // request is rebuilt on each pass and so would not be skipped.
    val canvasCover = remember(canvas?.url) { mutableFloatStateOf(if (promotedCanvas?.incomingReady == true) 1f else 0f) }
    // The one thing about it worth recomposing for: whether the clip is opaque
    // enough that the still frame under it can go entirely. Derived, so this
    // flips twice across a fade instead of once per frame of it.
    val stillCovered by remember(canvas?.url) {
        derivedStateOf { canvasCover.floatValue > 0.999f }
    }
    val disableBlendEffects by AppSettings.disableBlendEffects.collectAsStateWithLifecycle()
    // What the main player stands on — see [PlayerTheme].
    val playerTheme by AppSettings.playerTheme.collectAsStateWithLifecycle()
    val blurStyle by AppSettings.nowPlayingBlurStyle.collectAsStateWithLifecycle()
    // Both meshes follow a playing clip's colours. The blurred still cover has
    // nothing to re-tint, and each read is a GPU readback.
    val tintsOffClip = playerTheme != PlayerTheme.SIMPLE
    // How often those colours are re-read — see CanvasArtworkPlayer's
    // refreshFrameEveryMs.
    val meshRefreshMs = MESH_REFRESH_MS.takeIf { tintsOffClip }
    // The lyric slot above the scrubber: the tallest line it holds — titleMedium's
    // own line box — and the 4dp each of them is padded by above and below.
    val lyricSlotHeight = with(density) {
        MaterialTheme.typography.titleMedium.lineHeight.takeIf { it.isSpecified }?.toDp() ?: 24.dp
    } + 8.dp

    val scrub = rememberPlayerScrub(song.videoId, position, durationMs)
    // Read by the scrubber itself — see [PlayerScrubber.shown].
    val shown: () -> Float = { scrub.shown(position.positionMs, durationMs) }
    // Back restarts the track rather than stepping back once it is a few
    // seconds in. Derived, so this scope hears about the playhead once, when
    // it crosses that point, rather than on every tick.
    val pastRestartPoint by remember(position) {
        derivedStateOf { position.positionMs > BACK_RESTARTS_AFTER_MS }
    }
    // The queue lives inside the player, Apple-style, rather than in a sheet.
    // Read once when this expanded-player instance is created. Every change is
    // written below, so reopening the player (and a process restart) returns to
    // the same surface on phones and tablets without making this UI state a
    // continuously collected setting.
    val restoredPlayerScreen = remember { AppSettings.lastPlayerScreen.value }
    var queueOpen by remember {
        mutableStateOf(restoredPlayerScreen == LastPlayerScreen.QUEUE)
    }
    var lyricsOpen by remember {
        mutableStateOf(restoredPlayerScreen == LastPlayerScreen.LYRICS)
    }
    val queueSlide = remember { mutableFloatStateOf(0f) }
    // Expensive, song-scoped preparation is deliberately staggered. The small
    // backdrop decode runs after the track hand-off has settled; lyrics and
    // queue are then composed offscreen on separate beats rather than all three
    // competing with the song change. Opening a panel early bypasses its wait.
    var playerPrewarmStage by remember(song.videoId) { mutableIntStateOf(0) }
    LaunchedEffect(song.videoId) {
        delay(600)
        playerPrewarmStage = 1 // 128px backdrop decode + CPU blur
        delay(650)
        playerPrewarmStage = 2 // lyrics layout
        delay(650)
        playerPrewarmStage = 3 // queue layout and initial scroll
    }
    // Whether the lyrics or queue list is actively mid-scroll. The player's own
    // swipe gestures — skip-by-drag and the dismiss band — are suppressed for
    // as long as either is true, so a scroll that grazes past a list's edge
    // can never be misread as a drag meant for the player underneath it. Reset
    // whenever the owning panel closes, since a list scrolled mid-transition
    // out never gets a matching "stopped scrolling" event of its own.
    var lyricsScrolling by remember { mutableStateOf(false) }
    var queueScrolling by remember { mutableStateOf(false) }
    LaunchedEffect(lyricsOpen) { if (!lyricsOpen) lyricsScrolling = false }
    LaunchedEffect(queueOpen) { if (!queueOpen) queueScrolling = false }
    val panelScrolling = lyricsScrolling || queueScrolling
    var lyricsControlsOpen by remember {
        mutableStateOf(restoredPlayerScreen == LastPlayerScreen.LYRICS)
    }
    var queueControlsOpen by remember { mutableStateOf(true) }
    // Shared with Spotify's title placement below. The deck and credits must
    // read one clock: the weighted region changes size as this value moves, so
    // independently animating the title towards that moving target makes it
    // trail behind and overlap the deck on the way back in.
    val playerDeckReveal = remember { Animatable(1f) }
    val playerDeckSettledOpen by remember(playerDeckReveal) {
        derivedStateOf { playerDeckReveal.value >= 0.999f }
    }
    LaunchedEffect(lyricsOpen, queueOpen) {
        AppSettings.setLastPlayerScreen(
            when {
                lyricsOpen -> LastPlayerScreen.LYRICS
                queueOpen -> LastPlayerScreen.QUEUE
                else -> LastPlayerScreen.MAIN
            },
        )
        // A fresh visit always starts with the half player present. Scrolling
        // the queue can then dismiss it without this effect firing again.
        if (queueOpen) queueControlsOpen = true
    }
    // Change the panel and its controls in the same snapshot. Driving the
    // controls from a LaunchedEffect left one composed frame where lyrics were
    // open but the half-player was not, so every trip into lyrics briefly
    // started an exit animation and reversed it on the following frame.
    val openLyrics: () -> Unit = {
        lyricsControlsOpen = true
        lyricsOpen = true
        queueOpen = false
    }
    val closeLyrics: () -> Unit = {
        lyricsControlsOpen = false
        lyricsOpen = false
    }
    val toggleLyrics: () -> Unit = {
        if (lyricsOpen) closeLyrics() else openLyrics()
    }
    val toggleQueue: () -> Unit = {
        val opening = !queueOpen
        if (opening && lyricsOpen) queueSlide.floatValue = 1f
        queueOpen = opening
        if (opening) closeLyrics()
    }
    val lyricsLoadingLines = stringArrayResource(R.array.lyrics_loading_lines)
    val lyricsLoadingText = remember(song.videoId) { lyricsLoadingLines.random() }
    val lyricsTranslation = rememberLyricsTranslation(
        trackId = song.videoId,
        lyrics = lyrics,
        lyricsSource = lyricsSource,
        lyricsUnavailable = lyricsUnavailable,
        loadingText = lyricsLoadingText,
        haptics = haptics,
    )
    val backdropLayer = rememberGraphicsLayer()
    val shareScope = rememberCoroutineScope()
    val lyricsPicker = rememberLyricsPicker(
        song = song,
        lines = lyrics ?: emptyList(),
        subLines = lyricsTranslation.subLines,
        artworkUrl = remoteArt,
        haptics = haptics,
        onCard = { request ->
            shareScope.launch {
                val backdrop = runCatching { backdropLayer.toImageBitmap() }.getOrNull()
                lyricsShareRequest = request.copy(backdrop = backdrop)
            }
        },
    )
    // A pick lives in the lyrics panel. Leaving it any way cancels it.
    LaunchedEffect(lyricsOpen) {
        if (!lyricsOpen && lyricsPicker.picking) lyricsPicker.cancel()
    }
    // Nothing here resets [lyricsOpen] on a track change, deliberately. The
    // panel is a place, not a property of the track: someone reading along who
    // skips — or who simply lets the queue run on — means to carry on reading,
    // so the words change underneath them and the panel stays. Closing it
    // dropped them back onto the artwork every few minutes with no gesture of
    // their own behind it.
    // A brief, non-modal confirmation that the three-dot menu now contains a
    // way back to the original YouTube rendition. The control keeps its usual
    // action — opening the menu — so the cue teaches rather than surprises.
    var showRevertCue by remember(song.videoId) { mutableStateOf(false) }
    LaunchedEffect(song.videoId, qualityUpgraded) {
        if (!qualityUpgraded) {
            showRevertCue = false
            return@LaunchedEffect
        }
        showRevertCue = true
        delay(REVERT_CUE_MS)
        showRevertCue = false
    }

    // Lyrics are meant to be read continuously, so hold off the device's normal
    // screen timeout — but only while the panel is actually up. Closing it hands
    // the screen back, and the system starts its own timeout from that moment
    // rather than from whenever the panel was opened.
    //
    // Keyed to [lyricsOpen] rather than written from a SideEffect on every
    // recomposition: this is a piece of state on the window, not a per-frame
    // value, and the panel now outlives a track change (see above), so there is
    // no longer a whole-player recomposition standing behind it as a backstop.
    val playerView = LocalView.current
    DisposableEffect(playerView, lyricsOpen) {
        playerView.keepScreenOn = lyricsOpen
        onDispose { playerView.keepScreenOn = false }
    }

    // Back out of the lyrics panel to the player, and only from the player
    // itself out to the mini player.
    //
    // See [PlayerBackHandler] for why this needs more than a BackHandler.
    // Controls being visible must not insert an extra navigation level. Back
    // always leaves lyrics in one step, whether it starts over the lyrics list
    // or over the half-player at the bottom.
    PlayerBackHandler(enabled = lyricsOpen, onBack = closeLyrics)

    // Back out of the queue to the player.
    PlayerBackHandler(enabled = queueOpen) { queueOpen = false }

    // Registered ahead of the pipeline dialog's own handler below: the
    // pipeline is now only ever opened from the row at the bottom of this
    // drawer, so it is always the topmost of the two when both are up, and
    // back has to close it first rather than taking the drawer out from
    // under it.
    PlayerBackHandler(enabled = showSocialJamSheet) { showSocialJamSheet = false }
    PlayerBackHandler(enabled = showAudioOutput) { showAudioOutput = false }
    PlayerBackHandler(enabled = showLyricsProviders) { showLyricsProviders = false }
    PlayerBackHandler(enabled = showListenTogetherMembers) { showListenTogetherMembers = false }
    PlayerBackHandler(enabled = lyricsPicker.picking) { lyricsPicker.cancel() }
    PlayerBackHandler(enabled = lyricsShareRequest != null) { lyricsShareRequest = null }
    PlayerBackHandler(enabled = showAudioPipeline) { showAudioPipeline = false }
    PlayerBackHandler(enabled = showMixView) { showMixView = false }

    PlayerBackHandler(enabled = lyricsOffsetOpen, onBack = onDismissLyricsOffset)

    // 0 = full sleeve, 1 = queue. Everything that moves reads off this.
    //
    // Plain state driven by an animation rather than [animateFloatAsState],
    // because it has two drivers and only one of them is an animation: the
    // toggle at the foot of the player, which travels end to end, and a finger
    // dragging the sleeve upward, which sets it outright. An animation keyed on
    // [queueOpen] cannot be pushed around mid-flight by a drag — and a drag that
    // could only move the *target* would have nothing to show for itself until
    // it was released, then jump from wherever the animation had got to.
    //
    // Read only inside layout and draw lambdas and the thresholds below, never
    // as a value here — see [p].
    // Whether a finger is on the sleeve right now. Parks the settle below rather
    // than leaving the two to write the same value on alternate frames.
    var queueDragging by remember { mutableStateOf(false) }
    // Bumped when a drag hands the value back, so the settle runs again even
    // though [queueOpen] may not have moved: a swipe that gave up short of
    // [QUEUE_CARRY_FRACTION] has to fall back to 0 just as surely as one that
    // carried has to finish reaching 1.
    var queueReleased by remember { mutableIntStateOf(0) }
    LaunchedEffect(queueOpen, queueDragging, queueReleased) {
        if (queueDragging) return@LaunchedEffect
        val target = if (queueOpen) 1f else 0f
        val from = queueSlide.floatValue
        if (from == target) return@LaunchedEffect
        animate(
            initialValue = from,
            targetValue = target,
            animationSpec = tween(
                durationMillis = (QUEUE_TRAVEL_MS * abs(target - from)).roundToInt(),
                easing = FastOutSlowInEasing,
            ),
        ) { value, _ -> queueSlide.floatValue = value }
    }

    // Horizontal fling anywhere on the player skips tracks; the artwork
    // follows the finger so the gesture has something to hold on to.
    val swipeThreshold = with(density) { 72.dp.toPx() }
    val infoScope = rememberCoroutineScope()
    val infoTransition = remember(infoScope) { SongInfoTransition(infoScope) }
    SideEffect { infoTransition.observe(song) }
    DisposableEffect(infoTransition) { onDispose { infoTransition.clear() } }
    // Where the finger has dragged the sleeve to, and the sleeve springing
    // after it. What animateFloatAsState does inside — a conflated channel of
    // targets, each chased from the current velocity — but fed straight from
    // the gesture: as state read here, every pointer move recomposed the whole
    // player just to hand the spring a new target, when the only readers are
    // draw-phase layers.
    val swipeSettle = remember { Animatable(0f) }
    val swipeTargets = remember { Channel<Float>(Channel.CONFLATED) }
    LaunchedEffect(swipeTargets) {
        for (target in swipeTargets) {
            val newest = swipeTargets.tryReceive().getOrNull() ?: target
            launch {
                if (newest != swipeSettle.targetValue) {
                    swipeSettle.animateTo(
                        newest,
                        spring(
                            dampingRatio = Spring.DampingRatioNoBouncy,
                            stiffness = Spring.StiffnessMediumLow,
                        ),
                    )
                }
            }
        }
    }
    val setSwipeOffset: (Float) -> Unit = { swipeTargets.trySend(it) }

    // Signature Apple Music touch: the sleeve shrinks back while paused.
    val artScale by animateFloatAsState(
        targetValue = if (isPlaying) 1f else 0.86f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioLowBouncy,
            stiffness = Spring.StiffnessLow,
        ),
        label = "artScale",
    )

    val volume = rememberPlayerVolume()
    // Present when you arrive, out of the way once you are actually reading.
    //
    // The panel opens with the player under it so the scrubber and transport
    // are there to be reached, and this is the other half of that bargain: left
    // alone for [LYRICS_CONTROLS_IDLE_MS] it stands down and gives the words the
    // whole screen. Scrolling up brings it back and restarts the wait, since
    // that write to [lyricsControlsOpen] re-keys this effect.
    //
    // Never while a finger is on the scrubber or the volume bar: those are the
    // two controls that are *being used* while nothing else on screen moves,
    // and timing out underneath them would take the thing away mid-gesture.
    LaunchedEffect(lyricsOpen, lyricsControlsOpen, scrub.scrubbing, volume.dragging) {
        if (lyricsOpen && lyricsControlsOpen && !scrub.scrubbing && !volume.dragging) {
            delay(LYRICS_CONTROLS_IDLE_MS)
            lyricsControlsOpen = false
        }
    }
    // 0 = the ordinary square sleeve, 1 = the artwork as a full-bleed banner.
    // Both states collapse the header, but the banner only ever shows over a
    // settled player: opening the queue or the lyrics hands the sleeve back its
    // card first.
    // How collapsed the sleeve is, whichever surface asked for it.
    //
    // This used to read `if (lyricsOpen) 1f else queueProgress`, which gave the
    // queue a 420ms ease and the lyrics nothing at all: opening them snapped
    // the sleeve to a thumbnail in a single frame while [heroT] — reading off
    // this same value — went on fading the banner out over the full 420. One
    // half of the artwork jumped, the other half glided after it, and the pair
    // read as a stutter rather than as either. One animation, both surfaces.
    val animatedCollapse = animateFloatAsState(
        targetValue = if (lyricsOpen || queueOpen) 1f else 0f,
        animationSpec = tween(durationMillis = 420, easing = FastOutSlowInEasing),
        label = "sleeveCollapse",
    )
    // A queue tap/drag already owns a 420ms progress value. Reusing it avoids
    // driving this large layout from two independent animations on every frame.
    // Lyrics retain the ordinary collapse animation; switching queue -> lyrics
    // stays at one because its target never changed.
    //
    // A function rather than a value. It moves on every frame of a 420ms
    // collapse and of a finger dragging the queue, and read here as a value it
    // recomposed this whole function on each of those frames — the sleeve, the
    // credits, both panels and the controls, just to move a few of them. Layout
    // and draw lambdas call it where they place or paint; composition only asks
    // the thresholds below, each of which changes once per collapse.
    val p: () -> Float = {
        val queueOwnsCollapse = !lyricsOpen &&
            (queueOpen || queueDragging || queueSlide.floatValue > 0.001f)
        if (queueOwnsCollapse) queueSlide.floatValue else animatedCollapse.value
    }
    val collapseStarted by remember { derivedStateOf { p() > 0f } }
    val collapseAtRest by remember { derivedStateOf { p() == 0f } }
    val collapsePastSettling by remember { derivedStateOf { p() >= 0.01f } }
    val collapsePastHalf by remember { derivedStateOf { p() >= 0.5f } }
    val collapseAlmostDone by remember { derivedStateOf { p() >= 0.999f } }
    val collapseDone by remember { derivedStateOf { p() >= 1f } }
    val queueShowing by remember { derivedStateOf { queueSlide.floatValue > 0.01f } }

    // Whether the sleeve has finished getting out of the way, and how far the
    // panel that replaces it has faded up since.
    //
    // The lyric sheet and the queue list are the two most expensive things this
    // screen can compose — measuring every line of a song, or building a lazy
    // list with drag-reorder state per row — and both used to be composed on
    // the frame the panel was asked for, which is the frame the 420ms collapse
    // above starts on. That put the single heaviest composition of the whole
    // screen directly on top of the one animation the eye is following, and it
    // read as the open stuttering.
    //
    // Held back until [p] has actually arrived, the expensive frame lands while
    // nothing is moving, where a dropped frame costs nothing to look at, and
    // the panel then fades up on its own short curve. The open is a little
    // longer end to end and visibly smoother for it.
    //
    // Declared out here rather than beside either panel on purpose: an
    // [animateFloatAsState] created at the moment its target becomes true is
    // created *at* that target and has nothing left to animate. Living above
    // both panels, this one is already at 0 when they mount.
    val panelsSettled = collapseDone
    val panelFade by animateFloatAsState(
        targetValue = if (panelsSettled) 1f else 0f,
        animationSpec = tween(durationMillis = 200, easing = FastOutSlowInEasing),
        label = "panelFade",
    )
    // Full-bleed is a phone idiom. What the width has to rule out is a player
    // running a foot wider than the column of controls under it — edge to edge
    // meaning "a picture, and separately some controls" rather than "the
    // artwork *is* the player".
    //
    // One question for the still cover and the clip both, rather than two that
    // could disagree — and they did, twice over. Dissolving a TextureView's
    // bottom edge needs a RenderEffect, so below API 31 the clip was held in its
    // sleeve while the cover behind it went edge to edge, and the artwork
    // changed shape the moment a clip arrived. In the other direction the clip
    // ignored [fullBleedArt] entirely, so turning the setting off still left a
    // clip running the full screen. CanvasArtworkPlayer masks itself on every
    // API level now, and both layers answer to this.
    val spotifyCanvasOnPhone = canvas?.source == CanvasSource.SPOTIFY &&
        playerFillsWindow(windowWidth)
    // Spotify Canvas is the player background on a phone, independent of the
    // still-art full-bleed preference. Other providers and static artwork keep
    // answering to that preference exactly as before.
    val heroMode = spotifyCanvasOnPhone ||
        (fullBleedArt && playerFillsWindow(windowWidth))

    // Whether there's a still image to blow out — a placeholder tile is a card
    // or it is nothing, and going full-bleed with one would just tint the top
    // third of the screen.
    //
    // Keyed on the artwork rather than on the track, because that is what it
    // actually describes and because only Coil can set it back to true. Two
    // tracks off one album share a cover, so skipping between them leaves the
    // request below byte-identical: the painter keeps the Success it already
    // had and never re-emits, so the `onState` that is the sole writer here
    // never fires again. Keyed on the track this reset to false and stayed
    // there, which pinned the sleeve fully opaque (see the alpha it feeds) on
    // top of an equally opaque banner — the same cover drawn twice, card and
    // full-bleed at once. Keyed on the cover there is nothing to reset: the
    // bitmap really is still loaded, so the state stays true and the two
    // layers go on trading places as they should.
    val art = rememberPlayerArtwork(remoteArt)
    val autoMixCover = rememberAutoMixCover(coverEntry, art, artworkGate)
    val autoMixFrames = autoMixCover.framesFor(coverEntry, artworkGate)
    val heroIncomingStill = autoMixFrames?.incoming.takeIf {
        heroMode && pair?.liveOutgoing == true && !pair.liveIncoming
    }
    fun coverLoaded() = autoMixFrames != null || art.loaded
    // Sticky, unlike [PlayerArtwork.loaded]: the banner is the shape of the player rather
    // than a property of the track in it. Waiting on each new cover would
    // collapse the banner into a card and blow it back out on every skip —
    // twice the length of the whole screen's worth of movement for a change the
    // artwork itself already announces. The frame stays; the cover arrives in
    // it, fading in as Coil fades in everywhere else.
    //
    // Latched off the clip as well as the still art, for a cover that never
    // arrives at all and leaves the banner standing on the clip alone: the clip
    // gives its frame up and takes it back every time the app leaves the screen,
    // and a banner that answered only to that would collapse behind the user's
    // back and blow itself out again in front of them on the way in.
    var heroSettled by remember { mutableStateOf(false) }
    // Success from the banner's own painter, rather than from the separate
    // sleeve painter. Sharing one ImageRequest lets Coil share its cached
    // bitmap, but it does not make two AsyncImage painters enter Success in
    // the same frame. The sleeve must not hand over to a banner which is still
    // empty just because its own painter finished first.
    var heroArtLoaded by remember(art.url, art.attempt, heroMode) { mutableStateOf(false) }
    LaunchedEffect(art, coverEntry, canvasRenderedState, artworkGate) {
        if (heroSettled) return@LaunchedEffect
        snapshotFlow {
            autoMixCover.framesFor(coverEntry, artworkGate) != null || art.loaded || canvasRenderedState.value
        }.first { it }
        heroSettled = true
    }
    // The clip that gets the banner, if any. Hoisted because the still frame
    // underneath keys its handover on exactly what is mounted here: both are
    // decided in the same composition pass, so opening the queue or the lyrics —
    // which takes the clip away — brings the still frame back in the very frame
    // the clip goes, instead of a frame later with the sleeve behind it still
    // transparent and no artwork anywhere.
    val heroClip = canvas?.takeIf { heroMode && !collapsePastHalf }
    val heroClipMounted = canvas?.takeIf {
        heroMode && (!collapsePastHalf || (pair != null && !lyricsOpen))
    }
    val spotifyCanvasFullscreen = spotifyCanvasOnPhone &&
        (heroClipMounted ?: heroClip)?.source == CanvasSource.SPOTIFY
    val spotifyCanvasPresentation = spotifyCanvasFullscreen && canvasRendered
    val canvasFirstPortrait = !spotifyCanvasFullscreen &&
        (heroClipMounted ?: heroClip) != null && canvasAspect > 0f && canvasAspect < 1f

    // The setting defaults on, restoring the five-second stand-down, but the
    // listener can keep the deck open indefinitely from Spotify integration.
    // Pausing or interacting with a continuous control suspends the countdown;
    // it starts fresh once playback/interaction resumes.
    LaunchedEffect(
        spotifyCanvasPresentation,
        spotifyCanvasControlsOpen,
        spotifyCanvasAutoHide,
        isPlaying,
        scrub.scrubbing,
        volume.dragging,
        lyricsOpen,
        queueOpen,
    ) {
        if (!spotifyCanvasPresentation || !spotifyCanvasControlsOpen ||
            !spotifyCanvasAutoHide || !isPlaying || scrub.scrubbing || volume.dragging ||
            lyricsOpen || queueOpen
        ) return@LaunchedEffect
        delay(SPOTIFY_CANVAS_CONTROLS_IDLE_MS)
        spotifyCanvasControlsOpen = false
    }

    // Returning from a subview, or regaining the TextureView after backgrounding,
    // is a fresh visit, so show the deck again before any optional countdown.
    LaunchedEffect(spotifyCanvasPresentation, lyricsOpen, queueOpen) {
        if (spotifyCanvasPresentation && !lyricsOpen && !queueOpen) {
            spotifyCanvasControlsOpen = true
        }
    }
    // Portrait clips always use the existing artwork mesh, even if the user
    // selected another backdrop for ordinary artwork. Only computed when actually rendered.

    // Whether the banner is the presentation at all: full-bleed is on, and there
    // is something to blow out. The collapse is deliberately *not* part of this
    // — see [heroVisible].
    val settlingToSquare = !fullBleedArt && pair?.selectedStill == true && heroIncomingStill != null
    val heroT = animateFloatAsState(
        targetValue = if (
            heroMode && (canvasRendered || coverLoaded() || heroSettled) && !settlingToSquare
        ) 1f else 0f,
        animationSpec = if (settlingToSquare) snap() else tween(durationMillis = 420, easing = FastOutSlowInEasing),
        label = "heroCanvas",
    )

    /**
     * How much of the banner is actually on screen: its own fade, dissolved by
     * the collapse rather than after it.
     *
     * The collapse used to be a threshold on this animation's *target* — the
     * banner was told to go once [p] passed a half. That chained two 420ms
     * animations end to end when they should have been the same one: for the
     * first half of the collapse the banner sat at full size and full opacity
     * with nothing appearing to move, since the card shrinking behind it is
     * transparent while the banner is up; then the card finished collapsing and
     * a full-screen banner cross-dissolved into a finished thumbnail. Two sizes
     * of the same artwork on screen at once, which is what made every trip in
     * and out of the lyrics look wrong.
     *
     * Multiplied by the collapse instead, the banner goes as the card shrinks:
     * one movement, and the card is fading in the whole way down.
     */
    val heroVisible: () -> Float = { heroT.value * (1f - p()) }
    val heroShowing by remember { derivedStateOf { heroVisible() > 0.001f } }
    val spotifyChromeAlpha by animateFloatAsState(
        targetValue = if (!spotifyCanvasPresentation || spotifyCanvasControlsOpen) 1f else 0f,
        animationSpec = tween(durationMillis = 180, easing = FastOutSlowInEasing),
        label = "spotifyCanvasChrome",
    )
    // How tall that banner is, worked out down in the layout where the sleeve's
    // own geometry is known. Zero until the first measure, which is fine: there
    // is nothing to show that early either.
    var heroHeight by remember { mutableStateOf(0.dp) }
    var playerBounds by remember { mutableStateOf(IntSize.Zero) }
    var expandedSquare by remember { mutableStateOf(Rect.Zero) }
    // The bottom of a top-aligned, contained clip in the full-player view.
    // Use measured pixels and the decoded display aspect, never screen constants.
    fun canvasBottom(aspect: Float): Dp =
        if (aspect > 0f && aspect < 1f && playerBounds.width > 0 && playerBounds.height > 0) {
            val viewAspect = playerBounds.width.toFloat() / playerBounds.height
            val videoHeight = if (aspect >= viewAspect) playerBounds.width / aspect
                else playerBounds.height.toFloat()
            with(density) { videoHeight.toDp() }
        } else 0.dp
    val renderedCanvasBottom = if (canvasFirstPortrait) canvasBottom(canvasAspect) else 0.dp
    // Match the old hero's fade height in physical pixels, not its much larger
    // percentage of a portrait video. The mask ends at the real video bottom.
    fun clipFadeFraction(bottom: Dp): Float = if (bottom > 0.dp) {
        (heroHeight.value * HERO_FADE_FRACTION / bottom.value).coerceIn(0f, 1f)
    } else 0f
    val canvasFirstFadeFraction = clipFadeFraction(renderedCanvasBottom)
    val statusBarTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    // What sits between the status bar and the artwork: the drag strip. Read
    // in three places — the strip itself,
    // the scrim drawn over it and the banner's own height — which all have to
    // agree or the artwork and the credits under it move.
    val topStrip = DISMISS_STRIP_HEIGHT

    // The band of the player a vertical drag belongs to rather than to whatever
    // is under it: from the top of the artwork to the bottom of the credits, in
    // root coordinates. Everything in between is one block — the full sleeve
    // with the title and artist beneath it — and a drag on it closes the player
    // downwards and opens the queue upwards.
    //
    // Read off the layout rather than recomputed, so it stays the block's own
    // shape whatever the screen: a height-bound sleeve on a tablet, a full-bleed
    // banner on a phone.
    //
    // Only ever the *expanded* block, though. Once a panel is up the band is not
    // this pair at all but the header, worked out from the state instead — see
    // the gesture below. The two edges do travel with the sleeve as it collapses,
    // which reads like the band could simply follow them the whole way, and that
    // is exactly what went wrong: the sleeve takes [QUEUE_TRAVEL_MS] to get
    // there, and for that whole half second the queue was already listed and
    // scrollable underneath a band still lying across it. A drag on a row came
    // out as the player closing.
    //
    // Bare numbers rather than a rect: the band runs the full width of the
    // player either way, and on a height-bound sleeve the bare backdrop down
    // each side of it should close the player too — it is part of the same
    // gesture, and a hole there would be a strip the finger mysteriously
    // slides off.
    //
    // Both start at zero, which is a band with no height and so no hole at all
    // until the first layout pass. There is nothing on screen to drag then
    // either.
    var dismissBandTop by remember { mutableFloatStateOf(0f) }
    var dismissBandBottom by remember { mutableFloatStateOf(0f) }
    // The suppressing Column's own coordinates, to put a pointer's local
    // position into the same space as the two edges above.
    var dismissBandSpace by remember { mutableStateOf<LayoutCoordinates?>(null) }

    // Where the caption above the credits leads: the party for a track someone
    // else queued, the queue itself for a queue-built session, and otherwise
    // back to the album or playlist the session was started from.
    val openPlaybackOrigin: () -> Unit = {
        if (playedBy != null) {
            onListenTogether()
        } else if (song.playbackSourceType == PlaybackSourceType.QUEUE) {
            queueOpen = true
            closeLyrics()
        } else {
            onOpenPlaybackSource()
        }
    }

    // Horizontal fling skips tracks. The portrait player hangs it on the whole
    // screen, the landscape one on the sleeve alone — the right column there is
    // full of horizontal sliders and a lyric list that should not be one stray
    // sideways drag away from changing the song.
    val startInfoDrag by rememberUpdatedState {
        infoTransition.beginDrag(
            song = song,
            next = songInfoNeighbour(queue, queueIndex, next = true, available = hasNext && !controlsLocked),
            // Freeze the preview decision for this gesture, not the transport's
            // existing release-time restart decision.
            previous = songInfoNeighbour(
                queue, queueIndex, next = false,
                available = !controlsLocked && !previousRestarts(),
            ),
        )
    }
    val releaseInfoDrag by rememberUpdatedState { total: Float ->
        val crossed = total <= -swipeThreshold || total >= swipeThreshold
        when {
            controlsLocked -> {
                infoTransition.cancelDrag()
                if (crossed) onBlockedControl()
            }
            total <= -swipeThreshold -> {
                haptics.play(Haptic.SkipNext)
                infoTransition.finishDrag(
                    next = true, currentSong = currentPlaybackSong, canSlide = { true }, action = onNext,
                )
            }
            total >= swipeThreshold -> {
                haptics.play(Haptic.SkipPrevious)
                infoTransition.finishDrag(
                    next = false, currentSong = currentPlaybackSong,
                    canSlide = { !previousRestarts() }, action = onPrevious,
                )
            }
            else -> infoTransition.cancelDrag()
        }
    }
    val skipSwipeGesture = Modifier.pointerInput(showAudioPipeline, panelScrolling, controlsLocked, queueOpen) {
        if (showAudioPipeline || panelScrolling || queueOpen) return@pointerInput
        var total = 0f
        var acceptsDrag = false
        detectHorizontalDragGestures(
            onDragStart = {
                total = 0f
                acceptsDrag = startInfoDrag()
            },
            onDragCancel = {
                if (!acceptsDrag) return@detectHorizontalDragGestures
                setSwipeOffset(0f)
                infoTransition.cancelDrag()
            },
            onDragEnd = {
                if (!acceptsDrag) return@detectHorizontalDragGestures
                releaseInfoDrag(total)
                setSwipeOffset(0f)
            },
            onHorizontalDrag = { _, delta ->
                if (!acceptsDrag) return@detectHorizontalDragGestures
                total += delta
                // Damped: it's a hint, not a drag-to-position.
                setSwipeOffset(total * 0.35f)
                infoTransition.dragBy(total)
            },
        )
    }

    // The scrubber's two halves, shared by both layouts so a drop point is held
    // the same way in each — see [PlayerScrub.pendingSeek].
    val scrubControlsLocked = rememberUpdatedState(controlsLocked)
    val onScrub: (Float) -> Unit = { fraction ->
        if (!scrubControlsLocked.value) {
            AutoMixVisualFeed.state.value?.generation?.let(AutoMixVisualFeed::cancel)
        }
        scrub.drag(fraction)
    }
    val onScrubFinished: () -> Unit = {
        // On release only. Ticking the whole way along the bar turns a scrub
        // into a rattle, and the beat that matters is the one that says where
        // the playhead landed.
        haptics.play(Haptic.Select)
        scrub.release(onSeekFraction)
    }
    val onVolumeChange: (Float) -> Unit = volume::drag
    val onVolumeChangeFinished: () -> Unit = volume::release

    // Lyrics, output and queue, with the output name under them — the row both
    // layouts end on, and the only thing in the landscape player's left column
    // besides the sleeve.
    val playerActions: @Composable () -> Unit = {
        PlayerActionRow(
            lyricsOpen = lyricsOpen,
            queueOpen = queueOpen,
            shuffleEnabled = shuffleEnabled,
            repeatMode = repeatMode,
            autoplayEnabled = autoplayEnabled,
            onToggleLyrics = toggleLyrics,
            onToggleQueue = toggleQueue,
            onToggleShuffle = onToggleShuffle,
            onCycleRepeat = onCycleRepeat,
            onToggleAutoplay = onToggleAutoplay,
            onOpenOutput = openAudioOutput,
            onListenTogether = openSocialSheet,
            onOpenListenTogetherMembers = openSocialSheet,
        )
        // Keep the current output caption visible in every state, except on
        // a phone on its side: its left column is only a phone's width tall,
        // and the sleeve needs that room more than the caption does. A
        // tablet's landscape has room for both.
        if (!(landscapePlayerAvailable(windowWidth, windowHeight) && !tabletSizedPlayer(windowWidth))) {
            Spacer(Modifier.height(18.dp))
            Box(
                modifier = Modifier.fillMaxWidth().height(20.dp),
                contentAlignment = Alignment.TopCenter,
            ) {
                OutputCaption(
                    accountName = accountName,
                    onOpenOutput = openAudioOutput,
                    onOpenMembers = openSocialSheet,
                )
            }
        }
    }

    // The drawers and dialogs the player raises over itself. Mounted by
    // whichever layout is on screen — they are overlays over the player, not
    // part of either shape of it.
    val playerOverlays: @Composable () -> Unit = {
        if (showSocialJamSheet) {
            SocialJamSheet(
                hazeState = drawerHaze,
                accountName = accountName,
                initialTab = socialJamInitialTab,
                currentSong = song,
                currentPositionMs = position.positionMs,
                isPlaying = isPlaying,
                myTracks = queue,
                onPlaySong = { s -> onPlayFrom?.invoke(listOf(s), 0, "Friend Activity") },
                onPlayQueue = { tracks, idx -> onPlayFrom?.invoke(tracks, idx, "Blend") },
                onDismiss = { showSocialJamSheet = false },
            )
        }
        if (showAudioOutput) {
            AudioOutputSheet(
                hazeState = drawerHaze,
                accountName = accountName,
                onDismiss = { showAudioOutput = false },
                onOpenPipeline = { showAudioPipeline = true },
            )
        }
        if (showLyricsProviders) {
            LyricsProviderSheet(
                hazeState = drawerHaze,
                currentSource = lyricsSource,
                states = lyricsProviderStates,
                onSelect = onSelectLyricsProvider,
                onDismiss = { showLyricsProviders = false },
            )
        }
        if (showQualityPickerSheet) {
            AddonQualityPickerSheet(
                onDismiss = { showQualityPickerSheet = false },
                onOpenPipeline = { showAudioPipeline = true },
            )
        }
        if (showAudioPipeline) {
            LiveAudioPipelineSheet(
                visible = showAudioPipeline,
                onDismiss = { showAudioPipeline = false },
            )
        }
        if (showMixView) {
            MixViewDialog(
                hazeState = drawerHaze,
                onDismiss = { showMixView = false },
            )
        }
        lyricsShareRequest?.let { request ->
            AndroidLyricsShareSheet(
                hazeState = drawerHaze,
                request = request,
                onDismiss = { lyricsShareRequest = null },
            )
        }
        if (showListenTogetherMembers) {
            ListenTogetherMembersSheet(
                hazeState = drawerHaze,
                onDismiss = { showListenTogetherMembers = false },
                onManage = {
                    showListenTogetherMembers = false
                    onListenTogether()
                },
            )
        }
        if (lyricsOffsetOpen) {
            LyricsOffsetSheet(
                hazeState = drawerHaze,
                onDismiss = onDismissLyricsOffset,
            )
        }
    }

    // A landscape window — a tablet, or a phone on its side — takes an entirely
    // different shape from the portrait player below: two columns rather than
    // one, see [landscapePlayerAvailable] and [LandscapePlayerLayout].
    //
    // A separate branch rather than something woven into the layout below:
    // the portrait player's collapsing sleeve, hero banner and vertical drag
    // gesture exist to let one tall column be the player, the lyrics and the
    // queue in turn, and in landscape none of them has anything to do — the
    // sleeve never has to get out of anything's way.
    val landscape = landscapePlayerAvailable(windowWidth, windowHeight)
    // Tablet-sized players use the full-cover blur in all three states. On a
    // phone only the lyrics and queue replace the main player's seam-aware,
    // reflected mesh; the main player deliberately keeps its existing look.
    val tabletArtworkBackdrop = tabletSizedPlayer(windowWidth)
    // Owned by the song-level player composition, not by any one screen state.
    // Opening lyrics/queue, and rotating into or out of landscape, therefore
    // reuse the same tiny pre-blurred bitmap instead of running a screen-sized
    // effect.
    val ambient = rememberAutoMixAmbient(coverEntry, remoteArt, artworkGate)
    val ambientBlurUrl = remoteArt ?: ambient.incoming?.resolvedUrl
    val blurSeed = ambient.incoming?.blur
    val blurSnapKey = rememberAmbientSnapKey(ambient.snapKey(blurSeed != null))
    val fullArtworkBlurImage = rememberFullArtworkBlurImage(
        imageUrl = ambientBlurUrl,
        artPx = ART_PX,
        seed = blurSeed,
        currentSelectionOnly = ambient.direct != null,
        prepare = playerTheme == PlayerTheme.SIMPLE || landscape || tabletArtworkBackdrop || lyricsOpen || queueOpen ||
            playerPrewarmStage >= 1,
    )
    val blurMix = ambient.mixFor(blurSeed != null)
    val heldBlurAvailable = remember(blurMix) {
        blurMix != null && (cachedFullArtworkBlur(blurMix.outgoingUrl) != null ||
            (coverEntry == blurMix.outgoing && fullArtworkBlurImage != null))
    }
    val blurAvailable = if (blurMix != null) heldBlurAvailable else
        ambient.direct != null || blurSeed != null || fullArtworkBlurImage != null
    // One movable Image node, not two backdrop call sites. Compose carries it
    // between the portrait and landscape players; only the cached bitmap
    // changes when the artwork preparation above completes for another song.
    val currentFullArtworkBlurImage = rememberUpdatedState(
        blurSeed ?: (if (ambient.cancelled) cachedFullArtworkBlur(ambientBlurUrl) else null) ?: fullArtworkBlurImage,
    )
    val currentBlurMix = rememberUpdatedState(blurMix)
    val currentBlurSnapKey = rememberUpdatedState(blurSnapKey)
    val currentBlurIsOutgoing = rememberUpdatedState(coverEntry == blurMix?.outgoing)
    val directBlur = rememberUpdatedState(ambient.direct != null)
    val fullArtworkBlurContent = remember {
        movableContentOf<Modifier> { backdropModifier ->
            key(currentBlurSnapKey.value) {
                FullArtworkBlurBackdrop(
                    image = currentFullArtworkBlurImage.value,
                    modifier = backdropModifier,
                    mix = currentBlurMix.value,
                    currentIsOutgoing = currentBlurIsOutgoing.value,
                    immediate = directBlur.value,
                )
            }
        }
    }

    val currentLyricsOffsetOpen by rememberUpdatedState(lyricsOffsetOpen)
    val overlayOpen = remember {
        derivedStateOf {
            showSocialJamSheet || showAudioOutput || showLyricsProviders ||
                showAudioPipeline || showQualityPickerSheet || showMixView || lyricsShareRequest != null || currentLyricsOffsetOpen
        }
    }
    val clipTransitionAlpha: () -> Float = { (1f - 2f * p()).coerceIn(0f, 1f) }
    val stillClip = canvas?.takeIf { !spotifyCanvasFullscreen }
    val stillUrl = stillClip?.url
    fun still(): CanvasStill? = CanvasStills.current?.takeIf { it.url == stillUrl }
    val stillMoving = collapseStarted || lyricsOpen || queueOpen || queueDragging
    val queueArtworkMoving by remember { derivedStateOf { queueSlide.floatValue > 0f } }
    val gestureArtwork = !lyricsOpen && (queueDragging || queueOpen || queueArtworkMoving)
    val gesturePair = pair?.takeIf { it.usesGestureSleeve(gestureArtwork) }

    fun captureStandby(clip: CanvasArtwork): Boolean {
        val tracks = pair ?: return false
        return gestureArtwork && !collapseDone && tracks.incomingClip?.url == clip.url &&
            tracks.incomingReady && tracks.gestureIncoming == null
    }

    fun retainGestureStill(clip: CanvasArtwork, standby: Boolean, image: ImageBitmap?, position: Long) {
        val tracks = pair ?: return
        if (image == null || canvasPair.visual !== tracks) return
        val still = CanvasStill(clip.url, image, position)
        if (standby) {
            if (tracks.incomingClip?.url == clip.url && tracks.incomingReady) tracks.gestureIncoming = still
        } else if (tracks.pinnedClip?.url == clip.url) {
            tracks.gestureOutgoing = still
        }
    }

    // In-place promotion keeps the existing decoder. If the gesture is still
    // held, hand its last frame to the ordinary current-clip still path.
    SideEffect {
        val captured = promotedCanvas?.gestureIncoming ?: return@SideEffect
        if (gestureArtwork && captured.url == stillUrl) {
            CanvasStills.current = captured
            CanvasStills.fresh = true
        }
        promotedCanvas.gestureIncoming = null
    }
    val staticHeroUnderlay = autoMixFrames?.takeIf { frames ->
        pair?.liveIncoming == true && pair.pinnedClip == null && frames.generation == pair.generation &&
            !canvasRetiring && !stillMoving && !overlayOpen.value &&
            (if (heroMode) heroHeight > 0.dp else incomingFullWindow && !expandedSquare.isEmpty)
    }?.base
    fun stillTakesOver(): Boolean = still() != null && CanvasStills.fresh &&
        (stillMoving || !canvasRendered)
    fun stillBottomPx(): Float {
        val image = still()?.takeIf { canvasFirstPortrait }?.image ?: return 0f
        if (playerBounds.width <= 0 || playerBounds.height <= 0 || image.width <= 0) return 0f
        return minOf(playerBounds.width * image.height / image.width.toFloat(), playerBounds.height.toFloat())
    }
    fun sleeveStillBottomPx(): Float = if (heroIncomingStill != null || gesturePair != null) 0f else stillBottomPx()
    fun stillFadeFraction(): Float {
        val bottom = sleeveStillBottomPx()
        if (bottom <= 0f) return HERO_FADE_FRACTION
        return (with(density) { heroHeight.toPx() } * HERO_FADE_FRACTION / bottom).coerceIn(0f, 1f)
    }
    fun stillAtMount(): CanvasStill? = Snapshot.withoutReadObservation { still() }
    val onStillCaptured: (ImageBitmap?, Long) -> Unit = { image, pos ->
        val url = stillClip?.url
        if (image != null && url != null) {
            CanvasStills.current = CanvasStill(url, image, pos)
            CanvasStills.fresh = true
        } else {
            CanvasStills.current = null
        }
    }
    val onClipResumed: () -> Unit = { CanvasStills.fresh = false }

    FrostedPlayerFrame(
        modifier = modifier,
        chrome = !disableBlendEffects,
        softened = !spotifyCanvasPresentation &&
            (playerTheme == PlayerTheme.DEFAULT || playerTheme == PlayerTheme.LEGACY),
        live = spotifyCanvasPresentation,
        overlayOpen = { overlayOpen.value },
        overlays = playerOverlays,
    ) {
    if (landscape) {
        // Paused always wins outright over a scrub in progress — see
        // [ARTWORK_PAUSE_SHRINK_SCALE].
        val landscapeArtScale by animateFloatAsState(
            targetValue = when {
                !isPlaying -> ARTWORK_PAUSE_SHRINK_SCALE
                scrub.scrubbing -> ARTWORK_DRAG_SHRINK_SCALE
                else -> ARTWORK_EXPANDED_SCALE
            },
            animationSpec = tween(durationMillis = ARTWORK_SCALE_DURATION_MS, easing = ArtworkScaleEasing),
            label = "landscapeArtworkScale",
        )
        val versionAligning by AppSettings.versionAlignmentInProgress.collectAsStateWithLifecycle()
        val transitionWindow by AppSettings.smartTransitionWindow.collectAsStateWithLifecycle()
        val panelOpen = lyricsOpen || queueOpen

        Box(modifier = Modifier.fillMaxSize()) {
            LandscapePlayerLayout(
                pane = when {
                    lyricsOpen -> PlayerPane.Lyrics
                    queueOpen -> PlayerPane.Queue
                    else -> PlayerPane.Main
                },
                background = { backgroundModifier ->
                    // The whole screen is the sheets' frost source: there is
                    // no full-bleed banner here to be it instead.
                    fullArtworkBlurContent(
                        backgroundModifier
                            .recordBackdrop(backdropLayer)
                            .hazeSource(playerHaze)
                            .hazeSource(drawerHaze),
                    )
                },
                artwork = { artworkModifier ->
                    LandscapeArtwork(
                        art = art,
                        autoMixFrames = autoMixFrames,
                        artLoaded = coverLoaded(),
                        canvas = canvas,
                        canvasPair = pair,
                        canvasRendered = canvasRendered,
                        isPlaying = isPlaying,
                        onCanvasRenderedChange = { canvasSurfaceRendered = it },
                        hideCanvas = staticCanvasMix,
                        hiddenCanvasAlpha = { if (canvasRetiring) retiringCanvasAlpha() else 0f },
                        freezeCanvas = freezeOutgoingCanvas,
                        pausedForTransition = overlayOpen.value,
                        modifier = artworkModifier
                            .then(skipSwipeGesture)
                            .graphicsLayer {
                                scaleX = landscapeArtScale
                                scaleY = landscapeArtScale
                                translationX = swipeSettle.value
                            }
                            // With a panel up the sleeve is the way back to
                            // the player, as the portrait thumbnail is.
                            .clickable(
                                enabled = panelOpen,
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                            ) {
                                queueOpen = false
                                closeLyrics()
                            },
                    ) {
                        // The stats belong to the player, not to the sleeve, so
                        // they leave it along with the rest of the player.
                        SleeveNerdStats(
                            song = song,
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                                .graphicsLayer { alpha = if (panelOpen) 0f else 1f },
                            bestPart = { BestPartPill(song, position, playerHaze, onSeek, overlayOpen = { overlayOpen.value }) },
                        )
                    }
                },
                actions = playerActions,
                mainPane = { compact ->
                    LandscapeMainPane(
                        compact = compact,
                        caption = if (hideSongStatus) null else playbackOriginText(song, playedBy),
                        onOpenCaption = openPlaybackOrigin,
                        credits = {
                            LandscapeCredits(
                                song = song,
                                infoTransition = infoTransition,
                                signedIn = signedIn,
                                likeStatus = likeStatus,
                                showRevertCue = showRevertCue,
                                onToggleLike = onToggleLike,
                                onOpenMenu = onOpenMenu,
                                onOpenAlbum = onOpenAlbum,
                                onOpenArtist = onOpenArtist,
                                hazeState = playerHaze,
                                overlayOpen = { overlayOpen.value },
                            )
                        },
                        lyricStrip = if (showLyricsPreview) {
                            {
                                CurrentLyricStrip(
                                    lines = lyricsTranslation.displayedLyrics,
                                    trackKey = song.videoId,
                                    positionMs = lyricsPosition,
                                    isPlaying = isPlaying,
                                    durationMs = durationMs,
                                    lyricsUnavailable = lyricsUnavailable,
                                    loadingText = lyricsLoadingText,
                                    onClick = openLyrics,
                                )
                            }
                        } else {
                            null
                        },
                        scrubber = {
                            PlayerScrubber(
                                shown = shown,
                                durationMs = durationMs,
                                loading = versionAligning || audioVersionSwitching,
                                transitionWindow = transitionWindow
                                    ?.takeIf { !scrub.scrubbing && it.end > it.start }
                                    ?.let { it.start..it.end },
                                onScrub = onScrub,
                                onScrubFinished = onScrubFinished,
                            ) {
                                val mixBlend by AppSettings.smartMixBlend.collectAsStateWithLifecycle()
                                val smartFadeEnabled by AppSettings.smartFadeEnabled.collectAsStateWithLifecycle()
                                Row(
                                    modifier = Modifier.align(Alignment.Center),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    PlaybackQualityLabel(
                                        song = song,
                                        isLoading = isLoading,
                                        onClick = { showQualityPickerSheet = true },
                                        modifier = Modifier.padding(horizontal = 4.dp),
                                    )
                                    val showMixBadge = (smartFadeEnabled && song?.isVideoOrigin != true) || mixBlend != null || (transitionWindow != null && !scrub.scrubbing)
                                    if (showMixBadge) {
                                        AutomixBadge(
                                            isBlending = mixBlend != null,
                                            onClick = { showMixView = true },
                                        )
                                    }
                                }
                            }
                        },
                        transport = {
                            TransportRow(
                                isPlaying = isPlaying,
                                isLoading = isLoading || audioVersionSwitching,
                                previousEnabled = !controlsLocked &&
                                    (hasPrevious || pastRestartPoint),
                                nextEnabled = !controlsLocked && hasNext,
                                onPrevious = onPrevious,
                                onPlayPause = onPlayPause,
                                onNext = onNext,
                                compact = compact,
                                animationsActive = !panelOpen,
                            )
                        },
                        volume = if (hideVolumeBar) {
                            null
                        } else {
                            {
                                VolumeRow(
                                    value = { volume.level.value },
                                    onValueChange = onVolumeChange,
                                    onValueChangeFinished = onVolumeChangeFinished,
                                )
                            }
                        },
                    )
                },
                lyricsPane = {
                    LandscapeLyricsPane(
                        hasLyrics = lyricsTranslation.displayedLyrics.isNotEmpty(),
                        placeholder = if (lyricsUnavailable) {
                            stringResource(R.string.lyrics_not_available)
                        } else {
                            lyricsLoadingText
                        },
                        status = lyricsTranslation.status,
                        onChangeProvider = { showLyricsProviders = true },
                        romanizationToggle = {
                            RomanizationToggleButton(
                                state = lyricsTranslation.romanizationState,
                                showingRomanization = lyricsTranslation.showingRomanization,
                                enabled = !lyrics.isNullOrEmpty(),
                                onClick = lyricsTranslation.toggleRomanization,
                            )
                        },
                        translationToggle = {
                            TranslationToggleButton(
                                state = lyricsTranslation.translationState,
                                showingTranslation = lyricsTranslation.showingTranslation,
                                enabled = !lyrics.isNullOrEmpty(),
                                onClick = lyricsTranslation.toggleTranslation,
                            )
                        },
                    ) { panelModifier ->
                        LyricsTranslationMotion(
                            trigger = lyricsTranslation.transition,
                            reduceMotion = lyricsTranslation.reduceMotion,
                            modifier = panelModifier,
                        ) { particleProgress ->
                            // [controlsOpen] is a constant `true`: that flag
                            // exists because the portrait player hides its
                            // transport behind the lyrics and needs a tap to
                            // bring it back. Here there is nothing hidden for
                            // a tap to reveal, and leaving the reveal gesture
                            // armed would only eat taps meant for the lines.
                            PlaybackPositionScope(lyricsPosition) { lyricsPositionMs ->
                                LyricsPanel(
                                    lines = lyrics.orEmpty(),
                                    subLines = lyricsTranslation.subLines,
                                    trackKey = song.videoId,
                                    positionMs = lyricsPositionMs,
                                    looking = !lyricsUnavailable,
                                    isPlaying = isPlaying,
                                    onSeekToLine = seekToLyric,
                                    controlsOpen = true,
                                    onRevealControls = {},
                                    onHideControls = {},
                                    translationProgress = particleProgress,
                                    picker = lyricsPicker,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            }
                        }
                    }
                },
                queuePane = {
                    InlineQueue(
                        queue = queue,
                        currentIndex = queueIndex,
                        autoplayEnabled = autoplayEnabled,
                        controlsLocked = controlsLocked,
                        onJumpTo = onJumpTo,
                        onRemove = onRemoveFromQueue,
                        onMove = onMoveInQueue,
                        onClear = onClearQueue,
                        onDragActiveChange = onQueueDragActiveChange,
                        modifier = Modifier.fillMaxSize(),
                    )
                },
            )
        }
        return@FrostedPlayerFrame
    }

    Box(modifier = Modifier.fillMaxSize().onSizeChanged { playerBounds = it }.background(Color.Black)) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .hazeSource(drawerHaze),
        ) {
        // Anchored to the sleeve's bottom edge, so the screen carries on in the
        // colours the artwork ended in rather than in a quantiser's idea of what
        // the artwork was about. Position ticks recompose this screen twice a
        // second and must not drag a full-screen blur along with them, which is
        // why the mesh is passed as one immutable value.
        //
        // The seam is the *expanded* banner's bottom edge and is left there as
        // the player collapses, rather than following the sleeve down: it is
        // the anchor for a blurred layer, and moving it would re-blur the whole
        // screen on every frame of the drag. Above it the mesh holds one colour,
        // so a seam left behind a collapsed sleeve shows nothing at all.
        // Both phone backgrounds stay mounted for the entire song. Only these
        // retained layers' alpha changes when a panel opens, so the full-cover
        // blur is neither rebuilt nor switched in on a hard frame boundary.
        // The tablet has no mirrored main-player treatment to crossfade from.
        val legacyMeshBackdrop = !tabletArtworkBackdrop && !spotifyCanvasPresentation &&
            playerTheme == PlayerTheme.LEGACY
        val artworkMeshBackdrop = !tabletArtworkBackdrop && playerTheme == PlayerTheme.DEFAULT
        val fullArtworkBackdropAlpha by animateFloatAsState(
            targetValue = if (
                !legacyMeshBackdrop &&
                (tabletArtworkBackdrop || blurAvailable) &&
                (!spotifyCanvasPresentation || lyricsOpen || queueOpen) &&
                (!artworkMeshBackdrop || lyricsOpen || queueOpen)
            ) 1f else 0f,
            animationSpec = tween(durationMillis = 360, easing = FastOutSlowInEasing),
            label = "fullArtworkBackdropCrossfade",
        )
        // One layer for all three, recorded for a shared lyrics card.
        //
        // And a source of the player's frost, under the sleeve and the
        // clip: the banner dissolves into this towards its bottom edge,
        // and glass over that stretch (the Best Part button, a menu)
        // found nothing behind it but the frost's flat charcoal.
        Box(
            Modifier
                .fillMaxSize()
                .recordBackdrop(backdropLayer)
                .hazeSource(playerHaze, zIndex = -1f),
        ) {
            if (legacyMeshBackdrop) {
                LegacyMeshBackdrop(
                    ambient = ambient,
                    entry = coverEntry,
                    imageUrl = remoteArt,
                    canvasFrame = { canvasFrame.takeIf { canvasOwnsAmbient } },
                    canvasKey = ambientCanvasKey,
                    trackKey = song.videoId,
                    modifier = Modifier.graphicsLayer { alpha = 1f - fullArtworkBackdropAlpha },
                )
            }
            if (artworkMeshBackdrop) {
                if (blurStyle == NowPlayingBlurStyle.NEW && !canvasFirstPortrait) {
                    val ambientSeed = ambient.incoming?.ambientBlur
                    val ambientSnapKey = rememberAmbientSnapKey(ambient.snapKey(ambientSeed != null))
                    val ambientMix = ambient.mixFor(ambientSeed != null)
                    val ambientUrl = remoteArt ?: ambient.incoming?.resolvedUrl
                    key(ambientSnapKey) {
                        AmbientArtworkBlurBackdrop(
                            imageUrl = ambientUrl,
                            canvasFrame = canvasFrame.takeIf { canvasOwnsAmbient },
                            mix = ambientMix,
                            currentIsOutgoing = coverEntry == ambientMix?.outgoing,
                            seed = ambientSeed,
                            direct = ambient.direct != null,
                            modifier = Modifier.graphicsLayer {
                                alpha = if (spotifyCanvasPresentation || fullArtworkBackdropAlpha >= 1f) 0f else 1f
                            },
                        )
                    }
                } else {
                    PlayerMeshBackdrop(
                        ambient = ambient,
                        entry = coverEntry,
                        trackKey = song.videoId,
                        imageUrl = remoteArt,
                        canvasFrame = { canvasFrame.takeIf { canvasOwnsAmbient } },
                        canvasKey = ambientCanvasKey,
                        seamTarget = {
                            if (canvasFirstPortrait) renderedCanvasBottom else if (heroMode) heroHeight else 0.dp
                        },
                        alpha = {
                            if (spotifyCanvasPresentation || fullArtworkBackdropAlpha >= 1f) 0f else 1f
                        },
                    )
                }
            }
            fullArtworkBlurContent(
                Modifier.graphicsLayer { alpha = fullArtworkBackdropAlpha },
            )
        }

        // The artwork, edge to edge and running up behind the status bar,
        // dissolving into the backdrop where the sleeve's bottom edge would
        // have been. It lives out here rather than in the sleeve because that
        // is the only way to escape the player's side gutter and its status-bar
        // inset — a banner that stops short of either reads as a misplaced card
        // rather than as the artwork the screen is made of.
        if (heroHeight > 0.dp) {
            if (staticHeroUnderlay == null && heroMode && !(stillCovered && heroClip != null) &&
                (!collapsePastHalf || heroShowing)
            ) {
                // Dropping this painter (once the canvas is opaque, or while a
                // panel is open) also drops the proof that this particular
                // destination can draw. If it is mounted again, keep the
                // sleeve visible until the new painter reports Success.
                DisposableEffect(art.request) {
                    onDispose { heroArtLoaded = false }
                }
                AutoMixPlayerCover(
                    art = art,
                    frames = autoMixFrames.baseUnderCanvas(pair),
                    onState = { state ->
                        art.onState(state)
                        heroArtLoaded = state is AsyncImagePainter.State.Success
                    },
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .fillMaxWidth()
                        .height(heroHeight)
                        // Haze must observe the drawable layer itself. A
                        // source on the surrounding layout only captured its
                        // mesh backdrop, leaving the cover sharp in the pill.
                        .hazeSource(playerHaze)
                        .graphicsLayer {
                            // Hands its opacity to the clip as the clip takes
                            // over, and takes it straight back if there is no
                            // clip mounted to hand it to.
                            alpha = heroVisible() *
                                (1f - if (heroClip != null) canvasCover.floatValue else 0f)
                            // The mask below erases part of what this layer
                            // drew, which it can only do in a buffer of its own.
                            compositingStrategy = CompositingStrategy.Offscreen
                        }
                        .artworkBottomFade({ 1f }, { HERO_FADE_FRACTION }),
                )
            }

        }

        // Mount once, behind the controls. A known portrait aspect changes the
        // invisible view to full-player bounds before its first frame is shown.
        if ((heroMode && heroHeight > 0.dp) || incomingFullWindow || spotifyCanvasFullscreen) {
            val standbyClip = pair?.incomingClip?.takeIf { !(lyricsOpen || queueOpen) || !collapseDone }
            val matchedLiveHero = pair?.liveOutgoing == true && pair.liveIncoming &&
                sharesHeroRevealFootprint(spotifyCanvasFullscreen, incomingFullWindow, canvasAspect, pair.incomingAspect)
            if (staticHeroUnderlay != null && pair != null) {
                val underlayFrame = if (heroMode) {
                    Modifier.align(Alignment.TopStart).fillMaxWidth().height(heroHeight)
                } else {
                    Modifier.layout { measurable, constraints ->
                        val rect = expandedSquare
                        val placeable = measurable.measure(
                            Constraints.fixed(rect.width.roundToInt(), rect.height.roundToInt()),
                        )
                        layout(constraints.maxWidth, 0) {
                            placeable.place(rect.left.roundToInt(), rect.top.roundToInt())
                        }
                    }
                }
                DecodedCover(
                    staticHeroUnderlay,
                    underlayFrame
                        .graphicsLayer {
                            alpha = outgoingArtworkTailAlpha(pair.standbyOpacity()) *
                                if (heroMode) heroVisible() else clipTransitionAlpha()
                            if (heroMode) {
                                compositingStrategy = CompositingStrategy.Offscreen
                            } else {
                                scaleX = artScale
                                scaleY = artScale
                                translationX = swipeSettle.value
                                shadowElevation = 10.dp.toPx()
                                shape = TileShape
                                clip = true
                            }
                        }
                        .then(if (heroMode) Modifier.artworkBottomFade({ 1f }, { HERO_FADE_FRACTION }) else Modifier)
                        .hazeSource(playerHaze),
                )
            }
            CanvasPresentationHost(heroClipMounted, standbyClip) { clip, standby ->
                val stillStart = remember(clip.url) { if (standby) null else stillAtMount() }
                var slotAspect by remember { mutableFloatStateOf(0f) }
                val fullscreen = fullCanvasWindow && clip.source == CanvasSource.SPOTIFY
                val portrait = !fullscreen && slotAspect > 0f && slotAspect < 1f
                val bottom = if (portrait) canvasBottom(slotAspect) else 0.dp
                val transitionFade: () -> Float = if (fullscreen || portrait) {
                    clipTransitionAlpha
                } else {
                    heroVisible
                }
                CanvasArtworkPlayer(
                    canvas = clip,
                    isPlaying = isPlaying,
                    // Paused for the whole collapse into the queue/lyrics panel
                    // and back, not just once it hands off to the still frame at
                    // p >= 0.5 — see [CanvasArtworkPlayer.pausedForTransition].
                    pausedForTransition = lyricsOpen || queueOpen || queueDragging ||
                        collapseStarted || (overlayOpen.value && !fullscreen) ||
                        (standby && pair?.started != true) || (!standby && freezeOutgoingCanvas),
                    // Spotify's 9:16 Canvas is the phone background, so it
                    // covers every edge. Other providers retain the contained
                    // portrait treatment introduced for motion cover art.
                    contentMode = if (fullscreen) {
                        CanvasContentMode.CROP
                    } else {
                        CanvasContentMode.FIT_PORTRAIT
                    },
                    alignPortraitTop = portrait,
                    onAspectRatioChanged = {
                        slotAspect = it
                        if (standby) pair?.incomingAspect = it else canvasAspect = it
                    },
                    portraitRevealBounds = playerBounds,
                    presentationAlpha = {
                        val fade = transitionFade()
                        when {
                            gesturePair != null || stillTakesOver() -> 0f
                            standby -> clipTransitionAlpha()
                            staticCanvasMix ->
                                if (clip.url == retiringCanvas?.url) retiringCanvasAlpha() * fade else 0f
                            matchedLiveHero && !pair.sharesClip && !fullscreen ->
                                outgoingArtworkTailAlpha(pair.reveal()) * fade
                            pair?.liveOutgoing == true && !pair.liveIncoming &&
                                autoMixFrames?.incoming != null && !stillMoving ->
                                outgoingArtworkTailAlpha(pair.reveal()) * fade
                            pair != null && !pair.sharesClip && (portrait || fullscreen) &&
                                pair.incomingClip?.source != CanvasSource.SPOTIFY &&
                                (pair.liveIncoming || autoMixFrames?.incoming != null) ->
                                (1f - pair.reveal()) * fade
                            else -> fade
                        }
                    },
                    onRenderedChanged = {
                        if (standby) {
                            pair?.reportIncoming(it)
                        } else {
                            canvasSurfaceRendered = it
                            pair?.reportOutgoing(it)
                        }
                    },
                    nowPlaying = true,
                    organicReveal = if (standby) {
                        pair?.standbyReveal(staticHeroUnderlay != null || (matchedLiveHero && !stillMoving))
                    } else if (fullBleedArt && heroIncomingStill != null && !stillMoving && gesturePair == null) {
                        pair?.outgoingStillBannerReveal(
                            autoMixFrames,
                            IntSize(playerBounds.width, with(density) { heroHeight.roundToPx() }),
                            HERO_FADE_FRACTION,
                            clipTransitionAlpha,
                        )
                    } else {
                        null
                    },
                    frameCapturePx = if (!standby && canvasOwnsAmbient && tintsOffClip && !tabletArtworkBackdrop) {
                        CANVAS_FRAME_CAPTURE_PX
                    } else {
                        0
                    },
                    onFrameCaptured = {
                        if (!standby && canvasOwnsAmbient && !tabletArtworkBackdrop &&
                            !lyricsOpen && !queueOpen && !queueDragging
                        ) {
                            canvasFrame = it
                        }
                    },
                    // The full-screen Spotify video has no mesh to re-tint.
                    // Keeping this null also removes the old three-second GPU
                    // readback cadence from this provider alone.
                    refreshFrameEveryMs = if (
                        standby || !canvasOwnsAmbient || fullscreen || tabletArtworkBackdrop ||
                        lyricsOpen || queueOpen || queueDragging
                    ) {
                        null
                    } else {
                        meshRefreshMs
                    },
                    onCoverChanged = { if (!standby) canvasCover.floatValue = it },
                    bottomFade = when {
                        fullscreen -> 0f
                        portrait -> clipFadeFraction(bottom)
                        else -> HERO_FADE_FRACTION
                    },
                    bottomFadeEndPx = if (portrait) with(density) { bottom.toPx() } else null,
                    resumeDelayMs = if (!standby && fullscreen) SPOTIFY_CANVAS_RESUME_DELAY_MS else 0L,
                    startPositionMs = stillStart?.positionMs ?: 0L,
                    revealInstantly = standby || stillStart != null,
                    captureStill = if (standby) captureStandby(clip) else
                        !staticCanvasMix && stillMoving && (!fullscreen || (gesturePair != null && gesturePair.gestureOutgoing == null)),
                    onStillCaptured = { image, position ->
                        if (standby || fullscreen) retainGestureStill(clip, standby, image, position)
                        else onStillCaptured(image, position)
                    },
                    onResumed = {
                        if (standby) pair?.gestureIncoming = null
                        else if (fullscreen) pair?.gestureOutgoing = null
                        else onClipResumed()
                    },
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .then(
                            if (fullscreen || portrait) Modifier.fillMaxSize()
                            else Modifier.fillMaxWidth().height(heroHeight),
                        )
                        .hazeSource(playerHaze),
                )
            }
            if (heroIncomingStill != null && fullBleedArt && pair != null &&
                (!collapsePastHalf || heroShowing) && heroHeight > 0.dp
            ) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .fillMaxWidth()
                        .height(heroHeight)
                        .hazeSource(playerHaze)
                        .graphicsLayer {
                            alpha = heroVisible()
                            compositingStrategy = CompositingStrategy.Offscreen
                        }
                        .artworkBottomFade({ 1f }, { HERO_FADE_FRACTION }),
                ) {
                    AutoMixIncomingStill(
                        result = heroIncomingStill,
                        eased = pair::reveal,
                        generation = pair.generation,
                        polish = !stillMoving,
                    )
                }
            }
        }

        // This transparent top gradient is always present while the modal
        // player owns the system bar. Its opacity follows the actual top-band
        // artwork, rather than changing the status-bar glyph colour per cover.
        // A subview replaces that hero with an artwork-derived mesh, so it gets
        // only a modest floor rather than an opaque status-bar surface.
        val playerSubviewOpen = lyricsOpen || queueOpen || lyricsOffsetOpen ||
            showAudioPipeline || showAudioOutput || showLyricsProviders || showSocialJamSheet
        val topGradientAlpha = if (playerSubviewOpen) {
            maxOf(artworkStatusScrimAlpha, SUBVIEW_STATUS_SCRIM_MIN_ALPHA)
        } else {
            artworkStatusScrimAlpha
        }

        val steps = 8
        val gradientColors = remember(topGradientAlpha) {
            List(steps) { index ->
                val progress = index / (steps - 1).toFloat()
                val factor = (1f - progress).toDouble().pow(1.5).toFloat()
                Color.Black.copy(alpha = topGradientAlpha * factor)
            }
        }
        val topScrimBrush = remember(gradientColors) {
            Brush.verticalGradient(gradientColors)
        }

        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .height(statusBarTop + topStrip)
                .background(topScrimBrush)
        )

        if (artworkMeshBackdrop && canvasFirstPortrait && canvasAspect < PORTRAIT_SCRIM_MAX_ASPECT) {
            Box(
                Modifier.matchParentSize()
                    .graphicsLayer {
                        alpha = canvasCover.floatValue * (1f - 2f * p()).coerceIn(0f, 1f)
                    }
                    .background(PortraitClipScrim),
            )
        }

        // Spotify Canvas keeps its pixels sharp across the whole phone. Pure
        // glass blur belongs only under the temporary lower control deck,
        // above the video. When the deck slides away this layer leaves with
        // it as well.
        AnimatedVisibility(
            visible = spotifyCanvasPresentation && spotifyCanvasControlsOpen,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(0.56f),
            enter = fadeIn(tween(SPOTIFY_CANVAS_CONTROLS_ANIMATION_MS)) + playerDeckSlideIn(),
            exit = fadeOut(tween(SPOTIFY_CANVAS_CONTROLS_ANIMATION_MS)) + playerDeckSlideOut(),
        ) {
            // Subscribe only while Spotify's glass layer exists. Static art and
            // non-Spotify motion covers do not observe this new state at all.
            val reduceDynamicBlur by AppSettings.reduceDynamicBlur.collectAsStateWithLifecycle()
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .then(
                        if (reduceDynamicBlur || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                            // A real backdrop RenderEffect is unavailable on
                            // older Android versions and intentionally skipped
                            // when dynamic blur is reduced. Retain the deck's
                            // contrast without paying for a fake blur path,
                            // while keeping the same progressive top edge as
                            // the live glass surface.
                            Modifier.background(
                                Brush.verticalGradient(
                                    0.00f to Color.Transparent,
                                    SPOTIFY_DECK_TOP_FADE_FRACTION to Color.Black.copy(alpha = 0.40f),
                                    1.00f to Color.Black.copy(alpha = 0.40f),
                                ),
                            )
                        } else {
                            Modifier.optimizedHazeEffect(
                                state = playerHaze,
                                // Do not use HazeMaterials with Transparent:
                                // that preset treats transparent RGB as black
                                // and replaces its alpha with a dark 0.8 tint.
                                style = HazeStyle(
                                    backgroundColor = Color.Transparent,
                                    tints = emptyList(),
                                    // Canvas stays sharp above the deck; the
                                    // lower glass needs stronger separation
                                    // from a moving video than static artwork.
                                    blurRadius = 48.dp,
                                    noiseFactor = 0f,
                                    fallbackTint = HazeTint(Color.Transparent),
                                ),
                            ) {
                                // This is a continuously changing video, so a
                                // full third-resolution backdrop is still more
                                // detail than a 48dp blur can preserve. At 18%
                                // this processes roughly 30% of the pixels used
                                // by optimizedHazeEffect's normal 33% path.
                                inputScale = HazeInputScale.Fixed(0.18f)
                                canDrawArea = { true }
                                mask = Brush.verticalGradient(
                                    0.00f to Color.Transparent,
                                    SPOTIFY_DECK_TOP_FADE_FRACTION to Color.Black,
                                    1.00f to Color.Black,
                                )
                            }
                        },
                    ),
            )
        }

        // While the control deck is up, the whole Canvas sits under a flat 50%
        // dim so the buttons and text read against any clip. It fades out as
        // the deck collapses to the full-screen video, and back in with the
        // deck, on the deck's own timing. Alpha is read in the draw phase, so
        // the fade never recomposes the player. Drawn above the glass deck, not
        // under it: the deck's blur samples the video layer itself, so a dim
        // beneath it never reached the glass and the deck stayed bright.
        val spotifyCanvasDim = animateFloatAsState(
            targetValue = if (spotifyCanvasPresentation && spotifyCanvasControlsOpen) 0.5f else 0f,
            animationSpec = tween(SPOTIFY_CANVAS_CONTROLS_ANIMATION_MS),
            label = "spotifyCanvasDim",
        )
        val spotifyCanvasDimShowing by remember { derivedStateOf { spotifyCanvasDim.value > 0f } }
        if (spotifyCanvasPresentation || spotifyCanvasDimShowing) {
            Box(
                Modifier.matchParentSize()
                    .graphicsLayer { alpha = spotifyCanvasDim.value }
                    .background(Color.Black),
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                // Observe unclaimed taps across the whole Canvas. Buttons and
                // the compact metadata row consume their own taps first; empty
                // video above or below them toggles the lower deck either way.
                .toggleSpotifyCanvasControlsOnTap(
                    enabled = spotifyCanvasPresentation,
                    onToggle = { spotifyCanvasControlsOpen = !spotifyCanvasControlsOpen },
                )
                .then(skipSwipeGesture),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // The only strip that passes drags through to the sheet, so the
            // player closes from the handle and the space around it — not from
            // a stray downward swipe on the artwork or the controls.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(topStrip),
                contentAlignment = Alignment.Center,
            ) {
                // While the origin caption is present the handle belongs at
                // the top of the strip. As lyrics or the queue replace the
                // album-cover player, it glides into the now-empty strip's
                // vertical centre alongside the caption's fade.
                Box(
                    Modifier
                        .align(Alignment.TopCenter)
                        .offset {
                            IntOffset(
                                x = 0,
                                y = lerp(
                                    6.dp,
                                    (topStrip - 5.dp).coerceAtLeast(0.dp) / 2,
                                    p(),
                                ).roundToPx(),
                            )
                        }
                        .width(38.dp)
                        .height(5.dp)
                        .graphicsLayer { alpha = spotifyChromeAlpha }
                        .shadow(2.dp, RoundedCornerShape(3.dp), clip = false)
                        .clip(RoundedCornerShape(3.dp))
                        .background(Color.White.copy(alpha = 0.70f)),
                )
                // [p] is the shared album-to-panel transition. Keeping this in
                // composition until its final frame gives the caption a real
                // fade on both entry and exit, but removes its click target
                // entirely once lyrics or the queue owns the player.
                if (!hideSongStatus && !collapseAlmostDone) {
                    PlaybackOriginCaption(
                        text = playbackOriginText(song, playedBy),
                        rawName = song.playbackSource ?: song.albumName ?: song.radioName,
                        onClick = openPlaybackOrigin,
                        textAlign = TextAlign.Center,
                        contentPadding = PaddingValues(start = PLAYER_GUTTER, end = PLAYER_GUTTER, bottom = 1.dp),
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .graphicsLayer { alpha = (1f - p()) * spotifyChromeAlpha },
                    )
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    // Swallow vertical drags before the sheet can read them as
                    // "dismiss me". Children that scroll consume first, so the
                    // lists are unaffected. This sits outside the side padding
                    // on purpose: inside it, the two gutters were left as bare
                    // sheet, and a swipe that strayed into one closed the whole
                    // player instead of scrolling the lyrics or the queue.
                    //
                    // With one hole in it, and where that hole is depends on
                    // which screen of the player is up:
                    //
                    //  * The main player — the artwork-and-credits block. Down is
                    //    left unconsumed for the sheet to dismiss with, so the
                    //    player closes from the picture as well as from the
                    //    handle; up is taken here and drags the queue in.
                    //  * The queue or the lyrics — the header those panels sit
                    //    below, and nothing else. Down closes the player, up does
                    //    nothing: there is no sleeve left to pull away from.
                    //
                    // The header is worked out from the state rather than read
                    // off the sleeve, which is the whole point of doing it here:
                    // the sleeve is still on its way for [QUEUE_TRAVEL_MS] after
                    // the queue opens, and a hole that waited for it spent that
                    // half second lying across a list the finger was already
                    // scrolling.
                    .onGloballyPositioned { dismissBandSpace = it }
                    .pointerInput(showAudioPipeline, panelScrolling) {
                        if (showAudioPipeline || panelScrolling) return@pointerInput
                        awaitEachGesture {
                            // Unconsumed on purpose, as the blanket version was:
                            // the collapsed sleeve's own clickable — the way back
                            // out of the queue — has taken the press by the time
                            // an ancestor sees it.
                            val down = awaitFirstDown(requireUnconsumed = false)
                            val space = dismissBandSpace
                            val y = space?.localToRoot(down.position)?.y
                                ?: down.position.y
                            // A panel is up from the moment it is asked for to
                            // the moment the sleeve has finished growing back —
                            // never mind where the sleeve is in between.
                            val panelUp = queueOpen || lyricsOpen ||
                                queueSlide.floatValue > 0.01f
                            val bandTop: Float
                            val bandBottom: Float
                            if (panelUp) {
                                bandTop = space?.positionInRoot()?.y ?: 0f
                                bandBottom = bandTop +
                                    (ART_BOX_TOP_PAD + HEADER_HEIGHT).toPx()
                            } else {
                                bandTop = dismissBandTop
                                bandBottom = dismissBandBottom
                            }
                            if (y >= bandTop && y <= bandBottom) {
                                if (!panelUp) {
                                    dragQueueIn(
                                        down = down,
                                        travel = bandBottom - bandTop -
                                            HEADER_HEIGHT.toPx(),
                                        slide = queueSlide,
                                        onHold = { queueDragging = it },
                                        onSettle = { open ->
                                            if (open != queueOpen) {
                                                haptics.play(
                                                    if (open) Haptic.Expand else Haptic.Tap,
                                                )
                                                queueOpen = open
                                            }
                                            queueReleased++
                                        },
                                    )
                                }
                                return@awaitEachGesture
                            }
                            // A down already taken means the sheet grabbed it
                            // while "settling" after a scroll (see
                            // guardSheetFromContentTouches), and the guard is
                            // about to hand it back to the list under the
                            // finger. Holding it here would strand that list
                            // mid-handback, and the list would never scroll.
                            if (down.isConsumed) return@awaitEachGesture
                            // What detectVerticalDragGestures does, minus the
                            // callbacks: cross the slop, then hold the gesture
                            // to the end so nothing downstream of the first
                            // event reaches the sheet either.
                            val drag = awaitVerticalTouchSlopOrCancellation(down.id) { change, _ ->
                                change.consume()
                            }
                            if (drag != null) verticalDrag(drag.id) { it.consume() }
                        }
                    }
                    .padding(horizontal = PLAYER_GUTTER),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
            // ---- Top and centre: artwork, then the credits ----
            // Everything that changes between the artwork and the queue lives
            // in this one weighted box, so the controls below it never move.
            // The loading state the scrubber wears for the length of a version
            // switch — see [ThinSlider.loading]. The flag is the alignment
            // half (fetch + measure); [audioVersionSwitching] is the resolve.
            // Both named here, so there is no frame of the switch with nothing
            // on screen saying the player is still working.
            val versionAligning by AppSettings.versionAlignmentInProgress.collectAsStateWithLifecycle()
            val versionSwitching = versionAligning || audioVersionSwitching
            // Height the artwork block below turns out not to need, spent by the
            // controls at the foot of the screen. Filled in from inside the box,
            // where the sleeve's real size is known; see [lastControlSpread].
            var controlSpread by remember { mutableStateOf(lastControlSpread) }
            BoxWithConstraints(
                modifier = Modifier
                    .weight(1f)
                    .widthIn(max = PLAYER_MAX_WIDTH)
                    .fillMaxWidth()
                    .padding(top = ART_BOX_TOP_PAD, bottom = 18.dp),
            ) {
                if (spotifyCanvasPresentation && playerDeckSettledOpen &&
                    maxHeight != spotifyCanvasExpandedTopHeight
                ) {
                    SideEffect { spotifyCanvasExpandedTopHeight = maxHeight }
                }
                // The height this box would have if the controls at the foot of
                // the screen were at their natural size. They aren't: they are
                // holding [controlSpread] of extra gap, which came out of here,
                // so adding it back cancels the only thing down there that
                // depends on what is decided up here.
                //
                // The sleeve and the slack below are both worked out from this
                // rather than from the box as it actually stands, and that is
                // what keeps the hand-off from creeping. Measured off the real
                // height, granting the gaps 20dp came back as a box 20dp
                // shorter and read as a *further* 20dp going spare — so any
                // moment the controls were briefly shorter than usual (a track
                // change, where the lyric strip drops back to its loading line,
                // or coming back from the lyrics panel, where the strip is
                // rebuilt from scratch) was pocketed for good. The gaps
                // ratcheted open a little at a time and the sleeve paid for it.
                val roomy = maxHeight + controlSpread
                // The sleeve is square, so it is bounded by whichever of the
                // two axes runs out first: the player's width on a phone, or —
                // on a tablet, where there is width to spare — the height left
                // over once the credits row and the gap above it have had
                // theirs. Sizing it off the width alone is what pushed the
                // credits down across the scrubber on anything but a phone.
                val wantArt = minOf(maxWidth, roomy - ART_TITLE_GAP - HEADER_HEIGHT)
                // Held to what the box has actually got, for the single frame it
                // takes the gaps below to catch up with a change in their own
                // height: a sleeve a few dp under for one frame is a better
                // failure than a credits row overhanging the lyric strip.
                val fullArt = minOf(wantArt, maxHeight - ART_TITLE_GAP - HEADER_HEIGHT)
                    .coerceAtLeast(THUMB_SIZE)
                // What's left over once the sleeve, the gap and the credits have
                // had theirs. A few dp on a phone; the better part of a
                // centimetre on anything taller, and since the group is centred,
                // half of it used to land between the credits and the lyric strip
                // as one wide hole in the middle of the controls.
                val slack = (roomy - wantArt - ART_TITLE_GAP - HEADER_HEIGHT)
                    .coerceAtLeast(0.dp)
                // Handed to the two gaps around the transport row instead, which
                // is where a tall screen should be doing its breathing.
                //
                // Assigned, not added to: [slack] is stated in terms the spread
                // cannot move, so this is the whole answer in one step, and it
                // gives the room back just as readily when the controls grow
                // into it again.
                //
                // The settled spread is retained while either panel is up. It is
                // part of the controls' footprint, not part of the artwork, and
                // removing it only for lyrics made the half-player jump shorter
                // at the exact moment the sleeve started collapsing.
                //
                // Granted in whole even pixels, and only when it actually moves.
                // This is a measurement feeding the layout it was measured from,
                // and [roomy] cancels that by adding the grant back — but only if
                // this pass's [maxHeight] already reflects the grant about to be
                // written, which needs the Column above to have re-measured the
                // controls at that grant already. It doesn't always have: on some
                // aspect ratios
                // the cancellation lands a pass late, the grant overshoots, the
                // next pass corrects past it the other way, and the two chase
                // each other through the same handful of values forever instead
                // of settling — a full-amplitude standing oscillation, not the
                // single-pixel shiver this rounding alone was built to absorb.
                // See [granted] below for the fix.
                // Do not feed transitional artwork measurements back into the controls.
                // The settled player's spread is retained throughout the return animation.
                // Spotify's compact Canvas state removes the entire deck, making this
                // weighted box much taller. That newly empty space is not control slack:
                // recording it here inflated both transport gaps when a queue swipe
                // brought the deck back. Only measure while the deck is actually present.
                val controlDeckIsMeasured = !spotifyCanvasPresentation || playerDeckSettledOpen
                if (!lyricsOpen && collapseAtRest && controlDeckIsMeasured) {
                    val target = with(density) {
                        val half = slack
                            .coerceAtMost(CONTROL_GAP_SPREAD_MAX * 2)
                            .toPx()
                            .div(2f)
                            .roundToInt()
                        (half * 2).toDp()
                    }
                    // Stepped towards [target] rather than jumped there in one
                    // grant, so a late cancellation (see above) decays instead of
                    // standing: still one pass to settle when the cancellation
                    // does land on time, and a fast-converging approach rather
                    // than a full-amplitude swing on the passes where it doesn't.
                    val granted = with(density) {
                        val steppedPx = (controlSpread.toPx() +
                            (target.toPx() - controlSpread.toPx()) * 0.4f)
                            .roundToInt()
                        steppedPx.toDp()
                    }
                    if (granted != controlSpread) {
                        SideEffect {
                            controlSpread = granted
                            lastControlSpread = granted
                        }
                    }
                }
                // Artwork and the title row travel together as one block, so
                // the pair sits centred while the queue is closed — in whatever
                // the controls couldn't take, which on all but the tallest
                // screens is nothing.
                val groupTop = (maxHeight - fullArt - ART_TITLE_GAP - HEADER_HEIGHT)
                    .coerceAtLeast(0.dp) / 2
                // Functions of the collapse, called at placement and measure
                // — see [p]. Composition never reads them.
                fun artSize(): Dp = lerp(fullArt, THUMB_SIZE, p())
                fun artTop(): Dp = lerp(groupTop, 0.dp, p())
                // Expanded and height-bound, the sleeve is narrower than the
                // player and has to be centred in it; collapsed, it belongs
                // hard against the left edge with the credits beside it.
                fun artStart(): Dp = lerp((maxWidth - fullArt) / 2, 0.dp, p())

                // Adaptive Track Info: Reposition track information down into the space
                // previously occupied by lyrics preview when lyrics are disabled or hidden.
                val targetTitleShift = if (adaptiveTrackInfoEnabled && !showLyricsPreview) {
                    24.dp.coerceAtMost(groupTop + 12.dp)
                } else {
                    0.dp
                }
                val adaptiveTitleShift by animateDpAsState(
                    targetValue = targetTitleShift,
                    animationSpec = tween(durationMillis = 300),
                    label = "adaptiveTitleShift",
                )

                fun regularTitleTop(): Dp = lerp(
                    groupTop + fullArt + ART_TITLE_GAP + adaptiveTitleShift,
                    0.dp,
                    p(),
                )
                // Once Spotify's control deck has left, keep the only remaining
                // player chrome against the bottom edge instead of stranding it
                // where the artwork's title normally sits near mid-screen.
                val spotifyTitleRange = if (spotifyCanvasPresentation) {
                    val expandedTopHeight = spotifyCanvasExpandedTopHeight
                        .takeIf { it > 0.dp }
                        ?: maxHeight
                    val collapsedTitleTop = (
                        expandedTopHeight + spotifyCanvasDeckHeight - HEADER_HEIGHT
                    ).coerceAtLeast(0.dp)
                    collapsedTitleTop
                } else {
                    null
                }
                fun currentTitleTop(): Dp = spotifyTitleRange?.let { collapsedTitleTop ->
                    // Read in the placement lambda below. This invalidates only
                    // placement, not composition or measurement, and keeps the
                    // credits on the deck's exact reveal frame.
                    lerp(collapsedTitleTop, regularTitleTop(), playerDeckReveal.value)
                } ?: regularTitleTop()
                fun titleStart(): Dp = lerp(0.dp, THUMB_SIZE + 12.dp, p())

                // How far down the *screen* the sleeve's bottom edge sits, which
                // is where the full-bleed banner has to stop for the credits
                // below it not to move when it appears. Everything between the
                // screen's top and this box's own top is fixed padding, so it
                // can simply be added back up rather than measured.
                val bannerBottom = statusBarTop + topStrip + ART_BOX_TOP_PAD +
                    groupTop + fullArt + (ART_TITLE_GAP + adaptiveTitleShift) / 2
                // Frozen while lyrics are up. The controls now retain their full
                // footprint across the transition, so this answer is identical
                // on both sides; avoiding writes during the panel keeps the
                // backdrop independent of its animation. The first pass is
                // exempt so a player composed with lyrics already open still
                // receives an anchor.
                //
                // Guarded, like the spread above: this runs on every pass, and a
                // state write from inside a layout is a recomposition asked for
                // from inside a layout. Writing the same answer back costs a
                // comparison here and a whole frame if it is left to the snapshot
                // to notice.
                val bannerSettled = !lyricsOpen || heroHeight == 0.dp
                if (bannerSettled && bannerBottom != heroHeight) {
                    SideEffect { heroHeight = bannerBottom }
                }
                val boxWidthPx = constraints.maxWidth
                val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
                val square = with(density) {
                    val side = fullArt.roundToPx()
                    val start = ((maxWidth - fullArt) / 2).roundToPx()
                    val left = if (rtl) boxWidthPx - start - side else start
                    val x = ((playerBounds.width - boxWidthPx) / 2f).roundToInt() + left
                    val y = statusBarTop.roundToPx() + topStrip.roundToPx() + ART_BOX_TOP_PAD.roundToPx() + groupTop.roundToPx()
                    Rect(Offset(x.toFloat(), y.toFloat()), Size(side.toFloat(), side.toFloat()))
                }
                if (square != expandedSquare) SideEffect { expandedSquare = square }

                // Empty state lives on this Box, not the AsyncImage: a
                // background *and* a painter both trying to fill the same
                // clipped shape is what read as two overlapping squares
                // whenever there was nothing to paint. One layer, one square.
                // [PlayerArtwork.loaded] is hoisted to the screen, where the banner needs
                // it too.
                Box(
                    modifier = Modifier
                        // The lambda overload deliberately: the Dp one reads
                        // its arguments at composition, so an animated offset
                        // recomposes and re-measures this Box — cover, clip and
                        // all — once per frame. Read at placement instead, the
                        // same movement costs a placement pass.
                        .offset { IntOffset(artStart().roundToPx(), artTop().roundToPx()) }
                        // What `.size(artSize)` measured, asked at measure
                        // time instead of composition.
                        .layout { measurable, constraints ->
                            val side = artSize().roundToPx()
                            val placeable = measurable.measure(
                                constraints.constrain(Constraints.fixed(side, side)),
                            )
                            layout(placeable.width, placeable.height) { placeable.placeRelative(0, 0) }
                        }
                        // Where the dismiss band starts. Read here, above the
                        // paused shrink below, so the band covers the sleeve's
                        // slot rather than the 86% of it that is drawn while
                        // paused — the ring of backdrop the shrink opens up is
                        // still the artwork as far as a finger is concerned, and
                        // a band that breathed with the shrink would hand it
                        // back and forth on every play and pause.
                        .onGloballyPositioned { dismissBandTop = it.boundsInRoot().top }
                        .graphicsLayer {
                            // The paused shrink and the swipe nudge only make
                            // sense on the full sleeve.
                            val collapse = p()
                            val idle = artScale + (1f - artScale) * collapse
                            scaleX = idle
                            scaleY = idle
                            translationX = swipeSettle.value * (1f - collapse)
                        }
                        // Collapsed, the sleeve is the way back: tapping the
                        // thumbnail puts the queue or the lyrics away again.
                        .then(
                            if (queueOpen || lyricsOpen) {
                                Modifier.clickable {
                                    queueOpen = false
                                    closeLyrics()
                                }
                            } else {
                                Modifier
                            },
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    // The sleeve proper. Separated from the box around it so
                    // the banner can dissolve the card — shadow, corners, tile
                    // and all — without taking the stats line with it.
                    //
                    // Held fully opaque until the destination banner has
                    // artwork of its own,
                    // regardless of [heroT]: the banner is sticky across skips
                    // by design (see [heroSettled]), but its content is not — a
                    // new track's cover has to come from somewhere while the
                    // banner waits on Coil or the clip's first frame, and the
                    // sleeve underneath, with its loading icon, is that
                    // somewhere. Once either destination source catches up,
                    // hiding the sleeve behind the banner is invisible.
                    // [PlayerArtwork.loaded] alone is not enough: the sleeve and banner
                    // use separate painters, and the banner can still be empty
                    // for a frame after the sleeve reports Success.
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            // The compact sleeve is the source while full
                            // bleed artwork is off, including its Canvas.
                            .hazeSource(playerHaze)
                            .graphicsLayer {
                                alpha = when {
                                    gesturePair != null || stillTakesOver() -> 1f
                                    canvasRetiring -> canvasRetire.value
                                    staticHeroUnderlay != null -> 0f
                                    heroMode && !fullBleedArt && heroIncomingStill != null -> 1f
                                    heroMode && (heroArtLoaded || autoMixFrames != null || canvasRendered) -> 1f - heroVisible()
                                    else -> 1f
                                }
                            }
                            // A drop shadow grounds a photo; on the flat
                            // placeholder tile it has nothing to sit behind, so
                            // it just reads as a second, darker square ringing
                            // the first. Only cast it once there's actually art.
                            .shadow(
                                if (coverLoaded()) 10.dp else 0.dp,
                                TileShape,
                            )
                            .clip(TileShape)
                            .drawWithContent {
                                drawRect(Color.Black.copy(alpha = 0.18f))
                                drawContent()
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (!coverLoaded() && (!canvasRendered || gesturePair != null)) {
                            Icon(
                                imageVector = RaagaIcons.MusicNote,
                                contentDescription = null,
                                tint = Color.White.copy(alpha = 0.35f),
                                modifier = Modifier
                                    .size(40.dp)
                                    .graphicsLayer {
                                        val scale = 1f - 0.5f * p()
                                        scaleX = scale
                                        scaleY = scale
                                    },
                            )
                        }
                        if (gesturePair != null) {
                            AutoMixGestureCover(art, autoMixFrames, gesturePair) {
                                gesturePair.gestureOutgoing?.image ?: still()?.takeIf { CanvasStills.fresh }?.image
                            }
                        } else if (heroIncomingStill != null && !fullBleedArt && pair != null) {
                            AutoMixIncomingStill(
                                heroIncomingStill, pair::reveal, pair.generation, polish = !stillMoving,
                            )
                        } else AutoMixPlayerCover(
                            art = art,
                            frames = autoMixFrames.baseUnderCanvas(pair),
                            modifier = Modifier
                                .fillMaxSize()
                                .drawWithContent {
                                    if (heroMode && pair?.liveOutgoing == true && !stillTakesOver()) return@drawWithContent
                                    if (staticCanvasMix) {
                                        drawContent()
                                        return@drawWithContent
                                    }
                                    val frame = still()
                                    if (frame == null) {
                                        if (coverLoaded() || !canvasRendered) drawContent()
                                    } else if (
                                        stillTakesOver() || !canvasRendered ||
                                        (heroMode && canvasCover.floatValue < 1f)
                                    ) {
                                        if (canvas?.source == CanvasSource.APPLE && stillTakesOver() && coverLoaded()) {
                                            drawContent()
                                            drawCropped(frame.image, alpha = clipTransitionAlpha())
                                        } else {
                                            drawCropped(frame.image)
                                        }
                                    }
                                },
                        )

                        // Where the clip plays when it can't have the banner:
                        // inside the same clip as the still art, taking the
                        // sleeve's corners, shadow and paused shrink for free.
                        if (!heroMode) {
                            WhileShown({ !collapsePastHalf || (gestureArtwork && !collapseDone && pair?.incomingClip != null) }) {
                                CanvasPresentationHost(canvas.takeUnless { collapsePastHalf }, pair?.incomingClip.takeUnless { incomingFullWindow }) { clip, standby ->
                                    val stillStart = remember(clip.url) { if (standby) null else stillAtMount() }
                                    CanvasArtworkPlayer(
                                        canvas = clip,
                                        isPlaying = isPlaying,
                                        pausedForTransition = lyricsOpen || queueOpen || queueDragging ||
                                            collapseStarted || overlayOpen.value ||
                                            (standby && pair?.started != true) || (!standby && freezeOutgoingCanvas),
                                        presentationAlpha = {
                                            if (gesturePair != null || stillTakesOver()) 0f
                                            else if (standby) 1f
                                            else if (staticCanvasMix) {
                                                if (clip.url == retiringCanvas?.url) retiringCanvasAlpha() else 0f
                                            }
                                            else if (incomingFullWindow && pair != null) 1f - pair.standbyOpacity()
                                            else if (clip.source == CanvasSource.APPLE && coverLoaded()) clipTransitionAlpha()
                                            else 1f
                                        },
                                        startPositionMs = stillStart?.positionMs ?: 0L,
                                        revealInstantly = standby || stillStart != null,
                                        captureStill = if (standby) captureStandby(clip) else !staticCanvasMix && stillMoving,
                                        onStillCaptured = { image, pos ->
                                            if (standby) retainGestureStill(clip, true, image, pos)
                                            else onStillCaptured(image, pos)
                                        },
                                        onResumed = { if (standby) pair?.gestureIncoming = null else onClipResumed() },
                                        onRenderedChanged = {
                                            if (standby) pair?.reportIncoming(it) else {
                                                canvasSurfaceRendered = it
                                                pair?.reportOutgoing(it)
                                            }
                                        },
                                        nowPlaying = true,
                                        organicReveal = if (standby) pair?.standbyReveal(!stillMoving) else null,
                                        frameCapturePx = if (!standby && canvasOwnsAmbient && tintsOffClip && !tabletArtworkBackdrop) {
                                            CANVAS_FRAME_CAPTURE_PX
                                        } else 0,
                                        onFrameCaptured = {
                                            if (!standby && canvasOwnsAmbient && !tabletArtworkBackdrop && !lyricsOpen && !queueOpen) {
                                                canvasFrame = it
                                            }
                                        },
                                        refreshFrameEveryMs = if (
                                            standby || !canvasOwnsAmbient || tabletArtworkBackdrop || lyricsOpen || queueOpen || queueDragging
                                        ) null else meshRefreshMs,
                                        modifier = Modifier.fillMaxSize(),
                                    )
                                }
                                val incoming = autoMixFrames?.incoming
                                if (gesturePair == null && incoming != null && pair?.liveOutgoing == true && !pair.liveIncoming) {
                                    AutoMixIncomingStill(incoming, pair::reveal, pair.generation)
                                }
                            }
                        }
                    }

                    // Measured stats stay on the sleeve's bottom centre. They
                    // fade away with Spotify's lower control deck rather than
                    // following the compact credits to the bottom edge.
                    if (!collapsePastHalf) {
                        SleeveNerdStats(
                            song = song,
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                                .graphicsLayer {
                                    alpha = (1f - p() * 2f) * spotifyChromeAlpha
                                    // Full screen, the art runs on past the
                                    // card's foot (the banner dissolving there,
                                    // or a Canvas to the screen's edges), so
                                    // the foot sits lower, nearer the title.
                                    translationY = BANNER_FOOT_DROP.toPx() * if (spotifyCanvasPresentation) {
                                        1f - p()
                                    } else {
                                        heroVisible()
                                    }
                                },
                            // Under the stats, or in their place with them off.
                            bestPart = { BestPartPill(song, position, playerHaze, onSeek, overlayOpen = { overlayOpen.value }) },
                        )
                    }
                }

                // ---- Title + menu ----
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        // Collapsed, this row shares the header with the sleeve
                        // rather than sitting under it, and the two are not the
                        // same height — centring the credits in the taller of
                        // the two boxes left them riding low against the
                        // artwork they belong to. Only as it collapses: opened
                        // out, the row is below the sleeve and owns its band.
                        // Read the animated value during placement. The Dp
                        // overload would recompose and remeasure this whole
                        // weighted player region on every animation frame.
                        .offset {
                            IntOffset(
                                x = 0,
                                y = (
                                    currentTitleTop() -
                                        lerp(0.dp, (HEADER_HEIGHT - THUMB_SIZE) / 2, p())
                                ).roundToPx(),
                            )
                        }
                        // What `.padding(start = titleStart)` laid out, asked at
                        // measure time instead of composition.
                        .layout { measurable, constraints ->
                            val start = titleStart().roundToPx()
                            val placeable = measurable.measure(constraints.offset(horizontal = -start))
                            layout(
                                constraints.constrainWidth(placeable.width + start),
                                constraints.constrainHeight(placeable.height),
                            ) { placeable.placeRelative(start, 0) }
                        }
                        .height(HEADER_HEIGHT)
                        // Where the dismiss band ends — see its top on the
                        // artwork above. Taken from the row rather than added up
                        // from the sleeve so the gap between the two is inside
                        // the band as well: it is a gap in one block, not a seam
                        // between two, and a finger should not be able to find it.
                        .onGloballyPositioned { dismissBandBottom = it.boundsInRoot().bottom },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(
                        Modifier
                            .weight(1f)
                            // Scaling the already measured type is a draw-only
                            // operation. Animating fontSize forced both marquee
                            // texts through shaping and measurement every frame.
                            .graphicsLayer {
                                val scale = 1f - 0.2f * p()
                                scaleX = scale
                                scaleY = scale
                                transformOrigin = TransformOrigin(0f, 0.5f)
                            },
                    ) {
                        // Only while these credits are the screen. Collapsed into
                        // a header over the queue or the lyrics they are a label
                        // on a list, and a label that crawls pulls the eye off
                        // whatever is being read below it.
                        //
                        // Asked inside each sliding block's content, so the
                        // switch recomposes the two lines and not the box
                        // round the whole sleeve — and asked of the panels
                        // first, so a collapse a tap asked for stops the crawl
                        // without waiting for [collapsePastSettling].
                        val scrolls = !collapsePastSettling
                        SlidingSongInfo(
                            song = song,
                            transition = infoTransition,
                            modifier = Modifier.additiveChrome(LocalPlayerChrome.current),
                        ) { infoSong ->
                            val song = infoSong
                            // Stagger each block's artist only if its own title crawls.
                            var titleOverflowing by remember { mutableStateOf(false) }
                            val artistColor = chromeWhite(0.55f)
                            Column {
                                MarqueeText(
                                    text = song.title,
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontSize = 20.sp,
                                    ),
                                    color = Color.White,
                                    enabled = scrolls,
                                    leading = if (song.isExplicit == true) {
                                        { ExplicitBadge(color = artistColor) }
                                    } else {
                                        null
                                    },
                                    onOverflowChange = { titleOverflowing = it },
                                    // Only the tracks YouTube hands us a browse id for
                                    // lead anywhere; the rest stay plain text.
                                    modifier = Modifier.copyOnLongPress(
                                        textToCopy = song.title,
                                        toastMessage = stringResource(R.string.copied_title_format, song.title),
                                        onClick = if (song.albumId != null) { { onOpenAlbum(song.albumId) } } else null
                                    ),
                                )
                                MarqueeText(
                                    text = song.artist,
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.W500,
                                        fontSize = 20.sp,
                                    ),
                                    color = artistColor,
                                    enabled = scrolls,
                                    // A title that's also scrolling gets to go first —
                                    // starting together reads as clutter, so the artist
                                    // waits a beat before it joins in.
                                    startDelayMillis = if (titleOverflowing) MARQUEE_ARTIST_STAGGER_MS else 0L,
                                    modifier = Modifier.copyOnLongPress(
                                        textToCopy = song.artist,
                                        toastMessage = stringResource(R.string.copied_artist_format, song.artist),
                                        onClick = if (song.artistId != null) { { onOpenArtist(song.artistId) } } else null
                                    ),
                                )
                            }
                        }
                    }
                    Spacer(Modifier.width(10.dp))
                    // Beside the credits rather than down in the toggle row:
                    // liking is about *this song*, and the row below is about
                    // how the queue plays. Guests get nothing to tap, since
                    // there's no account to record it against — and neither
                    // does a local file or a finished download, which carries
                    // no YouTube identity to rate.
                    // One frost behind both discs — see [GlassDiscPair].
                    GlassDiscPair(
                        hazeState = playerHaze,
                        overlayOpen = { overlayOpen.value },
                    ) {
                        if (signedIn && song.localUri == null) {
                            val liked = likeStatus == LikeStatus.LIKE
                            val useStarFavorite by AppSettings.useStarFavorite.collectAsStateWithLifecycle()
                            val favoriteIcon = if (liked) {
                                if (useStarFavorite) RaagaIcons.StarFilled else RaagaIcons.HeartFilled
                            } else {
                                if (useStarFavorite) RaagaIcons.Star else RaagaIcons.Heart
                            }
                            CircleGlyph(
                                icon = favoriteIcon,
                                contentDescription = stringResource(
                                    if (liked) R.string.remove_from_liked else R.string.like,
                                ),
                                onClick = onToggleLike,
                                active = liked,
                                haptic = if (liked) Haptic.ToggleOff else Haptic.ToggleOn,
                            )
                            Spacer(Modifier.width(8.dp))
                        }
                        CircleGlyph(
                            icon = when {
                                lyricsOpen -> Icons.Rounded.Share
                                showRevertCue -> Icons.AutoMirrored.Rounded.Undo
                                else -> Icons.Rounded.MoreHoriz
                            },
                            contentDescription = stringResource(
                                if (lyricsOpen) R.string.lyrics_share_title else R.string.more,
                            ),
                            onClick = if (lyricsOpen) {
                                {
                                    if (!lyricsPicker.picking) {
                                        val startLine = lyrics?.indexOfFirst { it.text.isNotBlank() }?.coerceAtLeast(0) ?: 0
                                        lyricsPicker.pick(startLine)
                                    }
                                    lyricsPicker.share()
                                }
                            } else {
                                onOpenMenu
                            },
                        )
                    }
                }

                val lyricsPanelVisible = lyricsOpen && panelsSettled
                if (lyricsPanelVisible || playerPrewarmStage >= 2) {
                        LyricsTranslationMotion(
                            trigger = lyricsTranslation.transition,
                            reduceMotion = lyricsTranslation.reduceMotion,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(top = HEADER_HEIGHT)
                                // Keep the prepared list measured but completely
                                // outside hit-testing/drawing until it is needed.
                                .offset {
                                    if (lyricsPanelVisible) IntOffset.Zero else IntOffset(100_000, 0)
                                }
                                // Arrives after the sleeve has finished collapsing
                                // into the header rather than during — see
                                // [panelsSettled]. Fading lyrics in over a sleeve
                                // still mid-collapse doubled the same movement in
                                // two places on screen at once, and composing them
                                // there was what made the collapse stutter.
                                .graphicsLayer { alpha = if (lyricsPanelVisible) panelFade else 0f },
                        ) { particleProgress ->
                            PlaybackPositionScope(lyricsPosition) { lyricsPositionMs ->
                                LyricsPanel(
                                    lines = lyrics.orEmpty(),
                                    subLines = lyricsTranslation.subLines,
                                    trackKey = song.videoId,
                                    positionMs = lyricsPositionMs,
                                    looking = !lyricsUnavailable,
                                    isPlaying = isPlaying,
                                    active = lyricsPanelVisible,
                                    onSeekToLine = seekToLyric,
                                    controlsOpen = lyricsControlsOpen,
                                    onRevealControls = { lyricsControlsOpen = true },
                                    onHideControls = { lyricsControlsOpen = false },
                                    translationProgress = particleProgress,
                                    onScrollingChange = { lyricsScrolling = it },
                                    picker = lyricsPicker,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            }
                        }

                    // Floated over the foot of the lyrics rather than placed in
                    // the controls below them. In the controls it was a row of
                    // layout like any other, and the bottom block is measured at
                    // its natural height — so the button's 34dp came straight
                    // off the panel above it and the lyrics lost a line. Drawn
                    // here it costs the panel nothing and still reads as sitting
                    // on top of the half player, because that is where it is.
                    //
                    // Arrives and leaves on the controls' own fade: the panel is
                    // for reading, and a control parked over the words when
                    // nobody asked for the controls is one more thing between
                    // the reader and them.
                    val translateShown = lyricsPanelVisible && lyricsControlsOpen
                    val translateFade by animateFloatAsState(
                        targetValue = if (translateShown) 1f else 0f,
                        animationSpec = tween(if (translateShown) 220 else 160),
                        label = "translateFade",
                    )
                    if (translateFade > 0.01f && !lyricsPicker.picking) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .graphicsLayer { alpha = translateFade },
                        ) {
                            RomanizationToggleButton(
                                state = lyricsTranslation.romanizationState,
                                showingRomanization = lyricsTranslation.showingRomanization,
                                enabled = translateShown && !lyrics.isNullOrEmpty(),
                                onClick = lyricsTranslation.toggleRomanization,
                            )
                        }
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .graphicsLayer { alpha = translateFade },
                        ) {
                            LyricsShareButton(
                                enabled = translateShown && !lyrics.isNullOrEmpty(),
                                onClick = {
                                    haptics.play(Haptic.Select)
                                    val startLine = lyrics?.indexOfFirst { it.text.isNotBlank() }?.coerceAtLeast(0) ?: 0
                                    lyricsPicker.pick(startLine)
                                },
                            )
                        }
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .graphicsLayer { alpha = translateFade },
                        ) {
                            TranslationToggleButton(
                                state = lyricsTranslation.translationState,
                                showingTranslation = lyricsTranslation.showingTranslation,
                                // Not tappable on the way out: a disc at 20%
                                // opacity is on its way to gone, not a target.
                                enabled = translateShown && !lyrics.isNullOrEmpty(),
                                onClick = lyricsTranslation.toggleTranslation,
                            )
                        }
                    }
                    if (lyricsPicker.picking) {
                        LyricsPickBar(
                            shareEnabled = lyricsPicker.picks.isNotEmpty(),
                            onCancel = lyricsPicker.cancel,
                            onShare = lyricsPicker.share,
                            count = lyricsPicker.picks.size,
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(bottom = 8.dp),
                        )
                    }
                }

                // Toggles and the queue arrive after the sleeve has finished
                // travelling, and leave before it starts coming back.
                // Held back until the sleeve has settled, exactly as the lyric
                // sheet above is — except while a finger is actually dragging
                // the queue in. A drag is direct manipulation: the queue has to
                // be under the finger the whole way for the gesture to mean
                // anything, and the person doing it is setting the pace, so
                // there is no animation of ours for the composition to trip up.
                val queuePanelVisible = !lyricsOpen &&
                    (queueDragging || (queueShowing && panelsSettled))
                if (queuePanelVisible || playerPrewarmStage >= 3) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(top = HEADER_HEIGHT)
                            .offset {
                                if (queuePanelVisible) IntOffset.Zero else IntOffset(100_000, 0)
                            }
                            .graphicsLayer {
                                alpha = if (!queuePanelVisible) {
                                    0f
                                } else if (queueDragging) {
                                    ((queueSlide.floatValue - 0.45f) / 0.55f).coerceIn(0f, 1f)
                                } else {
                                    panelFade
                                }
                                translationY = if (queuePanelVisible) {
                                    (1f - queueSlide.floatValue) * 26.dp.toPx()
                                } else {
                                    0f
                                }
                            },
                    ) {
                        InlineQueue(
                            queue = queue,
                            currentIndex = queueIndex,
                            autoplayEnabled = autoplayEnabled,
                            controlsLocked = controlsLocked,
                            onJumpTo = onJumpTo,
                            onRemove = onRemoveFromQueue,
                            onMove = onMoveInQueue,
                            onClear = onClearQueue,
                            onScrollingChange = { queueScrolling = it },
                            onDragActiveChange = onQueueDragActiveChange,
                            collapsePlayerOnScroll = true,
                            onRevealPlayer = { queueControlsOpen = true },
                            onHidePlayer = { queueControlsOpen = false },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            // ---- Bottom: lyric strip, scrubber, transport, volume, toggles ----
            // One block, measured at its natural height and pinned to the foot
            // of the player. Whatever is left over above it is the artwork's,
            // which is what keeps this row of controls in the same place on
            // every screen instead of being shoved off the bottom of a tall one.
            SlidingPlayerDeck(
                visible = !lyricsPicker.picking &&
                    (!lyricsOpen || lyricsControlsOpen) &&
                    (!queueOpen || queueControlsOpen) &&
                    (!spotifyCanvasPresentation || spotifyCanvasControlsOpen),
                reveal = playerDeckReveal,
            ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.onSizeChanged { size ->
                    if (spotifyCanvasPresentation) {
                        val measuredHeight = with(density) { size.height.toDp() }
                        if (measuredHeight != spotifyCanvasDeckHeight) {
                            spotifyCanvasDeckHeight = measuredHeight
                        }
                    }
                },
            ) {
            Column(
                modifier = Modifier
                    .widthIn(max = PLAYER_MAX_WIDTH)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
            // Current lyric, one line, directly above the scrubber. It stays in
            // the layout — and stays fully visible — whether or not the queue
            // is open: dropping it would shorten this block and the controls
            // under it would jump the moment the queue started sliding in, and
            // fading it away behind the queue left this the one place in the
            // player where the current line simply vanished.
            //
            // Switched off in Settings it goes entirely, rather than sitting
            // there saying no lyrics were found: none were looked for. It is
            // accompanied by a dedicated lyrics button in the bottom row. Its
            // one-line slot remains, invisibly, so opening lyrics cannot grow
            // the half-player merely to make room for the source label.
            if (!lyricsOpen && showLyricsPreview) {
                CurrentLyricStrip(
                    lines = lyricsTranslation.displayedLyrics,
                    trackKey = song.videoId,
                    positionMs = lyricsPosition,
                    isPlaying = isPlaying,
                    durationMs = durationMs,
                    lyricsUnavailable = lyricsUnavailable,
                    loadingText = lyricsLoadingText,
                    // Still visible over the queue, so still a valid way in:
                    // opens the same full lyrics panel it always has, closing
                    // the queue behind it the same way the "Up next" glyph
                    // closes lyrics behind the queue.
                    onClick = openLyrics,
                )
            } else if (!lyricsOpen && !showLyricsPreview && !adaptiveTrackInfoEnabled) {
                // Fixed layout: retain the empty one-line slot so controls don't shift
                Text(
                    text = "\u00A0",
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    modifier = Modifier
                        .fillMaxWidth()
                        .offset(y = 6.dp)
                        .padding(vertical = 4.dp),
                )
            }
            if (lyricsOpen) {
                LyricsStatusWithChange(
                    status = lyricsTranslation.status,
                    onChange = { showLyricsProviders = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .offset(y = 6.dp)
                        .padding(vertical = 4.dp),
                )
            }
            val transitionWindow by AppSettings.smartTransitionWindow.collectAsStateWithLifecycle()
            val mixBlend by AppSettings.smartMixBlend.collectAsStateWithLifecycle()
            PlayerScrubber(
                shown = shown,
                durationMs = durationMs,
                loading = versionSwitching,
                // Hidden while scrubbing: the planner is still describing
                // where the transition *would* be, and a marker sitting under
                // a finger that is moving the playhead invites reading it as
                // a drag target.
                transitionWindow = transitionWindow
                    ?.takeIf { !scrub.scrubbing && it.end > it.start }
                    ?.let { it.start..it.end },
                onScrub = onScrub,
                onScrubFinished = onScrubFinished,
            ) {
                val smartFadeEnabled by AppSettings.smartFadeEnabled.collectAsStateWithLifecycle()
                Row(
                    modifier = Modifier.align(Alignment.Center),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    PlaybackQualityLabel(
                        song = song,
                        isLoading = isLoading,
                        onClick = { showQualityPickerSheet = true },
                        modifier = Modifier.padding(horizontal = 4.dp),
                    )
                    val showMixBadge = (smartFadeEnabled && song?.isVideoOrigin != true) || mixBlend != null || (transitionWindow != null && !scrub.scrubbing)
                    if (showMixBadge) {
                        AutomixBadge(
                            isBlending = mixBlend != null,
                            onClick = { showMixView = true },
                        )
                    }
                }
            }

            val transport: @Composable () -> Unit = {
                TransportRow(
                    isPlaying = isPlaying,
                    isLoading = isLoading || audioVersionSwitching,
                    previousEnabled = !controlsLocked &&
                        (hasPrevious || pastRestartPoint),
                    nextEnabled = !controlsLocked && hasNext,
                    onPrevious = onPrevious,
                    onPlayPause = onPlayPause,
                    onNext = onNext,
                    animationsActive = !lyricsPicker.picking &&
                        (!lyricsOpen || lyricsControlsOpen) &&
                        (!queueOpen || queueControlsOpen) &&
                        (!spotifyCanvasPresentation || spotifyCanvasControlsOpen || mixBlend != null),
                )
            }
            if (!hideVolumeBar) {
                // The transport rides midway between the two blocks it
                // separates: the scrubber above it, and the volume bar and
                // toggle row below, which sit close enough together to read
                // as one. Both of its own gaps take half the spread, so on a
                // tall screen it holds the centre rather than drifting up
                // under the seek bar.
                Spacer(Modifier.height(8.dp + controlSpread / 2))
                transport()
                Spacer(Modifier.height(12.dp + controlSpread / 2))
                VolumeRow(
                    value = { volume.level.value },
                    onValueChange = onVolumeChange,
                    onValueChangeFinished = onVolumeChangeFinished,
                )
                // The volume slider already has 13dp below its drawn track.
                // Balance that invisible inset with the caption gap below the icons.
                Spacer(Modifier.height(6.dp))
            } else {
                val run = 8.dp + 12.dp + 6.dp + controlSpread + VOLUME_ROW_HEIGHT
                val lift = SCRUBBER_LABEL_LIFT / 2
                Spacer(Modifier.height(run / 2 - lift))
                transport()
                Spacer(Modifier.height(run / 2 + lift))
            }

            playerActions()
            Spacer(Modifier.height(18.dp))
            }
            }
            }
            }
        }
        }
    }
    }
}

/**
 * The upward half of the sleeve's vertical gesture: dragged up, the artwork
 * block pulls the queue in behind it, following the finger the whole way and
 * settling to whichever end it was nearer on release.
 *
 * Downward is deliberately not ours. The sheet the player sits in is what closes
 * when the sleeve is dragged that way, and it can only read a drag it was
 * allowed to see — so a downward crossing of the touch slop is left entirely
 * alone and this returns having consumed nothing at all.
 *
 * Which of the two it is can only be known at the crossing, which is why the
 * decision is made there rather than at the press. A pointer event reaches a
 * child before its parent, so consuming the very event that crossed the slop is
 * enough to keep the sheet out of an upward drag, and letting that one event
 * through is enough to hand it a downward one — the sheet's own slop detector
 * gives up the moment it sees a change already spoken for.
 *
 * @param travel how far the sleeve has to be dragged for the queue to arrive.
 * @param slide the 0..1 the player's whole layout reads off.
 * @param onHold true while the finger owns [slide] and false when it hands it
 *   back; the settling animation is parked in between so the two never write the
 *   same value on alternate frames.
 * @param onSettle the state the release decided on, which that animation then
 *   finishes reaching from wherever the finger left off.
 */
private suspend fun AwaitPointerEventScope.dragQueueIn(
    down: PointerInputChange,
    travel: Float,
    slide: MutableFloatState,
    onHold: (Boolean) -> Unit,
    onSettle: (Boolean) -> Unit,
) {
    // A block with nowhere to travel — a player not yet measured — would divide
    // by nothing and snap the queue open on the first pixel of movement.
    if (travel < 1f) return

    var pulled = 0f
    val drag = awaitVerticalTouchSlopOrCancellation(down.id) { change, overSlop ->
        if (overSlop < 0f) {
            pulled = -overSlop
            change.consume()
        }
    }
    if (drag == null || pulled <= 0f) return

    onHold(true)
    val velocity = VelocityTracker()
    velocity.addPointerInputChange(drag)
    slide.floatValue = (pulled / travel).coerceIn(0f, 1f)
    verticalDrag(drag.id) { change ->
        velocity.addPointerInputChange(change)
        pulled -= change.positionChange().y
        slide.floatValue = (pulled / travel).coerceIn(0f, 1f)
        change.consume()
    }

    // A flick decides on its own — it says "open" without asking the finger to
    // travel at all. Anything slower goes to whichever end it got nearer to.
    val flick = -velocity.calculateVelocity().y
    val open = when {
        flick >= QUEUE_FLICK_VELOCITY -> true
        flick <= -QUEUE_FLICK_VELOCITY -> false
        else -> slide.floatValue >= QUEUE_CARRY_FRACTION
    }
    onHold(false)
    onSettle(open)
}

/**
 * Back goes to [onBack] while [enabled], ahead of the sheet the player is drawn
 * in.
 *
 * The BackHandler can't do that on its own. The player is a ModalBottomSheet,
 * and from API 33 the sheet puts its own dismiss straight onto the window's
 * OnBackInvokedDispatcher at PRIORITY_DEFAULT — which is also where the dialog
 * dispatcher that every BackHandler feeds ends up, and at equal priority the
 * platform picks whichever registered last: the sheet's, every time. So on 33+
 * this outranks it with an overlay-priority callback for as long as [enabled]
 * holds, and only that long — otherwise the sheet keeps its own back handling
 * and its predictive-back shrink. Below 33 there is no window dispatcher to
 * outrank and the BackHandler is already the newest callback on the dialog's.
 *
 * Call order is priority order among these: a later call is the one back
 * reaches first while both are enabled.
 */
@Composable
private fun PlayerBackHandler(enabled: Boolean, onBack: () -> Unit) {
    BackHandler(enabled = enabled, onBack = onBack)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val view = LocalView.current
        DisposableEffect(view, enabled) {
            val callback = if (enabled) OverlayBack.register(view, onBack) else null
            onDispose { OverlayBack.unregister(view, callback) }
        }
    }
}

/**
 * A back callback that outranks whatever else the window has registered —
 * here, the sheet the player is drawn in. See the call site in
 * [NowPlayingScreen] for why it takes that.
 *
 * Everything that names an `android.window` type lives in this object so those
 * classes, which don't exist below API 33, are only ever *loaded* on a device
 * that has them: the callback comes back as [Any] rather than as the platform
 * interface for the same reason. Gating the calls on [Build.VERSION.SDK_INT]
 * is very likely enough by itself; this way it can't come down to how eagerly
 * a particular runtime resolves a reference it is never going to use.
 */
@RequiresApi(Build.VERSION_CODES.TIRAMISU)
private object OverlayBack {
    /** The registered callback, to hand back to [unregister]; null if it couldn't be. */
    fun register(view: View, onBack: () -> Unit): Any? {
        val dispatcher = view.findOnBackInvokedDispatcher() ?: return null
        val callback = OnBackInvokedCallback { onBack() }
        dispatcher.registerOnBackInvokedCallback(
            OnBackInvokedDispatcher.PRIORITY_OVERLAY,
            callback,
        )
        return callback
    }

    fun unregister(view: View, callback: Any?) {
        if (callback !is OnBackInvokedCallback) return
        view.findOnBackInvokedDispatcher()?.unregisterOnBackInvokedCallback(callback)
    }
}

/** Live Automix status pill that opens the Mix View popup. */
@Composable
private fun AutomixBadge(
    isBlending: Boolean,
    onClick: () -> Unit,
) {
    val infiniteTransition = rememberInfiniteTransition(label = "automix_pulse")
    val pulseAlpha by if (isBlending) {
        infiniteTransition.animateFloat(
            initialValue = 0.6f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(800, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "pulse_alpha",
        )
    } else {
        remember { mutableFloatStateOf(1f) }
    }

    val bg = if (isBlending) Color(0xFF30D158).copy(alpha = 0.22f * pulseAlpha) else Color.White.copy(alpha = 0.12f)
    val tint = if (isBlending) Color(0xFF30D158).copy(alpha = pulseAlpha) else Color.White.copy(alpha = 0.75f)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Icon(
            imageVector = Icons.Rounded.AutoAwesome,
            contentDescription = "Automix",
            tint = tint,
            modifier = Modifier.size(11.dp),
        )
        Spacer(Modifier.width(3.dp))
        Text(
            text = if (isBlending) "Mixing" else "Mix",
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
            color = tint,
        )
    }
}


