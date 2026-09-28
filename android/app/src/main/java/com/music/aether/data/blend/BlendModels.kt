package com.music.aether.data.blend

import com.music.aether.data.model.Song

/**
 * Unique permanent identity for an Aether user/device.
 */
data class AetherUserIdentity(
    val userId: String,
    val userTag: String, // e.g. "AETH-7W4Q"
    val userName: String,
)

/**
 * Result of a Spotify/RaagaX-style Blend between two users.
 */
data class BlendResult(
    val id: String,
    val userAName: String,
    val userBName: String,
    val userATag: String,
    val userBTag: String,
    val matchScore: Int, // 78 to 99%
    val description: String,
    val playlistTitle: String,
    val tracks: List<Song>,
)
