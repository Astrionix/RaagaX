package com.raagax.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.ui.PlayerNotificationManager;

@OptIn(markerClass = UnstableApi.class)
public class RaagaXPlaybackService extends MediaSessionService {

    private static final String TAG = "RaagaXPlaybackService";
    private static final String CHANNEL_ID = "raagax_playback_channel";
    private static final int NOTIFICATION_ID = 1001;

    private ExoPlayer player;
    private MediaSession mediaSession;

    // Singleton reference for Capacitor plugin access
    private static RaagaXPlaybackService instance;

    public static RaagaXPlaybackService getInstance() {
        return instance;
    }

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
                .setAudioAttributes(audioAttributes, true) // handle audio focus
                .setHandleAudioBecomingNoisy(true)          // pause on headset unplug
                .setWakeMode(C.WAKE_MODE_NETWORK)           // keep CPU awake during network streaming
                .build();

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_ENDED) {
                    // Notify JS side via broadcast
                    Intent intent = new Intent("com.raagax.music.TRACK_ENDED");
                    sendBroadcast(intent);
                }
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                Intent intent = new Intent("com.raagax.music.PLAYBACK_STATE");
                intent.putExtra("isPlaying", isPlaying);
                sendBroadcast(intent);
            }
        });

        mediaSession = new MediaSession.Builder(this, player)
                .build();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        instance = null;
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    // ── Public API (called from RaagaXCapacitorPlugin) ────────────────────────

    public void playUrl(String url, String title, String artist, String artworkUrl) {
        if (player == null) return;

        MediaMetadata metadata = new MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setArtworkUri(artworkUrl != null && !artworkUrl.isEmpty()
                        ? android.net.Uri.parse(artworkUrl) : null)
                .build();

        MediaItem mediaItem = new MediaItem.Builder()
                .setUri(url)
                .setMediaMetadata(metadata)
                .build();

        player.setMediaItem(mediaItem);
        player.prepare();
        player.play();

        Log.d(TAG, "playUrl: " + title + " — " + url);
    }

    public void resume() {
        if (player != null) player.play();
    }

    public void pause() {
        if (player != null) player.pause();
    }

    public void seekTo(long positionMs) {
        if (player != null) player.seekTo(positionMs);
    }

    public void setVolume(float volume) {
        if (player != null) player.setVolume(volume);
    }

    public long getCurrentPosition() {
        return player != null ? player.getCurrentPosition() : 0L;
    }

    public long getDuration() {
        return player != null ? player.getDuration() : 0L;
    }

    public boolean isPlaying() {
        return player != null && player.isPlaying();
    }

    // ── Notification Channel ─────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "RaagaX Music Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Controls for RaagaX background playback");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
