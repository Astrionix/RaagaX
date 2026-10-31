package com.music.raaga.ui.screens.library

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.Sort
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.settings.AppSettings
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArtistsSubScreen(
    artists: List<ShelfItem>,
    onBack: () -> Unit,
    onArtistClick: (ShelfItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    var searchQuery by remember { mutableStateOf("") }
    var currentSort by remember { mutableStateOf(ArtistSortOption.NAME) }
    var showSortSheet by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    val pinnedArtistKeys by AppSettings.pinnedArtists.collectAsStateWithLifecycle()

    // Filter and sort artists
    val displayedArtists = remember(artists, searchQuery, currentSort) {
        var list = artists
        if (searchQuery.isNotBlank()) {
            val q = searchQuery.trim().lowercase()
            list = list.filter { it.title.lowercase().contains(q) }
        }
        when (currentSort) {
            ArtistSortOption.NAME -> list.sortedBy { it.title.lowercase() }
            ArtistSortOption.RECENTLY_ADDED -> list.reversed()
        }
    }

    // Pinned artists
    val pinnedArtists = remember(artists, pinnedArtistKeys) {
        if (pinnedArtistKeys.isEmpty()) emptyList()
        else artists.filter { (it.browseId ?: it.title) in pinnedArtistKeys }
    }

    // Map letters to first index for fast scrolling
    val letterIndexMap = remember(displayedArtists, pinnedArtists, searchQuery) {
        val map = mutableMapOf<Char, Int>()
        val baseOffset = if (searchQuery.isBlank() && pinnedArtists.isNotEmpty()) 1 else 0
        displayedArtists.forEachIndexed { index, artist ->
            val firstChar = artist.title.trim().firstOrNull()?.uppercaseChar() ?: '#'
            val key = if (firstChar in 'A'..'Z') firstChar else '#'
            if (!map.containsKey(key)) {
                map[key] = index + baseOffset
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
        // Action Bar: Search with Sort
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 8.dp, top = 2.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LibrarySearchBar(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                placeholder = stringResource(R.string.search_in_artists),
                modifier = Modifier.weight(1f),
                horizontalPadding = 0.dp,
            )
            IconButton(onClick = { showSortSheet = true }) {
                Icon(
                    imageVector = Icons.Rounded.Sort,
                    contentDescription = stringResource(R.string.sort_by),
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
            ) {
                // Portrait Cards Carousel: Pinned Artists (Only when user pinned artists)
                if (searchQuery.isBlank() && pinnedArtists.isNotEmpty()) {
                    item(key = "pinned_artists_carousel") {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 12.dp),
                        ) {
                            Text(
                                text = stringResource(R.string.pinned_artists),
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp),
                            )
                            LazyRow(
                                modifier = Modifier.fillMaxWidth(),
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                            ) {
                                items(pinnedArtists, key = { "pinned_${it.browseId ?: it.title}" }) { artist ->
                                    Column(
                                        modifier = Modifier
                                            .width(96.dp)
                                            .clickable { onArtistClick(artist) },
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(88.dp)
                                                .clip(CircleShape)
                                                .background(AmoledCardBackground),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            if (!artist.thumbnailUrl.isNullOrBlank()) {
                                                AsyncImage(
                                                    model = artist.thumbnailUrl,
                                                    contentDescription = null,
                                                    contentScale = ContentScale.Crop,
                                                    modifier = Modifier.matchParentSize(),
                                                )
                                            } else {
                                                Icon(
                                                    imageVector = Icons.Rounded.Person,
                                                    contentDescription = null,
                                                    tint = TextSecondaryGrey,
                                                    modifier = Modifier.size(40.dp),
                                                )
                                            }
                                            // Pinned badge icon
                                            Box(
                                                modifier = Modifier
                                                    .align(Alignment.BottomEnd)
                                                    .padding(2.dp)
                                                    .size(22.dp)
                                                    .clip(CircleShape)
                                                    .background(Color.Black.copy(alpha = 0.85f)),
                                                contentAlignment = Alignment.Center,
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Rounded.PushPin,
                                                    contentDescription = "Pinned",
                                                    tint = RaagaAccentRed,
                                                    modifier = Modifier.size(13.dp),
                                                )
                                            }
                                        }
                                        Spacer(Modifier.height(8.dp))
                                        Text(
                                            text = artist.title,
                                            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                                            color = Color.White,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                            HorizontalDivider(
                                thickness = 0.5.dp,
                                color = AmoledBorderColor,
                                modifier = Modifier.padding(horizontal = 20.dp),
                            )
                        }
                    }
                }

                // Alphabetical List Items
                itemsIndexed(displayedArtists, key = { _, it -> it.browseId ?: it.title }) { index, artist ->
                    val artistKey = artist.browseId ?: artist.title
                    val isPinned = artistKey in pinnedArtistKeys

                    val firstChar = artist.title.trim().firstOrNull()?.uppercaseChar() ?: '#'
                    val currentSection = if (firstChar in 'A'..'Z') firstChar else '#'
                    val prevChar = if (index > 0) {
                        val prev = displayedArtists[index - 1].title.trim().firstOrNull()?.uppercaseChar() ?: '#'
                        if (prev in 'A'..'Z') prev else '#'
                    } else null

                    val isSectionHeader = prevChar != currentSection
                    var menuExpanded by remember { mutableStateOf(false) }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onArtistClick(artist) }
                            .padding(horizontal = 20.dp),
                    ) {
                        if (isSectionHeader && searchQuery.isBlank() && currentSort == ArtistSortOption.NAME) {
                            Text(
                                text = currentSection.toString(),
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = RaagaAccentRed,
                                modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
                            )
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(CircleShape)
                                    .background(AmoledCardBackground),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (!artist.thumbnailUrl.isNullOrBlank()) {
                                    AsyncImage(
                                        model = artist.thumbnailUrl,
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.matchParentSize(),
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Rounded.Person,
                                        contentDescription = null,
                                        tint = TextSecondaryGrey,
                                        modifier = Modifier.size(28.dp),
                                    )
                                }
                            }
                            Spacer(Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = artist.title,
                                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                                    color = Color.White,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Artist",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryGrey,
                                    )
                                    if (isPinned) {
                                        Spacer(Modifier.width(6.dp))
                                        Icon(
                                            imageVector = Icons.Rounded.PushPin,
                                            contentDescription = "Pinned",
                                            tint = RaagaAccentRed,
                                            modifier = Modifier.size(13.dp),
                                        )
                                    }
                                }
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
                                        text = { Text("Play Artist", color = Color.White) },
                                        leadingIcon = {
                                            Icon(
                                                imageVector = Icons.Rounded.PlayArrow,
                                                contentDescription = null,
                                                tint = RaagaAccentRed,
                                            )
                                        },
                                        onClick = {
                                            menuExpanded = false
                                            onArtistClick(artist)
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = { Text("Shuffle Artist", color = Color.White) },
                                        leadingIcon = {
                                            Icon(
                                                imageVector = Icons.Rounded.Shuffle,
                                                contentDescription = null,
                                                tint = Color.White,
                                            )
                                        },
                                        onClick = {
                                            menuExpanded = false
                                            onArtistClick(artist)
                                        },
                                    )
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = if (isPinned) stringResource(R.string.unpin_artist) else stringResource(R.string.pin_artist),
                                                color = Color.White,
                                            )
                                        },
                                        leadingIcon = {
                                            Icon(
                                                imageVector = Icons.Rounded.PushPin,
                                                contentDescription = null,
                                                tint = if (isPinned) RaagaAccentRed else Color.White,
                                            )
                                        },
                                        onClick = {
                                            menuExpanded = false
                                            AppSettings.togglePinnedArtist(artistKey)
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

            // Alphabet Fast-Scroller (Only in alphabetical sort with no active search)
            if (searchQuery.isBlank() && currentSort == ArtistSortOption.NAME && availableLetters.size > 3) {
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
    }

    // Sort Bottom Sheet
    if (showSortSheet) {
        GenericSortBottomSheet(
            title = stringResource(R.string.sort_by),
            options = ArtistSortOption.entries.map { it to stringResource(it.labelRes) },
            selected = currentSort,
            onSelect = { currentSort = it },
            onDismiss = { showSortSheet = false },
        )
    }
}
