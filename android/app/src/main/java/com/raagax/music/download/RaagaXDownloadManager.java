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
 *
 * Queue Architecture:
 *   addDownload(songId)
 *       ↓
 *   persist QUEUED in Room DB
 *       ↓
 *   WorkManager.enqueueUniqueWork()
 *       ↓
 *   DownloadWorker.doWork() → DOWNLOADING broadcasts → COMPLETED
 *       ↓
 *   processQueue() picks next QUEUED item automatically
 *
 * On startup: recoverStuckDownloads() re-enqueues any tasks that were
 * DOWNLOADING when the app was killed, so they resume safely.
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
        // Initialize and verify RaagaX directory tree (Songs, Artwork, Metadata) lazily
        StorageHelper.ensureDirectories(context);
        // Recover any downloads that were stuck DOWNLOADING on previous app session
        executor.execute(this::recoverStuckDownloads);
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
     *
     * Flow:
     *   [DownloadManager] addDownload(songId)
     *   [DownloadManager] job persisted
     *   [DownloadManager] WorkManager enqueued download_<songId>
     *   [DownloadWorker] started → DOWNLOADING broadcasts → COMPLETED
     */
    public void enqueueDownload(DownloadRequestItem request, Callback<Boolean> callback) {
        executor.execute(() -> {
            try {
                Log.d(TAG, "[DOWNLOAD] Button clicked");
                Log.d(TAG, "[DOWNLOAD] Song ID = " + request.songId);
                Log.d(TAG, "[DOWNLOAD] Source URL = " + (request.streamUrl != null ? request.streamUrl : "(dynamic resolve)"));

                if (request.songId == null || request.songId.isEmpty()) {
                    Log.e(TAG, "[DOWNLOAD] FAILED reason=Invalid song ID");
                    if (callback != null) callback.onResult(false, "Invalid song ID");
                    return;
                }

                // 1. Check if already downloaded and verified on disk
                DownloadEntity existing = database.downloadDao().getDownloadByTrackId(request.songId);
                if (existing != null && "COMPLETED".equals(existing.downloadState)) {
                    if (StorageHelper.verifyFileExists(existing.localPath)) {
                        Log.d(TAG, "[DOWNLOAD] Song " + request.songId + " already downloaded at " + existing.localPath);
                        if (callback != null) callback.onResult(true, null);
                        return;
                    } else {
                        // Stale record: physical file deleted externally — remove and re-download
                        Log.d(TAG, "[DOWNLOAD] Stale record for " + request.songId + ", removing and re-downloading");
                        database.downloadDao().deleteDownload(request.songId);
                    }
                }

                // 2. Storage space validation
                long available = StorageHelper.getAvailableStorageBytes(context);
                if (available < 15L * 1024 * 1024) {
                    String error = "Not enough storage. Required: 15 MB, Available: " + (available / (1024 * 1024)) + " MB";
                    Log.e(TAG, "[DOWNLOAD] FAILED reason=" + error);
                    if (callback != null) callback.onResult(false, error);
                    return;
                }

                // 3. Insert or update record in database as QUEUED
                String downloadId = "dl_" + System.currentTimeMillis() + "_" + request.songId;
                Log.d(TAG, "[DOWNLOAD] Job created (id=" + downloadId + ")");

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

                Log.d(TAG, "[DOWNLOAD] Job persisted to Room database");

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

                Log.d(TAG, "[DOWNLOAD] Queue processor started");
                workManager.enqueueUniqueWork(
                        "download_" + request.songId,
                        ExistingWorkPolicy.REPLACE,
                        workRequest
                );

                List<DownloadEntity> active = database.downloadDao().getActiveDownloads();
                Log.d(TAG, "[DOWNLOAD] Active jobs = " + active.size());

                if (callback != null) callback.onResult(true, null);
            } catch (Exception e) {
                Log.e(TAG, "[DOWNLOAD] FAILED reason=" + e.getMessage(), e);
                if (callback != null) callback.onResult(false, e.getMessage());
            }
        });
    }

    /**
     * Enqueue multiple songs for playlist download.
     * Song 1 → DOWNLOADING immediately (WorkManager scheduler picks it up).
     * Songs 2..N → QUEUED in WorkManager internal queue.
     */
    public void enqueuePlaylist(List<DownloadRequestItem> items, Callback<Integer> callback) {
        executor.execute(() -> {
            int queuedCount = 0;
            Log.d(TAG, "[DownloadManager] enqueuePlaylist() items=" + items.size());

            for (DownloadRequestItem item : items) {
                try {
                    DownloadEntity existing = database.downloadDao().getDownloadByTrackId(item.songId);
                    if (existing != null && "COMPLETED".equals(existing.downloadState) && StorageHelper.verifyFileExists(existing.localPath)) {
                        Log.d(TAG, "[DownloadManager] Playlist item " + item.songId + " already downloaded, skipping");
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

                    Log.d(TAG, "[DownloadManager] Playlist item enqueued: " + item.songId + " (position=" + (queuedCount + 1) + ")");
                    queuedCount++;
                } catch (Exception e) {
                    Log.e(TAG, "[DownloadManager] Failed to enqueue playlist item " + item.songId + ": " + e.getMessage());
                }
            }

            Log.d(TAG, "[DownloadManager] enqueuePlaylist() complete, queued=" + queuedCount + "/" + items.size());
            if (callback != null) callback.onResult(queuedCount, null);
        });
    }

    /**
     * Get all currently active (QUEUED, DOWNLOADING, VERIFYING, PAUSED, FAILED) download entries.
     * Used by the JS layer to reconcile task state after hydration or navigation.
     */
    public void getActiveDownloads(Callback<List<DownloadEntity>> callback) {
        executor.execute(() -> {
            try {
                List<DownloadEntity> active = database.downloadDao().getActiveDownloads();
                Log.d(TAG, "[DownloadManager] getActiveDownloads() returned " + active.size() + " entries");
                if (callback != null) callback.onResult(active, null);
            } catch (Exception e) {
                Log.e(TAG, "[DownloadManager] getActiveDownloads error: " + e.getMessage(), e);
                if (callback != null) callback.onResult(new ArrayList<>(), e.getMessage());
            }
        });
    }

    /**
     * Called on singleton construction to recover downloads that were stuck
     * in DOWNLOADING state from a previous app session (crash/kill).
     * WorkManager uses KEEP policy so genuinely running jobs are not replaced.
     */
    private void recoverStuckDownloads() {
        try {
            List<DownloadEntity> activeDownloads = database.downloadDao().getActiveDownloads();
            int recovered = 0;

            for (DownloadEntity entity : activeDownloads) {
                if ("DOWNLOADING".equals(entity.downloadState) || "VERIFYING".equals(entity.downloadState)) {
                    Log.d(TAG, "[DownloadManager] Recovering stuck download on startup: " + entity.trackId + " (was " + entity.downloadState + ")");

                    // Reset to QUEUED so the UI shows the correct state
                    database.downloadDao().updateState(entity.trackId, "QUEUED");

                    // Re-enqueue with KEEP policy — if WorkManager still has it running, this is a no-op
                    Data inputData = new Data.Builder()
                            .putString("trackId", entity.trackId)
                            .putString("streamUrl", "") // DownloadWorker will re-resolve via SaavnMusicProvider
                            .putString("title", entity.title != null ? entity.title : "")
                            .putString("artist", entity.artist != null ? entity.artist : "")
                            .putString("album", entity.album != null ? entity.album : "")
                            .putString("artworkUrl", entity.artwork != null ? entity.artwork : "")
                            .putString("quality", entity.quality != null ? entity.quality : "320 kbps")
                            .build();

                    Constraints constraints = new Constraints.Builder()
                            .setRequiredNetworkType(wifiOnly ? NetworkType.UNMETERED : NetworkType.CONNECTED)
                            .build();

                    OneTimeWorkRequest workRequest = new OneTimeWorkRequest.Builder(DownloadWorker.class)
                            .setInputData(inputData)
                            .setConstraints(constraints)
                            .addTag("download_" + entity.trackId)
                            .addTag("all_downloads")
                            .build();

                    workManager.enqueueUniqueWork(
                            "download_" + entity.trackId,
                            ExistingWorkPolicy.KEEP,
                            workRequest
                    );
                    recovered++;
                }
            }

            if (recovered > 0) {
                Log.d(TAG, "[DownloadManager] Recovered " + recovered + " stuck downloads on startup");
            }
        } catch (Exception e) {
            Log.e(TAG, "[DownloadManager] recoverStuckDownloads error: " + e.getMessage(), e);
        }
    }

    public void pauseDownload(String songId) {
        executor.execute(() -> {
            Log.d(TAG, "[DownloadManager] pauseDownload(songId=" + songId + ")");
            workManager.cancelUniqueWork("download_" + songId);
            database.downloadDao().updateState(songId, "PAUSED");
        });
    }

    public void resumeDownload(String songId) {
        executor.execute(() -> {
            Log.d(TAG, "[DownloadManager] resumeDownload(songId=" + songId + ")");
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
            Log.d(TAG, "[DownloadManager] cancelDownload(songId=" + songId + ")");
            workManager.cancelUniqueWork("download_" + songId);
            database.downloadDao().deleteDownload(songId);

            // Clean up any temporary files from Songs and base directories
            File songsDir = StorageHelper.getSongsDirectory(context);
            File tempRaw = new File(songsDir, ".tmp_raw_" + songId + ".mp3");
            if (tempRaw.exists()) tempRaw.delete();

            File baseDir = StorageHelper.getRaagaXMusicDirectory(context);
            File legacyTemp = new File(baseDir, ".tmp_raw_" + songId + ".mp3");
            if (legacyTemp.exists()) legacyTemp.delete();
        });
    }

    public void pauseAll() {
        executor.execute(() -> {
            List<DownloadEntity> active = database.downloadDao().getActiveDownloads();
            Log.d(TAG, "[DownloadManager] pauseAll() active=" + active.size());
            for (DownloadEntity entity : active) {
                workManager.cancelUniqueWork("download_" + entity.trackId);
                database.downloadDao().updateState(entity.trackId, "PAUSED");
            }
        });
    }

    public void resumeAll() {
        executor.execute(() -> {
            List<DownloadEntity> paused = database.downloadDao().getAllDownloads();
            Log.d(TAG, "[DownloadManager] resumeAll()");
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
            Log.d(TAG, "[DownloadManager] cancelAll()");
            workManager.cancelAllWorkByTag("all_downloads");
            database.downloadDao().clearAllDownloads();
        });
    }

    /**
     * Removes the physical MP3 from Music/RaagaX/Songs/ and removes the database download entry.
     * Keeps playlists intact!
     */
    public void removeDownload(String songId, Callback<Boolean> callback) {
        executor.execute(() -> {
            try {
                Log.d(TAG, "[DownloadManager] removeDownload(songId=" + songId + ")");
                DownloadEntity entity = database.downloadDao().getDownloadByTrackId(songId);
                if (entity != null && entity.localPath != null) {
                    File file = new File(entity.localPath);
                    if (file.exists()) {
                        boolean deleted = file.delete();
                        Log.d(TAG, "[DownloadManager] Deleted physical file at " + entity.localPath + ": " + deleted);
                        StorageHelper.scanMediaFile(context, file, null);
                    }
                }
                // Clean up cached artwork if exists
                File artFile = StorageHelper.getArtworkFile(context, songId);
                if (artFile != null && artFile.exists()) {
                    artFile.delete();
                }

                database.downloadDao().deleteDownload(songId);
                if (callback != null) callback.onResult(true, null);
            } catch (Exception e) {
                Log.e(TAG, "[DownloadManager] removeDownload error: " + e.getMessage(), e);
                if (callback != null) callback.onResult(false, e.getMessage());
            }
        });
    }

    /**
     * Physical Storage Sync & Auto-Import:
     * Scans the physical download folder for all existing audio files, auto-imports any files
     * not currently in the Room DB (extracting ID3 tags), prunes missing records, and returns
     * the complete verified list of offline songs.
     */
    public void verifyAndSyncLibrary(Callback<List<DownloadEntity>> callback) {
        executor.execute(() -> {
            try {
                List<DownloadEntity> allCompleted = database.downloadDao().getAllCompletedDownloads();
                java.util.Map<String, DownloadEntity> pathMap = new java.util.HashMap<>();
                java.util.Set<String> verifiedTrackIds = new java.util.HashSet<>();
                List<DownloadEntity> verifiedList = new ArrayList<>();

                for (DownloadEntity entity : allCompleted) {
                    if (entity.localPath != null) {
                        pathMap.put(entity.localPath, entity);
                    }
                }

                // 1. Scan physical storage for all actual audio files on disk
                List<File> physicalFiles = StorageHelper.getAllPhysicalAudioFiles(context);
                for (File file : physicalFiles) {
                    String absPath = file.getAbsolutePath();
                    DownloadEntity existing = pathMap.get(absPath);
                    if (existing != null) {
                        verifiedList.add(existing);
                        verifiedTrackIds.add(existing.trackId);
                    } else {
                        // Discover & auto-import physical file into Room DB
                        try {
                            android.media.MediaMetadataRetriever mmr = new android.media.MediaMetadataRetriever();
                            mmr.setDataSource(absPath);
                            String metaTitle = mmr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_TITLE);
                            String metaArtist = mmr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_ARTIST);
                            String metaAlbum = mmr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_ALBUM);
                            String durStr = mmr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION);
                            byte[] artBytes = mmr.getEmbeddedPicture();
                            mmr.release();

                            String rawName = file.getName();
                            int dotIdx = rawName.lastIndexOf('.');
                            if (dotIdx > 0) rawName = rawName.substring(0, dotIdx);

                            String title = (metaTitle != null && !metaTitle.trim().isEmpty()) ? metaTitle.trim() : rawName;
                            String artist = (metaArtist != null && !metaArtist.trim().isEmpty()) ? metaArtist.trim() : "Unknown Artist";
                            String album = (metaAlbum != null && !metaAlbum.trim().isEmpty()) ? metaAlbum.trim() : "RaagaX Offline";
                            long durationSec = 180;
                            if (durStr != null) {
                                try { durationSec = Long.parseLong(durStr) / 1000; } catch (Exception ignored) {}
                            }

                            // Generate stable track ID based on file path
                            String generatedId = "local_" + Math.abs(absPath.hashCode());
                            DownloadEntity imported = new DownloadEntity("dl_imp_" + generatedId, generatedId, "COMPLETED");
                            imported.title = title;
                            imported.artist = artist;
                            imported.album = album;
                            imported.localPath = absPath;
                            imported.fileName = file.getName();
                            imported.fileSize = file.length();
                            imported.duration = durationSec;
                            imported.completedAt = file.lastModified();

                            // Save extracted artwork if present
                            if (artBytes != null && artBytes.length > 0) {
                                File savedArt = StorageHelper.saveArtworkFile(context, generatedId, artBytes);
                                if (savedArt != null) {
                                    imported.artwork = "file://" + savedArt.getAbsolutePath();
                                }
                            }

                            database.downloadDao().insertOrUpdate(imported);
                            verifiedList.add(imported);
                            verifiedTrackIds.add(generatedId);
                            Log.d(TAG, "[DownloadManager] Auto-imported offline file: " + title + " (" + absPath + ")");
                        } catch (Exception ex) {
                            Log.w(TAG, "Failed to inspect offline file metadata for " + absPath + ": " + ex.getMessage());
                        }
                    }
                }

                // 2. Prune obsolete database entries where physical file no longer exists
                for (DownloadEntity entity : allCompleted) {
                    if (!verifiedTrackIds.contains(entity.trackId) && !StorageHelper.verifyFileExists(entity.localPath)) {
                        Log.d(TAG, "[DownloadManager] Pruning missing download record: " + entity.trackId + " (path: " + entity.localPath + ")");
                        database.downloadDao().deleteDownload(entity.trackId);
                    }
                }

                Log.d(TAG, "[DownloadManager] verifyAndSyncLibrary() final verified=" + verifiedList.size() + " songs found on disk");
                if (callback != null) callback.onResult(verifiedList, null);
            } catch (Exception e) {
                Log.e(TAG, "[DownloadManager] verifyAndSyncLibrary error: " + e.getMessage(), e);
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
                Log.e(TAG, "[DownloadManager] shareSongFile error: " + e.getMessage(), e);
                if (callback != null) callback.onResult(false, e.getMessage());
            }
        });
    }

    public interface Callback<T> {
        void onResult(T result, String error);
    }
}
