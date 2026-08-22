package com.raagax.music.download;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.offline.Download;
import androidx.media3.exoplayer.offline.DownloadManager;
import androidx.media3.exoplayer.offline.DownloadNotificationHelper;
import androidx.media3.exoplayer.offline.DownloadService;
import androidx.media3.exoplayer.scheduler.PlatformScheduler;
import androidx.media3.exoplayer.scheduler.Scheduler;
import com.raagax.music.R;
import java.util.List;

@OptIn(markerClass = UnstableApi.class)
public class RaagaXDownloadService extends DownloadService {

    private static final String TAG = "RaagaXDownloadService";
    public static final String CHANNEL_ID = "raagax_download_channel";
    public static final int JOB_ID = 2001;
    public static final int FOREGROUND_NOTIFICATION_ID = 2002;

    private DownloadNotificationHelper notificationHelper;

    public RaagaXDownloadService() {
        super(
                FOREGROUND_NOTIFICATION_ID,
                DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL,
                CHANNEL_ID,
                R.string.app_name,
                /* channelDescriptionResourceId= */ 0
        );
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        try {
            notificationHelper = new DownloadNotificationHelper(this, CHANNEL_ID);
        } catch (Exception e) {
            Log.w(TAG, "DownloadNotificationHelper init notice: " + e.getMessage());
        }
        Log.d(TAG, "[DOWNLOAD_SERVICE_READY]");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : "null";
        Log.d(TAG, "[DOWNLOAD_SERVICE_START] action=" + action + " startId=" + startId);
        try {
            return super.onStartCommand(intent, flags, startId);
        } catch (Exception e) {
            Log.e(TAG, "RaagaXDownloadService onStartCommand safe catch: " + e.getMessage(), e);
            return START_NOT_STICKY;
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "[DOWNLOAD_SERVICE_STOP]");
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "RaagaX Downloads",
                        NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Background downloads for offline listening");
                channel.setShowBadge(false);
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) {
                    nm.createNotificationChannel(channel);
                }
            } catch (Exception e) {
                Log.w(TAG, "createNotificationChannel notice: " + e.getMessage());
            }
        }
    }

    @NonNull
    @Override
    protected DownloadManager getDownloadManager() {
        return Media3DownloadHelper.getDownloadManager(this);
    }

    @Nullable
    @Override
    protected Scheduler getScheduler() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                return new PlatformScheduler(this, JOB_ID);
            }
        } catch (Exception e) {
            Log.w(TAG, "PlatformScheduler init notice: " + e.getMessage());
        }
        return null;
    }

    @NonNull
    @Override
    protected Notification getForegroundNotification(@NonNull List<Download> downloads, int notMetRequirements) {
        try {
            if (notificationHelper != null && downloads != null && !downloads.isEmpty()) {
                return notificationHelper.buildProgressNotification(
                        this,
                        android.R.drawable.stat_sys_download,
                        /* contentIntent= */ null,
                        /* message= */ null,
                        downloads,
                        notMetRequirements
                );
            }
        } catch (Exception e) {
            Log.w(TAG, "buildProgressNotification fallback notice: " + e.getMessage());
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("RaagaX Offline")
                .setContentText("Downloading music...")
                .setOngoing(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }
}
