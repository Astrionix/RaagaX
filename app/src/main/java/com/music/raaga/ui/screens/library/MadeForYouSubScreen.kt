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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.WbSunny
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.Song
import java.util.Calendar

data class DynamicMix(
    val id: String,
    val title: String,
    val subtitle: String,
    val songs: List<Song>,
    val icon: ImageVector,
    val gradient: List<Color>,
    val isReplay: Boolean = false,
)

/**
 * Made for You: Raaga's personalized discovery and recommendation hub.
 * Powered by the user's real listening history, library favorites, and algorithmic radio.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MadeForYouSubScreen(
    playlists: List<ShelfItem>,
    artists: List<ShelfItem>,
    songs: List<Song>,
    historySongs: List<Song> = emptyList(),
    onBack: () -> Unit,
    onPlayMix: (ShelfItem) -> Unit,
    onPlayQueue: (List<Song>, String) -> Unit,
    onStartRadio: ((Song) -> Unit)? = null,
    onOpenReplay: () -> Unit,
    onArtistClick: (ShelfItem) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    // Asynchronously fetch discovery recommendations
    var discoveryTracks by remember { mutableStateOf<List<Song>>(emptyList()) }
    LaunchedEffect(Unit) {
        val knownIds = (songs.map { it.videoId } + historySongs.map { it.videoId }).toSet()
        YtMusicRepository.quickPicks(excludeSongIds = knownIds).onSuccess { fresh ->
            if (fresh.isNotEmpty()) {
                discoveryTracks = fresh
            }
        }
    }

    // 1. Supermix tracks: Combines recently played + favorite library songs + discovery
    val supermixTracks = remember(songs, historySongs, discoveryTracks) {
        val pool = (historySongs + songs).distinctBy { it.videoId }
        if (pool.isNotEmpty()) {
            val shuffled = pool.shuffled()
            if (discoveryTracks.isNotEmpty()) {
                (shuffled.take(25) + discoveryTracks.take(15)).distinctBy { it.videoId }
            } else {
                shuffled.take(40)
            }
        } else if (discoveryTracks.isNotEmpty()) {
            discoveryTracks
        } else {
            emptyList()
        }
    }

    // 2. Favorites Mix: user's liked library songs
    val favoritesMixSongs = remember(songs, historySongs) {
        val pool = if (songs.isNotEmpty()) songs else historySongs
        pool.distinctBy { it.videoId }.shuffled().take(30)
    }

    // 3. Heavy Rotation / Replay Mix: recent history
    val heavyRotationSongs = remember(historySongs, songs) {
        if (historySongs.isNotEmpty()) historySongs.take(30)
        else songs.take(30)
    }

    // 4. Chill Mix: soft / acoustic / chill tracks
    val chillMixSongs = remember(songs, historySongs) {
        val pool = (songs + historySongs).distinctBy { it.videoId }
        val chillKeywords = listOf("chill", "acoustic", "slow", "piano", "lofi", "ambient", "calm", "relax", "rain", "sleep", "unplugged")
        val matching = pool.filter { s ->
            chillKeywords.any { k -> s.title.contains(k, ignoreCase = true) || s.artist.contains(k, ignoreCase = true) }
        }
        if (matching.size >= 8) matching.take(25)
        else pool.shuffled().take(25)
    }

    // 5. Energy Mix: upbeat tracks
    val energyMixSongs = remember(songs, historySongs) {
        val pool = (songs + historySongs).distinctBy { it.videoId }
        val energyKeywords = listOf("remix", "beat", "party", "club", "dance", "rock", "bass", "workout", "gym", "fast", "drill", "edm")
        val matching = pool.filter { s ->
            energyKeywords.any { k -> s.title.contains(k, ignoreCase = true) || s.artist.contains(k, ignoreCase = true) }
        }
        if (matching.size >= 8) matching.take(25)
        else pool.shuffled().take(25)
    }

    // Time-based mix
    val isNight = remember {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        hour >= 20 || hour < 5
    }

    // Discovery & Rotation Mixes list
    val discoveryMixes = remember(favoritesMixSongs, heavyRotationSongs, discoveryTracks) {
        listOf(
            DynamicMix(
                id = "favorites_mix",
                title = "Favorites Mix",
                subtitle = "Your heavy rotation & liked tracks",
                songs = favoritesMixSongs,
                icon = Icons.Rounded.AutoAwesome,
                gradient = listOf(Color(0xFFE53935), Color(0xFF8E24AA)),
            ),
            DynamicMix(
                id = "replay_mix",
                title = "Replay Stories",
                subtitle = "Your monthly milestones & top tracks",
                songs = emptyList(),
                icon = Icons.Rounded.Replay,
                gradient = listOf(Color(0xFF0039A6), Color(0xFF2979FF)),
                isReplay = true,
            ),
            DynamicMix(
                id = "heavy_rotation_mix",
                title = "Heavy Rotation",
                subtitle = "Tracks you play again and again",
                songs = heavyRotationSongs,
                icon = Icons.Rounded.History,
                gradient = listOf(Color(0xFF004D40), Color(0xFF00897B)),
            ),
            DynamicMix(
                id = "discovery_mix",
                title = "Discovery Mix",
                subtitle = "Fresh tracks picked for your taste",
                songs = discoveryTracks,
                icon = Icons.Rounded.AutoAwesome,
                gradient = listOf(Color(0xFF0047AB), Color(0xFFE53935)),
            ),
        )
    }

    // Daily Mood Mixes list
    val dailyMixes = remember(chillMixSongs, energyMixSongs, isNight) {
        listOf(
            DynamicMix(
                id = "chill_mix",
                title = "Chill Mix",
                subtitle = "Laid-back sounds to unwind",
                songs = chillMixSongs,
                icon = Icons.Rounded.Headphones,
                gradient = listOf(Color(0xFF0D47A1), Color(0xFF1976D2)),
            ),
            DynamicMix(
                id = "energy_mix",
                title = "Energy Mix",
                subtitle = "Upbeat rhythms to power through",
                songs = energyMixSongs,
                icon = Icons.Rounded.GraphicEq,
                gradient = listOf(Color(0xFFB71C1C), Color(0xFFE53935)),
            ),
            DynamicMix(
                id = if (isNight) "late_night_mix" else "morning_mix",
                title = if (isNight) "Late Night Mix" else "Morning Mix",
                subtitle = if (isNight) "Deep night sounds and night moods" else "Bright tunes to jumpstart your day",
                songs = if (isNight) chillMixSongs else energyMixSongs,
                icon = if (isNight) Icons.Rounded.MusicNote else Icons.Rounded.WbSunny,
                gradient = if (isNight) listOf(Color(0xFF1A237E), Color(0xFF311B92)) else listOf(Color(0xFFE65100), Color(0xFFFFB300)),
            ),
        )
    }

    // Top library artists for Artist Mixes
    val libraryArtists = remember(artists) {
        artists.take(8)
    }

    // Selected Mix for Detail Bottom Sheet
    var selectedMix by remember { mutableStateOf<DynamicMix?>(null) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
        contentPadding = PaddingValues(bottom = 120.dp),
    ) {
        // ── Hero Section: Your Supermix ──────────────────────────────────────
        item(key = "your_mix_hero") {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                Color(0xFFB71C1C),
                                Color(0xFF0039A6),
                                Color(0xFF1E88E5),
                            )
                        )
                    )
                    .clickable {
                        if (supermixTracks.isNotEmpty()) {
                            selectedMix = DynamicMix(
                                id = "your_supermix",
                                title = "Your Supermix",
                                subtitle = "Personalized continuous stream of your favorite songs & smart discovery.",
                                songs = supermixTracks,
                                icon = Icons.Rounded.AutoAwesome,
                                gradient = listOf(Color(0xFFB71C1C), Color(0xFF0039A6), Color(0xFF1E88E5)),
                            )
                        } else {
                            val first = playlists.firstOrNull()
                            if (first != null) onPlayMix(first)
                        }
                    }
                    .padding(24.dp),
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CobaltBadge(
                            text = "MADE FOR YOU",
                            backgroundColor = Color.Black.copy(alpha = 0.45f),
                            textColor = Color.White,
                        )
                        Icon(
                            imageVector = Icons.Rounded.AutoAwesome,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Spacer(Modifier.height(28.dp))
                    Text(
                        text = "Your Supermix",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 28.sp,
                        ),
                        color = Color.White,
                    )
                    Text(
                        text = if (supermixTracks.isNotEmpty()) "${supermixTracks.size} tracks tailored to your taste"
                        else stringResource(R.string.made_for_you_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.85f),
                        modifier = Modifier.padding(top = 4.dp, bottom = 18.dp),
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Button(
                            onClick = {
                                if (supermixTracks.isNotEmpty()) {
                                    onPlayQueue(supermixTracks, "Your Supermix")
                                } else {
                                    val first = playlists.firstOrNull()
                                    if (first != null) onPlayMix(first)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color.White,
                                contentColor = Color.Black,
                            ),
                            shape = CircleShape,
                            contentPadding = PaddingValues(horizontal = 22.dp, vertical = 8.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = stringResource(R.string.play),
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        if (supermixTracks.size > 1) {
                            Button(
                                onClick = {
                                    onPlayQueue(supermixTracks.shuffled(), "Your Supermix")
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.White.copy(alpha = 0.2f),
                                    contentColor = Color.White,
                                ),
                                shape = CircleShape,
                                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Shuffle,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp),
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    text = "Shuffle",
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
                }
            }
        }

        // ── Section: Discovery & Rotation Mixes ──────────────────────────────
        item(key = "discovery_mixes_header") {
            SectionHeader(
                title = "Discovery & Rotation",
                subtitle = "Continually updated from your listening habits",
            )
        }

        item(key = "discovery_mixes_row") {
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                items(discoveryMixes, key = { it.id }) { mix ->
                    MixCard(
                        title = mix.title,
                        subtitle = mix.subtitle,
                        icon = mix.icon,
                        gradient = mix.gradient,
                        trackCount = if (mix.isReplay) null else mix.songs.size,
                        onClick = {
                            if (mix.isReplay) {
                                onOpenReplay()
                            } else {
                                selectedMix = mix
                            }
                        },
                        onPlay = {
                            if (mix.isReplay) {
                                onOpenReplay()
                            } else if (mix.songs.isNotEmpty()) {
                                onPlayQueue(mix.songs, mix.title)
                            }
                        },
                    )
                }
            }
        }

        // ── Section: Daily Mood Mixes ────────────────────────────────────────
        item(key = "daily_mixes_header") {
            Spacer(Modifier.height(24.dp))
            SectionHeader(
                title = "Daily Mood Mixes",
                subtitle = "Curated rhythms for different parts of your day",
            )
        }

        item(key = "daily_mixes_row") {
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                items(dailyMixes, key = { it.id }) { mix ->
                    MixCard(
                        title = mix.title,
                        subtitle = mix.subtitle,
                        icon = mix.icon,
                        gradient = mix.gradient,
                        trackCount = mix.songs.size,
                        onClick = { selectedMix = mix },
                        onPlay = {
                            if (mix.songs.isNotEmpty()) {
                                onPlayQueue(mix.songs, mix.title)
                            }
                        },
                    )
                }
            }
        }

        // ── Section: Artist Mixes (From Real Library Artists) ────────────────
        if (libraryArtists.isNotEmpty()) {
            item(key = "artist_mixes_header") {
                Spacer(Modifier.height(24.dp))
                SectionHeader(
                    title = "Artist Mixes",
                    subtitle = "Stations crafted around your favorite artists",
                )
            }

            item(key = "artist_mixes_row") {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    items(libraryArtists, key = { "artist_mix_${it.browseId ?: it.title}" }) { artist ->
                        val artistSongs = remember(songs, historySongs, artist.title) {
                            (songs + historySongs).filter { s ->
                                s.artist.contains(artist.title, ignoreCase = true)
                            }.distinctBy { it.videoId }
                        }

                        ArtistMixCard(
                            artist = artist,
                            trackCount = artistSongs.size,
                            onClick = {
                                if (artistSongs.isNotEmpty()) {
                                    selectedMix = DynamicMix(
                                        id = "artist_${artist.browseId ?: artist.title}",
                                        title = "${artist.title} Mix",
                                        subtitle = "Featuring songs by ${artist.title} and related tracks from your library.",
                                        songs = artistSongs,
                                        icon = Icons.Rounded.Person,
                                        gradient = listOf(Color(0xFF212121), Color(0xFF0039A6)),
                                    )
                                } else {
                                    onArtistClick(artist)
                                }
                            },
                            onPlay = {
                                if (artistSongs.isNotEmpty()) {
                                    onPlayQueue(artistSongs, "${artist.title} Mix")
                                } else if (onStartRadio != null && songs.isNotEmpty()) {
                                    onStartRadio(songs.first())
                                } else {
                                    onArtistClick(artist)
                                }
                            },
                        )
                    }
                }
            }
        }
    }

    // ── Mix Detail Modal Bottom Sheet ────────────────────────────────────────
    selectedMix?.let { mix ->
        ModalBottomSheet(
            onDismissRequest = { selectedMix = null },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Color(0xFF141414),
            contentColor = Color.White,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 32.dp),
            ) {
                // Header: Gradient Card & Info
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Brush.linearGradient(mix.gradient)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = mix.icon,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(32.dp),
                        )
                    }
                    Spacer(Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = mix.title,
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = if (mix.songs.isNotEmpty()) "${mix.songs.size} tracks available" else mix.subtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryGrey,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    IconButton(onClick = { selectedMix = null }) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "Close",
                            tint = TextSecondaryGrey,
                        )
                    }
                }

                // Action Buttons: Play & Shuffle
                if (mix.songs.isNotEmpty()) {
                    PillActionRow(
                        onPlay = {
                            selectedMix = null
                            onPlayQueue(mix.songs, mix.title)
                        },
                        onShuffle = {
                            selectedMix = null
                            onPlayQueue(mix.songs.shuffled(), mix.title)
                        },
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                    )
                }

                HorizontalDivider(
                    thickness = 0.5.dp,
                    color = AmoledBorderColor,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                )

                // Track List
                if (mix.songs.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Loading personalized recommendations...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondaryGrey,
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(360.dp),
                        contentPadding = PaddingValues(horizontal = 20.dp),
                    ) {
                        itemsIndexed(mix.songs, key = { index, s -> "${s.videoId}_$index" }) { index, song ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selectedMix = null
                                        onPlayQueue(mix.songs.drop(index) + mix.songs.take(index), mix.title)
                                    }
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(46.dp)
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
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = song.title,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                        color = Color.White,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        text = song.artist,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextSecondaryGrey,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                                IconButton(
                                    onClick = {
                                        selectedMix = null
                                        onPlayQueue(listOf(song), mix.title)
                                    },
                                    modifier = Modifier.size(36.dp),
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.PlayArrow,
                                        contentDescription = "Play",
                                        tint = RaagaAccentRed,
                                        modifier = Modifier.size(22.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
            color = Color.White,
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondaryGrey,
        )
    }
}

@Composable
private fun MixCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    gradient: List<Color>,
    trackCount: Int?,
    onClick: () -> Unit,
    onPlay: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier
            .width(168.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = AmoledCardBackground),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Brush.linearGradient(gradient)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(48.dp),
                )
                // Play pill overlay button
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(10.dp)
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.7f))
                        .clickable(onClick = onPlay),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = if (trackCount != null && trackCount > 0) "$trackCount tracks" else subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryGrey,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun ArtistMixCard(
    artist: ShelfItem,
    trackCount: Int,
    onClick: () -> Unit,
    onPlay: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier
            .width(150.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = AmoledCardBackground),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(108.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF1F1F1F)),
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
                        modifier = Modifier.size(48.dp),
                    )
                }
                // Play overlay button
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(RaagaAccentRed)
                        .clickable(onClick = onPlay),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(
                text = "${artist.title} Mix",
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = if (trackCount > 0) "$trackCount in library" else "Artist Station",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondaryGrey,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
