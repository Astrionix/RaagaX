package com.music.raaga.ui.screens.library

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.automirrored.rounded.Sort
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.DownloadDone
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.LibrarySongAggregator
import com.music.raaga.data.LocalMediaRepository
import com.music.raaga.data.model.Song
import com.music.raaga.download.Downloads
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Downloaded & Offline Music Screen:
 * Displays all offline downloads available on the mobile device and downloaded songs in Raaga.
 * Clean, pure track list with zero clutter, zero playlist cards, and no storage card.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DownloadedSubScreen(
    onBack: () -> Unit,
    onSongClick: (List<Song>, Int) -> Unit,
    onAddToQueue: (List<Song>) -> Unit = {},
    onDeleteSong: (Song) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val offlineSongs by LibrarySongAggregator.offlineSongs.collectAsState()
    val isLoadingOffline by LibrarySongAggregator.isLoadingOffline.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var currentSort by remember { mutableStateOf(SongSortOption.RECENTLY_ADDED) }
    var showSortSheet by remember { mutableStateOf(false) }
    var isMultiSelectMode by remember { mutableStateOf(false) }
    val selectedSongIds = remember { mutableStateListOf<String>() }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    // Load both Raaga downloads AND device storage audio into singleton memory cache
    LaunchedEffect(Unit) {
        LibrarySongAggregator.syncOfflineSongs(context)
    }

    // Filter and sort offline songs
    val displayedSongs = remember(offlineSongs, searchQuery, currentSort) {
        var list = offlineSongs
        if (searchQuery.isNotBlank()) {
            val q = searchQuery.trim().lowercase()
            list = list.filter {
                it.title.lowercase().contains(q) ||
                    it.artist.lowercase().contains(q) ||
                    (it.albumName?.lowercase()?.contains(q) == true)
            }
        }
        when (currentSort) {
            SongSortOption.TITLE -> list.sortedBy { it.title.lowercase() }
            SongSortOption.ARTIST -> list.sortedBy { it.artist.lowercase() }
            SongSortOption.ALBUM -> list.sortedBy { it.albumName.orEmpty().lowercase() }
            SongSortOption.DURATION -> list.sortedBy { it.durationText.orEmpty() }
            SongSortOption.MOST_PLAYED -> list
            SongSortOption.RECENTLY_ADDED -> list
        }
    }

    // Side fast-scroller mapping
    val letterIndexMap = remember(displayedSongs, currentSort, searchQuery) {
        val map = mutableMapOf<Char, Int>()
        if (currentSort == SongSortOption.TITLE && searchQuery.isBlank()) {
            displayedSongs.forEachIndexed { index, song ->
                val firstChar = song.title.trim().firstOrNull()?.uppercaseChar() ?: '#'
                val key = if (firstChar in 'A'..'Z') firstChar else '#'
                if (!map.containsKey(key)) {
                    map[key] = index
                }
            }
        }
        map
    }

    val availableLetters = remember(letterIndexMap) {
        val alphabet = ('A'..'Z').toList()
        val present = letterIndexMap.keys
        listOf('#') + alphabet.filter { it in present }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        // Action Bar: Search with Sort & Select toggle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 8.dp, top = 2.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LibrarySearchBar(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                placeholder = "Search in offline downloads",
                modifier = Modifier.weight(1f),
                horizontalPadding = 0.dp,
            )
            IconButton(onClick = { showSortSheet = true }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.Sort,
                    contentDescription = stringResource(R.string.sort_by),
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
            }
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

        // Play & Shuffle Pill Buttons with Track Count
        if (displayedSongs.isNotEmpty() && !isMultiSelectMode) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "${displayedSongs.size} offline songs",
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                    color = TextSecondaryGrey,
                )
            }

            PillActionRow(
                onPlay = { onSongClick(displayedSongs, 0) },
                onShuffle = { onSongClick(displayedSongs.shuffled(), 0) },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
            )
        }

        Box(modifier = Modifier.fillMaxSize()) {
            if (displayedSongs.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 32.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DownloadDone,
                            contentDescription = null,
                            tint = TextSecondaryGrey.copy(alpha = 0.5f),
                            modifier = Modifier.size(56.dp),
                        )
                        Text(
                            text = "No Offline Music Found",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                        )
                        Text(
                            text = "Downloaded songs in Raaga and audio files on your phone will appear here for offline listening.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondaryGrey,
                        )
                    }
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 20.dp),
                ) {
                    itemsIndexed(displayedSongs, key = { index, s -> "${s.localUri ?: s.videoId}_$index" }) { index, song ->
                        val isSelected = (song.localUri ?: song.videoId) in selectedSongIds
                        var menuExpanded by remember { mutableStateOf(false) }

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (isMultiSelectMode) {
                                        val key = song.localUri ?: song.videoId
                                        if (isSelected) selectedSongIds.remove(key)
                                        else selectedSongIds.add(key)
                                    } else {
                                        onSongClick(displayedSongs, index)
                                    }
                                },
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                if (isMultiSelectMode) {
                                    Icon(
                                        imageVector = if (isSelected) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked,
                                        contentDescription = null,
                                        tint = if (isSelected) RaagaAccentRed else TextSecondaryGrey,
                                        modifier = Modifier
                                            .padding(end = 12.dp)
                                            .size(22.dp),
                                    )
                                }

                                // Cover Artwork
                                Box(
                                    modifier = Modifier
                                        .size(50.dp)
                                        .clip(RoundedCornerShape(8.dp))
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
                                            modifier = Modifier.size(24.dp),
                                        )
                                    }
                                }

                                Spacer(Modifier.width(14.dp))

                                // Song metadata + Offline Done Indicator
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = song.title,
                                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                                        color = Color.White,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Spacer(Modifier.height(2.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Rounded.DownloadDone,
                                            contentDescription = "Offline Available",
                                            tint = Color(0xFF10B981),
                                            modifier = Modifier
                                                .padding(end = 6.dp)
                                                .size(15.dp),
                                        )
                                        val subtitle = buildString {
                                            append(song.artist)
                                            if (!song.albumName.isNullOrBlank()) {
                                                append(" · ")
                                                append(song.albumName)
                                            }
                                            if (!song.durationText.isNullOrBlank()) {
                                                append(" · ")
                                                append(song.durationText)
                                            }
                                        }
                                        Text(
                                            text = subtitle,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextSecondaryGrey,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
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
                                                modifier = Modifier.size(20.dp),
                                            )
                                        }
                                        DropdownMenu(
                                            expanded = menuExpanded,
                                            onDismissRequest = { menuExpanded = false },
                                            modifier = Modifier.background(AmoledCardBackground),
                                        ) {
                                            DropdownMenuItem(
                                                text = { Text("Play", color = Color.White) },
                                                leadingIcon = {
                                                    Icon(
                                                        imageVector = Icons.Rounded.PlayArrow,
                                                        contentDescription = null,
                                                        tint = RaagaAccentRed,
                                                    )
                                                },
                                                onClick = {
                                                    menuExpanded = false
                                                    onSongClick(displayedSongs, index)
                                                },
                                            )
                                            DropdownMenuItem(
                                                text = { Text(stringResource(R.string.add_to_queue), color = Color.White) },
                                                leadingIcon = {
                                                    Icon(
                                                        imageVector = Icons.AutoMirrored.Rounded.QueueMusic,
                                                        contentDescription = null,
                                                        tint = Color.White,
                                                    )
                                                },
                                                onClick = {
                                                    menuExpanded = false
                                                    onAddToQueue(listOf(song))
                                                },
                                            )
                                            DropdownMenuItem(
                                                text = { Text("Delete Download", color = RaagaAccentRed) },
                                                leadingIcon = {
                                                    Icon(
                                                        imageVector = Icons.Rounded.DeleteOutline,
                                                        contentDescription = null,
                                                        tint = RaagaAccentRed,
                                                    )
                                                },
                                                onClick = {
                                                    menuExpanded = false
                                                    onDeleteSong(song)
                                                    LibrarySongAggregator.removeOfflineSong(song)
                                                },
                                            )
                                        }
                                    }
                                }
                            }
                            HorizontalDivider(
                                thickness = 0.5.dp,
                                color = AmoledBorderColor,
                                modifier = Modifier.padding(start = if (isMultiSelectMode) 84.dp else 64.dp),
                            )
                        }
                    }

                    item {
                        Spacer(Modifier.height(if (isMultiSelectMode) 140.dp else 100.dp))
                    }
                }
            }

            // Side Alphabet Fast-Scroller (In Title sort mode)
            if (currentSort == SongSortOption.TITLE && searchQuery.isBlank() && availableLetters.size > 3) {
                AlphabetFastScroller(
                    letters = availableLetters,
                    onLetterSelected = { char ->
                        letterIndexMap[char]?.let { targetIndex ->
                            scope.launch {
                                listState.scrollToItem(targetIndex)
                            }
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .padding(end = 4.dp),
                )
            }
        }

        // Persistent Multi-select Bottom Action Bar
        AnimatedVisibility(
            visible = isMultiSelectMode && selectedSongIds.isNotEmpty(),
            enter = slideInVertically { it } + fadeIn(),
            exit = slideOutVertically { it } + fadeOut(),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFF1C1C1E))
                    .padding(horizontal = 20.dp, vertical = 14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${selectedSongIds.size} selected",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        IconButton(
                            onClick = {
                                val selected = offlineSongs.filter { (it.localUri ?: it.videoId) in selectedSongIds }
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
                                val selected = offlineSongs.filter { (it.localUri ?: it.videoId) in selectedSongIds }
                                selected.forEach {
                                    onDeleteSong(it)
                                    LibrarySongAggregator.removeOfflineSong(it)
                                }
                                isMultiSelectMode = false
                                selectedSongIds.clear()
                            },
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.DeleteOutline,
                                contentDescription = "Delete",
                                tint = RaagaAccentRed,
                            )
                        }
                    }
                }
            }
        }
    }

    // Sort Bottom Sheet
    if (showSortSheet) {
        GenericSortBottomSheet(
            title = stringResource(R.string.sort_by),
            options = SongSortOption.entries.map { it to stringResource(it.labelRes) },
            selected = currentSort,
            onSelect = { currentSort = it },
            onDismiss = { showSortSheet = false },
        )
    }
}
