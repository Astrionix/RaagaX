package com.music.raaga.ui.player

import com.music.raaga.ui.components.onMouseWheelVolume
import com.music.raaga.ui.components.copyOnLongPress
import com.music.raaga.playback.AutoMixVisualFeed
import com.music.raaga.playback.AutoMixVisualPhase

import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.draw.drawWithContent
import com.music.raaga.R

import android.media.AudioFormat
import android.os.SystemClock
import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.Crossfade
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import kotlinx.coroutines.delay
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeDown
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Tv
import com.music.raaga.data.connect.AndroidConnect
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.State
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.Player
import com.music.raaga.ui.components.MenuFrostDark
import com.music.raaga.ui.components.liveMenuFrost
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.rememberHaptics
import com.music.raaga.ui.icons.RaagaIcons
import com.music.raaga.ui.replay.year.BestParts
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.data.NerdStats
import com.music.raaga.data.listentogether.ListenTogether
import com.music.raaga.data.listentogether.PartyMember
import com.music.raaga.data.settings.TrackAnalysisState
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.settings.AudioQuality
import com.music.raaga.data.model.Song
import com.music.raaga.playback.AudioOutputStatus
import com.music.raaga.playback.AudioRouting
import com.music.raaga.playback.PlaybackPosition
import dev.chrisbanes.haze.HazeState
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

/**
 * How long the shuffle glyph ignores further taps after one lands.
 *
 * Toggling shuffle replaces the upcoming stretch of the live queue. A second
 * tap while that command is crossing the session boundary could otherwise ask
 * to undo work that has not landed yet. One tap is all a toggle can usefully
 * mean in that window, so the rest are dropped rather than queued behind it.
 */
private const val SHUFFLE_TAP_WINDOW_MS = 400L
/**
 * The same gate for AutoPlay, held longer because its work is heavier: the
 * toggle crosses to the playback service, tears down the in-flight suggestion
 * load, and then either strips AutoPlay's tracks out of the queue or goes back
 * to the network for a fresh set of them.
 */
private const val AUTOPLAY_TAP_WINDOW_MS = 700L

/**
 * "Playing from …", "Played by …" or the radio station — what the player is
 * playing *out of*, in the words the caption uses.
 */
@Composable
internal fun playbackOriginText(song: Song, playedBy: String?): String =
    playedBy?.let {
        stringResource(R.string.played_by, it)
    } ?: song.radioName?.let {
        stringResource(R.string.playing_radio, it)
    } ?: stringResource(
        R.string.playing_from,
        song.playbackSource ?: song.albumName ?: stringResource(R.string.queue),
    )

/**
 * The small caption naming what the player is playing out of — see
 * [playbackOriginText]. Tappable, back to that place.
 */
@Composable
internal fun PlaybackOriginCaption(
    text: String,
    rawName: String? = null,
    onClick: () -> Unit,
    textAlign: TextAlign,
    /** Inside the touch target, so it widens what a finger can hit. */
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    val textToCopy = rawName?.takeIf { it.isNotBlank() } ?: text
    val toastMsg = if (!rawName.isNullOrBlank()) {
        stringResource(R.string.copied_album_format, rawName)
    } else {
        stringResource(R.string.copied_to_clipboard, text)
    }
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall.copy(
            shadow = Shadow(
                color = Color.Black.copy(alpha = 0.55f),
                offset = Offset(0f, 1f),
                blurRadius = 4f,
            ),
        ),
        color = Color.White,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        textAlign = textAlign,
        modifier = modifier
            .copyOnLongPress(
                textToCopy = textToCopy,
                toastMessage = toastMsg,
                onClick = onClick
            )
            .padding(contentPadding),
    )
}

/**
 * The seek bar, with elapsed and remaining either side under it and
 * [centerLabel] — the quality badge — between them.
 */
/** How far [PlayerScrubber] draws its times above the slot they are laid out in. */
internal val SCRUBBER_LABEL_LIFT = 9.dp

@Composable
internal fun PlayerScrubber(
    /**
     * Where the handle is, read in here so the playhead's tick recomposes the
     * bar and its two times rather than the player the bar sits in.
     */
    shown: () -> Float,
    durationMs: Long,
    /** A version switch's wait, drawn along the bar — see [ThinSlider.loading]. */
    loading: Boolean,
    transitionWindow: ClosedFloatingPointRange<Float>?,
    onScrub: (Float) -> Unit,
    onScrubFinished: () -> Unit,
    centerLabel: @Composable BoxScope.() -> Unit = {},
) {
    val shown = shown()
    Column(Modifier.fillMaxWidth()) {
        val ink = sliderInk()
        ThinSlider(
            value = shown,
            onValueChange = onScrub,
            onValueChangeFinished = onScrubFinished,
            loading = loading,
            transitionWindow = transitionWindow,
            vibrant = ink != null,
            activeColor = ink?.active ?: Color.White.copy(alpha = 0.92f),
            inactiveColor = ink?.inactive ?: Color.White.copy(alpha = 0.26f),
            markerColor = ink?.marker ?: Color.White.copy(alpha = 0.5f),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                // The slider's touch target extends well past the drawn bar,
                // so pull the labels back up under it.
                .offset(y = -SCRUBBER_LABEL_LIFT),
        ) {
            val chrome = LocalPlayerChrome.current
            val dodged = chrome && SCRUBBER_LABELS_DODGED
            val timeColor = if (dodged) brightRowInk() else chromeWhite(0.55f)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(if (dodged) Modifier.brightRowChrome(true) else Modifier.additiveChrome(chrome)),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = formatTime((shown * durationMs).toLong()),
                    style = MaterialTheme.typography.labelMedium,
                    color = timeColor,
                )
                Text(
                    text = "-" + formatTime(durationMs - (shown * durationMs).toLong()),
                    style = MaterialTheme.typography.labelMedium,
                    color = timeColor,
                )
            }
            // Pinned to the box's own centre rather than squeezed into the gap
            // between the two timestamps: that gap's width changes by a digit's
            // worth every time a minute rolls over.
            centerLabel()
        }
    }
}

/**
 * The quality badge between the timestamps — "Lossless", "Hi-Res", a loading
 * shimmer while a lossless source is still being looked for.
 */
@Composable
internal fun PlaybackQualityLabel(
    song: Song,
    isLoading: Boolean,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val wifiQuality by AppSettings.audioQualityWifi.collectAsStateWithLifecycle()
    val cellularQuality by AppSettings.audioQualityCellular.collectAsStateWithLifecycle()
    val metered by AppSettings.meteredConnection.collectAsStateWithLifecycle()
    val nerdStats by NerdStats.current.collectAsStateWithLifecycle()
    // Whether this playback session is even asking for a lossless stream — the
    // same computation SourceResolver.requestForNow() makes, mirrored here so
    // "Loading lossless" only appears when a lossless fetch is actually in
    // flight, not on every buffering YouTube track.
    val effectiveQuality = if (metered == true) cellularQuality else wifiQuality
    // Whether a module is still racing YouTube for this exact track — see
    // [NerdStats.racingLossless]. YouTube can win that race and already be
    // playing while the module lookup is still running detached, and the badge
    // should keep saying "loading" through that stretch rather than going
    // blank only to possibly say "loading" again a moment later.
    val racingLossless by NerdStats.racingLossless.collectAsStateWithLifecycle()
    LosslessOrStats(
        isLoading = isLoading,
        stillRacing = song.videoId in racingLossless,
        losslessRequested = effectiveQuality == AudioQuality.LOSSLESS,
        effectiveQuality = effectiveQuality,
        nerdStats = nerdStats,
        onClick = onClick,
        modifier = modifier,
    )
}

/**
 * The foot of the sleeve: stats for nerds while that setting is on, and under
 * them the Best Part button while there is one to offer. Either can be there
 * without the other; with neither, nothing is drawn.
 */
@Composable
internal fun SleeveNerdStats(
    song: Song,
    modifier: Modifier = Modifier,
    /** The button under the stats; nothing where the player offers none. */
    bestPart: @Composable () -> Unit = {},
) {
    val showNerdStats by AppSettings.showNerdStats.collectAsStateWithLifecycle()
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier,
    ) {
        if (showNerdStats) NerdStatsLines(song)
        bestPart()
    }
}

/**
 * Stats for nerds: the measured stream, and under it what Automix's analysis
 * is doing.
 */
