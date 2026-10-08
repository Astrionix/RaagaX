package com.music.raaga.desktop

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.QueueMusic
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.music.raaga.data.model.PlaylistPrivacy
import com.music.raaga.data.model.Song
import kotlinx.coroutines.launch

private val SpotifyGreen = Color(0xFF1DB954)
private val SpotifyCardBg = Color(0xFF181818)
private val SpotifyBorder = Color(0xFF282828)

@Composable
internal fun DesktopSpotifySyncDialog(
    onDismiss: () -> Unit,
    onLikedIdsChanged: ((Set<String>) -> Unit)? = null,
    onPlaylistsChanged: ((List<DesktopPlaylist>) -> Unit)? = null,
) {
    var selectedTab by remember { mutableStateOf(0) }
    val authState by DesktopSpotifyAuthManager.authState.collectAsState()
    val syncState by DesktopSpotifySyncManager.syncState.collectAsState()
    val isSyncing by DesktopSpotifySyncManager.isSyncing.collectAsState()

    val scope = rememberCoroutineScope()

    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 640) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp)
        ) {
            // Header bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = panelInset(20.dp), vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(SpotifyGreen.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("♫", color = SpotifyGreen, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    }
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(
                            "Spotify Sync & Library Import",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            "Direct Liked Songs Sync & Batch Playlist Import",
                            style = MaterialTheme.typography.bodySmall,
                            color = DesktopSecondary,
                        )
                    }
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = DesktopSecondary, modifier = Modifier.size(18.dp))
                }
            }

            // Tab Switcher
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = panelInset(20.dp), vertical = 4.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(4.dp),
            ) {
                TabPill(
                    selected = selectedTab == 0,
                    text = "Spotify Account",
                    modifier = Modifier.weight(1f),
                    onClick = { selectedTab = 0 },
                )
                TabPill(
                    selected = selectedTab == 1,
                    text = "Import from Link",
                    modifier = Modifier.weight(1f),
                    onClick = { selectedTab = 1 },
                )
            }

            Spacer(Modifier.height(10.dp))

            // Body
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 520.dp)
                    .padding(horizontal = panelInset(20.dp))
            ) {
                if (selectedTab == 0) {
                    AccountSyncTab(
                        authState = authState,
                        syncState = syncState,
                        isSyncing = isSyncing,
                        onLikedIdsChanged = onLikedIdsChanged,
                        onPlaylistsChanged = onPlaylistsChanged,
                    )
                } else {
                    LinkImportTab(
                        onPlaylistsChanged = onPlaylistsChanged,
                    )
                }
            }
        }
    }
}

@Composable
private fun TabPill(
    selected: Boolean,
    text: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) SpotifyGreen else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            color = if (selected) Color.Black else Color.White.copy(alpha = 0.75f),
        )
    }
}

