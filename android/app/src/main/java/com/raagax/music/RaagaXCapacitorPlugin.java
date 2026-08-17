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

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RaagaXPlayer")
public class RaagaXCapacitorPlugin extends Plugin {

    private static final String TAG = "RaagaXCapacitorPlugin";
    private boolean serviceStarted = false;

    // ── Broadcast Receiver ────────────────────────────────────────────────────
    private final BroadcastReceiver playbackReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();

            if ("com.raagax.music.TRACK_CHANGED".equals(action)) {
                JSObject data = new JSObject();
                data.put("title",  intent.getStringExtra("title"));
                data.put("artist", intent.getStringExtra("artist"));
                data.put("url",    intent.getStringExtra("url"));
                data.put("index",  intent.getIntExtra("index", 0));
                notifyListeners("trackChanged", data);

            } else if ("com.raagax.music.QUEUE_ENDED".equals(action)) {
                // Whole queue is exhausted — ask web layer to generate autoplay continuation
                notifyListeners("queueEnded", new JSObject());

            } else if ("com.raagax.music.PLAYBACK_STATE".equals(action)) {
                JSObject data = new JSObject();
                data.put("isPlaying", intent.getBooleanExtra("isPlaying", false));
                notifyListeners("playbackStateChanged", data);

            } else if ("com.raagax.music.SEEK_COMPLETE".equals(action)) {
                // Seek has been applied by ExoPlayer — notify JS so it can confirm
                // the settled position and cancel the stale-position blocking window.
                JSObject data = new JSObject();
                data.put("positionMs", intent.getLongExtra("positionMs", 0L));
                data.put("wasPlaying", intent.getBooleanExtra("wasPlaying", false));
                notifyListeners("seekComplete", data);

            } else if ("com.raagax.music.TRACK_ENDED".equals(action)) {
                // Legacy — kept for compatibility
                notifyListeners("trackEnded", new JSObject());
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
        filter.addAction("com.raagax.music.TRACK_ENDED");

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
            String[] titles   = new String[len];
            String[] artists  = new String[len];
            String[] artworks = new String[len];

            for (int i = 0; i < len; i++) {
                org.json.JSONObject obj = tracks.getJSONObject(i);
                urls[i]     = obj.optString("url", "");
                titles[i]   = obj.optString("title", "RaagaX");
                artists[i]  = obj.optString("artist", "");
                artworks[i] = obj.optString("artworkUrl", obj.optString("coverUrl", ""));
            }

            boolean autoPlay = call.getBoolean("autoPlay", true);
            long startPositionMs = call.getLong("startPositionMs", 0L);

            Intent intent = new Intent("SET_QUEUE");
            intent.putExtra("urls",             urls);
            intent.putExtra("titles",           titles);
            intent.putExtra("artists",          artists);
            intent.putExtra("artworks",         artworks);
            intent.putExtra("startIndex",       startIndex);
            intent.putExtra("startPositionMs",  startPositionMs);
            intent.putExtra("autoPlay",         autoPlay);
            sendCommandToService(intent);

            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            Log.e(TAG, "Error in setQueue: " + e.getMessage());
            call.reject("Failed to set queue: " + e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url       = call.getString("url", "");
        String title     = call.getString("title", "RaagaX");
        String artist    = call.getString("artist", "");
        String artworkUrl = call.getString("artworkUrl", "");

        if (url == null || url.isEmpty()) {
            call.reject("URL missing");
            return;
        }

        Intent intent = new Intent("PLAY");
        intent.putExtra("url",    url);
        intent.putExtra("title",  title);
        intent.putExtra("artist", artist);
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
            // Service was stopped (e.g. user swiped app away from Recents)
            // Return persisted position and ensure isPlaying is strictly false (DO NOT AUTOPLAY)
            try {
                android.content.SharedPreferences prefs = getContext().getSharedPreferences("raagax_native_playback", Context.MODE_PRIVATE);
                long pos = prefs.getLong("last_position_ms", 0L);
                String title = prefs.getString("last_title", "");
                String artist = prefs.getString("last_artist", "");
                JSObject result = new JSObject();
                result.put("isPlaying", false);
                result.put("positionMs", pos);
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
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(playbackReceiver);
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
