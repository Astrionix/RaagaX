package com.raagax.music.data.db.entity;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "tracks")
public class TrackEntity {
    @PrimaryKey
    @NonNull
    public String id;

    @NonNull
    public String title;
    
    public String artist;
    public String artistId;
    public String album;
    public String albumId;
    public long durationMs;
    public String artworkUrl;
    public String streamUrl;
    public String language;
    public int releaseYear;
    public boolean isLiked;
    public long lastPlayedAt;
    public long createdAt;

    public TrackEntity(@NonNull String id, @NonNull String title, String artist, String album, long durationMs, String artworkUrl) {
        this.id = id;
        this.title = title;
        this.artist = artist != null ? artist : "Unknown Artist";
        this.album = album != null ? album : "Unknown Album";
        this.durationMs = durationMs;
        this.artworkUrl = artworkUrl;
        this.createdAt = System.currentTimeMillis();
    }
}
