package com.music.raaga.data.connect

import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import com.music.raaga.data.model.Song
import com.music.raaga.playback.toMediaItem
import com.music.raaga.playback.toSong
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/**
 * Singleton managing Raaga Connect lifecycle on the Android application.
 * Connects the Android MediaController to local Wi-Fi discovery and playback transfers.
 */
object AndroidConnect {
    private val scope = CoroutineScope(Dispatchers.Main)
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    var appContext: android.content.Context? = null

    @Volatile
    private var cachedStatus: ConnectDeviceStatus = ConnectDeviceStatus(
        deviceId = "",
        deviceName = "",
        deviceType = ConnectDeviceType.PHONE,
        isPlaying = false,
        track = null,
        positionMs = 0L,
        durationMs = 0L,
        volume = 1.0f,
    )

    private val playerListener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            updateStatusFromPlayer(player)
        }
    }

    private fun updateStatusFromPlayer(player: Player) {
        val currentMedia = player.currentMediaItem?.toSong()
        val currentVolume: Float = try {
            val ctx = appContext
            if (ctx != null) {
                val am = ctx.getSystemService(android.media.AudioManager::class.java)
                val max = am?.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC) ?: 15
                val cur = am?.getStreamVolume(android.media.AudioManager.STREAM_MUSIC) ?: 15
                (cur.toFloat() / max.coerceAtLeast(1).toFloat()).coerceIn(0f, 1f)
            } else {
                1.0f
            }
        } catch (_: Exception) {
            1.0f
        }
        cachedStatus = ConnectDeviceStatus(
            deviceId = "",
            deviceName = "",
            deviceType = ConnectDeviceType.PHONE,
            isPlaying = player.isPlaying,
            track = currentMedia?.let {
                ConnectTrack(
                    videoId = it.videoId,
                    title = it.title,
                    artist = it.artist,
                    thumbnailUrl = it.thumbnailUrl,
                    durationText = it.durationText,
                    albumName = it.albumName,
                )
            },
            positionMs = player.currentPosition,
            durationMs = player.duration.coerceAtLeast(0L),
            volume = currentVolume,
        )
    }

    @Volatile
    var controller: MediaController? = null
        set(value) {
            val old = field
            if (old === value) return
            old?.removeListener(playerListener)
            field = value
            value?.addListener(playerListener)
            if (value != null) {
                if (Looper.myLooper() == Looper.getMainLooper()) {
                    updateStatusFromPlayer(value)
                } else {
                    mainHandler.post { updateStatusFromPlayer(value) }
                }
            }
        }

    val manager: RaagaConnectManager = RaagaConnectManager(
        initialDeviceName = getDeviceName(),
        deviceType = ConnectDeviceType.PHONE,
        getLocalPlaybackStatus = {
            val c = controller
            if (c != null) {
                if (Looper.myLooper() == Looper.getMainLooper()) {
                    updateStatusFromPlayer(c)
                } else {
                    runCatching {
                        val future = CompletableFuture<Unit>()
                        mainHandler.post {
                            try {
                                updateStatusFromPlayer(c)
                                future.complete(Unit)
                            } catch (t: Throwable) {
                                future.completeExceptionally(t)
                            }
                        }
                        future.get(100, TimeUnit.MILLISECONDS)
                    }
                }
            }
            cachedStatus
        },
        onPlaybackTransferredToMe = { transfer ->
            scope.launch {
                val c = controller ?: return@launch
                transfer.volume?.let { v ->
                    try {
                        val ctx = appContext
                        if (ctx != null) {
                            val am = ctx.getSystemService(android.media.AudioManager::class.java)
                            val max = am?.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC) ?: 15
                            am?.setStreamVolume(
                                android.media.AudioManager.STREAM_MUSIC,
                                (v * max).toInt().coerceIn(0, max),
                                0,
                            )
                        }
                    } catch (_: Exception) {}
                }
                val song = Song(
                    videoId = transfer.track.videoId,
                    title = transfer.track.title,
                    artist = transfer.track.artist,
                    thumbnailUrl = transfer.track.thumbnailUrl,
                    durationText = transfer.track.durationText,
                    albumName = transfer.track.albumName,
                )
                val mediaItem = song.toMediaItem()
                c.setMediaItems(listOf(mediaItem), 0, transfer.positionMs)
                c.prepare()
                if (transfer.isPlaying) {
                    c.play()
                } else {
                    c.pause()
                }
            }
        },
        onRemoteControlCommand = { cmd ->
            scope.launch {
                val c = controller ?: return@launch
                when (cmd.action) {
                    "PLAY" -> c.play()
                    "PAUSE" -> c.pause()
                    "TOGGLE" -> {
                        if (c.isPlaying) c.pause() else c.play()
                    }
                    "NEXT" -> c.seekToNextMediaItem()
                    "PREV" -> c.seekToPreviousMediaItem()
                    "SEEK" -> cmd.positionMs?.let { c.seekTo(it) }
                    "VOLUME" -> {
                        cmd.volume?.let { v ->
                            try {
                                val ctx = appContext
                                if (ctx != null) {
                                    val am = ctx.getSystemService(android.media.AudioManager::class.java)
                                    val max = am?.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC) ?: 15
                                    am?.setStreamVolume(
                                        android.media.AudioManager.STREAM_MUSIC,
                                        (v * max).toInt().coerceIn(0, max),
                                        android.media.AudioManager.FLAG_SHOW_UI,
                                    )
                                }
                            } catch (_: Exception) {}
                        }
                    }
                }
            }
        },
        onTransferBackRequested = { track, positionMs, isPlaying ->
            if (track != null) {
                scope.launch {
                    val c = controller ?: return@launch
                    val song = Song(
                        videoId = track.videoId,
                        title = track.title,
                        artist = track.artist,
                        thumbnailUrl = track.thumbnailUrl,
                        durationText = track.durationText,
                        albumName = track.albumName,
                    )
                    val mediaItem = song.toMediaItem()
                    c.setMediaItems(listOf(mediaItem), 0, positionMs)
                    c.prepare()
                    if (isPlaying) c.play() else c.pause()
                }
            }
        },
        onLocalPlaybackHandoffCompleted = {
            scope.launch {
                isHandoffPausing = true
                try {
                    controller?.pause()
                } finally {
                    isHandoffPausing = false
                }
            }
        },
    )

    @Volatile
    var isHandoffPausing: Boolean = false

    fun start() {
        manager.start()
    }

    private fun getDeviceName(): String {
        val model = Build.MODEL
        val manufacturer = Build.MANUFACTURER
        return if (!model.isNullOrBlank()) {
            if (model.startsWith(manufacturer, ignoreCase = true)) {
                "Raaga Android ($model)"
            } else {
                "Raaga Android ($manufacturer $model)"
            }
        } else {
            "Raaga Android Phone"
        }
    }
}
