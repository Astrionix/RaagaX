package com.music.raaga.ui.social

import android.widget.Toast
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import android.content.Intent
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Radio
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Share
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import com.music.raaga.data.blend.BlendEngine
import com.music.raaga.ui.player.liquidGlassCard
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.music.raaga.R
import com.music.raaga.data.model.Song
import com.music.raaga.data.social.FriendActivityEngine
import com.music.raaga.data.social.FriendActivityState
import com.music.raaga.ui.haptics.Haptic
import com.music.raaga.ui.haptics.rememberHaptics

@Composable
internal fun FriendActivityTabContent(
    onPlaySong: (Song) -> Unit,
    currentSong: Song? = null,
    isPlaying: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val haptics = rememberHaptics()

    LaunchedEffect(Unit) {
        FriendActivityEngine.init(context)
        FriendActivityEngine.refreshFriends(context)
        while (isActive) {
            delay(30_000L) // Refresh every 30s only while looking at Friends tab
            FriendActivityEngine.refreshFriends(context)
        }
    }

    LaunchedEffect(currentSong, isPlaying) {
        if (currentSong != null) {
            FriendActivityEngine.updateMyPlayback(currentSong, isPlaying, context)
        }
    }

    val activities by FriendActivityEngine.activities.collectAsStateWithLifecycle()
    val isSharingEnabled by FriendActivityEngine.isSharingEnabled.collectAsStateWithLifecycle()
    val myIdentity = remember { BlendEngine.getMyIdentity(context) }
    val clipboardManager = LocalClipboardManager.current
    var showAddDialog by remember { mutableStateOf(false) }
    var newFriendTag by remember { mutableStateOf("") }
    var friendToRemove by remember { mutableStateOf<FriendActivityState?>(null) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Header with "Refresh" and "Add Friend" action (weight(1f) ensures buttons never wrap vertically!)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.friends_title),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                )
                Text(
                    text = "See live listening activity",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.55f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // Refresh button
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.10f))
                        .clickable {
                            haptics.play(Haptic.Tap)
                            FriendActivityEngine.refreshFriends(context)
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Refresh,
                        contentDescription = "Refresh",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp),
                    )
                }

                // Add Friend button: resilient pill that never wraps into vertical letters
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (showAddDialog) Color(0xFFFA233B).copy(alpha = 0.22f) else Color.White.copy(alpha = 0.10f))
                        .border(
                            1.dp,
                            if (showAddDialog) Color(0xFFFA233B) else Color.White.copy(alpha = 0.12f),
                            RoundedCornerShape(12.dp)
                        )
                        .clickable {
                            haptics.play(Haptic.Tap)
                            showAddDialog = !showAddDialog
                        }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.PersonAdd,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(15.dp),
                        )
                        Text(
                            text = if (showAddDialog) "Close" else "Add Friend",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            maxLines = 1,
                            softWrap = false,
                        )
                    }
                }
            }
        }

        // Your Friend Code Card (Share with friends so they can add you)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            Color(0xFFFA233B).copy(alpha = 0.15f),
                            Color(0xFF8B5CF6).copy(alpha = 0.10f),
                        )
                    )
                )
                .border(1.dp, Color(0xFFFA233B).copy(alpha = 0.25f), RoundedCornerShape(14.dp))
                .clickable {
                    haptics.play(Haptic.Select)
                    val shortCode = myIdentity.userTag.removePrefix("AETH-")
                    clipboardManager.setText(AnnotatedString(shortCode))
                    Toast.makeText(context, "Friend code copied: $shortCode!", Toast.LENGTH_SHORT).show()
                }
                .padding(horizontal = 12.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFFA233B).copy(alpha = 0.20f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Fingerprint,
                        contentDescription = null,
                        tint = Color(0xFFFA233B),
                        modifier = Modifier.size(19.dp),
                    )
                }
                Column {
                    Text(
                        text = "YOUR FRIEND CODE",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.8.sp,
                            fontSize = 10.sp,
                        ),
                        color = Color.White.copy(alpha = 0.6f),
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(
                            text = myIdentity.userTag.removePrefix("AETH-"),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 2.sp,
                            ),
                            color = Color(0xFFFA233B),
                        )
                        Text(
                            text = "(${myIdentity.userTag})",
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                            ),
                            color = Color.White.copy(alpha = 0.45f),
                        )
                    }
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(9.dp))
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable {
                            haptics.play(Haptic.Select)
                            val shortCode = myIdentity.userTag.removePrefix("AETH-")
                            clipboardManager.setText(AnnotatedString(shortCode))
                            Toast.makeText(context, "Code copied: $shortCode!", Toast.LENGTH_SHORT).show()
                        }
                        .padding(horizontal = 9.dp, vertical = 5.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.ContentCopy,
                            contentDescription = "Copy Code",
                            tint = Color.White,
                            modifier = Modifier.size(13.dp),
                        )
                        Text(
                            text = "Copy",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable {
                            haptics.play(Haptic.Tap)
                            val shortCode = myIdentity.userTag.removePrefix("AETH-")
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, "Add me on Raaga app to listen along! My Friend Code is: $shortCode (Tag: ${myIdentity.userTag})")
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Share Friend Code"))
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Share,
                        contentDescription = "Share Code",
                        tint = Color.White,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }

        // Live Sharing / Private Session Toggle Card
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Color.White.copy(alpha = 0.05f))
                .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(14.dp))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(
                            if (isSharingEnabled) Color(0xFF22C55E).copy(alpha = 0.15f)
                            else Color.White.copy(alpha = 0.10f)
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = if (isSharingEnabled) Icons.Rounded.Radio else Icons.Rounded.Headphones,
                        contentDescription = null,
                        tint = if (isSharingEnabled) Color(0xFF22C55E) else Color.White.copy(alpha = 0.45f),
                        modifier = Modifier.size(16.dp),
                    )
                }
                Column {
                    Text(
                        text = if (isSharingEnabled) "Share Live Activity" else "Private Session (Offline)",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, fontSize = 13.sp),
                        color = Color.White,
                    )
                    Text(
                        text = if (isSharingEnabled) "Sharing live playback with friends" else "Disconnected: You are hidden from friends",
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                        color = Color.White.copy(alpha = 0.5f),
                    )
                }
            }

            Switch(
                checked = isSharingEnabled,
                onCheckedChange = { enabled ->
                    haptics.play(Haptic.Select)
                    FriendActivityEngine.setSharingEnabled(context, enabled)
                    val msg = if (enabled) "Live sharing enabled" else "Disconnected: Activity deleted from cloud"
                    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = Color(0xFF22C55E),
                    uncheckedThumbColor = Color.White.copy(alpha = 0.7f),
                    uncheckedTrackColor = Color.White.copy(alpha = 0.15f),
                ),
            )
        }

        // Add Friend inline input box
        if (showAddDialog) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(alpha = 0.08f))
                    .border(1.dp, Color(0xFFFA233B).copy(alpha = 0.35f), RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                BasicTextField(
                    value = newFriendTag,
                    onValueChange = { newFriendTag = it.take(16) },
                    textStyle = TextStyle(
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = FontFamily.Monospace,
                    ),
                    cursorBrush = SolidColor(Color(0xFFFA233B)),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Characters,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            if (newFriendTag.isNotBlank()) {
                                FriendActivityEngine.addFriend(context, newFriendTag)
                                Toast.makeText(context, "Added friend activity stream", Toast.LENGTH_SHORT).show()
                                newFriendTag = ""
                                showAddDialog = false
                            }
                        },
                    ),
                    modifier = Modifier.weight(1f),
                    decorationBox = { innerTextField ->
                        if (newFriendTag.isEmpty()) {
                            Text(
                                text = "Enter friend's 4-char code (e.g. A8K2)",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.4f),
                            )
                        }
                        innerTextField()
                    },
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(9.dp))
                        .background(Color(0xFFFA233B))
                        .clickable {
                            if (newFriendTag.isNotBlank()) {
                                FriendActivityEngine.addFriend(context, newFriendTag)
                                Toast.makeText(context, "Added friend activity stream", Toast.LENGTH_SHORT).show()
                                newFriendTag = ""
                                showAddDialog = false
                            }
                        }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Text(
                        text = "Add",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                }
            }
        }

        // Separate user's own live card from followed friends
        val (myActivities, friendActivities) = activities.partition {
            it.userId == myIdentity.userId || it.userTag == myIdentity.userTag
        }

        // 1. Show "YOU" live card if user is listening right now
        myActivities.forEach { meActivity ->
            FriendActivityRow(
                activity = meActivity,
                isMe = true,
                onListenAlong = {},
                onRemoveFriend = {},
            )
        }

        // 2. Friends list section
        if (friendActivities.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .liquidGlassCard(active = false)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.08f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Headphones,
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.65f),
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Text(
                        text = "No friends listening yet",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        text = "Share your code above or add friends using their 4-character code.",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                        color = Color.White.copy(alpha = 0.5f),
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(2.dp))
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(Color(0xFFFA233B))
                            .clickable {
                                haptics.play(Haptic.Tap)
                                showAddDialog = true
                            }
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PersonAdd,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(14.dp),
                            )
                            Text(
                                text = "Add Friend",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color.White,
                            )
                        }
                    }
                }
            }
        } else {
            friendActivities.forEach { friend ->
                FriendActivityRow(
                    activity = friend,
                    isMe = false,
                    onListenAlong = {
                        haptics.play(Haptic.Select)
                        onPlaySong(friend.toSong())
                        Toast.makeText(context, "Listening along with ${friend.userName}", Toast.LENGTH_SHORT).show()
                    },
                    onRemoveFriend = {
                        friendToRemove = friend
                    },
                )
            }
        }
    }

    // Confirmation Dialog to Remove Friend
    friendToRemove?.let { friend ->
        AlertDialog(
            onDismissRequest = { friendToRemove = null },
            title = {
                Text(
                    text = "Remove Friend",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                )
            },
            text = {
                Text(
                    text = "Remove ${friend.userName} (${friend.userTag}) from your friends list? You will no longer receive their listening activity.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.8f),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        haptics.play(Haptic.Select)
                        FriendActivityEngine.removeFriend(context, friend.userTag)
                        Toast.makeText(context, "Removed ${friend.userName}", Toast.LENGTH_SHORT).show()
                        friendToRemove = null
                    }
                ) {
                    Text(
                        text = "Remove",
                        color = Color(0xFFEF4444),
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { friendToRemove = null }
                ) {
                    Text(
                        text = "Cancel",
                        color = Color.White.copy(alpha = 0.7f),
                    )
                }
            },
            containerColor = Color(0xFF1E1E1E),
        )
    }
}

