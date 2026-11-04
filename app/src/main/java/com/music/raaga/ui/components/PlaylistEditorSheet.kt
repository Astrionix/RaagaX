package com.music.raaga.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Sort
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.DragHandle
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.VerticalAlignBottom
import androidx.compose.material.icons.rounded.VerticalAlignTop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.model.ROW_ART_PX
import com.music.raaga.data.model.Song
import com.music.raaga.data.model.UiState
import com.music.raaga.data.model.artworkAt
import com.music.raaga.data.settings.PlaylistCustomOrderStore
import kotlinx.coroutines.launch

/**
 * Dedicated Playlist Editor screen.
 *
 * Supports:
 * - Fluid drag-and-drop reordering with edge auto-scrolling
 * - Manual sequence numbers ("01", "02", ...)
 * - Multi-select mode with batch movement
 * - Move to top / Move to bottom (single track & multi-select)
 * - Removing tracks from the playlist
 * - "Custom order" sequence persistence
 */
@Composable
fun PlaylistEditorSheet(
    title: String,
    browseId: String,
    entries: UiState<List<Song>>,
    saving: Boolean,
    onSave: (List<Song>) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val original = (entries as? UiState.Success)?.data.orEmpty()
    val order = remember(original) { mutableStateListOf<Song>().apply { addAll(original) } }
    val selectedKeys = remember { mutableStateListOf<String>() }
    var selectionMode by remember { mutableStateOf(false) }

    fun songKey(s: Song): String = s.setVideoId ?: s.videoId

    val changed = order.map { songKey(it) } != original.map { songKey(it) }

    fun moveToTop(keys: Set<String>) {
        val toMove = order.filter { songKey(it) in keys }
        val remaining = order.filterNot { songKey(it) in keys }
        order.clear()
        order.addAll(toMove + remaining)
    }

    fun moveToBottom(keys: Set<String>) {
        val toMove = order.filter { songKey(it) in keys }
        val remaining = order.filterNot { songKey(it) in keys }
        order.clear()
        order.addAll(remaining + toMove)
    }

    fun removeSelected(keys: Set<String>) {
        order.removeAll { songKey(it) in keys }
        selectedKeys.removeAll(keys)
        if (selectedKeys.isEmpty()) selectionMode = false
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding(),
    ) {
        // ---- Top Header ----
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 8.dp, end = 16.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onClose) {
                Icon(
                    Icons.Rounded.Close,
                    contentDescription = stringResource(R.string.close),
                    tint = MaterialTheme.colorScheme.onBackground,
                )
            }
            Column(Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.playlist_editor),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "$title · ${order.size} ${if (order.size == 1) "song" else "songs"}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Button(
                onClick = { onSave(order.toList()) },
                enabled = !saving && (changed || PlaylistCustomOrderStore.hasCustomOrder(browseId)),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF2979FF),
                    contentColor = Color.White,
                ),
                shape = RoundedCornerShape(20.dp),
            ) {
                if (saving) {
                    CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(16.dp), color = Color.White)
                } else {
                    Text(
                        text = stringResource(R.string.save_order),
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        // ---- Subheader / Toolbar ----
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                shape = RoundedCornerShape(12.dp),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.AutoMirrored.Rounded.Sort,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = Color(0xFF2979FF),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = stringResource(R.string.custom_order),
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = Color(0xFF2979FF),
                    )
                }
            }

            TextButton(
                onClick = {
                    selectionMode = !selectionMode
                    if (!selectionMode) selectedKeys.clear()
                },
            ) {
                Text(
                    text = if (selectionMode) stringResource(R.string.clear_selection) else "Select",
                    style = MaterialTheme.typography.labelLarge,
                    color = if (selectionMode) MaterialTheme.colorScheme.error else Color(0xFF2979FF),
                )
            }
        }

        // ---- Batch Action Bar (when tracks are selected) ----
        AnimatedVisibility(
            visible = selectionMode && selectedKeys.isNotEmpty(),
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(12.dp),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(R.string.items_selected, selectedKeys.size),
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = { moveToTop(selectedKeys.toSet()) },
                            modifier = Modifier.size(36.dp),
                        ) {
                            Icon(
                                Icons.Rounded.VerticalAlignTop,
                                contentDescription = stringResource(R.string.move_to_top),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        IconButton(
                            onClick = { moveToBottom(selectedKeys.toSet()) },
                            modifier = Modifier.size(36.dp),
                        ) {
                            Icon(
                                Icons.Rounded.VerticalAlignBottom,
                                contentDescription = stringResource(R.string.move_to_bottom),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        IconButton(
                            onClick = { removeSelected(selectedKeys.toSet()) },
                            modifier = Modifier.size(36.dp),
                        ) {
                            Icon(
                                Icons.Rounded.DeleteOutline,
                                contentDescription = stringResource(R.string.remove_from_playlist),
                                tint = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
        }

        HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))

        when (entries) {
            UiState.Loading -> Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(strokeWidth = 2.5.dp, modifier = Modifier.size(26.dp))
            }

            is UiState.Error -> Text(
                text = entries.message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 22.dp, vertical = 24.dp),
            )

            is UiState.Success -> {
                ReorderableSongList(
                    order = order,
                    enabled = !saving,
                    selectionMode = selectionMode,
                    selectedKeys = selectedKeys,
                    onToggleSelect = { key ->
                        if (key in selectedKeys) selectedKeys.remove(key) else selectedKeys.add(key)
                    },
                    onMoveToTop = { key -> moveToTop(setOf(key)) },
                    onMoveToBottom = { key -> moveToBottom(setOf(key)) },
                    onRemove = { key -> removeSelected(setOf(key)) },
                )
            }
        }
    }
}

