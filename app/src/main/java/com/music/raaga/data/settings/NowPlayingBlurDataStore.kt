package com.music.raaga.data.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private val Context.nowPlayingDataStore: DataStore<Preferences> by preferencesDataStore(name = "raaga_now_playing_prefs")

/**
 * Persists the user's selected Now Playing background blur mode using AndroidX DataStore Preferences.
 */
object NowPlayingBlurDataStore {

    val KEY_BLUR_STYLE = stringPreferencesKey("now_playing_blur_style")

    private var appContext: Context? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    /**
     * Flow emitting the currently persisted [NowPlayingBlurStyle] from DataStore.
     */
    fun blurStyleFlow(): Flow<NowPlayingBlurStyle>? {
        return appContext?.nowPlayingDataStore?.data?.map { preferences ->
            val key = preferences[KEY_BLUR_STYLE]
            NowPlayingBlurStyle.fromKey(key)
        }
    }

    /**
     * Asynchronously writes the chosen blur style to DataStore.
     */
    fun persistBlurStyle(style: NowPlayingBlurStyle) {
        val ctx = appContext ?: return
        scope.launch {
            runCatching {
                ctx.nowPlayingDataStore.edit { preferences ->
                    preferences[KEY_BLUR_STYLE] = style.key
                }
            }
        }
    }
}

