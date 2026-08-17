package com.raagax.music.data.provider;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.raagax.music.data.model.MusicAlbum;
import com.raagax.music.data.model.MusicTrack;
import com.raagax.music.data.model.SearchResult;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SaavnMusicProvider implements MusicProvider {
    private static final String SEARCH_ALL_URL = "https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=";
    private static final String SONG_DETAILS_URL = "https://www.jiosaavn.com/api.php?__call=song.getDetails&_format=json&cc=in&_marker=0&pids=";
    private static final String ALBUM_DETAILS_URL = "https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&_format=json&cc=in&_marker=0&albumid=";

    private final OkHttpClient httpClient;

    public SaavnMusicProvider() {
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build();
    }

    @Override
    public SearchResult search(String query, int limit) throws Exception {
        SearchResult result = new SearchResult(query);
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        Request request = new Request.Builder()
            .url(SEARCH_ALL_URL + encodedQuery)
            .header("User-Agent", "Mozilla/5.0")
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                return result;
            }
            String bodyStr = response.body().string();
            JsonObject root = JsonParser.parseString(bodyStr).getAsJsonObject();

            // Extract Songs
            if (root.has("songs") && root.getAsJsonObject("songs").has("data")) {
                JsonArray songArr = root.getAsJsonObject("songs").getAsJsonArray("data");
                int count = 0;
                for (JsonElement el : songArr) {
                    if (count >= limit) break;
                    JsonObject obj = el.getAsJsonObject();
                    MusicTrack track = new MusicTrack();
                    track.id = getSafeString(obj, "id");
                    track.title = cleanHtml(getSafeString(obj, "title"));
                    track.artist = cleanHtml(getSafeString(obj, "more_info", "singers", "description"));
                    track.album = cleanHtml(getSafeString(obj, "album"));
                    track.artworkUrl = formatArtworkUrl(getSafeString(obj, "image"));
                    
                    if (track.id != null && !track.id.isEmpty() && track.title != null) {
                        result.tracks.add(track);
                        count++;
                    }
                }
            }

            // Extract Albums
            if (root.has("albums") && root.getAsJsonObject("albums").has("data")) {
                JsonArray albumArr = root.getAsJsonObject("albums").getAsJsonArray("data");
                int count = 0;
                for (JsonElement el : albumArr) {
                    if (count >= limit) break;
                    JsonObject obj = el.getAsJsonObject();
                    MusicAlbum album = new MusicAlbum();
                    album.id = getSafeString(obj, "id");
                    album.title = cleanHtml(getSafeString(obj, "title"));
                    album.artist = cleanHtml(getSafeString(obj, "more_info", "artist", "description"));
                    album.artworkUrl = formatArtworkUrl(getSafeString(obj, "image"));
                    
                    if (album.id != null && !album.id.isEmpty()) {
                        result.albums.add(album);
                        count++;
                    }
                }
            }
        }
        return result;
    }

    @Override
    public MusicTrack getTrackDetails(String trackId) throws Exception {
        Request request = new Request.Builder()
            .url(SONG_DETAILS_URL + trackId)
            .header("User-Agent", "Mozilla/5.0")
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) return null;
            String bodyStr = response.body().string();
            JsonObject root = JsonParser.parseString(bodyStr).getAsJsonObject();

            if (root.has(trackId)) {
                JsonObject obj = root.getAsJsonObject(trackId);
                MusicTrack track = new MusicTrack();
                track.id = trackId;
                track.title = cleanHtml(getSafeString(obj, "song"));
                track.artist = cleanHtml(getSafeString(obj, "singers"));
                track.album = cleanHtml(getSafeString(obj, "album"));
                track.artworkUrl = formatArtworkUrl(getSafeString(obj, "image"));
                track.streamUrl = extractMediaUrl(obj);
                
                try {
                    String durationStr = getSafeString(obj, "duration");
                    if (durationStr != null) track.durationMs = Long.parseLong(durationStr) * 1000;
                } catch (Exception ignored) {}

                try {
                    String yearStr = getSafeString(obj, "year");
                    if (yearStr != null) track.releaseYear = Integer.parseInt(yearStr);
                } catch (Exception ignored) {}

                return track;
            }
        }
        return null;
    }

    @Override
    public MusicAlbum getAlbumDetails(String albumId) throws Exception {
        Request request = new Request.Builder()
            .url(ALBUM_DETAILS_URL + albumId)
            .header("User-Agent", "Mozilla/5.0")
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) return null;
            String bodyStr = response.body().string();
            JsonObject obj = JsonParser.parseString(bodyStr).getAsJsonObject();

            MusicAlbum album = new MusicAlbum();
            album.id = albumId;
            album.title = cleanHtml(getSafeString(obj, "name", "title"));
            album.artist = cleanHtml(getSafeString(obj, "primary_artists"));
            album.artworkUrl = formatArtworkUrl(getSafeString(obj, "image"));

            if (obj.has("songs") && obj.get("songs").isJsonArray()) {
                JsonArray songArr = obj.getAsJsonArray("songs");
                for (JsonElement el : songArr) {
                    JsonObject songObj = el.getAsJsonObject();
                    MusicTrack track = new MusicTrack();
                    track.id = getSafeString(songObj, "id");
                    track.title = cleanHtml(getSafeString(songObj, "song"));
                    track.artist = cleanHtml(getSafeString(songObj, "singers"));
                    track.album = album.title;
                    track.artworkUrl = formatArtworkUrl(getSafeString(songObj, "image"));
                    track.streamUrl = extractMediaUrl(songObj);
                    
                    try {
                        String durationStr = getSafeString(songObj, "duration");
                        if (durationStr != null) track.durationMs = Long.parseLong(durationStr) * 1000;
                    } catch (Exception ignored) {}

                    album.tracks.add(track);
                }
            }
            return album;
        }
    }

    @Override
    public String resolveStreamUrl(String trackId) throws Exception {
        MusicTrack track = getTrackDetails(trackId);
        return track != null ? track.streamUrl : null;
    }

    private String extractMediaUrl(JsonObject obj) {
        if (obj.has("media_preview_url")) {
            String preview = obj.get("media_preview_url").getAsString();
            if (preview != null && !preview.isEmpty()) {
                return preview.replace("preview.saavncdn.com", "aac.saavncdn.com")
                              .replace("_96_p.mp4", "_320.mp4")
                              .replace("_96_p.m4a", "_320.m4a");
            }
        }
        return null;
    }

    private String formatArtworkUrl(String url) {
        if (url == null || url.isEmpty()) return null;
        return url.replace("http://", "https://")
                  .replace("150x150", "500x500")
                  .replace("50x50", "500x500");
    }

    private String cleanHtml(String text) {
        if (text == null) return "";
        return text.replace("&quot;", "\"")
                   .replace("&amp;", "&")
                   .replace("&#039;", "'")
                   .trim();
    }

    private String getSafeString(JsonObject obj, String... keys) {
        for (String key : keys) {
            if (obj.has(key) && !obj.get(key).isJsonNull()) {
                return obj.get(key).getAsString();
            }
        }
        return null;
    }
}
