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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
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

import com.raagax.music.download.Media3DownloadHelper;
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
    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            if (player != null && (player.isPlaying() || player.getPlayWhenReady())) {
                long pos = player.getCurrentPosition();
                long dur = (player.getDuration() > 0 && player.getDuration() != C.TIME_UNSET)
                        ? player.getDuration()
                        : lastReportedDurationMs;

                if (dur <= 0L && currentTrackId != null && !currentTrackId.isEmpty()) {
                    try {
                        com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(RaagaXPlaybackService.this);
                        com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(currentTrackId);
                        if (entity != null && entity.duration > 0) {
                            dur = entity.duration * 1000L;
                            lastReportedDurationMs = dur;
                        }
                    } catch (Exception ignored) {}
                }

                Intent i = new Intent("com.raagax.music.PLAYBACK_STATE");
                i.putExtra("isPlaying", true);
                i.putExtra("positionMs", pos);
                i.putExtra("durationMs", dur);
                i.putExtra("timestamp", System.currentTimeMillis());
                sendBroadcast(i);

                mainHandler.postDelayed(this, 500);
            }
        }
    };

    private void startProgressTicker() {
        mainHandler.removeCallbacks(progressTicker);
        mainHandler.post(progressTicker);
    }

    private void stopProgressTicker() {
        mainHandler.removeCallbacks(progressTicker);
    }

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

        androidx.media3.exoplayer.source.MediaSource.Factory mediaSourceFactory =
                Media3DownloadHelper.createPlaybackMediaSourceFactory(this);

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(mediaSourceFactory)
                .setAudioAttributes(audioAttributes, /* handleAudioFocus= */ true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_LOCAL)
                .build();

        // Strict Anti-Autoplay Rule: Player boots strictly paused with no media loaded
        player.setPlayWhenReady(false);

        try {
            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent sessionActivityPi = PendingIntent.getActivity(this, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            mediaSession = new androidx.media3.session.MediaSession.Builder(this, player)
                    .setSessionActivity(sessionActivityPi)
                    .setCallback(new androidx.media3.session.MediaSession.Callback() {
                        @Override
                        public androidx.media3.session.MediaSession.ConnectionResult onConnect(
                                androidx.media3.session.MediaSession session,
                                androidx.media3.session.MediaSession.ControllerInfo controller) {
                            androidx.media3.session.MediaSession.ConnectionResult connectionResult =
                                    androidx.media3.session.MediaSession.Callback.super.onConnect(session, controller);
                            androidx.media3.session.MediaSession.ConnectionResult.AcceptedResultBuilder acceptedBuilder =
                                    new androidx.media3.session.MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                                            .setAvailablePlayerCommands(
                                                    connectionResult.availablePlayerCommands
                                                            .buildUpon()
                                                            .add(Player.COMMAND_SEEK_TO_NEXT)
                                                            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                                                            .add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
                                                            .add(Player.COMMAND_PLAY_PAUSE)
                                                            .add(Player.COMMAND_STOP)
                                                            .build()
                                            );
                            return acceptedBuilder.build();
                        }
                    })
                    .build();
        } catch (Exception e) {
            Log.e(TAG, "Failed to create MediaSession: " + e.getMessage());
        }

        player.addListener(new Player.Listener() {

            // ── Track changed (auto-advance or manual next/prev) ──────────────
            @Override
            public void onMediaItemTransition(androidx.media3.common.MediaItem mediaItem, int reason) {
                if (mediaItem == null) return;
                long now = System.currentTimeMillis();
                String oldTrackId = currentTrackId != null ? currentTrackId : "";

                // Read trackId from mediaId (set by setQueue/setOfflineQueue/playUrl)
                String newTrackId = mediaItem.mediaId != null ? mediaItem.mediaId : "";
                String newTitle   = (mediaItem.mediaMetadata != null && mediaItem.mediaMetadata.title != null)
                                    ? mediaItem.mediaMetadata.title.toString() : "RaagaX";
                String newArtist  = (mediaItem.mediaMetadata != null && mediaItem.mediaMetadata.artist != null)
                                    ? mediaItem.mediaMetadata.artist.toString() : "";
                String newArt     = (mediaItem.mediaMetadata != null && mediaItem.mediaMetadata.artworkUri != null)
                                    ? mediaItem.mediaMetadata.artworkUri.toString() : "";

                currentTrackId    = newTrackId;
                currentTitle      = newTitle;
                currentArtist     = newArtist;
                currentArtworkUrl = newArt;
                loadArtworkAsync(newArt, newTrackId);

                // Proactively prefetch artwork of the next track in queue
                if (player != null && player.hasNextMediaItem()) {
                    int nextIdx = player.getCurrentMediaItemIndex() + 1;
                    if (nextIdx < player.getMediaItemCount()) {
                        androidx.media3.common.MediaItem nextItem = player.getMediaItemAt(nextIdx);
                        if (nextItem != null && nextItem.mediaMetadata != null && nextItem.mediaMetadata.artworkUri != null) {
                            prefetchArtwork(nextItem.mediaMetadata.artworkUri.toString());
                        }
                    }
                }

                // Reset position to 0 upon transition
                long pos = 0L;
                long dur = (player != null && player.getDuration() > 0 && player.getDuration() != C.TIME_UNSET)
                           ? player.getDuration() : 0L;

                if (dur <= 0L && !currentTrackId.isEmpty()) {
                    try {
                        com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(RaagaXPlaybackService.this);
                        com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(currentTrackId);
                        if (entity != null && entity.duration > 0) {
                            dur = entity.duration * 1000L;
                        }
                    } catch (Exception ignored) {}
                }

                if (dur > 0L) {
                    lastReportedDurationMs = dur;
                }

                int queueIndex = player != null ? player.getCurrentMediaItemIndex() : 0;
                int totalItems = player != null ? player.getMediaItemCount() : 0;
                boolean isPlaying = player != null && (player.isPlaying() || player.getPlayWhenReady());
                int oldQueueIndex = (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && queueIndex > 0) ? queueIndex - 1 : (queueIndex > 0 ? queueIndex - 1 : 0);

                Log.d(TAG, "[NEXT_QUEUE]\noldTrackId=" + oldTrackId
                        + "\nnewTrackId=" + currentTrackId
                        + "\noldQueueIndex=" + oldQueueIndex
                        + "\nnewQueueIndex=" + queueIndex);

                Log.d(TAG, "[NEXT_PLAY]\ntrackId=" + currentTrackId
                        + "\nisPlaying=" + isPlaying);

                Log.d(TAG, "[QUEUE_AUTO_ADVANCE]\noldTrackId=" + oldTrackId
                        + "\nnewTrackId=" + currentTrackId
                        + "\noldQueueIndex=" + oldQueueIndex
                        + "\nnewQueueIndex=" + queueIndex);

                Log.d(TAG, "[QUEUE_TRACK_PLAYING]\ntrackId=" + currentTrackId
                        + "\nisPlaying=true\nposition=0");

                Log.d(TAG, "[TRACK_TRANSITION] oldTrackId=" + oldTrackId
                        + " newTrackId=" + currentTrackId
                        + " title=" + currentTitle
                        + " artist=" + currentArtist
                        + " artwork=" + currentArtworkUrl
                        + " duration=" + dur);

                Log.d(TAG, "[PLAYBACK_STATE_PUBLISHED] trackId=" + currentTrackId
                        + " title=" + currentTitle
                        + " artist=" + currentArtist
                        + " artwork=" + currentArtworkUrl
                        + " durationMs=" + dur
                        + " positionMs=" + pos
                        + " isPlaying=" + isPlaying);

                Intent syncIntent = new Intent("com.raagax.music.TRACK_CHANGED");
                syncIntent.putExtra("oldTrackId",  oldTrackId);
                syncIntent.putExtra("trackId",     currentTrackId);
                syncIntent.putExtra("title",       currentTitle);
                syncIntent.putExtra("artist",      currentArtist);
                syncIntent.putExtra("artworkUrl",  currentArtworkUrl);
                syncIntent.putExtra("queueIndex",  queueIndex);
                syncIntent.putExtra("totalItems",  totalItems);
                syncIntent.putExtra("positionMs",  pos);
                syncIntent.putExtra("durationMs",  dur);
                syncIntent.putExtra("isPlaying",   isPlaying);
                syncIntent.putExtra("reason",      reason);
                syncIntent.putExtra("timestamp",   now);
                sendBroadcast(syncIntent);

                updateNotification();
            }

            // ── Discontinuity & Seek Confirmation ─────────────────────────────
            @Override
            public void onPositionDiscontinuity(
                    androidx.media3.common.Player.PositionInfo oldPosition,
                    androidx.media3.common.Player.PositionInfo newPosition,
                    int reason
            ) {
                if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                    long confirmedPos = newPosition.positionMs;
                    boolean isPlaying = player != null && player.isPlaying();
                    Log.d(TAG, "[SEEK_CONFIRMED] ExoPlayer discontinuity settled: old=" + oldPosition.positionMs + "ms -> confirmed=" + confirmedPos + "ms | isPlaying=" + isPlaying);

                    Intent i = new Intent("com.raagax.music.SEEK_COMPLETE");
                    i.putExtra("positionMs", confirmedPos);
                    i.putExtra("wasPlaying", isPlaying);
                    sendBroadcast(i);
                }
            }

            // ── State changed: BUFFERING / READY / ENDED ───────────────────────
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    stopProgressTicker();
                    if (isPreparingNewTrack) {
                        Log.w(TAG, "onPlaybackStateChanged: STATE_ENDED received while isPreparingNewTrack=true (suppressing spurious transition on track swap)");
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
                    long dur = (player != null && player.getDuration() > 0 && player.getDuration() != C.TIME_UNSET)
                               ? player.getDuration() : 0L;
                    long pos = player != null ? player.getCurrentPosition() : 0L;

                    if (dur <= 0L && currentTrackId != null && !currentTrackId.isEmpty()) {
                        try {
                            com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(RaagaXPlaybackService.this);
                            com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(currentTrackId);
                            if (entity != null && entity.duration > 0) {
                                dur = entity.duration * 1000L;
                                Log.d(TAG, "[MEDIA3_DB_DURATION] Loaded DB duration: " + dur + "ms");
                            }
                        } catch (Exception ignored) {}
                    }

                    if (dur > 0L) {
                        lastReportedDurationMs = dur;
                    } else if (lastReportedDurationMs > 0L) {
                        dur = lastReportedDurationMs;
                    }

                    Log.d(TAG, "[MEDIA3] STATE_READY duration=" + dur + " position=" + pos + " isPlaying=" + isPlaying);
                    Log.d(TAG, "[PLAYBACK_STATE] trackId=" + currentTrackId + " isPlaying=" + isPlaying + " position=" + pos + " duration=" + dur + " source=" + (isCurrentLocalPlayback ? "LOCAL" : "NETWORK"));

                    if (isPlaying) {
                        startProgressTicker();
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
                Log.e(TAG, "[QUEUE_TRACK_FAILED]\ntrackId=" + currentTrackId + "\nerror=" + (error != null ? error.getMessage() : "unknown"));
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
                                return;
                            }
                        } catch (Exception ex) {
                            Log.e(TAG, "[RAAGAX_LOCAL_FALLBACK] Online fallback resolution failed: " + ex.getMessage());
                        }

                        // If online fallback resolution failed, safely attempt the next playable queue item
                        runOnMainThread(() -> {
                            if (player != null && player.hasNextMediaItem()) {
                                Log.w(TAG, "[QUEUE_TRACK_FAILED] Skipping to next playable queue item after fallback failure...");
                                player.seekToNextMediaItem();
                                player.prepare();
                                player.play();
                            }
                        });
                    }).start();
                } else {
                    // Directly attempt next playable queue item
                    if (player != null && player.hasNextMediaItem()) {
                        Log.w(TAG, "[QUEUE_TRACK_FAILED] Skipping to next playable queue item...");
                        player.seekToNextMediaItem();
                        player.prepare();
                        player.play();
                    }
                }
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                long now = System.currentTimeMillis();
                int state = player != null ? player.getPlaybackState() : -1;
                long pos = player != null ? player.getCurrentPosition() : 0L;
                long dur = (player != null && player.getDuration() > 0 && player.getDuration() != C.TIME_UNSET)
                           ? player.getDuration() : (lastReportedDurationMs > 0 ? lastReportedDurationMs : 0L);
                boolean playWhenReady = player != null && player.getPlayWhenReady();

                if (dur <= 0L && currentTrackId != null && !currentTrackId.isEmpty()) {
                    try {
                        com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(RaagaXPlaybackService.this);
                        com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(currentTrackId);
                        if (entity != null && entity.duration > 0) {
                            dur = entity.duration * 1000L;
                        }
                    } catch (Exception ignored) {}
                }

                if (dur > 0L) {
                    lastReportedDurationMs = dur;
                }

                Log.d(TAG, "[PLAYBACK_TRANSITION] isPlaying=" + isPlaying + " | exoplayerState=" + state + " | playWhenReady=" + playWhenReady + " | positionMs=" + pos + " | durationMs=" + dur + " | timestamp=" + now + " | title=" + currentTitle);

                // During BUFFERING or READY before first audio render, if playWhenReady is true, playback intent is PLAYING
                boolean effectivePlaying = isPlaying || ((state == Player.STATE_BUFFERING || state == Player.STATE_READY) && playWhenReady);

                if (effectivePlaying) {
                    startProgressTicker();
                } else {
                    stopProgressTicker();
                }

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

    private void prefetchArtwork(String url) {
        if (url == null || url.isEmpty()) return;
        if (artworkCache.get(url) != null) return;
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
                }
            } catch (Exception ignored) {}
        }).start();
    }

    private void loadArtworkAsync(String url) {
        loadArtworkAsync(url, currentTrackId);
    }

    private void loadArtworkAsync(String url, String trackId) {
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
        // Atomic Transition Guard: Never show previous song's cover with new track metadata
        currentArtworkBitmap = null;
        updateNotification();

        final String requestTrackId = trackId;
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
                    // Prevent Stale Async Responses: Only apply if trackId is still current!
                    if ((requestTrackId == null || requestTrackId.isEmpty() || requestTrackId.equals(currentTrackId))
                            && url.equals(currentArtworkUrl)) {
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
                if (player != null && player.getCurrentPosition() > 3000) {
                    player.seekTo(0);
                    if (player.getPlayWhenReady()) {
                        player.play();
                    }
                } else if (player != null && player.hasPreviousMediaItem()) {
                    boolean wasPlaying = player.isPlaying() || player.getPlayWhenReady();
                    player.seekToPreviousMediaItem();
                    player.prepare();
                    if (wasPlaying) {
                        player.setPlayWhenReady(true);
                        player.play();
                    } else {
                        player.setPlayWhenReady(false);
                    }
                } else {
                    Log.d(TAG, "PREV action received -> broadcasting ACTION_PREV to session");
                    Intent i = new Intent("com.raagax.music.ACTION_PREV");
                    sendBroadcast(i);
                }
            });

        } else if ("NEXT".equals(action)) {
            runOnMainThread(() -> {
                if (player != null && player.hasNextMediaItem()) {
                    int oldQueueIndex = player.getCurrentMediaItemIndex();
                    String oldTrackId = currentTrackId != null ? currentTrackId : "";
                    boolean wasPlaying = player.isPlaying() || player.getPlayWhenReady();

                    int nextQueueIndex = oldQueueIndex + 1;
                    androidx.media3.common.MediaItem nextItem = player.getMediaItemAt(nextQueueIndex);
                    String newTrackId = (nextItem != null && nextItem.mediaId != null) ? nextItem.mediaId : "";

                    Log.d(TAG, "[NEXT_QUEUE]\noldTrackId=" + oldTrackId
                            + "\nnewTrackId=" + newTrackId
                            + "\noldQueueIndex=" + oldQueueIndex
                            + "\nnewQueueIndex=" + nextQueueIndex);

                    // Switch directly in ExoPlayer without pausing
                    player.seekToNextMediaItem();
                    player.prepare();
                    if (wasPlaying) {
                        player.setPlayWhenReady(true);
                        player.play();
                    } else {
                        player.setPlayWhenReady(false);
                    }

                    Log.d(TAG, "[NEXT_PLAY]\ntrackId=" + newTrackId
                            + "\nisPlaying=" + wasPlaying);
                } else {
                    Log.d(TAG, "NEXT action received -> broadcasting ACTION_NEXT to session");
                    Intent i = new Intent("com.raagax.music.ACTION_NEXT");
                    sendBroadcast(i);
                }
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
            androidx.media3.exoplayer.source.MediaSource.Factory mediaSourceFactory =
                    Media3DownloadHelper.createPlaybackMediaSourceFactory(this);

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

                Uri itemUri = null;
                if (!id.isEmpty()) {
                    try {
                        com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(this);
                        com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(id);
                        if (entity != null && "COMPLETED".equalsIgnoreCase(entity.downloadState)) {
                            if (entity.localPath != null && !entity.localPath.isEmpty() && !entity.localPath.contains("media3_cache://")) {
                                java.io.File f = new java.io.File(entity.localPath);
                                if (f.exists() && f.length() > 0) {
                                    itemUri = Uri.fromFile(f);
                                }
                            }
                            if (itemUri == null && entity.streamUrl != null && !entity.streamUrl.isEmpty()) {
                                itemUri = Uri.parse(entity.streamUrl);
                            }
                        }
                    } catch (Exception ignored) {}
                }

                if (itemUri == null) {
                    String cleanU = u;
                    if (cleanU.startsWith("file://media3_cache://")) {
                        String subId = cleanU.substring("file://media3_cache://".length());
                        try {
                            com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(this);
                            com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(subId);
                            if (entity != null && entity.streamUrl != null && !entity.streamUrl.isEmpty()) {
                                itemUri = Uri.parse(entity.streamUrl);
                            }
                        } catch (Exception ignored) {}
                    } else if (cleanU.startsWith("media3_cache://")) {
                        String subId = cleanU.substring("media3_cache://".length());
                        try {
                            com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(this);
                            com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(subId);
                            if (entity != null && entity.streamUrl != null && !entity.streamUrl.isEmpty()) {
                                itemUri = Uri.parse(entity.streamUrl);
                            }
                        } catch (Exception ignored) {}
                    }
                }

                if (itemUri == null) {
                    itemUri = parsePlayableUri(u);
                }

                MediaItem.Builder miBuilder = new MediaItem.Builder()
                        .setUri(itemUri)
                        .setMimeType(Media3DownloadHelper.detectMimeType(itemUri))
                        .setMediaMetadata(metaBuilder.build());
                if (!id.isEmpty()) {
                    miBuilder.setMediaId(id);
                }
                MediaItem mi = miBuilder.build();

                sources.add(mediaSourceFactory.createMediaSource(mi));
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
                String curArt = artworks[safeIndex];
                loadArtworkAsync(curArt, trackIds != null && safeIndex < trackIds.length ? trackIds[safeIndex] : "");
                // Proactively prefetch next tracks in queue into memory cache
                for (int nextI = safeIndex + 1; nextI < Math.min(artworks.length, safeIndex + 4); nextI++) {
                    prefetchArtwork(artworks[nextI]);
                }
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

                androidx.media3.exoplayer.source.MediaSource.Factory mediaSourceFactory =
                        Media3DownloadHelper.createPlaybackMediaSourceFactory(this);

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

                    MediaItem mi = new MediaItem.Builder()
                            .setMediaId(track.songId)          // ← songId as identity
                            .setUri(track.streamUri)           // ← canonical stream URI for CacheDataSource
                            .setMediaMetadata(metaBuilder.build())
                            .build();

                    sources.add(mediaSourceFactory.createMediaSource(mi));
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
        Log.d(TAG, "onTaskRemoved: Activity swiped away from Recents.");

        // Continuous Background Audio Guard:
        // If music is actively playing or intended to play, DO NOT kill playback.
        // Foreground service keeps audio running with system notification as primary surface.
        boolean isPlaying = player != null && (player.isPlaying() || player.getPlayWhenReady());
        if (isPlaying) {
            Log.d(TAG, "onTaskRemoved: Audio is active — continuing in background as foreground service.");
            updateNotification();
            return;
        }

        Log.d(TAG, "onTaskRemoved: Audio is paused/idle — saving snapshot and stopping foreground service.");
        // 1. Save current playback snapshot to SharedPreferences before shutdown
        if (player != null) {
            try {
                android.content.SharedPreferences prefs = getSharedPreferences("raagax_native_playback", android.content.Context.MODE_PRIVATE);
                android.content.SharedPreferences.Editor editor = prefs.edit();
                editor.putLong("last_position_ms", 0L); // Reset position to 0:00 on process termination
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
            String cleanTrackId = trackId != null ? trackId.trim() : "";
            String cleanUrl = url != null ? url.trim() : "";

            // Unwrap any media3_cache:// or file://media3_cache:// schemes
            if (cleanUrl.startsWith("file://media3_cache://")) {
                cleanUrl = cleanUrl.substring("file://media3_cache://".length());
                if (cleanTrackId.isEmpty()) cleanTrackId = cleanUrl;
            } else if (cleanUrl.startsWith("media3_cache://")) {
                cleanUrl = cleanUrl.substring("media3_cache://".length());
                if (cleanTrackId.isEmpty()) cleanTrackId = cleanUrl;
            }

            currentTrackId = cleanTrackId;
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
            java.io.File localFile = null;

            // 1. Check Room database for verified completed download
            if (!currentTrackId.isEmpty()) {
                try {
                    com.raagax.music.data.db.RaagaXDatabase db = com.raagax.music.data.db.RaagaXDatabase.getInstance(this);
                    com.raagax.music.data.db.entity.DownloadEntity entity = db.downloadDao().getDownloadByTrackId(currentTrackId);
                    if (entity != null && "COMPLETED".equalsIgnoreCase(entity.downloadState)) {
                        if (entity.duration > 0) {
                            lastReportedDurationMs = entity.duration * 1000L;
                        }
                        // A. Check if a physical audio file is stored on disk
                        if (entity.localPath != null && !entity.localPath.isEmpty() && !entity.localPath.contains("media3_cache://")) {
                            java.io.File f = new java.io.File(entity.localPath);
                            if (f.exists() && f.length() > 0) {
                                localFile = f;
                                playableUri = Uri.fromFile(f);
                                isLocal = true;
                                Log.d(TAG, "[OFFLINE] trackId=" + currentTrackId + " localFile=" + f.getAbsolutePath() + " exists=true size=" + f.length());
                            }
                        }
                        // B. Check if cached in Media3 SimpleCache under original streamUrl
                        if (!isLocal && entity.streamUrl != null && !entity.streamUrl.isEmpty()) {
                            playableUri = Uri.parse(entity.streamUrl);
                            isLocal = true;
                            Log.d(TAG, "[OFFLINE] trackId=" + currentTrackId + " streamUrl=" + entity.streamUrl + " inMedia3Cache=true");
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "[RAAGAX_LOCAL_PLAYBACK] DB lookup error: " + e.getMessage());
                }
            }

            // 2. Check if cleanUrl is a physical file path on disk
            if (!isLocal && !cleanUrl.isEmpty()) {
                String checkPath = cleanUrl;
                if (checkPath.startsWith("file://")) {
                    checkPath = checkPath.substring(7);
                    try { checkPath = java.net.URLDecoder.decode(checkPath, "UTF-8"); } catch (Exception ignored) {}
                }
                if (checkPath.startsWith("/") || checkPath.startsWith("/storage/") || checkPath.startsWith("/data/")) {
                    java.io.File f = new java.io.File(checkPath);
                    if (f.exists() && f.length() > 0) {
                        localFile = f;
                        playableUri = Uri.fromFile(f);
                        isLocal = true;
                        Log.d(TAG, "[OFFLINE] trackId=" + currentTrackId + " localFile=" + f.getAbsolutePath() + " exists=true size=" + f.length());
                    }
                }
            }

            // 3. Fall back to standard network URI parser
            if (playableUri == null && !cleanUrl.isEmpty()) {
                playableUri = parsePlayableUri(cleanUrl);
                if ("file".equalsIgnoreCase(playableUri.getScheme())) {
                    isLocal = true;
                }
            }

            if (playableUri == null || playableUri.equals(Uri.EMPTY)) {
                Log.e(TAG, "[LOCAL_PLAYBACK_ERROR] error=No playable URI could be constructed for trackId=" + currentTrackId + " url=" + url);
                return;
            }

            isCurrentLocalPlayback = isLocal;

            Log.d(TAG, "[MEDIA3] setMediaItem trackId=" + currentTrackId + " isLocal=" + isLocal + " uri=" + playableUri);

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
                    .setMimeType(Media3DownloadHelper.detectMimeType(playableUri))
                    .setMediaMetadata(metaBuilder.build())
                    .build();

            androidx.media3.exoplayer.source.MediaSource.Factory mediaSourceFactory =
                    Media3DownloadHelper.createPlaybackMediaSourceFactory(this);

            androidx.media3.exoplayer.source.MediaSource localSource =
                    mediaSourceFactory.createMediaSource(mediaItem);

            Log.d(TAG, "[MEDIA3] prepare");
            try {
                player.stop();
                player.clearMediaItems();
            } catch (Exception ignored) {}
            player.setMediaSource(localSource);
            player.prepare();
            player.setPlayWhenReady(true);
            player.play();
            Log.d(TAG, "[MEDIA3] PLAY isPlaying=true duration=" + lastReportedDurationMs);
            updateNotification();
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

            androidx.media3.exoplayer.source.MediaSource.Factory mediaSourceFactory =
                    Media3DownloadHelper.createPlaybackMediaSourceFactory(this);

            androidx.media3.exoplayer.source.MediaSource localSource =
                    mediaSourceFactory.createMediaSource(mi);
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
            androidx.media3.exoplayer.source.MediaSource.Factory mediaSourceFactory =
                    Media3DownloadHelper.createPlaybackMediaSourceFactory(this);

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

                sources.add(mediaSourceFactory.createMediaSource(mi));
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

        boolean isPlaying = player != null && (player.isPlaying() || player.getPlayWhenReady());

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(currentTitle != null && !currentTitle.isEmpty() ? currentTitle : "RaagaX")
                .setContentText(currentArtist != null ? currentArtist : "")
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

        if (mediaSession != null) {
            try {
                androidx.media3.session.MediaStyleNotificationHelper.MediaStyle mediaStyle =
                        new androidx.media3.session.MediaStyleNotificationHelper.MediaStyle(mediaSession)
                                .setShowActionsInCompactView(0, 1, 2);
                builder.setStyle(mediaStyle);
            } catch (Exception e) {
                Log.w(TAG, "Failed to set MediaStyleNotificationHelper: " + e.getMessage());
                androidx.media.app.NotificationCompat.MediaStyle fallbackMediaStyle =
                        new androidx.media.app.NotificationCompat.MediaStyle()
                                .setShowActionsInCompactView(0, 1, 2);
                builder.setStyle(fallbackMediaStyle);
            }
        } else {
            androidx.media.app.NotificationCompat.MediaStyle mediaStyle =
                    new androidx.media.app.NotificationCompat.MediaStyle()
                            .setShowActionsInCompactView(0, 1, 2);
            builder.setStyle(mediaStyle);
        }

        return builder.build();
    }

    private void updateNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification());
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.d(TAG, "onTaskRemoved called");
        if (player == null || (!player.isPlaying() && !player.getPlayWhenReady())) {
            Log.d(TAG, "Player is paused/stopped on task removal — stopping foreground service cleanly");
            stopForeground(true);
            stopSelf();
        } else {
            Log.d(TAG, "Player is actively playing on task removal — continuing foreground playback");
        }
    }
}
