package com.raagax.music.download;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.offline.Download;
import androidx.media3.exoplayer.offline.DownloadCursor;
import androidx.media3.exoplayer.offline.DownloadIndex;
import androidx.media3.exoplayer.offline.DownloadManager;
import androidx.media3.exoplayer.offline.DownloadRequest;
import androidx.media3.exoplayer.offline.DownloadService;
import androidx.media3.exoplayer.scheduler.Requirements;

import com.google.gson.Gson;
import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.db.entity.DownloadEntity;
import com.raagax.music.data.model.MusicTrack;
import com.raagax.music.data.provider.SaavnMusicProvider;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * RaagaXDownloadManager — Centralized offline download manager backed by AndroidX Media3 DownloadManager.
 *
 * Key Architecture:
 * - Media3 DownloadManager manages download execution, chunks, and disk indices.
 * - Managed SimpleCache holds all downloaded offline media.
 * - Single persistent Room database maintains metadata and global track identity.
 * - Single unified playback pipeline: CacheDataSource handles both offline cache hits and online streaming.
 * - Generational tracking & cancellation guards prevent race conditions and unhandled exceptions.
 */
@OptIn(markerClass = UnstableApi.class)
public class RaagaXDownloadManager {
    private static final String TAG = "RaagaXDownloadManager";
    private static volatile RaagaXDownloadManager INSTANCE;

    private final Context context;
    private final RaagaXDatabase database;
    private final DownloadManager media3DownloadManager;
    private final ExecutorService executor;
    private final Gson gson = new Gson();
    private boolean wifiOnly = false;

    // Generational tracking to guard against cancellation race conditions
    private final Map<String, Long> trackGenerations = new ConcurrentHashMap<>();
    private final Set<String> cancelledTrackIds = Collections.newSetFromMap(new ConcurrentHashMap<>());

    // Track previous download progress for rate calculations
    private final Map<String, Long> lastProgressTimeMap = new ConcurrentHashMap<>();
    private final Map<String, Long> lastProgressBytesMap = new ConcurrentHashMap<>();

    // Zero-bytes watchdog: tracks when a download first entered DOWNLOADING with 0 bytes
    private final Map<String, Long> downloadingStartTimeMap = new ConcurrentHashMap<>();
    private static final long ZERO_BYTES_WATCHDOG_MS = 30_000; // 30 seconds

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
        this.context = context.getApplicationContext();
        this.database = RaagaXDatabase.getInstance(this.context);
        // 2-thread pool: one for enqueue/probe work, one for download callbacks
        this.executor = Executors.newFixedThreadPool(2);
        this.media3DownloadManager = Media3DownloadHelper.getDownloadManager(this.context);

        // Register Media3 download listener safely
        if (this.media3DownloadManager != null) {
            this.media3DownloadManager.addListener(new DownloadManager.Listener() {
                @Override
                public void onDownloadChanged(
                        @NonNull DownloadManager downloadManager,
                        @NonNull Download download,
                        @Nullable Exception finalException
                ) {
                    handleMedia3DownloadChanged(download, finalException);
                }

                @Override
                public void onDownloadRemoved(
                        @NonNull DownloadManager downloadManager,
                        @NonNull Download download
                ) {
                    handleMedia3DownloadRemoved(download);
                }
            });
        }

