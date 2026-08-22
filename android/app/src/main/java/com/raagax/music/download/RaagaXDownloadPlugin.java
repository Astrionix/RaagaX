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
            try {
                if (intent == null) return;
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
            } catch (Exception e) {
                Log.w(TAG, "downloadReceiver safe catch: " + e.getMessage());
            }
        }
    };

    @Override
    public void load() {
        super.load();
        try {
            downloadManager = RaagaXDownloadManager.getInstance(getContext());
            database = RaagaXDatabase.getInstance(getContext());

            IntentFilter filter = new IntentFilter();
            filter.addAction("com.raagax.music.DOWNLOAD_PROGRESS");
            filter.addAction("com.raagax.music.DOWNLOAD_COMPLETED");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(downloadReceiver, filter);
            }
        } catch (Exception e) {
            Log.e(TAG, "RaagaXDownloadPlugin load error: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadTrack(PluginCall call) {
        try {
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

            Log.d(TAG, "[DOWNLOAD_CLICK] trackId=" + songId);

            RaagaXDownloadManager.DownloadRequestItem item = new RaagaXDownloadManager.DownloadRequestItem(
                    songId, title, artist, album, artworkUrl, streamUrl, quality
            );

            downloadManager.enqueueDownload(item, (success, error) -> {
                try {
                    if (success) {
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("songId", songId);
                        call.resolve(res);
                    } else {
                        call.reject(error != null ? error : "Download failed to enqueue");
                    }
                } catch (Exception ignored) {}
            });
        } catch (Exception e) {
            Log.e(TAG, "downloadTrack safe catch: " + e.getMessage(), e);
            call.reject("Download error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadPlaylist(PluginCall call) {
        try {
            JSArray songsArray = call.getArray("songs");
            String quality = call.getString("quality", "320 kbps");

            if (songsArray == null || songsArray.length() == 0) {
                call.reject("songs array is required");
                return;
            }

            String playlistId = call.getString("playlistId", "pl_custom");
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

                RaagaXDownloadManager.DownloadRequestItem item = new RaagaXDownloadManager.DownloadRequestItem(
                        songId, title, artist, album, artworkUrl, streamUrl, quality
                );
                item.playlistId = playlistId;
                items.add(item);
            }

            downloadManager.enqueuePlaylist(items, (count, error) -> {
                try {
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("queuedCount", count);
                    call.resolve(res);
                } catch (Exception ignored) {}
            });
        } catch (Exception e) {
            Log.e(TAG, "downloadPlaylist safe catch: " + e.getMessage(), e);
            call.reject("Failed to parse playlist: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelPlaylist(PluginCall call) {
        try {
            String playlistId = call.getString("playlistId", "");
            JSArray songsArray = call.getArray("songIds");
            List<String> songIds = new ArrayList<>();
            if (songsArray != null) {
                for (int i = 0; i < songsArray.length(); i++) {
                    songIds.add(songsArray.getString(i));
                }
            }
            if (downloadManager != null) {
                downloadManager.cancelPlaylist(playlistId, songIds, (success, error) -> {
                    JSObject res = new JSObject();
                    res.put("success", success);
                    call.resolve(res);
                });
            } else {
                call.resolve(new JSObject().put("success", true));
            }
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", false));
        }
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        try {
            String songId = call.getString("songId", "");
            if (!songId.isEmpty() && downloadManager != null) {
                downloadManager.pauseDownload(songId);
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void resumeDownload(PluginCall call) {
        try {
            String songId = call.getString("songId", "");
            if (!songId.isEmpty() && downloadManager != null) {
                downloadManager.resumeDownload(songId);
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        try {
            String songId = call.getString("songId", "");
            if (!songId.isEmpty() && downloadManager != null) {
                downloadManager.cancelDownload(songId);
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void pauseAll(PluginCall call) {
        try {
            if (downloadManager != null) downloadManager.pauseAll();
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void resumeAll(PluginCall call) {
        try {
            if (downloadManager != null) downloadManager.resumeAll();
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        try {
            if (downloadManager != null) downloadManager.cancelAll();
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void removeDownload(PluginCall call) {
        try {
            String songId = call.getString("songId", "");
            if (songId.isEmpty()) {
                call.reject("songId is required");
                return;
            }

            Log.d(TAG, "[DOWNLOAD] removeDownload called from JS for songId: " + songId);

            if (downloadManager != null) {
                downloadManager.removeDownload(songId, (success, error) -> {
                    try {
                        call.resolve(new JSObject().put("success", true));
                    } catch (Exception ignored) {}
                });
            } else {
                call.resolve(new JSObject().put("success", true));
            }
        } catch (Exception e) {
            Log.e(TAG, "removeDownload safe catch: " + e.getMessage(), e);
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void getDownloadedTracks(PluginCall call) {
        try {
            if (downloadManager == null) {
                call.resolve(new JSObject().put("tracks", new JSArray()).put("count", 0));
                return;
            }

            downloadManager.verifyAndSyncLibrary((tracks, error) -> {
                try {
                    JSArray arr = new JSArray();
                    if (tracks != null) {
                        for (DownloadEntity e : tracks) {
                            JSObject obj = new JSObject();
                            obj.put("songId", e.trackId);
                            obj.put("id", e.trackId);
                            obj.put("title", e.title != null ? e.title : "RaagaX");
                            obj.put("artist", e.artist != null ? e.artist : "");
                            obj.put("album", e.album != null ? e.album : "");
                            obj.put("artworkUrl", e.artwork != null ? e.artwork : "");
                            obj.put("coverUrl", e.artwork != null ? e.artwork : "");
                            obj.put("localPath", e.localPath != null ? e.localPath : "");
                            obj.put("fileName", e.fileName != null ? e.fileName : "");
                            obj.put("fileSize", e.fileSize);
                            obj.put("quality", e.quality != null ? e.quality : "320 kbps");
                            obj.put("mimeType", e.mimeType != null ? e.mimeType : "audio/mpeg");
                            obj.put("downloadState", e.downloadState != null ? e.downloadState : "COMPLETED");
                            obj.put("completedAt", e.completedAt);
                            arr.put(obj);
                        }
                    }

                    JSObject res = new JSObject();
                    res.put("tracks", arr);
                    res.put("count", arr.length());
                    call.resolve(res);
                } catch (Exception e) {
                    call.resolve(new JSObject().put("tracks", new JSArray()).put("count", 0));
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "getDownloadedTracks safe catch: " + e.getMessage(), e);
            call.resolve(new JSObject().put("tracks", new JSArray()).put("count", 0));
        }
    }

    @PluginMethod
    public void checkStorage(PluginCall call) {
        try {
            long available = StorageHelper.getAvailableStorageBytes(getContext());
            long total = StorageHelper.getTotalStorageBytes(getContext());
            long required = call.getLong("requiredBytes", 15L * 1024 * 1024);

            JSObject res = new JSObject();
            res.put("hasSpace", available >= required);
            res.put("availableBytes", available);
            res.put("totalBytes", total);
            res.put("requiredBytes", required);
            res.put("musicFolderPath", "downloads");
            res.put("songsFolderPath", "downloads/audio");
            res.put("artworkFolderPath", "downloads/artwork");
            call.resolve(res);
        } catch (Exception e) {
            Log.w(TAG, "checkStorage catch: " + e.getMessage());
            JSObject res = new JSObject();
            res.put("hasSpace", true);
            res.put("availableBytes", 64L * 1024 * 1024 * 1024);
            res.put("totalBytes", 128L * 1024 * 1024 * 1024);
            res.put("requiredBytes", 15L * 1024 * 1024);
            call.resolve(res);
        }
    }

    @PluginMethod
    public void getActiveDownloads(PluginCall call) {
        try {
            if (downloadManager == null) {
                call.resolve(new JSObject().put("downloads", new JSArray()).put("count", 0));
                return;
            }

            downloadManager.getActiveDownloads((downloads, error) -> {
                try {
                    JSArray arr = new JSArray();
                    if (downloads != null) {
                        for (DownloadEntity e : downloads) {
                            JSObject obj = new JSObject();
                            obj.put("songId", e.trackId);
                            obj.put("trackId", e.trackId);
                            obj.put("title", e.title != null ? e.title : "");
                            obj.put("artist", e.artist != null ? e.artist : "");
                            obj.put("album", e.album != null ? e.album : "");
                            obj.put("artworkUrl", e.artwork != null ? e.artwork : "");
                            obj.put("coverUrl", e.artwork != null ? e.artwork : "");
                            obj.put("quality", e.quality != null ? e.quality : "320 kbps");
                            obj.put("downloadState", e.downloadState != null ? e.downloadState : "QUEUED");
                            obj.put("downloadProgress", e.downloadProgress);
                            obj.put("downloadedBytes", e.downloadedBytes);
                            arr.put(obj);
                        }
                    }
                    JSObject res = new JSObject();
                    res.put("downloads", arr);
                    res.put("count", arr.length());
                    call.resolve(res);
                } catch (Exception e) {
                    call.resolve(new JSObject().put("downloads", new JSArray()).put("count", 0));
                }
            });
        } catch (Exception e) {
            call.resolve(new JSObject().put("downloads", new JSArray()).put("count", 0));
        }
    }

    @PluginMethod
    public void verifyAndSyncLibrary(PluginCall call) {
        try {
            if (downloadManager == null) {
                call.resolve(new JSObject().put("verifiedCount", 0).put("verifiedSongIds", new JSArray()));
                return;
            }

            downloadManager.verifyAndSyncLibrary((verified, error) -> {
                try {
                    JSArray ids = new JSArray();
                    if (verified != null) {
                        for (DownloadEntity e : verified) {
                            ids.put(e.trackId);
                        }
                    }
                    JSObject res = new JSObject();
                    res.put("verifiedCount", verified != null ? verified.size() : 0);
                    res.put("verifiedSongIds", ids);
                    call.resolve(res);
                } catch (Exception e) {
                    call.resolve(new JSObject().put("verifiedCount", 0).put("verifiedSongIds", new JSArray()));
                }
            });
        } catch (Exception e) {
            call.resolve(new JSObject().put("verifiedCount", 0).put("verifiedSongIds", new JSArray()));
        }
    }

    @PluginMethod
    public void shareSongFile(PluginCall call) {
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void setWifiOnly(PluginCall call) {
        try {
            boolean wifiOnly = call.getBoolean("wifiOnly", false);
            if (downloadManager != null) {
                downloadManager.setWifiOnly(wifiOnly);
            }
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void getPreference(PluginCall call) {
        try {
            String key = call.getString("key");
            if (key == null || key.isEmpty()) {
                call.reject("key is required");
                return;
            }

            android.content.SharedPreferences prefs = getContext().getSharedPreferences("raagax_preferences", Context.MODE_PRIVATE);
            JSObject res = new JSObject();
            if (prefs.contains(key)) {
                // Try boolean first, then string
                try {
                    boolean boolVal = prefs.getBoolean(key, false);
                    res.put("value", boolVal);
                    res.put("exists", true);
                } catch (ClassCastException cce) {
                    String strVal = prefs.getString(key, "");
                    res.put("value", strVal);
                    res.put("exists", true);
                }
            } else {
                res.put("exists", false);
                res.put("value", call.getData().opt("defaultValue"));
            }
            call.resolve(res);
        } catch (Exception e) {
            JSObject res = new JSObject();
            res.put("exists", false);
            res.put("value", call.getData().opt("defaultValue"));
            call.resolve(res);
        }
    }

    @PluginMethod
    public void setPreference(PluginCall call) {
        try {
            String key = call.getString("key");
            if (key == null || key.isEmpty()) {
                call.reject("key is required");
                return;
            }

            android.content.SharedPreferences prefs = getContext().getSharedPreferences("raagax_preferences", Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = prefs.edit();

            if (call.getData().has("value")) {
                Object val = call.getData().get("value");
                if (val instanceof Boolean) {
                    editor.putBoolean(key, (Boolean) val);
                } else if (val instanceof Integer) {
                    editor.putInt(key, (Integer) val);
                } else if (val instanceof Long) {
                    editor.putLong(key, (Long) val);
                } else if (val instanceof Float || val instanceof Double) {
                    editor.putFloat(key, ((Number) val).floatValue());
                } else {
                    editor.putString(key, String.valueOf(val));
                }
                editor.apply();
            }

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", false).put("error", e.getMessage()));
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
