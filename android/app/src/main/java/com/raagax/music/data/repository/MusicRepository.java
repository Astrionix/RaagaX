package com.raagax.music.data.repository;

import android.content.Context;
import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.db.entity.DownloadEntity;
import com.raagax.music.data.db.entity.OutboxEntity;
import com.raagax.music.data.db.entity.TrackEntity;
import com.raagax.music.data.model.MusicAlbum;
import com.raagax.music.data.model.MusicTrack;
import com.raagax.music.data.model.SearchResult;
import com.raagax.music.data.provider.MusicProvider;
import com.raagax.music.data.provider.SaavnMusicProvider;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MusicRepository {
    private static volatile MusicRepository INSTANCE;
    private final RaagaXDatabase database;
    private final MusicProvider provider;
    private final ExecutorService executor;

    private MusicRepository(Context context) {
        this.database = RaagaXDatabase.getInstance(context);
        this.provider = new SaavnMusicProvider();
        this.executor = Executors.newFixedThreadPool(4);
    }

    public static MusicRepository getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (MusicRepository.class) {
                if (INSTANCE == null) {
                    INSTANCE = new MusicRepository(context);
                }
            }
        }
        return INSTANCE;
    }

    public SearchResult search(String query, boolean isOnline, int limit) {
        SearchResult result = new SearchResult(query);
        // 1. Search Room local tracks first
        List<TrackEntity> localTracks = database.trackDao().searchLocalTracks(query, limit);
        for (TrackEntity entity : localTracks) {
            MusicTrack track = entityToModel(entity);
            DownloadEntity dl = database.downloadDao().getDownloadByTrackId(entity.id);
            if (dl != null && "COMPLETED".equals(dl.downloadState)) {
                track.isDownloaded = true;
                track.localPath = dl.localPath;
            }
            result.tracks.add(track);
        }

        // 2. If online, fetch live provider results and merge
        if (isOnline) {
            try {
                SearchResult onlineResult = provider.search(query, limit);
                for (MusicTrack track : onlineResult.tracks) {
                    // Check if already in local list
                    boolean exists = false;
                    for (MusicTrack existing : result.tracks) {
                        if (existing.id.equals(track.id)) {
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) {
                        DownloadEntity dl = database.downloadDao().getDownloadByTrackId(track.id);
                        if (dl != null && "COMPLETED".equals(dl.downloadState)) {
                            track.isDownloaded = true;
                            track.localPath = dl.localPath;
                        }
                        TrackEntity localEntity = database.trackDao().getTrackById(track.id);
                        if (localEntity != null) {
                            track.isLiked = localEntity.isLiked;
                        }
                        result.tracks.add(track);
                    }
                }
                result.albums.addAll(onlineResult.albums);
                result.isOfflineResult = false;
            } catch (Exception e) {
                result.isOfflineResult = true;
            }
        } else {
            result.isOfflineResult = true;
        }

        return result;
    }

    public MusicTrack getTrack(String trackId, boolean isOnline) {
        // 1. Check Room database
        TrackEntity entity = database.trackDao().getTrackById(trackId);
        MusicTrack track = entity != null ? entityToModel(entity) : null;

        // 2. Check download state
        DownloadEntity dl = database.downloadDao().getDownloadByTrackId(trackId);
        if (track == null) {
            track = new MusicTrack();
            track.id = trackId;
        }
        if (dl != null && "COMPLETED".equals(dl.downloadState)) {
            track.isDownloaded = true;
            track.localPath = dl.localPath;
        }

        // 3. If online and stream/metadata missing, fetch from provider
        if (isOnline && (track.streamUrl == null || track.streamUrl.isEmpty())) {
            try {
                MusicTrack providerTrack = provider.getTrackDetails(trackId);
                if (providerTrack != null) {
                    if (track.title == null) track.title = providerTrack.title;
                    if (track.artist == null) track.artist = providerTrack.artist;
                    if (track.album == null) track.album = providerTrack.album;
                    if (track.artworkUrl == null) track.artworkUrl = providerTrack.artworkUrl;
                    track.streamUrl = providerTrack.streamUrl;
                    track.durationMs = providerTrack.durationMs;

                    // Cache in Room
                    saveTrack(track);
                }
            } catch (Exception ignored) {}
        }

        return track;
    }

    public List<MusicTrack> getLikedTracks() {
        List<TrackEntity> entities = database.trackDao().getLikedTracks();
        List<MusicTrack> tracks = new ArrayList<>();
        for (TrackEntity entity : entities) {
            MusicTrack track = entityToModel(entity);
            DownloadEntity dl = database.downloadDao().getDownloadByTrackId(entity.id);
            if (dl != null && "COMPLETED".equals(dl.downloadState)) {
                track.isDownloaded = true;
                track.localPath = dl.localPath;
            }
            tracks.add(track);
        }
        return tracks;
    }

    public void setLiked(MusicTrack track, boolean isLiked) {
        executor.execute(() -> {
            saveTrack(track);
            database.trackDao().setLiked(track.id, isLiked);

            // Queue for cloud outbox sync
            String mutation = isLiked ? "LIKE" : "UNLIKE";
            database.outboxDao().insertMutation(new OutboxEntity(mutation, "{\"trackId\":\"" + track.id + "\"}"));
        });
    }

    public void recordPlayed(String trackId) {
        executor.execute(() -> {
            database.trackDao().updateLastPlayed(trackId, System.currentTimeMillis());
        });
    }

    public void saveTrack(MusicTrack track) {
        if (track == null || track.id == null) return;
        TrackEntity entity = new TrackEntity(track.id, track.title != null ? track.title : "Unknown", track.artist, track.album, track.durationMs, track.artworkUrl);
        entity.streamUrl = track.streamUrl;
        entity.isLiked = track.isLiked;
        database.trackDao().insertOrUpdate(entity);
    }

    private MusicTrack entityToModel(TrackEntity entity) {
        MusicTrack track = new MusicTrack(entity.id, entity.title, entity.artist, entity.album, entity.durationMs, entity.artworkUrl, entity.streamUrl);
        track.isLiked = entity.isLiked;
        track.language = entity.language;
        track.releaseYear = entity.releaseYear;
        return track;
    }
}
