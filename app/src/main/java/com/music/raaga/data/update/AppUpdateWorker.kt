package com.music.raaga.data.update

import android.content.Context
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
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
        val wifiEnabled = AppSettings.autoUpdateWifi.value
        val cellularEnabled = AppSettings.autoUpdateCellular.value

        if (!wifiEnabled && !cellularEnabled) {
            Log.d(TAG, "Automatic updates disabled on both Wi-Fi and Cellular; skipping check.")
            return Result.success()
        }

        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val activeNetwork = connectivityManager?.activeNetwork
        val caps = connectivityManager?.getNetworkCapabilities(activeNetwork)
        val isMetered = connectivityManager?.isActiveNetworkMetered == true
        val hasWifiTransport = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true ||
                caps?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true
        val hasCellularTransport = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true

        val isWifi = hasWifiTransport || (!isMetered && !hasCellularTransport)
        val isCellular = hasCellularTransport || (isMetered && !hasWifiTransport)

        if (isWifi && !wifiEnabled) {
            Log.d(TAG, "Connected via Wi-Fi but Wi-Fi auto-updates are disabled; skipping.")
            return Result.success()
        }
        if (isCellular && !cellularEnabled) {
            Log.d(TAG, "Connected via Cellular but Cellular auto-updates are disabled; skipping.")
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
