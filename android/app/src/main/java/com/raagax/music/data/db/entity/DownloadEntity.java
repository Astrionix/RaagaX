package com.raagax.music.data.db.entity;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

@Entity(
    tableName = "downloads",
    indices = {@Index(value = {"trackId"}, unique = true)}
)
public class DownloadEntity {
    @PrimaryKey
    @NonNull
    public String downloadId;

    @NonNull
    public String trackId;

    public String localPath;
    public String mimeType;
    public long fileSize;
    public long downloadedBytes;
    public int downloadProgress; // 0 to 100
    
    @NonNull
    public String downloadState; // QUEUED, DOWNLOADING, VERIFYING, COMPLETED, FAILED, CANCELLED

    public String errorMessage;
    public String referencesJson; // e.g. ["liked", "playlist_123"]
    public long createdAt;
    public long completedAt;

    public DownloadEntity(@NonNull String downloadId, @NonNull String trackId, @NonNull String downloadState) {
        this.downloadId = downloadId;
        this.trackId = trackId;
        this.downloadState = downloadState;
        this.createdAt = System.currentTimeMillis();
        this.referencesJson = "[]";
    }
}
