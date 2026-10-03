package com.music.raaga.ui.screens

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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.model.HomeShelf
import com.music.raaga.R
import com.music.raaga.data.model.LibraryPage
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.UiState
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.settings.LibrarySort
import com.music.raaga.download.Downloads
import com.music.raaga.download.SavedCollection
import com.music.raaga.ui.icons.RaagaIcons
import com.music.raaga.ui.components.LIBRARY_GRID_SPACING
import com.music.raaga.ui.components.MessageState
import com.music.raaga.ui.components.PAGE_GUTTER
import com.music.raaga.ui.components.PullToRefresh
import com.music.raaga.ui.components.SHELF_CARD_WIDTH
import com.music.raaga.ui.components.ShelfSkeleton
import com.music.raaga.ui.components.libraryGrid
import com.music.raaga.ui.components.librarySkeleton
import com.music.raaga.ui.player.MeshGradientBackground
import com.music.raaga.ui.player.rememberArtworkColors
import com.music.raaga.ui.replay.ReplayCardRow
import com.music.raaga.ui.replay.ReplayHeroCard
import com.music.raaga.ui.replay.ReplayStoryPage
import java.util.Locale

/**
 * The signed-in library: the saved collections, as shelves of cards.
 *
 * Deliberately only the collections. This page used to end with two runs of
 * track rows — "Liked Music" and "Songs" — which are two overlapping answers
 * to the same question and read as one list that couldn't make up its mind: a
 * track that stopped being liked didn't leave the page, it moved down it, into
 * a section most people had taken for more of the same. Liked Music is a
 * playlist, and it is reached the way every other playlist here is, by opening
 * its card.
 *
 * The liked list is still fetched — it is what the rest of the app reads a
 * track's rating off (see MainViewModel's `likeStatuses`); it just isn't a
 * second place to browse it.
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
    /**
     * A shelf's "Show all" — every shelf's row here stops at five cards (see
     * [LibraryGridShelf]), so this is the only way to reach whatever didn't
     * fit.
     */
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
     * The playlists downloaded whole, as cards behind the two device folders.
     *
     * They belong on that shelf because they are the same promise everything
     * else on it makes — here, now, without a network. Nothing is truncated:
     * the shelf is a row that scrolls, so "all of them" costs nothing.
     *
     * Downloaded *albums* are deliberately not here. An album stamps its name
     * onto each of its tracks, so the Downloads folder's Albums tab groups it
     * back up on its own and a card here would be a second door onto the same
     * list. A playlist has no tag anything can derive it from — its tracks are
     * off forty different releases — so this is the only place it can be reached
     * without going through that folder.
     */
    downloadedPlaylists: List<SavedCollection> = emptyList(),
) {
    val pinnedPlaylists by AppSettings.pinnedPlaylists.collectAsStateWithLifecycle()
    val onDevice = stringResource(R.string.on_device)
    PullToRefresh(
        refreshing = refreshing,
        onRefresh = onRefresh,
        state = pullState,
        modifier = modifier,
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = contentPadding,
        ) {
            item {
                Text(
                    text = stringResource(R.string.library),
                    style = MaterialTheme.typography.displayLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(horizontal = PAGE_GUTTER, vertical = 8.dp),
                )
            }
            // Drawn whether or not anything has been played: with nothing behind
            // it the page still has to say the feature exists, or the only way
            // to discover it is to have already used it.
            item(key = "replay") {
                if (replayCards.isEmpty()) {
                    // Keep Replay discoverable before there is enough listening
                    // data to deal the personalised cards.
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
            if (!signedIn) {
                item(key = "shelf:$onDevice") {
                    OnDeviceShelf(
                        title = onDevice,
                        downloadedPlaylists = downloadedPlaylists,
                        onItemClick = onShelfItemClick,
                        onItemLongPress = onShelfItemLongPress,
                        onShowAll = onShowAll,
                    )
                }
                item {
                    MessageState(
                        message = stringResource(R.string.library_sign_in_description),
                        actionLabel = stringResource(R.string.sign_in),
                        onAction = onSignIn,
                    )
                }
                return@LazyColumn
            }
            when (state) {
                is UiState.Loading -> {
                    item(key = "skeleton:library:playlists") { ShelfSkeleton() }
                    item(key = "shelf:$onDevice") {
                        OnDeviceShelf(
                            title = onDevice,
                            downloadedPlaylists = downloadedPlaylists,
                            onItemClick = onShelfItemClick,
                            onItemLongPress = onShelfItemLongPress,
                            onShowAll = onShowAll,
                        )
                    }
                    librarySkeleton()
                }
                is UiState.Error -> {
                    item(key = "shelf:$onDevice") {
                        OnDeviceShelf(
                            title = onDevice,
                            downloadedPlaylists = downloadedPlaylists,
                            onItemClick = onShelfItemClick,
                            onItemLongPress = onShelfItemLongPress,
                            onShowAll = onShowAll,
                        )
                    }
                    item {
                        MessageState(state.message, actionLabel = stringResource(R.string.retry), onAction = onRetry)
                    }
                }
                is UiState.Success -> {
                    val shelves = state.data.shelves
                    val playlistShelf = shelves.firstOrNull { it.title == PLAYLISTS }
                        ?: HomeShelf(PLAYLISTS, emptyList())
                    val otherShelves = shelves.filter { it.title != PLAYLISTS }

                    item(key = "shelf:$PLAYLISTS") {
                        val pinnedFirst = playlistShelf.pinnedFirst(pinnedPlaylists)
                        PlaylistShelf(
                            shelf = pinnedFirst,
                            onItemClick = onShelfItemClick,
                            onItemLongPress = onShelfItemLongPress,
                            onNewPlaylist = onNewPlaylist,
                            onImportSpotifyPlaylist = onImportSpotifyPlaylist,
                            onShowAll = { onShowAll(pinnedFirst) },
                            pinnedPlaylists = pinnedPlaylists,
                        )
                    }

                    item(key = "shelf:$onDevice") {
                        OnDeviceShelf(
                            title = onDevice,
                            downloadedPlaylists = downloadedPlaylists,
                            onItemClick = onShelfItemClick,
                            onItemLongPress = onShelfItemLongPress,
                            onShowAll = onShowAll,
                        )
                    }

                    otherShelves.forEach { shelf ->
                        item(key = "shelf:${shelf.title}") {
                            LibraryGridShelf(
                                shelf = shelf,
                                onItemClick = onShelfItemClick,
                                onItemLongPress = onShelfItemLongPress,
                                onShowAll = { onShowAll(shelf) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * The way in to Replay, at the top of the page.
 *
 * On the Library tab rather than a tab of its own because that is what Replay
 * is — a view of what is already yours, alongside the playlists and the
 * downloads. A fifth tab would give a page most people open a handful of times
 * a year the same standing as Search.
 *
 * ## Why it is painted the way the cards are
 *
 * The mesh is the same one the Replay cards and the player's backdrop run —
 * sampled from the artwork of the record the period was mostly spent on, and
 * drifting rather than settling (see [MeshGradientBackground]'s `continuous`).
 * A fixed brand gradient here looked like a promo banner, which is the one thing
 * this must not be: it advertises the user's own listening, so it should be lit
 * by the user's own listening, and it should not look like anything else on the
 * page. With nothing played yet the mesh falls back to its stock colours, which
 * is a perfectly good button and still not a red rectangle.
 *
 * A single wide strip rather than a shelf of cards: there is exactly one of it,
 * and a carousel with one item in it always reads as a carousel that failed to
 * load the rest.
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
        // Behind the row and sized to it rather than given a height of its own,
        // so the strip is as tall as its two lines of type and no taller.
        Box(Modifier.matchParentSize()) {
            MeshGradientBackground(
                palette = palette,
                trackKey = card?.artworkUrl ?: "replay",
                // Continuous was previously true here, which caused an infinite
                // while(isActive) phase.animateTo() loop driving a 28dp GPU blur
                // at 120Hz even while the user scrolled the Library feed. Setting
                // it false lets the blobs settle once on open/track-change — the
                // visual result is indistinguishable at rest — and eliminates the
                // constant frame invalidation that was causing 32-58ms frame spikes.
                continuous = false,
                // A short wide strip: at the backdrop's own radius the four
                // colours blur into one wash before they reach its ends.
                blurRadius = 28.dp,
            )
        }
        // The mesh carries a vertical scrim of its own, pitched for a full
        // screen where it has hundreds of dp to fade across; over a strip this
        // short it lands as a flat darkening of the whole thing. So this one is
        // kept deliberately light and runs the other way — just enough under the
        // words on the left, and almost nothing over the colour on the right,
        // which is the half anyone actually sees as a gradient.
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
                    // The numbers when there are any, because "5,231 minutes" is
                    // a reason to tap and a description of the feature is not.
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
    )
}

/**
 * The one shelf on this page that can be written to: holding a card gets rename
 * and delete on top of the queue actions every other shelf's menu offers.
 *
 * Cards begin with pinned playlists followed by remaining playlists, and
 * conclude with the "+ New playlist" and "Import Spotify playlist" action cards.
 */
@Composable
private fun PlaylistShelf(
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
 * A Library shelf: a sideways-scrolling row of [SHELF_CARD_WIDTH] cards, the
 * same as every other shelf, but stopped at [LIBRARY_ROW_MAX_ITEMS] rather
 * than left to run the shelf's whole length — with a "Show all" beside the
 * title whenever there's more than that, opening the rest as a
 * vertically-scrolling grid instead. See [LibraryGridPage].
 *
 * [leadingCards] ride at the front of the row, and [trailingCards] ride at the
 * tail of the row.
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
    // Re-read live rather than trusting [shelf] to already be sorted: this page
    // is opened from a snapshot (see `libraryShowAll` in MainActivity), and a
    // pin toggled from this page's own long-press menu must move the card
    // immediately rather than waiting for the row underneath to be revisited.
    val pinnedPlaylists by AppSettings.pinnedPlaylists.collectAsStateWithLifecycle()
    val librarySort by AppSettings.librarySort.collectAsStateWithLifecycle()
    // Pinned playlists always lead at the top, followed by sorted remainder
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

/**
 * Moves whichever of this shelf's cards are in [pinned] to the front, in the
 * order they were pinned, leaving everything else in its existing order behind
 * them.
 */
private fun HomeShelf.pinnedFirst(pinned: List<String>): HomeShelf {
    if (pinned.isEmpty()) return this
    val pinnedItems = mutableListOf<ShelfItem>()
    val seen = mutableSetOf<String>()
    for (pinId in pinned) {
        val rawPin = pinId.removePrefix("VL")
        val match = items.firstOrNull { item ->
            val bId = item.browseId ?: return@firstOrNull false
            (bId == pinId || bId == rawPin || bId == "VL$rawPin") && bId !in seen
        }
        if (match != null && match.browseId != null) {
            pinnedItems.add(match)
            seen.add(match.browseId)
        }
    }
    if (pinnedItems.isEmpty()) return this
    val remaining = items.filter { it.browseId !in seen }
    return copy(items = pinnedItems + remaining)
}

/**
 * Pinned playlists always remain first at the top of the grid, with the
 * remaining unpinned items sorted according to [sort].
 */
private fun HomeShelf.pinnedAndSorted(pinned: List<String>, sort: LibrarySort): HomeShelf {
    if (title != PLAYLISTS) return sortedForLibrary(sort)
    val pinnedItems = mutableListOf<ShelfItem>()
    val seen = mutableSetOf<String>()
    for (pinId in pinned) {
        val rawPin = pinId.removePrefix("VL")
        val match = items.firstOrNull { item ->
            val bId = item.browseId ?: return@firstOrNull false
            (bId == pinId || bId == rawPin || bId == "VL$rawPin") && bId !in seen
        }
        if (match != null && match.browseId != null) {
            pinnedItems.add(match)
            seen.add(match.browseId)
        }
    }
    val unpinnedItems = items.filter { it.browseId !in seen }
    val sortedUnpinned = when (sort) {
        LibrarySort.DEFAULT -> unpinnedItems
        LibrarySort.TITLE_ASC -> unpinnedItems.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.title })
        LibrarySort.TITLE_DESC -> unpinnedItems.sortedWith(compareByDescending(String.CASE_INSENSITIVE_ORDER) { it.title })
    }
    return copy(items = pinnedItems + sortedUnpinned)
}

/**
 * A card's title is all a Library shelf carries, so [LibrarySort.DEFAULT] is
 * the only option that isn't alphabetical — everything else sorts on it.
 */
private fun HomeShelf.sortedForLibrary(sort: LibrarySort): HomeShelf = when (sort) {
    LibrarySort.DEFAULT -> this
    LibrarySort.TITLE_ASC -> copy(items = items.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.title }))
    LibrarySort.TITLE_DESC -> copy(
        items = items.sortedWith(compareByDescending(String.CASE_INSENSITIVE_ORDER) { it.title }),
    )
}

/** The library feed whose cards are the account's own — see [PlaylistShelf]. */
private const val PLAYLISTS = YtMusicRepository.PLAYLISTS_SHELF
