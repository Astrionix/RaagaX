package com.music.raaga.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.navigationBarsPadding
import com.music.raaga.data.NerdStats
import com.music.raaga.data.model.ROW_ART_PX
import com.music.raaga.data.stats.ListeningStats
import java.util.Locale
import com.music.raaga.R
import com.music.raaga.data.SongInfo
import com.music.raaga.data.SongInfoRepository
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.compactCount
import com.music.raaga.data.model.Song
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.rememberHaptics
import com.music.raaga.ui.theme.ArtworkPalette
import kotlinx.coroutines.launch

private val INFO_BODY_MAX_HEIGHT = 360.dp

/**
 * Drawn as the same UIAlertController-style card as [AlertScaffold] - centred
 * title, hairline [AlertRule]s, full-width [AlertAction]s.
 */
@Composable
internal fun SongInfoDialog(song: Song, onDismiss: () -> Unit) {
    var retry by remember(song.videoId) { mutableIntStateOf(0) }
    val info by produceState<SongInfo?>(null, song, retry) {
        value = null
        value = SongInfoRepository.load(song)
    }
    val onSurface = MaterialTheme.colorScheme.onSurface

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier
                .width(ALERT_WIDTH)
                .clip(RoundedCornerShape(ALERT_CORNER))
                .background(MaterialTheme.colorScheme.surface),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 19.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = stringResource(R.string.song_info),
                    style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp, fontWeight = FontWeight.W600),
                    color = onSurface,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = song.title,
                    modifier = Modifier.padding(top = 4.dp),
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp, lineHeight = 17.sp),
                    color = onSurface,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (song.artist.isNotBlank()) {
                    Text(
                        text = song.artist,
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp, lineHeight = 17.sp),
                        color = onSurface.copy(alpha = 0.6f),
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            AlertRule()
            Column(
                Modifier
                    .heightIn(max = INFO_BODY_MAX_HEIGHT)
                    .verticalScroll(rememberScrollState()),
            ) {
                val unavailable = stringResource(R.string.song_info_unavailable)
                val rows = listOf(
                    R.string.song_info_album to (info?.album ?: song.albumName),
                    R.string.song_info_release_date to (info?.releaseDate ?: info?.releaseYear),
                    R.string.song_info_views to info?.views?.let(::compactCount),
                    R.string.song_info_likes to info?.likes,
                    R.string.song_info_comments to info?.comments,
                )
                rows.forEachIndexed { index, (label, value) ->
                    if (index > 0) AlertRule(Modifier.padding(start = 16.dp))
                    SongInfoRow(
                        label = stringResource(label),
                        value = value ?: unavailable.takeIf { info != null },
                    )
                }
                if (info?.failed == true) {
                    Text(
                        text = stringResource(R.string.song_info_error),
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 10.dp),
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp, lineHeight = 15.sp),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }

            AlertRule()
            if (info?.failed == true) {
                AlertAction(label = stringResource(R.string.song_info_retry), emphasised = false, onClick = { retry++ })
                AlertRule()
            }
            AlertAction(label = stringResource(R.string.done), emphasised = true, onClick = onDismiss)
        }
    }
}

/** Label on the left, value on the right; a small spinner stands in for the value while it loads. */
@Composable
private fun SongInfoRow(label: String, value: String?) {
    val onSurface = MaterialTheme.colorScheme.onSurface
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = ACTION_HEIGHT)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp),
            color = onSurface.copy(alpha = 0.6f),
        )
        Spacer(Modifier.width(12.dp))
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
            if (value == null) {
                CircularProgressIndicator(
                    modifier = Modifier.size(14.dp),
                    color = onSurface.copy(alpha = 0.5f),
                    strokeWidth = 1.75.dp,
                )
            } else {
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp),
                    color = onSurface,
                    textAlign = TextAlign.End,
                )
            }
        }
    }
}

/**
 * Apple Music-inspired Credits & Contributors screen for Now Playing.
 */
