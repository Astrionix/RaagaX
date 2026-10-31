package com.music.raaga.data.update

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.music.raaga.data.settings.AppSettings
import java.util.concurrent.TimeUnit

object AutoUpdateScheduler {

    private const val UNIQUE_WORK_NAME = "raaga_auto_update_work"

    /**
     * Auto-update background worker scheduling is disabled.
     * Cancels any previously scheduled background update work.
     */
    fun schedule(context: Context) {
        val workManager = WorkManager.getInstance(context)
        workManager.cancelUniqueWork(UNIQUE_WORK_NAME)
    }
}
