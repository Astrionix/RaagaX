package com.music.raaga.data.backup

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.music.raaga.data.settings.AppSettings

/**
 * Background worker triggered periodically by WorkManager to generate automated recovery points.
 */
class SmartBackupWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        // Respect user preference if disabled
        if (!AppSettings.smartBackupEnabled.value || AppSettings.backupFrequency.value == BackupFrequency.OFF) {
            return Result.success()
        }

        return try {
            val result = SmartBackupManager.createBackup(
                context = applicationContext,
                type = BackupType.AUTOMATIC,
            )
            if (result.isSuccess) {
                Result.success()
            } else {
                if (runAttemptCount < 3) Result.retry() else Result.failure()
            }
        } catch (t: Throwable) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}

