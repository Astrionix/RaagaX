package com.music.raaga.data

import android.os.SystemClock

/**
 * Milliseconds on a monotonic clock on Android.
 * Uses SystemClock.elapsedRealtime(), which keeps counting through deep sleep.
 */
object MonotonicClock {
    @Volatile
    var nowMs: () -> Long = { SystemClock.elapsedRealtime() }
}
