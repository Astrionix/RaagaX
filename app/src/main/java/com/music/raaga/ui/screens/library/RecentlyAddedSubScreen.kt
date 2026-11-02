package com.music.raaga.ui.screens.library

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.automirrored.rounded.Sort
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.LibrarySongAggregator
import com.music.raaga.data.model.CARD_ART_PX
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.Song
import com.music.raaga.data.model.artworkAt

/**
 * Apple Music-inspired Recently Added Sub-Screen.
 *
 * Visual Hierarchy & Interaction:
 * - Two-column artwork grid with large square album cards.
 * - Header with back navigation, large title, sort button, and multi-select toggle.
 * - Category filters: All, Albums, Playlists, Songs with Raaga cobalt-blue active pill.
 * - Chronological ordering with relative date headers (Today, Yesterday, etc.).
 * - Album tap opens Album details; Playlist tap opens Playlist details; Song tap plays.
 * - Long-press & 3-dot contextual actions.
 * - Floating multi-select action bar (Play, Play Next, Add to Queue, Download, Remove from Library).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecentlyAddedSubScreen(
    onBack: () -> Unit,
    onSongClick: (List<Song>, Int) -> Unit,
    onSongLongPress: (Song) -> Unit = {},
    onShelfItemClick: (ShelfItem) -> Unit = {},
    onAddToQueue: (List<Song>) -> Unit = {},
    onPlayNext: (List<Song>) -> Unit = {},
    onDownloadSelected: (List<Song>) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val allRecentTracks by LibrarySongAggregator.recentlyAddedTracks.collectAsState()
    var selectedCategory by remember { mutableStateOf(AdditionSourceType.ALL) }
    var searchQuery by remember { mutableStateOf("") }
    var sortOption by remember { mutableStateOf(AlbumSortOption.RECENTLY_ADDED) }
    var showSortSheet by remember { mutableStateOf(false) }

    var isMultiSelectMode by remember { mutableStateOf(false) }
    val selectedKeys = remember { mutableStateListOf<String>() }
    val gridState = rememberLazyGridState()

    // 1. Group tracks into polymorphous RecentlyAddedItems based on selected category filter
    val rawItems = remember(allRecentTracks, selectedCategory) {
        allRecentTracks.toRecentlyAddedItems(maxItems = Int.MAX_VALUE, filterCategory = selectedCategory)
    }

    // 2. Filter by search query
    val searchedItems = remember(rawItems, searchQuery) {
        if (searchQuery.isBlank()) rawItems
        else {
            val q = searchQuery.trim().lowercase()
            rawItems.filter {
                it.title.lowercase().contains(q) ||
                    it.subtitle.lowercase().contains(q) ||
                    it.playableSongs.any { song ->
                        song.title.lowercase().contains(q) || song.artist.lowercase().contains(q)
                    }
            }
        }
    }

    // 3. Sort items according to sort option
    val sortedItems = remember(searchedItems, sortOption) {
        when (sortOption) {
            AlbumSortOption.RECENTLY_ADDED -> searchedItems.sortedByDescending { it.addedAtEpochSeconds }
            AlbumSortOption.TITLE -> searchedItems.sortedBy { it.title.lowercase() }
            AlbumSortOption.ARTIST -> searchedItems.sortedBy { it.subtitle.lowercase() }
            AlbumSortOption.RELEASE_DATE -> searchedItems.sortedByDescending { it.addedAtEpochSeconds }
        }
    }

    // 4. Group by relative date headers (when sorted chronologically)
    val groupedSections = remember(sortedItems, sortOption) {
        if (sortOption == AlbumSortOption.RECENTLY_ADDED || sortOption == AlbumSortOption.RELEASE_DATE) {
            val sections = LinkedHashMap<String, MutableList<RecentlyAddedItem>>()
            sortedItems.forEach { item ->
                val header = getRelativeDateHeader(item.addedAtEpochSeconds)
                sections.getOrPut(header) { mutableListOf() }.add(item)
            }
            sections
        } else {
            val title = if (sortOption == AlbumSortOption.TITLE) "By Title" else "By Artist"
            linkedMapOf(title to sortedItems.toMutableList())
        }
    }

    // All playable songs in current view
    val allPlayableSongs = remember(sortedItems) {
        sortedItems.flatMap { it.playableSongs }.distinctBy { it.localUri ?: it.videoId }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        // --- Top Bar ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White,
                    modifier = Modifier.size(24.dp),
                )
            }
            Text(
                text = stringResource(R.string.recently_added),
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = Color.White,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { showSortSheet = true }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.Sort,
                    contentDescription = "Sort",
                    tint = if (sortOption != AlbumSortOption.RECENTLY_ADDED) RaagaCobaltBlue else TextSecondaryGrey,
                    modifier = Modifier.size(22.dp),
                )
            }
            TextButton(
                onClick = {
                    isMultiSelectMode = !isMultiSelectMode
                    if (!isMultiSelectMode) selectedKeys.clear()
                },
            ) {
                Text(
                    text = if (isMultiSelectMode) stringResource(R.string.done) else "Select",
                    color = RaagaCobaltBlue,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        // --- Category Filters (All, Albums, Playlists, Songs) ---
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val categories = listOf(
                AdditionSourceType.ALL to "All",
                AdditionSourceType.ALBUM to "Albums",
                AdditionSourceType.PLAYLIST to "Playlists",
                AdditionSourceType.SONG to "Songs",
            )
            items(categories) { (cat, label) ->
                val isSelected = cat == selectedCategory
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(if (isSelected) RaagaCobaltBlue else Color(0xFF1C1C1E))
                        .clickable { selectedCategory = cat }
                        .padding(horizontal = 16.dp, vertical = 7.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        ),
                        color = if (isSelected) Color.White else TextSecondaryGrey,
                    )
                }
            }
        }

        // --- Search Bar ---
        LibrarySearchBar(
            query = searchQuery,
            onQueryChange = { searchQuery = it },
            placeholder = "Search in Recently Added",
            horizontalPadding = 20.dp,
        )

        // --- Play & Shuffle Pill Buttons (Apple Music style) ---
        if (allPlayableSongs.isNotEmpty() && !isMultiSelectMode) {
            PillActionRow(
                onPlay = { onSongClick(allPlayableSongs, 0) },
                onShuffle = { onSongClick(allPlayableSongs.shuffled(), 0) },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 2.dp),
            )
        }

        // --- Content Grid (2-Column Square Artwork Grid) ---
        Box(modifier = Modifier.fillMaxSize()) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                state = gridState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                groupedSections.forEach { (sectionHeader, itemsInSection) ->
                    // Relative Date Header (e.g. "Today", "Yesterday", "Earlier This Week")
                    item(span = { GridItemSpan(2) }, key = "header_${sectionHeader}_${selectedCategory.name}") {
                        Text(
                            text = sectionHeader,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
                        )
                    }

                    // 2-Column Cards
                    items(
                        items = itemsInSection,
                        key = { it.key },
                    ) { item ->
                        val isSelected = item.key in selectedKeys

                        RecentlyAddedGridCard(
                            item = item,
                            isSelected = isSelected,
                            isMultiSelectMode = isMultiSelectMode,
                            onClick = {
                                if (isMultiSelectMode) {
                                    if (isSelected) selectedKeys.remove(item.key)
                                    else selectedKeys.add(item.key)
                                } else {
                                    when (item) {
                                        is RecentlyAddedItem.Album -> {
                                            if (!item.albumBrowseId.isNullOrBlank()) {
                                                onShelfItemClick(
                                                    ShelfItem(
                                                        title = item.title,
                                                        subtitle = item.subtitle,
                                                        thumbnailUrl = item.artworkUrl,
                                                        videoId = null,
                                                        browseId = item.albumBrowseId,
                                                    )
                                                )
                                            } else {
                                                val playable = item.playableSongs
                                                onSongClick(playable, 0)
                                            }
                                        }
                                        is RecentlyAddedItem.Playlist -> {
                                            onShelfItemClick(
                                                ShelfItem(
                                                    title = item.title,
                                                    subtitle = item.subtitle,
                                                    thumbnailUrl = item.artworkUrl,
                                                    videoId = null,
                                                    browseId = item.playlistBrowseId,
                                                )
                                            )
                                        }
                                        is RecentlyAddedItem.SingleSong -> {
                                            val songIndex = allPlayableSongs.indexOf(item.song).coerceAtLeast(0)
                                            onSongClick(allPlayableSongs, songIndex)
                                        }
                                    }
                                }
                            },
                            onLongClick = {
                                if (isMultiSelectMode) {
                                    if (isSelected) selectedKeys.remove(item.key)
                                    else selectedKeys.add(item.key)
                                } else {
                                    when (item) {
                                        is RecentlyAddedItem.SingleSong -> onSongLongPress(item.song)
                                        else -> {}
                                    }
                                }
                            },
                            onPlay = {
                                val playable = item.playableSongs
                                onSongClick(playable, 0)
                            },
                            onPlayNext = {
                                val playable = item.playableSongs
                                onPlayNext(playable)
                            },
                            onAddToQueue = {
                                val playable = item.playableSongs
                                onAddToQueue(playable)
                            },
                            onDownload = {
                                val playable = item.playableSongs
                                onDownloadSelected(playable)
                            },
                            onRemoveFromLibrary = {
                                LibrarySongAggregator.removeFromLibrary(item.playableSongs)
                            },
                        )
                    }
                }

                item(span = { GridItemSpan(2) }) {
                    Spacer(Modifier.height(if (isMultiSelectMode) 140.dp else 100.dp))
                }
            }

            // --- Multi-Select Floating Action Bar ---
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp),
            ) {
                AnimatedVisibility(
                    visible = isMultiSelectMode,
                    enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                    exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
                ) {
                    val selectedItems = remember(selectedKeys.toList(), sortedItems) {
                        sortedItems.filter { it.key in selectedKeys }
                    }
                    val selectedSongs = remember(selectedItems) {
                        selectedItems.flatMap { it.playableSongs }.distinctBy { it.localUri ?: it.videoId }
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color(0xFF1E1E20))
                            .border(1.dp, AmoledBorderColor, RoundedCornerShape(24.dp))
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(
                                text = "${selectedKeys.size} selected",
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                            )
                            IconButton(
                                onClick = {
                                    if (selectedSongs.isNotEmpty()) {
                                        onSongClick(selectedSongs, 0)
                                        isMultiSelectMode = false
                                        selectedKeys.clear()
                                    }
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.PlayArrow,
                                    contentDescription = "Play",
                                    tint = Color.White,
                                )
                            }
                            IconButton(
                                onClick = {
                                    if (selectedSongs.isNotEmpty()) {
                                        onPlayNext(selectedSongs)
                                        isMultiSelectMode = false
                                        selectedKeys.clear()
                                    }
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.QueueMusic,
                                    contentDescription = "Play Next",
                                    tint = Color.White,
                                )
                            }
                            IconButton(
                                onClick = {
                                    if (selectedSongs.isNotEmpty()) {
                                        onAddToQueue(selectedSongs)
                                        isMultiSelectMode = false
                                        selectedKeys.clear()
                                    }
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.PlaylistAdd,
                                    contentDescription = "Add to Queue",
                                    tint = Color.White,
                                )
                            }
                            IconButton(
                                onClick = {
                                    if (selectedSongs.isNotEmpty()) {
                                        onDownloadSelected(selectedSongs)
                                        isMultiSelectMode = false
                                        selectedKeys.clear()
                                    }
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Download,
                                    contentDescription = "Download",
                                    tint = RaagaCobaltBlue,
                                )
                            }
                            IconButton(
                                onClick = {
                                    if (selectedSongs.isNotEmpty()) {
                                        LibrarySongAggregator.removeFromLibrary(selectedSongs)
                                        isMultiSelectMode = false
                                        selectedKeys.clear()
                                    }
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.DeleteOutline,
                                    contentDescription = "Remove from Library",
                                    tint = Color(0xFFFF5252),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Sort Bottom Sheet ---
    if (showSortSheet) {
        GenericSortBottomSheet(
            title = stringResource(R.string.sort_by),
            options = listOf(
                AlbumSortOption.RECENTLY_ADDED to stringResource(R.string.recently_added),
                AlbumSortOption.TITLE to stringResource(R.string.title),
                AlbumSortOption.ARTIST to stringResource(R.string.artist),
            ),
            selected = sortOption,
            onSelect = {
                sortOption = it
                showSortSheet = false
            },
            onDismiss = { showSortSheet = false },
        )
    }
}

/**
 * Clean Two-Column Artwork Card matching Apple Music Library guidelines.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun RecentlyAddedGridCard(
    item: RecentlyAddedItem,
    isSelected: Boolean,
    isMultiSelectMode: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onPlay: () -> Unit,
    onPlayNext: () -> Unit,
    onAddToQueue: () -> Unit,
    onDownload: () -> Unit,
    onRemoveFromLibrary: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var menuExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .combinedClickable(
                onClick = onClick,
                onLongClick = {
                    if (isMultiSelectMode) onLongClick()
                    else menuExpanded = true
                },
            ),
    ) {
        // Large Square Artwork Card (1:1 aspect ratio)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(10.dp))
                .background(AmoledCardBackground),
            contentAlignment = Alignment.Center,
        ) {
            if (!item.artworkUrl.isNullOrBlank()) {
                AsyncImage(
                    model = item.artworkUrl.artworkAt(CARD_ART_PX),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.matchParentSize(),
                )
            } else {
                Icon(
                    imageVector = when (item) {
                        is RecentlyAddedItem.Album -> Icons.Rounded.Album
                        is RecentlyAddedItem.Playlist -> Icons.AutoMirrored.Rounded.QueueMusic
                        is RecentlyAddedItem.SingleSong -> Icons.Rounded.MusicNote
                    },
                    contentDescription = null,
                    tint = TextSecondaryGrey,
                    modifier = Modifier.size(48.dp),
                )
            }

            // Multi-Select Indicator (Apple Music circular selection badge)
            if (isMultiSelectMode) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(if (isSelected) Color.Black.copy(alpha = 0.45f) else Color.Transparent),
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(if (isSelected) RaagaCobaltBlue else Color.Black.copy(alpha = 0.35f))
                        .border(
                            width = if (isSelected) 0.dp else 1.5.dp,
                            color = if (isSelected) Color.Transparent else Color.White.copy(alpha = 0.7f),
                            shape = CircleShape,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Rounded.Check,
                            contentDescription = "Selected",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // Metadata: Title, Subtitle, and Contextual Action
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val byline = when (item) {
                    is RecentlyAddedItem.Album -> if (item.artist.isNotBlank()) "Album • ${item.artist}" else "Album"
                    is RecentlyAddedItem.Playlist -> item.subtitle
                    is RecentlyAddedItem.SingleSong -> item.subtitle
                }
                Text(
                    text = byline,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryGrey,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (!isMultiSelectMode) {
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
                        modifier = Modifier.background(Color(0xFF1E1E20)),
                    ) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.play), color = Color.White) },
                            leadingIcon = {
                                Icon(Icons.Rounded.PlayArrow, contentDescription = null, tint = Color.White)
                            },
                            onClick = {
                                menuExpanded = false
                                onPlay()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.play_next), color = Color.White) },
                            leadingIcon = {
                                Icon(Icons.AutoMirrored.Rounded.QueueMusic, contentDescription = null, tint = Color.White)
                            },
                            onClick = {
                                menuExpanded = false
                                onPlayNext()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.add_to_queue), color = Color.White) },
                            leadingIcon = {
                                Icon(Icons.AutoMirrored.Rounded.PlaylistAdd, contentDescription = null, tint = Color.White)
                            },
                            onClick = {
                                menuExpanded = false
                                onAddToQueue()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.download), color = Color.White) },
                            leadingIcon = {
                                Icon(Icons.Rounded.Download, contentDescription = null, tint = RaagaCobaltBlue)
                            },
                            onClick = {
                                menuExpanded = false
                                onDownload()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Remove from Library", color = Color(0xFFFF5252)) },
                            leadingIcon = {
                                Icon(Icons.Rounded.DeleteOutline, contentDescription = null, tint = Color(0xFFFF5252))
                            },
                            onClick = {
                                menuExpanded = false
                                onRemoveFromLibrary()
                            },
                        )
                    }
                }
            }
        }
    }
}
