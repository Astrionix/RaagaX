package com.music.raaga.desktop

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.music.raaga.data.lyrics.LyricLine
import com.music.raaga.data.model.ArtistPage
import com.music.raaga.data.model.Song
import com.music.raaga.playback.PlaybackPosition
import com.music.raaga.ui.icons.RaagaIcons
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect

/** What the column beside the page is showing. */
internal enum class DesktopSidePanel { NOW_PLAYING, LYRICS, QUEUE, AUDIO_OUTPUT, JAM }

/**
 * Spotify-style right-hand side dockable panel: Now Playing view, Lyrics,
 * Queue, or Connect to Device in a rounded card container beside the page.
 */
@Composable
internal fun DesktopSidePanelColumn(
    panel: DesktopSidePanel?,
    onClose: () -> Unit,
    content: @Composable (DesktopSidePanel) -> Unit,
) {
    // Held through the exit, so the column slides out with what it had in it rather than empty.
    var shown by remember { mutableStateOf(panel) }
    if (panel != null) shown = panel

    val haze = LocalDesktopHaze.current
    val reduceDynamicBlur by DesktopAppearanceSettings.reduceDynamicBlur.collectAsState()
    val panelShape = RoundedCornerShape(8.dp)

    val panelBorder = Color.White.copy(alpha = 0.08f)
    val panelBg = Color(0xFF121212)

    AnimatedVisibility(
        visible = panel != null,
        enter = expandHorizontally(
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioNoBouncy,
                stiffness = Spring.StiffnessMediumLow,
            ),
            expandFrom = Alignment.End,
        ) + fadeIn(
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioNoBouncy,
                stiffness = Spring.StiffnessMediumLow,
            ),
        ),
        exit = shrinkHorizontally(
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioNoBouncy,
                stiffness = Spring.StiffnessMediumLow,
            ),
            shrinkTowards = Alignment.End,
        ) + fadeOut(
            animationSpec = tween(140, easing = FastOutSlowInEasing),
        ),
    ) {
        // Floating Spotify-style right side panel card with 8dp rounded corners
        Box(
            modifier = Modifier
                .width(SIDE_PANEL_WIDTH)
                .fillMaxHeight()
                .clip(RoundedCornerShape(8.dp))
                .background(panelBg),
        ) {
            Crossfade(
                    targetState = shown ?: return@Box,
                    modifier = Modifier.fillMaxSize(),
                    animationSpec = tween(CROSSFADE_MS),
                    label = "sidePanel",
                ) { which ->
                    Column(
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .padding(start = 16.dp, end = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = when (which) {
                                    DesktopSidePanel.NOW_PLAYING -> DesktopStrings["now_playing", "Now playing"]
                                    DesktopSidePanel.LYRICS -> DesktopStrings["lyrics", "Lyrics"]
                                    DesktopSidePanel.QUEUE -> "Queue"
                                    DesktopSidePanel.AUDIO_OUTPUT -> DesktopStrings["audio_output", "Audio output"]
                                    DesktopSidePanel.JAM -> "Raaga Jam"
                                },
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f),
                            )
                            // Tactile Close Button
                            val closeInteraction = remember { MutableInteractionSource() }
                            val closePressed by closeInteraction.collectIsPressedAsState()
                            val closeScale by animateFloatAsState(
                                targetValue = if (closePressed) 0.88f else 1f,
                                animationSpec = spring(
                                    dampingRatio = Spring.DampingRatioNoBouncy,
                                    stiffness = Spring.StiffnessMedium,
                                ),
                                label = "closeScale",
                            )
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .graphicsLayer {
                                        scaleX = closeScale
                                        scaleY = closeScale
                                    }
                                    .clip(CircleShape)
                                    .desktopHoverWash()
                                    .clickable(
                                        interactionSource = closeInteraction,
                                        indication = null,
                                        onClick = onClose,
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Rounded.Close,
                                    DesktopStrings["close", "Close"],
                                    tint = Color.White.copy(alpha = 0.75f),
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                        HorizontalDivider(
                            color = Color.White.copy(alpha = 0.08f),
                            thickness = 0.5.dp,
                            modifier = Modifier.padding(horizontal = 14.dp),
                        )
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .padding(
                                    start = 14.dp,
                                    end = 14.dp,
                                    top = 10.dp,
                                    bottom = 12.dp,
                                ),
                        ) {
                            content(which)
                        }
                    }
                }
            }
        }
    }

/**
 * Spotify-style Now Playing Side Panel (matching screenshots 4 & 5):
 * - Large album artwork / Canvas
 * - Song title & artists with like/heart action
 * - Synced lyrics preview card (warm burgundy card)
 * - About the artist card with avatar, verified badge, monthly listeners, follow button & bio
 * - Credits card with main artist & follow button
 */
