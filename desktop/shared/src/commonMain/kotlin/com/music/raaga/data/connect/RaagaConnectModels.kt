package com.music.raaga.data.connect

import kotlinx.serialization.Serializable

@Serializable
enum class ConnectDeviceType {
    PHONE,
    DESKTOP,
    SPEAKER,
}

@Serializable
data class ConnectTrack(
    val videoId: String,
    val title: String,
    val artist: String,
    val thumbnailUrl: String? = null,
    val durationText: String? = null,
    val albumName: String? = null,
)

@Serializable
data class ConnectDevice(
    val id: String,
    val name: String,
    val type: ConnectDeviceType,
    val host: String = "",
    val port: Int = 8895,
    val lastSeenTimestamp: Long = 0L,
    val isCloud: Boolean = false,
)

@Serializable
enum class HandoffPhase {
    PREPARE,
    READY,
    COMMIT,
    CONFIRMED,
    ABORT,
}

@Serializable
data class ConnectHandoffPacket(
    val handoffId: String,
    val phase: HandoffPhase,
    val protocolVersion: Int = 2,
    val sessionId: String = "",
    val sourceDeviceId: String = "",
    val sourceDeviceName: String = "",
    val targetDeviceId: String = "",
    val track: ConnectTrack? = null,
    val positionMs: Long = 0L,
    val isPlaying: Boolean = true,
    val volume: Float? = null,
    val queue: List<ConnectTrack> = emptyList(),
    val queueIndex: Int = 0,
    val scheduledStartEpochMs: Long? = null,
    val bufferReadyDurationMs: Long = 0L,
    val errorCode: String? = null,
    val errorMessage: String? = null,
    val timestampMs: Long = 0L,
    val syncKey: String? = null,
)

@Serializable
data class ConnectClockSyncRequest(
    val clientSendMs: Long,
    val clientDeviceId: String = "",
)

@Serializable
data class ConnectClockSyncResponse(
    val clientSendMs: Long,
    val serverReceiveMs: Long,
    val serverTransmitMs: Long,
)

@Serializable
data class ConnectPlaybackTransfer(
    val track: ConnectTrack,
    val positionMs: Long = 0L,
    val isPlaying: Boolean = true,
    val volume: Float? = null,
    val queue: List<ConnectTrack> = emptyList(),
    val queueIndex: Int = 0,
    val sourceDeviceId: String = "",
    val sourceDeviceName: String = "",
    val targetDeviceId: String = "",
    val protocolVersion: Int = 2,
    val sessionId: String = "",
    val syncKey: String? = null,
)

@Serializable
data class ConnectControlCommand(
    val action: String, // "PLAY", "PAUSE", "TOGGLE", "NEXT", "PREV", "SEEK", "VOLUME", "SPEED"
    val positionMs: Long? = null,
    val volume: Float? = null,
    val playbackSpeed: Float? = null,
    val targetDeviceId: String = "",
    val commandId: String = "",
    val seq: Long = 0L,
    val protocolVersion: Int = 2,
    val sessionId: String? = null,
    val senderDeviceId: String = "",
    val syncKey: String? = null,
)

@Serializable
data class ConnectControlAck(
    val commandId: String,
    val success: Boolean,
    val deduplicated: Boolean = false,
    val message: String = "",
    val timestampMs: Long = 0L,
)

@Serializable
data class ConnectDeviceStatus(
    val deviceId: String,
    val deviceName: String,
    val deviceType: ConnectDeviceType,
    val isPlaying: Boolean,
    val track: ConnectTrack? = null,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val volume: Float = 1.0f,
    val playbackSpeed: Float = 1.0f,
    val anchorMonotonicMs: Long = 0L,
    val protocolVersion: Int = 2,
    val sessionId: String? = null,
    val activeSpeakerDeviceId: String? = null,
)

@Serializable
data class PairedDevice(
    val id: String,
    val name: String,
    val type: ConnectDeviceType,
    val pairedAt: Long = 0L,
)

@Serializable
data class ConnectPairRequest(
    val code: String, // 6-digit pair code e.g. "742891"
    val fromDevice: ConnectDevice,
)

@Serializable
data class ConnectPairResponse(
    val code: String,
    val success: Boolean,
    val message: String = "",
    val fromDevice: ConnectDevice,
    val targetDeviceId: String,
    val syncKey: String? = null,
)

data class PairedDeviceWithStatus(
    val paired: PairedDevice,
    val onlineDevice: ConnectDevice? = null,
) {
    val isOnline: Boolean get() = onlineDevice != null
}

fun parseDurationTextToMs(text: String?): Long {
    if (text.isNullOrBlank()) return 0L
    return try {
        val parts = text.split(":").map { it.trim().toLong() }
        when (parts.size) {
            2 -> (parts[0] * 60 + parts[1]) * 1000L
            3 -> (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000L
            else -> 0L
        }
    } catch (_: Exception) {
        0L
    }
}
