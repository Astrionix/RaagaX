package com.music.raaga.desktop

import kotlinx.serialization.Serializable

@Serializable
data class DesktopSpotifyTrack(
    val title: String,
    val artist: String,
    val durationMs: Long? = null,
    val id: String? = null,
    val isrc: String? = null,
)

@Serializable
data class DesktopSpotifyUserProfile(
    val id: String,
    val displayName: String,
    val email: String? = null,
    val avatarUrl: String? = null,
    val product: String? = null,
)

@Serializable
data class DesktopSpotifyUserPlaylistSummary(
    val id: String,
    val name: String,
    val description: String? = null,
    val coverArtUrl: String? = null,
    val trackCount: Int = 0,
    val isOwner: Boolean = true,
    val ownerName: String? = null,
)

@Serializable
data class DesktopSpotifyPlaylistInfo(
    val id: String,
    val type: String,
    val title: String,
    val author: String?,
    val coverArtUrl: String?,
    val tracks: List<DesktopSpotifyTrack>,
    val isPartial: Boolean = false,
)
