package com.raagax.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;

/**
 * RaagaXPlaybackService — Plain foreground Service (not MediaSessionService).
 *
 * Uses a standard Android Service so Capacitor's BridgeActivity lifecycle
 * does not conflict with MediaSessionService's internal session management.
 *
 * Calls startForeground() immediately in onStartCommand() to satisfy
 * Android 12+'s 5-second foreground-service timeout requirement.
 */
@OptIn(markerClass = UnstableApi.class)
public class RaagaXPlaybackService extends Service {

    private static final String TAG         = "RaagaXPlaybackService";
    public  static final String CHANNEL_ID  = "raagax_playback_channel";
    public  static final int    NOTIF_ID    = 1001;

    private static RaagaXPlaybackService instance;

    public static RaagaXPlaybackService getInstance() { return instance; }

    private ExoPlayer player;
    private String    currentTitle  = "RaagaX";
    private String    currentArtist = "";

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build();

        player = new ExoPlayer.Builder(this)
                .setAudioAttributes(audioAttributes, /* handleAudioFocus= */ true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .build();

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    sendBroadcast(new Intent("com.raagax.music.TRACK_ENDED"));
                }
                updateNotification();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                Intent i = new Intent("com.raagax.music.PLAYBACK_STATE");
                i.putExtra("isPlaying", isPlaying);
                sendBroadcast(i);
                updateNotification();
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // ✅ Call startForeground() IMMEDIATELY — satisfies Android 12+ 5-second rule
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, buildNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, buildNotification());
        }

        if (intent != null) {
            String action = intent.getAction();
            if ("PLAY".equals(action)) {
                String url = intent.getStringExtra("url");
                String title = intent.getStringExtra("title");
                String artist = intent.getStringExtra("artist");
                if (url != null) playUrl(url, title, artist);
            } else if ("PAUSE".equals(action)) {
                pause();
            } else if ("RESUME".equals(action)) {
                resume();
            } else if ("SEEK".equals(action)) {
                seekTo(intent.getLongExtra("positionMs", 0));
            } else if ("SET_VOLUME".equals(action)) {
                setVolume(intent.getFloatExtra("volume", 1.0f));
            }
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        instance = null;
        if (player != null) { player.release(); player = null; }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Playback API (called by RaagaXCapacitorPlugin) ────────────────────────

    private final android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());

    private void runOnMainThread(Runnable r) {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            r.run();
        } else {
            mainHandler.post(r);
        }
    }

    // ── Playback API (called by RaagaXCapacitorPlugin) ────────────────────────

    public static class PlaybackSnapshot {
        public final boolean isPlaying;
        public final int playbackState;
        public final long positionMs;
        public final long durationMs;
        public final long bufferedPositionMs;
        public final String currentTitle;
        public final String currentArtist;

        public PlaybackSnapshot(boolean isPlaying, int playbackState, long positionMs, long durationMs, long bufferedPositionMs, String currentTitle, String currentArtist) {
            this.isPlaying = isPlaying;
            this.playbackState = playbackState;
            this.positionMs = positionMs;
            this.durationMs = durationMs;
            this.bufferedPositionMs = bufferedPositionMs;
            this.currentTitle = currentTitle;
            this.currentArtist = currentArtist;
        }
    }

    public PlaybackSnapshot getPlaybackSnapshot() {
        if (android.os.Looper.myLooper() != android.os.Looper.getMainLooper()) {
            Log.w(TAG, "getPlaybackSnapshot called off main thread");
            return new PlaybackSnapshot(false, Player.STATE_IDLE, 0L, 0L, 0L, currentTitle, currentArtist);
        }
        if (player == null) {
            return new PlaybackSnapshot(false, Player.STATE_IDLE, 0L, 0L, 0L, currentTitle, currentArtist);
        }
        return new PlaybackSnapshot(
                player.isPlaying(),
                player.getPlaybackState(),
                player.getCurrentPosition(),
                player.getDuration() < 0 ? 0L : player.getDuration(),
                player.getBufferedPosition(),
                currentTitle,
                currentArtist
        );
    }

    public void playUrl(String url, String title, String artist) {
        runOnMainThread(() -> {
            if (player == null || url == null || url.isEmpty()) return;

            // If the exact same track URL is already loaded in ExoPlayer, do NOT reload or seek
            MediaItem currentItem = player.getCurrentMediaItem();
            if (currentItem != null && currentItem.localConfiguration != null) {
                String currentUri = currentItem.localConfiguration.uri.toString();
                if (url.equals(currentUri)) {
                    if (!player.isPlaying()) {
                        player.play();
                    }
                    return;
                }
            }

            currentTitle  = title  != null ? title  : "RaagaX";
            currentArtist = artist != null ? artist : "";

            MediaItem item = new MediaItem.Builder()
                    .setUri(url)
                    .setMediaMetadata(new MediaMetadata.Builder()
                            .setTitle(currentTitle)
                            .setArtist(currentArtist)
                            .build())
                    .build();

            player.setMediaItem(item);
            player.prepare();
            player.play();
            updateNotification();
            Log.d(TAG, "playUrl: " + currentTitle);
        });
    }

    public void resume()           { runOnMainThread(() -> { if (player != null) player.play(); }); }
    public void pause()            { runOnMainThread(() -> { if (player != null) player.pause(); }); }
    public void seekTo(long posMs) { runOnMainThread(() -> { if (player != null) player.seekTo(posMs); }); }
    public void setVolume(float v) { runOnMainThread(() -> { if (player != null) player.setVolume(v); }); }

    public long getCurrentPosition() {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            return player != null ? player.getCurrentPosition() : 0L;
        }
        Log.w(TAG, "getCurrentPosition() called off main thread — use getPlaybackSnapshot()");
        return 0L;
    }

    public long getDuration() {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            return player != null ? player.getDuration() : 0L;
        }
        Log.w(TAG, "getDuration() called off main thread — use getPlaybackSnapshot()");
        return 0L;
    }

    public boolean isPlaying() {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            return player != null && player.isPlaying();
        }
        Log.w(TAG, "isPlaying() called off main thread — use getPlaybackSnapshot()");
        return false;
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "RaagaX Music", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("RaagaX background playback");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setContentIntent(pi)
                .setOngoing(true)
                .setSilent(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }

    private void updateNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification());
    }
}
