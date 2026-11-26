package com.music.raaga.ui.player

import android.content.Intent
import android.graphics.Bitmap
import androidx.annotation.StringRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.IosShare
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.vectorResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.canvas.CanvasRepository
import com.music.raaga.data.canvas.CanvasSource
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.ui.components.LiquidGlassSwitch
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.rememberHaptics
import com.music.raaga.ui.replay.ShareAction
import com.music.raaga.ui.replay.cacheForSharing
import com.music.raaga.ui.replay.saveToGallery
import com.music.raaga.ui.replay.sendIntent
import com.music.raaga.ui.screens.SegmentedControl
import dev.chrisbanes.haze.HazeState
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The picked lines, drawn, with the two things you can do to the picture.
 *
 * Built on [PlayerDrawer] rather than on a `ModalBottomSheet` for the same reason
 * as every other sheet in this package: it is inside the player, which is itself
 * already a modal sheet, and nesting the two leaves the inner one with nothing
 * to be modal over. It also means this drawer gets the player's own frosted
 * material, the drag-to-dismiss gesture and the scrim fade for free.
 */
@Composable
internal fun AndroidLyricsShareSheet(
    hazeState: HazeState,
    request: LyricsShareRequest,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val haptics = rememberHaptics()

    var image by remember(request) { mutableStateOf<Bitmap?>(null) }
    var failed by remember(request) { mutableStateOf(false) }
    var saved by remember(request) { mutableStateOf(false) }
    // The 9:16 story is what these are mostly made for, so it is where the
    // sheet opens; the card cut to its lines is one tap away.
    var story by remember(request) { mutableStateOf(true) }
    // Remembered across shares: someone who takes the mark off wants it off.
    val showLogo by AppSettings.lyricsCardLogo.collectAsStateWithLifecycle()

    // The song's animated covers, each offered as a background when it exists.
    // The player's own gradient is the default, and all there is until these
    // come back (or when neither does).
    var clips by remember(request) {
        mutableStateOf(
            CanvasRepository.cached(request.song)?.let { mapOf(it.source to it) }.orEmpty(),
        )
    }
    LaunchedEffect(request) {
        clips = clips + runCatching { CanvasRepository.shareClipsFor(request.song) }.getOrDefault(emptyMap())
    }
    var background by remember(request) { mutableStateOf(ShareBackground.GRADIENT) }
    // Video — the song, the words sweeping with it, on the gradient or a
    // Canvas — or Image: the still card, every line lit white. Image has no
    // background choice; the clip only exists in motion.
    var asVideo by remember(request) { mutableStateOf(true) }
    val clip = background.source?.takeIf { asVideo }?.let(clips::get)?.let { found ->
        // A story is 9:16: the 3:4 rendition crops to it with less thrown away.
        if (story) found.copy(url = found.portraitUrl ?: found.url) else found
    }
    // Synced lines carry where they are sung: the share becomes a video of
    // that stretch of the song, each line lighting up as the vocal reaches it.
    val timeline = remember(request) { shareTimeline(request.lines) }
    // Nothing would move in a video with no vocal to follow and no clip.
    val videoPossible = timeline != null || clips.isNotEmpty()
    val isVideo = asVideo && (clip != null || timeline != null)
    // Saving runs from the tap until the file is in the gallery: the export,
    // then the copy. "Saved!" only once both are done.
    var saving by remember(request) { mutableStateOf(false) }

    // The card laid out once and drawable at any moment of the song: the
    // preview runs it on the song's own clock, so what is shared is what was
    // seen. [image] is the still card, for the frame's shape and for a PNG.
    var painter by remember(request) { mutableStateOf<LyricsCardPainter?>(null) }
    LaunchedEffect(request, story, showLogo, background, asVideo) {
        image = null
        painter = null
        failed = false
        saved = false
        runCatching {
            val paint = lyricsCardPainter(context, request, story, showLogo, transparent = clip != null)
            image = withContext(Dispatchers.Default) { paint.render(null) }
            painter = paint
        }.onFailure {
            android.util.Log.e("LyricsShare", "renderLyricsShareCard failed", it)
            failed = true
        }
    }

    // One export per look, reused by Save and Share alike.
    var exporting by remember(request) { mutableStateOf(false) }
    var exported by remember(request) { mutableStateOf<Pair<Any, File>?>(null) }
    suspend fun videoFile(): File? {
        val look = listOf(clip, story, showLogo)
        exported?.takeIf { it.first == look && it.second.exists() }?.let { return it.second }
        exporting = true
        return try {
            // The export lays its own background — the clip, or the backdrop —
            // so the card it is handed is always the bare one.
            val overlay = lyricsCardPainter(context, request, story, showLogo, transparent = true)
            exportLyricsVideo(context, request, clip, overlay, portrait = story)
                ?.also { exported = look to it }
        } finally {
            exporting = false
        }
    }

    PlayerDrawer(
        hazeState = hazeState,
        title = stringResource(R.string.lyrics_share_title),
        onDismiss = onDismiss,
        modifier = modifier,
        titleGap = 2.dp,
        // Tall enough that Save and Share are on screen without a scroll.
        maxHeight = (LocalConfiguration.current.screenHeightDp * DRAWER_SCREEN_SHARE).dp,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.lyrics_share_description),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Start,
                modifier = Modifier.fillMaxWidth().padding(start = 4.dp),
            )

            SegmentedControl(
                options = listOf(
                    stringResource(R.string.lyrics_share_video),
                    stringResource(R.string.lyrics_share_image),
                ),
                selectedIndex = if (asVideo && videoPossible) 0 else 1,
                onSelect = {
                    haptics.play(Haptic.Tap)
                    asVideo = it == 0
                },
                disabled = if (videoPossible) emptySet() else setOf(0),
            )

            if (asVideo && videoPossible) {
                // Apple and Spotify are always shown, greyed out when the song
                // has none; the other providers' clip only when there is one.
                val choices = ShareBackground.entries.filter {
                    it != ShareBackground.OTHER || CanvasSource.OTHER in clips
                }
                SegmentedControl(
                    options = choices.map { stringResource(it.label) },
                    selectedIndex = choices.indexOf(background).coerceAtLeast(0),
                    onSelect = { background = choices[it] },
                    disabled = choices.withIndex()
                        .filter { (_, choice) -> choice.source != null && choice.source !in clips }
                        .mapTo(HashSet()) { it.index },
                )
            }

            val bitmap = image
            // The card is only as tall as its lines, so the frame follows it:
            // a strip comes out wide, a full verse narrow. Sized off the
            // screen's height so the whole drawer, actions and all, fits.
            val ratio = bitmap?.let { it.width.toFloat() / it.height } ?: (9f / 16f)
            val previewH = (LocalConfiguration.current.screenHeightDp * PREVIEW_SCREEN_SHARE).dp
            val preview = Modifier
                .fillMaxWidth(0.92f)
                .wrapContentWidth()
                .height(previewH)
                .aspectRatio(ratio, matchHeightConstraintsFirst = true)
                .clip(RoundedCornerShape(18.dp))
            if (bitmap == null) {
                Box(
                    modifier = preview
                        .background(Color.White.copy(alpha = 0.06f)),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(26.dp),
                        strokeWidth = 2.5.dp,
                        color = Color.White.copy(alpha = 0.75f),
                    )
                }
            } else if (clip != null) {
                // The clip live under the card, blurred and dimmed the way the
                // export draws it.
                Box(modifier = preview, contentAlignment = Alignment.Center) {
                    CanvasArtworkPlayer(
                        canvas = clip,
                        isPlaying = true,
                        modifier = Modifier.matchParentSize().blur(PREVIEW_BLUR),
                    )
                    // As dark as the export's: about the player's own backdrop.
                    Box(Modifier.matchParentSize().background(Color.Black.copy(alpha = CLIP_SCRIM)))
                    CardPreview(painter, bitmap, timeline.takeIf { isVideo }, Modifier.matchParentSize())
                    if (exporting) ExportSpinner()
                }
            } else {
                Box(modifier = preview, contentAlignment = Alignment.Center) {
                    CardPreview(painter, bitmap, timeline.takeIf { isVideo }, Modifier.matchParentSize())
                    if (exporting) ExportSpinner()
                }
            }

            // Opens as a story; this switches between the two shapes.
            ShareAction(
                label = stringResource(if (story) R.string.lyrics_share_story_revert else R.string.lyrics_share_story),
                icon = if (story) Icons.Rounded.Image else ImageVector.vectorResource(R.drawable.ic_instagram),
                accent = false,
                enabled = image != null,
                plainFill = PlainFill,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    haptics.play(Haptic.Tap)
                    story = !story
                },
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(PlainFill)
                    .toggleable(
                        value = showLogo,
                        role = Role.Switch,
                        onValueChange = {
                            haptics.play(Haptic.Tap)
                            AppSettings.setLyricsCardLogo(it)
                        },
                    )
                    .padding(start = 18.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.lyrics_share_show_logo),
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color.White,
                    modifier = Modifier.weight(1f),
                )
                // The row is the toggle; the switch only shows its state.
                LiquidGlassSwitch(checked = showLogo, onCheckedChange = null)
            }

            if (failed) {
                Text(
                    text = stringResource(R.string.couldnt_draw_picture),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                ShareAction(
                    label = stringResource(R.string.save),
                    icon = Icons.Rounded.Download,
                    accent = false,
                    enabled = image != null && !exporting && !saving,
                    plainFill = PlainFill,
                    modifier = Modifier.weight(1f),
                    saved = saved,
                    savedLabel = stringResource(R.string.saved_bang),
                    busy = saving,
                    busyLabel = stringResource(R.string.lyrics_share_saving),
                    onClick = {
                        val drawn = image
                        if (drawn != null) {
                            haptics.play(Haptic.Tap)
                            saved = false
                            saving = true
                            scope.launch {
                                val done = try {
                                    if (isVideo) {
                                        val video = videoFile()
                                        video != null && saveVideoToGallery(context, video, request.song.title)
                                    } else {
                                        saveToGallery(context, drawn, request.song.title, LYRICS_FILE_PREFIX)
                                    }
                                } finally {
                                    saving = false
                                }
                                if (!done) failed = true
                                saved = done
                            }
                        }
                    },
                )
                ShareAction(
                    label = stringResource(R.string.share),
                    icon = Icons.Rounded.IosShare,
                    accent = true,
                    enabled = image != null && !exporting && !saving,
                    modifier = Modifier.weight(1f),
                    onClick = {
                        val drawn = image
                        if (drawn != null) {
                            haptics.play(Haptic.Tap)
                            scope.launch {
                                val send = if (isVideo) {
                                    videoFile()?.let { shareVideoIntent(context, it) }
                                } else {
                                    cacheForSharing(context, drawn, LYRICS_FILE_NAME)?.let(::sendIntent)
                                }
                                if (send == null) {
                                    failed = true
                                    saved = false
                                } else {
                                    context.startActivity(
                                        Intent.createChooser(send, context.getString(R.string.share_your_lyrics)),
                                    )
                                }
                            }
                        }
                    },
                )
            }
        }
    }
}

