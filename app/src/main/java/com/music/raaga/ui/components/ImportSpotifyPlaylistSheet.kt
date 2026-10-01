package com.music.raaga.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.applemusic.AppleMusicParser
import com.music.raaga.data.model.PlaylistPrivacy
import com.music.raaga.data.spotify.SpotifyPlaylistInfo
import com.music.raaga.data.spotify.SpotifyPlaylistParser
import com.music.raaga.data.spotify.SpotifyTrack
import com.music.raaga.ui.icons.RaagaIcons
import kotlinx.coroutines.launch
import java.util.Locale

private val SpotifyGreen = Color(0xFF1DB954)
private val AppleRed   = Color(0xFFFC3C44)

private sealed interface ImportState {
    data object Input : ImportState
    data object Loading : ImportState
    data class Preview(val info: SpotifyPlaylistInfo) : ImportState
    data class Importing(val progress: Int, val total: Int, val currentSong: String) : ImportState
    data class Success(val playlistId: String, val title: String, val trackCount: Int) : ImportState
    data class Error(val message: String, val previousState: ImportState = Input) : ImportState
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImportSpotifyPlaylistSheet(
    onDismiss: () -> Unit,
    onImportToLibrary: (
        title: String,
        privacy: PlaylistPrivacy,
        tracks: List<SpotifyTrack>,
        thumbnailUrl: String?,
        onProgress: (Int, Int, String) -> Unit,
        onComplete: (Result<String>) -> Unit,
    ) -> Unit,
    onCancelImport: () -> Unit = {},
    onOpenPlaylist: (playlistId: String, title: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val coroutineScope = rememberCoroutineScope()
    val clipboardManager = LocalClipboardManager.current
    val focusManager = LocalFocusManager.current

    var state by remember { mutableStateOf<ImportState>(ImportState.Input) }
    var inputUrl by remember { mutableStateOf("") }
    var privacy by remember { mutableStateOf(PlaylistPrivacy.PRIVATE) }
    var editableTitle by remember { mutableStateOf("") }

    // Auto-detect Spotify OR Apple Music link on clipboard when opening
    LaunchedEffect(Unit) {
        val clipText = clipboardManager.getText()?.text?.trim()
        if (!clipText.isNullOrBlank() && (
            clipText.contains("spotify.com") ||
            clipText.contains("spotify:") ||
            clipText.contains("spotify.link") ||
            clipText.contains("music.apple.com")
        )) {
            inputUrl = clipText
        }
    }

    // Detect which service the current URL belongs to (drives accent color & labels)
    val isAppleMusic = AppleMusicParser.looksLikeAppleMusicUrl(inputUrl)
    val accentColor = if (isAppleMusic) AppleRed else SpotifyGreen

    val fetchInfo: (String) -> Unit = { url ->
        focusManager.clearFocus()
        val targetUrl = url.trim()
        if (targetUrl.isNotBlank()) {
            state = ImportState.Loading
            coroutineScope.launch {
                if (AppleMusicParser.looksLikeAppleMusicUrl(targetUrl)) {
                    // Apple Music path
                    val parsed = AppleMusicParser.parseLink(targetUrl)
                    if (parsed == null) {
                        state = ImportState.Error("Please enter a valid Apple Music playlist or album link")
                        return@launch
                    }
                    AppleMusicParser.fetchPlaylist(parsed).fold(
                        onSuccess = { info ->
                            editableTitle = info.title
                            state = ImportState.Preview(info)
                        },
                        onFailure = { err ->
                            state = ImportState.Error(err.message ?: "Failed to load Apple Music playlist")
                        }
                    )
                } else {
                    // Spotify path
                    val parsed = SpotifyPlaylistParser.parseLink(targetUrl)
                    if (parsed == null) {
                        state = ImportState.Error("Please enter a valid Spotify or Apple Music playlist link")
                        return@launch
                    }
                    SpotifyPlaylistParser.fetchPlaylist(parsed).fold(
                        onSuccess = { info ->
                            editableTitle = info.title
                            state = ImportState.Preview(info)
                        },
                        onFailure = { err ->
                            state = ImportState.Error(err.message ?: "Failed to load Spotify playlist")
                        }
                    )
                }
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.background,
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(bottom = 24.dp),
        ) {
            // Header bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (state is ImportState.Preview || state is ImportState.Error) {
                    IconButton(
                        onClick = { state = ImportState.Input },
                        enabled = state !is ImportState.Importing,
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = stringResource(R.string.back),
                            tint = MaterialTheme.colorScheme.onBackground,
                        )
                    }
                }
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(accentColor),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = if (isAppleMusic)
                                stringResource(R.string.import_apple_music_title)
                            else
                                stringResource(R.string.import_spotify_title),
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                    }
                    Text(
                        text = stringResource(R.string.import_spotify_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(
                    onClick = {
                        if (state is ImportState.Importing) {
                            onCancelImport()
                        }
                        onDismiss()
                    }
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Close,
                        contentDescription = stringResource(R.string.close),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            HorizontalDivider(
                thickness = 0.5.dp,
                color = MaterialTheme.colorScheme.outline,
                modifier = Modifier.padding(top = 8.dp),
            )

            AnimatedContent(
                targetState = state,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "ImportSpotifyContent",
            ) { currentState ->
                when (currentState) {
                    is ImportState.Input -> {
                        InputContent(
                            url = inputUrl,
                            accentColor = accentColor,
                            onUrlChange = { inputUrl = it },
                            onPaste = {
                                val clip = clipboardManager.getText()?.text?.trim()
                                if (!clip.isNullOrBlank()) {
                                    inputUrl = clip
                                    fetchInfo(clip)
                                }
                            },
                            onClear = { inputUrl = "" },
                            onSubmit = { fetchInfo(inputUrl) },
                        )
                    }

                    is ImportState.Loading -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator(
                                    color = accentColor,
                                    strokeWidth = 3.dp,
                                    modifier = Modifier.size(36.dp),
                                )
                                Spacer(Modifier.height(16.dp))
                                Text(
                                    text = if (isAppleMusic)
                                        stringResource(R.string.fetching_apple_music_playlist)
                                    else
                                        stringResource(R.string.fetching_spotify_playlist),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    is ImportState.Preview -> {
                        PreviewContent(
                            info = currentState.info,
                            title = editableTitle,
                            accentColor = accentColor,
                            onTitleChange = { editableTitle = it },
                            privacy = privacy,
                            onPrivacyChange = { privacy = it },
                            onImport = {
                                state = ImportState.Importing(0, currentState.info.tracks.size, "")
                                onImportToLibrary(
                                    editableTitle.ifBlank { currentState.info.title },
                                    privacy,
                                    currentState.info.tracks,
                                    currentState.info.coverArtUrl,
                                    { current, total, song ->
                                        state = ImportState.Importing(current, total, song)
                                    },
                                    { result ->
                                        result.fold(
                                            onSuccess = { playlistId ->
                                                state = ImportState.Success(
                                                    playlistId = playlistId,
                                                    title = editableTitle.ifBlank { currentState.info.title },
                                                    trackCount = currentState.info.tracks.size,
                                                )
                                            },
                                            onFailure = { err ->
                                                state = ImportState.Error(
                                                    message = err.message ?: "Import failed",
                                                    previousState = currentState,
                                                )
                                            }
                                        )
                                    }
                                )
                            },
                        )
                    }

                    is ImportState.Importing -> {
                        ImportingContent(
                            progress = currentState.progress,
                            total = currentState.total,
                            currentSong = currentState.currentSong,
                            accentColor = accentColor,
                            onRunInBackground = onDismiss,
                            onCancel = {
                                onCancelImport()
                                state = ImportState.Input
                            },
                        )
                    }

                    is ImportState.Success -> {
                        SuccessContent(
                            title = currentState.title,
                            trackCount = currentState.trackCount,
                            accentColor = accentColor,
                            onOpenPlaylist = {
                                onOpenPlaylist(currentState.playlistId, currentState.title)
                                onDismiss()
                            },
                            onDone = onDismiss,
                        )
                    }

                    is ImportState.Error -> {
                        ErrorContent(
                            message = currentState.message,
                            onRetry = {
                                if (currentState.previousState is ImportState.Preview) {
                                    state = currentState.previousState
                                } else {
                                    state = ImportState.Input
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InputContent(
    url: String,
    accentColor: Color,
    onUrlChange: (String) -> Unit,
    onPaste: () -> Unit,
    onClear: () -> Unit,
    onSubmit: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 22.dp, vertical = 18.dp),
    ) {
        Text(
            text = stringResource(R.string.import_spotify_description),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 16.dp),
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Rounded.Link,
                contentDescription = null,
                tint = accentColor,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(10.dp))
            Box(Modifier.weight(1f)) {
                if (url.isEmpty()) {
                    Text(
                        text = stringResource(R.string.spotify_link_placeholder),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                BasicTextField(
                    value = url,
                    onValueChange = onUrlChange,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                        color = MaterialTheme.colorScheme.onBackground,
                    ),
                    cursorBrush = SolidColor(accentColor),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { onSubmit() }),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (url.isNotEmpty()) {
                IconButton(onClick = onClear, modifier = Modifier.size(28.dp)) {
                    Icon(
                        Icons.Rounded.Close,
                        contentDescription = stringResource(R.string.clear_search),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            } else {
                IconButton(onClick = onPaste, modifier = Modifier.size(28.dp)) {
                    Icon(
                        Icons.Rounded.ContentPaste,
                        contentDescription = stringResource(R.string.paste_from_clipboard),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }

        Spacer(Modifier.height(18.dp))

        Button(
            onClick = onSubmit,
            enabled = url.isNotBlank(),
            colors = ButtonDefaults.buttonColors(
                containerColor = accentColor,
                contentColor = Color.White,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.fetch_playlist), fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun PreviewContent(
    info: SpotifyPlaylistInfo,
    title: String,
    accentColor: Color,
    onTitleChange: (String) -> Unit,
    privacy: PlaylistPrivacy,
    onPrivacyChange: (PlaylistPrivacy) -> Unit,
    onImport: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 22.dp, vertical = 14.dp),
    ) {
        // Playlist Header Preview Card
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp))
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AsyncImage(
                model = info.coverArtUrl,
                contentDescription = null,
                modifier = Modifier
                    .size(68.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.background),
            )
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                BasicTextField(
                    value = title,
                    onValueChange = onTitleChange,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.titleMedium.copy(
                        color = MaterialTheme.colorScheme.onBackground,
                        fontWeight = FontWeight.Bold,
                    ),
                    cursorBrush = SolidColor(accentColor),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "${info.tracks.size} tracks" + (if (info.author != null) " • by ${info.author}" else ""),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (info.isPartial) {
                    Text(
                        text = "${info.tracks.size} tracks loaded from link (partial)",
                        style = MaterialTheme.typography.labelSmall,
                        color = accentColor,
                    )
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // Privacy pills
        Text(
            text = stringResource(R.string.who_can_see_it).uppercase(Locale.getDefault()),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 6.dp),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PlaylistPrivacy.entries.forEach { option ->
                PrivacyPill(
                    icon = when (option) {
                        PlaylistPrivacy.PRIVATE -> Icons.Rounded.Lock
                        PlaylistPrivacy.UNLISTED -> Icons.Rounded.Link
                        PlaylistPrivacy.PUBLIC -> Icons.Rounded.Public
                    },
                    label = option.label,
                    selected = option == privacy,
                    onClick = { onPrivacyChange(option) },
                )
            }
        }

        Spacer(Modifier.height(14.dp))

        // Tracks preview
        Text(
            text = "TRACKS PREVIEW (${info.tracks.size})",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 6.dp),
        )

        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 160.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                .padding(vertical = 4.dp),
        ) {
            itemsIndexed(info.tracks) { index, track ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${index + 1}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(24.dp),
                    )
                    Column(Modifier.weight(1f)) {
                        Text(
                            text = track.title,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onBackground,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        if (track.artist.isNotBlank()) {
                            Text(
                                text = track.artist,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(18.dp))

        Button(
            onClick = onImport,
            colors = ButtonDefaults.buttonColors(
                containerColor = accentColor,
                contentColor = Color.White,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(
                imageVector = RaagaIcons.Download,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = stringResource(R.string.import_playlist_action),
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun ImportingContent(
    progress: Int,
    total: Int,
    currentSong: String,
    accentColor: Color,
    onRunInBackground: () -> Unit,
    onCancel: () -> Unit,
) {
    val progressFloat = if (total > 0) progress.toFloat() / total.toFloat() else 0f
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(
            progress = { progressFloat },
            color = accentColor,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.size(56.dp),
        )
        Spacer(Modifier.height(18.dp))
        Text(
            text = stringResource(R.string.matching_songs, progress, total),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        if (currentSong.isNotBlank()) {
            Spacer(Modifier.height(6.dp))
            Text(
                text = currentSong,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
        Spacer(Modifier.height(16.dp))
        LinearProgressIndicator(
            progress = { progressFloat },
            color = accentColor,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
        )

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = onRunInBackground,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.run_in_background), fontWeight = FontWeight.SemiBold)
        }

        Spacer(Modifier.height(8.dp))

        OutlinedButton(
            onClick = onCancel,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.cancel_import), color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun SuccessContent(
    title: String,
    trackCount: Int,
    accentColor: Color,
    onOpenPlaylist: () -> Unit,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            imageVector = Icons.Rounded.CheckCircle,
            contentDescription = null,
            tint = accentColor,
            modifier = Modifier.size(56.dp),
        )
        Spacer(Modifier.height(14.dp))
        Text(
            text = stringResource(R.string.import_completed, title, trackCount),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onOpenPlaylist,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.open_playlist), fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(
            onClick = onDone,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.close))
        }
    }
}

@Composable
private fun ErrorContent(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            imageVector = Icons.Rounded.ErrorOutline,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(48.dp),
        )
        Spacer(Modifier.height(12.dp))
        Text(
            text = stringResource(R.string.import_failed, message),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = onRetry,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(stringResource(R.string.retry))
        }
    }
}

@Composable
private fun PrivacyPill(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val contentColor = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
    val bgColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant

    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(percent = 50))
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = contentColor,
            modifier = Modifier.size(14.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = contentColor,
        )
    }
}
