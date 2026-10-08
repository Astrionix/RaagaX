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
)

@Serializable
data class ConnectControlCommand(
    val action: String, // "PLAY", "PAUSE", "TOGGLE", "NEXT", "PREV", "SEEK", "VOLUME"
    val positionMs: Long? = null,
    val volume: Float? = null,
    val targetDeviceId: String = "",
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
)

data class PairedDeviceWithStatus(
    val paired: PairedDevice,
    val onlineDevice: ConnectDevice? = null,
) {
    val isOnline: Boolean get() = onlineDevice != null
}
