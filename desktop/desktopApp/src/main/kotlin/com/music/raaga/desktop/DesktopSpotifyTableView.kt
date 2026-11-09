package com.music.raaga.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.music.raaga.data.model.Song
import com.music.raaga.ui.icons.RaagaIcons

/**
 * Spotify-style Playlist & Liked Songs table screen.
 *
 * Implements the Spotify Desktop layout:
 * - 232dp Hero header with dynamic or gradient artwork, bold 72sp title, and user metadata
 * - Action row with 56dp Spotify-green circular play hero, shuffle, download, and List view dropdown
 * - Interactive track table: #, Title, Album, Date added, and Duration columns
 * - Hover row styling with play buttons, green heart toggles, and contextual actions
 */
@Composable
internal fun DesktopSpotifyTableView(
    title: String,
    subtitle: String,
    category: String = "Playlist",
    gradientColors: List<Color> = listOf(Color(0xFF450AF5), Color(0xFF8E8EE5)),
    artworkUrl: String? = null,
    isLikedSongs: Boolean = false,
    songs: List<Song>,
    likedIds: Set<String>,
    currentSongId: String? = null,
    onPlaySongs: (List<Song>, Int) -> Unit,
    onShuffle: (List<Song>) -> Unit,
    onToggleLike: (Song) -> Unit,
    onAddToPlaylist: ((Song) -> Unit)? = null,
    onDownload: ((Song) -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    val backdropColor = gradientColors.firstOrNull() ?: Color(0xFF450AF5)
    var searchQuery by remember(title) { mutableStateOf("") }
    val filteredSongs = remember(songs, searchQuery) {
        val q = searchQuery.trim().lowercase()
        if (q.isBlank()) songs else {
            songs.filter {
                it.title.lowercase().contains(q) ||
                    it.artist.lowercase().contains(q) ||
                    it.albumName.orEmpty().lowercase().contains(q)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF121212)),
    ) {
        // Gradient overlay at top
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(340.dp)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            backdropColor.copy(alpha = 0.85f),
                            backdropColor.copy(alpha = 0.35f),
                            Color(0xFF121212),
                        ),
                    ),
                ),
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = 24.dp,
                end = 24.dp,
                top = 24.dp + contentPadding.calculateTopPadding(),
                bottom = 48.dp,
            ),
        ) {
            // 1. Hero Header
            item(key = "header:hero") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    // Artwork (232dp)
                    if (isLikedSongs) {
                        Box(
                            modifier = Modifier
                                .size(232.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Brush.linearGradient(gradientColors)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = RaagaIcons.HeartFilled,
                                contentDescription = "Liked Songs",
                                tint = Color.White,
                                modifier = Modifier.size(80.dp),
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .size(232.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF282828)),
                        ) {
                            DesktopArtwork(
                                url = artworkUrl ?: songs.firstOrNull()?.thumbnailUrl,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }

                    Spacer(Modifier.width(24.dp))

                    // Title & Metadata
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = category.uppercase(),
                            color = Color.White.copy(alpha = 0.90f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = title,
                            color = Color.White,
                            fontSize = if (title.length > 20) 48.sp else 68.sp,
                            fontWeight = FontWeight.Black,
                            lineHeight = if (title.length > 20) 52.sp else 74.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.height(14.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            // User avatar pill / circle
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF1DB954)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = "R",
                                    color = Color.Black,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = subtitle,
                                color = Color.White.copy(alpha = 0.85f),
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                }
            }

            // 2. Action Controls Bar
            item(key = "header:actions") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Spotify 56dp green circular play button
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF1DB954))
                            .clickable {
                                val toPlay = if (searchQuery.isNotBlank()) filteredSongs else songs
                                if (toPlay.isNotEmpty()) onPlaySongs(toPlay, 0)
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.PlayArrow,
                            contentDescription = "Play",
                            tint = Color.Black,
                            modifier = Modifier.size(32.dp),
                        )
                    }

                    Spacer(Modifier.width(20.dp))

                    // Shuffle Button
                    IconButton(
                        onClick = {
                            val toShuffle = if (searchQuery.isNotBlank()) filteredSongs else songs
                            if (toShuffle.isNotEmpty()) onShuffle(toShuffle)
                        },
                        modifier = Modifier.size(40.dp),
                    ) {
                        Icon(
                            imageVector = RaagaIcons.Shuffle,
                            contentDescription = "Shuffle",
                            tint = Color.White.copy(alpha = 0.70f),
                            modifier = Modifier.size(24.dp),
                        )
                    }

                    Spacer(Modifier.width(10.dp))

                    // Download Button
                    IconButton(
                        onClick = {
                            val toDownload = if (searchQuery.isNotBlank()) filteredSongs else songs
                            toDownload.forEach { onDownload?.invoke(it) }
                        },
                        modifier = Modifier.size(40.dp),
                    ) {
                        Icon(
                            imageVector = RaagaIcons.Download,
                            contentDescription = "Download",
                            tint = Color.White.copy(alpha = 0.70f),
                            modifier = Modifier.size(24.dp),
                        )
                    }

                    Spacer(Modifier.weight(1f))

                    // "List ≣" layout selector
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .clickable {}
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    ) {
                        Text(
                            text = "List",
                            color = Color.White.copy(alpha = 0.70f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                        )
                        Spacer(Modifier.width(6.dp))
                        Icon(
                            imageVector = RaagaIcons.Queue,
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.70f),
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            // Search Bar Row (matching web UX)
            if (songs.isNotEmpty()) {
                item(key = "header:search") {
                    DesktopPlaylistSearchBar(
                        query = searchQuery,
                        onQueryChange = { searchQuery = it },
                        totalCount = songs.size,
                        filteredCount = filteredSongs.size,
                        modifier = Modifier.padding(bottom = 12.dp),
                        placeholder = "Search in playlist…",
                    )
                }
            }

            // 3. Table Headers Row
            item(key = "header:table_columns") {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "#",
                            color = Color.White.copy(alpha = 0.60f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.width(36.dp),
                        )
                        Text(
                            text = "Title",
                            color = Color.White.copy(alpha = 0.60f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(4f),
                        )
                        Text(
                            text = "Album",
                            color = Color.White.copy(alpha = 0.60f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(3f),
                        )
                        Text(
                            text = "Date added",
                            color = Color.White.copy(alpha = 0.60f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(2f),
                        )
                        Box(
                            modifier = Modifier.width(96.dp),
                            contentAlignment = Alignment.CenterEnd,
                        ) {
                            Icon(
                                imageVector = RaagaIcons.Clock,
                                contentDescription = "Duration",
                                tint = Color.White.copy(alpha = 0.60f),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                    HorizontalDivider(
                        color = Color.White.copy(alpha = 0.10f),
                        thickness = 1.dp,
                        modifier = Modifier.padding(bottom = 6.dp),
                    )
                }
            }

            // 4. Track Table Rows
            if (searchQuery.isNotBlank() && filteredSongs.isEmpty()) {
                item(key = "empty:search") {
                    DesktopPlaylistEmptySearch(query = searchQuery)
                }
            } else {
                itemsIndexed(filteredSongs, key = { index, song -> "${song.videoId}-$index" }) { index, song ->
                    SpotifyTrackRow(
                        index = index + 1,
                        song = song,
                        isLiked = song.videoId in likedIds,
                        isPlaying = song.videoId == currentSongId,
                        onPlay = { onPlaySongs(filteredSongs, index) },
                        onToggleLike = { onToggleLike(song) },
                        onAddToPlaylist = { onAddToPlaylist?.invoke(song) },
                    )
                }
            }

            // 5. Spotify Footer Links
            item(key = "footer:links") {
                Spacer(Modifier.height(56.dp))
                HorizontalDivider(color = Color.White.copy(alpha = 0.10f), thickness = 1.dp)
                Spacer(Modifier.height(32.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Company", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                        Text("About", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                        Text("Jobs", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                        Text("For the Record", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Communities", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                        Text("For Artists", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                        Text("Developers", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                        Text("Advertising", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Useful links", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                        Text("Support", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                        Text("Free Mobile App", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Raaga Plans", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                        Text("Premium Individual", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                        Text("Premium Duo", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                        Text("Premium Family", color = Color.White.copy(alpha = 0.65f), fontSize = 12.5.sp)
                    }
                }
                Spacer(Modifier.height(32.dp))
            }
        }
    }
}

@Composable
private fun SpotifyTrackRow(
    index: Int,
    song: Song,
    isLiked: Boolean,
    isPlaying: Boolean,
    onPlay: () -> Unit,
    onToggleLike: () -> Unit,
    onAddToPlaylist: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isHovered by interactionSource.collectIsHoveredAsState()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(4.dp))
            .background(if (isHovered) Color(0xFF2A2A2A) else Color.Transparent)
            .hoverable(interactionSource)
            .clickable { onPlay() }
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Track Index / Play Hover Button
        Box(
            modifier = Modifier.width(36.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            if (isHovered) {
                Icon(
                    imageVector = Icons.Rounded.PlayArrow,
                    contentDescription = "Play",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp),
                )
            } else if (isPlaying) {
                Text(
                    text = index.toString(),
                    color = Color(0xFF1DB954),
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                )
            } else {
                Text(
                    text = index.toString(),
                    color = Color.White.copy(alpha = 0.60f),
                    fontSize = 13.sp,
                )
            }
        }

        // Title Column (Artwork + Title + Artist)
        Row(
            modifier = Modifier.weight(4f),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFF282828)),
            ) {
                DesktopArtwork(
                    url = song.thumbnailUrl,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = song.title,
                    color = if (isPlaying) Color(0xFF1DB954) else Color.White,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = song.artist,
                    color = Color.White.copy(alpha = 0.65f),
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Album Column
        Text(
            text = song.albumName ?: song.title,
            color = Color.White.copy(alpha = 0.65f),
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .weight(3f)
                .padding(end = 12.dp),
        )

        // Date Added Column
        Text(
            text = "Sep 13, 2026",
            color = Color.White.copy(alpha = 0.60f),
            fontSize = 12.5.sp,
            maxLines = 1,
            modifier = Modifier.weight(2f),
        )

        // Right Actions (Heart, Duration, Options)
        Row(
            modifier = Modifier.width(96.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.End,
        ) {
            // Heart button
            if (isLiked || isHovered) {
                IconButton(
                    onClick = onToggleLike,
                    modifier = Modifier.size(28.dp),
                ) {
                    Icon(
                        imageVector = if (isLiked) RaagaIcons.HeartFilled else RaagaIcons.Heart,
                        contentDescription = "Like",
                        tint = if (isLiked) Color(0xFF1DB954) else Color.White.copy(alpha = 0.70f),
                        modifier = Modifier.size(16.dp),
                    )
                }
            } else {
                Spacer(Modifier.width(28.dp))
            }

            Spacer(Modifier.width(8.dp))

            // Duration
            Text(
                text = song.durationText ?: "3:30",
                color = Color.White.copy(alpha = 0.65f),
                fontSize = 12.5.sp,
                modifier = Modifier.width(36.dp),
            )

            // Context Menu
            if (isHovered) {
                IconButton(
                    onClick = onAddToPlaylist,
                    modifier = Modifier.size(24.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.MoreHoriz,
                        contentDescription = "More",
                        tint = Color.White.copy(alpha = 0.70f),
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

