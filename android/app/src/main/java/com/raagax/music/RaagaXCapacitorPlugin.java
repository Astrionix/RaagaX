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

    // ── Broadcast Receiver: track ended / playback state from service ─────────
    private final BroadcastReceiver playbackReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if ("com.raagax.music.TRACK_ENDED".equals(action)) {
                notifyListeners("trackEnded", new JSObject());
            } else if ("com.raagax.music.PLAYBACK_STATE".equals(action)) {
                boolean isPlaying = intent.getBooleanExtra("isPlaying", false);
                JSObject data = new JSObject();
                data.put("isPlaying", isPlaying);
                notifyListeners("playbackStateChanged", data);
            }
        }
    };

    @Override
    public void load() {
        // Register broadcast receiver for track-ended / playback-state events
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.raagax.music.TRACK_ENDED");
        filter.addAction("com.raagax.music.PLAYBACK_STATE");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(playbackReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(playbackReceiver, filter);
        }

        // ⚠️ Do NOT start the foreground service here.
        // On Android 12+, startForegroundService() requires startForeground() within 5 seconds.
        // Media3 only posts the foreground notification when playback actually begins.
        // Starting eagerly here causes the app to be killed immediately on launch.
        // The service is started lazily from play() instead.
    }

    private void startPlaybackService() {
        if (!serviceStarted) {
            Intent serviceIntent = new Intent(getContext(), RaagaXPlaybackService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            serviceStarted = true;
            Log.d(TAG, "RaagaXPlaybackService started");
        }
    }

    private RaagaXPlaybackService getService() {
        return RaagaXPlaybackService.getInstance();
    }

    // ── Plugin Methods (called from JavaScript via Capacitor) ─────────────────

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url", "");
        String title = call.getString("title", "RaagaX");
        String artist = call.getString("artist", "");
        String artworkUrl = call.getString("artworkUrl", "");

        startPlaybackService();

        RaagaXPlaybackService service = getService();
        if (service != null && url != null && !url.isEmpty()) {
            service.playUrl(url, title, artist);
            call.resolve(new JSObject().put("success", true));
        } else {
            call.reject("Service not ready or URL missing");
        }
    }

    @PluginMethod
    public void resume(PluginCall call) {
        RaagaXPlaybackService service = getService();
        if (service != null) {
            service.resume();
            call.resolve(new JSObject().put("success", true));
        } else {
            call.reject("Service not available");
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        RaagaXPlaybackService service = getService();
        if (service != null) {
            service.pause();
            call.resolve(new JSObject().put("success", true));
        } else {
            call.reject("Service not available");
        }
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        long positionMs = call.getLong("positionMs", 0L);
        RaagaXPlaybackService service = getService();
        if (service != null) {
            service.seekTo(positionMs);
            call.resolve(new JSObject().put("success", true));
        } else {
            call.reject("Service not available");
        }
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float volume = call.getFloat("volume", 1.0f);
        RaagaXPlaybackService service = getService();
        if (service != null) {
            service.setVolume(volume);
            call.resolve(new JSObject().put("success", true));
        } else {
            call.reject("Service not available");
        }
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        RaagaXPlaybackService service = getService();
        if (service != null) {
            JSObject result = new JSObject();
            result.put("isPlaying", service.isPlaying());
            result.put("positionMs", service.getCurrentPosition());
            result.put("durationMs", service.getDuration());
            call.resolve(result);
        } else {
            call.reject("Service not available");
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