@Composable
private fun ReorderableSongList(
    order: MutableList<Song>,
    enabled: Boolean,
    selectionMode: Boolean,
    selectedKeys: List<String>,
    onToggleSelect: (String) -> Unit,
    onMoveToTop: (String) -> Unit,
    onMoveToBottom: (String) -> Unit,
    onRemove: (String) -> Unit,
) {
    val listState = rememberLazyListState()
    var held by remember { mutableStateOf<String?>(null) }
    var offset by remember { mutableFloatStateOf(0f) }
    var autoScroll by remember { mutableFloatStateOf(0f) }
    val density = LocalDensity.current
    val edgeZone = with(density) { 56.dp.toPx() }
    val edgeSpeed = with(density) { 900.dp.toPx() }

    fun settle() {
        val key = held ?: return
        val items = listState.layoutInfo.visibleItemsInfo
        val dragged = items.firstOrNull { it.key == key } ?: return
        val top = dragged.offset + offset
        val center = top + dragged.size / 2f
        val target = items.firstOrNull { item ->
            item.key != key && center >= item.offset && center <= item.offset + item.size
        }
        if (target != null) {
            val from = dragged.index
            val to = target.index
            val first = listState.firstVisibleItemIndex
            val firstOffset = listState.firstVisibleItemScrollOffset
            order.add(to, order.removeAt(from))
            if (from == first || to == first) listState.requestScrollToItem(first, firstOffset)
            offset -= (target.offset - dragged.offset).toFloat()
        }
        val viewport = listState.layoutInfo
        autoScroll = when {
            top < viewport.viewportStartOffset + edgeZone && listState.canScrollBackward -> -edgeSpeed
            top + dragged.size > viewport.viewportEndOffset - edgeZone && listState.canScrollForward -> edgeSpeed
            else -> 0f
        }
    }

    fun end() {
        held = null
        offset = 0f
        autoScroll = 0f
    }

    LaunchedEffect(autoScroll != 0f) {
        if (autoScroll == 0f) return@LaunchedEffect
        var previous = withFrameNanos { it }
        while (held != null && autoScroll != 0f) {
            val now = withFrameNanos { it }
            val seconds = ((now - previous) / 1_000_000_000f).coerceAtMost(1f / 30f)
            previous = now
            val scrolled = listState.scrollBy(autoScroll * seconds)
            if (scrolled == 0f) break
            offset += scrolled
            settle()
        }
    }

    LazyColumn(state = listState, modifier = Modifier.fillMaxWidth()) {
        itemsIndexed(order, key = { _, song -> song.setVideoId ?: song.videoId }) { index, song ->
            val key = song.setVideoId ?: song.videoId
            val dragging = held == key
            val isSelected = key in selectedKeys

            val start: () -> Unit = {
                held = key
                offset = 0f
            }
            val drag: (Float) -> Unit = { delta ->
                offset += delta
                settle()
            }

            PlaylistEditorRow(
                index = index,
                song = song,
                lifted = dragging,
                enabled = enabled,
                selectionMode = selectionMode,
                isSelected = isSelected,
                onToggleSelect = { onToggleSelect(key) },
                onDragStart = start,
                onDrag = drag,
                onDragEnd = ::end,
                onMoveToTop = { onMoveToTop(key) },
                onMoveToBottom = { onMoveToBottom(key) },
                onRemove = { onRemove(key) },
                modifier = Modifier
                    .zIndex(if (dragging) 1f else 0f)
                    .graphicsLayer { translationY = if (dragging) offset else 0f }
                    .then(if (dragging) Modifier else Modifier.animateItem(fadeInSpec = null, fadeOutSpec = null)),
            )
        }
        item(key = "editor-footer") { Spacer(Modifier.height(36.dp)) }
    }
}

