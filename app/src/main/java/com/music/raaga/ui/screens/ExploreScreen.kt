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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.model.HomeShelf
import com.music.raaga.data.model.MoodGenre
import com.music.raaga.data.model.MoodGenreSection
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.data.model.UiState
import com.music.raaga.ui.components.MessageState
import com.music.raaga.ui.components.PAGE_GUTTER
import com.music.raaga.ui.components.PullToRefresh
import com.music.raaga.ui.components.ShimmerBox
import com.music.raaga.ui.components.feedSkeleton

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExploreScreen(
    state: UiState<List<MoodGenreSection>>,
    listState: LazyListState,
    onCategoryClick: (MoodGenre) -> Unit,
    onRetry: () -> Unit,
    refreshing: Boolean,
    onRefresh: () -> Unit,
    pullState: PullToRefreshState,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
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
            item {
                Text(
                    text = stringResource(R.string.explore),
                    style = MaterialTheme.typography.displayLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(horizontal = PAGE_GUTTER, vertical = 8.dp),
                )
            }
            when (state) {
                UiState.Loading -> item { ExploreSkeleton() }
                is UiState.Error -> item {
                    MessageState(state.message, actionLabel = stringResource(R.string.retry), onAction = onRetry)
                }
                is UiState.Success -> state.data.forEach { section ->
                    item(key = section.title) {
                        MoodGenreGrid(section = section, onCategoryClick = onCategoryClick)
                    }
                }
            }
        }
    }
}

@Composable
internal fun MoodGenreGrid(
    section: MoodGenreSection,
    onCategoryClick: (MoodGenre) -> Unit,
) {
    Column(Modifier.padding(bottom = 22.dp)) {
        SectionHeader(section.title)
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val cardWidth = (maxWidth - PAGE_GUTTER * 2 - 12.dp) / 2
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(horizontal = PAGE_GUTTER),
            ) {
                section.items.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        row.forEach { item ->
                            MoodGenreCard(
                                item = item,
                                onClick = { onCategoryClick(item) },
                                modifier = Modifier.width(cardWidth),
                            )
                        }
                        if (row.size == 1) Spacer(Modifier.width(cardWidth))
                    }
                }
            }
        }
    }
}