@Composable
private fun NerdStatsLines(song: Song) {
    val context = LocalContext.current
    val nerdStats by NerdStats.current.collectAsStateWithLifecycle()
    val smartFadeOn by AppSettings.smartFadeEnabled.collectAsStateWithLifecycle()
    val smartAnalysis by AppSettings.smartAnalysis.collectAsStateWithLifecycle()
    // A party doesn't mix, and doesn't analyse for one either — see
    // [com.music.raaga.playback.CrossfadeController]. So the two flows above
    // simply stop moving there, and the stats line has to say why rather than
    // leave their last values on screen as if they still described something.
    //
    // Read off the party rather than published as a third flow: it is the same
    // fact the controller and the analyzer each read for themselves, and a
    // mirror of it could only ever disagree.
    val inParty by remember {
        ListenTogether.state.map { it.inParty }.distinctUntilChanged()
    }.collectAsStateWithLifecycle(initialValue = ListenTogether.state.value.inParty)
    // A plain white line reads fine over the usual dark tile, but a light
    // stretch of an animated cover — sky, snow, a pale sleeve — washes it out
    // entirely. The shadow costs nothing on a dark background and is what
    // keeps it legible on a bright one.
    val nerdStyle = MaterialTheme.typography.labelSmall.copy(
        shadow = Shadow(
            color = Color.Black.copy(alpha = 0.55f),
            offset = Offset(0f, 1f),
            blurRadius = 4f,
        ),
    )
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        nerdStats?.describe(context)?.let { stats ->
            Text(
                text = stats,
                style = nerdStyle,
                color = Color.White.copy(alpha = 0.65f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
        // Only when Automix is actually switched on: otherwise this would
        // report on analysis nothing is going to use, which is noise rather
        // than a stat.
        if (smartFadeOn) {
            Text(
                // Both sides always named, even when they agree, so the line
                // reads the same way every time and the eye can find the half
                // it wants without re-parsing the sentence.
                text = when {
                    // Ahead of the video case because it is the broader one:
                    // in a party nothing is analysed for any song, video or
                    // not, so naming the video limitation there would describe
                    // a rule that is not the one in force.
                    inParty -> stringResource(R.string.automix_stopped_in_party)
                    song.isVideoOrigin ->
                        stringResource(R.string.automix_not_supported_video)
                    else -> stringResource(
                        R.string.automix_analysis_status,
                        smartAnalysis.current.localizedLabel(),
                        smartAnalysis.next.localizedLabel(),
                    )
                },
                style = nerdStyle,
                // Dimmer than the measured line above it: that one describes
                // the audio, this one describes the app, and the ranking
                // should show.
                color = Color.White.copy(alpha = 0.5f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/**
 * "Best Part": a glass pill on the artwork that skips to the part of the song
 * people replay most, or failing that to its chorus.
 *
 * Offered only while it is still ahead: once the playhead has reached the best
 * part, by the button or by just listening, it goes for the rest of the track.
 * A track with no best part known (no replay curve, no synced lyrics to find a
 * chorus in) never shows it, rather than guessing.
 *
 * The same material as the ⋯ menu: its frost, blurring the player under it,
 * with a light rim to read as glass over the artwork.
 */
@Composable
internal fun BestPartPill(
    song: Song,
    position: PlaybackPosition,
    /** Blurred under the pill: the player's own haze. Null draws it flat. */
    hazeState: HazeState?,
    onSeek: (Long) -> Unit,
    modifier: Modifier = Modifier,
    /**
     * Whether a drawer or the ⋯ menu is up over the player. Those blur the
     * player live themselves, so the pill goes flat under them rather than
     * paying for a second live blur nobody can see.
     */
    overlayOpen: () -> Boolean = { false },
) {
    val enabled by AppSettings.showBestPart.collectAsStateWithLifecycle()
    if (!enabled) return
    val context = LocalContext.current
    val start by produceState<Long?>(null, song.videoId) {
        value = runCatching {
            val result = BestParts.startFor(context.applicationContext, song)
            if (result.source == com.music.raaga.ui.replay.year.BestPartStart.Source.FALLBACK) null else result.startMs
        }.getOrNull()
    }
    // Remembered per track: having been heard is what puts the button away.
    var heard by remember(song.videoId) { mutableStateOf(false) }
    val at = start
    // Read through derivedStateOf, so the pill recomposes as the playhead
    // crosses the best part, not on every tick of it.
    val ahead by remember(at, position) {
        derivedStateOf { at != null && position.positionMs < at - AHEAD_SLACK_MS }
    }
    val reaching by remember(at, position) {
        // Only a playhead inside the best part counts as hearing it. Further on
        // is a reading left over from the last track, or a skip past it, and
        // the button should come back for a seek to before it.
        derivedStateOf { at != null && position.positionMs in (at - AHEAD_SLACK_MS)..(at + HEARD_WINDOW_MS) }
    }
    LaunchedEffect(reaching) { if (reaching) heard = true }

    // Not while Automix is mixing into the next track: what is ahead then is
    // the next song, not this one's best part.
    val mixing by AppSettings.smartMixInProgress.collectAsStateWithLifecycle()

    val haptics = rememberHaptics()
    val reduceDynamicBlur by AppSettings.reduceDynamicBlur.collectAsStateWithLifecycle()
    val autoMixHold = rememberAutoMixFrostHold()
    AnimatedVisibility(
        visible = at != null && ahead && !heard && !mixing,
        // A fade either way. The room it takes opens and closes around the
        // fade, so the stats over it glide instead of jumping.
        enter = expandVertically(tween(BEST_PART_FADE_MS)) +
            fadeIn(tween(BEST_PART_FADE_MS, delayMillis = BEST_PART_FADE_MS / 2)),
        exit = fadeOut(tween(BEST_PART_FADE_MS)) +
            shrinkVertically(tween(BEST_PART_FADE_MS, delayMillis = BEST_PART_FADE_MS / 2)),
        modifier = modifier,
    ) {
        val shape = CircleShape
        val label = stringResource(R.string.best_part)
        val description = stringResource(R.string.best_part_description)
        val chrome = LocalPlayerChrome.current
        Box(
            modifier = Modifier
                .padding(top = 8.dp)
                .clip(shape)
                .glassFrost(hazeState, flat = reduceDynamicBlur || overlayOpen() || autoMixHold())
                .clickable(role = Role.Button) {
                    val target = at ?: return@clickable
                    haptics.play(Haptic.Tap)
                    heard = true
                    onSeek(target)
                }
                .semantics { contentDescription = description },
        ) {
            // The star and ⋯ discs' own fill over the frost, so the three
            // read as one material, then the rim over both.
            Box(
                Modifier
                    .matchParentSize()
                    .vibrantChrome(chrome)
                    .background(discFill(chrome)),
            )
            Box(Modifier.matchParentSize().glassRim(shape))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(start = 12.dp, end = 15.dp, top = 7.dp, bottom = 7.dp),
            ) {
                Icon(
                    imageVector = RaagaIcons.MusicNote,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(15.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.W700,
                    color = Color.White,
                    maxLines = 1,
                )
            }
        }
    }
}

/** Just short of the best part already counts as there, so the pill doesn't flash back on a late reading. */
private const val AHEAD_SLACK_MS = 400L

/** How far into the best part a playhead still counts as having heard it. */
private const val HEARD_WINDOW_MS = 20_000L

private const val BEST_PART_FADE_MS = 280

/** Thinner than the menu's slab, so the glass reads as glass over the artwork. */
private const val GLASS_SLAB_ALPHA = 0.38f

/** The slab alone, with no blur under it, thick enough to hold the glyph on any cover. */
private const val GLASS_FLAT_ALPHA = 0.72f

/** How much more of the ink [CircleGlyph]'s disc takes than its plain white — 0.45 at rest, 0.85 lit. */
private const val CIRCLE_DISC_DODGE_GAIN = 2.5f

/** The star and ⋯ discs' fill at rest. */
private const val CIRCLE_DISC_ALPHA = 0.18f

/**
 * The lyrics, output and queue glyphs, and the volume bar's speakers, dodged
 * harder than the rest of the chrome: a thin glyph shows far less of a blend
 * than a filled disc does, and at the usual strength they read as dim on any
 * cover that isn't already bright. More of the cover's own colour, not more
 * white. False puts them back as they were.
 */
private const val BOTTOM_ROW_BRIGHT = true

/**
 * The bottom row's ink: solid, and a lighter grey than [VibrantChromeInk] for
 * a dodge of about 3x rather than 2.5x. Short of the 3.4x that flattened
 * bright, saturated covers to one loud colour.
 */
private val BrightChromeInk = Color(0xFFAAAAAA)

/**
 * The timestamps and the quality badge between them dodged as the bottom row's
 * glyphs are, rather than added in white. False puts them back.
 */
private const val SCRUBBER_LABELS_DODGED = true

/** The volume bar's two speakers, drawn as the bottom row's glyphs are. */
@Composable
@ReadOnlyComposable
private fun brightRowInk(): Color = when {
    !BOTTOM_ROW_BRIGHT -> VibrantChromeInk
    LocalChromeSoftened.current -> SoftenedChromeInk
    else -> BrightChromeInk
}

/** [BrightChromeInk] a touch down, about 2.75x, for [LocalChromeSoftened]. */
private val SoftenedChromeInk = Color(0xFFA2A2A2)

private fun Modifier.brightRowChrome(chrome: Boolean): Modifier = vibrantChrome(chrome)

/**
 * The seek and volume bars dodged as the bottom row's glyphs are, rather than
 * laid over the cover in white. False puts them back.
 */
private const val SLIDERS_DODGED = true

/**
 * The bars' ink: a shade lighter than the bottom row's, for about 3.2x. A bar
 * is a thin line too, and at the glyphs' strength it read as dim.
 */
private val SliderChromeInk = Color(0xFFB0B0B0)

/** [SliderChromeInk] a touch down, about 2.9x, for [LocalChromeSoftened]. */
private val SoftenedSliderInk = Color(0xFFA8A8A8)

@Composable
@ReadOnlyComposable
private fun sliderChromeInk(): Color =
    if (LocalChromeSoftened.current) SoftenedSliderInk else SliderChromeInk

/** The unplayed track's share of [SliderChromeInk]. */
private const val SLIDER_TRACK_ALPHA = 0.6f

/** Played, unplayed and the Automix window, in the bars' ink. */
private data class SliderInk(val active: Color, val inactive: Color, val marker: Color)

/** Null where the bars are drawn as they always were. */
@Composable
private fun sliderInk(): SliderInk? =
    if (LocalPlayerChrome.current && SLIDERS_DODGED) {
        SliderInk(
            active = sliderChromeInk(),
            // Enough of the cover to read as track, well short of the played part.
            inactive = sliderChromeInk().copy(alpha = SLIDER_TRACK_ALPHA),
            marker = sliderChromeInk().copy(alpha = 0.75f),
        )
    } else {
        null
    }

/**
 * The star and ⋯ discs' fill at [alpha]: under the blend, the ink at a few
 * times that strength, since a dodge laid on this thinly is next to nothing.
 */
private fun discFill(chrome: Boolean, alpha: Float = CIRCLE_DISC_ALPHA): Color =
    if (chrome) {
        VibrantChromeInk.copy(alpha = (alpha * CIRCLE_DISC_DODGE_GAIN).coerceAtMost(1f))
    } else {
        Color.White.copy(alpha = alpha)
    }

/**
 * Glass's body: the ⋯ menu's frost, blurring the player live under a thin
 * charcoal slab. [flat] (dynamic blur reduced, or a drawer or the ⋯ menu up
 * over it, which blur the player live themselves) and a missing [hazeState]
 * draw the slab alone, thicker, and blur nothing.
 */
internal fun Modifier.glassFrost(hazeState: HazeState?, flat: Boolean): Modifier =
    if (flat || hazeState == null) {
        background(MenuFrostDark.copy(alpha = GLASS_FLAT_ALPHA))
    } else {
        liveMenuFrost(hazeState, MenuFrostDark, alpha = GLASS_SLAB_ALPHA)
    }

/**
 * The star and ⋯ discs beside the credits, behind one frost between them.
 *
 * One blur, cut to both circles, rather than one per disc: the two always move
 * together (a skip's slide, the collapse), and each would otherwise be blurred
 * again on every frame of it, side by side, from the same source.
 */
/**
 * Whether an AutoMix transition is armed or mixing. The glass goes flat for it, as it
 * does under a drawer: re-blurring a playing Canvas (and, while armed, a standby
 * decoder warming up behind it) every frame cost the GPU most of its frame budget
 * through the handover. Read in composition, but only changes at the phase edges.
 */
@Composable
internal fun rememberAutoMixFrostHold(): () -> Boolean {
    val visual = AutoMixVisualFeed.state.collectAsStateWithLifecycle()
    val hold = remember(visual) {
        derivedStateOf { visual.value?.let { it.mixActive || it.phase == AutoMixVisualPhase.ARMED } == true }
    }
    return { hold.value }
}

@Composable
internal fun GlassDiscPair(
    hazeState: HazeState?,
    /** See [BestPartPill]'s, which goes flat for the same reason. */
    overlayOpen: () -> Boolean,
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    val reduceDynamicBlur by AppSettings.reduceDynamicBlur.collectAsStateWithLifecycle()
    val autoMixHold = rememberAutoMixFrostHold()
    Box(modifier) {
        Box(
            Modifier
                .matchParentSize()
                .clip(DiscPairShape)
                .glassFrost(hazeState, flat = reduceDynamicBlur || overlayOpen() || autoMixHold()),
        )
        Row(verticalAlignment = Alignment.CenterVertically, content = content)
    }
}

/**
 * A disc at each end of a row as tall as one: both glyphs, or the ⋯ alone
 * (a row no wider than it is tall) for a guest, who gets no star.
 */
private val DiscPairShape = GenericShape { size, _ ->
    val d = size.height
    addOval(Rect(0f, 0f, d, d))
    if (size.width >= d * 1.5f) addOval(Rect(size.width - d, 0f, size.width, d))
}

/**
 * Glass's edge: a hairline rim, brighter along the top where the light would
 * catch it. One rim for the Best Part pill and the star and ⋯ discs, so they
 * read as the same material.
 */
internal fun Modifier.glassRim(shape: Shape): Modifier = border(
    width = 1.dp,
    brush = Brush.verticalGradient(
        0f to Color.White.copy(alpha = 0.42f),
        1f to Color.White.copy(alpha = 0.14f),
    ),
    shape = shape,
)

private val PLAYER_PRESS_CIRCLE_DIAMETER = 60.dp

/**
 * Previous, play/pause, next.
 *
 * [compact] is the landscape player on a phone, where the portrait player's
 * 100dp play target is a third of the window's height on its own.
 */
@Composable
internal fun TransportRow(
    isPlaying: Boolean,
    /** While the stream resolves and buffers, the play glyph would be a lie. */
    isLoading: Boolean,
    /**
     * Lit whenever back has something to do — a track to step to, or enough
     * elapsed to restart this one. Faded and inert, not removed, while a party
     * host holds the controls: the transport keeps its shape either way.
     */
    previousEnabled: Boolean,
    nextEnabled: Boolean,
    onPrevious: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    compact: Boolean = false,
    animationsActive: Boolean = true,
) {
    val playSize = if (compact) 58.dp else 74.dp
    val playTouch = if (compact) 76.dp else 92.dp
    val skipSize = if (compact) 44.dp else PLAYER_SKIP_ICON_SIZE
    val reduceAnimation by AppSettings.reduceAnimation.collectAsStateWithLifecycle()
    val previousMotion = rememberPlayerSkipMotion(active = animationsActive, reduceMotion = reduceAnimation)
    val nextMotion = rememberPlayerSkipMotion(active = animationsActive, reduceMotion = reduceAnimation)
    val playPauseMotion = rememberExpandedPlayPauseMotion(
        isPlaying = isPlaying,
        active = animationsActive && !isLoading,
        reduceMotion = reduceAnimation,
    )
    Row(
        modifier = Modifier.fillMaxWidth(),
        // SpaceAround, not SpaceEvenly: the outer margins take half a gap, so
        // the three buttons spread a little further apart from each other.
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TransportGlyph(
            icon = R.drawable.ic_player_previous,
            contentDescription = stringResource(R.string.widget_previous),
            size = skipSize,
            touchSize = PLAYER_SKIP_TOUCH_SIZE,
            heightScale = PLAYER_SKIP_HEIGHT_SCALE,
            onClick = onPrevious,
            enabled = previousEnabled,
            haptic = Haptic.SkipPrevious,
            skipMotion = previousMotion,
            skipPrevious = true,
        )
        // Crossfade between the spinner and the play/pause glyph so the
        // transition is always a gentle alpha blend rather than a hard swap.
        // Combined with the debounced isLoading from rememberDebouncedLoading,
        // Add-on / quality-upgrade stream swaps produce zero visible blink.
        AnimatedContent(
            targetState = isLoading,
            transitionSpec = {
                fadeIn(tween(200)) togetherWith fadeOut(tween(200))
            },
            label = "playPauseOrSpinner",
            modifier = Modifier.size(playTouch),
            contentAlignment = Alignment.Center,
        ) { loading ->
            if (loading) {
                // Keep the same footprint as the play/pause target so siblings
                // don't shift when the spinner appears.
                Box(Modifier.size(playTouch), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 3.dp,
                        modifier = Modifier.size(if (compact) 30.dp else 38.dp),
                    )
                }
            } else {
                TransportGlyph(
                    icon = if (isPlaying) R.drawable.ic_player_pause else R.drawable.ic_player_play,
                    contentDescription = stringResource(if (isPlaying) R.string.pause else R.string.play),
                    size = playSize,
                    touchSize = playTouch,
                    onClick = onPlayPause,
                    haptic = if (isPlaying) Haptic.Pause else Haptic.Resume,
                    playPauseMotion = playPauseMotion,
                )
            }
        }
        TransportGlyph(
            icon = R.drawable.ic_player_next,
            contentDescription = stringResource(R.string.widget_next),
            size = skipSize,
            touchSize = PLAYER_SKIP_TOUCH_SIZE,
            heightScale = PLAYER_SKIP_HEIGHT_SCALE,
            onClick = onNext,
            enabled = nextEnabled,
            haptic = Haptic.SkipNext,
            skipMotion = nextMotion,
        )
    }
}

/** ThinSlider's fixed touch target at the volume bar's size: 10dp + 22dp. */
internal val VOLUME_ROW_HEIGHT = 32.dp

/** The volume bar between its two speaker glyphs. */
@Composable
internal fun VolumeRow(
    /**
     * Read inside the row, so the level's tween recomposes the row alone rather
     * than the whole player around it.
     */
    value: () -> Float,
    onValueChange: (Float) -> Unit,
    onValueChangeFinished: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .onMouseWheelVolume { delta ->
                val newVol = (value() + delta).coerceIn(0f, 1f)
                onValueChange(newVol)
                onValueChangeFinished()
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val chrome = LocalPlayerChrome.current
        Icon(
            Icons.AutoMirrored.Rounded.VolumeDown,
            contentDescription = null,
            tint = if (chrome) brightRowInk() else chromeWhite(0.5f),
            modifier = Modifier.size(20.dp).brightRowChrome(chrome),
        )
        Spacer(Modifier.width(10.dp))
        val ink = sliderInk()
        ThinSlider(
            value = value(),
            onValueChange = onValueChange,
            onValueChangeFinished = onValueChangeFinished,
            idleHeight = 6.dp,
            activeHeight = 10.dp,
            modifier = Modifier.weight(1f),
            vibrant = ink != null,
            activeColor = ink?.active ?: Color.White.copy(alpha = 0.92f),
            inactiveColor = ink?.inactive ?: Color.White.copy(alpha = 0.26f),
        )
        Spacer(Modifier.width(10.dp))
        Icon(
            Icons.AutoMirrored.Rounded.VolumeUp,
            contentDescription = null,
            tint = if (chrome) brightRowInk() else chromeWhite(0.5f),
            modifier = Modifier.size(20.dp).brightRowChrome(chrome),
        )
    }
}

/**
 * Lyrics, the capsule, and the queue — the row both layouts end on.
 *
 * Lyrics and queue are the two things that are true of the player in every
 * state, so they are simply always here. Only the capsule between them swaps:
 * output and party normally, the three playback modes while the queue is up,
 * since that is when they are what you are about to reach for.
 */
@Composable
internal fun PlayerActionRow(
    lyricsOpen: Boolean,
    queueOpen: Boolean,
    shuffleEnabled: Boolean,
    repeatMode: Int,
    autoplayEnabled: Boolean,
    onToggleLyrics: () -> Unit,
    onToggleQueue: () -> Unit,
    onToggleShuffle: () -> Unit,
    onCycleRepeat: () -> Unit,
    onToggleAutoplay: () -> Unit,
    onOpenOutput: () -> Unit,
    onListenTogether: () -> Unit,
    /** Opens [ListenTogetherMembersSheet] rather than settings directly. */
    onOpenListenTogetherMembers: () -> Unit,
) {
    val showPartyButton by AppSettings.showListenTogetherButton.collectAsStateWithLifecycle()
    val inParty = rememberPartyBadge().inParty
    // Just the output glyph in the middle when Listen Together is hidden
    val compact = !queueOpen && !showPartyButton && !inParty
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val edgeInset = ((maxWidth - BOTTOM_ACTION_SIZE * 2 - pillWidth(3)) / 4).coerceAtLeast(0.dp)
        val compactInset = ((maxWidth - BOTTOM_ACTION_SIZE * 2 - pillWidth(2)) / 4).coerceAtLeast(0.dp)
        val closeIn = compactInset - edgeInset
        val compactness = animateFloatAsState(
            targetValue = if (compact) 1f else 0f,
            animationSpec = tween(220),
            label = "actionRowCompact",
        )
        Box(
            modifier = Modifier.fillMaxWidth().padding(horizontal = edgeInset),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .align(Alignment.CenterStart)
                    .offset { IntOffset((closeIn.toPx() * compactness.value).roundToInt(), 0) },
            ) {
                BottomGlyph(
                    icon = RaagaIcons.LyricsQuote,
                    contentDescription = stringResource(if (lyricsOpen) R.string.close_lyrics else R.string.open_lyrics),
                    onClick = onToggleLyrics,
                    highlighted = lyricsOpen,
                )
            }
            AnimatedContent(
                targetState = queueOpen,
                transitionSpec = {
                    (fadeIn(tween(180, delayMillis = 140)) togetherWith fadeOut(tween(140)))
                        .using(SizeTransform(clip = false) { _, _ -> tween(220) })
                },
                label = "playerBottomPill",
            ) { showQueueModes ->
                if (showQueueModes) {
                    Pill {
                        PillSegment(
                            icon = RaagaIcons.Shuffle,
                            contentDescription = stringResource(
                                if (shuffleEnabled) R.string.shuffle_on else R.string.shuffle_off,
                            ),
                            onClick = onToggleShuffle,
                            highlighted = shuffleEnabled,
                            haptic = if (shuffleEnabled) Haptic.ToggleOff else Haptic.ToggleOn,
                            tapWindowMs = SHUFFLE_TAP_WINDOW_MS,
                            width = PILL_SEGMENT_WIDTH_TRIPLE,
                        vibrant = true,
                        )
                        PillDivider()
                        PillSegment(
                            icon = if (repeatMode == Player.REPEAT_MODE_ONE) null else RaagaIcons.Repeat,
                            label = if (repeatMode == Player.REPEAT_MODE_ONE) "1" else null,
                            contentDescription = when (repeatMode) {
                                Player.REPEAT_MODE_ONE -> stringResource(R.string.repeat_one)
                                Player.REPEAT_MODE_ALL -> stringResource(R.string.repeat_all)
                                else -> stringResource(R.string.repeat_off)
                            },
                            onClick = onCycleRepeat,
                            highlighted = repeatMode != Player.REPEAT_MODE_OFF,
                            haptic = when (repeatMode) {
                                Player.REPEAT_MODE_OFF -> Haptic.ToggleOn
                                Player.REPEAT_MODE_ONE -> Haptic.ToggleOff
                                else -> Haptic.Select
                            },
                            width = PILL_SEGMENT_WIDTH_TRIPLE,
                        vibrant = true,
                        )
                        PillDivider()
                        PillSegment(
                            icon = RaagaIcons.Infinity,
                            contentDescription = stringResource(
                                if (autoplayEnabled) R.string.autoplay_on else R.string.autoplay_off,
                            ),
                            onClick = onToggleAutoplay,
                            highlighted = autoplayEnabled,
                            haptic = if (autoplayEnabled) Haptic.ToggleOff else Haptic.ToggleOn,
                            tapWindowMs = AUTOPLAY_TAP_WINDOW_MS,
                            width = PILL_SEGMENT_WIDTH_TRIPLE,
                        vibrant = true,
                        )
                    }
                } else {
                    OutputPartyPill(
                        onOutput = onOpenOutput,
                        onParty = onListenTogether,
                        onOpenMembers = onOpenListenTogetherMembers,
                    )
                }
            }
            Box(
                Modifier
                    .align(Alignment.CenterEnd)
                    .offset { IntOffset((-closeIn.toPx() * compactness.value).roundToInt(), 0) },
            ) {
                BottomGlyph(
                    icon = RaagaIcons.Queue,
                    contentDescription = stringResource(R.string.up_next),
                    onClick = onToggleQueue,
                    highlighted = queueOpen,
                    haptic = if (queueOpen) Haptic.Tap else Haptic.Expand,
                )
            }
        }
    }
}

/**
 * Translucent circular button used for the track menu and the like control.
 *
 * [active] brightens the disc rather than only the glyph: this sits on album
 * artwork of any colour, and a white icon on a white-ish sleeve has no tint
 * change left to make. The filled heart carries the state as a shape too —
 * see [RaagaIcons.HeartFilled].
 */
@Composable
internal fun CircleGlyph(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    active: Boolean = false,
    haptic: Haptic = Haptic.Tap,
) {
    val haptics = rememberHaptics()
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val pressScale by animateFloatAsState(
        targetValue = if (isPressed) 0.90f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioNoBouncy,
            stiffness = Spring.StiffnessMediumLow,
        ),
        label = "circleGlyphPressScale",
    )
    val discAlpha by animateFloatAsState(
        targetValue = if (active) 0.34f else CIRCLE_DISC_ALPHA,
        label = "glyphDisc",
    )
    val chrome = LocalPlayerChrome.current
    Box(
        modifier = Modifier
            .size(34.dp)
            .graphicsLayer {
                scaleX = pressScale
                scaleY = pressScale
            }
            .clip(CircleShape)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
            ) {
                haptics.play(haptic)
                onClick()
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .matchParentSize()
                .vibrantChrome(chrome)
                .background(discFill(chrome, discAlpha)),
        )
        // Outside the blend: the rim is light catching the edge, not ink.
        Box(Modifier.matchParentSize().glassRim(CircleShape))
        Crossfade(
            targetState = icon,
            animationSpec = tween(durationMillis = 180),
            label = "playerMenuGlyph",
        ) { glyph ->
            Icon(
                imageVector = glyph,
                contentDescription = contentDescription,
                tint = Color.White,
                modifier = Modifier.size(19.dp),
            )
        }
    }
}

/**
 * Transport / bottom glyphs. The circular clip belongs on the touch target,
 * never on the [Icon] — clipping the icon itself shaves the corners off wide
 * glyphs like fast-forward and the queue list.
 */
@Composable
private fun TransportGlyph(
    @DrawableRes icon: Int,
    contentDescription: String,
    size: androidx.compose.ui.unit.Dp,
    touchSize: androidx.compose.ui.unit.Dp = size,
    onClick: () -> Unit,
    enabled: Boolean = true,
    haptic: Haptic = Haptic.Tap,
    /** Vertical squash of the glyph alone; its width and touch box are untouched. */
    heightScale: Float = 1f,
    skipMotion: PlayerSkipMotion? = null,
    skipPrevious: Boolean = false,
    playPauseMotion: ExpandedPlayPauseMotion? = null,
) {
    val haptics = rememberHaptics()
    val interactionSource = remember { MutableInteractionSource() }
    // Faded rather than hidden: the row keeps its shape at the ends of a queue.
    val alpha by animateFloatAsState(
        targetValue = if (enabled) 1f else 0.3f,
        label = "transportAlpha",
    )
    Box(
        modifier = Modifier
            .size(touchSize)
            .then(
                if (skipMotion != null) Modifier.playerSkipPressCircle(
                    motion = skipMotion,
                    interactionSource = interactionSource,
                    enabled = enabled,
                    tint = Color.White.copy(alpha = alpha),
                    glyphSize = size,
                    diameter = PLAYER_PRESS_CIRCLE_DIAMETER,
                ) else if (playPauseMotion != null) Modifier.expandedPlayPausePressCircle(
                    motion = playPauseMotion,
                    interactionSource = interactionSource,
                    tint = Color.White.copy(alpha = alpha),
                    glyphSize = size,
                    diameter = PLAYER_PRESS_CIRCLE_DIAMETER,
                ) else Modifier,
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
            ) {
                haptics.play(haptic)
                skipMotion?.onTap()
                playPauseMotion?.onTap()
                onClick()
            },
        contentAlignment = Alignment.Center,
    ) {
        if (skipMotion != null) {
            PlayerSkipGlyph(
                motion = skipMotion,
                contentDescription = contentDescription,
                tint = Color.White.copy(alpha = alpha),
                modifier = Modifier
                    .size(size)
                    .then(if (heightScale != 1f) Modifier.graphicsLayer { scaleY = heightScale } else Modifier),
                previous = skipPrevious,
            )
        } else if (playPauseMotion != null) {
            ExpandedPlayPauseGlyph(
                motion = playPauseMotion,
                interactionSource = interactionSource,
                playPainter = painterResource(R.drawable.ic_player_play),
                pausePainter = painterResource(R.drawable.ic_player_pause),
                contentDescription = contentDescription,
                tint = Color.White.copy(alpha = alpha),
                modifier = Modifier.size(size),
            )
        } else {
            Icon(
                painter = painterResource(icon),
                contentDescription = contentDescription,
                tint = Color.White.copy(alpha = alpha),
                modifier = Modifier
                    .size(size)
                    .then(if (heightScale != 1f) Modifier.graphicsLayer { scaleY = heightScale } else Modifier),
            )
        }
    }
}

/** The skip glyphs' width, and their touch box, beside the larger play button. */
private val PLAYER_SKIP_ICON_SIZE = 53.dp
private val PLAYER_SKIP_TOUCH_SIZE = 53.dp

/**
 * The skip glyphs are drawn a little flatter than they are wide, so the pair
 * reads lower and longer next to the play button without losing any width.
 */
private const val PLAYER_SKIP_HEIGHT_SCALE = 0.85f

private val BOTTOM_ACTION_SIZE = 44.dp
private val BOTTOM_ACTIVE_TILE_SIZE = 35.dp
private val BOTTOM_ACTIVE_TILE_CORNER = 7.dp
private const val BOTTOM_ACTIVE_TILE_ALPHA = 0.62f

/**
 * One half of the output capsule — wider than it is tall, so the capsule reads
 * as a capsule rather than as two circles that have been pushed together.
 */
// The count reserve is kept on both halves, so entering a party never makes
// the capsule lopsided or shifts the queue control beside it.
private val PILL_SEGMENT_WIDTH = 64.dp

/**
 * Segment width for the Shuffle/Repeat/Autoplay capsule, which is always
 * three icons: the two-up spacing left each glyph with room the eye read as
 * empty even at two, and a third icon at the same width just multiplied that
 * empty space instead of tightening it.
 */
private val PILL_SEGMENT_WIDTH_TRIPLE = 52.dp

/**
 * Optical sizes, not equal ones.
 *
 * Headphones is a tall, narrow glyph and Person a taller, narrower one, so
 * drawn at the same nominal size the second reads as the bigger of the two.
 * These are the numbers at which they look like a matched pair.
 */
private val PILL_HEADPHONES_SIZE = 23.dp
private val PILL_PARTY_SIZE = 22.dp

/**
 * AirPlay fills its whole box, where the Material glyphs either side leave a
 * margin in theirs, so it is drawn smaller to stand the same height.
 */
private val PILL_OUTPUT_AIRPLAY_SIZE = 19.5.dp
private val PILL_OUTPUT_WIDE_SIZE = 21.dp

/** What a segment's glyph is drawn at when it has no optical quirk to correct. */
private val PILL_ICON_SIZE = 24.dp

/** How wide a capsule of [segments] comes out, dividers included. */
private fun pillWidth(segments: Int): Dp =
    PILL_SEGMENT_WIDTH * segments + 1.dp * (segments - 1)

/**
 * A row of controls joined into one capsule.
 *
 * The join is a hairline rather than a gap, which is what makes several
 * controls read as a single object — the shape the player uses for a set of
 * choices that all answer the same question. There are two: where the sound is
 * going, and how the queue is played.
 */
@Composable
private fun Pill(
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    val liquidGlassBackground = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.20f),
                Color.White.copy(alpha = 0.08f),
                Color.White.copy(alpha = 0.14f),
            ),
        )
    }
    val liquidGlassBorder = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.40f),
                Color.White.copy(alpha = 0.12f),
                Color.White.copy(alpha = 0.25f),
            ),
        )
    }

    Row(
        modifier = modifier
            .height(BOTTOM_ACTION_SIZE)
            .clip(CircleShape)
            .background(liquidGlassBackground)
            .border(
                width = 1.dp,
                brush = liquidGlassBorder,
                shape = CircleShape,
            )
            .animateContentSize(
                animationSpec = spring(
                    dampingRatio = 0.82f,
                    stiffness = Spring.StiffnessMediumLow,
                ),
            ),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun PillDivider() {
    val dividerBrush = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color.White.copy(alpha = 0.04f),
                Color.White.copy(alpha = 0.28f),
                Color.White.copy(alpha = 0.04f),
            ),
        )
    }
    Box(
        Modifier
            .width(1.dp)
            .fillMaxHeight(0.55f)
            .background(dividerBrush, shape = CircleShape),
    )
}