@Composable
private fun AccountSyncTab(
    authState: DesktopSpotifyAuthState,
    syncState: DesktopSpotifySyncProgress,
    isSyncing: Boolean,
    onLikedIdsChanged: ((Set<String>) -> Unit)?,
    onPlaylistsChanged: ((List<DesktopPlaylist>) -> Unit)?,
) {
    val scroll = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(scroll)
            .padding(vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        when (authState) {
            is DesktopSpotifyAuthState.LoggedIn -> {
                ConnectedProfileCard(
                    profile = authState,
                    onDisconnect = { DesktopSpotifyAuthManager.disconnect() },
                )

                // Card 1: Liked Songs Direct Sync
                LikedSongsSyncCard(
                    syncState = syncState,
                    isSyncing = isSyncing,
                    onStartSync = {
                        DesktopSpotifySyncManager.syncLikedSongs(
                            createDedicatedPlaylist = true,
                            onLikedIdsChanged = onLikedIdsChanged,
                            onPlaylistsChanged = onPlaylistsChanged,
                        )
                    },
                    onCancelSync = { DesktopSpotifySyncManager.cancelSync() },
                )

                // Card 2: Full Library Playlists Import
                FullLibraryImportCard(
                    syncState = syncState,
                    isSyncing = isSyncing,
                    onPlaylistsChanged = onPlaylistsChanged,
                )
            }
            is DesktopSpotifyAuthState.LoggingIn -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(SpotifyCardBg)
                        .border(1.dp, SpotifyBorder, RoundedCornerShape(16.dp))
                        .padding(32.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = SpotifyGreen, modifier = Modifier.size(36.dp), strokeWidth = 3.dp)
                        Spacer(Modifier.height(14.dp))
                        Text("Connecting to Spotify in your browser...", color = Color.White, fontWeight = FontWeight.Medium)
                        Spacer(Modifier.height(4.dp))
                        Text("Approve authorization in browser or return here", color = DesktopSecondary, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            else -> {
                NotConnectedLoginCard(
                    errorMessage = (authState as? DesktopSpotifyAuthState.Error)?.message,
                )
            }
        }
    }
}

@Composable
private fun ConnectedProfileCard(
    profile: DesktopSpotifyAuthState.LoggedIn,
    onDisconnect: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SpotifyCardBg)
            .border(1.dp, SpotifyBorder, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center,
            ) {
                if (!profile.avatarUrl.isNullOrBlank()) {
                    DesktopArtwork(profile.avatarUrl, modifier = Modifier.size(44.dp).clip(CircleShape))
                } else {
                    Text(
                        profile.displayName.take(1).uppercase(),
                        fontWeight = FontWeight.Bold,
                        color = SpotifyGreen,
                        fontSize = 18.sp,
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        profile.displayName,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Spacer(Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(SpotifyGreen.copy(alpha = 0.2f))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            if (profile.isOAuth) "OAuth PKCE" else "Web Session",
                            color = SpotifyGreen,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
                Text(
                    profile.product?.let { "Spotify ${it.replaceFirstChar { c -> c.uppercase() }}" } ?: "Spotify Account Connected",
                    color = DesktopSecondary,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        TextButton(
            onClick = onDisconnect,
            modifier = Modifier.clip(RoundedCornerShape(8.dp)),
        ) {
            Text("Disconnect", color = DesktopDestructive, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun LikedSongsSyncCard(
    syncState: DesktopSpotifySyncProgress,
    isSyncing: Boolean,
    onStartSync: () -> Unit,
    onCancelSync: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SpotifyCardBg)
            .border(1.dp, SpotifyBorder, RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFE91E63).copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.Favorite, contentDescription = null, tint = Color(0xFFE91E63), modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(
                        "Spotify Liked Songs Sync",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Text(
                        "Directly sync saved tracks into Raaga Liked list & playlist",
                        color = DesktopSecondary,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            if (!isSyncing) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(SpotifyGreen)
                        .clickable(onClick = onStartSync)
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                ) {
                    Text("Sync Liked Songs", color = Color.Black, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        // Live progress display
        if (isSyncing && (syncState is DesktopSpotifySyncProgress.Matching || syncState is DesktopSpotifySyncProgress.FetchingTracks)) {
            Spacer(Modifier.height(14.dp))
            Column {
                when (syncState) {
                    is DesktopSpotifySyncProgress.FetchingTracks -> {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)), color = SpotifyGreen)
                        Spacer(Modifier.height(6.dp))
                        Text("Fetching Liked Songs list from Spotify...", color = DesktopSecondary, style = MaterialTheme.typography.bodySmall)
                    }
                    is DesktopSpotifySyncProgress.Matching -> {
                        val progress = if (syncState.total > 0) syncState.current.toFloat() / syncState.total else 0f
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)),
                            color = SpotifyGreen,
                        )
                        Spacer(Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Matching: ${syncState.currentTrack}",
                                color = Color.White,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "${syncState.current}/${syncState.total}",
                                color = SpotifyGreen,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                    else -> {}
                }

                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onCancelSync) {
                        Text("Cancel", color = DesktopSecondary, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        // Completed result banner
        if (syncState is DesktopSpotifySyncProgress.Completed) {
            Spacer(Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(SpotifyGreen.copy(alpha = 0.15f))
                    .padding(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Check, contentDescription = null, tint = SpotifyGreen, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(syncState.message, color = Color.White, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun FullLibraryImportCard(
    syncState: DesktopSpotifySyncProgress,
    isSyncing: Boolean,
    onPlaylistsChanged: ((List<DesktopPlaylist>) -> Unit)?,
) {
    val playlists = remember { mutableStateListOf<DesktopSpotifyUserPlaylistSummary>() }
    val selectedIds = remember { mutableStateListOf<String>() }
    var isLoadingPlaylists by remember { mutableStateOf(false) }
    var loadError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun loadPlaylists() {
        scope.launch {
            isLoadingPlaylists = true
            loadError = null
            val token = DesktopSpotifyAuthManager.getValidAccessToken()
            if (token.isNullOrBlank()) {
                loadError = "Token unavailable"
                isLoadingPlaylists = false
                return@launch
            }
            val res = DesktopSpotifyApiClient.getUserPlaylists(token)
            res.onSuccess { list ->
                playlists.clear()
                playlists.addAll(list)
                selectedIds.clear()
                selectedIds.addAll(list.map { it.id })
            }.onFailure { err ->
                loadError = err.message ?: "Failed to fetch playlists"
            }
            isLoadingPlaylists = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SpotifyCardBg)
            .border(1.dp, SpotifyBorder, RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(SpotifyGreen.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.QueueMusic, contentDescription = null, tint = SpotifyGreen, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(
                        "Full Library Playlists Import",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Text(
                        "Import playlists from your Spotify profile into Raaga",
                        color = DesktopSecondary,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            if (playlists.isEmpty() && !isLoadingPlaylists) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable(onClick = ::loadPlaylists)
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                ) {
                    Text("Load Playlists", color = Color.White, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (isLoadingPlaylists) {
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(color = SpotifyGreen, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(10.dp))
                Text("Loading your Spotify playlists...", color = DesktopSecondary, style = MaterialTheme.typography.bodySmall)
            }
        }

        loadError?.let { err ->
            Spacer(Modifier.height(10.dp))
            Text("Error: $err", color = DesktopDestructive, style = MaterialTheme.typography.bodySmall)
        }

        // Playlists loaded
        if (playlists.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Select Playlists (${selectedIds.size}/${playlists.size} selected)",
                    style = MaterialTheme.typography.bodySmall,
                    color = DesktopSecondary,
                    fontWeight = FontWeight.Medium,
                )
                Row {
                    TextButton(
                        onClick = {
                            selectedIds.clear()
                            selectedIds.addAll(playlists.map { it.id })
                        },
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text("Select All", color = SpotifyGreen, style = MaterialTheme.typography.bodySmall)
                    }
                    TextButton(
                        onClick = { selectedIds.clear() },
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text("Clear", color = DesktopSecondary, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            // Scrollable list of playlists
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 200.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.Black.copy(alpha = 0.25f))
                    .padding(6.dp)
            ) {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(playlists, key = { it.id }) { playlist ->
                        val isChecked = playlist.id in selectedIds
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isChecked) Color.White.copy(alpha = 0.06f) else Color.Transparent)
                                .clickable {
                                    if (isChecked) selectedIds.remove(playlist.id) else selectedIds.add(playlist.id)
                                }
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(RoundedCornerShape(5.dp))
                                    .background(if (isChecked) SpotifyGreen else Color.White.copy(alpha = 0.1f))
                                    .border(1.dp, if (isChecked) SpotifyGreen else Color.White.copy(alpha = 0.3f), RoundedCornerShape(5.dp)),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (isChecked) {
                                    Icon(Icons.Rounded.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(14.dp))
                                }
                            }
                            Spacer(Modifier.width(10.dp))
                            if (!playlist.coverArtUrl.isNullOrBlank()) {
                                DesktopArtwork(playlist.coverArtUrl, modifier = Modifier.size(32.dp).clip(RoundedCornerShape(6.dp)))
                                Spacer(Modifier.width(10.dp))
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(playlist.name, color = Color.White, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium, maxLines = 1)
                                Text("${playlist.trackCount} songs", color = DesktopSecondary, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Action row
            if (!isSyncing) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (selectedIds.isNotEmpty()) SpotifyGreen else Color.White.copy(alpha = 0.1f))
                            .clickable(enabled = selectedIds.isNotEmpty()) {
                                val chosen = playlists.filter { it.id in selectedIds }
                                DesktopSpotifySyncManager.importPlaylists(chosen, onPlaylistsChanged = onPlaylistsChanged)
                            }
                            .padding(horizontal = 16.dp, vertical = 9.dp),
                    ) {
                        Text(
                            "Import ${selectedIds.size} Playlists",
                            color = if (selectedIds.isNotEmpty()) Color.Black else DesktopSecondary,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }

        // Live playlist batch progress
        if (isSyncing && syncState is DesktopSpotifySyncProgress.Matching && syncState.playlistName != null) {
            Spacer(Modifier.height(14.dp))
            val progress = if (syncState.total > 0) syncState.current.toFloat() / syncState.total else 0f
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)),
                color = SpotifyGreen,
            )
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Playlist ${syncState.playlistIndex}/${syncState.totalPlaylists}: ${syncState.playlistName} (${syncState.current}/${syncState.total})",
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { DesktopSpotifySyncManager.cancelSync() }) {
                    Text("Cancel", color = DesktopSecondary, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (syncState is DesktopSpotifySyncProgress.Completed) {
            Spacer(Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(SpotifyGreen.copy(alpha = 0.15f))
                    .padding(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Check, contentDescription = null, tint = SpotifyGreen, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(syncState.message, color = Color.White, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun NotConnectedLoginCard(errorMessage: String?) {
    var showSpdcInput by remember { mutableStateOf(false) }
    var spdcText by remember { mutableStateOf(DesktopSpotifyToken.cookie()) }
    var showClientIdInput by remember { mutableStateOf(false) }
    var clientIdText by remember { mutableStateOf(DesktopSpotifyAuthManager.getStoredClientId()) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SpotifyCardBg)
            .border(1.dp, SpotifyBorder, RoundedCornerShape(16.dp))
            .padding(22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(SpotifyGreen.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            Text("♫", color = SpotifyGreen, fontWeight = FontWeight.Bold, fontSize = 28.sp)
        }
        Spacer(Modifier.height(14.dp))
        Text(
            "Connect Your Spotify Account",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "Enable 1-Click Liked Songs Direct Sync and Batch Playlist Import into Raaga",
            style = MaterialTheme.typography.bodySmall,
            color = DesktopSecondary,
        )

        errorMessage?.let { err ->
            Spacer(Modifier.height(10.dp))
            Text(err, color = DesktopDestructive, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))

        // 1-Click Browser OAuth Button
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(SpotifyGreen)
                .clickable { DesktopSpotifyAuthManager.startOAuthLogin() }
                .padding(vertical = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "Log In with Spotify (1-Click OAuth)",
                color = Color.Black,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        Spacer(Modifier.height(12.dp))

        // Alternative: sp_dc Web Session
        TextButton(onClick = { showSpdcInput = !showSpdcInput }) {
            Text(
                if (showSpdcInput) "Hide Web Cookie Login" else "Or Connect with sp_dc Web Cookie",
                color = DesktopSecondary,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        AnimatedVisibility(visible = showSpdcInput) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(12.dp),
            ) {
                Text(
                    "Paste your Spotify sp_dc cookie from open.spotify.com:",
                    color = DesktopSecondary,
                    style = MaterialTheme.typography.labelSmall,
                )
                Spacer(Modifier.height(8.dp))
                BasicTextField(
                    value = spdcText,
                    onValueChange = { spdcText = it },
                    textStyle = MaterialTheme.typography.bodySmall.copy(color = Color.White),
                    cursorBrush = SolidColor(SpotifyGreen),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.Black.copy(alpha = 0.3f))
                        .padding(10.dp),
                )
                Spacer(Modifier.height(10.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(SpotifyGreen)
                            .clickable { DesktopSpotifyAuthManager.loginWithSpdc(spdcText) }
                            .padding(horizontal = 14.dp, vertical = 7.dp),
                    ) {
                        Text("Connect Web Session", color = Color.Black, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        // Custom Client ID
        TextButton(onClick = { showClientIdInput = !showClientIdInput }) {
            Text(
                if (showClientIdInput) "Hide Client ID" else "Custom Spotify Client ID (Optional)",
                color = DesktopSecondary.copy(alpha = 0.7f),
                style = MaterialTheme.typography.labelSmall,
            )
        }

        AnimatedVisibility(visible = showClientIdInput) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
            ) {
                BasicTextField(
                    value = clientIdText,
                    onValueChange = {
                        clientIdText = it
                        DesktopSpotifyAuthManager.setCustomClientId(it)
                    },
                    textStyle = MaterialTheme.typography.bodySmall.copy(color = Color.White),
                    cursorBrush = SolidColor(SpotifyGreen),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.Black.copy(alpha = 0.3f))
                        .padding(10.dp),
                )
            }
        }
    }
}

@Composable
private fun LinkImportTab(
    onPlaylistsChanged: ((List<DesktopPlaylist>) -> Unit)?,
) {
    var urlText by remember { mutableStateOf("") }
    var isImporting by remember { mutableStateOf(false) }
    var statusText by remember { mutableStateOf<String?>(null) }
    var isSuccess by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SpotifyCardBg)
            .border(1.dp, SpotifyBorder, RoundedCornerShape(16.dp))
            .padding(20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(SpotifyGreen.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Rounded.Link, contentDescription = null, tint = SpotifyGreen, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    "Import from Spotify URL",
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    style = MaterialTheme.typography.bodyLarge,
                )
                Text(
                    "Paste any Spotify playlist or album link to convert into Raaga",
                    color = DesktopSecondary,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        // Input Field
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White.copy(alpha = 0.07f))
                .padding(12.dp),
        ) {
            if (urlText.isEmpty()) {
                Text("https://open.spotify.com/playlist/...", color = DesktopSecondary, style = MaterialTheme.typography.bodyMedium)
            }
            BasicTextField(
                value = urlText,
                onValueChange = { urlText = it },
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = Color.White),
                cursorBrush = SolidColor(SpotifyGreen),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(Modifier.height(14.dp))

        if (isImporting) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)), color = SpotifyGreen)
            Spacer(Modifier.height(8.dp))
        }

        statusText?.let { msg ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (isSuccess) SpotifyGreen.copy(alpha = 0.15f) else DesktopDestructive.copy(alpha = 0.15f))
                    .padding(10.dp),
            ) {
                Text(msg, color = if (isSuccess) SpotifyGreen else DesktopDestructive, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(10.dp))
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (urlText.isNotBlank() && !isImporting) SpotifyGreen else Color.White.copy(alpha = 0.1f))
                    .clickable(enabled = urlText.isNotBlank() && !isImporting) {
                        scope.launch {
                            isImporting = true
                            isSuccess = false
                            statusText = "Resolving Spotify link..."

                            val token = DesktopSpotifyAuthManager.getValidAccessToken()
                            val infoRes = DesktopSpotifyApiClient.fetchPlaylistFromUrl(urlText.trim(), token)

                            infoRes.onSuccess { info ->
                                statusText = "Matching ${info.tracks.size} tracks with YouTube Music..."
                                val songs = mutableListOf<Song>()
                                val videoIds = mutableListOf<String>()

                                for (track in info.tracks) {
                                    val song = DesktopSpotifySyncManager.resolveTrack(track)
                                    if (song != null) {
                                        songs.add(song)
                                        videoIds.add(song.videoId)
                                    }
                                }

                                if (songs.isNotEmpty()) {
                                    val persistence = DesktopPersistence()
                                    val current = persistence.playlists()
                                    val newPlaylist = DesktopPlaylist(title = info.title, songs = songs)
                                    val updated = listOf(newPlaylist) + current.filterNot { it.title.equals(info.title, ignoreCase = true) }
                                    persistence.savePlaylists(updated)
                                    onPlaylistsChanged?.invoke(updated)

                                    if (DesktopYouTubeAuth.isSignedIn) {
                                        DesktopSearchClient.createPlaylist(info.title, PlaylistPrivacy.PUBLIC, videoIds)
                                    }

                                    isSuccess = true
                                    statusText = "Successfully imported \"${info.title}\" with ${songs.size} tracks!"
                                } else {
                                    statusText = "Could not match tracks from this playlist."
                                }
                            }.onFailure { err ->
                                statusText = "Error: ${err.message}"
                            }

                            isImporting = false
                        }
                    }
                    .padding(horizontal = 18.dp, vertical = 10.dp),
            ) {
                Text(
                    "Import Playlist",
                    color = if (urlText.isNotBlank() && !isImporting) Color.Black else DesktopSecondary,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}
