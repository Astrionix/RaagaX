package com.music.aether.ui.blend

import android.content.Intent
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.BookmarkAdd
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.music.aether.R
import com.music.aether.data.blend.BlendEngine
import com.music.aether.data.blend.BlendResult
import com.music.aether.data.model.Song
import com.music.aether.ui.haptics.Haptic
import com.music.aether.ui.haptics.rememberHaptics
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
internal fun BlendTabContent(
    myTracks: List<Song>,
    onPlayQueue: (List<Song>, Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val haptics = rememberHaptics()
    val scope = rememberCoroutineScope()
    val clipboardManager = LocalClipboardManager.current

    val myIdentity = remember { BlendEngine.getMyIdentity(context) }
    var friendInput by remember { mutableStateOf("") }
    var isAnalyzing by remember { mutableStateOf(false) }
    var blendResult by remember { mutableStateOf<BlendResult?>(null) }
    var tagCopied by remember { mutableStateOf(false) }

    LaunchedEffect(tagCopied) {
        if (tagCopied) {
            delay(2000)
            tagCopied = false
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (isAnalyzing) {
            // Analyzing spinner state
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(56.dp),
                        color = Color(0xFFFA233B),
                        strokeWidth = 3.dp,
                    )
                    Icon(
                        imageVector = Icons.Rounded.AutoAwesome,
                        contentDescription = null,
                        tint = Color(0xFFFA233B),
                        modifier = Modifier.size(24.dp),
                    )
                }
                Text(
                    text = stringResource(R.string.blend_analyzing),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                )
                Text(
                    text = stringResource(R.string.blend_analyzing_sub),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.6f),
                )
            }
        } else if (blendResult == null) {
            // My Tag Card
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White.copy(alpha = 0.06f))
                    .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(20.dp))
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFFA233B).copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Fingerprint,
                            contentDescription = null,
                            tint = Color(0xFFFA233B),
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Column {
                        Text(
                            text = stringResource(R.string.blend_my_tag_label),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                            ),
                            color = Color.White.copy(alpha = 0.5f),
                        )
                        Text(
                            text = myIdentity.userTag,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 2.sp,
                            ),
                            color = Color.White,
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // Copy button
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.10f))
                            .clickable {
                                haptics.play(Haptic.Tap)
                                clipboardManager.setText(AnnotatedString(myIdentity.userTag))
                                tagCopied = true
                                Toast.makeText(context, "Copied tag to clipboard", Toast.LENGTH_SHORT).show()
                            }
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Icon(
                                imageVector = if (tagCopied) Icons.Rounded.Check else Icons.Rounded.ContentCopy,
                                contentDescription = null,
                                tint = if (tagCopied) Color(0xFF4ADE80) else Color.White,
                                modifier = Modifier.size(14.dp),
                            )
                            Text(
                                text = if (tagCopied) "Copied" else "Copy",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = if (tagCopied) Color(0xFF4ADE80) else Color.White,
                            )
                        }
                    }

                    // Share button
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.10f))
                            .clickable {
                                haptics.play(Haptic.Tap)
                                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_SUBJECT, "Aether Blend Invite")
                                    putExtra(
                                        Intent.EXTRA_TEXT,
                                        "Let's blend our music tastes on Aether! My Blend code is: ${myIdentity.userTag}\naether://blend?tag=${myIdentity.userTag}",
                                    )
                                }
                                context.startActivity(Intent.createChooser(shareIntent, "Share Blend Invite"))
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Share,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(15.dp),
                        )
                    }
                }
            }

            // Input friend code box
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Friend's Tag or Name:",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = Color.White.copy(alpha = 0.8f),
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White.copy(alpha = 0.07f))
                        .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                ) {
                    if (friendInput.isEmpty()) {
                        Text(
                            text = stringResource(R.string.blend_input_hint),
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White.copy(alpha = 0.35f),
                        )
                    }
                    BasicTextField(
                        value = friendInput,
                        onValueChange = { friendInput = it.take(24) },
                        textStyle = TextStyle(
                            color = Color.White,
                            fontSize = 14.sp,
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
                                if (friendInput.isNotBlank()) {
                                    haptics.play(Haptic.Select)
                                    isAnalyzing = true
                                    scope.launch {
                                        blendResult = BlendEngine.generateBlend(context, friendInput, myTracks)
                                        isAnalyzing = false
                                    }
                                }
                            },
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            // Generate Button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        if (friendInput.isNotBlank()) {
                            Brush.horizontalGradient(listOf(Color(0xFFFA233B), Color(0xFFE11D48)))
                        } else {
                            SolidColor(Color.White.copy(alpha = 0.12f))
                        },
                    )
                    .clickable(enabled = friendInput.isNotBlank()) {
                        haptics.play(Haptic.Select)
                        isAnalyzing = true
                        scope.launch {
                            blendResult = BlendEngine.generateBlend(context, friendInput, myTracks)
                            isAnalyzing = false
                        }
                    }
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.AutoAwesome,
                        contentDescription = null,
                        tint = if (friendInput.isNotBlank()) Color.White else Color.White.copy(alpha = 0.4f),
                        modifier = Modifier.size(17.dp),
                    )
                    Text(
                        text = stringResource(R.string.blend_generate_btn),
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Black),
                        color = if (friendInput.isNotBlank()) Color.White else Color.White.copy(alpha = 0.4f),
                    )
                }
            }
        } else {
            // Blend Result Card
            val result = blendResult!!

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color(0xFFFA233B).copy(alpha = 0.35f),
                                Color(0xFF1E1025).copy(alpha = 0.65f),
                            ),
                        ),
                    )
                    .border(1.dp, Color(0xFFFA233B).copy(alpha = 0.4f), RoundedCornerShape(24.dp))
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // Dual Avatars
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(Color(0xFFFA233B), Color(0xFFFB7185))))
                            .border(2.dp, Color.White, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = result.userAName.take(1).uppercase(),
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Black),
                            color = Color.White,
                        )
                    }

                    Box(
                        modifier = Modifier
                            .offset(x = (-10).dp)
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.25f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "+",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                        )
                    }

                    Box(
                        modifier = Modifier
                            .offset(x = (-20).dp)
                            .size(54.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(Color(0xFF6366F1), Color(0xFF8B5CF6))))
                            .border(2.dp, Color.White, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = result.userBName.take(1).uppercase(),
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Black),
                            color = Color.White,
                        )
                    }
                }

                // Match Score
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${result.matchScore}%",
                        style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.Black),
                        color = Color.White,
                    )
                    Text(
                        text = stringResource(R.string.blend_compatibility_label).uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp,
                        ),
                        color = Color(0xFFFDA4AF),
                    )
                }

                Text(
                    text = result.description,
                    style = MaterialTheme.typography.bodySmall.copy(textAlign = TextAlign.Center),
                    color = Color.White.copy(alpha = 0.85f),
                    modifier = Modifier.padding(horizontal = 8.dp),
                )

                // Tags row
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = result.userATag,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                        ),
                        color = Color.White.copy(alpha = 0.6f),
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.White.copy(alpha = 0.10f))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                    Text(text = "⚡", fontSize = 11.sp)
                    Text(
                        text = result.userBTag,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                        ),
                        color = Color.White.copy(alpha = 0.6f),
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.White.copy(alpha = 0.10f))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Play Button
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .clickable {
                            haptics.play(Haptic.Select)
                            onPlayQueue(result.tracks, 0)
                        }
                        .padding(vertical = 14.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.PlayArrow,
                            contentDescription = null,
                            tint = Color.Black,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = stringResource(R.string.blend_play_btn),
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Black),
                            color = Color.Black,
                        )
                    }
                }

                // Save to Library Button
                var isSaving by remember { mutableStateOf(false) }
                var isSaved by remember { mutableStateOf(false) }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable(enabled = !isSaving && !isSaved) {
                            haptics.play(Haptic.Select)
                            isSaving = true
                            scope.launch {
                                val playlistTitle = result.playlistTitle
                                val videoIds = result.tracks.map { it.videoId }
                                val res = com.music.aether.data.YtMusicRepository.createPlaylist(
                                    title = playlistTitle,
                                    privacy = com.music.aether.data.model.PlaylistPrivacy.PRIVATE,
                                    videoIds = videoIds,
                                )
                                isSaving = false
                                if (res.isSuccess) {
                                    isSaved = true
                                    Toast.makeText(context, "Saved $playlistTitle to Library!", Toast.LENGTH_SHORT).show()
                                } else {
                                    Toast.makeText(context, "Saved to your Blend history", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                        .padding(horizontal = 14.dp, vertical = 14.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Icon(
                                imageVector = if (isSaved) Icons.Rounded.Check else Icons.Rounded.BookmarkAdd,
                                contentDescription = null,
                                tint = if (isSaved) Color(0xFF4ADE80) else Color.White,
                                modifier = Modifier.size(18.dp),
                            )
                            Text(
                                text = if (isSaved) "Saved" else "Save",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = if (isSaved) Color(0xFF4ADE80) else Color.White,
                            )
                        }
                    }
                }

                // Reset Button
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable {
                            haptics.play(Haptic.Tap)
                            blendResult = null
                            friendInput = ""
                        }
                        .padding(horizontal = 14.dp, vertical = 14.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = stringResource(R.string.blend_new_search),
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                    )
                }
            }
        }
    }
}
