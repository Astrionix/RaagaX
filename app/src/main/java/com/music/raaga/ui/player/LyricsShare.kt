package com.music.raaga.ui.player

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.IosShare
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.music.raaga.R
import com.music.raaga.data.lyrics.LyricLine
import com.music.raaga.data.model.Song
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.Haptics
import com.music.raaga.ui.haptics.rememberHaptics

/**
 * One picked passage, as the string that goes on the card.
 *
 * Held as text rather than as [LyricLine] because the card has no idea what a
 * line's timing is: it is handed what the reader was looking at, translation and
 * all, and nothing else.
 *
 * @property subText The romanization or translation drawn small underneath, or
 * null when the panel was showing the original alone.
 * @property isGap A stand-in for the lines skipped between two picked ones,
 * drawn as a centred ellipsis rather than as words.
 */
data class LyricsShareLine(
    val text: String,
    val subText: String?,
    val isGap: Boolean = false,
)

/**
 * Everything the platform's card renderer needs, gathered once by the player.
 *
 * The drawing itself is not here: it needs a bitmap and a canvas, which the
 * desktop has no answer for. The player builds one of these and hands it to
 * the lyrics share drawer, and the phone is what turns it into a picture.
 */
data class LyricsShareRequest(
    val song: Song,
    /** Resolved sleeve — remote URL or local file, whatever the player found. */
    val artworkUrl: String?,
    val lines: List<LyricsShareLine>,
)

/**
 * How much text one card is allowed to hold: the picked words, in characters.
 */
const val SHARE_CARD_CHAR_BUDGET = 250

/**
 * Whether a line of [text] can still join a card already holding [taken]
 * characters — the whole of the rule the player enforces at the pick.
 */
fun fitsOnCard(taken: Int, text: String?): Boolean =
    taken + (text?.length ?: 0) <= SHARE_CARD_CHAR_BUDGET

val lyricsShareAvailable: Boolean
    get() = true

/**
 * The pick mode: which lines are chosen, and what can be done with them.
 */
internal class LyricsPicker(
    val picking: Boolean,
    val picks: Set<Int>,
    val overBudget: Boolean,
    val pick: (Int) -> Unit,
    val toggle: (Int) -> Unit,
    val cancel: () -> Unit,
    val share: () -> Unit,
)

/**
 * The pick mode's state machine: the lines, what may be added to them, and the
 * card the chosen ones make.
 */
@Composable
internal fun rememberLyricsPicker(
    song: Song,
    lines: List<LyricLine>?,
    subLines: List<LyricLine>?,
    artworkUrl: String?,
    haptics: Haptics,
    onCard: (LyricsShareRequest) -> Unit,
): LyricsPicker {
    val context = LocalContext.current
    val cardFullMessage = stringResource(R.string.lyrics_share_pick_limit)

    var picking by remember { mutableStateOf(false) }
    var picks by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var overBudget by remember { mutableStateOf(false) }

    LaunchedEffect(song.videoId) {
        picking = false
        picks = emptySet()
        overBudget = false
    }

    val toggle: (Int) -> Unit = { index ->
        val line = lines?.getOrNull(index)
        val text = line?.text
        val count = picks.sumOf { lines?.getOrNull(it)?.text?.length ?: 0 }
        when {
            index in picks -> {
                haptics.play(Haptic.Tap)
                picks = picks - index
                overBudget = false
            }
            fitsOnCard(count, text) -> {
                haptics.play(Haptic.Select)
                picks = picks + index
                overBudget = false
            }
            else -> {
                overBudget = true
                Toast.makeText(context, cardFullMessage, Toast.LENGTH_SHORT).show()
            }
        }
    }

    val pick: (Int) -> Unit = { index ->
        haptics.play(Haptic.Select)
        if (!picking) {
            picking = true
            picks = setOf(index)
            overBudget = false
        } else {
            toggle(index)
        }
    }

    val cancel: () -> Unit = {
        picking = false
        picks = emptySet()
        overBudget = false
    }

    val share: () -> Unit = {
        val source = lines.orEmpty()
        val chosen = picks.sorted()
        val picked = buildList {
            chosen.forEachIndexed { position, index ->
                if (position > 0 && index > chosen[position - 1] + 1) {
                    add(LyricsShareLine(text = "", subText = null, isGap = true))
                }
                val line = source.getOrNull(index) ?: return@forEachIndexed
                val sub = subLines?.getOrNull(index)?.text
                add(
                    LyricsShareLine(
                        text = line.text,
                        subText = sub?.takeIf { it.isNotBlank() && it != line.text },
                    ),
                )
            }
        }.filter { it.isGap || it.text.isNotBlank() }
        if (picked.isNotEmpty()) {
            onCard(LyricsShareRequest(song = song, artworkUrl = artworkUrl, lines = picked))
        }
        cancel()
    }

    return LyricsPicker(
        picking = picking,
        picks = picks,
        overBudget = overBudget,
        pick = pick,
        toggle = toggle,
        cancel = cancel,
        share = share,
    )
}

@Composable
internal fun LyricsPickBar(
    shareEnabled: Boolean,
    onCancel: () -> Unit,
    onShare: () -> Unit,
    modifier: Modifier = Modifier,
    count: Int = 0,
) {
    val haptics = rememberHaptics()
    val shareText = if (count > 0) {
        "${stringResource(R.string.share)} ($count)"
    } else {
        stringResource(R.string.share)
    }
    Row(
        modifier = modifier
            .padding(horizontal = 16.dp, vertical = 12.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0xFF141414).copy(alpha = 0.95f))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PickAction(
            label = stringResource(R.string.cancel),
            icon = Icons.Rounded.Close,
            accent = false,
            enabled = true,
            modifier = Modifier.weight(1f),
            onClick = {
                haptics.play(Haptic.Tap)
                onCancel()
            },
        )
        PickAction(
            label = shareText,
            icon = Icons.Rounded.IosShare,
            accent = true,
            enabled = shareEnabled,
            modifier = Modifier.weight(1f),
            onClick = {
                haptics.play(Haptic.Select)
                onShare()
            },
        )
    }
}

@Composable
private fun RowScope.PickAction(
    label: String,
    icon: ImageVector,
    accent: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val background = if (accent) {
        Color.White.copy(alpha = if (enabled) 1f else 0.3f)
    } else {
        Color.White.copy(alpha = if (enabled) 0.10f else 0.05f)
    }
    val foreground = if (accent) {
        Color(0xFF121212).copy(alpha = if (enabled) 1f else 0.4f)
    } else {
        Color.White.copy(alpha = if (enabled) 0.85f else 0.4f)
    }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(background)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 15.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = foreground,
            modifier = Modifier.size(19.dp),
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.W700,
            color = foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