/**
 * The two ends of "where is this playing": the output capsule.
 *
 * Both halves answer the same question and so belong to one control rather than
 * two glyphs that happen to sit side by side — headphones for which speaker the
 * sound leaves by, the party for which *people* it reaches.
 *
 * Video vs audio-only used to live here as a third segment; it now lives in
 * the player's own three-dot menu, beside Revert to original and Upgrade
 * quality — the same kind of choice, offered the same way. This capsule is
 * back to the two icons it always otherwise had, at their original spacing.
 */
@Composable
private fun OutputPartyPill(
    onOutput: () -> Unit,
    onParty: () -> Unit,
    /** Who's in it, before the settings page — see [ListenTogetherMembersSheet]. */
    onOpenMembers: () -> Unit,
) {
    val badge = rememberPartyBadge()
    val shown by AppSettings.showListenTogetherButton.collectAsStateWithLifecycle()
    val outputStatus by AudioOutputStatus.current.collectAsStateWithLifecycle()
    val (outputIcon, outputIconSize) = when (outputStatus.routeKind) {
        AudioRouting.Kind.PHONE -> RaagaIcons.AirPlay to PILL_OUTPUT_AIRPLAY_SIZE
        AudioRouting.Kind.HDMI -> Icons.Rounded.Tv to PILL_OUTPUT_WIDE_SIZE
        else -> Icons.Rounded.Headphones to PILL_HEADPHONES_SIZE
    }
    if (!shown && !badge.inParty) {
        BottomGlyph(
            icon = outputIcon,
            iconSize = outputIconSize,
            contentDescription = stringResource(R.string.audio_output),
            onClick = onOutput,
        )
        return
    }
    Pill {
        PillSegment(
            icon = outputIcon,
            iconSize = outputIconSize,
            contentDescription = stringResource(R.string.audio_output),
            onClick = onOutput,
        )
        PillDivider()
        PillSegment(
            // Person rather than Groups: the three-person glyph is drawn half
            // the height of Headphones and wider than the segment holding it,
            // so the two halves of the capsule never looked like a pair.
            icon = Icons.Rounded.Person,
            iconSize = PILL_PARTY_SIZE,
            // The count is here and nowhere else: spoken, it is the whole
            // point of the control; drawn, it would cost the capsule its
            // symmetry for something the caption below already implies.
            contentDescription = if (badge.inParty) {
                stringResource(R.string.listen_together_open_count, badge.members)
            } else {
                stringResource(R.string.listen_together_open)
            },
            // Already in a party, this opens who's in it rather than the
            // settings page directly; there is nothing to create or join once
            // there is a party, so [onParty] only ever fires beforehand.
            onClick = if (badge.inParty) onOpenMembers else onParty,
            highlighted = badge.inParty,
            trailingLabel = badge.members.takeIf { badge.inParty }?.toString(),
        )
    }
}

