package com.music.raaga

import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.model.ShelfItem
import com.music.raaga.ui.screens.library.PlaylistFilter
import org.junit.Assert.assertEquals
import org.junit.Test

class FavoriteMusicTest {

    @Test
    fun `liked music browse id points to VLLM auto playlist`() {
        assertEquals("VLLM", YtMusicRepository.LIKED_MUSIC)
    }

    @Test
    fun `favorite music shelf item points to VLLM and has Favorite Music title`() {
        val item = ShelfItem(
            title = "Favorite Music",
            subtitle = "Auto playlist",
            thumbnailUrl = null,
            videoId = null,
            browseId = YtMusicRepository.LIKED_MUSIC,
        )
        assertEquals("Favorite Music", item.title)
        assertEquals("Auto playlist", item.subtitle)
        assertEquals("VLLM", item.browseId)
    }

    @Test
    fun `playlist filter favorites maps to expected resource`() {
        assertEquals(R.string.favorite_songs, PlaylistFilter.FAVORITES.labelRes)
    }

    @Test
    fun `playlist titles filter ignores both Liked Music and Favorite Music`() {
        val names = listOf("Liked Music", "liked music", "Favorite Songs", "Favorite Music", "My Chill Mix")
        val filtered = names.filter {
            !it.equals("Liked Music", ignoreCase = true) &&
            !it.equals("Favorite Songs", ignoreCase = true) &&
            !it.equals("Favorite Music", ignoreCase = true)
        }
        assertEquals(listOf("My Chill Mix"), filtered)
    }
}

