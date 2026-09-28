package com.music.aether.connect

/**
 * Data contracts and models for Aether Connect — inspired by RaagaX Connect.
 *
 * Implements layer separation:
 * - Device Discovery & Identification
 * - Transport Protocol & Latency Scoring
 * - Authoritative State Handover & Remote Control
 */

enum class DeviceType {
    PHONE,
    TABLET,
    COMPUTER,
    TV,
    SPEAKER,
    HEADPHONES,
}

enum class TransportKind {
    LOCAL_ENDPOINT, // On-device AudioTrack (Speaker / Bluetooth / USB)
    LOCAL_LAN,      // Ultra-low latency WiFi / LAN peer
    CLOUD_RELAY,    // WebRTC / Cloud presence relay
}

data class ConnectDevice(
    val id: String,
    val name: String,
    val type: DeviceType,
    val transport: TransportKind,
    val isCurrent: Boolean = false,
    val latencyMs: Int? = null,
    val volume: Float = 1.0f,
    val formatDescription: String? = null,
    val ipAddress: String? = null,
    val canReceiveAudio: Boolean = true,
    val canControl: Boolean = true,
)

data class RemotePlaybackSnapshot(
    val videoId: String?,
    val title: String?,
    val artist: String?,
    val thumbnailUrl: String?,
    val positionMs: Long,
    val durationMs: Long,
    val isPlaying: Boolean,
    val volume: Float,
    val updatedAtMs: Long = System.currentTimeMillis(),
)

sealed interface RemoteCommand {
    data object Play : RemoteCommand
    data object Pause : RemoteCommand
    data class Seek(val positionMs: Long) : RemoteCommand
    data class Volume(val volume: Float) : RemoteCommand
    data object Next : RemoteCommand
    data object Previous : RemoteCommand
    data class SwitchPlayback(
        val videoId: String,
        val positionMs: Long,
        val isPlaying: Boolean,
    ) : RemoteCommand
}
