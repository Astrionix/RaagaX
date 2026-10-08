package com.music.raaga.desktop

import com.music.raaga.data.connect.ConnectControlCommand
import com.music.raaga.data.connect.ConnectDeviceStatus
import com.music.raaga.data.connect.ConnectDeviceType
import com.music.raaga.data.connect.ConnectPlaybackTransfer
import com.music.raaga.data.connect.ConnectTrack
import com.music.raaga.data.connect.RaagaConnectManager
import com.music.raaga.data.connect.RaagaPairingStore
import com.music.raaga.data.model.Song
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Singleton managing Raaga Connect lifecycle on the Desktop application.
 * Connects the desktop audio engine to local Wi-Fi discovery and playback transfers.
 */
object DesktopConnect {
    private val scope = CoroutineScope(Dispatchers.Main)

    var playbackEngine: DesktopPlaybackEngine? = null
    var onPlaySong: ((Song, Long, Boolean) -> Unit)? = null
    var onPlaySongsWithQueue: ((List<Song>, Int, Long, Boolean) -> Unit)? = null
    var liveQueueProvider: (() -> List<Song>)? = null
    var onNext: (() -> Unit)? = null
    var onPrevious: (() -> Unit)? = null

    val controlledByDeviceName = kotlinx.coroutines.flow.MutableStateFlow<String?>(null)

    val manager: RaagaConnectManager = RaagaConnectManager(
        initialDeviceName = getHostDeviceName(),
        deviceType = ConnectDeviceType.DESKTOP,
        getLocalPlaybackStatus = {
            val engine = playbackEngine
            val state = engine?.state?.value
            val song = state?.song
            val dur = state?.durationMs?.takeIf { it > 0L }
                ?: com.music.raaga.data.connect.parseDurationTextToMs(song?.durationText)
            ConnectDeviceStatus(
                deviceId = "",
                deviceName = "",
                deviceType = ConnectDeviceType.DESKTOP,
                isPlaying = state?.isPlaying ?: false,
                track = song?.let {
                    ConnectTrack(
                        videoId = it.videoId,
                        title = it.title,
                        artist = it.artist,
                        thumbnailUrl = it.thumbnailUrl,
                        durationText = it.durationText,
                        albumName = it.albumName,
                    )
                },
                positionMs = state?.positionMs ?: 0L,
                durationMs = dur,
                volume = state?.volume ?: 1.0f,
            )
        },
        getLocalPlaybackQueue = {
            liveQueueProvider?.invoke()?.map { s ->
                ConnectTrack(
                    videoId = s.videoId,
                    title = s.title,
                    artist = s.artist,
                    thumbnailUrl = s.thumbnailUrl,
                    durationText = s.durationText,
                    albumName = s.albumName,
                )
            } ?: emptyList()
        },
        onPlaybackTransferredToMe = { transfer ->
            scope.launch {
                controlledByDeviceName.value = transfer.sourceDeviceName.ifBlank { "Mobile Phone" }
                transfer.volume?.let { playbackEngine?.setVolume(it) }
                val song = Song(
                    videoId = transfer.track.videoId,
                    title = transfer.track.title,
                    artist = transfer.track.artist,
                    thumbnailUrl = transfer.track.thumbnailUrl,
                    durationText = transfer.track.durationText,
                    albumName = transfer.track.albumName,
                )
                val songs = if (transfer.queue.isNotEmpty()) {
                    transfer.queue.map { t ->
                        Song(
                            videoId = t.videoId,
                            title = t.title,
                            artist = t.artist,
                            thumbnailUrl = t.thumbnailUrl,
                            durationText = t.durationText,
                            albumName = t.albumName,
                        )
                    }
                } else {
                    listOf(song)
                }
                val startIdx = if (transfer.queue.isNotEmpty()) {
                    val foundIdx = transfer.queue.indexOfFirst { it.videoId == transfer.track.videoId }
                    if (foundIdx >= 0) foundIdx else transfer.queueIndex.coerceIn(songs.indices)
                } else 0

                if (onPlaySongsWithQueue != null) {
                    onPlaySongsWithQueue?.invoke(songs, startIdx, transfer.positionMs, transfer.isPlaying)
                } else {
                    onPlaySong?.invoke(song, transfer.positionMs, transfer.isPlaying)
                }
            }
        },
        onRemoteControlCommand = { cmd ->
            scope.launch {
                val engine = playbackEngine ?: return@launch
                when (cmd.action) {
                    "PLAY" -> engine.play()
                    "PAUSE" -> engine.pause()
                    "TOGGLE" -> {
                        if (engine.state.value.isPlaying) engine.pause() else engine.play()
                    }
                    "NEXT" -> onNext?.invoke()
                    "PREV" -> onPrevious?.invoke()
                    "SEEK" -> cmd.positionMs?.let { engine.seekTo(it) }
                    "VOLUME" -> cmd.volume?.let { engine.setVolume(it) }
                }
            }
        },
        onTransferBackRequested = { track, positionMs, isPlaying ->
            if (track != null) {
                scope.launch {
                    val song = Song(
                        videoId = track.videoId,
                        title = track.title,
                        artist = track.artist,
                        thumbnailUrl = track.thumbnailUrl,
                        durationText = track.durationText,
                        albumName = track.albumName,
                    )
                    onPlaySong?.invoke(song, positionMs, isPlaying)
                }
            }
        },
        onLocalPlaybackHandoffCompleted = {
            scope.launch {
                controlledByDeviceName.value = null
                playbackEngine?.pause()
            }
        },
    )

    fun disconnectController() {
        controlledByDeviceName.value = null
    }

    fun start() {
        manager.start()
    }

    private fun getHostDeviceName(): String {
        RaagaPairingStore.getCustomDeviceName()?.let { return it }
        val osName = System.getProperty("os.name", "")
        val isMac = osName.contains("Mac", ignoreCase = true)
        val isWindows = osName.contains("Windows", ignoreCase = true)
        val defaultFallback = when {
            isMac -> "MacBook"
            isWindows -> "Windows PC"
            else -> "PC"
        }
        return try {
            if (isMac) {
                val proc = ProcessBuilder("scutil", "--get", "ComputerName").start()
                val name = proc.inputStream.bufferedReader().readLine()?.trim()
                if (!name.isNullOrBlank()) return name
            }
            val hostname = java.net.InetAddress.getLocalHost().hostName
                .substringBefore(".local")
                .substringBefore(".")
                .replace("-", " ")
                .trim()
            if (hostname.isNotBlank() && !hostname.equals("localhost", ignoreCase = true)) {
                hostname
            } else {
                defaultFallback
            }
        } catch (_: Exception) {
            defaultFallback
        }
    }
}
