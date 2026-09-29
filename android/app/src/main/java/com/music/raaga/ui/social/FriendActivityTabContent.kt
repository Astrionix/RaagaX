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
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material.icons.rounded.Radio
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Share
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import com.music.raaga.data.blend.BlendEngine
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
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
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val haptics = rememberHaptics()

    LaunchedEffect(Unit) {
        FriendActivityEngine.init(context)
        FriendActivityEngine.refreshFriends(context)
    }

    val activities by FriendActivityEngine.activities.collectAsStateWithLifecycle()
    val isSharingEnabled by FriendActivityEngine.isSharingEnabled.collectAsStateWithLifecycle()
    val myIdentity = remember { BlendEngine.getMyIdentity(context) }
    val clipboardManager = LocalClipboardManager.current
    var showAddDialog by remember { mutableStateOf(false) }
    var newFriendTag by remember { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Header with "Refresh" and "Add Friend" action
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(
                    text = stringResource(R.string.friends_title),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                )
                Text(
                    text = stringResource(R.string.friends_subtitle),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.55f),
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

                // Add Friend button
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.10f))
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
                            text = stringResource(R.string.friends_add_btn),
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                        )
                    }
                }
            }
        }

        // Your Friend Code Card (Share with friends so they can add you)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            Color(0xFFFA233B).copy(alpha = 0.15f),
                            Color(0xFF8B5CF6).copy(alpha = 0.10f),
                        )
                    )
                )
                .border(1.dp, Color(0xFFFA233B).copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                .clickable {
                    haptics.play(Haptic.Select)
                    val shortCode = myIdentity.userTag.removePrefix("AETH-")
                    clipboardManager.setText(AnnotatedString(shortCode))
                    Toast.makeText(context, "Friend code copied: $shortCode! Send this to your friend.", Toast.LENGTH_SHORT).show()
                }
                .padding(horizontal = 14.dp, vertical = 12.dp),
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
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFFA233B).copy(alpha = 0.20f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Fingerprint,
                        contentDescription = null,
                        tint = Color(0xFFFA233B),
                        modifier = Modifier.size(20.dp),
                    )
                }
                Column {
                    Text(
                        text = "YOUR FRIEND CODE",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
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
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable {
                            haptics.play(Haptic.Select)
                            val shortCode = myIdentity.userTag.removePrefix("AETH-")
                            clipboardManager.setText(AnnotatedString(shortCode))
                            Toast.makeText(context, "Code copied: $shortCode!", Toast.LENGTH_SHORT).show()
                        }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
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
                            modifier = Modifier.size(14.dp),
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
                        .size(32.dp)
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
                        modifier = Modifier.size(15.dp),
                    )
                }
            }
        }

        // Live Sharing / Private Session Toggle Card
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White.copy(alpha = 0.05f))
                .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
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
                        modifier = Modifier.size(17.dp),
                    )
                }
                Column {
                    Text(
                        text = if (isSharingEnabled) "Share Live Activity" else "Private Session (Offline)",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                    Text(
                        text = if (isSharingEnabled) "Sharing live playback with friends" else "Disconnected: You are hidden from friends",
                        style = MaterialTheme.typography.labelSmall,
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
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.08f))
                    .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(16.dp))
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
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFFA233B))
                        .clickable {
                            if (newFriendTag.isNotBlank()) {
                                FriendActivityEngine.addFriend(context, newFriendTag)
                                Toast.makeText(context, "Added friend activity stream", Toast.LENGTH_SHORT).show()
                                newFriendTag = ""
                                showAddDialog = false
                            }
                        }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                ) {
                    Text(
                        text = "Add",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                }
            }
        }

        // Friends list
        if (activities.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color.White.copy(alpha = 0.04f))
                    .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(18.dp))
                    .padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Headphones,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.4f),
                        modifier = Modifier.size(36.dp),
                    )
                    Text(
                        text = "No friends listening right now",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = Color.White.copy(alpha = 0.85f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Text(
                        text = "Start a Jam session or add friends using their tag to listen together in real time.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.5f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
        } else {
            activities.forEach { friend ->
                FriendActivityRow(
                    activity = friend,
                    onListenAlong = {
                        haptics.play(Haptic.Select)
                        onPlaySong(friend.toSong())
                        Toast.makeText(context, "Listening along with ${friend.userName}", Toast.LENGTH_SHORT).show()
                    },
                )
            }
        }
    }
}

@Composable
private fun FriendActivityRow(
    activity: FriendActivityState,
    onListenAlong: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(18.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Friend Avatar + Online Indicator
        Box(contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            listOf(
                                Color(0xFFFA233B).copy(alpha = 0.8f),
                                Color(0xFF6366F1).copy(alpha = 0.8f),
                            ),
                        ),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = activity.userName.take(1).uppercase(),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                    color = Color.White,
                )
            }

            // Green online pulse dot if playing
            if (activity.isPlaying) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF22C55E))
                        .border(2.dp, Color(0xFF121212), CircleShape),
                )
            }
        }

        // Song & Artist Info
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = activity.userName,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = activity.userTag,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontFamily = FontFamily.Monospace,
                        fontSize = 9.sp,
                    ),
                    color = Color.White.copy(alpha = 0.45f),
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (activity.isPlaying) {
                    MiniWaveformAnimation()
                }
                Text(
                    text = "${activity.songTitle} · ${activity.artist}",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (activity.isPlaying) Color(0xFFFA233B) else Color.White.copy(alpha = 0.7f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Cover thumbnail
        if (!activity.coverUrl.isNullOrBlank()) {
            AsyncImage(
                model = activity.coverUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(8.dp)),
            )
        }

        // Listen Along Button
        Box(
            modifier = Modifier
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.12f))
                .clickable(onClick = onListenAlong)
                .padding(8.dp),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Rounded.Headphones,
                contentDescription = stringResource(R.string.friends_listen_along),
                tint = Color.White,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable
private fun MiniWaveformAnimation() {
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
        modifier = Modifier
            .width(12.dp)
            .height(14.dp),
        horizontalArrangement = Arrangement.spacedBy(1.5.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        Box(
            modifier = Modifier
                .width(2.dp)
                .height(h1.dp)
                .background(Color(0xFFFA233B), RoundedCornerShape(1.dp)),
        )
        Box(
            modifier = Modifier
                .width(2.dp)
                .height(h2.dp)
                .background(Color(0xFFFA233B), RoundedCornerShape(1.dp)),
        )
        Box(
            modifier = Modifier
                .width(2.dp)
                .height(h3.dp)
                .background(Color(0xFFFA233B), RoundedCornerShape(1.dp)),
        )
    }
}
