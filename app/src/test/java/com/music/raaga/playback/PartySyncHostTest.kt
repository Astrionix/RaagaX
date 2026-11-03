/*
 * Copyright (C) 2026 Raaga Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 */

package com.music.raaga.playback

import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.music.raaga.data.listentogether.ListenTogether
import com.music.raaga.data.listentogether.PartyMember
import com.music.raaga.data.listentogether.PartyPlayback
import com.music.raaga.data.listentogether.PartyQueue
import com.music.raaga.data.listentogether.PartyTrack
import kotlinx.coroutines.test.TestScope
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.lang.reflect.InvocationHandler
import java.lang.reflect.Method
import java.lang.reflect.Proxy

class PartySyncHostTest {

    private val testScope = TestScope()
    private lateinit var handler: FakePlayerHandler
    private lateinit var player: ExoPlayer
    private lateinit var partySync: PartySync

    class FakePlayerHandler : InvocationHandler {
        var position: Long = 10_000L
        var isPlaying: Boolean = true
        var playWhenReady: Boolean = true
        var playbackState: Int = Player.STATE_READY
        var currentSpeed: Float = 1.0f
        var currentItem: MediaItem? = MediaItem.Builder().setMediaId("track_1").build()
        var pauseAtEndOfMediaItems: Boolean = false

        val seekCalls = mutableListOf<Long>()
        val speedCalls = mutableListOf<Float>()
        var playCalled = false
        var pauseCalled = false
        var prepareCalled = false
        val setMediaItemsCalls = mutableListOf<List<MediaItem>>()

        override fun invoke(proxy: Any?, method: Method, args: Array<out Any>?): Any? {
            return when (method.name) {
                "getCurrentPosition" -> position
                "getPlaybackState" -> playbackState
                "isPlaying" -> isPlaying
                "getPlayWhenReady" -> playWhenReady
                "getPlaybackParameters" -> PlaybackParameters(currentSpeed)
                "getCurrentMediaItem" -> currentItem
                "getPlaybackSuppressionReason" -> Player.PLAYBACK_SUPPRESSION_REASON_NONE
                "getPauseAtEndOfMediaItems" -> pauseAtEndOfMediaItems
                "setPauseAtEndOfMediaItems" -> {
                    pauseAtEndOfMediaItems = args?.get(0) as Boolean
                    null
                }
                "getCurrentMediaItemIndex" -> 0
                "getMediaItemCount" -> 1
                "getMediaItemAt" -> currentItem
                "seekTo" -> {
                    val targetPos = if (args?.size == 1) args[0] as Long else args?.get(1) as Long
                    seekCalls.add(targetPos)
                    position = targetPos
                    null
                }
                "setPlaybackSpeed" -> {
                    val speed = args?.get(0) as Float
                    speedCalls.add(speed)
                    currentSpeed = speed
                    null
                }
                "setPlaybackParameters" -> {
                    val params = args?.get(0) as PlaybackParameters
                    speedCalls.add(params.speed)
                    currentSpeed = params.speed
                    null
                }
                "play" -> {
                    playCalled = true
                    playWhenReady = true
                    isPlaying = true
                    null
                }
                "pause" -> {
                    pauseCalled = true
                    playWhenReady = false
                    isPlaying = false
                    null
                }
                "prepare" -> {
                    prepareCalled = true
                    null
                }
                "setMediaItems" -> {
                    @Suppress("UNCHECKED_CAST")
                    val items = args?.get(0) as? List<MediaItem> ?: emptyList()
                    setMediaItemsCalls.add(items)
                    if (args != null && args.size >= 3) {
                        position = args[2] as Long
                    }
                    if (items.isNotEmpty()) {
                        currentItem = items[0]
                    }
                    null
                }
                "equals" -> proxy === args?.get(0)
                "hashCode" -> System.identityHashCode(proxy)
                "toString" -> "FakeExoPlayer"
                else -> {
                    val retType = method.returnType
                    when {
                        retType == Boolean::class.javaPrimitiveType -> false
                        retType == Int::class.javaPrimitiveType -> 0
                        retType == Long::class.javaPrimitiveType -> 0L
                        retType == Float::class.javaPrimitiveType -> 0f
                        retType == Double::class.javaPrimitiveType -> 0.0
                        else -> null
                    }
                }
            }
        }
    }

    @Before
    fun setUp() {
        handler = FakePlayerHandler()
        player = Proxy.newProxyInstance(
            Player::class.java.classLoader,
            arrayOf(ExoPlayer::class.java),
            handler
        ) as ExoPlayer

        partySync = PartySync(
            scope = testScope,
            player = { player },
            isTransitioning = { false }
        )
    }

    @After
    fun tearDown() {
        ListenTogether.setStateForTest(ListenTogether.State())
        ListenTogether.resetClockForTest()
        partySync.stop()
    }

    private fun testTrack(id: String = "track_1") = PartyTrack(
        videoId = id,
        title = "Test Song",
        artist = "Test Artist",
        durationMs = 240_000L
    )

