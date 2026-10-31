package com.music.raaga.ui.screens.library

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ViewList
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Sort
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.settings.AppSettings

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaylistsSubScreen(
    playlists: List<ShelfItem>,
    onBack: () -> Unit,
    onPlaylistClick: (ShelfItem) -> Unit,
    onNewPlaylist: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var searchQuery by remember { mutableStateOf("") }
    var currentSort by remember { mutableStateOf(PlaylistSortOption.TYPE) }
    var viewMode by remember { mutableStateOf(LibraryViewMode.GRID) }
    var showSortSheet by remember { mutableStateOf(false) }
    var showNewFolderDialog by remember { mutableStateOf(false) }
    var newFolderName by remember { mutableStateOf("") }
    var activeFolderId by remember { mutableStateOf<String?>(null) }

    val pinnedPlaylists by AppSettings.pinnedPlaylists.collectAsStateWithLifecycle()
    val folderEntries by AppSettings.playlistFolderEntries.collectAsStateWithLifecycle()

    // Parse folder entries into a map of folderName to list of playlistIds
    val folderMap = remember(folderEntries) {
        val map = mutableMapOf<String, MutableList<String>>()
        folderEntries.forEach { entry ->
            val parts = entry.split(":::")
            if (parts.size >= 2) {
                val folderName = parts[1]
                val ids = if (parts.size >= 3) parts[2].split(",").filter { it.isNotBlank() } else emptyList()
                map.getOrPut(folderName) { mutableListOf() }.addAll(ids)
            }
        }
        map
    }

    // Filter and sort playlists - All playlists shown directly without sub-category splits
    val activeFolder = activeFolderId
    val displayedPlaylists = remember(playlists, searchQuery, currentSort, activeFolder, folderMap) {
        var list = playlists.filter {
            it.browseId != YtMusicRepository.LIKED_MUSIC &&
                !it.title.equals("Liked Music", ignoreCase = true) &&
                !it.title.equals("Favorite Songs", ignoreCase = true)
        }

        // Apply folder filter if inside a folder
        if (activeFolder != null) {
            val childIds = folderMap[activeFolder].orEmpty()
            list = list.filter { it.browseId in childIds }
        }

        // Apply search query
        if (searchQuery.isNotBlank()) {
            val q = searchQuery.trim().lowercase()
            list = list.filter {
                it.title.lowercase().contains(q) || it.subtitle.lowercase().contains(q)
            }
        }

        // Apply sorting
        when (currentSort) {
            PlaylistSortOption.TITLE -> list.sortedBy { it.title.lowercase() }
            PlaylistSortOption.RECENTLY_ADDED -> list.reversed()
            PlaylistSortOption.TYPE, PlaylistSortOption.RECENTLY_PLAYED, PlaylistSortOption.RECENTLY_UPDATED -> list
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        if (activeFolderId != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { activeFolderId = null }) {
                    Icon(
                        imageVector = Icons.Rounded.ArrowBack,
                        contentDescription = "Exit folder",
                        tint = Color.White,
                    )
                }
                Text(
                    text = activeFolderId ?: "",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // Action Bar with Search, View Mode Toggle, Sort and New Playlist
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 8.dp, top = 2.dp, bottom = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LibrarySearchBar(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                placeholder = stringResource(R.string.search_in_playlists),
                modifier = Modifier.weight(1f),
                horizontalPadding = 0.dp,
            )
            IconButton(onClick = {
                viewMode = if (viewMode == LibraryViewMode.GRID) LibraryViewMode.LIST else LibraryViewMode.GRID
            }) {
                Icon(
                    imageVector = if (viewMode == LibraryViewMode.GRID) Icons.AutoMirrored.Rounded.ViewList else Icons.Rounded.GridView,
                    contentDescription = stringResource(R.string.view_mode),
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
            }
            IconButton(onClick = { showSortSheet = true }) {
                Icon(
                    imageVector = Icons.Rounded.Sort,
                    contentDescription = stringResource(R.string.sort_by),
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
            }
            IconButton(onClick = onNewPlaylist) {
                Icon(
                    imageVector = Icons.Rounded.Add,
                    contentDescription = stringResource(R.string.new_playlist),
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
            }
        }

        // Content Area: Grid View vs List View
        if (viewMode == LibraryViewMode.GRID) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Play and Shuffle Pills
                if (displayedPlaylists.isNotEmpty()) {
                    item(span = { GridItemSpan(2) }) {
                        PillActionRow(
                            onPlay = { displayedPlaylists.firstOrNull()?.let(onPlaylistClick) },
                            onShuffle = { displayedPlaylists.firstOrNull()?.let(onPlaylistClick) },
                        )
                    }
                }

                // Favorite Songs Card (top item when at root)
                if (activeFolderId == null && searchQuery.isBlank()) {
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onPlaylistClick(
                                        ShelfItem(
                                            title = "Favorite Songs",
                                            subtitle = "Auto playlist",
                                            thumbnailUrl = null,
                                            videoId = null,
                                            browseId = YtMusicRepository.LIKED_MUSIC,
                                        )
                                    )
                                },
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(1f)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color.White),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Star,
                                    contentDescription = null,
                                    tint = RaagaAccentRed,
                                    modifier = Modifier.size(48.dp),
                                )
                            }
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = stringResource(R.string.favorite_songs),
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                text = "Auto playlist",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondaryGrey,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }

                // Playlist Folders in Grid
                if (activeFolderId == null && searchQuery.isBlank()) {
                    folderMap.keys.forEach { folderName ->
                        item {
                            val count = folderMap[folderName]?.size ?: 0
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { activeFolderId = folderName },
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(1f)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(AmoledCardBackground),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Folder,
                                        contentDescription = null,
                                        tint = RaagaAccentRed,
                                        modifier = Modifier.size(48.dp),
                                    )
                                }
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    text = folderName,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                    color = Color.White,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    text = "$count ${if (count == 1) "playlist" else "playlists"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondaryGrey,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }
                }

                // Playlist Cards in 2-column Grid
                items(displayedPlaylists, key = { it.browseId ?: it.title }) { playlist ->
                    val isPinned = playlist.browseId != null && playlist.browseId in pinnedPlaylists
                    var menuExpanded by remember { mutableStateOf(false) }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPlaylistClick(playlist) },
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(AmoledCardBackground),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (!playlist.thumbnailUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = playlist.thumbnailUrl,
                                    contentDescription = null,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.matchParentSize(),
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Rounded.Folder,
                                    contentDescription = null,
                                    tint = TextSecondaryGrey,
                                    modifier = Modifier.size(48.dp),
                                )
                            }

                            if (isPinned) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(8.dp)
                                        .size(24.dp)
                                        .clip(CircleShape)
                                        .background(Color.Black.copy(alpha = 0.7f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.PushPin,
                                        contentDescription = "Pinned",
                                        tint = RaagaAccentRed,
                                        modifier = Modifier.size(14.dp),
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = playlist.title,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                    color = Color.White,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                if (playlist.subtitle.isNotBlank()) {
                                    Text(
                                        text = playlist.subtitle,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryGrey,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                            Box {
                                IconButton(
                                    onClick = { menuExpanded = true },
                                    modifier = Modifier.size(28.dp),
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.MoreVert,
                                        contentDescription = "Options",
                                        tint = TextSecondaryGrey,
                                        modifier = Modifier.size(18.dp),
                                    )
                                }
                                DropdownMenu(
                                    expanded = menuExpanded,
                                    onDismissRequest = { menuExpanded = false },
                                    modifier = Modifier.background(AmoledCardBackground),
                                ) {
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = if (isPinned) stringResource(R.string.unpin) else stringResource(R.string.pin),
                                                color = Color.White,
                                            )
                                        },
                                        onClick = {
                                            menuExpanded = false
                                            playlist.browseId?.let { id ->
                                                if (isPinned) AppSettings.unpinPlaylist(id) else AppSettings.pinPlaylist(id)
                                            }
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = stringResource(R.string.new_folder),
                                                color = Color.White,
                                            )
                                        },
                                        onClick = {
                                            menuExpanded = false
                                            showNewFolderDialog = true
                                        },
                                    )
                                }
                            }
                        }
                    }
                }

                item(span = { GridItemSpan(2) }) {
                    Spacer(Modifier.height(100.dp))
                }
            }
        } else {
            // List View
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
            ) {
                // Play and Shuffle Pills
                if (displayedPlaylists.isNotEmpty()) {
                    item(key = "pills_list") {
                        PillActionRow(
                            onPlay = { displayedPlaylists.firstOrNull()?.let(onPlaylistClick) },
                            onShuffle = { displayedPlaylists.firstOrNull()?.let(onPlaylistClick) },
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp),
                        )
                    }
                }

                // Favorite Songs row
                if (activeFolderId == null && searchQuery.isBlank()) {
                    item(key = "favorite_songs_row") {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onPlaylistClick(
                                        ShelfItem(
                                            title = "Favorite Songs",
                                            subtitle = "Auto playlist",
                                            thumbnailUrl = null,
                                            videoId = null,
                                            browseId = YtMusicRepository.LIKED_MUSIC,
                                        )
                                    )
                                }
                                .padding(horizontal = 20.dp),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(56.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color.White),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Star,
                                        contentDescription = null,
                                        tint = RaagaAccentRed,
                                        modifier = Modifier.size(28.dp),
                                    )
                                }
                                Spacer(Modifier.width(16.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = stringResource(R.string.favorite_songs),
                                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                                        color = Color.White,
                                    )
                                    Text(
                                        text = "Auto playlist",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryGrey,
                                    )
                                }
                                Icon(
                                    imageVector = Icons.Rounded.ChevronRight,
                                    contentDescription = null,
                                    tint = TextSecondaryGrey,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                            HorizontalDivider(
                                thickness = 0.5.dp,
                                color = AmoledBorderColor,
                                modifier = Modifier.padding(start = 72.dp),
                            )
                        }
                    }
                }

                // Folders in List
                if (activeFolderId == null && searchQuery.isBlank()) {
                    folderMap.keys.forEach { folderName ->
                        item(key = "folder_$folderName") {
                            val count = folderMap[folderName]?.size ?: 0
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { activeFolderId = folderName }
                                    .padding(horizontal = 20.dp),
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(56.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(AmoledCardBackground),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.Folder,
                                            contentDescription = null,
                                            tint = RaagaAccentRed,
                                            modifier = Modifier.size(30.dp),
                                        )
                                    }
                                    Spacer(Modifier.width(16.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = folderName,
                                            style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                                            color = Color.White,
                                        )
                                        Text(
                                            text = "$count ${if (count == 1) "playlist" else "playlists"}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextSecondaryGrey,
                                        )
                                    }
                                    Icon(
                                        imageVector = Icons.Rounded.ChevronRight,
                                        contentDescription = null,
                                        tint = TextSecondaryGrey,
                                        modifier = Modifier.size(20.dp),
                                    )
                                }
                                HorizontalDivider(
                                    thickness = 0.5.dp,
                                    color = AmoledBorderColor,
                                    modifier = Modifier.padding(start = 72.dp),
                                )
                            }
                        }
                    }
                }

                // Playlist Items in List
                items(displayedPlaylists, key = { it.browseId ?: it.title }) { playlist ->
                    val isPinned = playlist.browseId != null && playlist.browseId in pinnedPlaylists
                    var menuExpanded by remember { mutableStateOf(false) }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPlaylistClick(playlist) }
                            .padding(horizontal = 20.dp),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(AmoledCardBackground),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (!playlist.thumbnailUrl.isNullOrBlank()) {
                                    AsyncImage(
                                        model = playlist.thumbnailUrl,
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.matchParentSize(),
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Rounded.Folder,
                                        contentDescription = null,
                                        tint = TextSecondaryGrey,
                                        modifier = Modifier.size(28.dp),
                                    )
                                }
                            }
                            Spacer(Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = playlist.title,
                                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                                    color = Color.White,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                if (playlist.subtitle.isNotBlank()) {
                                    Text(
                                        text = playlist.subtitle,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryGrey,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                            if (isPinned) {
                                Icon(
                                    imageVector = Icons.Rounded.PushPin,
                                    contentDescription = "Pinned",
                                    tint = RaagaAccentRed,
                                    modifier = Modifier
                                        .padding(end = 4.dp)
                                        .size(16.dp),
                                )
                            }
                            Box {
                                IconButton(onClick = { menuExpanded = true }) {
                                    Icon(
                                        imageVector = Icons.Rounded.MoreVert,
                                        contentDescription = "Options",
                                        tint = TextSecondaryGrey,
                                        modifier = Modifier.size(20.dp),
                                    )
                                }
                                DropdownMenu(
                                    expanded = menuExpanded,
                                    onDismissRequest = { menuExpanded = false },
                                    modifier = Modifier.background(AmoledCardBackground),
                                ) {
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = if (isPinned) stringResource(R.string.unpin) else stringResource(R.string.pin),
                                                color = Color.White,
                                            )
                                        },
                                        onClick = {
                                            menuExpanded = false
                                            playlist.browseId?.let { id ->
                                                if (isPinned) AppSettings.unpinPlaylist(id) else AppSettings.pinPlaylist(id)
                                            }
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = stringResource(R.string.new_folder),
                                                color = Color.White,
                                            )
                                        },
                                        onClick = {
                                            menuExpanded = false
                                            showNewFolderDialog = true
                                        },
                                    )
                                }
                            }
                        }
                        HorizontalDivider(
                            thickness = 0.5.dp,
                            color = AmoledBorderColor,
                            modifier = Modifier.padding(start = 72.dp),
                        )
                    }
                }

                item {
                    Spacer(Modifier.height(100.dp))
                }
            }
        }
    }

    // Sort Bottom Sheet
    if (showSortSheet) {
        GenericSortBottomSheet(
            title = stringResource(R.string.sort_by),
            options = PlaylistSortOption.entries.map { it to stringResource(it.labelRes) },
            selected = currentSort,
            onSelect = { currentSort = it },
            onDismiss = { showSortSheet = false },
        )
    }

    // New Folder Dialog
    if (showNewFolderDialog) {
        AlertDialog(
            onDismissRequest = { showNewFolderDialog = false },
            title = {
                Text(
                    text = stringResource(R.string.create_folder),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                )
            },
            text = {
                OutlinedTextField(
                    value = newFolderName,
                    onValueChange = { newFolderName = it },
                    placeholder = { Text(stringResource(R.string.folder_name), color = TextSecondaryGrey) },
                    singleLine = true,
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = AmoledCardBackground,
                        unfocusedContainerColor = AmoledCardBackground,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedIndicatorColor = RaagaAccentRed,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val name = newFolderName.trim()
                        if (name.isNotEmpty()) {
                            AppSettings.addPlaylistToFolder(name, "")
                            newFolderName = ""
                            showNewFolderDialog = false
                        }
                    },
                ) {
                    Text(stringResource(R.string.create), color = RaagaAccentRed)
                }
            },
            dismissButton = {
                TextButton(onClick = { showNewFolderDialog = false }) {
                    Text(stringResource(R.string.cancel), color = TextSecondaryGrey)
                }
            },
            containerColor = Color(0xFF1C1C1E),
        )
    }
}
