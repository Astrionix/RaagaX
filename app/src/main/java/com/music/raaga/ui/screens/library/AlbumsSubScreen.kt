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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Queue
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Sort
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.model.ShelfItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlbumsSubScreen(
    albums: List<ShelfItem>,
    onBack: () -> Unit,
    onAlbumClick: (ShelfItem) -> Unit,
    onPlayAll: () -> Unit = {},
    onShuffleAll: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var searchQuery by remember { mutableStateOf("") }
    var currentSort by remember { mutableStateOf(AlbumSortOption.RECENTLY_ADDED) }
    var showSortSheet by remember { mutableStateOf(false) }

    // Filter and sort albums - All albums shown directly without sub-category splits
    val displayedAlbums = remember(albums, searchQuery, currentSort) {
        var list = albums
        if (searchQuery.isNotBlank()) {
            val q = searchQuery.trim().lowercase()
            list = list.filter {
                it.title.lowercase().contains(q) || it.subtitle.lowercase().contains(q)
            }
        }
        when (currentSort) {
            AlbumSortOption.TITLE -> list.sortedBy { it.title.lowercase() }
            AlbumSortOption.ARTIST -> list.sortedBy { it.subtitle.lowercase() }
            AlbumSortOption.RECENTLY_ADDED -> list
            AlbumSortOption.RELEASE_DATE -> list.reversed()
        }
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
                .padding(start = 16.dp, end = 8.dp, top = 2.dp, bottom = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LibrarySearchBar(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                placeholder = stringResource(R.string.search_in_albums),
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

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Play and Shuffle Pills
            if (displayedAlbums.isNotEmpty()) {
                item(span = { GridItemSpan(2) }) {
                    PillActionRow(
                        onPlay = {
                            if (displayedAlbums.isNotEmpty()) {
                                onAlbumClick(displayedAlbums.first())
                            }
                        },
                        onShuffle = onShuffleAll,
                        modifier = Modifier.padding(horizontal = 0.dp, vertical = 4.dp),
                    )
                }
            }

            items(displayedAlbums, key = { it.browseId ?: it.title }) { album ->
                var menuExpanded by remember { mutableStateOf(false) }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onAlbumClick(album) },
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(AmoledCardBackground),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (!album.thumbnailUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = album.thumbnailUrl,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.matchParentSize(),
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Rounded.Album,
                                contentDescription = null,
                                tint = TextSecondaryGrey,
                                modifier = Modifier.size(48.dp),
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = album.title,
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (album.subtitle.isNotBlank()) {
                                Text(
                                    text = album.subtitle,
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
                                    text = { Text("Play Album", color = Color.White) },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Rounded.PlayArrow,
                                            contentDescription = null,
                                            tint = RaagaAccentRed,
                                        )
                                    },
                                    onClick = {
                                        menuExpanded = false
                                        onAlbumClick(album)
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Add to Queue", color = Color.White) },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Rounded.Queue,
                                            contentDescription = null,
                                            tint = Color.White,
                                        )
                                    },
                                    onClick = {
                                        menuExpanded = false
                                        onAlbumClick(album)
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Download Album", color = Color.White) },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Rounded.Download,
                                            contentDescription = null,
                                            tint = Color.White,
                                        )
                                    },
                                    onClick = {
                                        menuExpanded = false
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Share", color = Color.White) },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Rounded.Share,
                                            contentDescription = null,
                                            tint = Color.White,
                                        )
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

            item(span = { GridItemSpan(2) }) {
                Spacer(Modifier.height(100.dp))
            }
        }
    }

    // Sort Bottom Sheet
    if (showSortSheet) {
        GenericSortBottomSheet(
            title = stringResource(R.string.sort_by),
            options = AlbumSortOption.entries.map { it to stringResource(it.labelRes) },
            selected = currentSort,
            onSelect = { currentSort = it },
            onDismiss = { showSortSheet = false },
        )
    }
}
