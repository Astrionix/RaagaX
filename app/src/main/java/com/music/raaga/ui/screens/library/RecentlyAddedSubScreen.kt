package com.music.raaga.ui.screens.library

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import com.music.raaga.data.model.Song

/**
 * Song-Only Recently Added Smart Collection Sub-Screen.
 *
 * Collects newly added songs across all Library categories:
 * - Songs (liked / added individual songs)
 * - Albums (tracks from newly added albums)
 * - Playlists (tracks from newly saved/created playlists)
 * - Imports (local files, WebDAV, SMB)
 *
 * Categorized with scope chips ([All Songs], [Albums], [Playlists], [Imports]) and
 * grouped by relative calendar date headers (Today, Yesterday, Earlier This Week, etc.).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecentlyAddedSubScreen(
    onBack: () -> Unit,
    onSongClick: (List<Song>, Int) -> Unit,
    onSongLongPress: (Song) -> Unit = {},
    onAddToQueue: (List<Song>) -> Unit = {},
    onDownloadSelected: (List<Song>) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val allRecentTracks by LibrarySongAggregator.recentlyAddedTracks.collectAsState()
    var selectedCategory by remember { mutableStateOf(AdditionSourceType.ALL) }
    var searchQuery by remember { mutableStateOf("") }
    var isMultiSelectMode by remember { mutableStateOf(false) }
    val selectedSongIds = remember { mutableStateListOf<String>() }
    val gridState = rememberLazyGridState()

    // Filter by selected category chip and search query
    val filteredTracks = remember(allRecentTracks, selectedCategory, searchQuery) {
        val baseList = when (selectedCategory) {
            AdditionSourceType.ALL -> {
                // Deduplicate by videoId/localUri so each track appears only once in All Songs
                allRecentTracks.distinctBy { it.song.localUri ?: it.song.videoId }
            }
            AdditionSourceType.ALBUM -> allRecentTracks.filter { it.sourceType == AdditionSourceType.ALBUM }
            AdditionSourceType.PLAYLIST -> allRecentTracks.filter { it.sourceType == AdditionSourceType.PLAYLIST }
            AdditionSourceType.IMPORT -> allRecentTracks.filter { it.sourceType == AdditionSourceType.IMPORT }
            AdditionSourceType.SONG -> allRecentTracks.filter { it.sourceType == AdditionSourceType.SONG }
        }

        if (searchQuery.isBlank()) {
            baseList
        } else {
            val q = searchQuery.trim().lowercase()
            baseList.filter {
                it.song.title.lowercase().contains(q) ||
                    it.song.artist.lowercase().contains(q) ||
                    (it.song.albumName?.lowercase()?.contains(q) == true) ||
                    (it.sourceTitle?.lowercase()?.contains(q) == true)
            }
        }
    }

    // Group filtered tracks into relative date buckets
    val groupedSections = remember(filteredTracks) {
        val sections = LinkedHashMap<String, MutableList<RecentlyAddedTrack>>()
        filteredTracks.forEach { track ->
            val header = getRelativeDateHeader(track.addedAtEpochSeconds)
            sections.getOrPut(header) { mutableListOf() }.add(track)
        }
        sections
    }

    val playableSongs = remember(filteredTracks) {
        filteredTracks.map { it.song }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        // Top Action Bar with Back button, Search bar, and Select toggle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 8.dp, end = 8.dp, top = 2.dp, bottom = 2.dp),
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
            LibrarySearchBar(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                placeholder = "Search in Recently Added",
                modifier = Modifier.weight(1f),
                horizontalPadding = 0.dp,
            )
            TextButton(
                onClick = {
                    isMultiSelectMode = !isMultiSelectMode
                    if (!isMultiSelectMode) selectedSongIds.clear()
                },
            ) {
                Text(
                    text = if (isMultiSelectMode) stringResource(R.string.done) else "Select",
                    color = RaagaAccentRed,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        // Category Scope Filter Chips ([All Songs], [Albums], [Playlists], [Imports])
        FilterChipRow(
            chips = listOf(
                AdditionSourceType.ALL to "All Songs",
                AdditionSourceType.ALBUM to "Albums",
                AdditionSourceType.PLAYLIST to "Playlists",
                AdditionSourceType.IMPORT to "Imports",
            ),
            selected = selectedCategory,
            onSelect = { selectedCategory = it },
            modifier = Modifier.padding(vertical = 2.dp),
        )

        // Play & Shuffle Pill Buttons
        if (playableSongs.isNotEmpty() && !isMultiSelectMode) {
            PillActionRow(
                onPlay = { onSongClick(playableSongs, 0) },
                onShuffle = { onSongClick(playableSongs.shuffled(), 0) },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
            )
        }

        Box(modifier = Modifier.fillMaxSize()) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                state = gridState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                groupedSections.forEach { (sectionHeader, tracks) ->
                    // Date Header (Today, Yesterday, Earlier This Week, etc.) spanning both columns
                    item(span = { GridItemSpan(2) }, key = "header_$sectionHeader") {
                        Text(
                            text = sectionHeader,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
                        )
                    }

                    // Songs in this time section as CARDS
                    items(
                        items = tracks,
                        key = { "${it.sourceType}_${it.song.localUri ?: it.song.videoId}" },
                    ) { trackItem ->
                        val song = trackItem.song
                        val songId = song.localUri ?: song.videoId
                        val isSelected = songId in selectedSongIds

                        RecentlyAddedSongCard(
                            trackItem = trackItem,
                            isSelected = isSelected,
                            isMultiSelectMode = isMultiSelectMode,
                            onClick = {
                                if (isMultiSelectMode) {
                                    if (isSelected) selectedSongIds.remove(songId)
                                    else selectedSongIds.add(songId)
                                } else {
                                    val songIndex = playableSongs.indexOf(song).coerceAtLeast(0)
                                    onSongClick(playableSongs, songIndex)
                                }
                            },
                            onLongClick = {
                                onSongLongPress(song)
                            },
                            onAddToQueue = onAddToQueue,
                            onDownloadSelected = onDownloadSelected,
                        )
                    }
                }

                item(span = { GridItemSpan(2) }) {
                    Spacer(Modifier.height(if (isMultiSelectMode) 140.dp else 100.dp))
                }
            }

            // Bottom Multi-Select Floating Action Bar
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
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color(0xFF1E1E20))
                            .padding(horizontal = 20.dp, vertical = 10.dp),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Text(
                                text = "${selectedSongIds.size} selected",
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                            )
                            IconButton(
                                onClick = {
                                    val selected = playableSongs.filter { (it.localUri ?: it.videoId) in selectedSongIds }
                                    onAddToQueue(selected)
                                    isMultiSelectMode = false
                                    selectedSongIds.clear()
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.PlaylistAdd,
                                    contentDescription = "Add to Queue",
                                    tint = Color.White,
                                )
                            }
                            IconButton(
                                onClick = {
                                    val selected = playableSongs.filter { (it.localUri ?: it.videoId) in selectedSongIds }
                                    onDownloadSelected(selected)
                                    isMultiSelectMode = false
                                    selectedSongIds.clear()
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Download,
                                    contentDescription = "Download Selected",
                                    tint = RaagaAccentRed,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun RecentlyAddedSongCard(
    trackItem: RecentlyAddedTrack,
    isSelected: Boolean,
    isMultiSelectMode: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onAddToQueue: (List<Song>) -> Unit,
    onDownloadSelected: (List<Song>) -> Unit,
    modifier: Modifier = Modifier,
) {
    val song = trackItem.song
    var menuExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick,
            ),
    ) {
        // Square Artwork Card Top
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

            // In multi-select mode: show overlay and selection circle/check
            if (isMultiSelectMode) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(if (isSelected) Color.Black.copy(alpha = 0.45f) else Color.Transparent),
                )
                Icon(
                    imageVector = if (isSelected) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = if (isSelected) RaagaAccentRed else Color.White.copy(alpha = 0.85f),
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(24.dp),
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        // Title and 3-dot menu row
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
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
                            text = { Text(stringResource(R.string.play_next), color = Color.White) },
                            leadingIcon = {
                                Icon(Icons.Rounded.PlayArrow, contentDescription = null, tint = Color.White)
                            },
                            onClick = {
                                menuExpanded = false
                                onAddToQueue(listOf(song))
                            },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.add_to_queue), color = Color.White) },
                            leadingIcon = {
                                Icon(Icons.AutoMirrored.Rounded.QueueMusic, contentDescription = null, tint = Color.White)
                            },
                            onClick = {
                                menuExpanded = false
                                onAddToQueue(listOf(song))
                            },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.download), color = Color.White) },
                            leadingIcon = {
                                Icon(Icons.Rounded.Download, contentDescription = null, tint = Color.White)
                            },
                            onClick = {
                                menuExpanded = false
                                onDownloadSelected(listOf(song))
                            },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.share), color = Color.White) },
                            leadingIcon = {
                                Icon(Icons.Rounded.Share, contentDescription = null, tint = Color.White)
                            },
                            onClick = {
                                menuExpanded = false
                            },
                        )
                    }
                }
            }
        }
    }
}

