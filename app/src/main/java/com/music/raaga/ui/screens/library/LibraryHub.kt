package com.music.raaga.ui.screens.library

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DragHandle
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.LibrarySongAggregator
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.model.HomeShelf
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.Song
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.download.SavedCollection
import com.music.raaga.ui.components.PullToRefresh
import com.music.raaga.ui.replay.ReplayHeroCard
import com.music.raaga.ui.replay.ReplayStoryPage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryHub(
    playlists: List<ShelfItem>,
    recentlyAddedItems: List<ShelfItem>,
    downloadedPlaylists: List<SavedCollection>,
    onNavigateCategory: (LibraryCategory) -> Unit,
    onShelfItemClick: (ShelfItem) -> Unit,
    onNewPlaylist: () -> Unit,
    onShowAllRecentlyAdded: () -> Unit,
    onSongClick: ((List<Song>, Int) -> Unit)? = null,
    replayCards: List<ReplayHeroCard>,
    onOpenReplay: (ReplayStoryPage) -> Unit,
    onOpenSettings: () -> Unit = {},
    onOpenAccount: () -> Unit = {},
    refreshing: Boolean,
    onRefresh: () -> Unit,
    pullState: PullToRefreshState,
    listState: LazyListState,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    var isEditingPins by remember { mutableStateOf(false) }
    var isEditingCategories by remember { mutableStateOf(false) }
    var menuExpanded by remember { mutableStateOf(false) }

    val pinnedPlaylistIds by AppSettings.pinnedPlaylists.collectAsStateWithLifecycle()
    val savedCategories by AppSettings.libraryCategories.collectAsStateWithLifecycle()
    val hiddenCategories by AppSettings.hiddenLibraryCategories.collectAsStateWithLifecycle()

    // Recently Added Section (Song-Only smart collection)
    val recentTracks by LibrarySongAggregator.recentlyAddedTracks.collectAsState()
    val topRecentTracks = remember(recentTracks) {
        recentTracks.distinctBy { it.song.localUri ?: it.song.videoId }.take(6)
    }
    val topSongs = remember(topRecentTracks) { topRecentTracks.map { it.song } }

    // Map pinned ids to ShelfItem
    val pinnedCollections = remember(pinnedPlaylistIds, playlists) {
        val list = mutableListOf<PinnedCollection>()
        // Always start with Favorite Songs
        list.add(
            PinnedCollection(
                id = YtMusicRepository.LIKED_MUSIC,
                title = "Favorite Songs",
                subtitle = "Auto playlist",
                isFavoriteSongs = true,
                shelfItem = ShelfItem(
                    title = "Favorite Songs",
                    subtitle = "Auto playlist",
                    thumbnailUrl = null,
                    videoId = null,
                    browseId = YtMusicRepository.LIKED_MUSIC,
                ),
            )
        )
        // Add user pinned playlists
        pinnedPlaylistIds.forEach { id ->
            playlists.firstOrNull { it.browseId == id }?.let { item ->
                list.add(
                    PinnedCollection(
                        id = id,
                        title = item.title,
                        subtitle = item.subtitle,
                        artworkUrl = item.thumbnailUrl,
                        shelfItem = item,
                    )
                )
            }
        }
        list
    }

    PullToRefresh(
        refreshing = refreshing,
        onRefresh = onRefresh,
        state = pullState,
        modifier = modifier,
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black),
            contentPadding = contentPadding,
        ) {
            // Main Top Bar Header
            item(key = "library_header") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(R.string.library),
                        style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        if (isEditingPins || isEditingCategories) {
                            // Circular Done Checkmark Button
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF2C2C2E))
                                    .clickable {
                                        isEditingPins = false
                                        isEditingCategories = false
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Check,
                                    contentDescription = stringResource(R.string.done),
                                    tint = RaagaAccentRed,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                        } else {
                            IconButton(onClick = onNewPlaylist) {
                                Icon(
                                    imageVector = Icons.Rounded.Add,
                                    contentDescription = stringResource(R.string.new_playlist),
                                    tint = Color.White,
                                )
                            }
                            Box {
                                IconButton(onClick = { menuExpanded = true }) {
                                    Icon(
                                        imageVector = Icons.Rounded.MoreHoriz,
                                        contentDescription = "Menu",
                                        tint = Color.White,
                                    )
                                }
                                DropdownMenu(
                                    expanded = menuExpanded,
                                    onDismissRequest = { menuExpanded = false },
                                    modifier = Modifier.background(Color(0xFF1C1C1E)),
                                ) {
                                    DropdownMenuItem(
                                        text = { Text(stringResource(R.string.edit_pins), color = Color.White) },
                                        onClick = {
                                            menuExpanded = false
                                            isEditingPins = true
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = { Text(stringResource(R.string.edit_categories), color = Color.White) },
                                        onClick = {
                                            menuExpanded = false
                                            isEditingCategories = true
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Pinned Cards Hero Carousel
            item(key = "pinned_carousel") {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    items(pinnedCollections, key = { it.id }) { pinned ->
                        PinnedCollectionCard(
                            pinned = pinned,
                            isEditing = isEditingPins,
                            onClick = {
                                if (!isEditingPins && pinned.shelfItem != null) {
                                    onShelfItemClick(pinned.shelfItem)
                                }
                            },
                            onUnpin = {
                                if (!pinned.isFavoriteSongs) {
                                    AppSettings.unpinPlaylist(pinned.id)
                                }
                            },
                        )
                    }
                }
                Spacer(Modifier.height(14.dp))
            }

            // Library Categories (normal vs edit mode)
            if (isEditingCategories) {
                item(key = "categories_edit_list") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                    ) {
                        LibraryCategory.entries.forEach { category ->
                            val isChecked = category.id !in hiddenCategories
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(52.dp)
                                    .clickable {
                                        AppSettings.setCategoryHidden(category.id, isChecked)
                                    },
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = { checked ->
                                        AppSettings.setCategoryHidden(category.id, !checked)
                                    },
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = RaagaAccentRed,
                                        uncheckedColor = TextSecondaryGrey,
                                        checkmarkColor = Color.White,
                                    ),
                                )
                                Spacer(Modifier.width(8.dp))
                                Icon(
                                    imageVector = category.icon,
                                    contentDescription = null,
                                    tint = RaagaAccentRed,
                                    modifier = Modifier.size(24.dp),
                                )
                                Spacer(Modifier.width(16.dp))
                                Text(
                                    text = stringResource(category.titleRes),
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Medium),
                                    color = Color.White,
                                    modifier = Modifier.weight(1f),
                                )
                                Icon(
                                    imageVector = Icons.Rounded.DragHandle,
                                    contentDescription = "Reorder",
                                    tint = TextSecondaryGrey,
                                    modifier = Modifier.size(24.dp),
                                )
                            }
                            HorizontalDivider(
                                thickness = 0.5.dp,
                                color = AmoledBorderColor,
                                modifier = Modifier.padding(start = 56.dp),
                            )
                        }
                    }
                }
            } else {
                // Normal Categories Rows
                item(key = "categories_normal_list") {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        LibraryCategory.entries.filter { it.id !in hiddenCategories }.forEach { category ->
                            LibraryCategoryRow(
                                icon = category.icon,
                                title = stringResource(category.titleRes),
                                onClick = { onNavigateCategory(category) },
                            )
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }

            // Recently Added Section (Song-Only smart collection)
            if (topRecentTracks.isNotEmpty() && !isEditingPins && !isEditingCategories) {
                item(key = "recently_added_header") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(R.string.recently_added),
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                        )
                        TextButton(onClick = onShowAllRecentlyAdded) {
                            Text(
                                text = stringResource(R.string.show_all),
                                color = RaagaAccentRed,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }

                // Song cards for newly added songs (2-column card grid, matching Apple Music)
                topRecentTracks.chunked(2).forEachIndexed { rowIndex, rowTracks ->
                    item(key = "hub_recent_cards_row_$rowIndex") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            rowTracks.forEach { trackItem ->
                                val song = trackItem.song
                                val songIndex = topSongs.indexOf(song).coerceAtLeast(0)
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable {
                                            onSongClick?.invoke(topSongs, songIndex)
                                        },
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .aspectRatio(1f)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(AmoledCardBackground),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        if (!song.thumbnailUrl.isNullOrBlank()) {
                                            AsyncImage(
                                                model = song.thumbnailUrl,
                                                contentDescription = null,
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.matchParentSize(),
                                            )
                                        } else {
                                            Icon(
                                                imageVector = Icons.Rounded.MusicNote,
                                                contentDescription = null,
                                                tint = TextSecondaryGrey,
                                                modifier = Modifier.size(48.dp),
                                            )
                                        }
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        text = song.title,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                        color = Color.White,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    val sourceByline = when {
                                        !trackItem.sourceTitle.isNullOrBlank() -> "${song.artist} • ${trackItem.sourceTitle}"
                                        !song.albumName.isNullOrBlank() -> "${song.artist} • ${song.albumName}"
                                        else -> song.artist
                                    }
                                    Text(
                                        text = sourceByline,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryGrey,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                            if (rowTracks.size == 1) {
                                Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            item {
                Spacer(Modifier.height(100.dp))
            }
        }
    }
}

