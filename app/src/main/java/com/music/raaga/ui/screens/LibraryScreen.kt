package com.music.raaga.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.LibrarySongAggregator
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.model.HomeShelf
import com.music.raaga.data.model.LibraryPage
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.Song
import com.music.raaga.data.model.UiState
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.settings.LibrarySort
import com.music.raaga.download.Downloads
import com.music.raaga.download.SavedCollection
import com.music.raaga.ui.components.LIBRARY_GRID_SPACING
import com.music.raaga.ui.components.MessageState
import com.music.raaga.ui.components.PAGE_GUTTER
import com.music.raaga.ui.components.libraryGrid
import com.music.raaga.ui.icons.RaagaIcons
import com.music.raaga.ui.player.MeshGradientBackground
import com.music.raaga.ui.player.rememberArtworkColors
import com.music.raaga.ui.replay.ReplayCardRow
import com.music.raaga.ui.replay.ReplayHeroCard
import com.music.raaga.ui.replay.ReplayStoryPage
import com.music.raaga.ui.screens.library.AlbumsSubScreen
import com.music.raaga.ui.screens.library.ArtistsSubScreen
import com.music.raaga.ui.screens.library.DownloadedSubScreen
import com.music.raaga.ui.screens.library.ImportAndSourcesSubScreen
import com.music.raaga.ui.screens.library.LibraryCategory
import com.music.raaga.ui.screens.library.LibraryHub
import com.music.raaga.ui.screens.library.MadeForYouSubScreen
import com.music.raaga.ui.screens.library.NewPlaylistSheet
import com.music.raaga.ui.screens.library.PlaylistsSubScreen
import com.music.raaga.ui.screens.library.RecentlyAddedSubScreen
import com.music.raaga.ui.screens.library.SongsSubScreen
import java.util.Locale

private data class ExtractedLibraryData(
    val playlists: List<ShelfItem>,
    val albums: List<ShelfItem>,
    val artists: List<ShelfItem>,
    val songs: List<Song>,
    val recentlyAdded: List<ShelfItem>,
)

