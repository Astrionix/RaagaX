package com.raagax.music.playback;

import android.content.Context;
import android.net.Uri;
import android.util.Log;

import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.db.entity.DownloadEntity;
import com.raagax.music.download.Media3DownloadHelper;
import com.raagax.music.download.StorageHelper;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * OfflineQueueResolver — Centralized offline track resolver.
 *
 * Converts a list of song IDs into a playback-ready list of locally verified offline tracks.
 * Only songs with a COMPLETED download in the Room database and Media3 download index are included.
 *
 * Architecture:
 *   songIds[]
 *       ↓
 *   Room DB batch query (COMPLETED only)
 *       ↓
 *   Media3 Download Cache verification
 *       ↓
 *   ResolvedTrack[] (canonical stream URIs + trackId metadata)
 *       ↓
 *   ExoPlayer loaded with CacheDataSource (zero network, instant local playback)
 */
public class OfflineQueueResolver {

    private static final String TAG = "OfflineQueueResolver";

    // ── Resolved track data class ────────────────────────────────────────────

    public static class ResolvedTrack {
        /** Song ID — use as ExoPlayer MediaItem.mediaId */
        public final String songId;
        /** Canonical stream URI for Media3 CacheDataSource lookup */
        public final Uri streamUri;
        public final String streamUrl;
        public final String title;
        public final String artist;
        public final String artworkUrl;
        public final long fileSize;

        public ResolvedTrack(String songId, String streamUrl, String title,
                             String artist, String artworkUrl, long fileSize) {
            this.songId     = songId;
            this.streamUrl  = streamUrl != null ? streamUrl : "";
            this.streamUri  = !this.streamUrl.isEmpty() ? Uri.parse(this.streamUrl) : Uri.EMPTY;
            this.title      = title != null  ? title  : "RaagaX";
            this.artist     = artist != null ? artist : "";
            this.artworkUrl = artworkUrl != null ? artworkUrl : "";
            this.fileSize   = fileSize;
        }
    }

    // ── Singleton ────────────────────────────────────────────────────────────

    private static volatile OfflineQueueResolver INSTANCE;

    public static OfflineQueueResolver getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (OfflineQueueResolver.class) {
                if (INSTANCE == null) {
                    INSTANCE = new OfflineQueueResolver(context.getApplicationContext());
                }
            }
        }
        return INSTANCE;
    }

    private final Context context;
    private final RaagaXDatabase database;

    private OfflineQueueResolver(Context context) {
        this.context  = context;
        this.database = RaagaXDatabase.getInstance(context);
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Resolves a list of song IDs to verified offline tracks.
     * Preserves input order and skips tracks that are not downloaded.
     */
    public List<ResolvedTrack> resolve(List<String> songIds) {
        List<ResolvedTrack> result = new ArrayList<>();

        if (songIds == null || songIds.isEmpty()) {
            return result;
        }

        Log.d(TAG, "[OfflineQueueResolver] resolve() input=" + songIds.size() + " songIds");

        // Batch-query Room for all COMPLETED records matching the requested IDs
        List<DownloadEntity> completedEntities =
                database.downloadDao().getCompletedDownloadsForTracks(songIds);

        Map<String, DownloadEntity> entityMap = new HashMap<>();
        for (DownloadEntity entity : completedEntities) {
            entityMap.put(entity.trackId, entity);
            if (entity.songId != null && !entity.songId.equals(entity.trackId)) {
                entityMap.put(entity.songId, entity);
            }
        }

        int skippedNotDownloaded = 0;
        int resolved = 0;

        for (String songId : songIds) {
            if (songId == null || songId.isEmpty()) continue;

            DownloadEntity entity = entityMap.get(songId);

            if (entity == null) {
                skippedNotDownloaded++;
                Log.v(TAG, "[OfflineQueueResolver] skip songId=" + songId + " reason=NOT_DOWNLOADED");
                continue;
            }

            // Verify in Media3 Download Cache or fallback streamUrl
            String streamUrl = entity.streamUrl;
            if (streamUrl == null || streamUrl.isEmpty()) {
                // If streamUrl was not stored, check legacy localPath or fallback
                if (entity.localPath != null && !entity.localPath.isEmpty()) {
                    streamUrl = entity.localPath;
                }
            }

            String artworkUrl = resolveArtworkUrl(entity);

            Log.d(TAG, "[OFFLINE_RESOLVER] trackId=" + songId + " source=LOCAL_DOWNLOAD uri=" + streamUrl);

            result.add(new ResolvedTrack(
                    songId,
                    streamUrl,
                    entity.title,
                    entity.artist,
                    artworkUrl,
                    entity.fileSize
            ));
            resolved++;
        }

        Log.d(TAG, "[OfflineQueueResolver] resolve() done: resolved=" + resolved
                + " skippedNotDownloaded=" + skippedNotDownloaded
                + " totalInput=" + songIds.size());

        return result;
    }

    /**
     * Check if a single song is available offline.
     */
    public boolean isAvailableOffline(String songId) {
        if (songId == null || songId.isEmpty()) return false;
        try {
            DownloadEntity entity = database.downloadDao().getDownloadByTrackId(songId);
            if (entity != null && "COMPLETED".equalsIgnoreCase(entity.downloadState)) {
                return true;
            }
            return Media3DownloadHelper.isTrackDownloaded(context, songId);
        } catch (Exception e) {
            Log.w(TAG, "[OfflineQueueResolver] isAvailableOffline check failed for " + songId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Resolve a single song for offline playback.
     */
    public ResolvedTrack resolveSingle(String songId) {
        if (songId == null || songId.isEmpty()) return null;
        try {
            DownloadEntity entity = database.downloadDao().getDownloadByTrackId(songId);
            if (entity == null || !"COMPLETED".equalsIgnoreCase(entity.downloadState)) {
                return null;
            }

            String streamUrl = entity.streamUrl != null ? entity.streamUrl : entity.localPath;
            String artworkUrl = resolveArtworkUrl(entity);
            return new ResolvedTrack(songId, streamUrl, entity.title,
                    entity.artist, artworkUrl, entity.fileSize);
        } catch (Exception e) {
            Log.w(TAG, "[OfflineQueueResolver] resolveSingle failed for " + songId + ": " + e.getMessage());
            return null;
        }
    }

    private String resolveArtworkUrl(DownloadEntity entity) {
        try {
            File artFile = StorageHelper.getArtworkFile(context, entity.trackId);
            if (artFile != null && artFile.exists() && artFile.length() > 0) {
                return "file://" + artFile.getAbsolutePath();
            }
        } catch (Exception ignored) {}
        return entity.artwork != null ? entity.artwork : "";
    }
}
