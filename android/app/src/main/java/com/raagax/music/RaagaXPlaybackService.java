package com.raagax.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import android.util.LruCache;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

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

import com.raagax.music.playback.NetworkStateMonitor;
import com.raagax.music.playback.OfflineQueueResolver;

/**
 * RaagaXPlaybackService — Native Android foreground playback service.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 * The primary command is now SET_QUEUE which hands ExoPlayer the FULL ordered
 * playlist. ExoPlayer then auto-advances through all items natively in the
 * background without requiring the WebView or JavaScript to wake up.
 *
 * TRACK_ENDED is no longer broadcast on every song end. Instead:
 *   • onMediaItemTransition  → TRACK_CHANGED   (UI sync)
 *   • STATE_ENDED (queue exhausted) → QUEUE_ENDED
 *
 * This breaks the dependency where the WebView had to call SET_NEXT for every
 * song transition, which caused playback to stop if the WebView was suspended.
 */
@OptIn(markerClass = UnstableApi.class)
public class RaagaXPlaybackService extends Service {

    private static final String TAG         = "RaagaXPlaybackService";
    public  static final String CHANNEL_ID  = "raagax_playback_channel";
    public  static final int    NOTIF_ID    = 1001;

    private static RaagaXPlaybackService instance;
    public static RaagaXPlaybackService getInstance() { return instance; }

    private ExoPlayer player;
    private androidx.media3.session.MediaSession mediaSession;
    private String    currentTrackId     = "";
    private String    currentTitle       = "RaagaX";
    private String    currentArtist      = "";
    private String    currentArtworkUrl  = "";
    private Bitmap    currentArtworkBitmap = null;
    private final LruCache<String, Bitmap> artworkCache = new LruCache<>(20);
    private long      activeRequestId    = 0L;
    private boolean   isCurrentLocalPlayback = false;
    private long      lastReportedDurationMs = 0L;
    private volatile boolean isPreparingNewTrack = false;

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

        androidx.media3.datasource.DefaultDataSource.Factory dataSourceFactory =
                new androidx.media3.datasource.DefaultDataSource.Factory(this);
        androidx.media3.extractor.DefaultExtractorsFactory extractorsFactory =
                new androidx.media3.extractor.DefaultExtractorsFactory()
                        .setConstantBitrateSeekingEnabled(true);
        androidx.media3.exoplayer.source.DefaultMediaSourceFactory mediaSourceFactory =
                new androidx.media3.exoplayer.source.DefaultMediaSourceFactory(this, extractorsFactory)
                        .setDataSourceFactory(dataSourceFactory);

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(mediaSourceFactory)
                .setAudioAttributes(audioAttributes, /* handleAudioFocus= */ true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_LOCAL)
                .build();

        // Strict Anti-Autoplay Rule: Player boots strictly paused with no media loaded
        player.setPlayWhenReady(false);

        try {
            mediaSession = new androidx.media3.session.MediaSession.Builder(this, player).build();
        } catch (Exception e) {
            Log.e(TAG, "Failed to create MediaSession: " + e.getMessage());
        }

        player.addListener(new Player.Listener() {

            // ── Track changed (auto-advance or manual next/prev) ──────────────
            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                // If the reason is a seek within the track, ignore to prevent restarting or resetting state
                if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_SEEK) {
                    return;
                }

                if (mediaItem != null && mediaItem.mediaMetadata != null) {
                    String itemTrackId = mediaItem.mediaId != null ? mediaItem.mediaId : "";
                    if (!itemTrackId.isEmpty()) {
                        if (!currentTrackId.isEmpty() && !currentTrackId.equals(itemTrackId)) {
                            Log.w(TAG, "[ANDROID_PLAYBACK_DESYNC] currentTrackId=" + currentTrackId + " != mediaItem.mediaId=" + itemTrackId);
                        }
                        currentTrackId = itemTrackId;
                    }

                    currentTitle  = mediaItem.mediaMetadata.title  != null ? mediaItem.mediaMetadata.title.toString()  : "RaagaX";
                    currentArtist = mediaItem.mediaMetadata.artist != null ? mediaItem.mediaMetadata.artist.toString() : "";
                    Uri artUri = mediaItem.mediaMetadata.artworkUri;
                    String artUrl = artUri != null ? artUri.toString() : "";
                    loadArtworkAsync(artUrl);
                    updateNotification();

                    Intent i = new Intent("com.raagax.music.TRACK_CHANGED");
                    i.putExtra("trackId",    currentTrackId);
                    i.putExtra("title",      currentTitle);
                    i.putExtra("artist",     currentArtist);
                    i.putExtra("artworkUrl", artUrl);
                    i.putExtra("index",      player.getCurrentMediaItemIndex());
                    i.putExtra("reason",     reason);
                    i.putExtra("requestId",  activeRequestId);
                    if (mediaItem.localConfiguration != null) {
                        i.putExtra("url", mediaItem.localConfiguration.uri.toString());
                    }
                    sendBroadcast(i);
                }
            }

