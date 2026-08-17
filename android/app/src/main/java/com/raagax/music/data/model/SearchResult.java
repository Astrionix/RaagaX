package com.raagax.music.data.model;

import java.util.ArrayList;
import java.util.List;

public class SearchResult {
    public List<MusicTrack> tracks = new ArrayList<>();
    public List<MusicAlbum> albums = new ArrayList<>();
    public String query;
    public boolean isOfflineResult;

    public SearchResult(String query) {
        this.query = query;
    }
}
