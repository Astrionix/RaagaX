package com.raagax.music.data.db.dao;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;
import com.raagax.music.data.db.entity.DownloadEntity;
import java.util.List;

@Dao
public interface DownloadDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertOrUpdate(DownloadEntity download);

    @Query("SELECT * FROM downloads WHERE trackId = :trackId OR songId = :trackId LIMIT 1")
    DownloadEntity getDownloadByTrackId(String trackId);

    @Query("SELECT * FROM downloads WHERE downloadState = 'COMPLETED' ORDER BY completedAt DESC")
    List<DownloadEntity> getAllCompletedDownloads();

    @Query("SELECT * FROM downloads WHERE downloadState IN ('QUEUED', 'DOWNLOADING', 'VERIFYING', 'PAUSED') ORDER BY createdAt ASC")
    List<DownloadEntity> getActiveDownloads();

    @Query("SELECT * FROM downloads ORDER BY createdAt DESC")
    List<DownloadEntity> getAllDownloads();

    @Query("SELECT COUNT(*) FROM downloads WHERE downloadState = 'COMPLETED'")
    int getCompletedDownloadCount();

    @Query("SELECT COALESCE(SUM(fileSize), 0) FROM downloads WHERE downloadState = 'COMPLETED'")
    long getTotalDownloadedBytes();

    @Query("UPDATE downloads SET downloadState = :state, downloadProgress = :progress, downloadedBytes = :bytes WHERE trackId = :trackId OR songId = :trackId")
    void updateProgress(String trackId, String state, int progress, long bytes);

    @Query("UPDATE downloads SET downloadState = 'COMPLETED', localPath = :localPath, fileName = :fileName, fileSize = :fileSize, mimeType = :mimeType, quality = :quality, completedAt = :completedAt, downloadProgress = 100 WHERE trackId = :trackId OR songId = :trackId")
    void markCompleted(String trackId, String localPath, String fileName, long fileSize, String mimeType, String quality, long completedAt);

    @Query("UPDATE downloads SET downloadState = 'FAILED', errorMessage = :error WHERE trackId = :trackId OR songId = :trackId")
    void markFailed(String trackId, String error);

    @Query("UPDATE downloads SET downloadState = :state WHERE trackId = :trackId OR songId = :trackId")
    void updateState(String trackId, String state);

    @Query("DELETE FROM downloads WHERE trackId = :trackId OR songId = :trackId")
    void deleteDownload(String trackId);

    @Query("DELETE FROM downloads")
    void clearAllDownloads();
}