/**
 * One control inside a [Pill] — [BottomGlyph]'s twin, squared off.
 *
 * Same behaviour down to the tap window, and deliberately not the same
 * composable: a glyph's highlight is a circle sized to itself, and a segment's
 * has to fill its share of the capsule edge to edge or the join stops reading
 * as one.
 */
@Composable
private fun PillSegment(
    contentDescription: String,
    onClick: () -> Unit,
    icon: ImageVector? = null,
    iconSize: Dp = PILL_ICON_SIZE,
    label: String? = null,
    trailingLabel: String? = null,
    highlighted: Boolean = false,
    haptic: Haptic = Haptic.Tap,
    loading: Boolean = false,
    /** See [BottomGlyph], where the same window means the same thing. */
    tapWindowMs: Long = 0L,
    /** Per-segment override — see [OutputPartyPill]'s three-up capsule. */
    width: Dp = PILL_SEGMENT_WIDTH,
    /** See [BottomGlyph], where the same flag means the same thing. */
    vibrant: Boolean = false,
) {
    val haptics = rememberHaptics()
    val lastTap = remember { mutableLongStateOf(-tapWindowMs) }
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val pressScale by animateFloatAsState(
        targetValue = if (isPressed && !loading) 0.92f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioNoBouncy,
            stiffness = Spring.StiffnessMediumLow,
        ),
        label = "pillSegmentPressScale",
    )
    val segmentBackground = remember(highlighted) {
        if (highlighted) {
            Brush.verticalGradient(
                colors = listOf(
                    Color.White.copy(alpha = 0.24f),
                    Color.White.copy(alpha = 0.12f),
                ),
            )
        } else {
            null
        }
    }
    Box(
        modifier = Modifier
            .width(width)
            .height(BOTTOM_ACTION_SIZE)
            .graphicsLayer {
                scaleX = pressScale
                scaleY = pressScale
            }
            .then(
                if (segmentBackground != null) {
                    Modifier.background(segmentBackground)
                } else {
                    Modifier
                }
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = !loading,
            ) {
                val now = SystemClock.uptimeMillis()
                if (now - lastTap.longValue >= tapWindowMs) {
                    lastTap.longValue = now
                    haptics.play(haptic)
                    onClick()
                }
            }
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        val chrome = LocalPlayerChrome.current
        val tint = when {
            vibrant && chrome -> brightRowInk()
            !highlighted -> chromeWhite(0.75f)
            chrome -> Color.White.copy(alpha = CHROME_FULL_ALPHA)
            else -> Color.White
        }
        Crossfade(
            targetState = loading,
            animationSpec = tween(durationMillis = 200),
            label = "pillSegmentLoading",
        ) { isLoading ->
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(17.dp),
                    color = Color.White,
                    strokeWidth = 2.dp,
                )
            } else if (icon != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Crossfade(
                        targetState = icon,
                        animationSpec = tween(durationMillis = 200),
                        label = "pillSegmentIcon",
                    ) { currentIcon ->
                        Icon(
                            imageVector = currentIcon,
                            contentDescription = null,
                            tint = tint,
                            modifier = Modifier.size(iconSize),
                        )
                    }
                    if (trailingLabel != null) {
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = trailingLabel,
                            color = tint,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            } else if (label != null) {
                Text(
                    text = label,
                    color = tint,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

/**
 * The line under the transport: normally the output, and the party's name
 * whenever there is one.
 *
 * A party overrides the output rather than sitting beside it because the two
 * are not the same kind of fact. "User's Phone" answers which speaker in
 * this room; once there are four devices playing the same song, the room is no
 * longer what the listener is checking. The tap follows the label — whichever
 * one is on screen is the thing it opens.
 */
@Composable
internal fun OutputCaption(
    accountName: String?,
    onOpenOutput: () -> Unit,
    /** Who's in it, before the settings page — see [ListenTogetherMembersSheet]. */
    onOpenMembers: () -> Unit,
) {


    val badge = rememberPartyBadge()
    val outputName = rememberAudioOutputName(accountName)
    val outputStatus by AudioOutputStatus.current.collectAsStateWithLifecycle()
    val nerdStats by NerdStats.current.collectAsStateWithLifecycle()
    // What the route is *capable* of, read off the negotiated AudioTrack —
    // the same figure the Audio Pipeline dialog states as fact, not what the
    // source merely claims.
    //
    // On its own this is a claim about the container, not about the music.
    // A float-capable route opens a float track for everything that plays
    // through it, so a 128kbps Opus scored exactly as high here as a studio
    // master and wore the same shine — which is what this used to do.
    val routeCarriesHiRes = when (outputStatus.actualEncoding) {
        AudioFormat.ENCODING_PCM_24BIT_PACKED,
        AudioFormat.ENCODING_PCM_32BIT,
        AudioFormat.ENCODING_PCM_FLOAT,
        -> true
        else -> (outputStatus.actualSampleRateHz ?: 0) > 48_000
    }
    // So the stream has to be worth the container. Measured on the decoder's
    // own format rather than the source's advertised rung — the same figures
    // the Hi-Res Lossless badge below the seek bar reads, and for the same
    // reason: confirmed, not advertised.
    //
    // Both halves, because either alone says something the shine does not
    // mean. A hi-res file on the built-in speaker is capped at 16-bit before
    // it leaves the app, and a lossy stream stays lossy however wide the
    // track under it is. The shine means the device is receiving this music
    // at the quality it was sent in.
    val streamIsHiRes = nerdStats?.isHiRes == true
    val isHiResOutput = streamIsHiRes && routeCarriesHiRes
    // The host's first name, exactly as the output line already shortens the
    // account's — "User's Jam" alongside "User's Phone".
    val jamName = badge.hostFirstName
        ?.let { stringResource(R.string.listen_together_jam, it) }
        ?: stringResource(R.string.listen_together_jam_unnamed)
    val captionModifier = Modifier
        .fillMaxWidth(0.65f)
        .clickable { if (badge.inParty) onOpenMembers() else onOpenOutput() }
    if (!badge.inParty && isHiResOutput) {
        ShimmerText(
            text = outputName,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            ),
            modifier = captionModifier,
        )
    } else {
        Text(
            text = if (badge.inParty) jamName else outputName,
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
            color = Color.White.copy(alpha = 0.55f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = captionModifier,
        )
    }
}

/** The three fields of a party the player draws — see [OutputPartyPill]. */
private data class PartyBadge(
    val inParty: Boolean,
    val members: Int,
    val hostFirstName: String?,
)

private fun ListenTogether.State.badge(): PartyBadge = PartyBadge(
    inParty = inParty,
    members = members.size,
    hostFirstName = members.firstOrNull(PartyMember::isHost)
        ?.displayName
        ?.trim()
        ?.split(Regex("\\s+"))
        ?.firstOrNull()
        ?.takeIf { it.isNotBlank() },
)

/**
 * Whether the host has taken control of the party this device is listening in.
 *
 * Same `distinctUntilChanged` treatment as [rememberPartyBadge], and for the
 * same reason: this answer changes about twice a party, while the state it is
 * read from is replaced every few seconds.
 *
 * @see ListenTogether.State.controlsLocked
 */
@Composable
internal fun rememberControlsLocked(): Boolean {
    val locked = remember {
        ListenTogether.state.map { it.controlsLocked }.distinctUntilChanged()
    }
    return locked
        .collectAsStateWithLifecycle(initialValue = ListenTogether.state.value.controlsLocked)
        .value
}

/**
 * [PartyBadge] as it changes, and only when it actually does.
 *
 * `distinctUntilChanged` is the point of this: the party's own state is
 * replaced on every heartbeat and every position report, none of which move any
 * of these three fields.
 */
@Composable
private fun rememberPartyBadge(): PartyBadge {
    val badges = remember {
        ListenTogether.state.map { it.badge() }.distinctUntilChanged()
    }
    return badges
        .collectAsStateWithLifecycle(initialValue = ListenTogether.state.value.badge())
        .value
}

private val BOTTOM_ICON_SIZE = 26.dp

@Composable
private fun BottomGlyph(
    icon: ImageVector?,
    contentDescription: String,
    onClick: () -> Unit,
    highlighted: Boolean = false,
    haptic: Haptic = Haptic.Tap,
    label: String? = null,
    iconSize: Dp = BOTTOM_ICON_SIZE,
    tapWindowMs: Long = 0L,
    vibrant: Boolean = false,
) {
    val haptics = rememberHaptics()
    val lastTap = remember { mutableLongStateOf(-tapWindowMs) }
    val tileChrome = LocalPlayerChrome.current
    // The lit tile dodged like the glyphs around it, so lyrics or the queue
    // being up reads in the cover's colour rather than as a white patch.
    val tileDodged = tileChrome && vibrant && BOTTOM_ROW_BRIGHT
    val tileColor = if (tileDodged) brightRowInk() else chromeWhite(BOTTOM_ACTIVE_TILE_ALPHA)
    Box(
        modifier = Modifier
            .size(BOTTOM_ACTION_SIZE)
            .then(
                if (highlighted) {
                    (
                        if (tileDodged) {
                            Modifier.vibrantChrome(true)
                        } else if (tileChrome) {
                            Modifier.additiveChrome(true)
                        } else {
                            Modifier.graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
                        }
                    )
                        .drawWithContent {
                            drawContent()
                            val side = BOTTOM_ACTIVE_TILE_SIZE.toPx()
                            val left = (size.width - side) / 2f
                            val top = (size.height - side) / 2f
                            drawRoundRect(
                                color = tileColor,
                                topLeft = Offset(left, top),
                                size = Size(side, side),
                                cornerRadius = CornerRadius(side / 2f, side / 2f),
                                blendMode = BlendMode.SrcOut,
                            )
                        }
                } else {
                    Modifier
                }
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) {
                val now = SystemClock.uptimeMillis()
                if (now - lastTap.longValue >= tapWindowMs) {
                    lastTap.longValue = now
                    haptics.play(haptic)
                    onClick()
                }
            }
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        val chrome = LocalPlayerChrome.current && !highlighted
        val tint = when {
            vibrant && chrome -> brightRowInk()
            highlighted -> Color.White
            else -> chromeWhite(0.75f)
        }
        val glyphChrome = if (vibrant) Modifier.vibrantChrome(chrome) else Modifier.additiveChrome(chrome)
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(iconSize).then(glyphChrome),
            )
        } else if (label != null) {
            Text(
                text = label,
                color = tint,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                modifier = glyphChrome,
            )
        }
    }
}

internal fun Modifier.opensPage(browseId: String?, onOpen: (String) -> Unit): Modifier =
    if (browseId == null) {
        this
    } else {
        clip(RoundedCornerShape(6.dp)).clickable { onOpen(browseId) }
    }

/** How fast the title/artist marquee crawls — unhurried, not a ticker. */
private const val MARQUEE_DP_PER_SEC = 26f

/** Clear air between the tail of the line and the copy chasing it round. */
private val MARQUEE_GAP = 48.dp

/** How long a line sits back at its start before the next pass — the "5 seconds" rest. */
private const val MARQUEE_REST_MS = 5_000L

/** Artist's head start is ceded to the title when both are scrolling, so they don't start as one block. */
internal const val MARQUEE_ARTIST_STAGGER_MS = 3_000L

/**
 * A single line of text that scrolls in place, only when it is too long for
 * [modifier]'s width to show in full.
 *
 * Idle text never animates — the scroll only kicks in once measurement proves
 * an ellipsis would otherwise be needed. When it does, the line is drawn twice
 * with [MARQUEE_GAP] between the copies and the pair is crawled leftwards by
 * exactly one copy-plus-gap: the trailing copy chases the leading one in from
 * the right and lands precisely where it started, so the offset reset at the
 * end of the pass falls under a copy already in position and cannot be seen.
 * The line therefore only ever travels one way — right to left, round and back
 * to its resting place — rather than bouncing back the way it came.
 *
 * A pass is: wait [startDelayMillis] (used to stagger the artist line behind
 * the title), crawl one full loop, then rest [MARQUEE_REST_MS] at the start
 * before going again. [onOverflowChange] reports whether this line is scrolling
 * at all, so a sibling line can decide whether it needs to stagger behind it.
 *
 * With [enabled] false the line is a plain ellipsised one — no copies, no
 * animation, nothing left running off screen.
 */
@Composable
internal fun MarqueeText(
    text: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    startDelayMillis: Long = 0L,
    leading: (@Composable () -> Unit)? = null,
    onOverflowChange: (Boolean) -> Unit = {},
) {
    val density = LocalDensity.current
    val textMeasurer = rememberTextMeasurer()
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(6.dp))
        }
        if (!enabled) {
            Text(
                text = text,
                style = style,
                color = color,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            return@Row
        }
        BoxWithConstraints(Modifier.weight(1f, fill = false).clipToBounds()) {
            val maxWidthPx = constraints.maxWidth
            val layout = remember(text, style, maxWidthPx) {
                textMeasurer.measure(text = text, style = style, maxLines = 1, softWrap = false)
            }
            val overflowing = layout.size.width > maxWidthPx
            LaunchedEffect(overflowing) { onOverflowChange(overflowing) }

            // One whole copy plus the gap behind it: that is the distance at
            // which the second copy is sitting exactly where the first was.
            val travelPx = if (overflowing) {
                layout.size.width + with(density) { MARQUEE_GAP.roundToPx() }
            } else {
                0
            }

            val offsetX = remember { Animatable(0f) }
            LaunchedEffect(text, travelPx, startDelayMillis) {
                offsetX.snapTo(0f)
                if (travelPx <= 0) return@LaunchedEffect
                val pxPerMs = with(density) { MARQUEE_DP_PER_SEC.dp.toPx() } / 1000f
                val scrollMs = (travelPx / pxPerMs).roundToInt().coerceAtLeast(400)
                delay(startDelayMillis)
                while (true) {
                    offsetX.animateTo(-travelPx.toFloat(), tween(scrollMs, easing = LinearEasing))
                    // Invisible: the trailing copy has arrived at the leading
                    // one's starting mark, so the line is already back where
                    // this puts it.
                    offsetX.snapTo(0f)
                    delay(MARQUEE_REST_MS)
                }
            }

            Row(
                // Measured unbounded so the copies actually lay out at their
                // full width, wider than the clipped box around them — bounded,
                // the text is truncated during its own measurement and sliding
                // it sideways just moves an already-cut string.
                modifier = Modifier
                    .wrapContentWidth(align = Alignment.Start, unbounded = true)
                    .offset { IntOffset(offsetX.value.roundToInt(), 0) },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MarqueeLine(text = text, style = style, color = color)
                if (overflowing) {
                    Spacer(Modifier.width(MARQUEE_GAP))
                    MarqueeLine(text = text, style = style, color = color)
                }
            }
        }
    }
}

