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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class SaavnMusicProvider implements MusicProvider {
    private static final String BASE_API = "https://www.jiosaavn.com/api.php?";
    private static final String SEARCH_ALL_URL = BASE_API + "__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=";
    private static final String SEARCH_SONGS_URL = BASE_API + "__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=";
    private static final String SEARCH_ALBUMS_URL = BASE_API + "__call=search.getAlbumResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=";
    private static final String SONG_DETAILS_URL = BASE_API + "__call=song.getDetails&_format=json&cc=in&_marker=0&pids=";
    private static final String ALBUM_DETAILS_URL = BASE_API + "__call=content.getAlbumDetails&_format=json&cc=in&_marker=0&albumid=";

    private final OkHttpClient httpClient;

    public SaavnMusicProvider() {
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build();
    }

    @Override
    public SearchResult search(String query, int limit) throws Exception {
        return search(query, null, limit);
    }

    @Override
    public SearchResult search(String query, String language, int limit) throws Exception {
        SearchResult result = new SearchResult(query);
        String langParam = normalizeLanguage(language);
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());

        String targetUrl;
        if (langParam != null && !langParam.isEmpty()) {
            targetUrl = SEARCH_SONGS_URL + limit + "&q=" + encodedQuery + "&language=" + langParam;
        } else {
            targetUrl = SEARCH_ALL_URL + encodedQuery;
        }

        Request request = new Request.Builder()
            .url(targetUrl)
            .header("User-Agent", "Mozilla/5.0")
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                return result;
            }
            String bodyStr = response.body().string();
            JsonObject root = JsonParser.parseString(bodyStr).getAsJsonObject();

            // Extract results array (either from root.results or root.songs.data)
            JsonArray songArr = null;
            if (root.has("results") && root.get("results").isJsonArray()) {
                songArr = root.getAsJsonArray("results");
            } else if (root.has("songs") && root.getAsJsonObject("songs").has("data")) {
                songArr = root.getAsJsonObject("songs").getAsJsonArray("data");
            }

            if (songArr != null) {
                int count = 0;
                for (JsonElement el : songArr) {
                    if (count >= limit) break;
                    JsonObject obj = el.getAsJsonObject();
                    String trackLang = getSafeString(obj, "language");
                    if (trackLang == null) trackLang = getSafeString(obj, "more_info", "language");

                    // Filter by language metadata if requested
                    if (langParam != null && trackLang != null && !trackLang.equalsIgnoreCase(langParam)) {
                        continue;
                    }

                    MusicTrack track = new MusicTrack();
                    track.id = getSafeString(obj, "id");
                    track.title = cleanHtml(getSafeString(obj, "title", "song"));
                    track.artist = cleanHtml(getSafeString(obj, "more_info", "singers", "description", "primary_artists"));
                    track.album = cleanHtml(getSafeString(obj, "album", "more_info"));
                    track.artworkUrl = formatArtworkUrl(getSafeString(obj, "image"));
                    track.language = trackLang != null ? trackLang : (language != null ? language : "Telugu");
                    track.streamUrl = extractMediaUrl(obj);

                    if (track.id != null && !track.id.isEmpty() && track.title != null && !track.title.isEmpty()) {
                        result.tracks.add(track);
                        count++;
                    }
                }
            }
        }
        return result;
    }

    @Override
    public List<MusicTrack> getLatestSongs(String language, int limit) throws Exception {
        List<MusicTrack> tracks = new ArrayList<>();
        String langParam = normalizeLanguage(language);
        String url = SEARCH_SONGS_URL + limit + "&q=" + URLEncoder.encode(language + " Latest Hits", StandardCharsets.UTF_8.toString()) + "&language=" + langParam;

        Request request = new Request.Builder()
            .url(url)
            .header("User-Agent", "Mozilla/5.0")
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) return tracks;
            String bodyStr = response.body().string();
            JsonObject root = JsonParser.parseString(bodyStr).getAsJsonObject();

            if (root.has("results") && root.get("results").isJsonArray()) {
                JsonArray songArr = root.getAsJsonArray("results");
                for (JsonElement el : songArr) {
                    if (tracks.size() >= limit) break;
                    JsonObject obj = el.getAsJsonObject();
                    String trackLang = getSafeString(obj, "language");
                    if (trackLang == null) trackLang = getSafeString(obj, "more_info", "language");

                    if (langParam != null && trackLang != null && !trackLang.equalsIgnoreCase(langParam)) {
                        continue;
                    }

                    MusicTrack track = new MusicTrack();
                    track.id = getSafeString(obj, "id");
                    track.title = cleanHtml(getSafeString(obj, "title", "song"));
                    track.artist = cleanHtml(getSafeString(obj, "more_info", "singers", "description", "primary_artists"));
                    track.album = cleanHtml(getSafeString(obj, "album"));
                    track.artworkUrl = formatArtworkUrl(getSafeString(obj, "image"));
                    track.language = trackLang != null ? trackLang : language;
                    track.streamUrl = extractMediaUrl(obj);

                    if (track.id != null && track.title != null) {
                        tracks.add(track);
                    }
                }
            }
        }
        return tracks;
    }

    @Override
    public List<MusicAlbum> getTrendingAlbums(String language, int limit) throws Exception {
        List<MusicAlbum> albums = new ArrayList<>();
        String langParam = normalizeLanguage(language);
        String url = SEARCH_ALBUMS_URL + limit + "&q=" + URLEncoder.encode(language + " Soundtracks", StandardCharsets.UTF_8.toString()) + "&language=" + langParam;

        Request request = new Request.Builder()
            .url(url)
            .header("User-Agent", "Mozilla/5.0")
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) return albums;
            String bodyStr = response.body().string();
            JsonObject root = JsonParser.parseString(bodyStr).getAsJsonObject();

            if (root.has("results") && root.get("results").isJsonArray()) {
                JsonArray arr = root.getAsJsonArray("results");
                for (JsonElement el : arr) {
                    if (albums.size() >= limit) break;
                    JsonObject obj = el.getAsJsonObject();
                    String albumLang = getSafeString(obj, "language");
                    if (albumLang == null) albumLang = getSafeString(obj, "more_info", "language");

                    if (langParam != null && albumLang != null && !albumLang.equalsIgnoreCase(langParam)) {
                        continue;
                    }

                    MusicAlbum album = new MusicAlbum();
                    album.id = getSafeString(obj, "id");
                    album.title = cleanHtml(getSafeString(obj, "title", "name"));
                    album.artist = cleanHtml(getSafeString(obj, "more_info", "artist", "primary_artists"));
                    album.artworkUrl = formatArtworkUrl(getSafeString(obj, "image"));
                    album.language = albumLang != null ? albumLang : language;

                    if (album.id != null && album.title != null) {
                        albums.add(album);
                    }
                }
            }
        }
        return albums;
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
                track.title = cleanHtml(getSafeString(obj, "song", "title"));
                track.artist = cleanHtml(getSafeString(obj, "singers", "primary_artists"));
                track.album = cleanHtml(getSafeString(obj, "album"));
                track.artworkUrl = formatArtworkUrl(getSafeString(obj, "image"));
                track.language = getSafeString(obj, "language");
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
            album.language = getSafeString(obj, "language");

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
                    track.language = album.language;
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

    private String normalizeLanguage(String lang) {
        if (lang == null || lang.isEmpty()) return "telugu";
        return lang.toLowerCase().trim();
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
        if (obj.has("more_info") && obj.getAsJsonObject("more_info").has("encrypted_media_url")) {
            String media = obj.getAsJsonObject("more_info").get("encrypted_media_url").getAsString();
            if (media != null && !media.isEmpty()) {
                return media;
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
