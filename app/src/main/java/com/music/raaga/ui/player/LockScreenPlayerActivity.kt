package com.music.raaga.ui.player

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.camera2.CameraManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.MediaStore
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.ui.draw.blur
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Airplay
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.FastForward
import androidx.compose.material.icons.rounded.FastRewind
import androidx.compose.material.icons.rounded.FlashlightOff
import androidx.compose.material.icons.rounded.FlashlightOn
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.StarBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.music.raaga.data.LikeState
import com.music.raaga.data.model.LikeStatus
import com.music.raaga.data.model.Song
import com.music.raaga.data.model.artworkAt
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.playback.PlayerState
import com.music.raaga.playback.rememberMediaController
import com.music.raaga.playback.rememberPlayerState
import com.music.raaga.ui.theme.RaagaTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Pixel-perfect Apple Music iOS full-screen animated Lock Screen album artwork player.
 *
 * Expands motion artwork across the lock screen with a sleek top clock header,
 * translucent floating glass Now Playing card, interactive scrubber, transport controls,
 * animated equalizer bars, and bottom flashlight/camera shortcuts.
 */
class LockScreenPlayerActivity : AppCompatActivity() {

    private val userPresentReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_USER_PRESENT) {
                // User unlocked the phone outside this screen (e.g. fingerprint sensor)
                finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(false)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        enableEdgeToEdge()
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        insetsController.hide(WindowInsetsCompat.Type.navigationBars())
        insetsController.isAppearanceLightStatusBars = false

        val filter = IntentFilter(Intent.ACTION_USER_PRESENT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(userPresentReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(userPresentReceiver, filter)
        }

        setContent {
            RaagaTheme(darkTheme = true) {
                LockScreenPlayerScreen(
                    onDismiss = { dismissLockScreen() }
                )
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        runCatching { unregisterReceiver(userPresentReceiver) }
    }

    private fun dismissLockScreen() {
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            keyguardManager?.requestDismissKeyguard(this, null)
        }
        finish()
    }
}

@Composable
fun LockScreenPlayerScreen(
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val controller = rememberMediaController()
    val playerState = rememberPlayerState(controller)
    val song = playerState.song

    BackHandler {
        onDismiss()
    }

    // Dismiss gesture: user drags upwards to dismiss back to lockscreen/unlock
    val offsetY = remember { Animatable(0f) }
    val coroutineScope = rememberCoroutineScope()
    val density = LocalDensity.current

    // Live clock and date in clean iOS single-line format: "9:41  Tue Apr 1"
    var currentTimeText by remember { mutableStateOf("") }
    var currentDateText by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        val timeFormat = SimpleDateFormat("h:mm", Locale.getDefault())
        val dateFormat = SimpleDateFormat("EEE d MMM", Locale.getDefault())
        while (true) {
            val now = Date()
            currentTimeText = timeFormat.format(now)
            currentDateText = dateFormat.format(now)
            delay(1000L)
        }
    }

    // Canvas & battery settings
    val canvasOverWifiOnly by AppSettings.lockScreenCanvasWifiOnly.collectAsStateWithLifecycle()
    val batterySaverFallback by AppSettings.lockScreenCanvasBatterySaver.collectAsStateWithLifecycle()
    val meteredConnection by AppSettings.meteredConnection.collectAsStateWithLifecycle()

    val isBatteryLow = remember(context) {
        isBatteryConstrained(context)
    }

    // Sample / preview track matching the user's reference image if no track is playing yet
    val displaySong = song ?: remember {
        Song(
            videoId = "ajs-vibe-preview",
            title = "AJ's Vibe (Flipped by Black Milk)",
            artist = "Robert Glasper",
            thumbnailUrl = "https://i.scdn.co/image/ab67616d0000b273c3cd72241efceda9f3c44015",
            durationText = "3:02"
        )
    }
    val isPlaying = if (song != null) playerState.isPlaying else true

    val canvas = song?.let { rememberCanvasArtwork(it) }

    val allowMotion = canvas != null &&
        (!canvasOverWifiOnly || meteredConnection != true) &&
        (!batterySaverFallback || !isBatteryLow)

    // Flashlight state
    var isFlashlightOn by remember { mutableStateOf(false) }
    val cameraManager = remember(context) {
        context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
    }
    val torchCameraId = remember(cameraManager) {
        runCatching { cameraManager?.cameraIdList?.firstOrNull() }.getOrNull()
    }
    DisposableEffect(Unit) {
        onDispose {
            if (isFlashlightOn && torchCameraId != null) {
                runCatching { cameraManager?.setTorchMode(torchCameraId, false) }
            }
        }
    }

    // Like / favorite state
    val likeOverrides by LikeState.overrides.collectAsStateWithLifecycle()
    val isLiked = song != null && likeOverrides[song.videoId] == LikeStatus.LIKE

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .offset { IntOffset(0, offsetY.value.roundToInt()) }
            .pointerInput(Unit) {
                detectVerticalDragGestures(
                    onDragEnd = {
                        val currentOffset = offsetY.value
                        val thresholdPx = with(density) { -100.dp.toPx() }
                        if (currentOffset < thresholdPx) {
                            coroutineScope.launch {
                                offsetY.animateTo(
                                    targetValue = with(density) { -800.dp.toPx() },
                                    animationSpec = tween(220, easing = FastOutSlowInEasing)
                                )
                                onDismiss()
                            }
                        } else {
                            coroutineScope.launch {
                                offsetY.animateTo(0f, animationSpec = tween(220))
                            }
                        }
                    },
                    onVerticalDrag = { change, dragAmount ->
                        change.consume()
                        if (dragAmount < 0 || offsetY.value < 0) {
                            coroutineScope.launch {
                                offsetY.snapTo((offsetY.value + dragAmount).coerceAtMost(0f))
                            }
                        }
                    }
                )
            }
    ) {
        // --- 1. AMBIENT BLURRED BACKDROP ---
        val artworkModel: Any = remember(displaySong.thumbnailUrl, song) {
            if (song != null) {
                displaySong.artworkAt(1400) ?: displaySong.thumbnailUrl ?: com.music.raaga.R.drawable.sample_lockscreen_art
            } else {
                com.music.raaga.R.drawable.sample_lockscreen_art
            }
        }
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(artworkModel)
                .crossfade(true)
                .build(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .blur(72.dp)
        )

        // Gradient overlay for contrast & readability
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.35f),
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.55f)
                        )
                    )
                )
        )

        // --- 2. FOREGROUND CONTENT: Header, Rounded Artwork Tile, Player Card & Shortcuts ---
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.statusBars)
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Apple-style Compact Date/Time Header ("1:20  Tue 27 Oct")
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = currentTimeText,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp,
                        color = Color.White
                    )
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = currentDateText,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Medium,
                        fontSize = 18.sp,
                        color = Color.White.copy(alpha = 0.90f)
                    )
                )
            }

            Spacer(modifier = Modifier.weight(0.45f))

            // Rounded Square Artwork Tile (1:1 aspect ratio, never cropped horizontally or vertically!)
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.88f)
                    .aspectRatio(1f)
                    .shadow(
                        elevation = 24.dp,
                        shape = RoundedCornerShape(26.dp),
                        spotColor = Color.Black.copy(alpha = 0.65f)
                    )
                    .clip(RoundedCornerShape(26.dp))
            ) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(artworkModel)
                        .crossfade(true)
                        .build(),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                if (allowMotion && canvas != null) {
                    CanvasArtworkPlayer(
                        canvas = canvas,
                        isPlaying = playerState.isPlaying,
                        modifier = Modifier.fillMaxSize(),
                        contentMode = CanvasContentMode.CROP
                    )
                }
            }

            Spacer(modifier = Modifier.weight(0.75f))

            // BOTTOM SECTION: Frosted Glass Floating Card + Shortcuts
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
            // Glassmorphism Card (matching the exact Apple Music iOS Lock Screen widget)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(26.dp))
                    .background(Color(0xFF161618).copy(alpha = 0.58f))
                    .background(Color.White.copy(alpha = 0.10f))
                    .border(
                        width = 0.75.dp,
                        color = Color.White.copy(alpha = 0.22f),
                        shape = RoundedCornerShape(26.dp)
                    )
                    .padding(horizontal = 22.dp, vertical = 14.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Title + Animated Equalizer Wave
                    Box(
                        modifier = Modifier.fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = displaySong.title,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White
                            ),
                            maxLines = 1,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 28.dp)
                                .basicMarquee()
                        )

                        // 3-Bar Audio Wave Indicator on the right edge
                        EqualizerWaveformBars(
                            isPlaying = isPlaying,
                            modifier = Modifier.align(Alignment.CenterEnd)
                        )
                    }

                    Spacer(modifier = Modifier.height(2.dp))

                    // Artist Name
                    Text(
                        text = displaySong.artist,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.Normal,
                            color = Color.White.copy(alpha = 0.65f)
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // iOS-Style Thin Progress Bar / Scrubber
                    var isScrubbing by remember { mutableStateOf(false) }
                    var scrubPositionMs by remember { mutableLongStateOf(0L) }

                    val currentPositionMs = if (isScrubbing) {
                        scrubPositionMs
                    } else if (song != null) {
                        playerState.position.positionMs
                    } else {
                        131000L // 2:11
                    }
                    val durationMs = (if (song != null) playerState.durationMs else 182000L).coerceAtLeast(1L)
                    val progressFraction = (currentPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)

                    IosProgressBar(
                        progress = progressFraction,
                        onSeek = { fraction ->
                            scrubPositionMs = (fraction * durationMs).toLong()
                            if (song != null) {
                                controller?.seekTo(scrubPositionMs)
                            }
                        },
                        onScrubbingChanged = { isScrubbing = it }
                    )

                    Spacer(modifier = Modifier.height(5.dp))

                    // Time Labels: Elapsed (left), Remaining with minus sign (right)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = formatDuration(currentPositionMs),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color.White.copy(alpha = 0.55f)
                            )
                        )
                        val remainingMs = (durationMs - currentPositionMs).coerceAtLeast(0L)
                        Text(
                            text = "-${formatDuration(remainingMs)}",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color.White.copy(alpha = 0.55f)
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Media Controls Row: Star, Rewind, Play/Pause, FastForward, AirPlay
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Star / Favorite
                        IconButton(
                            onClick = {
                                if (song != null) {
                                    if (isLiked) {
                                        LikeState.set(song.videoId, LikeStatus.INDIFFERENT)
                                    } else {
                                        LikeState.set(song.videoId, LikeStatus.LIKE)
                                    }
                                }
                            },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = if (isLiked) Icons.Rounded.Star else Icons.Rounded.StarBorder,
                                contentDescription = "Favorite",
                                tint = if (isLiked) Color(0xFFFFD600) else Color.White.copy(alpha = 0.85f),
                                modifier = Modifier.size(24.dp)
                            )
                        }

                        // Previous Track (Double Chevron Rewind)
                        IconButton(
                            onClick = { controller?.seekToPrevious() },
                            modifier = Modifier.size(40.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.FastRewind,
                                contentDescription = "Previous",
                                tint = Color.White,
                                modifier = Modifier.size(30.dp)
                            )
                        }

                        // Play / Pause Clean Icon (No circle, clean Apple Music style)
                        IconButton(
                            onClick = {
                                if (song != null) {
                                    if (playerState.isPlaying) {
                                        controller?.pause()
                                    } else {
                                        controller?.play()
                                    }
                                }
                            },
                            modifier = Modifier.size(46.dp)
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                                contentDescription = if (isPlaying) "Pause" else "Play",
                                tint = Color.White,
                                modifier = Modifier.size(38.dp)
                            )
                        }

                        // Next Track (Double Chevron Forward)
                        IconButton(
                            onClick = { controller?.seekToNext() },
                            modifier = Modifier.size(40.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.FastForward,
                                contentDescription = "Next",
                                tint = Color.White,
                                modifier = Modifier.size(30.dp)
                            )
                        }

                        // Output / AirPlay
                        IconButton(
                            onClick = {
                                runCatching {
                                    val intent = Intent("android.settings.BLUETOOTH_SETTINGS").apply {
                                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    }
                                    context.startActivity(intent)
                                }
                            },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Airplay,
                                contentDescription = "Audio Output",
                                tint = Color.White.copy(alpha = 0.85f),
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // --- 5. BOTTOM SHORTCUTS: Flashlight (Left), Camera (Right) ---
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Flashlight Pill Button
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(
                            if (isFlashlightOn) Color.White.copy(alpha = 0.90f)
                            else Color.White.copy(alpha = 0.18f)
                        )
                        .border(0.5.dp, Color.White.copy(alpha = 0.25f), CircleShape)
                        .clickable {
                            if (torchCameraId != null) {
                                val nextTorch = !isFlashlightOn
                                runCatching {
                                    cameraManager?.setTorchMode(torchCameraId, nextTorch)
                                    isFlashlightOn = nextTorch
                                }
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isFlashlightOn) Icons.Rounded.FlashlightOn else Icons.Rounded.FlashlightOff,
                        contentDescription = "Flashlight",
                        tint = if (isFlashlightOn) Color.Black else Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }

                // Camera Pill Button
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.18f))
                        .border(0.5.dp, Color.White.copy(alpha = 0.25f), CircleShape)
                        .clickable {
                            val intent = Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            runCatching { context.startActivity(intent) }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.CameraAlt,
                        contentDescription = "Camera",
                        tint = Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Apple Home Indicator bar (Swipe up or tap to dismiss)
            Box(
                modifier = Modifier
                    .width(135.dp)
                    .height(5.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.85f))
                    .clickable { onDismiss() }
            )

            Spacer(modifier = Modifier.height(6.dp))
        }
        }
    }
}