/** One copy of a marquee's line, laid out at its full width rather than clipped. */
@Composable
private fun MarqueeLine(text: String, style: TextStyle, color: Color) {
    Text(
        text = text,
        style = style,
        color = color,
        maxLines = 1,
        softWrap = false,
        overflow = TextOverflow.Clip,
    )
}

/** The small "E" pill for explicit tracks, kept outside the scrolling text. */
@Composable
internal fun ExplicitBadge(color: Color) {
    Text(
        text = "E",
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = Modifier
            .border(1.dp, color.copy(alpha = 0.72f), RoundedCornerShape(2.dp))
            .padding(horizontal = 3.dp),
    )
}

/**
 * Measure a child wider than its slot by [gutter] on each side and place it back
 * over that margin, still reporting the original width to the parent.
 *
 * The lists are the only things in the player you can scroll, and the side
 * padding left a strip of bare sheet down each edge. A finger that drifted into
 * one scrolled nothing and closed the player instead. Matching content padding
 * puts every row back exactly where it was drawn, so this is invisible.
 */
internal fun Modifier.bleedHorizontally(gutter: Dp): Modifier = layout { measurable, constraints ->
    val extra = gutter.roundToPx() * 2
    val widened = if (constraints.hasBoundedWidth) {
        constraints.copy(
            minWidth = constraints.minWidth + extra,
            maxWidth = constraints.maxWidth + extra,
        )
    } else {
        constraints
    }
    val placeable = measurable.measure(widened)
    val width = (placeable.width - extra).coerceAtLeast(0)
    layout(width, placeable.height) {
        placeable.place(-(placeable.width - width) / 2, 0)
    }
}