/**
 * The Library tab, Apple Music style.
 *
 * Signed in, the page is a [LibraryHub]: a list of categories (Playlists,
 * Artists, Albums, Songs, Downloaded, Made for You, Genres), a Recently Added
 * grid and the Replay entry. Tapping a category crossfades into its own
 * sub-screen; Back returns to the hub.
 *
 * Signed out, there is no account library to categorise, so the page is the
 * on-device shelf (downloads, local files, WebDAV/SMB) plus a sign-in prompt.
 *
 * The liked list is still fetched — the rest of the app reads a track's rating
 * off it (see MainViewModel's `likeStatuses`) — and it feeds the Songs
 * sub-screen alongside the library songs.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    signedIn: Boolean,
    state: UiState<LibraryPage>,
    listState: LazyListState,
    onShelfItemClick: (ShelfItem) -> Unit,
    onShelfItemLongPress: (ShelfItem) -> Unit,
    onNewPlaylist: () -> Unit,
    onImportSpotifyPlaylist: () -> Unit = {},
    /** A shelf's "Show all" — every row stops at five cards, this reaches the rest. */
    onShowAll: (HomeShelf) -> Unit,
    /** Replay's headline cards. Each opens the detailed page at its own chart. */
    replayCards: List<ReplayHeroCard>,
    replayHolder: String,
    replayMemberSince: String?,
    onOpenReplay: (ReplayStoryPage) -> Unit,
    onSignIn: () -> Unit,
    onRetry: () -> Unit,
    refreshing: Boolean,
    onRefresh: () -> Unit,
    pullState: PullToRefreshState,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues,
    /**
     * Playlists downloaded whole, as cards beside the device folders. Albums are
     * deliberately not here: the Downloads folder's Albums tab already groups
     * them from their tags.
     */
    downloadedPlaylists: List<SavedCollection> = emptyList(),
    activeCategory: LibraryCategory? = null,
    onNavigateCategory: ((LibraryCategory) -> Unit)? = null,
    onBackCategory: (() -> Unit)? = null,
    onSongClick: ((List<Song>, Int) -> Unit)? = null,
    onSongLongPress: ((Song) -> Unit)? = null,
    onOpenSettings: (() -> Unit)? = null,
    onOpenAccount: (() -> Unit)? = null,
    onEditWebDav: (() -> Unit)? = null,
    onEditSmb: (() -> Unit)? = null,
    historySongs: List<Song> = emptyList(),
    onPlayQueue: ((List<Song>, String) -> Unit)? = null,
    onStartRadio: ((Song) -> Unit)? = null,
) {
    val onDevice = stringResource(R.string.on_device)
    var internalCategory by rememberSaveable { mutableStateOf<LibraryCategory?>(null) }
    val currentCategory = activeCategory ?: internalCategory
    val navigateTo: (LibraryCategory) -> Unit = { cat ->
        if (cat == LibraryCategory.REPLAY) {
            onOpenReplay(ReplayStoryPage.INTRO)
        } else if (onNavigateCategory != null) {
            onNavigateCategory(cat)
        } else {
            internalCategory = cat
        }
    }
    val goBack: () -> Unit = {
        if (onBackCategory != null) onBackCategory()
        else internalCategory = null
    }

    // Back leaves a sub-screen before it leaves the tab.
    if (onBackCategory == null) {
        BackHandler(enabled = currentCategory != null) {
            goBack()
        }
    }

    var showNewPlaylistSheet by remember { mutableStateOf(false) }

    val extracted = remember(state) {
        val page = (state as? UiState.Success)?.data
        val shelves = page?.shelves.orEmpty()
        val plList = shelves.firstOrNull { it.title.equals(PLAYLISTS, ignoreCase = true) }?.items.orEmpty()
        val alList = shelves.firstOrNull { it.title.equals("Albums", ignoreCase = true) }?.items.orEmpty()
        val arList = shelves.firstOrNull { it.title.equals("Artists", ignoreCase = true) }?.items.orEmpty() +
            shelves.firstOrNull { it.title.equals("Subscriptions", ignoreCase = true) }?.items.orEmpty()
        val sgList = (page?.librarySongs.orEmpty() + page?.likedSongs.orEmpty()).distinctBy { it.videoId }
        ExtractedLibraryData(
            playlists = plList,
            albums = alList,
            artists = arList.distinctBy { it.browseId ?: it.title },
            songs = sgList,
            recentlyAdded = (alList + plList).distinctBy { it.browseId ?: it.title },
        )
    }

    val context = LocalContext.current
    LaunchedEffect(extracted.songs, extracted.playlists, extracted.albums) {
        if (extracted.songs.isNotEmpty() || extracted.playlists.isNotEmpty() || extracted.albums.isNotEmpty()) {
            LibrarySongAggregator.syncAggregatedSongs(extracted.songs, extracted.playlists, extracted.albums)
        }
    }
    LaunchedEffect(Unit) {
        LibrarySongAggregator.syncOfflineSongs(context)
    }

    if (!signedIn || state is UiState.Error) {
        // No account library to categorise: on-device shelf plus a prompt.
        LazyColumn(
            state = listState,
            modifier = modifier.fillMaxSize(),
            contentPadding = contentPadding,
        ) {
            item(key = "title") {
                Text(
                    text = stringResource(R.string.library),
                    style = MaterialTheme.typography.displayLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(horizontal = PAGE_GUTTER, vertical = 8.dp),
                )
            }
            item(key = "replay") {
                if (replayCards.isEmpty()) {
                    ReplayBanner(null) { onOpenReplay(ReplayStoryPage.INTRO) }
                } else {
                    ReplayCardRow(
                        cards = replayCards,
                        holder = replayHolder,
                        memberSince = replayMemberSince,
                        onCardClick = onOpenReplay,
                        modifier = Modifier.padding(vertical = 6.dp),
                        contentPadding = PaddingValues(horizontal = PAGE_GUTTER),
                    )
                }
            }
            item(key = "shelf:$onDevice") {
                OnDeviceShelf(
                    title = onDevice,
                    downloadedPlaylists = downloadedPlaylists,
                    onItemClick = onShelfItemClick,
                    onItemLongPress = onShelfItemLongPress,
                    onShowAll = onShowAll,
                    onImportSpotifyPlaylist = onImportSpotifyPlaylist,
                )
            }
            item(key = "message") {
                if (state is UiState.Error && signedIn) {
                    MessageState(
                        message = state.message,
                        actionLabel = stringResource(R.string.retry),
                        onAction = onRetry,
                    )
                } else {
                    MessageState(
                        message = stringResource(R.string.library_sign_in_description),
                        actionLabel = stringResource(R.string.sign_in),
                        onAction = onSignIn,
                    )
                }
            }
        }
        return
    }

    AnimatedContent(
        targetState = currentCategory,
        label = "LibraryNavigation",
        transitionSpec = { fadeIn() togetherWith fadeOut() },
        modifier = modifier,
    ) { category ->
        when (category) {
            null -> LibraryHub(
                playlists = extracted.playlists,
                recentlyAddedItems = extracted.recentlyAdded,
                downloadedPlaylists = downloadedPlaylists,
                onNavigateCategory = navigateTo,
                onShelfItemClick = onShelfItemClick,
                onNewPlaylist = { showNewPlaylistSheet = true },
                onShowAllRecentlyAdded = {
                    navigateTo(LibraryCategory.RECENTLY_ADDED)
                },
                onSongClick = { list, idx -> onSongClick?.invoke(list, idx) },
                replayCards = replayCards,
                onOpenReplay = onOpenReplay,
                onOpenSettings = { onOpenSettings?.invoke() },
                onOpenAccount = { onOpenAccount?.invoke() },
                refreshing = refreshing,
                onRefresh = {
                    LibrarySongAggregator.syncAggregatedSongs(extracted.songs, extracted.playlists, extracted.albums, forceRefresh = true)
                    LibrarySongAggregator.syncOfflineSongs(context, forceRefresh = true)
                    onRefresh()
                },
                pullState = pullState,
                listState = listState,
                contentPadding = contentPadding,
            )

            LibraryCategory.PLAYLISTS -> PlaylistsSubScreen(
                playlists = extracted.playlists,
                onBack = goBack,
                onPlaylistClick = onShelfItemClick,
                onNewPlaylist = { showNewPlaylistSheet = true },
                modifier = Modifier.padding(top = contentPadding.calculateTopPadding()),
            )

            LibraryCategory.ARTISTS -> ArtistsSubScreen(
                artists = extracted.artists,
                onBack = goBack,
                onArtistClick = onShelfItemClick,
                modifier = Modifier.padding(top = contentPadding.calculateTopPadding()),
            )

            LibraryCategory.ALBUMS -> AlbumsSubScreen(
                albums = extracted.albums,
                onBack = goBack,
                onAlbumClick = onShelfItemClick,
                modifier = Modifier.padding(top = contentPadding.calculateTopPadding()),
            )

            LibraryCategory.SONGS -> SongsSubScreen(
                songs = extracted.songs,
                playlists = extracted.playlists,
                onBack = goBack,
                onSongClick = { list, idx -> onSongClick?.invoke(list, idx) },
                onSongLongPress = { song -> onSongLongPress?.invoke(song) },
                onAddToQueue = { list ->
                    if (onSongClick != null) onSongClick(list, 0)
                },
                modifier = Modifier.padding(top = contentPadding.calculateTopPadding()),
            )

            LibraryCategory.DOWNLOADED -> DownloadedSubScreen(
                onBack = goBack,
                onSongClick = { list, idx -> onSongClick?.invoke(list, idx) },
                onAddToQueue = { list ->
                    if (onSongClick != null) onSongClick(list, 0)
                },
                modifier = Modifier.padding(top = contentPadding.calculateTopPadding()),
            )

            LibraryCategory.MADE_FOR_YOU -> MadeForYouSubScreen(
                playlists = extracted.playlists,
                artists = extracted.artists,
                songs = extracted.songs,
                historySongs = historySongs,
                onBack = goBack,
                onPlayMix = onShelfItemClick,
                onPlayQueue = { songs, title ->
                    if (onPlayQueue != null) {
                        onPlayQueue(songs, title)
                    } else if (onSongClick != null) {
                        onSongClick(songs, 0)
                    }
                },
                onStartRadio = onStartRadio,
                onOpenReplay = { onOpenReplay(ReplayStoryPage.INTRO) },
                onArtistClick = onShelfItemClick,
                modifier = Modifier.padding(top = contentPadding.calculateTopPadding()),
            )

            LibraryCategory.IMPORT_AND_SOURCES -> ImportAndSourcesSubScreen(
                onBack = goBack,
                onEditWebDav = { onEditWebDav?.invoke() },
                onEditSmb = { onEditSmb?.invoke() },
                onImportSpotifyPlaylist = onImportSpotifyPlaylist,
                onOpenSettings = { onOpenSettings?.invoke() },
                modifier = Modifier.padding(top = contentPadding.calculateTopPadding()),
            )

            LibraryCategory.RECENTLY_ADDED -> RecentlyAddedSubScreen(
                onBack = goBack,
                onSongClick = { list, idx -> onSongClick?.invoke(list, idx) },
                onSongLongPress = { song -> onSongLongPress?.invoke(song) },
                onAddToQueue = { list ->
                    if (onSongClick != null) onSongClick(list, 0)
                },
                modifier = Modifier.padding(top = contentPadding.calculateTopPadding()),
            )

            LibraryCategory.REPLAY -> {
                androidx.compose.runtime.LaunchedEffect(Unit) {
                    onOpenReplay(ReplayStoryPage.INTRO)
                    goBack()
                }
                Box(Modifier.fillMaxSize())
            }
        }
    }

    if (showNewPlaylistSheet) {
        NewPlaylistSheet(
            onDismiss = { showNewPlaylistSheet = false },
            onCreate = { _, _, _ ->
                showNewPlaylistSheet = false
                onNewPlaylist()
            },
        )
    }
}

