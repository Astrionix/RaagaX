package com.raagax.music.playback;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import com.raagax.music.RaagaXPlaybackService;
import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.db.entity.DownloadEntity;
import com.raagax.music.data.model.MusicTrack;
import com.raagax.music.data.repository.MusicRepository;
import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PlaybackController {
    private static volatile PlaybackController INSTANCE;
    private final Context context;
    private final RaagaXDatabase database;
    private final MusicRepository musicRepository;
    private final Handler mainHandler;
    private final ExecutorService executor;
    private final List<PlaybackListener> listeners;

    private PlaybackState currentState;
    private List<MusicTrack> originalQueue;

    private PlaybackController(Context context) {
        this.context = context.getApplicationContext();
        this.database = RaagaXDatabase.getInstance(this.context);
        this.musicRepository = MusicRepository.getInstance(this.context);
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.executor = Executors.newSingleThreadExecutor();
        this.listeners = new CopyOnWriteArrayList<>();
        this.currentState = new PlaybackState();
        this.originalQueue = new ArrayList<>();
    }

    public static PlaybackController getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (PlaybackController.class) {
                if (INSTANCE == null) {
                    INSTANCE = new PlaybackController(context);
                }
            }
        }
        return INSTANCE;
    }

    public void addListener(PlaybackListener listener) {
        if (listener != null && !listeners.contains(listener)) {
            listeners.add(listener);
            listener.onPlaybackStateChanged(currentState.copy());
        }
    }

    public void removeListener(PlaybackListener listener) {
        if (listener != null) {
            listeners.remove(listener);
        }
    }

    public PlaybackState getCurrentState() {
        return currentState.copy();
    }

    public void playTrack(MusicTrack track, List<MusicTrack> queue, int startIndex) {
        executor.execute(() -> {
            if (track == null || track.id == null) return;

            boolean isOnline = isNetworkAvailable();
            String playableUri = resolvePlayableUri(track, isOnline);

            if (playableUri == null) {
                // Offline and not downloaded: Never pause active song, trigger event
                mainHandler.post(() -> {
                    for (PlaybackListener listener : listeners) {
                        listener.onTrackUnavailableOffline(track);
                    }
                });
                return;
            }

            // Update queue
            List<MusicTrack> newQueue = queue != null && !queue.isEmpty() ? new ArrayList<>(queue) : Collections.singletonList(track);
            originalQueue = new ArrayList<>(newQueue);
            int index = startIndex >= 0 && startIndex < newQueue.size() ? startIndex : newQueue.indexOf(track);
            if (index < 0) index = 0;

            currentState.queue = newQueue;
            currentState.currentQueueIndex = index;
            currentState.currentTrack = track;
            currentState.state = PlaybackState.State.BUFFERING;
            currentState.isPlaying = true;
            currentState.errorMessage = null;

            // Record playback timestamp in Room
            musicRepository.recordPlayed(track.id);

            // Forward to native RaagaXPlaybackService
            mainHandler.post(() -> {
                RaagaXPlaybackService service = RaagaXPlaybackService.getInstance();
                if (service != null) {
                    service.playTrack(
                        track.id,
                        track.title != null ? track.title : "RaagaX Track",
                        track.artist != null ? track.artist : "Artist",
                        track.artworkUrl,
                        playableUri
                    );
                }
                notifyStateChanged();
            });
        });
    }

    public void pause() {
        mainHandler.post(() -> {
            RaagaXPlaybackService service = RaagaXPlaybackService.getInstance();
            if (service != null) {
                service.pause();
            }
            currentState.isPlaying = false;
            currentState.state = PlaybackState.State.PAUSED;
            notifyStateChanged();
        });
    }

    public void resume() {
        mainHandler.post(() -> {
            RaagaXPlaybackService service = RaagaXPlaybackService.getInstance();
            if (service != null) {
                service.resume();
            }
            currentState.isPlaying = true;
            currentState.state = PlaybackState.State.PLAYING;
            notifyStateChanged();
        });
    }

    public void togglePlayPause() {
        if (currentState.isPlaying) {
            pause();
        } else {
            resume();
        }
    }

    public void seekTo(long positionMs) {
        mainHandler.post(() -> {
            RaagaXPlaybackService service = RaagaXPlaybackService.getInstance();
            if (service != null) {
                service.seekTo(positionMs);
            }
            currentState.currentPositionMs = positionMs;
            notifyPositionDiscontinuity(positionMs);
        });
    }

    public void skipToNext() {
        if (currentState.queue.isEmpty()) return;
        int nextIndex = currentState.currentQueueIndex + 1;
        if (nextIndex >= currentState.queue.size()) {
            if (currentState.repeatMode == PlaybackState.RepeatMode.ALL) {
                nextIndex = 0;
            } else {
                return;
            }
        }
        MusicTrack nextTrack = currentState.queue.get(nextIndex);
        playTrack(nextTrack, currentState.queue, nextIndex);
    }

    public void skipToPrevious() {
        if (currentState.queue.isEmpty()) return;
        if (currentState.currentPositionMs > 3000) {
            seekTo(0);
            return;
        }
        int prevIndex = currentState.currentQueueIndex - 1;
        if (prevIndex < 0) {
            if (currentState.repeatMode == PlaybackState.RepeatMode.ALL) {
                prevIndex = currentState.queue.size() - 1;
            } else {
                prevIndex = 0;
            }
        }
        MusicTrack prevTrack = currentState.queue.get(prevIndex);
        playTrack(prevTrack, currentState.queue, prevIndex);
    }

    public void toggleShuffle() {
        currentState.isShuffleEnabled = !currentState.isShuffleEnabled;
        if (currentState.isShuffleEnabled) {
            MusicTrack current = currentState.currentTrack;
            List<MusicTrack> shuffled = new ArrayList<>(originalQueue);
            Collections.shuffle(shuffled);
            if (current != null) {
                shuffled.remove(current);
                shuffled.add(0, current);
            }
            currentState.queue = shuffled;
            currentState.currentQueueIndex = 0;
        } else {
            currentState.queue = new ArrayList<>(originalQueue);
            currentState.currentQueueIndex = originalQueue.indexOf(currentState.currentTrack);
        }
        notifyStateChanged();
    }

    public void setRepeatMode(PlaybackState.RepeatMode mode) {
        currentState.repeatMode = mode;
        notifyStateChanged();
    }

    /**
     * Resolves playable audio URI with strict priority:
     * 1. Local downloaded file (Room & Disk) -> File URI
     * 2. Online stream (if network available) -> Direct CDN URL
     * 3. None (offline & undownloaded) -> null
     */
    public String resolvePlayableUri(MusicTrack track, boolean isOnline) {
        if (track == null || track.id == null) return null;

        // 1. Check local download storage
        DownloadEntity dl = database.downloadDao().getDownloadByTrackId(track.id);
        if (dl != null && "COMPLETED".equals(dl.downloadState) && dl.localPath != null) {
            File file = new File(dl.localPath);
            if (file.exists() && file.length() > 0) {
                return file.getAbsolutePath();
            }
        }

        // 2. Online stream
        if (isOnline) {
            if (track.streamUrl != null && !track.streamUrl.isEmpty()) {
                return track.streamUrl;
            }
            // Fetch dynamically via repository
            MusicTrack resolved = musicRepository.getTrack(track.id, true);
            if (resolved != null && resolved.streamUrl != null && !resolved.streamUrl.isEmpty()) {
                return resolved.streamUrl;
            }
        }

        // 3. Offline and undownloaded
        return null;
    }

    public boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network network = cm.getActiveNetwork();
                if (network != null) {
                    NetworkCapabilities caps = cm.getNetworkCapabilities(network);
                    return caps != null && (
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                        caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                    );
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    private void notifyStateChanged() {
        PlaybackState copy = currentState.copy();
        for (PlaybackListener listener : listeners) {
            listener.onPlaybackStateChanged(copy);
        }
    }

    private void notifyPositionDiscontinuity(long positionMs) {
        for (PlaybackListener listener : listeners) {
            listener.onPositionDiscontinuity(positionMs);
        }
    }
}