@Composable
internal fun MoodGenreCard(
    item: MoodGenre,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val color = moodColor(item.title)
    Box(
        modifier = modifier
            .height(100.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(
                Brush.linearGradient(
                    listOf(color, color.copy(red = color.red * .68f, green = color.green * .68f, blue = color.blue * .68f)),
                ),
            )
            .clickable(onClick = onClick)
            .padding(12.dp),
    ) {
        Box(
            Modifier
                .align(Alignment.BottomEnd)
                // Push a rotated square beyond the corner, exactly like a
                // cropped album sleeve rather than a floating rectangle.
                .offset(x = 10.dp, y = 12.dp)
                .size(82.dp)
                .graphicsLayer { rotationZ = 16f }
                .clip(RoundedCornerShape(7.dp))
                .background(Color.White.copy(alpha = .22f)),
        ) {
            item.thumbnailUrl?.let { artwork ->
                AsyncImage(
                    model = artwork,
                    contentDescription = null,
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        Text(
            text = item.title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.align(Alignment.TopStart).padding(end = 48.dp),
        )
    }
}

internal fun moodColor(title: String): Color = when ((title.hashCode() and Int.MAX_VALUE) % 8) {
    0 -> Color(0xFFE64A19)
    1 -> Color(0xFFEC0B65)
    2 -> Color(0xFF8664AC)
    3 -> Color(0xFF6B4EFF)
    4 -> Color(0xFFBE6100)
    5 -> Color(0xFF233C78)
    6 -> Color(0xFF4D97E5)
    else -> Color(0xFFAA267E)
}

@Composable
internal fun ExploreSkeleton() {
    Column(Modifier.padding(horizontal = PAGE_GUTTER)) {
        repeat(5) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(bottom = 12.dp),
            ) {
                repeat(2) {
                    Box(Modifier.weight(1f).height(100.dp).clip(RoundedCornerShape(8.dp))) {
                        ShimmerBox(Modifier.fillMaxSize(), RoundedCornerShape(8.dp))
                        ShimmerBox(
                            Modifier
                                .align(Alignment.BottomEnd)
                                .offset(x = 10.dp, y = 12.dp)
                                .size(82.dp)
                                .graphicsLayer { rotationZ = 16f },
                            RoundedCornerShape(7.dp),
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoodGenrePlaylistsScreen(
    title: String,
    state: UiState<List<HomeShelf>>,
    listState: LazyListState,
    onItemClick: (ShelfItem) -> Unit,
    onRetry: () -> Unit,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        state = listState,
        contentPadding = contentPadding,
        modifier = modifier.fillMaxSize(),
    ) {
        item {
            Text(
                text = title,
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.onBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = PAGE_GUTTER, vertical = 8.dp),
            )
        }
        when (state) {
            UiState.Loading -> feedSkeleton()
            is UiState.Error -> item {
                MessageState(state.message, actionLabel = stringResource(R.string.retry), onAction = onRetry)
            }
            is UiState.Success -> items(state.data, key = { it.title }) { shelf ->
                Shelf(shelf = shelf, onItemClick = onItemClick)
            }
        }
    }
}


// -- MoodGenreSleeve & Layout for TV and Phone --

const val MOOD_CARD_ASPECT = 1.72f
private const val MOOD_STRIPE_FRACTION = .28f

@Composable
fun MoodGenreSleeve(
    item: MoodGenre,
    modifier: Modifier = Modifier,
    titleStyle: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.titleMedium,
) {
    val tone = remember(item.stripeColor, item.title) { moodTone(item) }
    Box(modifier = modifier.background(tone.stripe)) {
        Box(
            Modifier
                .align(Alignment.CenterEnd)
                .fillMaxHeight()
                .fillMaxWidth(1f - MOOD_STRIPE_FRACTION)
                .background(tone.placeholder),
        ) {
            item.thumbnailUrl?.let { artwork ->
                AsyncImage(
                    model = artwork,
                    contentDescription = null,
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    colorFilter = tone.duotone,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        Box(
            Modifier
                .matchParentSize()
                .background(Brush.verticalGradient(0f to Color.Black.copy(alpha = .24f), .62f to Color.Transparent)),
        )
        Text(
            text = item.title,
            style = titleStyle.copy(
                shadow = androidx.compose.ui.graphics.Shadow(Color.Black.copy(alpha = .35f), offset = androidx.compose.ui.geometry.Offset(0f, 1f), blurRadius = 6f),
            ),
            fontWeight = FontWeight.Bold,
            color = Color.White,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(horizontal = 14.dp, vertical = 12.dp),
        )
    }
}

private class MoodTone(val stripe: Color, val placeholder: Color, val duotone: androidx.compose.ui.graphics.ColorFilter)

private fun moodTone(item: MoodGenre): MoodTone {
    val base = item.stripeColor?.let { Color(it.toInt()) } ?: fallbackMoodColor(item.title)
    val stripe = androidx.compose.ui.graphics.lerp(base, Color.Black, .08f)
    val shadow = androidx.compose.ui.graphics.lerp(base, Color.Black, .68f)
    val highlight = androidx.compose.ui.graphics.lerp(base, Color.White, .32f)
    return MoodTone(
        stripe = stripe,
        placeholder = androidx.compose.ui.graphics.lerp(shadow, highlight, .45f),
        duotone = duotone(shadow, highlight),
    )
}

private fun duotone(shadow: Color, highlight: Color): androidx.compose.ui.graphics.ColorFilter {
    fun channel(from: Float, to: Float): FloatArray {
        val span = to - from
        return floatArrayOf(span * .299f, span * .587f, span * .114f, 0f, from * 255f)
    }
    return androidx.compose.ui.graphics.ColorFilter.colorMatrix(
        androidx.compose.ui.graphics.ColorMatrix(
            channel(shadow.red, highlight.red) +
                channel(shadow.green, highlight.green) +
                channel(shadow.blue, highlight.blue) +
                floatArrayOf(0f, 0f, 0f, 1f, 0f),
        ),
    )
}

private fun fallbackMoodColor(title: String): Color = when ((title.hashCode() and Int.MAX_VALUE) % 8) {
    0 -> Color(0xFFCC6A55)
    1 -> Color(0xFFC07A92)
    2 -> Color(0xFF9C8AC0)
    3 -> Color(0xFF8090C8)
    4 -> Color(0xFFD0A060)
    5 -> Color(0xFF6A88B0)
    6 -> Color(0xFF7AAED0)
    else -> Color(0xFF86B890)
}
