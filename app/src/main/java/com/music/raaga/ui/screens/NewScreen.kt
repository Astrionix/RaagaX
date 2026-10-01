package com.music.raaga.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.model.HomeShelf
import com.music.raaga.data.model.MoodGenre
import com.music.raaga.data.model.NewFeedData
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.UiState
import com.music.raaga.data.settings.LibraryViewType
import com.music.raaga.ui.components.MessageState
import com.music.raaga.ui.components.PAGE_GUTTER
import com.music.raaga.ui.components.PullToRefresh
import com.music.raaga.ui.components.feedSkeleton
import com.music.raaga.ui.icons.RaagaIcons

internal fun ShelfItem.isAudioOnly(): Boolean =
    !isVideo &&
    !title.contains("video", ignoreCase = true) &&
    !subtitle.contains("video", ignoreCase = true)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewScreen(
    state: UiState<NewFeedData>,
    listState: LazyListState,
    onItemClick: (ShelfItem, String) -> Unit,
    onItemLongPress: ((ShelfItem) -> Unit)?,
    onCategoryClick: ((MoodGenre) -> Unit)? = null,
    onRetry: () -> Unit,
    refreshing: Boolean,
    onRefresh: () -> Unit,
    pullState: PullToRefreshState,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    var featuredViewType by rememberSaveable { mutableStateOf(LibraryViewType.GRID) }

    val successData = (state as? UiState.Success)?.data
    val allExploreShelves = remember(successData) {
        successData?.exploreShelves?.filterNot { it.title.contains("video", ignoreCase = true) }.orEmpty()
    }
    val trendingShelf = remember(successData, allExploreShelves) {
        val raw = allExploreShelves.firstOrNull { it.title.equals("Trending", ignoreCase = true) }
            ?: successData?.charts?.firstOrNull {
                it.title.contains("trend", ignoreCase = true) || it.title.contains("top songs", ignoreCase = true)
            }
        raw?.let { shelf ->
            shelf.copy(items = shelf.items.filter { it.isAudioOnly() })
        }
    }
    val albumShelves = remember(successData, allExploreShelves) {
        (successData?.newReleases.orEmpty()) + allExploreShelves.filter {
            it.title.contains("album", ignoreCase = true) || it.title.contains("single", ignoreCase = true)
        }
    }
    val chartShelves = remember(successData) {
        successData?.charts?.filterNot { it.title.contains("video", ignoreCase = true) }?.map { shelf ->
            shelf.copy(items = shelf.items.filter { it.browseId?.startsWith("UC") == true || it.isAudioOnly() })
        }?.filter { it.items.isNotEmpty() }.orEmpty()
    }

    // Check for explicit shelves with "featured", "premiered" or "today" in title/subtitle (Audio only)
    val explicitFeaturedShelves = remember(allExploreShelves, successData?.newReleases) {
        (allExploreShelves + (successData?.newReleases.orEmpty())).filter {
            (it.title.contains("featured", ignoreCase = true) ||
             it.title.contains("premiered", ignoreCase = true) ||
             it.subtitle.contains("featured", ignoreCase = true) ||
             it.subtitle.contains("premiered", ignoreCase = true)) && it.items.isNotEmpty()
        }.map { shelf ->
            shelf.copy(items = shelf.items.filter { it.isAudioOnly() })
        }.filter { it.items.isNotEmpty() }.distinctBy { it.title }
    }

    val fallbackFeaturedShelf = remember(successData, trendingShelf, albumShelves, chartShelves) {
        val trendingTracks = trendingShelf?.items.orEmpty()
        val newReleaseTracks = (successData?.newReleases.orEmpty()).flatMap { it.items }
        val chartTracks = chartShelves.flatMap { it.items }
        val combined = (trendingTracks + newReleaseTracks + chartTracks)
            .filter { it.isAudioOnly() }
            .distinctBy { it.videoId ?: it.browseId }
            .take(20)

        if (combined.isNotEmpty()) {
            HomeShelf(
                title = "Featured today",
                items = combined,
                subtitle = "Premiered today",
            )
        } else {
            null
        }
    }

    val featuredShelvesToRender = remember(explicitFeaturedShelves, fallbackFeaturedShelf) {
        if (explicitFeaturedShelves.isNotEmpty()) {
            explicitFeaturedShelves
        } else {
            listOfNotNull(fallbackFeaturedShelf)
        }
    }

    val renderedFeaturedTitles = remember(featuredShelvesToRender) {
        featuredShelvesToRender.map { it.title }.toSet()
    }
    val filteredAlbumShelves = remember(albumShelves, renderedFeaturedTitles) {
        albumShelves.filterNot { it.title in renderedFeaturedTitles }
    }

    PullToRefresh(
        refreshing = refreshing,
        onRefresh = onRefresh,
        state = pullState,
        modifier = modifier,
    ) {
        LazyColumn(
            state = listState,
            contentPadding = contentPadding,
            modifier = Modifier.fillMaxSize(),
        ) {
            item(key = "new_header") {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = PAGE_GUTTER, vertical = 6.dp),
                ) {
                    Text(
                        text = stringResource(R.string.tab_new),
                        style = MaterialTheme.typography.displayLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = stringResource(R.string.new_screen_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(14.dp))
                }
            }

            when (state) {
                is UiState.Loading -> {
                    feedSkeleton()
                }

                is UiState.Error -> {
                    item(key = "new_error") {
                        MessageState(
                            message = state.message,
                            actionLabel = stringResource(R.string.retry),
                            onAction = onRetry,
                        )
                    }
                }

                is UiState.Success -> {
                    // 1. Featured Releases (Recents-style with Maximize/Minimize Hero Card size & layout - Audio Only)
                    featuredShelvesToRender.forEachIndexed { index, shelf ->
                        item(key = "new_featured_shelf_${shelf.title}_$index") {
                            RecentShelf(
                                shelf = shelf,
                                onItemClick = { item -> onItemClick(item, shelf.title) },
                                onItemLongPress = onItemLongPress,
                                viewType = featuredViewType,
                                onViewTypeToggle = {
                                    featuredViewType = if (featuredViewType == LibraryViewType.GRID) {
                                        LibraryViewType.LIST
                                    } else {
                                        LibraryViewType.GRID
                                    }
                                },
                            )
                        }
                    }

                    // 2. Top 10 Numbered Trending Countdown (Audio Only)
                    if (trendingShelf != null && trendingShelf.items.isNotEmpty()) {
                        item(key = "new_top_10_countdown") {
                            TopTrendingCountdown(
                                shelf = trendingShelf,
                                onItemClick = { item -> onItemClick(item, trendingShelf.title) },
                                onItemLongPress = onItemLongPress,
                            )
                        }
                    }

                    // 3. New Releases & Albums Shelves
                    filteredAlbumShelves.distinctBy { it.title }.forEachIndexed { index, shelf ->
                        item(key = "new_album_shelf_${shelf.title}_$index") {
                            NewHorizontalShelf(
                                shelf = shelf,
                                onItemClick = { item -> onItemClick(item, shelf.title) },
                                onItemLongPress = onItemLongPress,
                            )
                        }
                    }

                    // 4. Top Charts & Artists (Audio Only)
                    chartShelves.distinctBy { it.title }.forEachIndexed { index, shelf ->
                        item(key = "new_chart_shelf_${shelf.title}_$index") {
                            val isArtistShelf = shelf.title.contains("artist", ignoreCase = true) ||
                                (shelf.items.firstOrNull()?.browseId?.startsWith("UC") == true)

                            if (isArtistShelf) {
                                NewArtistShelf(
                                    shelf = shelf,
                                    onItemClick = { item -> onItemClick(item, shelf.title) },
                                )
                            } else {
                                NewHorizontalShelf(
                                    shelf = shelf,
                                    onItemClick = { item -> onItemClick(item, shelf.title) },
                                    onItemLongPress = onItemLongPress,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Top 10 Numbered Trending Countdown (#01, #02 ... #10) - Audio only */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TopTrendingCountdown(
    shelf: HomeShelf,
    onItemClick: (ShelfItem) -> Unit,
    onItemLongPress: ((ShelfItem) -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val items = shelf.items.filter { it.isAudioOnly() && it.videoId != null }.take(10)
    if (items.isEmpty()) return

    Column(modifier = modifier.padding(bottom = 26.dp)) {
        SectionHeader(
            title = stringResource(R.string.top_trending_title),
            subtitle = stringResource(R.string.top_trending_subtitle),
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = PAGE_GUTTER),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items.forEachIndexed { index, item ->
                val rankText = String.format("%02d", index + 1)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .combinedClickable(
                            onClick = { onItemClick(item) },
                            onLongClick = onItemLongPress?.let { { it(item) } },
                        )
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Ranking Number
                    Text(
                        text = rankText,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Black,
                        color = if (index < 3) Color(0xFFFF5252) else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        modifier = Modifier.width(36.dp),
                    )

                    // Song Thumbnail
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                    ) {
                        if (item.thumbnailUrl != null) {
                            AsyncImage(
                                model = item.thumbnailUrl,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }

                    Spacer(Modifier.width(12.dp))

                    // Title & Artist
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = item.title,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onBackground,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        if (item.subtitle.isNotBlank()) {
                            Spacer(Modifier.height(2.dp))
                            Text(
                                text = item.subtitle,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }

                    Spacer(Modifier.width(8.dp))

                    // Play Indicator
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            RaagaIcons.Play,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier
                                .size(14.dp)
                                .offset(x = 1.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NewHorizontalShelf(
    shelf: HomeShelf,
    onItemClick: (ShelfItem) -> Unit,
    onItemLongPress: ((ShelfItem) -> Unit)?,
    modifier: Modifier = Modifier,
) {
    if (shelf.items.isEmpty()) return

    Column(modifier = modifier.padding(bottom = 24.dp)) {
        SectionHeader(title = shelf.title, subtitle = shelf.subtitle)
        LazyRow(
            contentPadding = PaddingValues(horizontal = PAGE_GUTTER),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(
                items = shelf.items,
                key = { it.videoId ?: it.browseId ?: "${it.title}_${it.subtitle}" },
            ) { item ->
                ShelfCard(
                    item = item,
                    onClick = { onItemClick(item) },
                    onLongPress = onItemLongPress?.let { { it(item) } },
                )
            }
        }
    }
}

@Composable
private fun NewArtistShelf(
    shelf: HomeShelf,
    onItemClick: (ShelfItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (shelf.items.isEmpty()) return

    Column(modifier = modifier.padding(bottom = 24.dp)) {
        SectionHeader(title = shelf.title, subtitle = shelf.subtitle)
        LazyRow(
            contentPadding = PaddingValues(horizontal = PAGE_GUTTER),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(
                items = shelf.items,
                key = { it.browseId ?: it.title },
            ) { item ->
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .width(108.dp)
                        .clickable { onItemClick(item) },
                ) {
                    Box(
                        modifier = Modifier
                            .size(96.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (item.thumbnailUrl != null) {
                            AsyncImage(
                                model = item.thumbnailUrl,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        } else {
                            Icon(
                                RaagaIcons.Search,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onBackground,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                    )
                    if (item.subtitle.isNotBlank()) {
                        Text(
                            text = item.subtitle,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}
