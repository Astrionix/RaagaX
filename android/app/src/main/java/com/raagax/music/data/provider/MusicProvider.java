package com.raagax.music.data.provider;

import com.raagax.music.data.model.MusicAlbum;
import com.raagax.music.data.model.MusicTrack;
import com.raagax.music.data.model.SearchResult;
import java.util.List;

public interface MusicProvider {
    SearchResult search(String query, int limit) throws Exception;
    SearchResult search(String query, String language, int limit) throws Exception;
    MusicTrack getTrackDetails(String trackId) throws Exception;
    MusicAlbum getAlbumDetails(String albumId) throws Exception;
    String resolveStreamUrl(String trackId) throws Exception;
    List<MusicTrack> getLatestSongs(String language, int limit) throws Exception;
    List<MusicAlbum> getTrendingAlbums(String language, int limit) throws Exception;
}
