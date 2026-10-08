package com.music.raaga.ui.components

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.LibraryMusic
import androidx.compose.material.icons.rounded.Login
import androidx.compose.material.icons.rounded.OpenInBrowser
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.spotify.SpotifyApiClient
import com.music.raaga.data.spotify.SpotifyAuthManager
import com.music.raaga.data.spotify.SpotifyAuthState
import com.music.raaga.data.spotify.SpotifySyncManager
import com.music.raaga.data.spotify.SpotifySyncProgress
import com.music.raaga.data.spotify.SpotifyUserPlaylistSummary
import com.music.raaga.ui.screens.SpotifyLoginDialog
import kotlinx.coroutines.launch

private val SpotifyGreen = Color(0xFF1DB954)
private val SpotifyDarkSurface = Color(0xFF121212)
private val SpotifyCardSurface = Color(0xFF181818)

@Composable
fun SpotifyAccountSyncContent(
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val authState by SpotifyAuthManager.authState.collectAsStateWithLifecycle()
    val syncState by SpotifySyncManager.syncState.collectAsStateWithLifecycle()
    val isSyncing by SpotifySyncManager.isSyncing.collectAsStateWithLifecycle()

    var showLoginDialog by remember { mutableStateOf(false) }
    var showAdvancedOAuth by remember { mutableStateOf(false) }
    var customClientIdInput by remember { mutableStateOf("") }

    var userPlaylists by remember { mutableStateOf<List<SpotifyUserPlaylistSummary>>(emptyList()) }
    var selectedPlaylistIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var isLoadingPlaylists by remember { mutableStateOf(false) }

    // Auto-load playlists if logged in and playlists list is empty
    LaunchedEffect(authState) {
        if (authState is SpotifyAuthState.LoggedIn && userPlaylists.isEmpty() && !isLoadingPlaylists) {
            isLoadingPlaylists = true
            val token = SpotifyAuthManager.getValidAccessToken()
            if (!token.isNullOrBlank()) {
                val res = SpotifyApiClient.getUserPlaylists(token)
                res.onSuccess { list ->
                    userPlaylists = list
                    selectedPlaylistIds = list.map { it.id }.toSet()
                }
            }
            isLoadingPlaylists = false
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 12.dp),
    ) {
        when (val currentAuth = authState) {
            is SpotifyAuthState.LoggedOut, is SpotifyAuthState.Error -> {
                // ── NOT CONNECTED: LOGIN CARD ──
                SpotifyConnectBanner(
                    errorMessage = (currentAuth as? SpotifyAuthState.Error)?.message,
                    showAdvanced = showAdvancedOAuth,
                    customClientId = customClientIdInput,
                    onCustomClientIdChange = { customClientIdInput = it },
                    onToggleAdvanced = { showAdvancedOAuth = !showAdvancedOAuth },
                    onWebLoginClick = { showLoginDialog = true },
                    onOAuthLoginClick = {
                        SpotifyAuthManager.startOAuthLogin(context, customClientIdInput)
                    },
                )
            }

            is SpotifyAuthState.LoggingIn -> {
                // ── LOGGING IN LOADING CARD ──
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        CircularProgressIndicator(
                            color = SpotifyGreen,
                            strokeWidth = 3.dp,
                            modifier = Modifier.size(28.dp),
                        )
                        Spacer(Modifier.width(16.dp))
                        Text(
                            text = "Connecting to Spotify…",
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }

            is SpotifyAuthState.LoggedIn -> {
                // ── CONNECTED: PROFILE & SYNC ACTIONS ──
                SpotifyConnectedHeader(
                    user = currentAuth,
                    onDisconnect = {
                        SpotifyAuthManager.logout()
                        userPlaylists = emptyList()
                        selectedPlaylistIds = emptySet()
                    },
                )

                Spacer(Modifier.height(16.dp))

                // ── SECTION 1: LIKED SONGS DIRECT SYNC ──
                LikedSongsSyncCard(
                    isSyncing = isSyncing,
                    syncState = syncState,
                    onStartSync = {
                        SpotifySyncManager.syncLikedSongs(createDedicatedPlaylist = true)
                    },
                    onCancelSync = {
                        SpotifySyncManager.cancelSync()
                    },
                )

                Spacer(Modifier.height(16.dp))

                // ── SECTION 2: FULL LIBRARY PLAYLISTS IMPORT ──
                FullLibraryImportCard(
                    isSyncing = isSyncing,
                    syncState = syncState,
                    playlists = userPlaylists,
                    selectedIds = selectedPlaylistIds,
                    isLoading = isLoadingPlaylists,
                    onLoadPlaylists = {
                        coroutineScope.launch {
                            isLoadingPlaylists = true
                            val token = SpotifyAuthManager.getValidAccessToken()
                            if (!token.isNullOrBlank()) {
                                val res = SpotifyApiClient.getUserPlaylists(token)
                                res.fold(
                                    onSuccess = { list ->
                                        userPlaylists = list
                                        selectedPlaylistIds = list.map { it.id }.toSet()
                                    },
                                    onFailure = { err ->
                                        Toast.makeText(context, err.message ?: "Failed to load playlists", Toast.LENGTH_SHORT).show()
                                    }
                                )
                            }
                            isLoadingPlaylists = false
                        }
                    },
                    onTogglePlaylist = { id ->
                        selectedPlaylistIds = if (selectedPlaylistIds.contains(id)) {
                            selectedPlaylistIds - id
                        } else {
                            selectedPlaylistIds + id
                        }
                    },
                    onSelectAll = {
                        selectedPlaylistIds = userPlaylists.map { it.id }.toSet()
                    },
                    onDeselectAll = {
                        selectedPlaylistIds = emptySet()
                    },
                    onStartImport = {
                        val toImport = userPlaylists.filter { selectedPlaylistIds.contains(it.id) }
                        SpotifySyncManager.importPlaylists(toImport)
                    },
                    onCancelSync = {
                        SpotifySyncManager.cancelSync()
                    },
                )
            }
        }
    }

    if (showLoginDialog) {
        SpotifyLoginDialog(
            onDismiss = { showLoginDialog = false },
            onSuccess = { spDc ->
                coroutineScope.launch {
                    SpotifyAuthManager.loginWithWebSession(spDc)
                }
                showLoginDialog = false
            }
        )
    }
}

@Composable
private fun SpotifyConnectBanner(
    errorMessage: String?,
    showAdvanced: Boolean,
    customClientId: String,
    onCustomClientIdChange: (String) -> Unit,
    onToggleAdvanced: () -> Unit,
    onWebLoginClick: () -> Unit,
    onOAuthLoginClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        border = BorderStroke(1.dp, SpotifyGreen.copy(alpha = 0.35f)),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(SpotifyGreen.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.LibraryMusic,
                        contentDescription = null,
                        tint = SpotifyGreen,
                        modifier = Modifier.size(26.dp),
                    )
                }
                Spacer(Modifier.width(14.dp))
                Column {
                    Text(
                        text = "Connect Spotify Account",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = "Sync Liked Songs & Full Library",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            Text(
                text = "Connect your Spotify account to directly sync all your Liked Songs and import your playlists into Raaga in one tap.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 20.sp,
            )

            if (!errorMessage.isNullOrBlank()) {
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Rounded.ErrorOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = errorMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }

            Spacer(Modifier.height(18.dp))

            // Primary 1-Tap Login
            Button(
                onClick = onWebLoginClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = SpotifyGreen,
                    contentColor = Color.Black,
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(
                    imageVector = Icons.Rounded.Login,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.spotify_web_login_btn),
                    fontWeight = FontWeight.Bold,
                )
            }

            Spacer(Modifier.height(10.dp))

            // Secondary Official OAuth Login
            OutlinedButton(
                onClick = onOAuthLoginClick,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, SpotifyGreen.copy(alpha = 0.6f)),
            ) {
                Icon(
                    imageVector = Icons.Rounded.OpenInBrowser,
                    contentDescription = null,
                    tint = SpotifyGreen,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.spotify_oauth_login_btn),
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(Modifier.height(8.dp))

            TextButton(
                onClick = onToggleAdvanced,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) {
                Text(
                    text = if (showAdvanced) "Hide Advanced Settings" else "Advanced: Custom Spotify Client ID",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            AnimatedVisibility(visible = showAdvanced) {
                Column(modifier = Modifier.padding(top = 8.dp)) {
                    OutlinedTextField(
                        value = customClientId,
                        onValueChange = onCustomClientIdChange,
                        label = { Text("Custom Client ID (Optional)") },
                        placeholder = { Text("From developer.spotify.com") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Redirect URI must be set to: raaga://spotify-callback",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun SpotifyConnectedHeader(
    user: SpotifyAuthState.LoggedIn,
    onDisconnect: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        border = BorderStroke(1.dp, SpotifyGreen.copy(alpha = 0.3f)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (!user.avatarUrl.isNullOrBlank()) {
                AsyncImage(
                    model = user.avatarUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .border(1.5.dp, SpotifyGreen, CircleShape),
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(SpotifyGreen.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = user.displayName.take(1).uppercase(),
                        fontWeight = FontWeight.Bold,
                        color = SpotifyGreen,
                        fontSize = 18.sp,
                    )
                }
            }

            Spacer(Modifier.width(14.dp))

            Column(Modifier.weight(1f)) {
                Text(
                    text = user.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(SpotifyGreen),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = if (user.isOAuth) "Spotify Connected (OAuth)" else "Spotify Connected",
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotifyGreen,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            TextButton(onClick = onDisconnect) {
                Text(
                    text = stringResource(R.string.spotify_disconnect),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
    }
}

@Composable
private fun LikedSongsSyncCard(
    isSyncing: Boolean,
    syncState: SpotifySyncProgress,
    onStartSync: () -> Unit,
    onCancelSync: () -> Unit,
) {
    val isLikedSyncActive = isSyncing && (
        syncState is SpotifySyncProgress.FetchingTracks ||
        (syncState is SpotifySyncProgress.Matching && syncState.playlistName == "Liked Songs")
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE91E63).copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Favorite,
                        contentDescription = null,
                        tint = Color(0xFFE91E63),
                        modifier = Modifier.size(20.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.spotify_sync_liked_title),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = stringResource(R.string.spotify_sync_liked_desc),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            when {
                isLikedSyncActive -> {
                    SyncProgressView(
                        state = syncState,
                        onCancel = onCancelSync,
                    )
                }

                syncState is SpotifySyncProgress.Completed && syncState.message.contains("Liked Songs") -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(SpotifyGreen.copy(alpha = 0.15f))
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Rounded.CheckCircle,
                            contentDescription = null,
                            tint = SpotifyGreen,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            text = syncState.message,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = onStartSync,
                        colors = ButtonDefaults.buttonColors(containerColor = SpotifyGreen, contentColor = Color.Black),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Rounded.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Sync Again", fontWeight = FontWeight.Bold)
                    }
                }

                else -> {
                    Button(
                        onClick = onStartSync,
                        enabled = !isSyncing,
                        colors = ButtonDefaults.buttonColors(containerColor = SpotifyGreen, contentColor = Color.Black),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Rounded.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = stringResource(R.string.spotify_sync_liked_button),
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FullLibraryImportCard(
    isSyncing: Boolean,
    syncState: SpotifySyncProgress,
    playlists: List<SpotifyUserPlaylistSummary>,
    selectedIds: Set<String>,
    isLoading: Boolean,
    onLoadPlaylists: () -> Unit,
    onTogglePlaylist: (String) -> Unit,
    onSelectAll: () -> Unit,
    onDeselectAll: () -> Unit,
    onStartImport: () -> Unit,
    onCancelSync: () -> Unit,
) {
    val isLibrarySyncActive = isSyncing && (
        syncState is SpotifySyncProgress.Matching && syncState.playlistName != "Liked Songs"
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(SpotifyGreen.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.CloudDownload,
                        contentDescription = null,
                        tint = SpotifyGreen,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.spotify_import_library_title),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = stringResource(R.string.spotify_import_library_desc),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            when {
                isLibrarySyncActive -> {
                    SyncProgressView(
                        state = syncState,
                        onCancel = onCancelSync,
                    )
                }

                isLoading -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(
                            color = SpotifyGreen,
                            strokeWidth = 2.5.dp,
                            modifier = Modifier.size(22.dp),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = "Loading playlists from Spotify…",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                playlists.isEmpty() -> {
                    OutlinedButton(
                        onClick = onLoadPlaylists,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth(),
                        border = BorderStroke(1.dp, SpotifyGreen.copy(alpha = 0.5f)),
                    ) {
                        Icon(
                            Icons.Rounded.LibraryMusic,
                            contentDescription = null,
                            tint = SpotifyGreen,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = stringResource(R.string.spotify_load_playlists),
                            color = MaterialTheme.colorScheme.onSurface,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }

                else -> {
                    // Header with selection count
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "${playlists.size} Playlists (${selectedIds.size} selected)",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )

                        Row {
                            TextButton(onClick = onSelectAll) {
                                Text("Select All", style = MaterialTheme.typography.labelSmall)
                            }
                            TextButton(onClick = onDeselectAll) {
                                Text("Clear", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }

                    Spacer(Modifier.height(6.dp))

                    // Playlist list
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 240.dp)
                    ) {
                        LazyColumn {
                            items(playlists, key = { it.id }) { item ->
                                PlaylistItemRow(
                                    playlist = item,
                                    isSelected = selectedIds.contains(item.id),
                                    onToggle = { onTogglePlaylist(item.id) },
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(14.dp))

                    Button(
                        onClick = onStartImport,
                        enabled = !isSyncing && selectedIds.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(containerColor = SpotifyGreen, contentColor = Color.Black),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Rounded.CloudDownload, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Import Selected (${selectedIds.size}) Playlists",
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PlaylistItemRow(
    playlist: SpotifyUserPlaylistSummary,
    isSelected: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (!playlist.coverArtUrl.isNullOrBlank()) {
            AsyncImage(
                model = playlist.coverArtUrl,
                contentDescription = null,
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(6.dp)),
            )
        } else {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Rounded.LibraryMusic,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp),
                )
            }
        }

        Spacer(Modifier.width(12.dp))

        Column(Modifier.weight(1f)) {
            Text(
                text = playlist.name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "${playlist.trackCount} songs",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Checkbox(
            checked = isSelected,
            onCheckedChange = { onToggle() },
            colors = CheckboxDefaults.colors(checkedColor = SpotifyGreen),
        )
    }
}

@Composable
private fun SyncProgressView(
    state: SpotifySyncProgress,
    onCancel: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            .padding(14.dp),
    ) {
        when (state) {
            is SpotifySyncProgress.FetchingTracks -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(
                        color = SpotifyGreen,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "Fetching tracks from Spotify (${state.current}/${state.total})…",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            is SpotifySyncProgress.Matching -> {
                val progress = if (state.total > 0) state.current.toFloat() / state.total.toFloat() else 0f
                if (state.totalPlaylists > 1) {
                    Text(
                        text = "Playlist ${state.playlistIndex} of ${state.totalPlaylists}: ${state.playlistName.orEmpty()}",
                        style = MaterialTheme.typography.labelMedium,
                        color = SpotifyGreen,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(4.dp))
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "Matching: ${state.current} / ${state.total}",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "${(progress * 100).toInt()}%",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color = SpotifyGreen,
                    )
                }

                Spacer(Modifier.height(6.dp))

                LinearProgressIndicator(
                    progress = { progress },
                    color = SpotifyGreen,
                    trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text = state.currentTrack,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            else -> {}
        }

        Spacer(Modifier.height(10.dp))

        OutlinedButton(
            onClick = onCancel,
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.align(Alignment.End),
        ) {
            Text(stringResource(R.string.cancel_import), style = MaterialTheme.typography.labelSmall)
        }
    }
}
