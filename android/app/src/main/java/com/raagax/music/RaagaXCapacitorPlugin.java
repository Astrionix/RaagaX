package com.raagax.music;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.raagax.music.playback.NetworkStateMonitor;
import com.raagax.music.playback.OfflineQueueResolver;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "RaagaXPlayer")
public class RaagaXCapacitorPlugin extends Plugin {

    private static final String TAG = "RaagaXCapacitorPlugin";
    private boolean serviceStarted = false;
    private volatile boolean isAppForeground = true;

    // ── Broadcast Receiver ────────────────────────────────────────────────────
    private final BroadcastReceiver playbackReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();

            if ("com.raagax.music.TRACK_CHANGED".equals(action)) {
                JSObject data = new JSObject();
                data.put("oldTrackId",  intent.getStringExtra("oldTrackId"));
                data.put("trackId",     intent.getStringExtra("trackId"));
                data.put("title",       intent.getStringExtra("title"));
                data.put("artist",      intent.getStringExtra("artist"));
                data.put("artworkUrl",  intent.getStringExtra("artworkUrl"));
                data.put("url",         intent.getStringExtra("url"));
                int qIdx = intent.getIntExtra("queueIndex", intent.getIntExtra("index", 0));
                data.put("queueIndex",  qIdx);
                data.put("index",       qIdx);
                data.put("totalItems",  intent.getIntExtra("totalItems", 0));
                data.put("positionMs",  intent.getLongExtra("positionMs", 0L));
                data.put("durationMs",  intent.getLongExtra("durationMs", 0L));
                data.put("isPlaying",   intent.getBooleanExtra("isPlaying", true));
                data.put("timestamp",   intent.getLongExtra("timestamp", System.currentTimeMillis()));
                data.put("requestId",   intent.getLongExtra("requestId", 0L));
                notifyListeners("trackChanged", data);

            } else if ("com.raagax.music.QUEUE_ENDED".equals(action)) {
                // Whole queue is exhausted — ask web layer to generate autoplay continuation
                notifyListeners("queueEnded", new JSObject());

            } else if ("com.raagax.music.PLAYBACK_STATE".equals(action)) {
                // Skip spamming paused WebView message queue with 500ms ticks while backgrounded
                if (!isAppForeground) {
                    return;
                }
                JSObject data = new JSObject();
                data.put("isPlaying", intent.getBooleanExtra("isPlaying", false));
                data.put("positionMs", intent.getLongExtra("positionMs", 0L));
                data.put("durationMs", intent.getLongExtra("durationMs", 0L));
                notifyListeners("playbackStateChanged", data);

            } else if ("com.raagax.music.SEEK_COMPLETE".equals(action)) {
                // Seek has been applied by ExoPlayer — notify JS so it can confirm
                // the settled position and cancel the stale-position blocking window.
                JSObject data = new JSObject();
                data.put("positionMs", intent.getLongExtra("positionMs", 0L));
                data.put("wasPlaying", intent.getBooleanExtra("wasPlaying", false));
                notifyListeners("seekComplete", data);

            } else if ("com.raagax.music.ACTION_NEXT".equals(action)) {
                notifyListeners("actionNext", new JSObject());

            } else if ("com.raagax.music.ACTION_PREV".equals(action)) {
                notifyListeners("actionPrev", new JSObject());

            } else if ("com.raagax.music.TRACK_ENDED".equals(action)) {
                // Legacy — kept for compatibility
                notifyListeners("trackEnded", new JSObject());

            } else if ("com.raagax.music.OFFLINE_QUEUE_READY".equals(action)) {
                // Offline queue successfully resolved and loaded into ExoPlayer
                JSObject data = new JSObject();
                data.put("resolvedCount", intent.getIntExtra("resolvedCount", 0));
                data.put("startIndex",    intent.getIntExtra("startIndex", 0));
                data.put("firstTrackId",  intent.getStringExtra("firstTrackId"));
                notifyListeners("offlineQueueReady", data);

            } else if ("com.raagax.music.OFFLINE_QUEUE_EMPTY".equals(action)) {
                // No songs were available offline for the requested IDs
                JSObject data = new JSObject();
                data.put("requestedCount", intent.getIntExtra("requestedCount", 0));
                notifyListeners("offlineQueueEmpty", data);
            }
        }
    };

    @Override
    public void load() {
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.raagax.music.TRACK_CHANGED");
        filter.addAction("com.raagax.music.QUEUE_ENDED");
        filter.addAction("com.raagax.music.PLAYBACK_STATE");
        filter.addAction("com.raagax.music.SEEK_COMPLETE");
        filter.addAction("com.raagax.music.ACTION_NEXT");
        filter.addAction("com.raagax.music.ACTION_PREV");
        filter.addAction("com.raagax.music.TRACK_ENDED");
        filter.addAction("com.raagax.music.OFFLINE_QUEUE_READY");
        filter.addAction("com.raagax.music.OFFLINE_QUEUE_EMPTY");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(playbackReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(playbackReceiver, filter);
        }
    }

    private void sendCommandToService(Intent intent) {
        intent.setClass(getContext(), RaagaXPlaybackService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        serviceStarted = true;
    }

    private RaagaXPlaybackService getService() {
        return RaagaXPlaybackService.getInstance();
    }

    // ── Plugin Methods ────────────────────────────────────────────────────────

    /**
     * PRIMARY API — sends the complete ordered playlist to native ExoPlayer.
     * ExoPlayer auto-advances through all items natively without WebView involvement.
     *
     * Expected JS call:
     *   RaagaXPlayer.setQueue({ tracks: [{url, title, artist, artworkUrl},...], startIndex: 0 })
     */
    @PluginMethod
    public void setQueue(PluginCall call) {
        com.getcapacitor.JSArray tracks = call.getArray("tracks");
        int startIndex = call.getInt("startIndex", 0);

        if (tracks == null || tracks.length() == 0) {
            call.reject("tracks array is required");
            return;
        }

        try {
            int len = tracks.length();
            String[] urls     = new String[len];
            String[] trackIds = new String[len]; // ← now populated for mediaId
            String[] titles   = new String[len];
            String[] artists  = new String[len];
            String[] artworks = new String[len];
            double[] loudnesses = new double[len];

            for (int i = 0; i < len; i++) {
                org.json.JSONObject obj = tracks.getJSONObject(i);
                urls[i]      = obj.optString("url", "");
                trackIds[i]  = obj.optString("trackId", obj.optString("id", obj.optString("songId", "")));
                titles[i]    = obj.optString("title", "RaagaX");
                artists[i]   = obj.optString("artist", "");
                artworks[i]  = obj.optString("artworkUrl", obj.optString("coverUrl", ""));
                loudnesses[i] = obj.optDouble("loudness", Double.NaN);
            }

            boolean autoPlay = call.getBoolean("autoPlay", true);
            long startPositionMs = call.getLong("startPositionMs", 0L);
            long requestId = 0L;
            if (call.getData() != null && call.getData().has("requestId")) {
                requestId = call.getData().optLong("requestId", 0L);
            }

            Intent intent = new Intent("SET_QUEUE");
            intent.putExtra("urls",             urls);
            intent.putExtra("trackIds",         trackIds);  // ← added
            intent.putExtra("titles",           titles);
            intent.putExtra("artists",          artists);
            intent.putExtra("artworks",         artworks);
            intent.putExtra("loudnesses",       loudnesses);
            intent.putExtra("startIndex",       startIndex);
            intent.putExtra("startPositionMs",  startPositionMs);
            intent.putExtra("autoPlay",         autoPlay);
            intent.putExtra("requestId",        requestId);
            sendCommandToService(intent);

            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            Log.e(TAG, "Error in setQueue: " + e.getMessage());
            call.reject("Failed to set queue: " + e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        String trackId   = call.getString("trackId", "");
        String url       = call.getString("url", "");
        String title     = call.getString("title", "RaagaX");
        String artist    = call.getString("artist", "");
        String artworkUrl = call.getString("artworkUrl", "");
        double loudness  = call.getDouble("loudness", Double.NaN);
        long requestId = 0L;
        if (call.getData() != null && call.getData().has("requestId")) {
            requestId = call.getData().optLong("requestId", 0L);
        }

        if (url == null || url.isEmpty()) {
            call.reject("URL missing");
            return;
        }

        Intent intent = new Intent("PLAY");
        intent.putExtra("trackId",    trackId);
        intent.putExtra("url",        url);
        intent.putExtra("title",      title);
        intent.putExtra("artist",     artist);
        intent.putExtra("artworkUrl", artworkUrl);
        intent.putExtra("loudness",   loudness);
        intent.putExtra("requestId",  requestId);
        sendCommandToService(intent);
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void setNextTrack(PluginCall call) {
        String url    = call.getString("url", "");
        String title  = call.getString("title", "RaagaX");
        String artist = call.getString("artist", "");

        if (url != null && !url.isEmpty()) {
            Intent intent = new Intent("SET_NEXT");
            intent.putExtra("url",    url);
            intent.putExtra("title",  title);
            intent.putExtra("artist", artist);
            sendCommandToService(intent);
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void setNextTracksBatch(PluginCall call) {
        com.getcapacitor.JSArray tracks = call.getArray("tracks");
        if (tracks != null && tracks.length() > 0) {
            try {
                int len = tracks.length();
                String[] urls    = new String[len];
                String[] titles  = new String[len];
                String[] artists = new String[len];

                for (int i = 0; i < len; i++) {
                    org.json.JSONObject obj = tracks.getJSONObject(i);
                    urls[i]    = obj.optString("url", "");
                    titles[i]  = obj.optString("title", "RaagaX");
                    artists[i] = obj.optString("artist", "");
                }

                Intent intent = new Intent("SET_NEXT_BATCH");
                intent.putExtra("urls",    urls);
                intent.putExtra("titles",  titles);
                intent.putExtra("artists", artists);
                sendCommandToService(intent);
            } catch (Exception e) {
                Log.e(TAG, "Error in setNextTracksBatch: " + e.getMessage());
            }
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void resume(PluginCall call) {
        sendCommandToService(new Intent("RESUME"));
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void pause(PluginCall call) {
        sendCommandToService(new Intent("PAUSE"));
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void next(PluginCall call) {
        sendCommandToService(new Intent("NEXT"));
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void previous(PluginCall call) {
        sendCommandToService(new Intent("PREV"));
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        long positionMs = 0L;
        if (call.getData() != null && call.getData().has("positionMs")) {
            positionMs = call.getData().optLong("positionMs", 0L);
        } else {
            Long l = call.getLong("positionMs");
            positionMs = l != null ? l : 0L;
        }
        Log.d(TAG, "seekTo received: " + positionMs + "ms");
        RaagaXPlaybackService service = getService();
        if (service != null) {
            service.seekTo(positionMs);
        } else {
            Intent intent = new Intent("SEEK");
            intent.putExtra("positionMs", positionMs);
            sendCommandToService(intent);
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float volume = call.getFloat("volume", 1.0f);
        Intent intent = new Intent("SET_VOLUME");
        intent.putExtra("volume", volume);
        sendCommandToService(intent);
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void setPlaybackRate(PluginCall call) {
        float rate = call.getFloat("rate", 1.0f);
        RaagaXPlaybackService service = getService();
        if (service != null) {
            service.setPlaybackSpeed(rate);
        } else {
            Intent intent = new Intent("SET_SPEED");
            intent.putExtra("speed", rate);
            sendCommandToService(intent);
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        String mode = call.getString("repeatMode", "OFF");
        RaagaXPlaybackService service = getService();
        if (service != null) {
            service.setRepeatMode(mode);
        } else {
            Intent intent = new Intent("SET_REPEAT");
            intent.putExtra("repeatMode", mode);
            sendCommandToService(intent);
        }
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        RaagaXPlaybackService service = getService();
        if (service != null) {
            new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                try {
                    RaagaXPlaybackService.PlaybackSnapshot snapshot = service.getPlaybackSnapshot();
                    JSObject result = new JSObject();
                    result.put("isPlaying",          snapshot.isPlaying);
                    result.put("positionMs",          snapshot.positionMs);
                    result.put("durationMs",          snapshot.durationMs);
                    result.put("bufferedPositionMs",  snapshot.bufferedPositionMs);
                    result.put("title",               snapshot.currentTitle);
                    result.put("artist",              snapshot.currentArtist);
                    call.resolve(result);
                } catch (Exception e) {
                    call.reject("Error getting playback snapshot: " + e.getMessage());
                }
            });
        } else {
            // Service was stopped (e.g. user swiped app away from Recents / fresh boot)
            // Return restored track metadata with position strictly reset to 0:00
            try {
                android.content.SharedPreferences prefs = getContext().getSharedPreferences("raagax_native_playback", Context.MODE_PRIVATE);
                String title = prefs.getString("last_title", "");
                String artist = prefs.getString("last_artist", "");
                JSObject result = new JSObject();
                result.put("isPlaying", false);
                result.put("positionMs", 0L); // Position resets to 0:00 on fresh process launch
                result.put("durationMs", 0L);
                result.put("bufferedPositionMs", 0L);
                result.put("title", title);
                result.put("artist", artist);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Service not available: " + e.getMessage());
            }
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        isAppForeground = true;
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        isAppForeground = false;
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(playbackReceiver);
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }

    // ── Offline Playback Plugin Methods ───────────────────────────────────────

    /**
     * setOfflineQueue — Build and play an ExoPlayer queue from local files only.
     *
     * The Android layer receives song IDs, resolves them via OfflineQueueResolver
     * (Room DB + file verification), and loads only COMPLETED tracks into ExoPlayer.
     * Songs without a local copy are automatically excluded.
     *
     * JS call:
     *   RaagaXPlayer.setOfflineQueue({
     *     songIds: ['id1', 'id2', 'id3'],
     *     startIndex: 0,
     *     autoPlay: true
     *   })
     *
     * Emits 'offlineQueueReady' or 'offlineQueueEmpty' event back to JS.
     */
    @PluginMethod
    public void setOfflineQueue(PluginCall call) {
        com.getcapacitor.JSArray songIdsArray = call.getArray("songIds");
        int startIndex = call.getInt("startIndex", 0);
        boolean autoPlay = call.getBoolean("autoPlay", true);

        if (songIdsArray == null || songIdsArray.length() == 0) {
            call.reject("songIds array is required");
            return;
        }

        try {
            int len = songIdsArray.length();
            String[] songIds = new String[len];
            for (int i = 0; i < len; i++) {
                songIds[i] = songIdsArray.getString(i);
            }

            long requestId = 0L;
            if (call.getData() != null && call.getData().has("requestId")) {
                requestId = call.getData().optLong("requestId", 0L);
            }

            Intent intent = new Intent("SET_OFFLINE_QUEUE");
            intent.putExtra("songIds",    songIds);
            intent.putExtra("startIndex", startIndex);
            intent.putExtra("autoPlay",   autoPlay);
            intent.putExtra("requestId",  requestId);
            sendCommandToService(intent);

            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            Log.e(TAG, "Error in setOfflineQueue: " + e.getMessage());
            call.reject("Failed to set offline queue: " + e.getMessage());
        }
    }

    /**
     * resolveOfflineTracks — Check which songs in a given list are available offline.
     *
     * Runs OfflineQueueResolver on a background thread. Returns the same list annotated
     * with isAvailableOffline=true/false so the JS layer can build offline-filtered UIs
     * without hitting the native layer per-song.
     *
     * JS call:
     *   RaagaXPlayer.resolveOfflineTracks({ songIds: ['id1', 'id2', 'id3'] })
     *
     * Returns:
     *   {
     *     tracks: [{ songId, title, artist, artworkUrl, isAvailableOffline }],
     *     availableCount: N
     *   }
     */
    @PluginMethod
    public void resolveOfflineTracks(PluginCall call) {
        com.getcapacitor.JSArray songIdsArray = call.getArray("songIds");

        if (songIdsArray == null || songIdsArray.length() == 0) {
            call.reject("songIds array is required");
            return;
        }

        try {
            int len = songIdsArray.length();
            List<String> songIdList = new ArrayList<>();
            for (int i = 0; i < len; i++) {
                String id = songIdsArray.getString(i);
                if (id != null && !id.isEmpty()) songIdList.add(id);
            }

            // Run on background thread — Room I/O
            new Thread(() -> {
                try {
                    OfflineQueueResolver resolver = OfflineQueueResolver.getInstance(getContext());
                    List<OfflineQueueResolver.ResolvedTrack> resolvedTracks = resolver.resolve(songIdList);

                    // Build a Set for quick lookup
                    java.util.Set<String> resolvedIds = new java.util.HashSet<>();
                    java.util.Map<String, OfflineQueueResolver.ResolvedTrack> trackMap = new java.util.HashMap<>();
                    for (OfflineQueueResolver.ResolvedTrack t : resolvedTracks) {
                        resolvedIds.add(t.songId);
                        trackMap.put(t.songId, t);
                    }

                    com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
                    int availableCount = 0;
                    for (String songId : songIdList) {
                        JSObject obj = new JSObject();
                        obj.put("songId", songId);
                        boolean available = resolvedIds.contains(songId);
                        obj.put("isAvailableOffline", available);
                        if (available) {
                            OfflineQueueResolver.ResolvedTrack t = trackMap.get(songId);
                            obj.put("title",      t.title);
                            obj.put("artist",     t.artist);
                            obj.put("artworkUrl", t.artworkUrl);
                            obj.put("fileSize",   t.fileSize);
                            availableCount++;
                        }
                        arr.put(obj);
                    }

                    JSObject result = new JSObject();
                    result.put("tracks",        arr);
                    result.put("availableCount", availableCount);
                    result.put("totalCount",     songIdList.size());
                    call.resolve(result);
                } catch (Exception e) {
                    Log.e(TAG, "resolveOfflineTracks background error: " + e.getMessage());
                    call.reject("Failed to resolve offline tracks: " + e.getMessage());
                }
            }, "ResolveOfflineTracks-Thread").start();

        } catch (Exception e) {
            Log.e(TAG, "Error in resolveOfflineTracks: " + e.getMessage());
            call.reject("Failed to parse songIds: " + e.getMessage());
        }
    }

    /**
     * getNetworkState — Returns the current network online/offline state.
     *
     * Uses the centralized NetworkStateMonitor singleton (ConnectivityManager.NetworkCallback).
     * Safe to call from any thread.
     *
     * JS call:
     *   RaagaXPlayer.getNetworkState()
     *
     * Returns: { isOnline: boolean }
     */
    @PluginMethod
    public void getNetworkState(PluginCall call) {
        boolean isOnline = NetworkStateMonitor.getInstance(getContext()).isOnline();
        call.resolve(new JSObject().put("isOnline", isOnline));
    }

    @PluginMethod
    public void updateQueueUrl(PluginCall call) {
        String trackId = call.getString("trackId");
        String url = call.getString("url");
        if (trackId == null || url == null) {
            call.reject("trackId and url are required");
            return;
        }
        Intent intent = new Intent("UPDATE_QUEUE_URL");
        intent.putExtra("trackId", trackId);
        intent.putExtra("url", url);
        sendCommandToService(intent);
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void setLoudnessNormalizationEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        Intent intent = new Intent("SET_LOUDNESS_NORMALIZATION");
        intent.putExtra("enabled", enabled);
        sendCommandToService(intent);
        call.resolve(new JSObject().put("success", true));
    }
}
