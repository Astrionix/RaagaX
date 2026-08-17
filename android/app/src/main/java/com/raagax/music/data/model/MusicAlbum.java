package com.raagax.music.data.model;

import java.util.ArrayList;
import java.util.List;

public class MusicAlbum {
    public String id;
    public String title;
    public String artist;
    public String artworkUrl;
    public int releaseYear;
    public String language;
    public List<MusicTrack> tracks = new ArrayList<>();

    public MusicAlbum() {}

    public MusicAlbum(String id, String title, String artist, String artworkUrl, int releaseYear) {
        this.id = id;
        this.title = title;
        this.artist = artist;
        this.artworkUrl = artworkUrl;
        this.releaseYear = releaseYear;
    }
}