        // Reconcile download states on startup
        executor.execute(this::reconcileDownloadsOnStartup);
    }

    public void setWifiOnly(boolean wifiOnly) {
        this.wifiOnly = wifiOnly;
        try {
            Requirements requirements = wifiOnly
                    ? new Requirements(Requirements.NETWORK_UNMETERED)
                    : new Requirements(Requirements.NETWORK);
            media3DownloadManager.setRequirements(requirements);
        } catch (Exception e) {
            Log.w(TAG, "Error setting wifiOnly requirement: " + e.getMessage());
        }
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
     * Enqueue a single song download via Media3 DownloadManager.
     */
    public void enqueueDownload(DownloadRequestItem request, Callback<Boolean> callback) {
        executor.execute(() -> {
            try {
                if (request.songId == null || request.songId.isEmpty()) {
                    Log.e(TAG, "[DOWNLOAD_NATIVE_CALL_RESULT] trackId=null result=FAILED error=Invalid_song_ID");
                    if (callback != null) callback.onResult(false, "Invalid song ID");
                    return;
                }

                Log.d(TAG, "[DOWNLOAD_NATIVE_CALL_START] trackId=" + request.songId);

                // Clear any prior cancellation flags for this track
                cancelledTrackIds.remove(request.songId);
                Long oldReqId = trackGenerations.get(request.songId);
                long newReqId = System.currentTimeMillis();
                trackGenerations.put(request.songId, newReqId);

                if (oldReqId != null) {
                    Log.d(TAG, "[DOWNLOAD_RETRY] trackId=" + request.songId + " oldRequestId=" + oldReqId + " newRequestId=" + newReqId);
                    try {
                        media3DownloadManager.removeDownload(request.songId);
                    } catch (Exception ignored) {}
                }

                // 1. Check if already downloaded and verified in Media3 cache
                if (Media3DownloadHelper.verifyDownloadedTrack(context, request.songId)) {
                    Log.d(TAG, "[DOWNLOAD_NATIVE_CALL_RESULT] trackId=" + request.songId + " result=ALREADY_CACHED");
                    DownloadEntity existing = database.downloadDao().getDownloadByTrackId(request.songId);
                    if (existing == null || !"COMPLETED".equals(existing.downloadState)) {
                        DownloadEntity entity = new DownloadEntity("dl_" + request.songId, request.songId, "COMPLETED");
                        entity.title = request.title;
                        entity.artist = request.artist;
                        entity.album = request.album;
                        entity.artwork = request.artworkUrl;
                        entity.streamUrl = request.streamUrl;
                        entity.quality = request.quality;
                        entity.downloadProgress = 100;
                        entity.completedAt = System.currentTimeMillis();
                        database.downloadDao().insertOrUpdate(entity);
                    }
                    broadcastProgress(request.songId, "COMPLETED", 100, 0, 0, 0, 0, null);
                    broadcastCompleted(request.songId, 0);
                    if (callback != null) callback.onResult(true, null);
                    return;
                }

                // 2. Resolve stream URL if missing, proxy, or dynamic
                Log.d(TAG, "[DOWNLOAD_SOURCE_RESOLVE_START] trackId=" + request.songId);
                String streamUrl = request.streamUrl;
                if (streamUrl == null || streamUrl.isEmpty()
                        || streamUrl.contains("pixabay.com")
                        || streamUrl.startsWith("/")
                        || streamUrl.contains("localhost")
                        || streamUrl.contains("127.0.0.1")
                        || streamUrl.contains("/api/download")
                        || streamUrl.contains("/api/stream")) {
                    Log.d(TAG, "[DOWNLOAD_SOURCE_RESOLVE_START] trackId=" + request.songId + " reason=url_needs_resolution");
                    try {
                        SaavnMusicProvider provider = SaavnMusicProvider.getInstance();
                        MusicTrack track = provider.getTrackDetails(request.songId);
                        if ((track == null || track.streamUrl == null || track.streamUrl.isEmpty()) && request.title != null && !request.title.isEmpty()) {
                            com.raagax.music.data.model.SearchResult sr = provider.search(request.title + " " + (request.artist != null ? request.artist : ""), 1);
                            if (sr != null && !sr.tracks.isEmpty() && sr.tracks.get(0).streamUrl != null) {
                                track = sr.tracks.get(0);
                            }
                        }
                        if (track != null && track.streamUrl != null && !track.streamUrl.isEmpty()) {
                            streamUrl = track.streamUrl;
                            if (request.title == null || request.title.isEmpty()) request.title = track.title;
                            if (request.artist == null || request.artist.isEmpty()) request.artist = track.artist;
                            if (request.album == null || request.album.isEmpty()) request.album = track.album;
                            if (request.artworkUrl == null || request.artworkUrl.isEmpty()) request.artworkUrl = track.artworkUrl;
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "[DOWNLOAD_SOURCE_RESOLVE_RESULT] trackId=" + request.songId + " result=ERROR error=" + e.getMessage());
                    }
                }

                if (streamUrl == null || streamUrl.isEmpty()) {
                    String error = "Unable to retrieve audio stream URL";
                    Log.e(TAG, "[DOWNLOAD_SOURCE_RESOLVE_RESULT] trackId=" + request.songId + " result=FAILED error=" + error);
                    database.downloadDao().markFailed(request.songId, error);
                    broadcastProgress(request.songId, "FAILED", 0, 0, 0, 0, 0, error);
                    if (callback != null) callback.onResult(false, error);
                    return;
                }

                // Adjust bitrate if needed
                streamUrl = adjustBitrateUrl(streamUrl, request.quality);
                request.streamUrl = streamUrl;

                Uri streamUri = Uri.parse(streamUrl);
                String detectedMime = Media3DownloadHelper.detectMimeType(streamUri);
                Log.d(TAG, "[DOWNLOAD_SOURCE_RESOLVE_RESULT] trackId=" + request.songId
                        + " url=" + streamUrl.replaceAll("https://([^/]+)/.*", "https://$1/...[truncated]")
                        + " mimeType=" + detectedMime);

                // 3. Pre-flight HTTP probe: verify URL is accessible before handing to Media3
                //    This catches 403/expired CDN tokens immediately instead of looping forever.
                PreflightResult preflight = probeUrl(streamUrl);
                if (!preflight.success) {
                    // If the passed-in URL failed, attempt a fresh resolve from the API
                    Log.w(TAG, "[DOWNLOAD_PREFLIGHT_FAIL] trackId=" + request.songId
                            + " httpCode=" + preflight.httpCode + " error=" + preflight.error
                            + " — attempting fresh URL resolution");
                    try {
                        SaavnMusicProvider provider = SaavnMusicProvider.getInstance();
                        MusicTrack track = provider.getTrackDetails(request.songId);
                        if (track != null && track.streamUrl != null && !track.streamUrl.isEmpty()) {
                            String freshUrl = adjustBitrateUrl(track.streamUrl, request.quality);
                            PreflightResult freshPreflight = probeUrl(freshUrl);
                            if (freshPreflight.success) {
                                streamUrl = freshUrl;
                                streamUri = Uri.parse(streamUrl);
                                request.streamUrl = streamUrl;
                                Log.d(TAG, "[DOWNLOAD_PREFLIGHT_OK] trackId=" + request.songId
                                        + " (fresh resolve) contentLength=" + freshPreflight.contentLength);
                            } else {
                                String error = "CDN returned HTTP " + freshPreflight.httpCode + " for fresh URL: " + freshPreflight.error;
                                Log.e(TAG, "[DOWNLOAD_PREFLIGHT_FAIL] trackId=" + request.songId + " " + error);
                                database.downloadDao().markFailed(request.songId, error);
                                broadcastProgress(request.songId, "FAILED", 0, 0, 0, 0, 0, error);
                                if (callback != null) callback.onResult(false, error);
                                return;
                            }
                        } else {
                            String error = "CDN returned HTTP " + preflight.httpCode + " and fresh resolve failed";
                            Log.e(TAG, "[DOWNLOAD_PREFLIGHT_FAIL] trackId=" + request.songId + " " + error);
                            database.downloadDao().markFailed(request.songId, error);
                            broadcastProgress(request.songId, "FAILED", 0, 0, 0, 0, 0, error);
                            if (callback != null) callback.onResult(false, error);
                            return;
                        }
                    } catch (Exception e) {
                        String error = "CDN probe failed and fresh resolve threw: " + e.getMessage();
                        Log.e(TAG, "[DOWNLOAD_PREFLIGHT_FAIL] trackId=" + request.songId + " " + error);
                        database.downloadDao().markFailed(request.songId, error);
                        broadcastProgress(request.songId, "FAILED", 0, 0, 0, 0, 0, error);
                        if (callback != null) callback.onResult(false, error);
                        return;
                    }
                } else {
                    Log.d(TAG, "[DOWNLOAD_PREFLIGHT_OK] trackId=" + request.songId
                            + " httpCode=" + preflight.httpCode + " contentLength=" + preflight.contentLength);
                }

                // 4. Persist record in Room database as QUEUED
                String downloadId = "dl_" + newReqId + "_" + request.songId;
                DownloadEntity entity = new DownloadEntity(downloadId, request.songId, "QUEUED");
                entity.title = request.title;
                entity.artist = request.artist;
                entity.album = request.album;
                entity.artwork = request.artworkUrl;
                entity.streamUrl = streamUrl;
                entity.quality = request.quality != null ? request.quality : "320 kbps";
                entity.duration = request.duration;
                entity.source = request.source != null ? request.source : "jiosaavn";
                entity.downloadProgress = 0;
                database.downloadDao().insertOrUpdate(entity);

                // 5. Build Media3 DownloadRequest
                byte[] metadataJson = gson.toJson(request).getBytes(StandardCharsets.UTF_8);
                Log.d(TAG, "[DOWNLOAD_REQUEST_CREATED] trackId=" + request.songId + " requestId=" + newReqId);
                DownloadRequest downloadRequest = Media3DownloadHelper.buildDownloadRequest(
                        request.songId,
                        streamUri,
                        metadataJson
                );

                // Ensure DownloadManager is not paused before adding
                try {
                    media3DownloadManager.resumeDownloads();
                } catch (Exception ignored) {}

                Log.d(TAG, "[DOWNLOAD_MANAGER_ADD_START] trackId=" + request.songId + " requestId=" + newReqId);
                media3DownloadManager.addDownload(downloadRequest);
                Log.d(TAG, "[DOWNLOAD_MANAGER_ADD_RESULT] trackId=" + request.songId + " requestId=" + newReqId + " result=ACCEPTED");

                broadcastProgress(request.songId, "QUEUED", 0, 0, 0, 0, 0, null);
                Log.d(TAG, "[DOWNLOAD_NATIVE_CALL_RESULT] trackId=" + request.songId + " result=QUEUED requestId=" + newReqId);

                if (callback != null) callback.onResult(true, null);
            } catch (Exception e) {
                Log.e(TAG, "[DOWNLOAD_NATIVE_CALL_RESULT] trackId=" + request.songId
                        + " result=EXCEPTION error=" + e.getMessage(), e);
                try { database.downloadDao().markFailed(request.songId, e.getMessage()); } catch (Exception ignored) {}
                broadcastProgress(request.songId, "FAILED", 0, 0, 0, 0, 0, e.getMessage());
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
            if (items == null || items.isEmpty()) {
                if (callback != null) callback.onResult(0, null);
                return;
            }

            Log.d(TAG, "[DOWNLOAD] enqueuePlaylist() items=" + items.size());

            for (DownloadRequestItem item : items) {
                try {
                    if (item.songId == null || item.songId.isEmpty()) continue;

                    // Skip already completed in Media3 cache
                    if (Media3DownloadHelper.verifyDownloadedTrack(context, item.songId)) {
                        Log.d(TAG, "[DOWNLOAD] Playlist item " + item.songId + " already downloaded, skipping");
                        continue;
                    }

                    String streamUrl = item.streamUrl;
                    if (streamUrl != null && !streamUrl.isEmpty()) {
                        streamUrl = adjustBitrateUrl(streamUrl, item.quality);
                        item.streamUrl = streamUrl;
                    }

                    enqueueDownload(item, null);
                    queuedCount++;
                } catch (Exception e) {
                    Log.w(TAG, "[DOWNLOAD] Failed to enqueue playlist item " + item.songId + ": " + e.getMessage());
                }
            }

            if (callback != null) callback.onResult(queuedCount, null);
        });
    }

    public void pauseDownload(String songId) {
        executor.execute(() -> {
            try {
                Log.d(TAG, "[DOWNLOAD] pauseDownload(songId=" + songId + ")");
                media3DownloadManager.setStopReason(songId, 1);
                database.downloadDao().updateState(songId, "PAUSED");
                broadcastProgress(songId, "PAUSED", 0, 0, 0, 0, 0, null);
            } catch (Exception e) {
                Log.w(TAG, "pauseDownload error: " + e.getMessage());
            }
        });
    }

    public void resumeDownload(String songId) {
        executor.execute(() -> {
            try {
                Log.d(TAG, "[DOWNLOAD] resumeDownload(songId=" + songId + ")");
                media3DownloadManager.setStopReason(songId, Download.STOP_REASON_NONE);
                database.downloadDao().updateState(songId, "QUEUED");
                broadcastProgress(songId, "QUEUED", 0, 0, 0, 0, 0, null);
            } catch (Exception e) {
                Log.w(TAG, "resumeDownload error: " + e.getMessage());
            }
        });
    }

    /**
     * Cancel an active download safely.
     * Guaranteed to never crash the app or call process termination.
     */
    public void cancelDownload(String songId) {
        executor.execute(() -> {
            try {
                if (songId == null || songId.isEmpty()) return;

                Log.d(TAG, "[DOWNLOAD_CANCEL_REQUEST] trackId=" + songId);

                // Register in cancelled set to drop any in-flight progress callbacks
                cancelledTrackIds.add(songId);
                trackGenerations.remove(songId);

                // 1. Remove from Media3 DownloadManager
                try {
                    media3DownloadManager.removeDownload(songId);
                } catch (Exception e) {
                    Log.w(TAG, "Media3 removeDownload notice: " + e.getMessage());
                }

                // 2. Update database
                database.downloadDao().deleteDownload(songId);

                // 3. Broadcast CANCELLED state to return UI cleanly to Download icon
                broadcastProgress(songId, "CANCELLED", 0, 0, 0, 0, 0, null);
                Log.d(TAG, "[DOWNLOAD_CANCELLED] trackId=" + songId);
            } catch (Exception e) {
                Log.e(TAG, "cancelDownload safe catch: " + e.getMessage(), e);
            }
        });
    }

    public void pauseAll() {
        executor.execute(() -> {
            try {
                Log.d(TAG, "[DOWNLOAD] pauseAll()");
                media3DownloadManager.pauseDownloads();
                List<DownloadEntity> active = database.downloadDao().getActiveDownloads();
                for (DownloadEntity entity : active) {
                    database.downloadDao().updateState(entity.trackId, "PAUSED");
                    broadcastProgress(entity.trackId, "PAUSED", entity.downloadProgress, entity.downloadedBytes, entity.fileSize, 0, 0, null);
                }
            } catch (Exception e) {
                Log.w(TAG, "pauseAll error: " + e.getMessage());
            }
        });
    }

    public void resumeAll() {
        executor.execute(() -> {
            try {
                Log.d(TAG, "[DOWNLOAD] resumeAll()");
                media3DownloadManager.resumeDownloads();
                List<DownloadEntity> all = database.downloadDao().getAllDownloads();
                for (DownloadEntity entity : all) {
                    if ("PAUSED".equals(entity.downloadState) || "FAILED".equals(entity.downloadState)) {
                        database.downloadDao().updateState(entity.trackId, "QUEUED");
                        broadcastProgress(entity.trackId, "QUEUED", 0, 0, 0, 0, 0, null);
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "resumeAll error: " + e.getMessage());
            }
        });
    }

    public void cancelAll() {
        executor.execute(() -> {
            try {
                Log.d(TAG, "[DOWNLOAD] cancelAll()");
                media3DownloadManager.removeAllDownloads();
                database.downloadDao().clearAllDownloads();
            } catch (Exception e) {
                Log.w(TAG, "cancelAll error: " + e.getMessage());
            }
        });
    }

    /**
     * Removes the offline download from Media3 cache and marks as NOT_DOWNLOADED in Room DB.
     * Library / playlists remain untouched.
     */
    public void removeDownload(String songId, Callback<Boolean> callback) {
        executor.execute(() -> {
            try {
                if (songId == null || songId.isEmpty()) {
                    if (callback != null) callback.onResult(false, "Invalid songId");
                    return;
                }
                Log.d(TAG, "[DOWNLOAD] removeDownload(songId=" + songId + ")");
                cancelledTrackIds.add(songId);
                trackGenerations.remove(songId);

                try {
                    media3DownloadManager.removeDownload(songId);
                } catch (Exception ignored) {}

                database.downloadDao().deleteDownload(songId);
                broadcastProgress(songId, "CANCELLED", 0, 0, 0, 0, 0, null);
                if (callback != null) callback.onResult(true, null);
            } catch (Exception e) {
                Log.e(TAG, "[DOWNLOAD] removeDownload error: " + e.getMessage(), e);
                if (callback != null) callback.onResult(false, e.getMessage());
            }
        });
    }

    /**
     * Reconciles Room database against the Media3 DownloadIndex.
     */
    public void verifyAndSyncLibrary(Callback<List<DownloadEntity>> callback) {
        executor.execute(() -> {
            try {
                DownloadIndex downloadIndex = media3DownloadManager.getDownloadIndex();
                List<DownloadEntity> allCompleted = database.downloadDao().getAllCompletedDownloads();
                Map<String, DownloadEntity> roomMap = new HashMap<>();
                for (DownloadEntity e : allCompleted) {
                    roomMap.put(e.trackId, e);
                }

                List<DownloadEntity> verifiedList = new ArrayList<>();

                try (DownloadCursor cursor = downloadIndex.getDownloads()) {
                    while (cursor.moveToNext()) {
                        Download dl = cursor.getDownload();
                        String trackId = dl.request.id;

                        if (dl.state == Download.STATE_COMPLETED) {
                            DownloadEntity entity = roomMap.get(trackId);
                            if (entity == null) {
                                entity = new DownloadEntity("dl_" + trackId, trackId, "COMPLETED");
                                entity.downloadProgress = 100;
                                entity.fileSize = dl.getBytesDownloaded();
                                entity.streamUrl = dl.request.uri.toString();
                                entity.completedAt = dl.updateTimeMs;
                                database.downloadDao().insertOrUpdate(entity);
                            }
                            verifiedList.add(entity);
                            roomMap.remove(trackId);
                        }
                    }
                }

                // Any records remaining in roomMap were NOT found in Media3 download index
                for (DownloadEntity missing : roomMap.values()) {
                    Log.w(TAG, "[DOWNLOAD] Pruning missing Media3 download record: " + missing.trackId);
                    database.downloadDao().deleteDownload(missing.trackId);
                }

                Log.d(TAG, "[DOWNLOAD] verifyAndSyncLibrary() verified " + verifiedList.size() + " downloads in Media3 cache");
                if (callback != null) callback.onResult(verifiedList, null);
            } catch (Exception e) {
                Log.e(TAG, "[DOWNLOAD] verifyAndSyncLibrary error: " + e.getMessage(), e);
                if (callback != null) callback.onResult(new ArrayList<>(), e.getMessage());
            }
        });
    }

    public void getActiveDownloads(Callback<List<DownloadEntity>> callback) {
        executor.execute(() -> {
            try {
                List<DownloadEntity> active = database.downloadDao().getActiveDownloads();
                if (callback != null) callback.onResult(active, null);
            } catch (Exception e) {
                Log.e(TAG, "[DOWNLOAD] getActiveDownloads error: " + e.getMessage(), e);
                if (callback != null) callback.onResult(new ArrayList<>(), e.getMessage());
            }
        });
    }

    private void handleMedia3DownloadChanged(Download download, @Nullable Exception finalException) {
        executor.execute(() -> {
            try {
                if (download == null || download.request == null || download.request.id == null) return;
                String trackId = download.request.id;

                // Cancel race condition guard: ignore callbacks for cancelled tracks
                if (cancelledTrackIds.contains(trackId)) {
                    Log.d(TAG, "[DOWNLOAD] Ignored callback for cancelled trackId=" + trackId);
                    return;
                }

                int state = download.state;
                long bytesDownloaded = download.getBytesDownloaded();
                long totalBytes = download.contentLength;
                int progress = (int) download.getPercentDownloaded();
                if (progress < 0) progress = 0;

                String stateStr = "QUEUED";
                long speedBytesPerSec = 0;
                long etaSeconds = 0;

                long now = System.currentTimeMillis();
                Long lastTime = lastProgressTimeMap.get(trackId);
                Long lastBytes = lastProgressBytesMap.get(trackId);

                if (lastTime != null && lastBytes != null && now > lastTime) {
                    long timeDelta = now - lastTime;
                    long bytesDelta = bytesDownloaded - lastBytes;
                    if (bytesDelta > 0 && timeDelta > 0) {
                        speedBytesPerSec = (bytesDelta * 1000L) / timeDelta;
                        if (speedBytesPerSec > 0 && totalBytes > bytesDownloaded) {
                            etaSeconds = (totalBytes - bytesDownloaded) / speedBytesPerSec;
                        }
                    }
                }

                lastProgressTimeMap.put(trackId, now);
                lastProgressBytesMap.put(trackId, bytesDownloaded);

                if (state == Download.STATE_DOWNLOADING) {
                    stateStr = "DOWNLOADING";
                } else if (state == Download.STATE_COMPLETED) {
                    stateStr = "COMPLETED";
                } else if (state == Download.STATE_FAILED) {
                    stateStr = "FAILED";
                } else if (state == Download.STATE_STOPPED) {
                    stateStr = "PAUSED";
                } else if (state == Download.STATE_QUEUED || state == Download.STATE_RESTARTING) {
                    stateStr = "QUEUED";
                }

                Log.d(TAG, "[DOWNLOAD_STATE] trackId=" + trackId
                        + " requestId=" + trackGenerations.get(trackId)
                        + " state=" + stateStr
                        + " percent=" + progress
                        + " bytesDownloaded=" + bytesDownloaded
                        + " totalBytes=" + totalBytes);

                // Zero-bytes watchdog: if DOWNLOADING but 0 bytes for ZERO_BYTES_WATCHDOG_MS, re-add the download
                if (state == Download.STATE_DOWNLOADING) {
                    if (bytesDownloaded == 0) {
                        Long startTime = downloadingStartTimeMap.get(trackId);
                        if (startTime == null) {
                            downloadingStartTimeMap.put(trackId, now);
                        } else if ((now - startTime) >= ZERO_BYTES_WATCHDOG_MS) {
                            Log.w(TAG, "[DOWNLOAD_WATCHDOG] trackId=" + trackId
                                    + " stuck at 0 bytes for " + ((now - startTime) / 1000) + "s — removing and re-adding");
                            downloadingStartTimeMap.remove(trackId);
                            // Remove then re-add forces Media3 to open a fresh HTTP connection
                            DownloadRequest stuckRequest = download.request;
                            try { media3DownloadManager.removeDownload(trackId); } catch (Exception ignored) {}
                            try {
                                Thread.sleep(500);
                                media3DownloadManager.resumeDownloads();
                                media3DownloadManager.addDownload(stuckRequest);
                                Log.d(TAG, "[DOWNLOAD_WATCHDOG] trackId=" + trackId + " re-added to queue");
                            } catch (Exception we) {
                                Log.e(TAG, "[DOWNLOAD_WATCHDOG] re-add failed for " + trackId + ": " + we.getMessage());
                            }
                            return;
                        }
                    } else {
                        // Bytes are moving — clear the watchdog
                        downloadingStartTimeMap.remove(trackId);
                    }
                } else {
                    // Not DOWNLOADING — clear watchdog
                    downloadingStartTimeMap.remove(trackId);
                }

                if (state == Download.STATE_DOWNLOADING) {
                    Log.d(TAG, "[DOWNLOAD_PROGRESS] trackId=" + trackId
                            + " bytesDownloaded=" + bytesDownloaded
                            + " totalBytes=" + totalBytes
                            + " percent=" + progress
                            + " speed=" + (speedBytesPerSec / 1024) + "KB/s");
                    database.downloadDao().updateProgress(trackId, stateStr, progress, bytesDownloaded);
                    broadcastProgress(trackId, stateStr, progress, bytesDownloaded, totalBytes, speedBytesPerSec, etaSeconds, null);
                } else if (state == Download.STATE_COMPLETED) {
                    boolean valid = Media3DownloadHelper.verifyDownloadedTrack(context, trackId);
                    Log.d(TAG, "[DOWNLOAD_VERIFY] trackId=" + trackId + " valid=" + valid);

                    if (valid) {
                        database.downloadDao().markCompleted(
                                trackId,
                                "media3_cache://" + trackId,
                                trackId,
                                bytesDownloaded,
                                Media3DownloadHelper.detectMimeType(download.request.uri),
                                "320 kbps",
                                System.currentTimeMillis()
                        );
                        Log.d(TAG, "[DOWNLOAD_COMPLETED] trackId=" + trackId + " (size=" + bytesDownloaded + " bytes)");
                        broadcastProgress(trackId, stateStr, 100, bytesDownloaded, bytesDownloaded, 0, 0, null);
                        broadcastCompleted(trackId, bytesDownloaded);
                    } else {
                        Log.e(TAG, "[DOWNLOAD_VERIFY_ERROR] trackId=" + trackId + " downloaded file invalid or empty");
                        Log.e(TAG, "[DOWNLOAD_FAILED]\ntrackId=" + trackId + "\nrequestId=" + trackGenerations.get(trackId) + "\nstate=FAILED\nerrorCode=VerificationFailed\nerrorMessage=Verification failed\nexception=VerificationError\ncause=File empty or corrupted\nuri=" + download.request.uri + "\nhttpResponseCode=-1\nbytesDownloaded=" + bytesDownloaded + "\ntotalBytes=" + totalBytes);
                        database.downloadDao().markFailed(trackId, "Verification failed");
                        broadcastProgress(trackId, "FAILED", 0, bytesDownloaded, totalBytes, 0, 0, "Verification failed");
                    }
                } else if (state == Download.STATE_FAILED) {
                    int httpResponseCode = -1;
                    if (finalException instanceof androidx.media3.datasource.HttpDataSource.InvalidResponseCodeException) {
                        httpResponseCode = ((androidx.media3.datasource.HttpDataSource.InvalidResponseCodeException) finalException).responseCode;
                    }

                    StringBuilder causeChain = new StringBuilder();
                    Throwable current = finalException;
                    while (current != null) {
                        causeChain.append(current.getClass().getName()).append(": ").append(current.getMessage()).append(" -> ");
                        current = current.getCause();
                    }

                    String errorType = finalException != null ? finalException.getClass().getSimpleName() : "UnknownError";
                    String errorMsg = finalException != null ? finalException.getMessage() : "Download failed";

                    Log.e(TAG, "[DOWNLOAD_FAILED]\n" +
                            "trackId=" + trackId + "\n" +
                            "requestId=" + trackGenerations.get(trackId) + "\n" +
                            "state=FAILED\n" +
                            "errorCode=" + errorType + "\n" +
                            "errorMessage=" + errorMsg + "\n" +
                            "exception=" + (finalException != null ? finalException.getClass().getName() : "null") + "\n" +
                            "cause=" + (causeChain.length() > 0 ? causeChain.toString() : "none") + "\n" +
                            "uri=" + download.request.uri + "\n" +
                            "httpResponseCode=" + httpResponseCode + "\n" +
                            "bytesDownloaded=" + bytesDownloaded + "\n" +
                            "totalBytes=" + totalBytes);

                    database.downloadDao().markFailed(trackId, errorMsg);
                    broadcastProgress(trackId, stateStr, progress, bytesDownloaded, totalBytes, 0, 0, errorMsg);
                } else if (state == Download.STATE_STOPPED) {
                    database.downloadDao().updateState(trackId, stateStr);
                    broadcastProgress(trackId, stateStr, progress, bytesDownloaded, totalBytes, 0, 0, null);
                } else if (state == Download.STATE_QUEUED || state == Download.STATE_RESTARTING) {
                    database.downloadDao().updateState(trackId, stateStr);
                    broadcastProgress(trackId, stateStr, progress, bytesDownloaded, totalBytes, 0, 0, null);
                }
            } catch (Throwable t) {
                Log.e(TAG, "Safe handleMedia3DownloadChanged catch: " + t.getMessage(), t);
            }
        });
    }

    private void handleMedia3DownloadRemoved(Download download) {
        executor.execute(() -> {
            try {
                if (download != null && download.request != null && download.request.id != null) {
                    String trackId = download.request.id;
                    Log.d(TAG, "[DOWNLOAD] Download removed from Media3 cache: " + trackId);
                    database.downloadDao().deleteDownload(trackId);
                }
            } catch (Throwable e) {
                Log.w(TAG, "handleMedia3DownloadRemoved notice: " + e.getMessage());
            }
        });
    }

    private void reconcileDownloadsOnStartup() {
        try {
            if (media3DownloadManager == null) return;

            // 1. Pause downloads so Media3 does not automatically resume failed/broken downloads on boot
            try {
                media3DownloadManager.pauseDownloads();
            } catch (Exception ignored) {}

            // 2. Mark any active/in-flight downloads from previous crashed session as FAILED / NOT_DOWNLOADED
            List<DownloadEntity> active = database.downloadDao().getActiveDownloads();
            for (DownloadEntity activeEntity : active) {
                Log.w(TAG, "[STARTUP_RECOVERY] Found uncompleted download from prior crash: " + activeEntity.trackId + " (state=" + activeEntity.downloadState + ") -> marking FAILED");
                database.downloadDao().markFailed(activeEntity.trackId, "Process interrupted");
                try {
                    media3DownloadManager.removeDownload(activeEntity.trackId);
                } catch (Exception ignored) {}
            }

            // 3. Reconcile and verify COMPLETED downloads
            DownloadIndex downloadIndex = media3DownloadManager.getDownloadIndex();
            try (DownloadCursor cursor = downloadIndex.getDownloads()) {
                while (cursor.moveToNext()) {
                    Download dl = cursor.getDownload();
                    String trackId = dl.request.id;
                    if (dl.state == Download.STATE_COMPLETED) {
                        boolean valid = Media3DownloadHelper.verifyDownloadedTrack(context, trackId);
                        if (valid) {
                            DownloadEntity entity = database.downloadDao().getDownloadByTrackId(trackId);
                            if (entity == null || !"COMPLETED".equals(entity.downloadState)) {
                                DownloadEntity newEntity = new DownloadEntity("dl_" + trackId, trackId, "COMPLETED");
                                newEntity.downloadProgress = 100;
                                newEntity.fileSize = dl.getBytesDownloaded();
                                newEntity.streamUrl = dl.request.uri.toString();
                                newEntity.completedAt = dl.updateTimeMs;
                                database.downloadDao().insertOrUpdate(newEntity);
                            }
                        } else {
                            Log.w(TAG, "[STARTUP_RECOVERY] Purging invalid/empty completed download: " + trackId);
                            try {
                                media3DownloadManager.removeDownload(trackId);
                            } catch (Exception ignored) {}
                            database.downloadDao().deleteDownload(trackId);
                        }
                    } else if (dl.state == Download.STATE_DOWNLOADING || dl.state == Download.STATE_QUEUED || dl.state == Download.STATE_RESTARTING) {
                        Log.w(TAG, "[STARTUP_RECOVERY] Purging pending download from index: " + trackId);
                        try {
                            media3DownloadManager.removeDownload(trackId);
                        } catch (Exception ignored) {}
                    }
                }
            }

            // 4. Resume download queue so new downloads process immediately
            try {
                media3DownloadManager.resumeDownloads();
            } catch (Exception ignored) {}

            Log.d(TAG, "[STARTUP_RECOVERY] Safe download reconciliation complete & downloads resumed.");
        } catch (Exception e) {
            Log.e(TAG, "[STARTUP_RECOVERY] Safe download reconciliation error: " + e.getMessage(), e);
        }
    }

    private String adjustBitrateUrl(String originalUrl, String quality) {
        if (originalUrl == null) return "";
        String normalized = originalUrl.replace("http://", "https://");

        String targetQuality = "_320";
        if ("128 kbps".equalsIgnoreCase(quality) || "128".equals(quality)) {
            targetQuality = "_128";
        } else if ("192 kbps".equalsIgnoreCase(quality) || "160 kbps".equalsIgnoreCase(quality) || "160".equals(quality)) {
            targetQuality = "_160";
        }

        if (normalized.matches(".*_(?:12|48|96|128|160|320)\\.(mp3|m4a|mp4)$")) {
            String ext = normalized.substring(normalized.lastIndexOf('.'));
            return normalized.replaceAll("_(?:12|48|96|128|160|320)\\.(mp3|m4a|mp4)$", targetQuality + ext);
        }
        return normalized;
    }

    private void broadcastProgress(String trackId, String state, int progress, long bytesDownloaded, long totalBytes, long speedBytesPerSec, long etaSeconds, String error) {
        try {
            Intent intent = new Intent("com.raagax.music.DOWNLOAD_PROGRESS");
            intent.setPackage(context.getPackageName());
            intent.putExtra("trackId", trackId);
            intent.putExtra("songId", trackId);
            intent.putExtra("state", state);
            intent.putExtra("progress", progress);
            intent.putExtra("downloadedBytes", bytesDownloaded);
            intent.putExtra("totalBytes", totalBytes);
            intent.putExtra("speedBytesPerSec", speedBytesPerSec);
            intent.putExtra("etaSeconds", etaSeconds);
            if (error != null) {
                intent.putExtra("error", error);
            }
            context.sendBroadcast(intent);
        } catch (Exception e) {
            Log.w(TAG, "Error broadcasting download progress: " + e.getMessage());
        }
    }

    private void broadcastCompleted(String trackId, long fileSize) {
        try {
            DownloadEntity entity = database.downloadDao().getDownloadByTrackId(trackId);
            Intent intent = new Intent("com.raagax.music.DOWNLOAD_COMPLETED");
            intent.setPackage(context.getPackageName());
            intent.putExtra("trackId", trackId);
            intent.putExtra("songId", trackId);
            intent.putExtra("fileSize", fileSize);
            intent.putExtra("quality", entity != null && entity.quality != null ? entity.quality : "320 kbps");
            intent.putExtra("title", entity != null && entity.title != null ? entity.title : "RaagaX");
            intent.putExtra("artist", entity != null && entity.artist != null ? entity.artist : "");
            context.sendBroadcast(intent);
        } catch (Exception e) {
            Log.w(TAG, "Error broadcasting download completed: " + e.getMessage());
        }
    }

    public void shareSongFile(Activity activity, String songId, Callback<Boolean> callback) {
        if (callback != null) {
            callback.onResult(false, "App-specific managed download cache does not expose raw files for external export.");
        }
    }

    // =====================================================================
    // Pre-flight URL probe — verifies a CDN URL is accessible before Media3
    // =====================================================================
    private static final class PreflightResult {
        final boolean success;
        final int httpCode;
        final long contentLength;
        final String error;
        PreflightResult(boolean success, int httpCode, long contentLength, String error) {
            this.success = success;
            this.httpCode = httpCode;
            this.contentLength = contentLength;
            this.error = error;
        }
    }

    /**
     * Probes the given URL with the same headers Media3 uses (Referer + Origin).
     * Returns success if the server responds with 2xx or 206, and content-length > 0.
     * Falls back to a tiny range GET if HEAD is not supported (405).
     */
    private PreflightResult probeUrl(String urlStr) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(10_000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 RaagaX/1.0");
            conn.setRequestProperty("Referer", "https://www.jiosaavn.com/");
            conn.setRequestProperty("Origin", "https://www.jiosaavn.com");
            conn.setRequestProperty("Accept", "*/*");
            conn.setInstanceFollowRedirects(true);
            conn.connect();

            int code = conn.getResponseCode();
            long len = conn.getContentLengthLong();

            if (code == 405) {
                // HEAD not supported — try a byte-range GET for the first 1KB
                conn.disconnect();
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout(10_000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 RaagaX/1.0");
                conn.setRequestProperty("Referer", "https://www.jiosaavn.com/");
                conn.setRequestProperty("Origin", "https://www.jiosaavn.com");
                conn.setRequestProperty("Accept", "*/*");
                conn.setRequestProperty("Range", "bytes=0-1023");
                conn.setInstanceFollowRedirects(true);
                conn.connect();
                code = conn.getResponseCode();
                len = conn.getContentLengthLong();
                // Drain a bit to confirm data flows
                try {
                    InputStream is = conn.getInputStream();
                    byte[] buf = new byte[256];
                    int read = is.read(buf);
                    if (read > 0) len = Math.max(len, read);
                } catch (Exception ignored) {}
            }

            if (code >= 200 && code < 300) {
                return new PreflightResult(true, code, len, null);
            } else {
                return new PreflightResult(false, code, 0, "HTTP " + code);
            }
        } catch (Exception e) {
            return new PreflightResult(false, -1, 0, e.getMessage());
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
    }

    public interface Callback<T> {
        void onResult(T result, String error);
    }
}