private fun formatTime(ms: Long): String {
    if (ms <= 0) return "0:00"
    val minutes = TimeUnit.MILLISECONDS.toMinutes(ms)
    val seconds = TimeUnit.MILLISECONDS.toSeconds(ms) % 60
    return "%d:%02d".format(Locale.ROOT, minutes, seconds)
}

/**
 * The gap between the two timestamps under the seek bar: just the "Lossless"
 * badge when one applies, and nothing otherwise. The stats line that used to
 * fall back to lives inside the sleeve now (see the bottom-centre overlay on
 * the artwork Box above), so there is no tap here to swap it in — the two say
 * the same thing at different resolutions, both read off the stream being
 * decoded rather than off what a source offered to send.
 */
@Composable
private fun LosslessOrStats(
    isLoading: Boolean,
    stillRacing: Boolean,
    losslessRequested: Boolean,
    effectiveQuality: AudioQuality,
    nerdStats: NerdStats.Snapshot?,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    when {
        // Still resolving — either the player itself is buffering, or a
        // module is still racing YouTube for this track in the background
        // (see [NerdStats.racingLossless]) even though YouTube already won
        // and is audible. Either way nothing measured yet to confirm with,
        // so this is a statement of intent, not a result — no shimmer, so
        // it never reads as "confirmed" before it is.
        // [stillRacing] on its own, not gated on the lossless preference: a
        // module outranks YouTube on the strength of the source order alone,
        // so the lookup runs — and can come back lossless — with that switch
        // off. Gating this on it left the badge blank through the wait and
        // then jumped straight to "Hi-Res Lossless".
        // The [isLoading] half is gated on `nerdStats == null` rather than
        // `nerdStats?.isLossless != true`: `isLoading` is just
        // `STATE_BUFFERING`, which a seek trips for a track whose quality
        // question was already settled — swallowing back into cache still
        // rebuffers. Gating on `!= true` read that rebuffer as "resolving"
        // again and flashed "Upgrading Quality" over a track already known
        // to be, say, Hi-Quality with no lossless copy anywhere. Once
        // [nerdStats] exists there is something measured to show instead, so
        // only a genuinely unmeasured track — or a real race via
        // [stillRacing] — earns this label.
        (stillRacing && nerdStats?.isLossless != true) ||
            (isLoading && losslessRequested && nerdStats == null) -> LosslessLabel(
            // What is already true, ahead of what is still being looked for.
            // A race running over JioSaavn's 320kbps AAC and one running over
            // YouTube's 160kbps Opus were both drawn as a bare "Upgrading
            // Quality", which reads as "this is not good yet" — wrong on the
            // first, where the track is already at the top of what lossy gets
            // and the search is only chasing a lossless copy that may not
            // exist. Naming the floor first makes the label describe a track
            // rather than a wait.
            //
            // Decided on [NerdStats.Snapshot.isHiQuality] rather than on which
            // source won, for the reason that property already gives: a
            // 320kbps stream is a 320kbps stream wherever it came from. It is
            // read off the stream rather than off what the module offered, so
            // a JioSaavn AAC qualifies once its container has stated its rate;
            // YouTube's Opus sits under the threshold and keeps the plain
            // label it had.
            text = if (nerdStats?.isHiQuality == true) {
                stringResource(R.string.high_quality_upgrading)
            } else {
                stringResource(R.string.upgrading_quality)
            },
            animated = false,
            onClick = onClick,
            modifier = modifier,
        )
        nerdStats?.isLossless == true -> LosslessLabel(
            // Same line Tidal, Qobuz and Apple Music draw it at — see
            // [NerdStats.Snapshot.isHiRes].
            text = stringResource(if (nerdStats.isHiRes) R.string.hi_res_lossless else R.string.lossless),
            // Shimmer is reserved for the thing that was asked for and
            // confirmed. It is what makes the badge read as an achievement
            // rather than a label, which only one of these two is.
            animated = true,
            iconPainter = painterResource(R.drawable.ic_lossless),
            onClick = onClick,
            modifier = modifier,
        )
        nerdStats?.isDolbyAtmos == true -> LosslessLabel(
            text = "Dolby Atmos",
            animated = true,
            iconPainter = painterResource(R.drawable.ic_dolby_atmos),
            onClick = onClick,
            modifier = modifier,
        )
        // Lossy, but the good end of lossy — a module's 320kbps tier, which
        // for a great many tracks is the best copy that exists anywhere the
        // app can reach. See [NerdStats.Snapshot.isHiQuality].
        nerdStats?.isHiQuality == true -> LosslessLabel(
            text = stringResource(R.string.high_quality),
            animated = false,
            onClick = onClick,
            modifier = modifier,
        )
        effectiveQuality == AudioQuality.LOW && nerdStats?.isLowQuality == true -> LosslessLabel(
            text = stringResource(R.string.data_saver),
            animated = false,
            onClick = onClick,
            modifier = modifier,
        )
        effectiveQuality == AudioQuality.MEDIUM && nerdStats?.isMediumQuality == true -> LosslessLabel(
            text = stringResource(R.string.medium_quality),
            animated = false,
            onClick = onClick,
            modifier = modifier,
        )
        else -> {}
    }
}