@Composable
internal fun BehindTheMusicPage(
    song: Song,
    palette: ArtworkPalette,
    onOpenArtist: (String) -> Unit = {},
    onSearchContributor: (String) -> Unit = {},
    onBack: () -> Unit,
) {
    var retry by remember(song.videoId) { mutableIntStateOf(0) }
    val info by produceState<SongInfo?>(null, song, retry) {
        value = null
        value = SongInfoRepository.load(song)
    }

    val coroutineScope = rememberCoroutineScope()
    var isFollowing by remember(song.artistId) { mutableStateOf(false) }

    Column(
        Modifier.fillMaxWidth(),
    ) {
        // 1. Top Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 8.dp, end = 20.dp, top = 4.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Rounded.ArrowBack,
                    contentDescription = stringResource(R.string.back),
                    tint = MaterialTheme.colorScheme.onBackground,
                )
            }
            Column(Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.behind_the_music),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = listOf(song.title, song.artist).filter { it.isNotBlank() }.joinToString(" • "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        HorizontalDivider(thickness = 0.5.dp, color = palette.divider)

        // Loading state
        if (info == null) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 44.dp),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(28.dp),
                    color = MaterialTheme.colorScheme.primary,
                    strokeWidth = 2.5.dp,
                )
            }
        } else {
            val credits = info?.credits
            val main = credits?.mainArtist
            val featured = credits?.featuredArtists.orEmpty()

            // 2. Artist Section
            CreditsSectionHeader(stringResource(R.string.credits_artist))
            if (main != null) {
                ContributorRow(
                    name = main.name,
                    roles = main.roles,
                    isMainArtist = true,
                    isFollowing = isFollowing,
                    onToggleFollow = {
                        val next = !isFollowing
                        isFollowing = next
                        val channelId = main.artistId
                        if (channelId != null) {
                            coroutineScope.launch {
                                YtMusicRepository.setSubscribed(channelId, next)
                            }
                        }
                    },
                    onClick = {
                        if (main.artistId != null) onOpenArtist(main.artistId)
                        else onSearchContributor(main.name)
                    },
                )
            }
            featured.forEach { feat ->
                ContributorRow(
                    name = feat.name,
                    roles = feat.roles,
                    onClick = {
                        if (feat.artistId != null) onOpenArtist(feat.artistId)
                        else onSearchContributor(feat.name)
                    },
                )
            }

            // 3. Composition & Lyrics (Hidden if empty)
            val composition = credits?.compositionAndLyrics.orEmpty()
            if (composition.isNotEmpty()) {
                CreditsSectionHeader(stringResource(R.string.credits_composition_lyrics))
                composition.forEach { contributor ->
                    ContributorRow(
                        name = contributor.name,
                        roles = contributor.roles,
                        onClick = { onSearchContributor(contributor.name) },
                    )
                }
            }

            // 4. Production (Hidden if empty)
            val production = credits?.production.orEmpty()
            if (production.isNotEmpty()) {
                CreditsSectionHeader(stringResource(R.string.credits_production))
                production.forEach { contributor ->
                    ContributorRow(
                        name = contributor.name,
                        roles = contributor.roles,
                        onClick = { onSearchContributor(contributor.name) },
                    )
                }
            }

            // 5. Engineering & Studio (Hidden if empty)
            val engineering = credits?.engineering.orEmpty()
            if (engineering.isNotEmpty()) {
                CreditsSectionHeader(stringResource(R.string.credits_engineering))
                engineering.forEach { contributor ->
                    ContributorRow(
                        name = contributor.name,
                        roles = contributor.roles,
                        onClick = { onSearchContributor(contributor.name) },
                    )
                }
            }

            // 6. Musicians & Performers (Hidden if empty)
            val musicians = credits?.musicians.orEmpty()
            if (musicians.isNotEmpty()) {
                CreditsSectionHeader(stringResource(R.string.credits_musicians))
                musicians.forEach { contributor ->
                    ContributorRow(
                        name = contributor.name,
                        roles = contributor.roles,
                        onClick = { onSearchContributor(contributor.name) },
                    )
                }
            }

            // 7. Additional Information
            val label = credits?.label
            val copyright = credits?.copyright
            val releaseDate = info?.releaseDate ?: info?.releaseYear ?: credits?.releaseDate
            val album = info?.album ?: song.albumName
            val views = info?.views?.let(::compactCount)

            CreditsSectionHeader(stringResource(R.string.credits_additional))
            if (!album.isNullOrBlank()) {
                InfoMetaRow(stringResource(R.string.song_info_album), album)
            }
            if (!releaseDate.isNullOrBlank()) {
                InfoMetaRow(stringResource(R.string.song_info_release_date), releaseDate)
            }
            if (!label.isNullOrBlank()) {
                InfoMetaRow(stringResource(R.string.credits_label), label)
            }
            if (!copyright.isNullOrBlank()) {
                InfoMetaRow(stringResource(R.string.credits_copyright), copyright)
            }
            if (!views.isNullOrBlank()) {
                InfoMetaRow(stringResource(R.string.song_info_views), views)
            }
            val personalPlays = ListeningStats.playCountFor(song.videoId)
            if (personalPlays > 0) {
                InfoMetaRow("Personal Plays", "$personalPlays listens")
            }
            val nerd = NerdStats.current.value
            if (nerd != null) {
                val codec = nerd.mimeType?.substringAfterLast("/")?.uppercase(Locale.ROOT) ?: "OPUS"
                val bitrate = nerd.bitrateKbps?.let { "$it kbps" } ?: "VBR"
                val sampleRate = nerd.sampleRateHz?.let { "%.1f kHz".format(it / 1000f) } ?: "48.0 kHz"
                InfoMetaRow("Live Stream", "$codec • $bitrate • $sampleRate")
            }

            if (info?.failed == true) {
                Spacer(Modifier.height(12.dp))
                ActionRow(Icons.Rounded.Refresh, stringResource(R.string.song_info_retry), accent = palette.accent) {
                    retry++
                }
            }
        }
        Spacer(Modifier.height(32.dp))
    }
}