private const val LYRICS_FILE_NAME = "lyrics.png"

private enum class ShareBackground(@param:StringRes val label: Int, val source: CanvasSource?) {
    GRADIENT(R.string.lyrics_share_gradient, null),
    APPLE(R.string.lyrics_share_apple_canvas, CanvasSource.APPLE),
    SPOTIFY(R.string.lyrics_share_spotify_canvas, CanvasSource.SPOTIFY),
    OTHER(R.string.lyrics_share_canvas, CanvasSource.OTHER),
}

@Composable
private fun ExportSpinner() {
    Box(
        modifier = Modifier
            .size(52.dp)
            .clip(RoundedCornerShape(26.dp))
            .background(Color.Black.copy(alpha = 0.35f)),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(26.dp),
            strokeWidth = 2.5.dp,
            color = Color.White.copy(alpha = 0.85f),
        )
    }
}

@Composable
private fun CardPreview(
    painter: LyricsCardPainter?,
    card: Bitmap,
    timeline: ShareTimeline?,
    modifier: Modifier,
) {
    val description = stringResource(R.string.your_lyrics_card)
    if (painter == null || timeline == null) {
        Image(bitmap = card.asImageBitmap(), contentDescription = description, modifier = modifier)
        return
    }
    var elapsedMs by remember(painter, timeline) { mutableLongStateOf(0L) }
    LaunchedEffect(painter, timeline) {
        val start = withFrameMillis { it }
        val length = (timeline.durationMs + PREVIEW_REST_MS).coerceAtLeast(1L)
        while (true) withFrameMillis { elapsedMs = (it - start) % length }
    }
    Canvas(modifier.semantics { contentDescription = description }) {
        val at = timeline.trackMsAt(elapsedMs * 1000)
        val scale = size.width / painter.width
        drawIntoCanvas { canvas ->
            val native = canvas.nativeCanvas
            native.save()
            native.scale(scale, scale)
            painter.drawOn(native, at)
            native.restore()
        }
    }
}

private const val DRAWER_SCREEN_SHARE = 0.92f
private const val PREVIEW_SCREEN_SHARE = 0.3f
private const val PREVIEW_REST_MS = 1_200L
private const val CLIP_SCRIM = 0.4f
private val PREVIEW_BLUR = 10.dp
private val PlainFill = Color.White.copy(alpha = 0.10f)
private const val LYRICS_FILE_PREFIX = "raaga-lyrics"