/** A quality glyph ahead of the status label. */
@Composable
private fun LosslessLabel(
    text: String,
    animated: Boolean,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Rounded.Headphones,
    iconPainter: Painter? = null,
    onClick: (() -> Unit)? = null,
) {
    val clickModifier = if (onClick != null) {
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
    } else {
        Modifier
    }
    // Dodged like the timestamps either side, but not with the shimmer on:
    // its white highlight would dodge the cover straight to a flat glare.
    val chrome = LocalPlayerChrome.current
    val dodged = chrome && SCRUBBER_LABELS_DODGED && !animated
    Row(
        modifier = modifier
            .then(clickModifier)
            .then(if (dodged) Modifier.brightRowChrome(true) else Modifier.additiveChrome(chrome)),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val tint = if (dodged) brightRowInk() else chromeWhite(if (animated) 0.7f else 0.45f)
        if (iconPainter != null) {
            Icon(
                painter = iconPainter,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(width = 13.dp, height = 10.dp),
            )
        } else {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(13.dp),
            )
        }
        Spacer(Modifier.width(4.dp))
        if (animated) {
            ShimmerText(text = text)
        } else {
            Text(
                text = text,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontSize = (MaterialTheme.typography.labelMedium.fontSize.value + 1).sp,
                ),
                color = if (dodged) brightRowInk() else chromeWhite(0.45f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * "Lossless", with a highlight band sweeping left to right across it every
 * three seconds — confirmed, not just claimed, so it's worth the shine.
 *
 * The band's width is measured off the text itself via [onSizeChanged]
 * rather than assumed, so the sweep always clears the word fully at both
 * ends instead of being sized for whatever length happened to be typical.
 *
 * [style] and [baseAlpha] default to the quality badge's own look; the output
 * caption under the transport passes its own so the same sweep can run across
 * a differently-sized, centred line without the badge's styling leaking in.
 */
@Composable
private fun ShimmerText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.labelMedium.copy(
        fontWeight = FontWeight.SemiBold,
        fontSize = (MaterialTheme.typography.labelMedium.fontSize.value + 1).sp,
    ),
    baseAlpha: Float = 0.55f,
) {
    val transition = rememberInfiniteTransition(label = "lossless-shimmer")
    val progress = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 3_000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "lossless-shimmer-progress",
    )
    val baseColor = Color.White.copy(alpha = baseAlpha)
    // The glyphs are laid out and drawn once, in plain white, and the moving
    // band is painted over them in the draw phase with SrcIn — which keeps the
    // glyphs' coverage and takes the gradient's colour, the same pixels a
    // brush in the text style draws. As a brush the band was part of the
    // style, so every frame of the sweep recomposed the text for the whole
    // length of a lossless track.
    Text(
        text = text,
        style = style,
        color = Color.White,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                val width = size.width
                val band = width * 0.6f
                val center = -band + progress.value * (width + 2 * band)
                drawRect(
                    brush = Brush.linearGradient(
                        colorStops = arrayOf(0f to baseColor, 0.5f to Color.White, 1f to baseColor),
                        start = Offset(center - band, 0f),
                        end = Offset(center + band, 0f),
                    ),
                    blendMode = BlendMode.SrcIn,
                )
            },
    )
}

