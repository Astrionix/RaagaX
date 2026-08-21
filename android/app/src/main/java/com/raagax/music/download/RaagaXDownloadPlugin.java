package com.raagax.music.download;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.db.entity.DownloadEntity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "RaagaXDownload")
public class RaagaXDownloadPlugin extends Plugin {
    private static final String TAG = "RaagaXDownloadPlugin";
    private RaagaXDownloadManager downloadManager;
    private RaagaXDatabase database;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();

            if ("com.raagax.music.DOWNLOAD_PROGRESS".equals(action)) {
                String trackId = intent.getStringExtra("trackId");
                String state = intent.getStringExtra("state");
                int progress = intent.getIntExtra("progress", 0);
                long downloadedBytes = intent.getLongExtra("downloadedBytes", 0L);
                long totalBytes = intent.getLongExtra("totalBytes", 0L);
                long speedBytesPerSec = intent.getLongExtra("speedBytesPerSec", 0L);
                long etaSeconds = intent.getLongExtra("etaSeconds", 0L);
                String error = intent.getStringExtra("error");

                Log.d(TAG, "[DownloadPlugin] broadcast received: trackId=" + trackId + " state=" + state + " progress=" + progress + "% speed=" + (speedBytesPerSec / 1024) + "KB/s");

                JSObject data = new JSObject();
                data.put("trackId", trackId);
                data.put("songId", trackId);
                data.put("state", state);
                data.put("progress", progress);
                data.put("downloadedBytes", downloadedBytes);
                data.put("totalBytes", totalBytes);
                data.put("speedBytesPerSec", speedBytesPerSec);
                data.put("etaSeconds", etaSeconds);
                if (error != null) {
                    data.put("error", error);
                }
                notifyListeners("downloadProgress", data);

            } else if ("com.raagax.music.DOWNLOAD_COMPLETED".equals(action)) {
                String trackId = intent.getStringExtra("trackId");
                Log.d(TAG, "[DownloadPlugin] broadcast received: trackId=" + trackId + " state=COMPLETED");

                JSObject data = new JSObject();
                data.put("trackId", trackId);
                data.put("songId", trackId);
                data.put("localPath", intent.getStringExtra("localPath"));
                data.put("fileName", intent.getStringExtra("fileName"));
                data.put("fileSize", intent.getLongExtra("fileSize", 0L));
                data.put("quality", intent.getStringExtra("quality"));
                data.put("title", intent.getStringExtra("title"));
                data.put("artist", intent.getStringExtra("artist"));
                notifyListeners("downloadCompleted", data);
            }
        }
    };

    @Override
    public void load() {
        super.load();
        downloadManager = RaagaXDownloadManager.getInstance(getContext());
        database = RaagaXDatabase.getInstance(getContext());

        IntentFilter filter = new IntentFilter();
        filter.addAction("com.raagax.music.DOWNLOAD_PROGRESS");
        filter.addAction("com.raagax.music.DOWNLOAD_COMPLETED");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(downloadReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(downloadReceiver, filter);
        }
    }

    @PluginMethod
    public void downloadTrack(PluginCall call) {
        String songId = call.getString("songId", call.getString("id", ""));
        String title = call.getString("title", "RaagaX Track");
        String artist = call.getString("artist", "Unknown Artist");
        String album = call.getString("album", "RaagaX Music");
        String artworkUrl = call.getString("artworkUrl", call.getString("coverUrl", ""));
        String streamUrl = call.getString("streamUrl", call.getString("audioUrl", ""));
        String quality = call.getString("quality", "320 kbps");

        if (songId.isEmpty()) {
            call.reject("songId is required");
            return;
        }

        RaagaXDownloadManager.DownloadRequestItem item = new RaagaXDownloadManager.DownloadRequestItem(
                songId, title, artist, album, artworkUrl, streamUrl, quality
        );

        downloadManager.enqueueDownload(item, (success, error) -> {
            if (success) {
                JSObject res = new JSObject();
                res.put("success", true);
                res.put("songId", songId);
                call.resolve(res);
            } else {
                call.reject(error != null ? error : "Download failed to enqueue");
            }
        });
    }

    @PluginMethod
    public void downloadPlaylist(PluginCall call) {
        JSArray songsArray = call.getArray("songs");
        String quality = call.getString("quality", "320 kbps");

        if (songsArray == null || songsArray.length() == 0) {
            call.reject("songs array is required");
            return;
        }

        try {
            List<RaagaXDownloadManager.DownloadRequestItem> items = new ArrayList<>();
            for (int i = 0; i < songsArray.length(); i++) {
                JSONObject obj = songsArray.getJSONObject(i);
                String songId = obj.optString("id", obj.optString("songId", ""));
                if (songId.isEmpty()) continue;

                String title = obj.optString("title", "RaagaX Track");
                String artist = obj.optString("artist", "Unknown Artist");
                String album = obj.optString("album", "RaagaX Music");
                String artworkUrl = obj.optString("coverUrl", obj.optString("artworkUrl", ""));
                String streamUrl = obj.optString("audioUrl", obj.optString("streamUrl", ""));

                items.add(new RaagaXDownloadManager.DownloadRequestItem(
                        songId, title, artist, album, artworkUrl, streamUrl, quality
                ));
            }

            downloadManager.enqueuePlaylist(items, (count, error) -> {
                JSObject res = new JSObject();
                res.put("success", true);
                res.put("queuedCount", count);
                call.resolve(res);
            });
        } catch (Exception e) {
            Log.e(TAG, "Error parsing playlist for download: " + e.getMessage());
            call.reject("Failed to parse playlist: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        String songId = call.getString("songId", "");
        if (!songId.isEmpty()) {
            downloadManager.pauseDownload(songId);
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void resumeDownload(PluginCall call) {
        String songId = call.getString("songId", "");
        if (!songId.isEmpty()) {
            downloadManager.resumeDownload(songId);
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String songId = call.getString("songId", "");
        if (!songId.isEmpty()) {
            downloadManager.cancelDownload(songId);
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void pauseAll(PluginCall call) {
        downloadManager.pauseAll();
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void resumeAll(PluginCall call) {
        downloadManager.resumeAll();
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        downloadManager.cancelAll();
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void removeDownload(PluginCall call) {
        String songId = call.getString("songId", "");
        if (songId.isEmpty()) {
            call.reject("songId is required");
            return;
        }

        downloadManager.removeDownload(songId, (success, error) -> {
            if (success) {
                call.resolve(new JSObject().put("success", true));
            } else {
                call.reject(error != null ? error : "Failed to delete physical file");
            }
        });
    }

    @PluginMethod
    public void getDownloadedTracks(PluginCall call) {
        downloadManager.verifyAndSyncLibrary((tracks, error) -> {
            JSArray arr = new JSArray();
            for (DownloadEntity e : tracks) {
                JSObject obj = new JSObject();
                obj.put("songId", e.trackId);
                obj.put("id", e.trackId);
                obj.put("title", e.title);
                obj.put("artist", e.artist);
                obj.put("album", e.album);
                
                File artFile = StorageHelper.getArtworkFile(getContext(), e.trackId);
                String artUrl = (artFile != null && artFile.exists()) ? "file://" + artFile.getAbsolutePath() : (e.artwork != null ? e.artwork : "");
                obj.put("artworkUrl", artUrl);
                obj.put("coverUrl", artUrl);
                obj.put("localArtworkPath", artFile != null && artFile.exists() ? artFile.getAbsolutePath() : "");
                obj.put("localPath", e.localPath);
                obj.put("fileName", e.fileName);
                obj.put("fileSize", e.fileSize);
                obj.put("quality", e.quality);
                obj.put("mimeType", e.mimeType);
                obj.put("downloadState", e.downloadState);
                obj.put("completedAt", e.completedAt);
                arr.put(obj);
            }

            JSObject res = new JSObject();
            res.put("tracks", arr);
            res.put("count", arr.length());
            call.resolve(res);
        });
    }

    @PluginMethod
    public void checkStorage(PluginCall call) {
        long available = StorageHelper.getAvailableStorageBytes(getContext());
        long total = StorageHelper.getTotalStorageBytes(getContext());
        long required = call.getLong("requiredBytes", 15L * 1024 * 1024);

        JSObject res = new JSObject();
        res.put("hasSpace", available >= required);
        res.put("availableBytes", available);
        res.put("totalBytes", total);
        res.put("requiredBytes", required);
        res.put("musicFolderPath", StorageHelper.getRaagaXMusicDirectory(getContext()).getAbsolutePath());
        res.put("songsFolderPath", StorageHelper.getSongsDirectory(getContext()).getAbsolutePath());
        res.put("artworkFolderPath", StorageHelper.getArtworkDirectory(getContext()).getAbsolutePath());
        call.resolve(res);
    }

    /**
     * Returns all currently active download entries (QUEUED, DOWNLOADING, VERIFYING, PAUSED, FAILED).
     * The TypeScript layer calls this at hydration time to reconcile JS task state against
     * the real Android Room DB state, fixing the root cause of tasks stuck in QUEUED.
     */
    @PluginMethod
    public void getActiveDownloads(PluginCall call) {
        downloadManager.getActiveDownloads((downloads, error) -> {
            JSArray arr = new JSArray();
            for (DownloadEntity e : downloads) {
                JSObject obj = new JSObject();
                obj.put("songId", e.trackId);
                obj.put("trackId", e.trackId);
                obj.put("title", e.title);
                obj.put("artist", e.artist);
                obj.put("album", e.album);
                obj.put("artworkUrl", e.artwork);
                obj.put("coverUrl", e.artwork);
                obj.put("quality", e.quality);
                obj.put("downloadState", e.downloadState);
                obj.put("downloadProgress", e.downloadProgress);
                obj.put("downloadedBytes", e.downloadedBytes);
                arr.put(obj);
            }
            JSObject res = new JSObject();
            res.put("downloads", arr);
            res.put("count", arr.length());
            call.resolve(res);
        });
    }

    @PluginMethod
    public void verifyAndSyncLibrary(PluginCall call) {
        downloadManager.verifyAndSyncLibrary((verified, error) -> {
            JSArray ids = new JSArray();
            for (DownloadEntity e : verified) {
                ids.put(e.trackId);
            }
            JSObject res = new JSObject();
            res.put("verifiedCount", verified.size());
            res.put("verifiedSongIds", ids);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void shareSongFile(PluginCall call) {
        String songId = call.getString("songId", "");
        if (songId.isEmpty()) {
            call.reject("songId is required");
            return;
        }

        downloadManager.shareSongFile(getActivity(), songId, (success, error) -> {
            if (success) {
                call.resolve(new JSObject().put("success", true));
            } else {
                call.reject(error != null ? error : "Could not share song file");
            }
        });
    }

    @PluginMethod
    public void setWifiOnly(PluginCall call) {
        boolean wifiOnly = call.getBoolean("wifiOnly", false);
        downloadManager.setWifiOnly(wifiOnly);
        call.resolve(new JSObject().put("success", true));
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