@Composable
internal fun NowPlayingSidePanel(
    song: Song,
    isPlaying: Boolean,
    isLiked: Boolean,
    onToggleLike: () -> Unit,
    lyrics: List<LyricLine>?,
    position: PlaybackPosition,
    onOpenLyrics: () -> Unit,
    onOpenArtist: (browseId: String, name: String) -> Unit,
    artistPage: ArtistPage?,
    modifier: Modifier = Modifier,
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier.verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // 1. Large Album Artwork
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF282828)),
            contentAlignment = Alignment.Center,
        ) {
            DesktopArtwork(
                song.thumbnailUrl,
                modifier = Modifier.fillMaxSize(),
                px = 480,
            )
        }

        // 2. Track Title, Artist & Like Button
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                Text(
                    text = song.title,
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = song.artist,
                    color = Color.White.copy(alpha = 0.70f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.clickable {
                        song.artistId?.let { onOpenArtist(it, song.artist) }
                    },
                )
            }
            IconButton(onClick = onToggleLike) {
                Icon(
                    imageVector = if (isLiked) RaagaIcons.HeartFilled else RaagaIcons.Heart,
                    contentDescription = if (isLiked) "Liked" else "Like",
                    tint = if (isLiked) Color(0xFF1DB954) else Color.White.copy(alpha = 0.70f),
                    modifier = Modifier.size(24.dp),
                )
            }
        }

        // 3. Lyrics Preview Card (Spotify burgundy card as shown in screenshot 5)
        val currentLine = remember(lyrics, position.positionMs) {
            lyrics?.lastOrNull { it.timeMs <= position.positionMs && it.text.isNotBlank() }
        }
        val previewSnippet = remember(lyrics, currentLine) {
            if (lyrics.isNullOrEmpty()) {
                "Looking for lyrics..."
            } else {
                val idx = if (currentLine != null) lyrics.indexOf(currentLine) else 0
                val lines = lyrics.drop(idx.coerceAtLeast(0)).filter { it.text.isNotBlank() }.take(3)
                if (lines.isNotEmpty()) lines.joinToString("\n") { it.text } else "Sing along with synced lyrics"
            }
        }

        val lyricsCardShape = RoundedCornerShape(12.dp)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(lyricsCardShape)
                .background(Color(0xFF5A1E28))
                .clickable(onClick = onOpenLyrics)
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Lyrics preview",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = "Show lyrics",
                        color = Color.White.copy(alpha = 0.75f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Text(
                    text = previewSnippet,
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 22.sp,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // 4. About the Artist Card (Screenshots 4 & 5)
        val artistCardShape = RoundedCornerShape(12.dp)
        var isFollowing by remember { mutableStateOf(false) }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(artistCardShape)
                .background(Color(0xFF242424))
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "About the artist",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    DesktopArtwork(
                        url = artistPage?.thumbnailUrl ?: song.thumbnailUrl,
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape),
                        px = 120,
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(
                                text = song.artist,
                                color = Color.White,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Icon(
                                imageVector = Icons.Rounded.CheckCircle,
                                contentDescription = "Verified Artist",
                                tint = Color(0xFF3D91F4),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                        Text(
                            text = artistPage?.monthlyListenerCount ?: artistPage?.subscriberCountText ?: "6,429,580 monthly listeners",
                            color = Color.White.copy(alpha = 0.65f),
                            fontSize = 12.sp,
                        )
                    }

                    // Follow pill button
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(percent = 50))
                            .border(1.dp, Color.White.copy(alpha = 0.60f), RoundedCornerShape(percent = 50))
                            .clickable { isFollowing = !isFollowing }
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = if (isFollowing) "Following" else "Follow",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }

                val bio = artistPage?.description
                    ?: "${song.artist} is an acclaimed artist and composer delivering world-class music."
                Text(
                    text = bio,
                    color = Color.White.copy(alpha = 0.70f),
                    fontSize = 12.5.sp,
                    lineHeight = 18.sp,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // 5. Credits Card (Screenshot 4)
        val creditsCardShape = RoundedCornerShape(12.dp)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(creditsCardShape)
                .background(Color(0xFF242424))
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Credits",
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = "Show all",
                        color = Color.White.copy(alpha = 0.60f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text(
                            text = song.artist,
                            color = Color.White,
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = "Main Artist",
                            color = Color.White.copy(alpha = 0.60f),
                            fontSize = 11.5.sp,
                        )
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(percent = 50))
                            .border(1.dp, Color.White.copy(alpha = 0.60f), RoundedCornerShape(percent = 50))
                            .clickable { isFollowing = !isFollowing }
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = if (isFollowing) "Following" else "Follow",
                            color = Color.White,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    }
}

private val SIDE_PANEL_WIDTH = 340.dp
private const val CROSSFADE_MS = 180