    private fun member(id: String, isHost: Boolean) = PartyMember(
        memberId = id,
        displayName = id,
        isHost = isHost,
        connected = true
    )

    private fun partyState(
        isHost: Boolean,
        trackId: String = "track_1",
        seq: Long = 1L,
        positionMs: Long = 10_000L,
        isPlaying: Boolean = true,
        clockSynced: Boolean = true,
    ) = ListenTogether.State(
        code = "JAM123",
        you = member(if (isHost) "host_device" else "listener_device", isHost = isHost),
        members = listOf(
            member("host_device", isHost = true),
            member("listener_device", isHost = false),
        ),
        clockSynced = clockSynced,
        playback = PartyPlayback(
            seq = seq,
            track = testTrack(trackId),
            isPlaying = isPlaying,
            positionMs = positionMs,
            effectivePositionMs = positionMs,
            anchorMs = 1_000_000L,
        ),
        queue = PartyQueue(
            seq = 1L,
            index = 0,
            items = listOf(testTrack(trackId))
        )
    )

    @Test
    fun hostReconciliation_withDrift_doesNotNudgeSpeedOrSeek() {
        // Initial sync at 10,000ms
        handler.position = 10_000L
        handler.playWhenReady = true
        handler.playbackState = Player.STATE_READY

        val state = partyState(isHost = true, positionMs = 10_000L)
        ListenTogether.setStateForTest(state)
        partySync.reconcile()

        // Drift occurs: simulated party timeline reaches 10,250ms (250ms drift > 150ms NUDGE_ENGAGE_MS)
        ListenTogether.setStateForTest(state.copy(
            playback = state.playback.copy(
                positionMs = 10_250L,
                effectivePositionMs = 10_250L
            )
        ))
        handler.speedCalls.clear()
        handler.seekCalls.clear()

        partySync.reconcile()

        // Host must NOT have its playback speed nudged and must NOT seek
        assertTrue("Speed calls must be empty for host, was: ${handler.speedCalls}", handler.speedCalls.isEmpty())
        assertTrue("Seek calls must be empty for host, was: ${handler.seekCalls}", handler.seekCalls.isEmpty())
        assertEquals("Host nudge rate must remain 1.0f", 1f, partySync.currentNudgeRate, 0.0001f)
        assertEquals("Host drift strikes must remain 0", 0, partySync.currentDriftStrikes)
    }

    @Test
    fun listenerReconciliation_withDrift_engagesSpeedNudging() {
        // Initial sync at 10,000ms
        handler.position = 10_000L
        handler.playWhenReady = true
        handler.playbackState = Player.STATE_READY

        val state = partyState(isHost = false, positionMs = 10_000L)
        ListenTogether.setStateForTest(state)
        partySync.reconcile()

        // Listener playhead falls behind: player is at 10,000ms, party has moved to 10,250ms (-250ms drift)
        ListenTogether.setStateForTest(state.copy(
            playback = state.playback.copy(
                positionMs = 10_250L,
                effectivePositionMs = 10_250L
            )
        ))
        handler.speedCalls.clear()

        // Reconcile executes drift checking on listener
        partySync.reconcile()

        // Listener MUST engage nudge (speeding up by +3%)
        assertTrue("Listener speed should be adjusted for drift", handler.speedCalls.isNotEmpty())
        assertEquals(1.03f, handler.speedCalls.last(), 0.001f)
        assertEquals(1.03f, partySync.currentNudgeRate, 0.001f)
    }

    @Test
    fun hostReconciliation_withLargeDrift_doesNotPerformPeriodicDriftSeek() {
        // Initial sync at 10,000ms
        handler.position = 10_000L
        handler.playWhenReady = true
        handler.playbackState = Player.STATE_READY

        val state = partyState(isHost = true, positionMs = 10_000L)
        ListenTogether.setStateForTest(state)
        partySync.reconcile()

        // Party target drifts heavily to 15,000ms (5,000ms drift > HARD_SEEK_MS of 3,000ms) with same seq
        ListenTogether.setStateForTest(state.copy(
            playback = state.playback.copy(
                positionMs = 15_000L,
                effectivePositionMs = 15_000L
            )
        ))
        handler.seekCalls.clear()

        // Run reconcile multiple times
        repeat(5) {
            partySync.reconcile()
        }

        assertTrue("Host must never suffer periodic drift seeks, was: ${handler.seekCalls}", handler.seekCalls.isEmpty())
        assertEquals(0, partySync.currentDriftStrikes)
    }

    @Test
    fun listenerReconciliation_withLargeDrift_performsCorrectionSeek() {
        // Initial sync at 10,000ms
        handler.position = 10_000L
        handler.playWhenReady = true
        handler.playbackState = Player.STATE_READY

        val state = partyState(isHost = false, positionMs = 10_000L)
        ListenTogether.setStateForTest(state)
        partySync.reconcile()

        // Large drift occurs: party moved to 15,000ms (5,000ms drift > HARD_SEEK_MS) with same seq
        ListenTogether.setStateForTest(state.copy(
            playback = state.playback.copy(
                positionMs = 15_000L,
                effectivePositionMs = 15_000L
            )
        ))
        handler.seekCalls.clear()

        // First drift reading increments strikes
        partySync.reconcile()
        assertEquals(1, partySync.currentDriftStrikes)

        // Second drift reading reaches DRIFT_STRIKES (2) and executes corrective seek
        partySync.reconcile()
        assertTrue("Listener must perform corrective seek for large drift", handler.seekCalls.isNotEmpty())
        assertEquals(15_000L, handler.seekCalls.last())
        assertEquals(0, partySync.currentDriftStrikes)
    }

