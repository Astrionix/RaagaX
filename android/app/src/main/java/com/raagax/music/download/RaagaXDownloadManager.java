package com.raagax.music.download;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import androidx.core.content.FileProvider;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.db.entity.DownloadEntity;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * RaagaXDownloadManager — Centralized singleton for Android downloads.
 * Controls download queue, duplicate prevention, physical file verification,
 * storage validation, background WorkManager jobs, and external file reconciliation.
 */
public class RaagaXDownloadManager {
    private static final String TAG = "RaagaXDownloadManager";
    private static volatile RaagaXDownloadManager INSTANCE;

    private final Context context;
    private final RaagaXDatabase database;
    private final WorkManager workManager;
    private final ExecutorService executor;
    private boolean wifiOnly = false;

    public static RaagaXDownloadManager getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (RaagaXDownloadManager.class) {
                if (INSTANCE == null) {
                    INSTANCE = new RaagaXDownloadManager(context.getApplicationContext());
                }
            }
        }
        return INSTANCE;
    }

    private RaagaXDownloadManager(Context context) {
        this.context = context;
        this.database = RaagaXDatabase.getInstance(context);
        this.workManager = WorkManager.getInstance(context);
        this.executor = Executors.newSingleThreadExecutor();
    }

    public void setWifiOnly(boolean wifiOnly) {
        this.wifiOnly = wifiOnly;
    }

    public boolean isWifiOnly() {
        return this.wifiOnly;
    }

    public static class DownloadRequestItem {
        public String songId;
        public String title;
        public String artist;
        public String album;
        public String artworkUrl;
        public String streamUrl;
        public String quality;
        public long duration;
        public String source;
        public String playlistId;

        public DownloadRequestItem(String songId, String title, String artist, String album, String artworkUrl, String streamUrl, String quality) {
            this.songId = songId;
            this.title = title;
            this.artist = artist;
            this.album = album;
            this.artworkUrl = artworkUrl;
            this.streamUrl = streamUrl;
            this.quality = quality != null ? quality : "320 kbps";
            this.source = "jiosaavn";
        }
    }

    /**
     * Enqueue a single song download with duplicate and storage checks.
     */
    public void enqueueDownload(DownloadRequestItem request, Callback<Boolean> callback) {
        executor.execute(() -> {
            try {
                if (request.songId == null || request.songId.isEmpty()) {
                    if (callback != null) callback.onResult(false, "Invalid song ID");
                    return;
                }

                // 1. Check if already downloaded and verified on disk
                DownloadEntity existing = database.downloadDao().getDownloadByTrackId(request.songId);
                if (existing != null && "COMPLETED".equals(existing.downloadState)) {
                    if (StorageHelper.verifyFileExists(existing.localPath)) {
                        Log.d(TAG, "Song " + request.songId + " is already downloaded and verified on disk at " + existing.localPath);
                        if (callback != null) callback.onResult(true, null);
                        return;
                    } else {
                        // Stale record: physical file was deleted externally, remove and re-download
                        database.downloadDao().deleteDownload(request.songId);
                    }
                }

                // 2. Storage space validation
                long available = StorageHelper.getAvailableStorageBytes(context);
                if (available < 15L * 1024 * 1024) {
                    String error = "Not enough storage. Required: 15 MB, Available: " + (available / (1024 * 1024)) + " MB";
                    if (callback != null) callback.onResult(false, error);
                    return;
                }

                // 3. Insert or update record in database
                String downloadId = "dl_" + System.currentTimeMillis() + "_" + request.songId;
                DownloadEntity entity = new DownloadEntity(downloadId, request.songId, "QUEUED");
                entity.title = request.title;
                entity.artist = request.artist;
                entity.album = request.album;
                entity.artwork = request.artworkUrl;
                entity.quality = request.quality != null ? request.quality : "320 kbps";
                entity.duration = request.duration;
                entity.source = request.source != null ? request.source : "jiosaavn";
                entity.fileName = StorageHelper.generateSafeFileName(request.title, request.artist);
                database.downloadDao().insertOrUpdate(entity);

                // 4. Build WorkManager Request
                Data inputData = new Data.Builder()
                        .putString("trackId", request.songId)
                        .putString("streamUrl", request.streamUrl)
                        .putString("title", request.title)
                        .putString("artist", request.artist)
                        .putString("album", request.album)
                        .putString("artworkUrl", request.artworkUrl)
                        .putString("quality", request.quality)
                        .build();

                Constraints.Builder constraintsBuilder = new Constraints.Builder()
                        .setRequiredNetworkType(wifiOnly ? NetworkType.UNMETERED : NetworkType.CONNECTED);

                OneTimeWorkRequest workRequest = new OneTimeWorkRequest.Builder(DownloadWorker.class)
                        .setInputData(inputData)
                        .setConstraints(constraintsBuilder.build())
                        .addTag("download_" + request.songId)
                        .addTag("all_downloads")
                        .build();

                workManager.enqueueUniqueWork(
                        "download_" + request.songId,
                        ExistingWorkPolicy.REPLACE,
                        workRequest
                );

                if (callback != null) callback.onResult(true, null);
            } catch (Exception e) {
                Log.e(TAG, "Error enqueuing download: " + e.getMessage(), e);
                if (callback != null) callback.onResult(false, e.getMessage());
            }
        });
    }

    /**
     * Enqueue multiple songs for playlist download.
     */
    public void enqueuePlaylist(List<DownloadRequestItem> items, Callback<Integer> callback) {
        executor.execute(() -> {
            int queuedCount = 0;
            for (DownloadRequestItem item : items) {
                try {
                    DownloadEntity existing = database.downloadDao().getDownloadByTrackId(item.songId);
                    if (existing != null && "COMPLETED".equals(existing.downloadState) && StorageHelper.verifyFileExists(existing.localPath)) {
                        continue; // Skip already downloaded songs
                    }

                    String downloadId = "dl_" + System.currentTimeMillis() + "_" + item.songId;
                    DownloadEntity entity = new DownloadEntity(downloadId, item.songId, "QUEUED");
                    entity.title = item.title;
                    entity.artist = item.artist;
                    entity.album = item.album;
                    entity.artwork = item.artworkUrl;
                    entity.quality = item.quality != null ? item.quality : "320 kbps";
                    entity.duration = item.duration;
                    entity.source = item.source != null ? item.source : "jiosaavn";
                    entity.fileName = StorageHelper.generateSafeFileName(item.title, item.artist);
                    database.downloadDao().insertOrUpdate(entity);

                    Data inputData = new Data.Builder()
                            .putString("trackId", item.songId)
                            .putString("streamUrl", item.streamUrl)
                            .putString("title", item.title)
                            .putString("artist", item.artist)
                            .putString("album", item.album)
                            .putString("artworkUrl", item.artworkUrl)
                            .putString("quality", item.quality)
                            .build();

                    Constraints constraints = new Constraints.Builder()
                            .setRequiredNetworkType(wifiOnly ? NetworkType.UNMETERED : NetworkType.CONNECTED)
                            .build();

                    OneTimeWorkRequest workRequest = new OneTimeWorkRequest.Builder(DownloadWorker.class)
                            .setInputData(inputData)
                            .setConstraints(constraints)
                            .addTag("download_" + item.songId)
                            .addTag("all_downloads")
                            .build();

                    workManager.enqueueUniqueWork(
                            "download_" + item.songId,
                            ExistingWorkPolicy.KEEP,
                            workRequest
                    );
                    queuedCount++;
                } catch (Exception e) {
                    Log.e(TAG, "Failed to enqueue playlist item " + item.songId + ": " + e.getMessage());
                }
            }

            if (callback != null) callback.onResult(queuedCount, null);
        });
    }

    public void pauseDownload(String songId) {
        executor.execute(() -> {
            workManager.cancelUniqueWork("download_" + songId);
            database.downloadDao().updateState(songId, "PAUSED");
            Log.d(TAG, "Paused download for " + songId);
        });
    }

    public void resumeDownload(String songId) {
        executor.execute(() -> {
            DownloadEntity entity = database.downloadDao().getDownloadByTrackId(songId);
            if (entity != null) {
                DownloadRequestItem item = new DownloadRequestItem(
                        entity.trackId,
                        entity.title,
                        entity.artist,
                        entity.album,
                        entity.artwork,
                        null,
                        entity.quality
                );
                enqueueDownload(item, null);
            }
        });
    }

    public void cancelDownload(String songId) {
        executor.execute(() -> {
            workManager.cancelUniqueWork("download_" + songId);
            database.downloadDao().deleteDownload(songId);

            // Clean up any temporary files
            File targetDir = StorageHelper.getRaagaXMusicDirectory(context);
            File tempRaw = new File(targetDir, ".tmp_raw_" + songId + ".mp3");
            if (tempRaw.exists()) tempRaw.delete();

            Log.d(TAG, "Cancelled download and cleaned temp files for " + songId);
        });
    }

    public void pauseAll() {
        executor.execute(() -> {
            List<DownloadEntity> active = database.downloadDao().getActiveDownloads();
            for (DownloadEntity entity : active) {
                workManager.cancelUniqueWork("download_" + entity.trackId);
                database.downloadDao().updateState(entity.trackId, "PAUSED");
            }
            Log.d(TAG, "Paused all active downloads (" + active.size() + ")");
        });
    }

    public void resumeAll() {
        executor.execute(() -> {
            List<DownloadEntity> paused = database.downloadDao().getAllDownloads();
            for (DownloadEntity entity : paused) {
                if ("PAUSED".equals(entity.downloadState) || "FAILED".equals(entity.downloadState)) {
                    DownloadRequestItem item = new DownloadRequestItem(
                            entity.trackId,
                            entity.title,
                            entity.artist,
                            entity.album,
                            entity.artwork,
                            null,
                            entity.quality
                    );
                    enqueueDownload(item, null);
                }
            }
        });
    }

    public void cancelAll() {
        executor.execute(() -> {
            workManager.cancelAllWorkByTag("all_downloads");
            database.downloadDao().clearAllDownloads();
            Log.d(TAG, "Cancelled all downloads and cleared queue");
        });
    }

    /**
     * Removes the physical MP3 from Music/RaagaX/ and removes the database download entry.
     * Keeps playlists intact!
     */
    public void removeDownload(String songId, Callback<Boolean> callback) {
        executor.execute(() -> {
            try {
                DownloadEntity entity = database.downloadDao().getDownloadByTrackId(songId);
                if (entity != null && entity.localPath != null) {
                    File file = new File(entity.localPath);
                    if (file.exists()) {
                        boolean deleted = file.delete();
                        Log.d(TAG, "Deleted physical file at " + entity.localPath + ": " + deleted);
                        StorageHelper.scanMediaFile(context, file, null);
                    }
                }
                database.downloadDao().deleteDownload(songId);
                if (callback != null) callback.onResult(true, null);
            } catch (Exception e) {
                Log.e(TAG, "Error removing download: " + e.getMessage(), e);
                if (callback != null) callback.onResult(false, e.getMessage());
            }
        });
    }

    /**
     * Anti-Stale Sync: Verifies physical file existence for all completed downloads.
     * Prunes database entries where the MP3 was deleted externally by the user via Android File Manager.
     */
    public void verifyAndSyncLibrary(Callback<List<DownloadEntity>> callback) {
        executor.execute(() -> {
            try {
                List<DownloadEntity> allCompleted = database.downloadDao().getAllCompletedDownloads();
                List<DownloadEntity> verifiedList = new ArrayList<>();

                for (DownloadEntity entity : allCompleted) {
                    if (StorageHelper.verifyFileExists(entity.localPath)) {
                        verifiedList.add(entity);
                    } else {
                        Log.d(TAG, "Pruning missing/externally deleted download record: " + entity.trackId + " (path: " + entity.localPath + ")");
                        database.downloadDao().deleteDownload(entity.trackId);
                    }
                }

                if (callback != null) callback.onResult(verifiedList, null);
            } catch (Exception e) {
                Log.e(TAG, "Error verifying library: " + e.getMessage(), e);
                if (callback != null) callback.onResult(new ArrayList<>(), e.getMessage());
            }
        });
    }

    /**
     * Share the physical downloaded MP3 file using Android system share sheet.
     */
    public void shareSongFile(Activity activity, String songId, Callback<Boolean> callback) {
        executor.execute(() -> {
            try {
                DownloadEntity entity = database.downloadDao().getDownloadByTrackId(songId);
                if (entity == null || entity.localPath == null || !StorageHelper.verifyFileExists(entity.localPath)) {
                    if (callback != null) callback.onResult(false, "Song is not downloaded on this device");
                    return;
                }

                File file = new File(entity.localPath);
                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        file
                );

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("audio/mpeg");
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.putExtra(Intent.EXTRA_TITLE, entity.title + " - " + entity.artist);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                activity.runOnUiThread(() -> {
                    activity.startActivity(Intent.createChooser(shareIntent, "Share MP3 — " + entity.title));
                });

                if (callback != null) callback.onResult(true, null);
            } catch (Exception e) {
                Log.e(TAG, "Failed to share song file: " + e.getMessage(), e);
                if (callback != null) callback.onResult(false, e.getMessage());
            }
        });
    }

    public interface Callback<T> {
        void onResult(T result, String error);
    }
}