/**
 * The way in to Replay when there is not yet enough listening data to deal the
 * personalised cards. Painted with the same drifting mesh as the Replay cards
 * and the player backdrop, so it reads as lit by the user's own listening
 * rather than as a promo banner.
 */
@Composable
private fun ReplayBanner(card: ReplayHeroCard?, onClick: () -> Unit) {
    val palette = rememberArtworkColors(card?.artworkUrl)
    Box(
        Modifier
            .padding(horizontal = PAGE_GUTTER, vertical = 6.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.matchParentSize()) {
            MeshGradientBackground(
                palette = palette,
                trackKey = card?.artworkUrl ?: "replay",
                // Not continuous: an endless phase animation under a 28dp blur
                // caused 32-58ms frame spikes while the Library feed scrolled.
                continuous = false,
                blurRadius = 28.dp,
            )
        }
        // Light horizontal scrim: just enough under the words on the left,
        // almost nothing over the colour on the right.
        Box(
            Modifier
                .matchParentSize()
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            Color.Black.copy(alpha = 0.34f),
                            Color.Black.copy(alpha = 0.12f),
                            Color.Transparent,
                        ),
                    ),
                ),
        )
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.your_replay),
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White,
                )
                Text(
                    text = card?.let { "${it.value} ${it.label.lowercase(Locale.ROOT)} · ${it.detail}" }
                        ?: stringResource(R.string.replay_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.82f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(12.dp))
            Icon(
                imageVector = RaagaIcons.ChevronRight,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.85f),
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

/**
 * The device's local audio collections and configured remote shares (WebDAV/SMB).
 */
@Composable
private fun OnDeviceShelf(
    title: String,
    downloadedPlaylists: List<SavedCollection>,
    onItemClick: (ShelfItem) -> Unit,
    onItemLongPress: (ShelfItem) -> Unit,
    onShowAll: (HomeShelf) -> Unit,
    onImportSpotifyPlaylist: () -> Unit = {},
) {
    val webdavConfigured by AppSettings.webdavUrl.collectAsStateWithLifecycle()
    val smbHost by AppSettings.smbHost.collectAsStateWithLifecycle()
    val smbShare by AppSettings.smbShare.collectAsStateWithLifecycle()
    val remotes = listOf(
        Triple(
            stringResource(R.string.webdav),
            if (webdavConfigured.isBlank()) {
                stringResource(R.string.webdav_not_configured)
            } else {
                stringResource(R.string.webdav_subtitle)
            },
            com.music.raaga.data.webdav.WebDavConfig.BROWSE_ID,
        ),
        Triple(
            stringResource(R.string.smb),
            if (smbHost.isBlank() || smbShare.isBlank()) {
                stringResource(R.string.smb_not_configured)
            } else {
                stringResource(R.string.smb_subtitle)
            },
            com.music.raaga.data.smb.SmbConfig.BROWSE_ID,
        ),
    )
    val onDeviceShelf = HomeShelf(
        title = title,
        items = listOf(
            ShelfItem(
                title = stringResource(R.string.downloads),
                subtitle = stringResource(R.string.downloaded_songs),
                thumbnailUrl = null,
                videoId = null,
                browseId = "local:downloads",
            ),
            ShelfItem(
                title = stringResource(R.string.local_music),
                subtitle = stringResource(R.string.audio_files_on_device),
                thumbnailUrl = null,
                videoId = null,
                browseId = "local:all",
            ),
        ) + remotes.map { (remTitle, subtitle, browseId) ->
            ShelfItem(
                title = remTitle,
                subtitle = subtitle,
                thumbnailUrl = null,
                videoId = null,
                browseId = browseId,
            )
        } + downloadedPlaylists.map { playlist ->
            ShelfItem(
                title = playlist.title,
                subtitle = playlist.subtitle.ifBlank {
                    stringResource(R.string.downloaded_playlist)
                },
                thumbnailUrl = playlist.thumbnailUrl,
                videoId = null,
                browseId = Downloads.pageIdFor(playlist.id),
            )
        },
    )
    LibraryGridShelf(
        shelf = onDeviceShelf,
        onItemClick = onItemClick,
        onItemLongPress = onItemLongPress,
        onShowAll = { onShowAll(onDeviceShelf) },
        trailingCards = listOf {
            NewShelfCard(
                icon = RaagaIcons.Download,
                label = stringResource(R.string.import_spotify_playlist),
                subtitle = stringResource(R.string.import_spotify_subtitle),
                onClick = onImportSpotifyPlaylist,
            )
        },
    )
}

/**
 * The one shelf that can be written to: holding a card gets rename and delete
 * on top of the queue actions every other shelf's menu offers. Pinned
 * playlists lead, and the row ends with "+ New playlist" and "Import Spotify
 * playlist" action cards.
 */
@Composable
internal fun PlaylistShelf(
    shelf: HomeShelf,
    onItemClick: (ShelfItem) -> Unit,
    onItemLongPress: (ShelfItem) -> Unit,
    onNewPlaylist: () -> Unit,
    onImportSpotifyPlaylist: () -> Unit = {},
    onShowAll: () -> Unit,
    pinnedPlaylists: List<String> = emptyList(),
) {
    LibraryGridShelf(
        shelf = shelf,
        onItemClick = onItemClick,
        onItemLongPress = onItemLongPress,
        onShowAll = onShowAll,
        pinnedPlaylists = pinnedPlaylists,
        trailingCards = listOf(
            {
                NewShelfCard(
                    icon = RaagaIcons.Plus,
                    label = stringResource(R.string.new_playlist),
                    subtitle = stringResource(R.string.saved_to_youtube_music),
                    onClick = onNewPlaylist,
                )
            },
            {
                NewShelfCard(
                    icon = RaagaIcons.Download,
                    label = stringResource(R.string.import_spotify_playlist),
                    subtitle = stringResource(R.string.import_spotify_subtitle),
                    onClick = onImportSpotifyPlaylist,
                )
            },
        ),
    )
}

/** A Library shelf's preview row never swipes past this many cards. */
private const val LIBRARY_ROW_MAX_ITEMS = 5

/**
 * A Library shelf: a sideways-scrolling row of cards stopped at
 * [LIBRARY_ROW_MAX_ITEMS], with a "Show all" beside the title whenever there is
 * more, opening the rest as a vertical grid (see [LibraryGridPage]).
 *
 * [leadingCards] ride at the front of the row, [trailingCards] at the tail.
 */
@Composable
internal fun LibraryGridShelf(
    shelf: HomeShelf,
    onItemClick: (ShelfItem) -> Unit,
    onItemLongPress: (ShelfItem) -> Unit,
    onShowAll: () -> Unit,
    leadingCard: (@Composable () -> Unit)? = null,
    leadingCards: List<@Composable () -> Unit> = listOfNotNull(leadingCard),
    trailingCards: List<@Composable () -> Unit> = emptyList(),
    pinnedPlaylists: List<String> = emptyList(),
) {
    val leadingCount = leadingCards.size
    val visibleItems = shelf.items.take((LIBRARY_ROW_MAX_ITEMS - leadingCount).coerceAtLeast(0))
    Column(Modifier.padding(bottom = 26.dp)) {
        SectionHeader(
            title = shelf.title,
            subtitle = shelf.subtitle,
            onShowAll = onShowAll.takeIf { shelf.items.size + leadingCount > LIBRARY_ROW_MAX_ITEMS },
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = PAGE_GUTTER),
            horizontalArrangement = Arrangement.spacedBy(LIBRARY_GRID_SPACING),
        ) {
            leadingCards.forEachIndexed { index, card ->
                item(key = "leading_$index") { card() }
            }
            items(visibleItems) { item ->
                ShelfCard(
                    item = item,
                    onClick = { onItemClick(item) },
                    onLongPress = { onItemLongPress(item) },
                    isPinned = AppSettings.isPlaylistPinned(item.browseId),
                )
            }
            trailingCards.forEachIndexed { index, card ->
                item(key = "trailing_$index") { card() }
            }
        }
    }
}

