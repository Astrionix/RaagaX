package com.music.raaga.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.model.HEADER_ART_PX
import com.music.raaga.data.model.HomeShelf
import com.music.raaga.data.model.KeyedMix
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.UiState
import com.music.raaga.data.model.artworkAt
import com.music.raaga.ui.components.MessageState
import com.music.raaga.ui.components.PAGE_GUTTER
import com.music.raaga.ui.components.PullToRefresh
import com.music.raaga.ui.components.SignInBanner
import com.music.raaga.ui.components.feedSkeleton
import com.music.raaga.ui.components.thumbnailBorder
import com.music.raaga.ui.theme.rememberArtworkPalette

/**
 * YouTube Music's "Mixed for you" cards, laid out the way Apple Music lays out
 * its stations rather than as the web player's one undivided grid.
 *
 * The page is a single flat list of mixes, and it sorts itself into three kinds
 * by name (see [groupMixes]): the handful of named mixes everyone gets, the
 * My Mixes made from this listener's taste, and the mood mixes. Each kind gets
 * the shape that suits how many there are and how personal they are — tiles,
 * a feature carousel, and a shelf per mood.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MixesScreen(
    /** The large heading, drawn where Explore and Library draw theirs; null for none. */
    title: String?,
    state: UiState<List<KeyedMix>>,
    signedIn: Boolean,
    listState: LazyListState,
    onItemClick: (ShelfItem) -> Unit,
    onRetry: () -> Unit,
    onSignIn: () -> Unit,
    refreshing: Boolean,
    onRefresh: () -> Unit,
    pullState: PullToRefreshState,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
    /** Holding a card: the playlist menu, as on Home. */
    onItemLongPress: ((ShelfItem) -> Unit)? = null,
) {
    val sections = remember(state) { (state as? UiState.Success)?.data?.let(::groupMixes) }
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
            if (title != null) {
                item(key = "title") {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.displayLarge,
                        color = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.padding(
                            start = PAGE_GUTTER,
                            end = PAGE_GUTTER,
                            top = 8.dp,
                            bottom = 14.dp,
                        ),
                    )
                }
            }
            if (!signedIn) {
                item(key = "sign-in") { SignInBanner(onSignIn = onSignIn) }
                return@LazyColumn
            }
            when (state) {
                is UiState.Loading -> feedSkeleton()
                is UiState.Error -> item(key = "error") {
                    MessageState(state.message, actionLabel = stringResource(R.string.retry), onAction = onRetry)
                }
                is UiState.Success -> {
                    if (sections == null || sections.isEmpty) {
                        item(key = "empty") { MessageState(stringResource(R.string.mixes_none)) }
                    } else {
                        if (sections.stations.isNotEmpty()) {
                            item(key = "stations") {
                                StationGrid(sections.stations, onItemClick, onItemLongPress)
                            }
                        }
                        if (sections.yours.isNotEmpty()) {
                            item(key = "yours") {
                                FeatureCarousel(
                                    title = stringResource(R.string.mixes_yours),
                                    items = sections.yours,
                                    onItemClick = onItemClick,
                                    onItemLongPress = onItemLongPress,
                                )
                            }
                        }
                        sections.moods.forEach { mood ->
                            item(key = "mood:${mood.key}") {
                                Shelf(
                                    shelf = HomeShelf(title = mood.name, items = mood.items),
                                    onItemClick = onItemClick,
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

/**
 * The named mixes as square tiles, three across (six on a wide screen), the
 * way Apple Music opens with its stations.
 */
@Composable
private fun StationGrid(
    items: List<ShelfItem>,
    onItemClick: (ShelfItem) -> Unit,
    onItemLongPress: ((ShelfItem) -> Unit)?,
) {
    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = PAGE_GUTTER)
            .padding(bottom = 26.dp),
    ) {
        val columns = if (maxWidth >= WIDE_GRID_WIDTH) 6 else 3
        Column(verticalArrangement = Arrangement.spacedBy(TILE_SPACING)) {
            items.chunked(columns).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(TILE_SPACING)) {
                    row.forEach { item ->
                        StationTile(
                            item = item,
                            onClick = { onItemClick(item) },
                            onLongPress = onItemLongPress?.let { { it(item) } },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

/**
 * One named mix, as a station: its artwork blurred down to colour alone, the
 * Raaga mark in the middle, and its name along the foot.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun StationTile(
    item: ShelfItem,
    onClick: () -> Unit,
    onLongPress: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(TILE_CORNER)
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(shape)
            .thumbnailBorder(shape)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .combinedClickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
                onLongClick = onLongPress,
            ),
    ) {
        AsyncImage(
            model = item.thumbnailUrl.artworkAt(TILE_BLUR_ART_PX),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = TILE_BLUR_OVERSCAN
                    scaleY = TILE_BLUR_OVERSCAN
                }
                .blur(TILE_BLUR_RADIUS),
        )
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = TILE_VEIL_ALPHA)),
        )
        Column(Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_logo),
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier
                        .fillMaxWidth(TILE_LOGO_FRACTION)
                        .aspectRatio(LOGO_ASPECT),
                )
            }
            Text(
                text = item.title,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
                    .padding(bottom = 9.dp),
            )
        }
    }
}

/**
 * Cards a size up from Home's, each with its caption on a band tinted from its
 * own artwork — Apple Music's On Air Now.
 */
@Composable
private fun FeatureCarousel(
    title: String,
    items: List<ShelfItem>,
    onItemClick: (ShelfItem) -> Unit,
    onItemLongPress: ((ShelfItem) -> Unit)?,
) {
    Column(Modifier.padding(bottom = 26.dp)) {
        SectionHeader(title)
        LazyRow(
            contentPadding = PaddingValues(horizontal = PAGE_GUTTER),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(items, key = { it.browseId ?: it.title }) { item ->
                FeatureCard(
                    item = item,
                    onClick = { onItemClick(item) },
                    onLongPress = onItemLongPress?.let { { it(item) } },
                    modifier = Modifier.width(FEATURE_CARD_WIDTH),
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun FeatureCard(
    item: ShelfItem,
    onClick: () -> Unit,
    onLongPress: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val palette = rememberArtworkPalette(item.thumbnailUrl, artPx = HEADER_ART_PX)
    val shape = RoundedCornerShape(FEATURE_CORNER)
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        modifier = modifier
            .clip(shape)
            .thumbnailBorder(shape)
            .background(palette.wash)
            .combinedClickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
                onLongClick = onLongPress,
            ),
    ) {
        AsyncImage(
            model = item.thumbnailUrl.artworkAt(HEADER_ART_PX),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .background(MaterialTheme.colorScheme.surfaceVariant),
        )
        Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(
                text = item.title,
                style = MaterialTheme.typography.titleMedium,
                color = palette.onBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = localizeCardSubtitle(item.subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.onBackgroundVariant,
                minLines = 2,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

internal data class MoodMixes(val key: String, val name: String, val items: List<ShelfItem>)

internal class MixSections(
    val stations: List<ShelfItem>,
    val yours: List<ShelfItem>,
    val moods: List<MoodMixes>,
) {
    val isEmpty: Boolean get() = stations.isEmpty() && yours.isEmpty() && moods.isEmpty()
}

internal fun groupMixes(mixes: List<KeyedMix>): MixSections {
    val unique = mixes.distinctBy { it.item.browseId ?: it.item.title }
    val stations = mutableListOf<Pair<Int, ShelfItem>>()
    val yours = mutableListOf<ShelfItem>()
    val moods = LinkedHashMap<String, Pair<String, MutableList<Pair<Int, ShelfItem>>>>()
    fun addMood(name: String, order: Int, item: ShelfItem) {
        moods.getOrPut(name.lowercase()) { name to mutableListOf() }.second += order to item
    }
    unique.forEach { mix ->
        val key = mix.englishTitle.trim()
        val rank = SIGNATURE_MIXES.indexOf(key.lowercase())
        val supermix = MOOD_SUPERMIX.matchEntire(key)
        val numbered = NUMBERED_MIX.matchEntire(key)
        when {
            rank >= 0 -> stations += rank to mix.item
            supermix != null -> addMood(supermix.groupValues[1], 0, mix.item)
            numbered != null && !numbered.groupValues[1].equals("My", ignoreCase = true) ->
                addMood(numbered.groupValues[1], numbered.groupValues[2].toInt(), mix.item)
            else -> yours += mix.item
        }
    }
    val englishByItem = unique.associate { it.item to it.englishTitle.trim() }
    return MixSections(
        stations = stations.sortedBy { it.first }.map { it.second },
        yours = yours,
        moods = moods.map { (key, entry) ->
            val (englishName, members) = entry
            val sorted = members.sortedBy { it.first }
            MoodMixes(
                key = key,
                name = moodHeading(englishName, sorted, englishByItem),
                items = sorted.map { it.second },
            )
        },
    )
}

private fun moodHeading(
    englishName: String,
    members: List<Pair<Int, ShelfItem>>,
    englishByItem: Map<ShelfItem, String>,
): String {
    val shownInEnglish = members.all { (_, item) -> item.title.trim() == englishByItem[item] }
    if (shownInEnglish) return englishName
    val numbered = members.filter { it.first > 0 }.map { it.second.title.trim() }
    val heading = when {
        numbered.size >= 2 -> numbered.reduce { acc, title -> acc.commonPrefixWith(title) }
        numbered.size == 1 -> numbered.single()
        else -> members.firstOrNull()?.second?.title?.trim().orEmpty()
    }.trimEnd { !it.isLetter() }
    return heading.takeIf { it.length >= 2 }
        ?: members.firstOrNull()?.second?.title?.trim()
        ?: englishName
}

private val SIGNATURE_MIXES = listOf(
    "my supermix", "discover mix", "new release mix", "replay mix", "archive mix", "liked music",
)

private val MOOD_SUPERMIX = Regex("""^(.+?)\s+supermix$""", RegexOption.IGNORE_CASE)
private val NUMBERED_MIX = Regex("""^(.+?)\s+mix\s*(\d+)$""", RegexOption.IGNORE_CASE)

private val TILE_SPACING = 12.dp
private val TILE_CORNER = 12.dp
private val WIDE_GRID_WIDTH = 600.dp
private const val TILE_BLUR_ART_PX = 48
private val TILE_BLUR_RADIUS = 24.dp
private const val TILE_BLUR_OVERSCAN = 1.5f
private const val TILE_VEIL_ALPHA = 0.18f
private const val TILE_LOGO_FRACTION = 0.42f
private const val LOGO_ASPECT = 730f / 484f
private val FEATURE_CARD_WIDTH = 240.dp
private val FEATURE_CORNER = 14.dp
