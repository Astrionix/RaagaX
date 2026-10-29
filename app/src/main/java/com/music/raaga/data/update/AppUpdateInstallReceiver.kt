package com.music.raaga.data.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import java.io.File

class AppUpdateInstallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_INSTALL_STATUS) return

        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val version = intent.getStringExtra(EXTRA_VERSION).orEmpty()
        val apkPath = intent.getStringExtra(EXTRA_APK_PATH)

        Log.d(TAG, "Install status received: $status for v$version")

        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirmIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_INTENT)
                }

                if (confirmIntent != null) {
                    confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    AppUpdateNotificationHelper.showPendingUserActionNotification(
                        context,
                        confirmIntent,
                        version,
                    )
                }
            }
            PackageInstaller.STATUS_SUCCESS -> {
                Log.i(TAG, "Package installed successfully for v$version")
                if (apkPath != null) {
                    runCatching { File(apkPath).delete() }
                }
                AppUpdateNotificationHelper.cancelUpdateNotification(context)
            }
            else -> {
                val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                Log.w(TAG, "Package install failed or cancelled ($status): $message")
                if (apkPath != null && File(apkPath).exists()) {
                    AppUpdateNotificationHelper.showUpdateReadyNotification(
                        context,
                        File(apkPath),
                        version,
                    )
                }
            }
        }
    }

    companion object {
        private const val TAG = "AppUpdateReceiver"
        const val ACTION_INSTALL_STATUS = "com.music.raaga.action.INSTALL_STATUS"
        const val EXTRA_VERSION = "extra_version"
        const val EXTRA_APK_PATH = "extra_apk_path"
    }
}