@Composable
private fun PlaylistEditorRow(
    index: Int,
    song: Song,
    lifted: Boolean,
    enabled: Boolean,
    selectionMode: Boolean,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onDragStart: () -> Unit,
    onDrag: (Float) -> Unit,
    onDragEnd: () -> Unit,
    onMoveToTop: () -> Unit,
    onMoveToBottom: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var menuOpen by remember { mutableStateOf(false) }

    val gestures = Modifier.pointerInput(enabled, selectionMode) {
        if (!enabled || selectionMode) return@pointerInput
        detectDragGesturesAfterLongPress(
            onDragStart = { onDragStart() },
            onDragEnd = onDragEnd,
            onDragCancel = onDragEnd,
            onDrag = { change, amount ->
                change.consume()
                onDrag(amount.y)
            },
        )
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(
                when {
                    lifted -> MaterialTheme.colorScheme.surfaceVariant
                    isSelected -> Color(0xFF2979FF).copy(alpha = 0.14f)
                    else -> MaterialTheme.colorScheme.background
                },
            )
            .then(if (selectionMode) Modifier.clickable { onToggleSelect() } else Modifier)
            .then(gestures)
            .padding(start = 12.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (selectionMode) {
            Checkbox(
                checked = isSelected,
                onCheckedChange = { onToggleSelect() },
                colors = CheckboxDefaults.colors(
                    checkedColor = Color(0xFF2979FF),
                    checkmarkColor = Color.White,
                ),
                modifier = Modifier.size(36.dp),
            )
            Spacer(Modifier.width(4.dp))
        }

        // Two-digit index number (e.g. 01, 02...)
        Text(
            text = (index + 1).toString().padStart(2, '0'),
            style = MaterialTheme.typography.bodyMedium.copy(
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
            ),
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            modifier = Modifier.width(28.dp),
        )

        Spacer(Modifier.width(6.dp))

        AsyncImage(
            model = song.artworkAt(ROW_ART_PX),
            contentDescription = null,
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(7.dp))
                .thumbnailBorder(RoundedCornerShape(7.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
        )

        Spacer(Modifier.width(12.dp))

        Column(Modifier.weight(1f)) {
            ExplicitSongTitle(
                song = song,
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = song.artist,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        // Single-item action menu (Move to top, Move to bottom, Remove)
        Box {
            IconButton(
                onClick = { menuOpen = true },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    Icons.Rounded.MoreVert,
                    contentDescription = stringResource(R.string.more),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp),
                )
            }
            DropdownMenu(
                expanded = menuOpen,
                onDismissRequest = { menuOpen = false },
            ) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.move_to_top)) },
                    leadingIcon = { Icon(Icons.Rounded.VerticalAlignTop, contentDescription = null) },
                    onClick = {
                        menuOpen = false
                        onMoveToTop()
                    },
                )
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.move_to_bottom)) },
                    leadingIcon = { Icon(Icons.Rounded.VerticalAlignBottom, contentDescription = null) },
                    onClick = {
                        menuOpen = false
                        onMoveToBottom()
                    },
                )
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.remove_from_playlist), color = MaterialTheme.colorScheme.error) },
                    leadingIcon = { Icon(Icons.Rounded.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                    onClick = {
                        menuOpen = false
                        onRemove()
                    },
                )
            }
        }

        // Drag handle for instant dragging
        Icon(
            imageVector = Icons.Rounded.DragHandle,
            contentDescription = stringResource(R.string.drag_to_reorder),
            tint = if (lifted) Color(0xFF2979FF) else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .size(44.dp)
                .padding(10.dp)
                .pointerInput(enabled) {
                    if (!enabled) return@pointerInput
                    detectDragGestures(
                        onDragStart = { onDragStart() },
                        onDragEnd = onDragEnd,
                        onDragCancel = onDragEnd,
                        onDrag = { change, amount ->
                            change.consume()
                            onDrag(amount.y)
                        },
                    )
                },
        )
    }
}