private val avatarGradients = listOf(
    listOf(Color(0xFFFA233B), Color(0xFFFF6584)), // Crimson / Rose
    listOf(Color(0xFF6366F1), Color(0xFF8B5CF6)), // Indigo / Violet
    listOf(Color(0xFF06B6D4), Color(0xFF3B82F6)), // Cyan / Blue
    listOf(Color(0xFF10B981), Color(0xFF059669)), // Emerald / Teal
    listOf(Color(0xFFF59E0B), Color(0xFFD97706)), // Amber / Orange
    listOf(Color(0xFFEC4899), Color(0xFFA855F7)), // Pink / Purple
)

private fun getAvatarGradient(userTag: String): List<Color> {
    val idx = kotlin.math.abs(userTag.hashCode()) % avatarGradients.size
    return avatarGradients[idx]
}

private fun formatTimeAgo(timestampMs: Long): String {
    val diff = (System.currentTimeMillis() - timestampMs).coerceAtLeast(0L)
    val seconds = diff / 1000L
    val minutes = seconds / 60L
    val hours = minutes / 60L
    val days = hours / 24L
    return when {
        minutes < 2 -> "Listening now"
        minutes < 60 -> "${minutes}m ago"
        hours < 24 -> "${hours}h ago"
        else -> "${days}d ago"
    }
}

