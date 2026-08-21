package com.raagax.music.playback;

import android.content.Context;
import android.net.Uri;
import android.util.Log;

import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.db.entity.DownloadEntity;
import com.raagax.music.download.StorageHelper;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * OfflineQueueResolver — Centralized offline track resolver.
 *
 * Converts a list of song IDs into a playback-ready list of locally verified tracks.
 * Only songs with a COMPLETED download and a verified physical file are included.
 *
 * Flow:
 *   songIds[]
 *       ↓
 *   Room DB batch query (COMPLETED only)
 *       ↓
 *   File.exists() + length > 0 verification
 *       ↓
 *   ResolvedTrack[] (same order, gaps removed)
 *       ↓
 *   Caller builds ExoPlayer MediaItems with mediaId = songId
 *
 * Thread safety: all public methods are safe to call from any thread.
 * They perform DB I/O synchronously on the calling thread — always call
 * from a background executor, never from the main thread.
 */
public class OfflineQueueResolver {

    private static final String TAG = "OfflineQueueResolver";

    // ── Resolved track data class ────────────────────────────────────────────

    public static class ResolvedTrack {
        /** Song ID — use as ExoPlayer MediaItem.mediaId */
        public final String songId;
        /** Absolute path to the downloaded audio file */
        public final String localPath;
        /** file:// URI suitable for ExoPlayer */
        public final Uri localUri;
        public final String title;
        public final String artist;
        /** Local artwork URI (file://) or remote URL, may be empty */
        public final String artworkUrl;
        public final long fileSize;

        public ResolvedTrack(String songId, String localPath, String title,
                             String artist, String artworkUrl, long fileSize) {
            this.songId     = songId;
            this.localPath  = localPath;
            this.localUri   = Uri.fromFile(new File(localPath));
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
     * Resolves a list of song IDs to locally verified offline tracks.
     *
     * Rules:
     * - Only songs with downloadState == COMPLETED are considered.
     * - Physical file is verified: must exist and be > 0 bytes.
     * - Invalid COMPLETED records are marked FAILED in Room.
     * - Order is preserved; missing or unavailable songs are silently skipped.
     *
     * MUST be called on a background thread — performs synchronous DB I/O.
     *
     * @param songIds ordered list of song IDs to resolve
     * @return ordered list of resolvable offline tracks (may be shorter than input)
     */
    public List<ResolvedTrack> resolve(List<String> songIds) {
        List<ResolvedTrack> result = new ArrayList<>();

        if (songIds == null || songIds.isEmpty()) {
            return result;
        }

        Log.d(TAG, "[OfflineQueueResolver] resolve() input=" + songIds.size() + " songIds");

        // Batch-query Room for all COMPLETED records matching the requested IDs.
        // We then do a secondary pass to build an ordered result and verify files.
        List<DownloadEntity> completedEntities =
                database.downloadDao().getCompletedDownloadsForTracks(songIds);

        // Build a quick lookup map: songId → DownloadEntity
        Map<String, DownloadEntity> entityMap = new HashMap<>();
        for (DownloadEntity entity : completedEntities) {
            entityMap.put(entity.trackId, entity);
            // Also index by songId field in case they differ
            if (entity.songId != null && !entity.songId.equals(entity.trackId)) {
                entityMap.put(entity.songId, entity);
            }
        }

        int skippedNotDownloaded = 0;
        int skippedFileMissing   = 0;
        int resolved             = 0;

        for (String songId : songIds) {
            if (songId == null || songId.isEmpty()) continue;

            DownloadEntity entity = entityMap.get(songId);

            if (entity == null) {
                // Not downloaded at all — expected for non-downloaded songs
                skippedNotDownloaded++;
                Log.v(TAG, "[OfflineQueueResolver] skip songId=" + songId + " reason=NOT_DOWNLOADED");
                continue;
            }

            if (entity.localPath == null || entity.localPath.isEmpty()) {
                skippedFileMissing++;
                Log.w(TAG, "[OfflineQueueResolver] skip songId=" + songId + " reason=NO_LOCAL_PATH");
                database.downloadDao().updateState(songId, "FAILED");
                continue;
            }

            File file = new File(entity.localPath);
            if (!file.exists() || file.length() == 0L) {
                skippedFileMissing++;
                Log.w(TAG, "[OfflineQueueResolver] skip songId=" + songId
                        + " reason=FILE_MISSING path=" + entity.localPath
                        + " exists=" + file.exists() + " size=" + file.length());
                // Repair: mark stale record as FAILED so UI and re-download logic see the truth
                database.downloadDao().updateState(songId, "FAILED");
                continue;
            }

            // Resolve artwork: prefer local cached file, fall back to stored URL
            String artworkUrl = resolveArtworkUrl(entity);

            result.add(new ResolvedTrack(
                    songId,
                    entity.localPath,
                    entity.title,
                    entity.artist,
                    artworkUrl,
                    file.length()
            ));
            resolved++;
            Log.v(TAG, "[OfflineQueueResolver] resolved songId=" + songId
                    + " size=" + file.length() + " path=" + entity.localPath);
        }

        Log.d(TAG, "[OfflineQueueResolver] resolve() done:"
                + " resolved=" + resolved
                + " skippedNotDownloaded=" + skippedNotDownloaded
                + " skippedFileMissing=" + skippedFileMissing
                + " totalInput=" + songIds.size());

        return result;
    }

    /**
     * Check if a single song is available offline with a verified local file.
     * Safe to call from any background thread.
     *
     * @param songId the song ID to check
     * @return true if the song has a COMPLETED download with a valid physical file
     */
    public boolean isAvailableOffline(String songId) {
        if (songId == null || songId.isEmpty()) return false;
        try {
            DownloadEntity entity = database.downloadDao().getDownloadByTrackId(songId);
            if (entity == null || !"COMPLETED".equalsIgnoreCase(entity.downloadState)) return false;
            if (entity.localPath == null || entity.localPath.isEmpty()) return false;
            File file = new File(entity.localPath);
            return file.exists() && file.length() > 0L;
        } catch (Exception e) {
            Log.w(TAG, "[OfflineQueueResolver] isAvailableOffline check failed for " + songId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Resolve a single song for offline playback.
     * Returns null if the song is not available offline.
     * Safe to call from any background thread.
     */
    public ResolvedTrack resolveSingle(String songId) {
        if (songId == null || songId.isEmpty()) return null;
        try {
            DownloadEntity entity = database.downloadDao().getDownloadByTrackId(songId);
            if (entity == null || !"COMPLETED".equalsIgnoreCase(entity.downloadState)) return null;
            if (entity.localPath == null || entity.localPath.isEmpty()) return null;

            File file = new File(entity.localPath);
            if (!file.exists() || file.length() == 0L) {
                database.downloadDao().updateState(songId, "FAILED");
                return null;
            }

            String artworkUrl = resolveArtworkUrl(entity);
            return new ResolvedTrack(songId, entity.localPath, entity.title,
                    entity.artist, artworkUrl, file.length());
        } catch (Exception e) {
            Log.w(TAG, "[OfflineQueueResolver] resolveSingle failed for " + songId + ": " + e.getMessage());
            return null;
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private String resolveArtworkUrl(DownloadEntity entity) {
        // Prefer locally cached artwork file
        try {
            File artFile = StorageHelper.getArtworkFile(context, entity.trackId);
            if (artFile != null && artFile.exists() && artFile.length() > 0) {
                return "file://" + artFile.getAbsolutePath();
            }
        } catch (Exception ignored) {}

        // Fall back to whatever was stored (could be a remote URL)
        return entity.artwork != null ? entity.artwork : "";
    }
}
