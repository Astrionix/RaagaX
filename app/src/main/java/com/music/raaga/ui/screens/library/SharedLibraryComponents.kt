package com.music.raaga.ui.screens.library

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.ui.icons.RaagaIcons
import kotlinx.coroutines.launch

val AmoledCardBackground = Color(0xFF161618)
val AmoledBorderColor = Color(0xFF2C2C2E)
val RaagaAccentRed = Color(0xFFE53935)
val RaagaCobaltBlue = Color(0xFF2979FF)
val RaagaCobaltSurface = Color(0x2E2979FF)
val TextSecondaryGrey = Color(0xFF8E8E93)

@Composable
fun LibrarySearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    horizontalPadding: androidx.compose.ui.unit.Dp = 20.dp,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = horizontalPadding, vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF1C1C1E))
            .padding(horizontal = 12.dp, vertical = 2.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(
                imageVector = Icons.Rounded.Search,
                contentDescription = null,
                tint = TextSecondaryGrey,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(8.dp))
            TextField(
                value = query,
                onValueChange = onQueryChange,
                placeholder = {
                    Text(
                        text = placeholder,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondaryGrey,
                    )
                },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    cursorColor = RaagaAccentRed,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                ),
                modifier = Modifier.weight(1f),
            )
            if (query.isNotEmpty()) {
                IconButton(
                    onClick = { onQueryChange("") },
                    modifier = Modifier.size(24.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Close,
                        contentDescription = "Clear",
                        tint = TextSecondaryGrey,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

/**
 * Side-by-side equal-width Play and Shuffle pill buttons.
 */
@Composable
fun PillActionRow(
    onPlay: () -> Unit,
    onShuffle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .height(48.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(AmoledCardBackground)
                .clickable(onClick = onPlay),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Rounded.PlayArrow,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.play),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = Color.White,
                )
            }
        }
        Box(
            modifier = Modifier
                .weight(1f)
                .height(48.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(AmoledCardBackground)
                .clickable(onClick = onShuffle),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Rounded.Shuffle,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.shuffle),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = Color.White,
                )
            }
        }
    }
}

/**
 * A-Z alphabetical fast scroller for long artist lists.
 */
@Composable
fun AlphabetFastScroller(
    letters: List<Char>,
    onLetterSelected: (Char) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .padding(end = 4.dp)
            .fillMaxHeight(),
        verticalArrangement = Arrangement.SpaceEvenly,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        letters.forEach { letter ->
            Text(
                text = letter.toString(),
                color = RaagaAccentRed,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clickable { onLetterSelected(letter) }
                    .padding(vertical = 1.dp, horizontal = 4.dp),
            )
        }
    }
}

/**
 * Category row in the main library hub list.
 */
@Composable
fun LibraryCategoryRow(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    trailingBadge: String? = null,
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
                .height(52.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = RaagaAccentRed,
                modifier = Modifier.size(24.dp),
            )
            Spacer(Modifier.width(16.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Medium),
                color = Color.White,
                modifier = Modifier.weight(1f),
            )
            if (trailingBadge != null) {
                Text(
                    text = trailingBadge,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryGrey,
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
            Icon(
                imageVector = Icons.Rounded.ChevronRight,
                contentDescription = null,
                tint = TextSecondaryGrey,
                modifier = Modifier.size(20.dp),
            )
        }
        HorizontalDivider(
            thickness = 0.5.dp,
            color = AmoledBorderColor,
            modifier = Modifier.padding(start = 40.dp),
        )
    }
}

/**
 * Pinned card in the hero carousel.
 */
@Composable
fun PinnedCollectionCard(
    pinned: PinnedCollection,
    isEditing: Boolean,
    onClick: () -> Unit,
    onUnpin: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .width(116.dp)
            .padding(vertical = 4.dp),
    ) {
        Column(
            horizontalAlignment = Alignment.Start,
            modifier = Modifier.clickable(onClick = onClick),
        ) {
            Box(
                modifier = Modifier
                    .size(116.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        if (pinned.isFavoriteSongs) Color.White else AmoledCardBackground
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (pinned.isFavoriteSongs) {
                    Icon(
                        imageVector = Icons.Rounded.Star,
                        contentDescription = null,
                        tint = RaagaAccentRed,
                        modifier = Modifier.size(54.dp),
                    )
                } else if (!pinned.artworkUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = pinned.artworkUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.matchParentSize(),
                    )
                } else {
                    Icon(
                        imageVector = Icons.Rounded.Folder,
                        contentDescription = null,
                        tint = TextSecondaryGrey,
                        modifier = Modifier.size(48.dp),
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = pinned.title,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (!pinned.subtitle.isNullOrBlank()) {
                Text(
                    text = pinned.subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondaryGrey,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Unpin badge in edit mode
        if (isEditing) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset(x = (-4).dp, y = (-4).dp)
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF3A3A3C))
                    .border(1.dp, Color.White.copy(alpha = 0.5f), CircleShape)
                    .clickable(onClick = onUnpin),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.Remove,
                    contentDescription = "Unpin",
                    tint = Color.White,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

/**
 * Apple Music-style Sort/Filter Bottom Sheet.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> GenericSortBottomSheet(
    title: String,
    options: List<Pair<T, String>>,
    selected: T,
    onSelect: (T) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color(0xFF1C1C1E),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = Color.White,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
            )
            HorizontalDivider(thickness = 0.5.dp, color = AmoledBorderColor)
            options.forEach { (option, label) ->
                val isSelected = option == selected
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            onSelect(option)
                            onDismiss()
                        }
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Rounded.Check,
                            contentDescription = null,
                            tint = RaagaAccentRed,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(12.dp))
                    } else {
                        Spacer(Modifier.width(32.dp))
                    }
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        ),
                        color = if (isSelected) Color.White else Color(0xFFE5E5E7),
                    )
                }
            }
        }
    }
}

/**
 * Cobalt-blue badge for status indicators (e.g. Lossless, Followed, Offline).
 */
@Composable
fun CobaltBadge(
    text: String,
    modifier: Modifier = Modifier,
    backgroundColor: Color = RaagaCobaltSurface,
    textColor: Color = RaagaCobaltBlue,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(backgroundColor)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                letterSpacing = 0.5.sp,
            ),
            color = textColor,
        )
    }
}

/**
 * Filter Chip pill row for library screens (Playlists, Downloaded, Made for You).
 */
@Composable
fun <T> FilterChipRow(
    chips: List<Pair<T, String>>,
    selected: T,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    androidx.compose.foundation.lazy.LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(chips.size) { index ->
            val (chip, label) = chips[index]
            val isSelected = chip == selected
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(if (isSelected) RaagaAccentRed else Color(0xFF1C1C1E))
                    .clickable { onSelect(chip) }
                    .padding(horizontal = 14.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    ),
                    color = if (isSelected) Color.White else TextSecondaryGrey,
                )
            }
        }
    }
}