    @Test
    fun hostReconciliation_onRemotePause_pausesPlayer() {
        handler.playWhenReady = true
        handler.isPlaying = true

        val pausedState = partyState(isHost = true, isPlaying = false, positionMs = 20_000L)
        ListenTogether.setStateForTest(pausedState)

        partySync.reconcile()

        assertTrue("Host must pause when party state is paused", handler.pauseCalled)
        assertFalse("playWhenReady must be false after remote pause", handler.playWhenReady)
    }

    @Test
    fun hostReconciliation_onRemotePlay_resumesPlayer() {
        handler.playWhenReady = false
        handler.isPlaying = false

        val playingState = partyState(isHost = true, isPlaying = true, positionMs = 20_000L)
        ListenTogether.setStateForTest(playingState)

        partySync.reconcile()

        assertTrue("Host must resume when party state transitions to playing", handler.playCalled)
        assertTrue("playWhenReady must be true after remote play", handler.playWhenReady)
    }

    @Test
    fun hostReconciliation_onRemoteSeek_seeksPlayer() {
        // Host playing track_1 at 10,000ms.
        handler.position = 10_000L
        handler.playWhenReady = true
        handler.playbackState = Player.STATE_READY

        val initialState = partyState(isHost = true, seq = 1L, positionMs = 10_000L)
        ListenTogether.setStateForTest(initialState)
        partySync.reconcile()
        handler.seekCalls.clear()

        // Remote member seeks to 45,000ms (seq bumped from 1 to 2, positionMs changed)
        val seekState = partyState(isHost = true, seq = 2L, positionMs = 45_000L)
        ListenTogether.setStateForTest(seekState)
        partySync.reconcile()

        // Remote seek must execute on host
        assertTrue("Host must execute remote seek command", handler.seekCalls.contains(45_000L))
    }

    @Test
    fun hostPromotion_safelyReleasesAnyActiveNudgeRate() {
        // 1. Initial sync as listener
        handler.position = 10_000L
        handler.playWhenReady = true
        handler.playbackState = Player.STATE_READY

        val listenerState = partyState(isHost = false, positionMs = 10_000L)
        ListenTogether.setStateForTest(listenerState)
        partySync.reconcile()

        // 2. Introduce drift so listener engages nudge
        ListenTogether.setStateForTest(listenerState.copy(
            playback = listenerState.playback.copy(
                positionMs = 10_250L,
                effectivePositionMs = 10_250L
            )
        ))
        partySync.reconcile()
        assertEquals(1.03f, partySync.currentNudgeRate, 0.001f)

        // 3. Device is promoted to host
        val hostState = partyState(isHost = true, positionMs = 10_250L)
        ListenTogether.setStateForTest(hostState)

        partySync.reconcile()

        // Active nudge must be immediately released and reset to 1.0f
        assertEquals("Nudge rate must reset to 1.0f upon becoming host", 1f, partySync.currentNudgeRate, 0.001f)
        assertEquals("Player speed must be restored to 1.0f", 1f, handler.currentSpeed, 0.001f)
    }

    @Test
    fun leavingParty_restoresNormalPlaybackSpeed() {
        // 1. Initial sync as listener
        handler.position = 10_000L
        val listenerState = partyState(isHost = false, positionMs = 10_000L)
        ListenTogether.setStateForTest(listenerState)
        partySync.reconcile()

        // 2. Drift and engage nudge
        ListenTogether.setStateForTest(listenerState.copy(
            playback = listenerState.playback.copy(
                positionMs = 10_250L,
                effectivePositionMs = 10_250L
            )
        ))
        partySync.reconcile()
        assertEquals(1.03f, partySync.currentNudgeRate, 0.001f)

        // 3. Leave party
        ListenTogether.setStateForTest(ListenTogether.State(code = null))
        partySync.reconcile()

        assertEquals("Leaving party must reset nudge rate to 1.0f", 1f, partySync.currentNudgeRate, 0.001f)
        assertEquals("Player speed must be restored to 1.0f", 1f, handler.currentSpeed, 0.001f)
    }

    @Test
    fun hostOutsideJam_playsNormallyWithoutNudge() {
        ListenTogether.setStateForTest(ListenTogether.State(code = null))
        handler.position = 50_000L

        partySync.reconcile()

        assertTrue(handler.speedCalls.isEmpty())
        assertTrue(handler.seekCalls.isEmpty())
        assertEquals(1f, partySync.currentNudgeRate, 0.001f)
    }
}
