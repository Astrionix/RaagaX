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
     * Re-configures or cancels background periodic update checks based on user settings.
     */
    fun schedule(context: Context) {
        val enabled = AppSettings.autoUpdateEnabled.value
        val wifiOnly = AppSettings.autoUpdateWifiOnly.value

        val workManager = WorkManager.getInstance(context)

        if (!enabled) {
            workManager.cancelUniqueWork(UNIQUE_WORK_NAME)
            return
        }

        val networkType = if (wifiOnly) NetworkType.UNMETERED else NetworkType.CONNECTED

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(networkType)
            .setRequiresBatteryNotLow(true)
            .build()

        val request = PeriodicWorkRequestBuilder<AppUpdateWorker>(
            12L,
            TimeUnit.HOURS,
            2L,
            TimeUnit.HOURS,
        )
            .setConstraints(constraints)
            .build()

        workManager.enqueueUniquePeriodicWork(
            UNIQUE_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }
}
