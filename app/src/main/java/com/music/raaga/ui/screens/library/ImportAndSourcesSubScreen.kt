package com.music.raaga.ui.screens.library

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Cloud
import androidx.compose.material.icons.rounded.Dns
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.LocalMediaRepository
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.smb.SmbConfig
import com.music.raaga.data.webdav.WebDavConfig

/**
 * Import & Sources: Raaga's dedicated screen bringing together WebDAV,
 * SMB, local device files, playlist imports and cloud sources.
 */
@Composable
fun ImportAndSourcesSubScreen(
    onBack: () -> Unit,
    onEditWebDav: () -> Unit = {},
    onEditSmb: () -> Unit = {},
    onImportSpotifyPlaylist: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val webdavUrl by AppSettings.webdavUrl.collectAsStateWithLifecycle()
    val smbHost by AppSettings.smbHost.collectAsStateWithLifecycle()
    val smbShare by AppSettings.smbShare.collectAsStateWithLifecycle()
    val localMusicFolderUri by AppSettings.localMusicFolderUri.collectAsStateWithLifecycle()

    val isWebDavConfigured = WebDavConfig.isConfigured(webdavUrl)
    val isSmbConfigured = SmbConfig.isConfigured(smbHost, smbShare)

    // Local music folder SAF directory picker
    val localFolderPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree()
    ) { uri: Uri? ->
        if (uri != null) {
            AppSettings.setLocalMusicFolderUri(uri.toString())
        }
    }

    // Playlist file picker for M3U / PLS / XSPF
    val playlistFilePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        // Handle M3U/M3U8 file selection
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
        contentPadding = PaddingValues(bottom = 120.dp),
    ) {
        // Hero Card
        item(key = "import_hero") {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                Color(0xFF0039A6),
                                Color(0xFF1E88E5),
                                Color(0xFFB71C1C),
                            )
                        )
                    )
                    .padding(24.dp),
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CobaltBadge(
                            text = "IMPORT & SOURCES",
                            backgroundColor = Color.Black.copy(alpha = 0.4f),
                            textColor = Color.White,
                        )
                        Icon(
                            imageVector = Icons.Rounded.Storage,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Spacer(Modifier.height(20.dp))
                    Text(
                        text = stringResource(R.string.import_and_sources),
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 26.sp,
                        ),
                        color = Color.White,
                    )
                    Text(
                        text = stringResource(R.string.import_and_sources_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.85f),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }

        // Section 1: Storage Connections (WebDAV, SMB, Local)
        item(key = "storage_connections_header") {
            SectionHeader(
                title = stringResource(R.string.storage_connections),
                subtitle = "Network servers, NAS storage and local device files",
            )
        }

        // WebDAV Server
        item(key = "source_webdav") {
            SourceItemRow(
                icon = Icons.Rounded.Dns,
                title = "WebDAV Server",
                subtitle = if (isWebDavConfigured) webdavUrl else "Nextcloud, ownCloud, Apache WebDAV",
                statusText = if (isWebDavConfigured) "Configured" else "Not Connected",
                isConfigured = isWebDavConfigured,
                onClick = onEditWebDav,
            )
        }

        // SMB / NAS
        item(key = "source_smb") {
            SourceItemRow(
                icon = Icons.Rounded.Storage,
                title = "SMB / Samba / NAS",
                subtitle = if (isSmbConfigured) smbHost else "Windows Share, Synology, TrueNAS, QNAP",
                statusText = if (isSmbConfigured) "Connected" else "Not Connected",
                isConfigured = isSmbConfigured,
                onClick = onEditSmb,
            )
        }

        // Local Device Storage
        item(key = "source_local") {
            val folderLabel = LocalMediaRepository.selectedFolderLabel(localMusicFolderUri)
            SourceItemRow(
                icon = Icons.Rounded.FolderOpen,
                title = "Local Music Folder",
                subtitle = folderLabel ?: "Device storage · All audio folders",
                statusText = if (localMusicFolderUri.isNotBlank()) "Selected Folder" else "All Folders",
                isConfigured = true,
                onClick = { localFolderPicker.launch(null) },
            )
        }

        // Section 2: Playlist Formats (Import Playlists)
        item(key = "playlist_formats_header") {
            Spacer(Modifier.height(20.dp))
            SectionHeader(
                title = stringResource(R.string.playlist_formats),
                subtitle = "Import playlists from files and external platforms",
            )
        }

        // M3U / M3U8 Playlist
        item(key = "import_m3u") {
            SourceItemRow(
                icon = Icons.AutoMirrored.Rounded.QueueMusic,
                title = "Import M3U / M3U8 Playlist",
                subtitle = "Local or online .m3u, .m3u8 playlist file",
                statusText = "M3U / M3U8",
                isConfigured = false,
                onClick = {
                    playlistFilePicker.launch(arrayOf("audio/x-mpegurl", "application/vnd.apple.mpegurl", "text/plain"))
                },
            )
        }

        // PLS / XSPF Playlist
        item(key = "import_xspf") {
            SourceItemRow(
                icon = Icons.Rounded.PlaylistPlay,
                title = "Import PLS / XSPF Playlist",
                subtitle = "Standard XML and Shoutcast playlist formats",
                statusText = "PLS / XSPF",
                isConfigured = false,
                onClick = {
                    playlistFilePicker.launch(arrayOf("application/xspf+xml", "audio/x-scpls", "*/*"))
                },
            )
        }

        // Spotify Playlist Import
        item(key = "import_spotify") {
            SourceItemRow(
                icon = Icons.Rounded.AutoAwesome,
                title = "Import Spotify Playlist",
                subtitle = "Import public Spotify playlist via link or URI",
                statusText = "Spotify",
                isConfigured = true,
                onClick = onImportSpotifyPlaylist,
            )
        }

        // Section 3: Cloud Sources
        item(key = "cloud_sources_header") {
            Spacer(Modifier.height(20.dp))
            SectionHeader(
                title = stringResource(R.string.cloud_sources),
                subtitle = "Streaming mirrors and cloud catalog providers",
            )
        }

        item(key = "cloud_jiosaavn") {
            SourceItemRow(
                icon = Icons.Rounded.Cloud,
                title = "JioSaavn & Streaming Mirrors",
                subtitle = "High fidelity streaming audio catalog",
                statusText = "Active",
                isConfigured = true,
                onClick = {},
            )
        }

        // Section 4: Manage Connected Sources
        item(key = "manage_sources_card") {
            Spacer(Modifier.height(24.dp))
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = AmoledCardBackground),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onOpenSettings)
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(RaagaCobaltSurface),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Settings,
                            contentDescription = null,
                            tint = RaagaCobaltBlue,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Spacer(Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.manage_connected_sources),
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                        )
                        Text(
                            text = "Sync intervals, cache preferences & credentials",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondaryGrey,
                        )
                    }
                    Icon(
                        imageVector = Icons.Rounded.ChevronRight,
                        contentDescription = null,
                        tint = TextSecondaryGrey,
                        modifier = Modifier.size(20.dp),
                    )
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
private fun SourceItemRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    statusText: String,
    isConfigured: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isConfigured) RaagaCobaltSurface else AmoledCardBackground),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = if (isConfigured) RaagaCobaltBlue else Color.White,
                    modifier = Modifier.size(26.dp),
                )
            }
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryGrey,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(8.dp))
            CobaltBadge(
                text = statusText.uppercase(),
                backgroundColor = if (isConfigured) RaagaCobaltSurface else Color(0xFF2C2C2E),
                textColor = if (isConfigured) RaagaCobaltBlue else TextSecondaryGrey,
            )
            Spacer(Modifier.width(6.dp))
            Icon(
                imageVector = Icons.Rounded.ChevronRight,
                contentDescription = null,
                tint = TextSecondaryGrey,
                modifier = Modifier.size(18.dp),
            )
        }
        HorizontalDivider(
            thickness = 0.5.dp,
            color = AmoledBorderColor,
            modifier = Modifier.padding(start = 64.dp),
        )
    }
}

