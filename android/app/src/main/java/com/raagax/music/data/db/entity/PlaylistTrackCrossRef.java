package com.raagax.music.data.db.entity;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.Index;

@Entity(
    tableName = "playlist_tracks",
    primaryKeys = {"playlistId", "trackId"},
    indices = {
        @Index(value = {"playlistId"}),
        @Index(value = {"trackId"})
    }
)
public class PlaylistTrackCrossRef {
    @NonNull
    public String playlistId;

    @NonNull
    public String trackId;

    public int position;
    public long addedAt;

    public PlaylistTrackCrossRef(@NonNull String playlistId, @NonNull String trackId, int position) {
        this.playlistId = playlistId;
        this.trackId = trackId;
        this.position = position;
        this.addedAt = System.currentTimeMillis();
    }
}