/**
 * "FLAC · 24-bit · 96.0 kHz · 4608 kbps · Stereo" — whichever of those the
 * player has actually reported. A figure it hasn't is dropped rather than
 * filled in, so a short line means little was known, never that something was
 * invented.
 *
 * Bitrate is stated for a lossless stream too, and is the rate its samples
 * decode to — 1411 for 16-bit/44.1kHz, 4608 for 24-bit/96kHz. It is the same
 * figure Tidal, Qobuz and Apple Music print next to a lossless track, and the
 * one a listener can carry from track to track; a FLAC's compressed rate
 * cannot, because it says more about how compressible that recording was than
 * about the copy being played.
 *
 * A stream that arrived worse than its source promised gets that stated
 * outright rather than left to be spotted — see [NerdStats.Snapshot.downgraded].
 */
private fun NerdStats.Snapshot.describe(context: android.content.Context): String? {
    val parts = buildList {
        codecLabel(mimeType)?.let(::add)
        bitDepth?.let { add(context.getString(R.string.bit_depth, it)) }
        sampleRateHz?.let { add("%.1f kHz".format(Locale.ROOT, it / 1000f)) }
        bitrateKbps?.let { add("$it kbps") }
        channels?.let {
            add(
                when (it) {
                    1 -> context.getString(R.string.mono)
                    2 -> context.getString(R.string.stereo)
                    else -> context.getString(R.string.channel_count, it)
                },
            )
        }
        if (downgraded) add(context.getString(R.string.downgraded_from, claimed?.summary.orEmpty()))
    }
    return parts.joinToString(" · ").takeIf { it.isNotEmpty() }
}

/** The codec under its usual name rather than its MIME type. */
private fun codecLabel(mimeType: String?): String? = when {
    mimeType == null -> null
    mimeType.endsWith("opus") -> "Opus"
    mimeType.endsWith("mp4a-latm") -> "AAC"
    mimeType.endsWith("vorbis") -> "Vorbis"
    mimeType.endsWith("mpeg") -> "MP3"
    mimeType.endsWith("flac") -> "FLAC"
    mimeType.endsWith("alac") -> "ALAC"
    else -> mimeType.substringAfter('/').uppercase(Locale.ROOT)
}

/** Wording for the stats line; see [TrackAnalysisState]. */
@Composable
private fun TrackAnalysisState.localizedLabel(): String = when (this) {
    TrackAnalysisState.ANALYSED -> stringResource(R.string.analysis_complete)
    TrackAnalysisState.REFINING -> stringResource(R.string.analysis_refining)
    TrackAnalysisState.ANALYSING -> stringResource(R.string.analysis_in_progress)
    TrackAnalysisState.WAITING -> stringResource(R.string.waiting)
    TrackAnalysisState.FAILED -> stringResource(R.string.failed)
}
