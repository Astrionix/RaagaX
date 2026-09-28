package com.music.aether.data.social

import com.music.aether.data.model.Song

/**
 * Represents real-time playback state and activity of a friend.
 */
data class FriendActivityState(
    val userId: String,
    val userTag: String, // e.g. "AETH-7W4Q"
    val userName: String,
    val songTitle: String,
    val artist: String,
    val coverUrl: String?,
    val isPlaying: Boolean,
    val timestamp: Long = System.currentTimeMillis(),
    val albumName: String? = null,
    val durationText: String? = null,
    val videoId: String? = null,
) {
    fun toSong(): Song {
        return Song(
            videoId = videoId ?: "",
            title = songTitle,
            artist = artist,
            albumName = albumName ?: "",
            thumbnailUrl = coverUrl,
            durationText = durationText ?: "3:30",
            sourceQuality = "320 kbps",
        )
    }
}