@Composable
internal fun SongInfoPage(
    song: Song,
    palette: ArtworkPalette,
    onOpenArtist: (String) -> Unit = {},
    onSearchContributor: (String) -> Unit = {},
    onBack: () -> Unit,
) {
    BehindTheMusicPage(
        song = song,
        palette = palette,
        onOpenArtist = onOpenArtist,
        onSearchContributor = onSearchContributor,
        onBack = onBack,
    )
}

@Composable
private fun ContributorRow(
    name: String,
    roles: List<String>,
    isMainArtist: Boolean = false,
    isFollowing: Boolean = false,
    onToggleFollow: (() -> Unit)? = null,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 22.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = name,
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                color = MaterialTheme.colorScheme.onBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (roles.isNotEmpty()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = roles.joinToString(", "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        if (isMainArtist && onToggleFollow != null) {
            Spacer(Modifier.width(12.dp))
            FollowButton(isFollowing = isFollowing, onClick = onToggleFollow)
        } else {
            Spacer(Modifier.width(8.dp))
            Icon(
                Icons.Rounded.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
private fun FollowButton(
    isFollowing: Boolean,
    onClick: () -> Unit,
) {
    val haptics = rememberHaptics()
    val cobaltBlue = Color(0xFF2979FF)

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .then(
                if (isFollowing) {
                    Modifier
                        .border(1.dp, cobaltBlue.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                        .background(cobaltBlue.copy(alpha = 0.12f))
                } else {
                    Modifier.background(cobaltBlue)
                }
            )
            .clickable {
                haptics.play(if (isFollowing) Haptic.ToggleOff else Haptic.ToggleOn)
                onClick()
            }
            .padding(horizontal = 14.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = if (isFollowing) Icons.Rounded.Check else Icons.Rounded.Add,
                contentDescription = null,
                tint = if (isFollowing) cobaltBlue else Color.White,
                modifier = Modifier.size(15.dp),
            )
            Spacer(Modifier.width(4.dp))
            Text(
                text = stringResource(if (isFollowing) R.string.credits_following else R.string.credits_follow),
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                color = if (isFollowing) cobaltBlue else Color.White,
            )
        }
    }
}

@Composable
private fun CreditsSectionHeader(title: String) {
    Text(
        text = title.uppercase(Locale.ROOT),
        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.1.sp),
        color = Color(0xFF2979FF),
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 22.dp, end = 22.dp, top = 18.dp, bottom = 4.dp),
    )
}

@Composable
private fun InfoMetaRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 22.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.widthIn(min = 100.dp),
        )
        Spacer(Modifier.width(16.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1f),
        )
    }
}

/**
 * Slide-up drawer in the player displaying release date, album/label metadata,
 * live stream stats, and total personal play count for the current track.
 */
@Composable
fun SongInfoDrawer(
    visible: Boolean,
    song: com.music.raaga.data.model.Song,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(200)) + slideInVertically(tween(260)) { it },
        exit = fadeOut(tween(160)) + slideOutVertically(tween(200)) { it },
        modifier = modifier,
    ) {
        val palette = com.music.raaga.ui.theme.rememberArtworkPalette(song.thumbnailUrl, artPx = ROW_ART_PX)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xB3000000))
                .clickable(onClick = onDismiss),
            contentAlignment = Alignment.BottomCenter,
        ) {
            androidx.compose.material3.Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = false, onClick = {})
                    .navigationBarsPadding(),
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                        .verticalScroll(rememberScrollState()),
                ) {
                    BehindTheMusicPage(
                        song = song,
                        palette = palette,
                        onBack = onDismiss,
                    )
                }
            }
        }
    }
}