/**
 * Everything a Library shelf's "Show all" opens onto — the same cards, at the
 * same [libraryGrid] width, run down the screen instead of stopping at one row.
 */
@Composable
fun LibraryGridPage(
    shelf: HomeShelf,
    gridState: LazyGridState,
    onItemClick: (ShelfItem) -> Unit,
    onItemLongPress: (ShelfItem) -> Unit,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
    onNewPlaylist: (() -> Unit)? = null,
    onImportSpotifyPlaylist: (() -> Unit)? = null,
) {
    // Re-read live: this page opens from a snapshot, and a pin toggled from its
    // own long-press menu must move the card immediately.
    val pinnedPlaylists by AppSettings.pinnedPlaylists.collectAsStateWithLifecycle()
    val librarySort by AppSettings.librarySort.collectAsStateWithLifecycle()
    val sortedShelf = shelf.pinnedAndSorted(pinnedPlaylists, librarySort)
    BoxWithConstraints(modifier.fillMaxSize()) {
        val grid = libraryGrid(maxWidth - PAGE_GUTTER * 2)
        LazyVerticalGrid(
            columns = GridCells.Fixed(grid.columns),
            state = gridState,
            contentPadding = contentPadding,
            horizontalArrangement = Arrangement.spacedBy(LIBRARY_GRID_SPACING),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier.padding(horizontal = PAGE_GUTTER),
        ) {
            items(sortedShelf.items, key = { it.browseId ?: it.title }) { item ->
                ShelfCard(
                    item = item,
                    onClick = { onItemClick(item) },
                    onLongPress = { onItemLongPress(item) },
                    modifier = Modifier.fillMaxWidth(),
                    isPinned = AppSettings.isPlaylistPinned(item.browseId),
                )
            }
            if (onNewPlaylist != null) {
                item(key = "trailing_new") {
                    NewShelfCard(
                        icon = RaagaIcons.Plus,
                        label = stringResource(R.string.new_playlist),
                        subtitle = stringResource(R.string.saved_to_youtube_music),
                        onClick = onNewPlaylist,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            if (onImportSpotifyPlaylist != null) {
                item(key = "trailing_import") {
                    NewShelfCard(
                        icon = RaagaIcons.Download,
                        label = stringResource(R.string.import_spotify_playlist),
                        subtitle = stringResource(R.string.import_spotify_subtitle),
                        onClick = onImportSpotifyPlaylist,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

/** Moves the cards listed in [pinned] to the front, in pin order. */
private fun HomeShelf.pinnedFirst(pinned: List<String>): HomeShelf {
    if (pinned.isEmpty()) return this
    val (pinnedItems, seen) = collectPinned(pinned)
    if (pinnedItems.isEmpty()) return this
    return copy(items = pinnedItems + items.filter { it.browseId !in seen })
}

/**
 * Pinned playlists always lead the grid; the unpinned remainder is sorted
 * according to [sort].
 */
private fun HomeShelf.pinnedAndSorted(pinned: List<String>, sort: LibrarySort): HomeShelf {
    if (title != PLAYLISTS) return sortedForLibrary(sort)
    val (pinnedItems, seen) = collectPinned(pinned)
    val unpinned = items.filter { it.browseId !in seen }
    val sortedUnpinned = when (sort) {
        LibrarySort.DEFAULT -> unpinned
        LibrarySort.TITLE_ASC -> unpinned.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.title })
        LibrarySort.TITLE_DESC ->
            unpinned.sortedWith(compareByDescending(String.CASE_INSENSITIVE_ORDER) { it.title })
    }
    return copy(items = pinnedItems + sortedUnpinned)
}

/** Matches pinned ids (with or without the "VL" prefix) to this shelf's cards. */
private fun HomeShelf.collectPinned(pinned: List<String>): Pair<List<ShelfItem>, Set<String>> {
    val pinnedItems = mutableListOf<ShelfItem>()
    val seen = mutableSetOf<String>()
    for (pinId in pinned) {
        val rawPin = pinId.removePrefix("VL")
        val match = items.firstOrNull { item ->
            val bId = item.browseId ?: return@firstOrNull false
            (bId == pinId || bId == rawPin || bId == "VL$rawPin") && bId !in seen
        }
        val id = match?.browseId
        if (match != null && id != null) {
            pinnedItems.add(match)
            seen.add(id)
        }
    }
    return pinnedItems to seen
}

/** A card's title is all a Library shelf carries, so everything but DEFAULT sorts on it. */
private fun HomeShelf.sortedForLibrary(sort: LibrarySort): HomeShelf = when (sort) {
    LibrarySort.DEFAULT -> this
    LibrarySort.TITLE_ASC -> copy(items = items.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.title }))
    LibrarySort.TITLE_DESC -> copy(
        items = items.sortedWith(compareByDescending(String.CASE_INSENSITIVE_ORDER) { it.title }),
    )
}

/** The library feed whose cards are the account's own — see [PlaylistShelf]. */
private const val PLAYLISTS = YtMusicRepository.PLAYLISTS_SHELF