            // ── Native Seek Confirmation from ExoPlayer read head ─────────────
            @Override
            public void onPositionDiscontinuity(Player.PositionInfo oldPosition, Player.PositionInfo newPosition, int reason) {
                if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                    long confirmedPos = newPosition.positionMs;
                    boolean isPlaying = player != null && player.isPlaying();
                    Log.d(TAG, "[SEEK_CONFIRMED] ExoPlayer discontinuity settled: old=" + oldPosition.positionMs + "ms -> confirmed=" + confirmedPos + "ms | isPlaying=" + isPlaying);

                    Intent seekDone = new Intent("com.raagax.music.SEEK_COMPLETE");
                    seekDone.putExtra("positionMs", confirmedPos);
                    seekDone.putExtra("wasPlaying", isPlaying);
                    sendBroadcast(seekDone);
                }
            }

            // ── Playback state ────────────────────────────────────────────────
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    if (isPreparingNewTrack) {
                        Log.w(TAG, "onPlaybackStateChanged: STATE_ENDED suppressed during new track preparation");
                        return;
                    }
                    long pos = player != null ? player.getCurrentPosition() : 0L;
                    long dur = player != null && player.getDuration() > 0 ? player.getDuration() : 0L;
                    Log.d(TAG, "onPlaybackStateChanged: STATE_ENDED pos=" + pos + " dur=" + dur);
                    if (dur > 0 && pos >= (dur - 2500)) {
                        Log.d(TAG, "onPlaybackStateChanged: STATE_ENDED — track finished naturally, sending QUEUE_ENDED");
                        sendBroadcast(new Intent("com.raagax.music.QUEUE_ENDED"));
                    } else {
                        Log.w(TAG, "onPlaybackStateChanged: STATE_ENDED received at pos=" + pos + " < dur=" + dur + " (suppressing false premature skip)");
                    }
                } else if (state == Player.STATE_READY) {
                    isPreparingNewTrack = false;
                    boolean isPlaying = player != null && (player.isPlaying() || player.getPlayWhenReady());
                    long dur = player != null && player.getDuration() > 0 ? player.getDuration() : 0L;
                    long pos = player != null ? player.getCurrentPosition() : 0L;
                    if (dur == 0L && lastReportedDurationMs > 0L) {
                        Log.w(TAG, "[PLAYBACK_STATE_RESET] trackId=" + currentTrackId + " oldDuration=" + lastReportedDurationMs + " newDuration=0 reason=ready_state_reset");
                    }
                    if (dur > 0L) {
                        lastReportedDurationMs = dur;
                    }
                    Log.d(TAG, "[EXOPLAYER_READY] trackId=" + currentTrackId + " duration=" + dur);
                    Log.d(TAG, "[PLAYBACK_STATE] trackId=" + currentTrackId + " isPlaying=" + isPlaying + " position=" + pos + " duration=" + dur + " source=" + (isCurrentLocalPlayback ? "LOCAL" : "NETWORK"));
                    Log.d(TAG, "[RAAGAX_LOCAL_PLAYBACK_READY] songId=" + currentTrackId + " state=READY duration=" + dur + " isPlaying=" + isPlaying);
                    Log.d(TAG, "[DIRECT_LOCAL_TEST] STATE_READY duration=" + dur);

                    if (isCurrentLocalPlayback) {
                        Log.d(TAG, "[DIRECT_LOCAL_TEST] PLAY_STARTED");
                        mainHandler.postDelayed(() -> {
                            if (player != null && isCurrentLocalPlayback) {
                                Log.d(TAG, "[DIRECT_LOCAL_TEST] PROGRESS (500ms) pos=" + player.getCurrentPosition() + " isPlaying=" + player.isPlaying());
                            }
                        }, 500);
                        mainHandler.postDelayed(() -> {
                            if (player != null && isCurrentLocalPlayback) {
                                Log.d(TAG, "[DIRECT_LOCAL_TEST] PROGRESS (1000ms) pos=" + player.getCurrentPosition() + " isPlaying=" + player.isPlaying());
                            }
                        }, 1000);
                        mainHandler.postDelayed(() -> {
                            if (player != null && isCurrentLocalPlayback) {
                                Log.d(TAG, "[DIRECT_LOCAL_TEST] PROGRESS (2000ms) pos=" + player.getCurrentPosition() + " isPlaying=" + player.isPlaying());
                            }
                        }, 2000);
                    }

                    Intent i = new Intent("com.raagax.music.PLAYBACK_STATE");
                    i.putExtra("isPlaying", isPlaying);
                    i.putExtra("positionMs", pos);
                    i.putExtra("durationMs", dur);
                    i.putExtra("timestamp", System.currentTimeMillis());
                    sendBroadcast(i);
                }
                updateNotification();
            }

            @Override
            public void onPlayerError(androidx.media3.common.PlaybackException error) {
                Log.e(TAG, "[RAAGAX_LOCAL_PLAYBACK_ERROR] songId=" + currentTrackId + " errorCode=" + error.errorCode + " message=" + error.getMessage() + " cause=" + error.getCause());
                android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
                android.net.NetworkInfo activeNetwork = cm != null ? cm.getActiveNetworkInfo() : null;
                boolean isOnline = activeNetwork != null && activeNetwork.isConnectedOrConnecting();

                if (isCurrentLocalPlayback && currentTrackId != null && !currentTrackId.isEmpty() && isOnline) {
                    Log.w(TAG, "[RAAGAX_LOCAL_PLAYBACK_ERROR] Local playback failed for songId=" + currentTrackId + " -> Automatic online fallback stream initiating...");
                    isCurrentLocalPlayback = false;
                    final String fallbackTrackId = currentTrackId;
                    final String fallbackTitle = currentTitle;
                    final String fallbackArtist = currentArtist;
                    final String fallbackArt = currentArtworkUrl;
                    new Thread(() -> {
                        try {
                            com.raagax.music.data.provider.SaavnMusicProvider provider = com.raagax.music.data.provider.SaavnMusicProvider.getInstance();
                            com.raagax.music.data.model.MusicTrack track = provider.getTrackDetails(fallbackTrackId);
                            if (track != null && track.streamUrl != null && !track.streamUrl.isEmpty()) {
                                Log.d(TAG, "[RAAGAX_LOCAL_FALLBACK] Resolved online stream for fallback: " + track.streamUrl);
                                runOnMainThread(() -> {
                                    playUrl(fallbackTrackId, track.streamUrl, fallbackTitle, fallbackArtist, fallbackArt);
                                });
                            }
                        } catch (Exception ex) {
                            Log.e(TAG, "[RAAGAX_LOCAL_FALLBACK] Online fallback resolution failed: " + ex.getMessage());
                        }
                    }).start();
                }
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                long now = System.currentTimeMillis();
                int state = player != null ? player.getPlaybackState() : -1;
                long pos = player != null ? player.getCurrentPosition() : 0L;
                long dur = player != null && player.getDuration() > 0 ? player.getDuration() : (lastReportedDurationMs > 0 ? lastReportedDurationMs : 0L);
                boolean playWhenReady = player != null && player.getPlayWhenReady();
                if (dur == 0L && lastReportedDurationMs > 0L) {
                    Log.w(TAG, "[PLAYBACK_STATE_RESET] trackId=" + currentTrackId + " oldDuration=" + lastReportedDurationMs + " newDuration=0 reason=is_playing_changed_reset");
                }
                if (dur > 0L) {
                    lastReportedDurationMs = dur;
                }
                Log.d(TAG, "[PLAYBACK_TRANSITION] isPlaying=" + isPlaying + " | exoplayerState=" + state + " | playWhenReady=" + playWhenReady + " | positionMs=" + pos + " | durationMs=" + dur + " | timestamp=" + now + " | title=" + currentTitle);

                if (isPlaying) {
                    Log.d(TAG, "[EXOPLAYER_STARTED] trackId=" + currentTrackId + " position=" + pos + " duration=" + dur);
                    Log.d(TAG, "[PLAYBACK_STATE] trackId=" + currentTrackId + " isPlaying=true position=" + pos + " duration=" + dur + " source=" + (isCurrentLocalPlayback ? "LOCAL" : "NETWORK"));
                    Log.d(TAG, "[RAAGAX_LOCAL_PLAYBACK_STARTED] songId=" + currentTrackId + " positionMs=" + pos + " durationMs=" + dur);
                }

                // During BUFFERING or READY before first audio render, if playWhenReady is true, playback intent is PLAYING
                boolean effectivePlaying = isPlaying || ((state == Player.STATE_BUFFERING || state == Player.STATE_READY) && playWhenReady);

                Intent i = new Intent("com.raagax.music.PLAYBACK_STATE");
                i.putExtra("isPlaying", effectivePlaying);
                i.putExtra("positionMs", pos);
                i.putExtra("durationMs", dur);
                i.putExtra("timestamp", now);
                sendBroadcast(i);
                updateNotification();
            }
        });
    }

    private void loadArtworkAsync(String url) {
        if (url == null || url.isEmpty()) {
            currentArtworkBitmap = null;
            currentArtworkUrl = "";
            updateNotification();
            return;
        }
        if (url.equals(currentArtworkUrl) && currentArtworkBitmap != null) {
            return;
        }
        currentArtworkUrl = url;
        Bitmap cached = artworkCache.get(url);
        if (cached != null) {
            currentArtworkBitmap = cached;
            updateNotification();
            return;
        }
        new Thread(() -> {
            try {
                URL u = new URL(url);
                HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(4000);
                conn.setDoInput(true);
                conn.connect();
                InputStream in = conn.getInputStream();
                Bitmap b = BitmapFactory.decodeStream(in);
                if (b != null) {
                    artworkCache.put(url, b);
                    if (url.equals(currentArtworkUrl)) {
                        currentArtworkBitmap = b;
                        runOnMainThread(this::updateNotification);
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to load artwork: " + e.getMessage());
            }
        }).start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // ✅ Call startForeground() IMMEDIATELY — satisfies Android 12+ 5-second rule
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, buildNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, buildNotification());
        }

        if (intent == null) {
            runOnMainThread(() -> {
                if (player != null) {
                    player.setPlayWhenReady(false);
                    player.pause();
                    player.stop();
                    player.clearMediaItems();
                }
            });
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        long receivedAt = System.currentTimeMillis();
        long reqId = intent.getLongExtra("requestId", 0L);
        Log.d(TAG, "[COMMAND_RECEIVED] action=" + action + " | reqId=" + reqId + " | timestamp=" + receivedAt);

        if (reqId > 0 && reqId < activeRequestId) {
            Log.w(TAG, "[STALE_INTENT_DROPPED] reqId=" + reqId + " < activeRequestId=" + activeRequestId + " for action=" + action);
            return START_NOT_STICKY;
        }
        if (reqId > 0) {
            activeRequestId = reqId;
        }

        if ("SET_QUEUE".equals(action)) {
            // ── PRIMARY command: full ordered playlist ────────────────────
            String[] urls        = intent.getStringArrayExtra("urls");
            String[] trackIds    = intent.getStringArrayExtra("trackIds");   // mediaId per item
            String[] titles      = intent.getStringArrayExtra("titles");
            String[] artists     = intent.getStringArrayExtra("artists");
            String[] artworks    = intent.getStringArrayExtra("artworks");
            int startIndex       = intent.getIntExtra("startIndex", 0);
            long startPositionMs = intent.getLongExtra("startPositionMs", 0L);
            boolean autoPlay     = intent.getBooleanExtra("autoPlay", true);
            Log.d(TAG, "[SET_QUEUE_INTENT] tracks=" + (urls != null ? urls.length : 0) + " | startIndex=" + startIndex + " | startPos=" + startPositionMs + "ms | autoPlay=" + autoPlay + " | reqId=" + reqId);
            if (urls != null && urls.length > 0) {
                setQueue(urls, trackIds, titles, artists, artworks, startIndex, startPositionMs, autoPlay);
            }

        } else if ("SET_OFFLINE_QUEUE".equals(action)) {
            // ── OFFLINE command: accepts songIds[], resolves local files ──
            String[] songIds     = intent.getStringArrayExtra("songIds");
            int startIndex       = intent.getIntExtra("startIndex", 0);
            boolean autoPlay     = intent.getBooleanExtra("autoPlay", true);
            Log.d(TAG, "[SET_OFFLINE_QUEUE_INTENT] songIds=" + (songIds != null ? songIds.length : 0)
                    + " | startIndex=" + startIndex + " | autoPlay=" + autoPlay + " | reqId=" + reqId);
            if (songIds != null && songIds.length > 0) {
                setOfflineQueue(songIds, startIndex, autoPlay);
            }

        } else if ("PLAY".equals(action)) {
            String trackId    = intent.getStringExtra("trackId");
            String url        = intent.getStringExtra("url");
            String title      = intent.getStringExtra("title");
            String artist     = intent.getStringExtra("artist");
            String artworkUrl = intent.getStringExtra("artworkUrl");
            Log.d(TAG, "[PLAY_INTENT] trackId=" + trackId + " | url=" + url + " | title=" + title + " | artist=" + artist + " | art=" + artworkUrl + " | reqId=" + reqId);
            if (url != null) playUrl(trackId != null ? trackId : "", url, title, artist, artworkUrl);

        } else if ("SET_NEXT".equals(action)) {
            String url    = intent.getStringExtra("url");
            String title  = intent.getStringExtra("title");
            String artist = intent.getStringExtra("artist");
            if (url != null) setNextTrack(url, title, artist);

        } else if ("SET_NEXT_BATCH".equals(action)) {
            String[] urls    = intent.getStringArrayExtra("urls");
            String[] titles  = intent.getStringArrayExtra("titles");
            String[] artists = intent.getStringArrayExtra("artists");
            if (urls != null && urls.length > 0) setNextTracksBatch(urls, titles, artists);

        } else if ("TOGGLE_PLAY".equals(action)) {
            runOnMainThread(() -> {
                if (player != null) {
                    if (player.isPlaying()) player.pause();
                    else player.play();
                }
            });

        } else if ("PREV".equals(action)) {
            runOnMainThread(() -> {
                Log.d(TAG, "PREV action received -> broadcasting ACTION_PREV to session");
                Intent i = new Intent("com.raagax.music.ACTION_PREV");
                sendBroadcast(i);
            });

        } else if ("NEXT".equals(action)) {
            runOnMainThread(() -> {
                Log.d(TAG, "NEXT action received -> broadcasting ACTION_NEXT to session");
                Intent i = new Intent("com.raagax.music.ACTION_NEXT");
                sendBroadcast(i);
            });

        } else if ("PAUSE".equals(action))  { pause(); }
        else if ("RESUME".equals(action))    { resume(); }
        else if ("SEEK".equals(action))      { seekTo(intent.getLongExtra("positionMs", 0)); }
        else if ("SET_VOLUME".equals(action)){ setVolume(intent.getFloatExtra("volume", 1.0f)); }
        else if ("SET_REPEAT".equals(action)){ setRepeatMode(intent.getStringExtra("repeatMode")); }
        else if ("STOP".equals(action)) {
            runOnMainThread(() -> {
                if (player != null) {
                    player.setPlayWhenReady(false);
                    player.pause();
                    player.stop();
                    player.clearMediaItems();
                }
                stopForeground(true);
                stopSelf();
            });
        }

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        instance = null;
        if (mediaSession != null) { mediaSession.release(); mediaSession = null; }
        if (player != null) { player.release(); player = null; }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Main-thread helper ────────────────────────────────────────────────────

    private final android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());

    private void runOnMainThread(Runnable r) {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) r.run();
        else mainHandler.post(r);
    }

    // ── PlaybackSnapshot ──────────────────────────────────────────────────────

    public static class PlaybackSnapshot {
        public final boolean isPlaying;
        public final int playbackState;
        public final long positionMs;
        public final long durationMs;
        public final long bufferedPositionMs;
        public final String currentTitle;
        public final String currentArtist;

        public PlaybackSnapshot(boolean isPlaying, int playbackState, long positionMs, long durationMs, long bufferedPositionMs, String currentTitle, String currentArtist) {
            this.isPlaying          = isPlaying;
            this.playbackState      = playbackState;
            this.positionMs         = positionMs;
            this.durationMs         = durationMs;
            this.bufferedPositionMs = bufferedPositionMs;
            this.currentTitle       = currentTitle;
            this.currentArtist      = currentArtist;
        }
    }

    public PlaybackSnapshot getPlaybackSnapshot() {
        if (android.os.Looper.myLooper() != android.os.Looper.getMainLooper()) {
            return new PlaybackSnapshot(false, Player.STATE_IDLE, 0L, 0L, 0L, currentTitle, currentArtist);
        }
        if (player == null) {
            return new PlaybackSnapshot(false, Player.STATE_IDLE, 0L, 0L, 0L, currentTitle, currentArtist);
        }
        boolean isPlaying = player.isPlaying();
        boolean playWhenReady = player.getPlayWhenReady();
        int state = player.getPlaybackState();
        boolean effectivePlaying = isPlaying || (state == Player.STATE_BUFFERING && playWhenReady);
        long dur = player.getDuration() < 0 ? 0L : player.getDuration();
        if (dur == 0L && lastReportedDurationMs > 0L) {
            dur = lastReportedDurationMs;
        }
        return new PlaybackSnapshot(
                effectivePlaying,
                state,
                player.getCurrentPosition(),
                dur,
                player.getBufferedPosition(),
                currentTitle,
                currentArtist
        );
    }

    // ── PRIMARY API ───────────────────────────────────────────────────────────

    public static Uri parsePlayableUri(String url) {
        if (url == null || url.trim().isEmpty()) return Uri.EMPTY;
        String trimmed = url.trim();
        if (trimmed.startsWith("http://localhost/_capacitor_file_")) {
            String localPath = trimmed.replace("http://localhost/_capacitor_file_", "");
            if (!localPath.startsWith("/")) localPath = "/" + localPath;
            return Uri.fromFile(new java.io.File(localPath));
        }
        if (trimmed.startsWith("https://localhost/_capacitor_file_")) {
            String localPath = trimmed.replace("https://localhost/_capacitor_file_", "");
            if (!localPath.startsWith("/")) localPath = "/" + localPath;
            return Uri.fromFile(new java.io.File(localPath));
        }
        if (trimmed.startsWith("file://")) {
            String localPath = trimmed.substring(7);
            try {
                localPath = java.net.URLDecoder.decode(localPath, "UTF-8");
            } catch (Exception ignored) {}
            return Uri.fromFile(new java.io.File(localPath));
        }
        if (trimmed.startsWith("/") || trimmed.startsWith("/storage/") || trimmed.startsWith("/data/")) {
            return Uri.fromFile(new java.io.File(trimmed));
        }
        return Uri.parse(trimmed);
    }

    /**
     * setQueue — THE primary playback command.
     *
     * Replaces the entire ExoPlayer playlist with the provided ordered list of
     * tracks and starts playing from startIndex. ExoPlayer then auto-advances
     * through all items natively without WebView involvement.
     *
     * trackIds[] is now the canonical mediaId array. Each MediaItem.mediaId is
     * set to the song ID, enabling the onMediaItemTransition desync guard to
     * correctly identify which track ExoPlayer is actually playing.
     */
    public void setQueue(String[] urls, String[] trackIds, String[] titles, String[] artists,
                         String[] artworks, int startIndex, long startPositionMs, boolean autoPlay) {
        runOnMainThread(() -> {
            if (player == null || urls == null || urls.length == 0) return;

            isPreparingNewTrack = true;
            List<androidx.media3.exoplayer.source.MediaSource> sources = new ArrayList<>();
            androidx.media3.extractor.DefaultExtractorsFactory extractorsFactory =
                    new androidx.media3.extractor.DefaultExtractorsFactory()
                            .setConstantBitrateSeekingEnabled(true);

            androidx.media3.datasource.DefaultDataSource.Factory dataSourceFactory =
                    new androidx.media3.datasource.DefaultDataSource.Factory(this);

            for (int i = 0; i < urls.length; i++) {
                String u = urls[i];
                if (u == null || u.isEmpty()) continue;
                // Use trackId as mediaId when available — critical for desync guard
                String id  = (trackIds != null && i < trackIds.length && trackIds[i] != null && !trackIds[i].isEmpty())
                             ? trackIds[i] : "";
                String t   = (titles   != null && i < titles.length   && titles[i]   != null) ? titles[i]   : "RaagaX";
                String a   = (artists  != null && i < artists.length  && artists[i]  != null) ? artists[i]  : "";
                String art = (artworks != null && i < artworks.length && artworks[i] != null) ? artworks[i] : "";

                MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                        .setTitle(t)
                        .setArtist(a);

                if (!art.isEmpty()) {
                    try {
                        metaBuilder.setArtworkUri(parsePlayableUri(art));
                    } catch (Exception ignored) {}
                }

                Uri itemUri = parsePlayableUri(u);
                MediaItem.Builder miBuilder = new MediaItem.Builder()
                        .setUri(itemUri)
                        .setMediaMetadata(metaBuilder.build());
                if (!id.isEmpty()) {
                    miBuilder.setMediaId(id);
                }
                MediaItem mi = miBuilder.build();

                sources.add(new androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(
                        dataSourceFactory,
                        extractorsFactory
                ).createMediaSource(mi));
            }

            if (sources.isEmpty()) return;

            int safeIndex = Math.max(0, Math.min(startIndex, sources.size() - 1));
            long safePositionMs = Math.max(0L, startPositionMs);

            boolean isOnline = NetworkStateMonitor.getInstance(this).isOnline();
            Log.d(TAG, "[PLAYBACK_MODE] mode=" + (isOnline ? "ONLINE" : "OFFLINE"));
            Log.d(TAG, "[OFFLINE_QUEUE] tracks=" + sources.size() + " downloadedOnly=" + (!isOnline));
            Log.d(TAG, "[QUEUE_UPDATE] reason=setQueue mode=" + (isOnline ? "ONLINE" : "OFFLINE")
                    + " currentTrack=" + (titles != null && safeIndex < titles.length ? titles[safeIndex] : "")
                    + " action=SET");

            // Set the complete playlist — ExoPlayer starts from designated track & position
            player.setMediaSources(sources, safeIndex, safePositionMs);
            player.prepare();
            if (autoPlay) {
                player.setPlayWhenReady(true);
                player.play();
            } else {
                player.setPlayWhenReady(false);
                player.pause();
            }
            if (artworks != null && safeIndex < artworks.length) {
                loadArtworkAsync(artworks[safeIndex]);
            }
            saveNativeQueueToPrefs(urls, titles, artists, safeIndex);
            updateNotification();
            Log.d(TAG, "setQueue: " + sources.size() + " items, startIndex=" + safeIndex
                    + ", startPos=" + safePositionMs + "ms, autoPlay=" + autoPlay);
        });
    }

    // ── setQueue overloads (backward compat) ──────────────────────────────────

    /** Legacy overload without trackIds — mediaId will be empty on each MediaItem. */
    public void setQueue(String[] urls, String[] titles, String[] artists, String[] artworks,
                         int startIndex, long startPositionMs, boolean autoPlay) {
        setQueue(urls, /*trackIds=*/null, titles, artists, artworks, startIndex, startPositionMs, autoPlay);
    }

    public void setQueue(String[] urls, String[] titles, String[] artists,
                         int startIndex, long startPositionMs, boolean autoPlay) {
        setQueue(urls, null, titles, artists, null, startIndex, startPositionMs, autoPlay);
    }

    public void setQueue(String[] urls, String[] titles, String[] artists, int startIndex, boolean autoPlay) {
        setQueue(urls, null, titles, artists, null, startIndex, 0L, autoPlay);
    }

    public void setQueue(String[] urls, String[] titles, String[] artists, int startIndex) {
        setQueue(urls, null, titles, artists, null, startIndex, 0L, true);
    }

    // ── Offline queue: songIds → Room → local file URIs → ExoPlayer ──────────

    /**
     * setOfflineQueue — Offline-only playback entry point.
     *
     * Accepts an ordered list of song IDs. Resolves each one via OfflineQueueResolver
     * (Room DB lookup + file verification) on a background thread, then builds an
     * ExoPlayer queue containing only songs with verified local files.
     *
     * Architecture:
     *   songIds[]
     *       ↓ (background thread)
     *   OfflineQueueResolver.resolve()
     *       ↓  filters: COMPLETED + file.exists()
     *   ResolvedTrack[]
     *       ↓ (main thread)
     *   MediaItem(mediaId=songId, uri=file://...)
     *       ↓
     *   ExoPlayer queue
     *
     * Songs without a COMPLETED download are silently excluded from the queue.
     * If nothing resolves (no songs downloaded), nothing is played.
     */
    public void setOfflineQueue(String[] songIds, int startIndex, boolean autoPlay) {
        if (songIds == null || songIds.length == 0) return;

        Log.d(TAG, "[SET_OFFLINE_QUEUE] Resolving " + songIds.length + " songIds on background thread");

        // ── Background thread: Room DB lookup + file verification ────────────
        new Thread(() -> {
            List<String> idList = new ArrayList<>();
            for (String id : songIds) {
                if (id != null && !id.isEmpty()) idList.add(id);
            }

            OfflineQueueResolver resolver = OfflineQueueResolver.getInstance(this);
            List<OfflineQueueResolver.ResolvedTrack> resolved = resolver.resolve(idList);

            if (resolved.isEmpty()) {
                Log.w(TAG, "[SET_OFFLINE_QUEUE] No offline tracks available for " + idList.size() + " requested song IDs");
                // Broadcast so the JS layer can show 'Nothing available offline'
                Intent notAvail = new Intent("com.raagax.music.OFFLINE_QUEUE_EMPTY");
                notAvail.putExtra("requestedCount", idList.size());
                sendBroadcast(notAvail);
                return;
            }

            Log.d(TAG, "[SET_OFFLINE_QUEUE] Resolved " + resolved.size() + " offline tracks");

            // Clamp startIndex to the resolved (filtered) list length
            int safeIndex = Math.max(0, Math.min(startIndex, resolved.size() - 1));

            // ── Main thread: build MediaItems and hand to ExoPlayer ──────────
            runOnMainThread(() -> {
                if (player == null) return;

                isPreparingNewTrack = true;
                isCurrentLocalPlayback = true;

                androidx.media3.extractor.DefaultExtractorsFactory extractorsFactory =
                        new androidx.media3.extractor.DefaultExtractorsFactory()
                                .setConstantBitrateSeekingEnabled(true);
                androidx.media3.datasource.DefaultDataSource.Factory dataSourceFactory =
                        new androidx.media3.datasource.DefaultDataSource.Factory(this);

                List<androidx.media3.exoplayer.source.MediaSource> sources = new ArrayList<>();

                for (OfflineQueueResolver.ResolvedTrack track : resolved) {
                    MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                            .setTitle(track.title)
                            .setArtist(track.artist);

                    if (!track.artworkUrl.isEmpty()) {
                        try {
                            metaBuilder.setArtworkUri(parsePlayableUri(track.artworkUrl));
                        } catch (Exception ignored) {}
                    }

                    // ── THE KEY: mediaId = songId ────────────────────────────
                    // This is what makes onMediaItemTransition's desync guard work
                    // correctly during offline auto-advance.
                    MediaItem mi = new MediaItem.Builder()
                            .setMediaId(track.songId)          // ← songId as identity
                            .setUri(track.localUri)            // ← verified file:// URI
                            .setMediaMetadata(metaBuilder.build())
                            .build();

                    sources.add(new androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(
                            dataSourceFactory, extractorsFactory
                    ).createMediaSource(mi));
                }

                if (sources.isEmpty()) return;

                // Set starting track metadata so notification updates immediately
                OfflineQueueResolver.ResolvedTrack startTrack = resolved.get(safeIndex);
                currentTrackId = startTrack.songId;
                currentTitle   = startTrack.title;
                currentArtist  = startTrack.artist;
                loadArtworkAsync(startTrack.artworkUrl);

                player.setMediaSources(sources, safeIndex, 0L);
                player.prepare();
                if (autoPlay) {
                    player.setPlayWhenReady(true);
                    player.play();
                } else {
                    player.setPlayWhenReady(false);
                    player.pause();
                }
                updateNotification();

                Log.d(TAG, "[SET_OFFLINE_QUEUE] ExoPlayer loaded: "
                        + sources.size() + " local tracks, startIndex=" + safeIndex
                        + ", autoPlay=" + autoPlay
                        + ", firstTrack=" + startTrack.songId);

                // Broadcast the actual resolved queue back to JS (for UI sync)
                Intent queueReady = new Intent("com.raagax.music.OFFLINE_QUEUE_READY");
                queueReady.putExtra("resolvedCount", resolved.size());
                queueReady.putExtra("startIndex",    safeIndex);
                queueReady.putExtra("firstTrackId",  startTrack.songId);
                sendBroadcast(queueReady);
            });
        }, "OfflineQueueResolver-Thread").start();
    }

    private void saveNativeQueueToPrefs(String[] urls, String[] titles, String[] artists, int startIndex) {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("raagax_native_playback", android.content.Context.MODE_PRIVATE);
            android.content.SharedPreferences.Editor editor = prefs.edit();
            org.json.JSONArray array = new org.json.JSONArray();
            for (int i = 0; i < urls.length; i++) {
                org.json.JSONObject obj = new org.json.JSONObject();
                obj.put("url", urls[i]);
                obj.put("title", titles != null && i < titles.length ? titles[i] : "RaagaX");
                obj.put("artist", artists != null && i < artists.length ? artists[i] : "");
                array.put(obj);
            }
            editor.putString("queue_json", array.toString());
            editor.putInt("start_index", startIndex);
            editor.apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to save native queue: " + e.getMessage());
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.d(TAG, "onTaskRemoved: Activity swiped away from Recents. Terminating playback and saving session.");

        // 1. Save current playback snapshot to SharedPreferences before shutdown
        if (player != null) {
            try {
                android.content.SharedPreferences prefs = getSharedPreferences("raagax_native_playback", android.content.Context.MODE_PRIVATE);
                android.content.SharedPreferences.Editor editor = prefs.edit();
                editor.putLong("last_position_ms", Math.max(0, player.getCurrentPosition()));
                editor.putInt("last_index", player.getCurrentMediaItemIndex());
                editor.putString("last_title", currentTitle);
                editor.putString("last_artist", currentArtist);
                editor.putBoolean("was_playing_when_killed", false); // HARD RULE: Never auto-play on next app launch
                editor.putBoolean("was_task_removed", true);
                editor.putString("playback_state", "STOPPED");
                editor.putString("device_state", "TASK_REMOVED");
                editor.putLong("saved_timestamp", System.currentTimeMillis());
                editor.apply();
            } catch (Exception e) {
                Log.e(TAG, "Failed to save state onTaskRemoved: " + e.getMessage());
            }

            // 2. STOP AUDIO IMMEDIATELY — Swiping app from recents terminates playback
            try {
                player.setPlayWhenReady(false);
                player.pause();
                player.stop();
                player.clearMediaItems();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping player onTaskRemoved: " + e.getMessage());
            }
        }

        // 3. Remove notification and dismiss foreground service
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIF_ID);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error cleaning up notification: " + e.getMessage());
        }

        // 4. Release MediaSession & Player and terminate service
        if (mediaSession != null) {
            try { mediaSession.release(); } catch (Exception ignored) {}
            mediaSession = null;
        }
        if (player != null) {
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }

        stopSelf();
    }

    // ── Single-track API ─────────────────────────────────────────────────────

    public void playTrack(String trackId, String title, String artist, String artworkUrl, String uri) {
        playUrl(uri, title, artist, artworkUrl);
    }

    public void playUrl(String url, String title, String artist) {
        playUrl(url, title, artist, null);
    }

    public void playUrl(String url, String title, String artist, String artworkUrl) {
        playUrl("", url, title, artist, artworkUrl);
    }

    public void playUrl(String trackId, String url, String title, String artist, String artworkUrl) {
        runOnMainThread(() -> {
            if (player == null) return;

            isPreparingNewTrack = true;
            currentTrackId = trackId != null ? trackId : "";
            currentTitle  = title  != null ? title  : "RaagaX";
            currentArtist = artist != null ? artist : "";
            currentArtworkUrl = artworkUrl != null ? artworkUrl : "";
            loadArtworkAsync(currentArtworkUrl);

            android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
            android.net.NetworkInfo activeNetwork = cm != null ? cm.getActiveNetworkInfo() : null;
            boolean isOnline = activeNetwork != null && activeNetwork.isConnectedOrConnecting();
            Log.d(TAG, "[PLAYBACK_MODE] mode=" + (isOnline ? "ONLINE" : "OFFLINE"));

            Uri playableUri = null;
            boolean isLocal = false;

            // 1. Check Room database for verified completed download
            java.io.File localFile = null;
            if (!currentTrackId.isEmpty()) {
                try {
                    com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(this);
                    com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(currentTrackId);
                    if (entity != null && "COMPLETED".equalsIgnoreCase(entity.downloadState) && entity.localPath != null && !entity.localPath.isEmpty()) {
                        java.io.File f = new java.io.File(entity.localPath);
                        if (f.exists() && f.length() > 0) {
                            localFile = f;
                            playableUri = Uri.fromFile(f);
                            isLocal = true;
                            Log.d(TAG, "[LOCAL_RESOLUTION] trackId=" + currentTrackId + " file=" + localFile.getAbsolutePath() + " exists=true size=" + localFile.length());
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "[RAAGAX_LOCAL_PLAYBACK] DB lookup error: " + e.getMessage());
                }
            }

            // 2. Check if the provided url points to a local file
            if (!isLocal && url != null && !url.isEmpty()) {
                String cleanPath = url.trim();
                if (cleanPath.startsWith("file://")) {
                    cleanPath = cleanPath.substring(7);
                    try {
                        cleanPath = java.net.URLDecoder.decode(cleanPath, "UTF-8");
                    } catch (Exception ignored) {}
                }
                if (cleanPath.startsWith("/") || cleanPath.startsWith("/storage/") || cleanPath.startsWith("/data/")) {
                    java.io.File f = new java.io.File(cleanPath);
                    if (f.exists() && f.length() > 0) {
                        localFile = f;
                        playableUri = Uri.fromFile(f);
                        isLocal = true;
                        Log.d(TAG, "[LOCAL_RESOLUTION] trackId=" + currentTrackId + " file=" + localFile.getAbsolutePath() + " exists=true size=" + localFile.length());
                    }
                }
            }

            // 3. Fall back to standard network URI parser
            if (playableUri == null && url != null && !url.isEmpty()) {
                playableUri = parsePlayableUri(url);
                if ("file".equalsIgnoreCase(playableUri.getScheme())) {
                    isLocal = true;
                }
            }

            if (playableUri == null || playableUri.equals(Uri.EMPTY)) {
                Log.e(TAG, "[LOCAL_PLAYBACK_ERROR] error=No playable URI could be constructed for url: " + url);
                return;
            }

            isCurrentLocalPlayback = isLocal;

            if (isLocal && localFile != null) {
                Log.d(TAG, "[DIRECT_LOCAL_TEST] path=" + localFile.getAbsolutePath() + " exists=" + localFile.exists() + " size=" + localFile.length());
                Log.d(TAG, "[DIRECT_LOCAL_TEST] uri=" + playableUri);
                Log.d(TAG, "[LOCAL_PLAYBACK] trackId=" + currentTrackId + " uri=" + playableUri);
                Log.d(TAG, "[LOCAL_PLAYBACK] trackId=" + currentTrackId + " path=" + localFile.getAbsolutePath() + " exists=" + localFile.exists() + " size=" + localFile.length());
            }

            MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                    .setTitle(currentTitle)
                    .setArtist(currentArtist);

            if (!currentArtworkUrl.isEmpty()) {
                try {
                    metaBuilder.setArtworkUri(parsePlayableUri(currentArtworkUrl));
                } catch (Exception ignored) {}
            }

            MediaItem mediaItem = new MediaItem.Builder()
                    .setMediaId(currentTrackId)
                    .setUri(playableUri)
                    .setMediaMetadata(metaBuilder.build())
                    .build();

            Log.d(TAG, "[DIRECT_LOCAL_TEST] mediaItemCreated=true mediaId=" + mediaItem.mediaId);

            androidx.media3.extractor.DefaultExtractorsFactory extractorsFactory =
                    new androidx.media3.extractor.DefaultExtractorsFactory()
                            .setConstantBitrateSeekingEnabled(true);

            androidx.media3.datasource.DefaultDataSource.Factory dataSourceFactory =
                    new androidx.media3.datasource.DefaultDataSource.Factory(this);

            androidx.media3.exoplayer.source.MediaSource localSource =
                    new androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(
                            dataSourceFactory,
                            extractorsFactory
                    ).createMediaSource(mediaItem);

            player.setMediaSource(localSource);
            player.prepare();
            player.setPlayWhenReady(true);
            player.play();
            updateNotification();
            Log.d(TAG, "playUrl: trackId=" + currentTrackId + " | title=" + currentTitle + " | artist=" + currentArtist + " | uri=" + playableUri + " | isLocal=" + isLocal);
        });
    }

    public void setNextTrack(String url, String title, String artist) {
        runOnMainThread(() -> {
            if (player == null || url == null || url.isEmpty()) return;
            if (isCurrentLocalPlayback) {
                Log.d(TAG, "[setNextTrack] Offline single local playback active — suppressing next track preload to preserve local read head");
                return;
            }
            while (player.getMediaItemCount() > player.getCurrentMediaItemIndex() + 1) {
                player.removeMediaItem(player.getCurrentMediaItemIndex() + 1);
            }
            Uri itemUri = parsePlayableUri(url);
            MediaItem mi = new MediaItem.Builder()
                    .setUri(itemUri)
                    .setMediaMetadata(new MediaMetadata.Builder()
                            .setTitle(title != null ? title : "RaagaX")
                            .setArtist(artist != null ? artist : "")
                            .build())
                    .build();

            androidx.media3.extractor.DefaultExtractorsFactory extractorsFactory =
                    new androidx.media3.extractor.DefaultExtractorsFactory()
                            .setConstantBitrateSeekingEnabled(true);

            androidx.media3.datasource.DefaultDataSource.Factory dataSourceFactory =
                    new androidx.media3.datasource.DefaultDataSource.Factory(this);

            androidx.media3.exoplayer.source.MediaSource localSource =
                    new androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(
                            dataSourceFactory,
                            extractorsFactory
                    ).createMediaSource(mi);
            player.addMediaSource(localSource);
        });
    }

    public void setNextTracksBatch(String[] urls, String[] titles, String[] artists) {
        runOnMainThread(() -> {
            if (player == null || urls == null || urls.length == 0) return;
            if (isCurrentLocalPlayback) {
                Log.d(TAG, "[setNextTracksBatch] Offline single local playback active — suppressing batch preload to preserve local read head");
                return;
            }
            while (player.getMediaItemCount() > player.getCurrentMediaItemIndex() + 1) {
                player.removeMediaItem(player.getCurrentMediaItemIndex() + 1);
            }
            java.util.List<androidx.media3.exoplayer.source.MediaSource> sources = new java.util.ArrayList<>();
            androidx.media3.extractor.DefaultExtractorsFactory extractorsFactory =
                    new androidx.media3.extractor.DefaultExtractorsFactory()
                            .setConstantBitrateSeekingEnabled(true);

            androidx.media3.datasource.DefaultDataSource.Factory dataSourceFactory =
                    new androidx.media3.datasource.DefaultDataSource.Factory(this);

            for (int i = 0; i < urls.length; i++) {
                String u = urls[i];
                if (u == null || u.isEmpty()) continue;
                String t = (titles  != null && i < titles.length  && titles[i]  != null) ? titles[i]  : "RaagaX";
                String a = (artists != null && i < artists.length && artists[i] != null) ? artists[i] : "";
                Uri itemUri = parsePlayableUri(u);
                MediaItem mi = new MediaItem.Builder()
                        .setUri(itemUri)
                        .setMediaMetadata(new MediaMetadata.Builder()
                                .setTitle(t)
                                .setArtist(a)
                                .build())
                        .build();

                sources.add(new androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(
                        dataSourceFactory,
                        extractorsFactory
                ).createMediaSource(mi));
            }
            if (!sources.isEmpty()) {
                player.addMediaSources(sources);
            }
        });
    }

    public void resume()           { runOnMainThread(() -> { if (player != null) player.play(); }); }
    public void pause()            { runOnMainThread(() -> { if (player != null) player.pause(); }); }
    public void setRepeatMode(String mode) {
        runOnMainThread(() -> {
            if (player == null) return;
            if ("ONE".equalsIgnoreCase(mode) || "TRACK".equalsIgnoreCase(mode)) {
                player.setRepeatMode(Player.REPEAT_MODE_ONE);
            } else if ("ALL".equalsIgnoreCase(mode) || "CONTEXT".equalsIgnoreCase(mode)) {
                player.setRepeatMode(Player.REPEAT_MODE_ALL);
            } else {
                player.setRepeatMode(Player.REPEAT_MODE_OFF);
            }
        });
    }
    public void seekTo(long posMs) {
        runOnMainThread(() -> {
            if (player == null) return;

            long targetPos = Math.max(0L, posMs);
            boolean wasPlaying = player.isPlaying();
            int state = player.getPlaybackState();

            Log.d(TAG, "[SEEK] seekTo " + targetPos + "ms | wasPlaying=" + wasPlaying
                    + " | state=" + state + " | currentPos=" + player.getCurrentPosition() + "ms");

            // If player is IDLE with no media, there is nothing to seek into — ignore.
            if (state == Player.STATE_IDLE && player.getMediaItemCount() == 0) {
                Log.w(TAG, "[SEEK] No media loaded — seek ignored.");
                return;
            }

            // If player hit STATE_ENDED but has media, re-prepare WITHOUT auto-play.
            // We will restore the correct play/pause state after the seek completes.
            if (state == Player.STATE_ENDED && player.getMediaItemCount() > 0) {
                player.setPlayWhenReady(false); // ← DO NOT auto-play; restore below
                player.prepare();
            }

            // ── The actual seek — ExoPlayer moves the read-head, does NOT reload the URL ──
            int curIndex = player.getCurrentMediaItemIndex();
            player.seekTo(curIndex, targetPos);

            // ── Restore play/pause state as it was before the seek ──────────────────
            // This is the critical rule: a SEEK within the same song must NEVER
            // change whether the user was playing or paused.
            if (wasPlaying) {
                player.setPlayWhenReady(true);
                player.play();
            } else {
                player.setPlayWhenReady(false);
                // Do NOT call player.pause() here — ExoPlayer is already paused
                // after seekTo when setPlayWhenReady is false.
            }

            Log.d(TAG, "[SEEK] Requested seekTo " + targetPos + "ms dispatch to ExoPlayer read-head.");
        });
    }
    public void setVolume(float v) { runOnMainThread(() -> { if (player != null) player.setVolume(v); }); }

    public long getCurrentPosition() {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper())
            return player != null ? player.getCurrentPosition() : 0L;
        return 0L;
    }

    public long getDuration() {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper())
            return player != null ? player.getDuration() : 0L;
        return 0L;
    }

    public boolean isPlaying() {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper())
            return player != null && player.isPlaying();
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

        PendingIntent prevPending = PendingIntent.getService(this, 1,
                new Intent(this, RaagaXPlaybackService.class).setAction("PREV"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent playPausePending = PendingIntent.getService(this, 2,
                new Intent(this, RaagaXPlaybackService.class).setAction("TOGGLE_PLAY"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        PendingIntent nextPending = PendingIntent.getService(this, 3,
                new Intent(this, RaagaXPlaybackService.class).setAction("NEXT"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        boolean isPlaying = player != null && player.isPlaying();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setContentIntent(pi)
                .setOngoing(isPlaying)
                .setSilent(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        if (currentArtworkBitmap != null) {
            builder.setLargeIcon(currentArtworkBitmap);
        }

        builder.addAction(android.R.drawable.ic_media_previous, "Previous", prevPending)
               .addAction(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                       isPlaying ? "Pause" : "Play", playPausePending)
               .addAction(android.R.drawable.ic_media_next, "Next", nextPending);

        androidx.media.app.NotificationCompat.MediaStyle mediaStyle = new androidx.media.app.NotificationCompat.MediaStyle()
                .setShowActionsInCompactView(0, 1, 2);

        builder.setStyle(mediaStyle);
        return builder.build();
    }

    private void updateNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification());
    }
}
