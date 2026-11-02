package com.music.raaga.data.listentogether

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * JamVotingManager — Powers collaborative social queue voting from RaagaX Jam.
 *
 * Implements:
 * - Dynamic Upvoting (▲) & Downvoting (▼) per track
 * - Popularity Score Calculation: `(upvotes - downvotes)`
 * - Democratic Queue Prioritization: Automatically ranks upcoming songs based
 *   on attendee votes.
 * - Track attribution: Tracks which member queued each track.
 */
object JamVotingManager {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    data class TrackVote(
        val videoId: String,
        val upvotes: Set<String> = emptySet(),
        val downvotes: Set<String> = emptySet(),
        val addedByUserId: String? = null,
        val addedByName: String? = null,
    ) {
        val score: Int get() = upvotes.size - downvotes.size
    }

    private val _votes = MutableStateFlow<Map<String, TrackVote>>(emptyMap())
    val votes: StateFlow<Map<String, TrackVote>> = _votes.asStateFlow()

    // Host policy toggles from Raaga Jam
    private val _guestControlAllowed = MutableStateFlow(true)
    val guestControlAllowed: StateFlow<Boolean> = _guestControlAllowed.asStateFlow()

    private val _guestQueueAllowed = MutableStateFlow(true)
    val guestQueueAllowed: StateFlow<Boolean> = _guestQueueAllowed.asStateFlow()

    fun setGuestControlAllowed(allowed: Boolean) {
        _guestControlAllowed.value = allowed
        ListenTogether.setHostOnlyControl(!allowed)
    }

    fun setGuestQueueAllowed(allowed: Boolean) {
        _guestQueueAllowed.value = allowed
    }

    fun registerTrack(videoId: String, addedByUserId: String?, addedByName: String?) {
        _votes.update { map ->
            if (map.containsKey(videoId)) map
            else map + (videoId to TrackVote(
                videoId = videoId,
                addedByUserId = addedByUserId,
                addedByName = addedByName,
            ))
        }
    }

    fun toggleUpvote(userId: String, videoId: String) {
        _votes.update { map ->
            val current = map[videoId] ?: TrackVote(videoId = videoId)
            val hasUpvoted = current.upvotes.contains(userId)
            val updated = if (hasUpvoted) {
                // Remove upvote
                current.copy(upvotes = current.upvotes - userId)
            } else {
                // Add upvote, remove downvote if present
                current.copy(
                    upvotes = current.upvotes + userId,
                    downvotes = current.downvotes - userId,
                )
            }
            map + (videoId to updated)
        }
        reorderQueueIfHost()
    }

    fun toggleDownvote(userId: String, videoId: String) {
        _votes.update { map ->
            val current = map[videoId] ?: TrackVote(videoId = videoId)
            val hasDownvoted = current.downvotes.contains(userId)
            val updated = if (hasDownvoted) {
                // Remove downvote
                current.copy(downvotes = current.downvotes - userId)
            } else {
                // Add downvote, remove upvote if present
                current.copy(
                    downvotes = current.downvotes + userId,
                    upvotes = current.upvotes - userId,
                )
            }
            map + (videoId to updated)
        }
        reorderQueueIfHost()
    }

    fun getScore(videoId: String): Int {
        return _votes.value[videoId]?.score ?: 0
    }

    fun hasUpvoted(userId: String, videoId: String): Boolean {
        return _votes.value[videoId]?.upvotes?.contains(userId) == true
    }

    fun hasDownvoted(userId: String, videoId: String): Boolean {
        return _votes.value[videoId]?.downvotes?.contains(userId) == true
    }

    fun getAddedByName(videoId: String): String? {
        return _votes.value[videoId]?.addedByName
    }

    /**
     * If this device is the party Host, checks if the democratic vote scores
     * warrant reordering the upcoming queue items on the party server.
     */
    private fun reorderQueueIfHost() {
        scope.launch {
            val state = ListenTogether.state.value
            val isHost = state.you?.isHost == true
            if (!isHost || state.queue.items.size <= 2) return@launch

            val currentIndex = state.queue.index.coerceAtLeast(0)
            val upcoming = state.queue.items.drop(currentIndex + 1)
            if (upcoming.size <= 1) return@launch

            // Check if upcoming items need sorting by score descending
            val currentScores = upcoming.map { getScore(it.videoId) }
            val isSortedDesc = currentScores.zipWithNext().all { it.first >= it.second }
            if (!isSortedDesc) {
                // Reorder by score descending
                val sortedUpcoming = upcoming.sortedByDescending { getScore(it.videoId) }
                val newFullQueue = state.queue.items.take(currentIndex + 1) + sortedUpcoming
                ListenTogether.setQueue(newFullQueue, currentIndex)
            }
        }
    }

    // Democratic Skip Voting
    private val _skipVotes = MutableStateFlow<Set<String>>(emptySet())
    val skipVotes: StateFlow<Set<String>> = _skipVotes.asStateFlow()

    fun toggleSkipVote(userId: String) {
        val currentVotes = _skipVotes.value
        val updated = if (currentVotes.contains(userId)) {
            currentVotes - userId
        } else {
            currentVotes + userId
        }
        _skipVotes.value = updated
        evaluateSkipThreshold()
    }

    fun hasVotedToSkip(userId: String): Boolean = _skipVotes.value.contains(userId)

    fun skipVotesNeeded(): Int {
        val state = ListenTogether.state.value
        val connectedMembers = state.members.filter { it.connected }
        val memberCount = connectedMembers.size.coerceAtLeast(1)
        return (memberCount / 2) + 1
    }

    private fun evaluateSkipThreshold() {
        val state = ListenTogether.state.value
        if (!state.inParty) return
        val needed = skipVotesNeeded()
        if (_skipVotes.value.size >= needed) {
            _skipVotes.value = emptySet()
            ListenTogether.next()
        }
    }

    fun onTrackChanged() {
        _skipVotes.value = emptySet()
    }

    fun reset() {
        _votes.value = emptyMap()
        _skipVotes.value = emptySet()
    }
}
