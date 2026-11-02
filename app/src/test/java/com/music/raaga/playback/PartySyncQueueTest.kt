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

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PartySyncQueueTest {

    @Test
    fun detectSingleRemoval_detectsRemovedItemInMiddle() {
        val oldList = listOf("song_1", "song_2", "song_3", "song_4")
        val newList = listOf("song_1", "song_2", "song_4")

        val removed = detectSingleRemoval(oldList, newList)
        assertEquals("song_3", removed)
    }

    @Test
    fun detectSingleRemoval_detectsRemovedItemAtStart() {
        val oldList = listOf("song_1", "song_2", "song_3")
        val newList = listOf("song_2", "song_3")

        val removed = detectSingleRemoval(oldList, newList)
        assertEquals("song_1", removed)
    }

    @Test
    fun detectSingleRemoval_detectsRemovedItemAtEnd() {
        val oldList = listOf("song_1", "song_2", "song_3")
        val newList = listOf("song_1", "song_2")

        val removed = detectSingleRemoval(oldList, newList)
        assertEquals("song_3", removed)
    }

    @Test
    fun detectSingleRemoval_returnsNullWhenMultipleItemsRemoved() {
        val oldList = listOf("song_1", "song_2", "song_3", "song_4")
        val newList = listOf("song_1", "song_4")

        val removed = detectSingleRemoval(oldList, newList)
        assertNull(removed)
    }

    @Test
    fun detectSingleRemoval_returnsNullWhenItemReordered() {
        val oldList = listOf("song_1", "song_2", "song_3")
        val newList = listOf("song_3", "song_1")

        val removed = detectSingleRemoval(oldList, newList)
        assertNull(removed)
    }

    @Test
    fun detectSingleRemoval_returnsNullWhenListsIdenticalOrEmpty() {
        assertNull(detectSingleRemoval(listOf("song_1"), listOf("song_1")))
        assertNull(detectSingleRemoval(emptyList(), emptyList()))
    }

    @Test
    fun detectSingleMove_detectsReorderedItem() {
        val oldList = listOf("song_1", "song_2", "song_3", "song_4")
        val newList = listOf("song_1", "song_4", "song_2", "song_3")

        val move = detectSingleMove(oldList, newList)
        assertEquals(3, move?.fromIndex)
        assertEquals(1, move?.toIndex)
        assertEquals("song_4", move?.videoId)
    }
}