@Composable
private fun LivePulseIndicator() {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 2.4f,
        animationSpec = infiniteRepeatable(
            animation = tween(1300, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "pulseScale",
    )
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1300, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "pulseAlpha",
    )

    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(14.dp)) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .graphicsLayer(scaleX = scale, scaleY = scale)
                .background(Color(0xFF22C55E).copy(alpha = alpha), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(Color(0xFF22C55E), CircleShape)
                .border(2.dp, Color(0xFF161618), CircleShape)
        )
    }
}

@Composable
private fun FriendActivityRow(
    activity: FriendActivityState,
    isMe: Boolean,
    onListenAlong: () -> Unit,
    onRemoveFriend: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = rememberHaptics()
    var menuOpen by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .liquidGlassCard(
                active = activity.isPlaying,
                accentBorder = if (activity.isPlaying) Color(0xFF22C55E).copy(alpha = 0.45f) else null,
            )
            .clickable(
                enabled = !isMe,
                onClick = {
                    haptics.play(Haptic.Select)
                    onListenAlong()
                },
            )
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Friend Avatar + Online/Live Indicator
        Box(contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(getAvatarGradient(activity.userTag))),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = activity.userName.take(1).uppercase(),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                    color = Color.White,
                )
            }

            if (activity.isPlaying) {
                LivePulseIndicator()
            } else {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .background(Color.White.copy(alpha = 0.35f), CircleShape)
                        .border(2.dp, Color(0xFF161618), CircleShape),
                )
            }
        }

        // Friend & Track Info
        Column(modifier = Modifier.weight(1f)) {
            // Header: Friend name + Status / Live badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                val displayName = if (isMe) {
                    activity.userName.replace(" (You)", "").trim()
                } else {
                    activity.userName
                }
                Text(
                    text = displayName,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )

                if (isMe) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.White.copy(alpha = 0.15f))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            text = "YOU",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 9.sp,
                                letterSpacing = 0.8.sp,
                            ),
                            color = Color.White.copy(alpha = 0.9f),
                        )
                    }
                } else if (activity.isPlaying) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFF22C55E).copy(alpha = 0.18f))
                            .border(1.dp, Color(0xFF22C55E).copy(alpha = 0.35f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        MiniWaveformAnimation(color = Color(0xFF22C55E))
                        Text(
                            text = "LIVE",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Black,
                                fontSize = 9.sp,
                                letterSpacing = 0.8.sp,
                            ),
                            color = Color(0xFF22C55E),
                        )
                    }
                } else {
                    Text(
                        text = formatTimeAgo(activity.timestamp),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.45f),
                    )
                }
            }

            Spacer(Modifier.height(2.dp))

            // Song Title
            Text(
                text = activity.songTitle,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                color = if (activity.isPlaying) Color.White else Color.White.copy(alpha = 0.85f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )

            // Artist and Album
            val subText = if (!activity.albumName.isNullOrBlank()) {
                "${activity.artist} • ${activity.albumName}"
            } else {
                activity.artist
            }
            Text(
                text = subText,
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.55f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        // Cover Artwork
        if (!activity.coverUrl.isNullOrBlank()) {
            AsyncImage(
                model = activity.coverUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.16f), RoundedCornerShape(10.dp)),
            )
        } else {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.08f))
                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Rounded.MusicNote,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.5f),
                    modifier = Modifier.size(20.dp),
                )
            }
        }

        // Action: Listen Along Button or You Status
        if (!isMe) {
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(
                        if (activity.isPlaying) {
                            Brush.horizontalGradient(
                                listOf(Color(0xFFFA233B), Color(0xFFFF4861))
                            )
                        } else {
                            Brush.horizontalGradient(
                                listOf(Color.White.copy(alpha = 0.14f), Color.White.copy(alpha = 0.10f))
                            )
                        }
                    )
                    .clickable {
                        haptics.play(Haptic.Select)
                        onListenAlong()
                    }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PlayArrow,
                        contentDescription = stringResource(R.string.friends_listen_along),
                        tint = Color.White,
                        modifier = Modifier.size(15.dp),
                    )
                    Text(
                        text = "Listen",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                }
            }

            // More Options Dropdown (Remove Friend)
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.06f))
                        .clickable { menuOpen = true },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.MoreVert,
                        contentDescription = "Options",
                        tint = Color.White.copy(alpha = 0.65f),
                        modifier = Modifier.size(16.dp),
                    )
                }

                DropdownMenu(
                    expanded = menuOpen,
                    onDismissRequest = { menuOpen = false },
                ) {
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = "Remove Friend",
                                color = Color(0xFFEF4444),
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                            )
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Rounded.Delete,
                                contentDescription = null,
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(18.dp),
                            )
                        },
                        onClick = {
                            menuOpen = false
                            onRemoveFriend()
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniWaveformAnimation(
    color: Color = Color(0xFFFA233B),
    modifier: Modifier = Modifier,
) {
    val infiniteTransition = rememberInfiniteTransition(label = "waveform")
    val h1 by infiniteTransition.animateFloat(
        initialValue = 4f,
        targetValue = 12f,
        animationSpec = infiniteRepeatable(
            animation = tween(400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "h1",
    )
    val h2 by infiniteTransition.animateFloat(
        initialValue = 12f,
        targetValue = 5f,
        animationSpec = infiniteRepeatable(
            animation = tween(350, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "h2",
    )
    val h3 by infiniteTransition.animateFloat(
        initialValue = 6f,
        targetValue = 14f,
        animationSpec = infiniteRepeatable(
            animation = tween(450, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "h3",
    )

    Row(
        modifier = modifier
            .width(12.dp)
            .height(14.dp),
        horizontalArrangement = Arrangement.spacedBy(1.5.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        Box(
            modifier = Modifier
                .width(2.dp)
                .height(h1.dp)
                .background(color, RoundedCornerShape(1.dp)),
        )
        Box(
            modifier = Modifier
                .width(2.dp)
                .height(h2.dp)
                .background(color, RoundedCornerShape(1.dp)),
        )
        Box(
            modifier = Modifier
                .width(2.dp)
                .height(h3.dp)
                .background(color, RoundedCornerShape(1.dp)),
        )
    }
}
