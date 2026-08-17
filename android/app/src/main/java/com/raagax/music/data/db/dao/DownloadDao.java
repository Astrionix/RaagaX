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

    @Query("SELECT * FROM downloads WHERE trackId = :trackId LIMIT 1")
    DownloadEntity getDownloadByTrackId(String trackId);

    @Query("SELECT * FROM downloads WHERE downloadState = 'COMPLETED' ORDER BY completedAt DESC")
    List<DownloadEntity> getAllCompletedDownloads();

    @Query("SELECT * FROM downloads WHERE downloadState IN ('QUEUED', 'DOWNLOADING', 'VERIFYING')")
    List<DownloadEntity> getActiveDownloads();

    @Query("SELECT COUNT(*) FROM downloads WHERE downloadState = 'COMPLETED'")
    int getCompletedDownloadCount();

    @Query("SELECT SUM(fileSize) FROM downloads WHERE downloadState = 'COMPLETED'")
    long getTotalDownloadedBytes();

    @Query("UPDATE downloads SET downloadState = :state, downloadProgress = :progress, downloadedBytes = :bytes WHERE trackId = :trackId")
    void updateProgress(String trackId, String state, int progress, long bytes);

    @Query("UPDATE downloads SET downloadState = 'COMPLETED', localPath = :localPath, fileSize = :fileSize, mimeType = :mimeType, completedAt = :completedAt WHERE trackId = :trackId")
    void markCompleted(String trackId, String localPath, long fileSize, String mimeType, long completedAt);

    @Query("UPDATE downloads SET downloadState = 'FAILED', errorMessage = :error WHERE trackId = :trackId")
    void markFailed(String trackId, String error);

    @Query("DELETE FROM downloads WHERE trackId = :trackId")
    void deleteDownload(String trackId);

    @Query("DELETE FROM downloads")
    void clearAllDownloads();
}