/**
 * Sleek 3-bar animated equalizer wave (matching the Apple Music iOS Lock Screen card).
 */
@Composable
private fun EqualizerWaveformBars(
    isPlaying: Boolean,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "waveform")
    val h1 by transition.animateFloat(
        initialValue = 4f,
        targetValue = 14f,
        animationSpec = infiniteRepeatable(
            animation = tween(420, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "h1"
    )
    val h2 by transition.animateFloat(
        initialValue = 13f,
        targetValue = 5f,
        animationSpec = infiniteRepeatable(
            animation = tween(580, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "h2"
    )
    val h3 by transition.animateFloat(
        initialValue = 7f,
        targetValue = 15f,
        animationSpec = infiniteRepeatable(
            animation = tween(480, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "h3"
    )

    Row(
        modifier = modifier.height(16.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        val barWidth = 2.dp
        Box(
            modifier = Modifier
                .width(barWidth)
                .height(if (isPlaying) h1.dp else 4.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.85f))
        )
        Box(
            modifier = Modifier
                .width(barWidth)
                .height(if (isPlaying) h2.dp else 9.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.85f))
        )
        Box(
            modifier = Modifier
                .width(barWidth)
                .height(if (isPlaying) h3.dp else 6.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.85f))
        )
    }
}

/**
 * Ultra-thin iOS-style scrubber with smooth seek drag gesture.
 */
@Composable
private fun IosProgressBar(
    progress: Float,
    onSeek: (Float) -> Unit,
    onScrubbingChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    var dragProgress by remember { mutableFloatStateOf(progress) }
    var dragging by remember { mutableStateOf(false) }

    LaunchedEffect(progress) {
        if (!dragging) {
            dragProgress = progress
        }
    }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .height(20.dp)
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    val newFraction = (offset.x / size.width.toFloat()).coerceIn(0f, 1f)
                    dragProgress = newFraction
                    onSeek(newFraction)
                }
            }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { offset ->
                        dragging = true
                        onScrubbingChanged(true)
                        val newFraction = (offset.x / size.width.toFloat()).coerceIn(0f, 1f)
                        dragProgress = newFraction
                    },
                    onDragEnd = {
                        dragging = false
                        onScrubbingChanged(false)
                        onSeek(dragProgress)
                    },
                    onDragCancel = {
                        dragging = false
                        onScrubbingChanged(false)
                    },
                    onHorizontalDrag = { change, _ ->
                        change.consume()
                        val newFraction = (change.position.x / size.width.toFloat()).coerceIn(0f, 1f)
                        dragProgress = newFraction
                    }
                )
            },
        contentAlignment = Alignment.CenterStart
    ) {
        val totalWidth = maxWidth
        val currentFraction = if (dragging) dragProgress else progress

        // Track background
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Color.White.copy(alpha = 0.22f))
        )

        // Active track
        Box(
            modifier = Modifier
                .width(totalWidth * currentFraction)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Color.White)
        )
    }
}

private fun formatDuration(ms: Long): String {
    val totalSeconds = (ms.coerceAtLeast(0L) / 1000).toInt()
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return if (minutes >= 60) {
        val hours = minutes / 60
        val remMinutes = minutes % 60
        "%d:%02d:%02d".format(Locale.ROOT, hours, remMinutes, seconds)
    } else {
        "%d:%02d".format(Locale.ROOT, minutes, seconds)
    }
}

private fun isBatteryConstrained(context: Context): Boolean {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
    if (powerManager?.isPowerSaveMode == true) return true
    val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { filter ->
        context.registerReceiver(null, filter)
    }
    val level: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val batteryPct = if (level >= 0 && scale > 0) (level * 100) / scale else 100
    return batteryPct <= 15
}
