package com.music.raaga.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.music.raaga.data.model.Song
import com.music.raaga.data.model.UiState
import com.music.raaga.data.model.UserPlaylist

/**
 * Compatibility delegate to [PlaylistEditorSheet].
 */
@Composable
fun ReorderPlaylistSheet(
    playlist: UserPlaylist,
    entries: UiState<List<Song>>,
    saving: Boolean,
    onSave: (List<Song>) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PlaylistEditorSheet(
        title = playlist.title,
        browseId = playlist.browseId,
        entries = entries,
        saving = saving,
        onSave = onSave,
        onClose = onClose,
        modifier = modifier,
    )
}
