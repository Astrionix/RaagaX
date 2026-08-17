package com.raagax.music.data.db.entity;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "playlists")
public class PlaylistEntity {
    @PrimaryKey
    @NonNull
    public String id;

    @NonNull
    public String name;

    public String description;
    public String coverUrl;
    public boolean isUserOwned;
    public boolean isDownloaded;
    public int trackCount;
    public long createdAt;
    public long updatedAt;

    public PlaylistEntity(@NonNull String id, @NonNull String name) {
        this.id = id;
        this.name = name;
        this.createdAt = System.currentTimeMillis();
        this.updatedAt = System.currentTimeMillis();
    }
}
