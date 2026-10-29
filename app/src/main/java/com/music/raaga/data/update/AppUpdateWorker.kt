package com.music.raaga.data.update

import android.content.Context
import android.media.AudioManager
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.music.raaga.data.AppUpdateChecker
import com.music.raaga.data.settings.AppSettings

class AppUpdateWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        if (!AppSettings.autoUpdateEnabled.value) {
            Log.d(TAG, "Automatic updates disabled in settings; skipping check.")
            return Result.success()
        }

        Log.d(TAG, "Running periodic auto-update check in background...")
        val checkResult = AppUpdateChecker.check(force = false)
        if (checkResult !is AppUpdateChecker.CheckResult.UpdateAvailable) {
            Log.d(TAG, "App is already up to date.")
            return Result.success()
        }

        val info = checkResult.info
        Log.i(TAG, "New update available: v${info.version}. Starting silent download...")

        val apkFile = AppUpdateChecker.downloadApk(context, info)
        if (apkFile == null || !apkFile.exists() || apkFile.length() == 0L) {
            Log.w(TAG, "Background update download failed.")
            return Result.retry()
        }

        Log.i(TAG, "Update APK downloaded successfully (${apkFile.length()} bytes).")

        // If user is actively playing music, don't interrupt audio; post ready notification
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val isMusicActive = audioManager?.isMusicActive == true

        if (isMusicActive) {
            Log.i(TAG, "Music playback active. Deferring silent install and displaying notification.")
            AppUpdateNotificationHelper.showUpdateReadyNotification(context, apkFile, info.version)
            return Result.success()
        }

        // Attempt silent install if on Android 12+ and permission is granted
        val silentSessionStarted = AppUpdateChecker.silentInstallApk(context, apkFile, info.version)
        if (!silentSessionStarted) {
            Log.i(TAG, "Silent install session not started; posting update ready notification.")
            AppUpdateNotificationHelper.showUpdateReadyNotification(context, apkFile, info.version)
        }

        return Result.success()
    }

    companion object {
        private const val TAG = "AppUpdateWorker"
    }
}
