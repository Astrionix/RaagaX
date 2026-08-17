package com.raagax.music.data.model;

public class MusicTrack {
    public String id;
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
    public boolean isDownloaded;
    public boolean isLiked;
    public String localPath;

    public MusicTrack() {}

    public MusicTrack(String id, String title, String artist, String album, long durationMs, String artworkUrl, String streamUrl) {
        this.id = id;
        this.title = title;
        this.artist = artist;
        this.album = album;
        this.durationMs = durationMs;
        this.artworkUrl = artworkUrl;
        this.streamUrl = streamUrl;
    }
}
