package com.raagax.music.data.provider;

import android.util.Base64;
import android.util.Log;
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
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.DESKeySpec;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/**
 * SaavnMusicProvider — Direct client for JioSaavn API.
 * Features:
 * - Native Java DES decryption (key "38346591") for encrypted_media_url
 * - Multi-tier stream URL resolver (Classic API -> New API -> Search Fallback)
 * - Support for 320 kbps HQ audio CDN links
 */
public class SaavnMusicProvider implements MusicProvider {
    private static final String TAG = "SaavnMusicProvider";
    private static final String DES_SECRET_KEY = "38346591";

    private static final String BASE_API = "https://www.jiosaavn.com/api.php?";
    private static final String SEARCH_ALL_URL = BASE_API + "__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query=";
    private static final String SEARCH_SONGS_URL = BASE_API + "__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=";
    private static final String SEARCH_ALBUMS_URL = BASE_API + "__call=search.getAlbumResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=";
    private static final String SONG_DETAILS_URL = BASE_API + "__call=song.getDetails&_format=json&cc=in&_marker=0&pids=";
    private static final String ALBUM_DETAILS_URL = BASE_API + "__call=content.getAlbumDetails&_format=json&cc=in&_marker=0&albumid=";

    private final OkHttpClient httpClient;
    private static volatile SaavnMusicProvider INSTANCE;

    public static SaavnMusicProvider getInstance() {
        if (INSTANCE == null) {
            synchronized (SaavnMusicProvider.class) {
                if (INSTANCE == null) {
                    INSTANCE = new SaavnMusicProvider();
                }
            }
        }
        return INSTANCE;
    }

    public SaavnMusicProvider() {
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build();
    }

    /**
     * Native DES decryption for JioSaavn encrypted_media_url.
     * Uses standard DES/ECB/PKCS5Padding with key "38346591".
     * Resolves encrypted tokens directly to playable CDN URLs like:
     * https://aac.saavncdn.com/712/7f1f7d6a59990ce4a339908cfdf4cb95_320.mp4
     */
    public static String decryptJioSaavnMediaUrl(String encryptedUrl) {
        if (encryptedUrl == null || encryptedUrl.trim().isEmpty()) {
            return null;
        }
        try {
            DESKeySpec dks = new DESKeySpec(DES_SECRET_KEY.getBytes(StandardCharsets.UTF_8));
            SecretKeyFactory keyFactory = SecretKeyFactory.getInstance("DES");
            SecretKey secretKey = keyFactory.generateSecret(dks);

            Cipher cipher = Cipher.getInstance("DES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey);

            byte[] decodedBytes = Base64.decode(encryptedUrl.trim(), Base64.DEFAULT);
            byte[] decrypted = cipher.doFinal(decodedBytes);
            String decryptedUrl = new String(decrypted, StandardCharsets.UTF_8).trim();

            if (decryptedUrl.startsWith("http://") || decryptedUrl.startsWith("https://")) {
                // Ensure 320 kbps quality
                String hqUrl = decryptedUrl.replace("http://", "https://")
                        .replace("_96.mp4", "_320.mp4")
                        .replace("_160.mp4", "_320.mp4")
                        .replace("_96.m4a", "_320.m4a")
                        .replace("_160.m4a", "_320.m4a")
                        .replace("_96.mp3", "_320.mp3")
                        .replace("_160.mp3", "_320.mp3");
                Log.d(TAG, "[DOWNLOAD] Decrypted JioSaavn media URL successfully: " + hqUrl);
                return hqUrl;
            }
        } catch (Exception e) {
            Log.w(TAG, "[SaavnProvider] DES media URL decryption failed: " + e.getMessage());
        }
        return null;
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
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 RaagaX/1.0")
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) {
                return result;
            }
            String bodyStr = response.body().string();
            JsonObject root = JsonParser.parseString(bodyStr).getAsJsonObject();

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
        Log.d(TAG, "[DOWNLOAD] Resolving track details for ID: " + trackId);

        // 1. Primary: song.getDetails (classic API + DES Decryption)
        MusicTrack track = fetchTrackFromClassicApi(trackId);
        if (track != null && track.streamUrl != null && !track.streamUrl.isEmpty()) {
            Log.d(TAG, "[DOWNLOAD] Resolved stream URL via Classic API: " + track.streamUrl);
            return track;
        }

        // 2. Secondary: saavn.dev API
        Log.d(TAG, "[SaavnProvider] Classic API returned no stream URL for " + trackId + ", trying secondary API");
        MusicTrack secondary = fetchTrackFromNewApi(trackId);
        if (secondary != null && secondary.streamUrl != null && !secondary.streamUrl.isEmpty()) {
            Log.d(TAG, "[DOWNLOAD] Resolved stream URL via Secondary API: " + secondary.streamUrl);
            return secondary;
        }

        return track;
    }

    private MusicTrack fetchTrackFromClassicApi(String trackId) {
        try {
            Request request = new Request.Builder()
                .url(SONG_DETAILS_URL + trackId)
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 RaagaX/1.0")
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
        } catch (Exception e) {
            Log.w(TAG, "[SaavnProvider] fetchTrackFromClassicApi failed for " + trackId + ": " + e.getMessage());
        }
        return null;
    }

    private MusicTrack fetchTrackFromNewApi(String trackId) {
        String[] endpoints = new String[] {
            "https://saavn.dev/api/songs?id=" + trackId,
            "https://saavn.dev/api/songs/" + trackId,
            "https://raagax.padalalmrreddy.workers.dev/api/songs?ids=" + trackId,
            "https://raagax.padalalmrreddy.workers.dev/api/songs/" + trackId
        };

        for (String url : endpoints) {
            try {
                Request request = new Request.Builder()
                    .url(url)
                    .header("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 RaagaX/1.0")
                    .build();

                try (Response response = httpClient.newCall(request).execute()) {
                    if (!response.isSuccessful() || response.body() == null) continue;
                    String bodyStr = response.body().string();
                    JsonObject root = JsonParser.parseString(bodyStr).getAsJsonObject();

                    JsonArray data = null;
                    if (root.has("data") && root.get("data").isJsonArray()) {
                        data = root.getAsJsonArray("data");
                    } else if (root.has("songs") && root.get("songs").isJsonArray()) {
                        data = root.getAsJsonArray("songs");
                    }

                    if (data != null && data.size() > 0) {
                        JsonObject obj = data.get(0).getAsJsonObject();
                        MusicTrack track = new MusicTrack();
                        track.id = trackId;
                        track.title = cleanHtml(getSafeString(obj, "name", "title"));
                        if (obj.has("artists") && obj.getAsJsonObject("artists").has("primary")) {
                            JsonArray artists = obj.getAsJsonObject("artists").getAsJsonArray("primary");
                            StringBuilder sb = new StringBuilder();
                            for (JsonElement a : artists) {
                                if (sb.length() > 0) sb.append(", ");
                                sb.append(cleanHtml(getSafeString(a.getAsJsonObject(), "name")));
                            }
                            track.artist = sb.toString();
                        } else {
                            track.artist = cleanHtml(getSafeString(obj, "artist", "subtitle"));
                        }
                        if (obj.has("album")) {
                            track.album = cleanHtml(getSafeString(obj.getAsJsonObject("album"), "name", "title"));
                        }
                        if (obj.has("image") && obj.get("image").isJsonArray()) {
                            JsonArray images = obj.getAsJsonArray("image");
                            if (images.size() > 0) {
                                JsonObject lastImg = images.get(images.size() - 1).getAsJsonObject();
                                track.artworkUrl = formatArtworkUrl(getSafeString(lastImg, "url", "link"));
                            }
                        }
                        track.language = getSafeString(obj, "language");
                        track.streamUrl = extractMediaUrl(obj);
                        if (track.streamUrl != null && !track.streamUrl.isEmpty()) {
                            return track;
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "[SaavnProvider] fetchTrackFromNewApi failed on " + url + ": " + e.getMessage());
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

    /**
     * Extracts and decrypts a directly downloadable media URL from a Saavn API response.
     */
    private String extractMediaUrl(JsonObject obj) {
        if (obj == null) return null;

        // 1. Decrypt official encrypted_media_url if present
        if (obj.has("more_info") && obj.getAsJsonObject("more_info").has("encrypted_media_url")) {
            String encrypted = getSafeString(obj.getAsJsonObject("more_info"), "encrypted_media_url");
            String decrypted = decryptJioSaavnMediaUrl(encrypted);
            if (decrypted != null && !decrypted.isEmpty()) {
                return decrypted;
            }
        }
        if (obj.has("encrypted_media_url")) {
            String encrypted = getSafeString(obj, "encrypted_media_url");
            String decrypted = decryptJioSaavnMediaUrl(encrypted);
            if (decrypted != null && !decrypted.isEmpty()) {
                return decrypted;
            }
        }

        // 2. download_url array (newer API format)
        if (obj.has("download_url") && obj.get("download_url").isJsonArray()) {
            String chosen = selectHighestQualityJava(obj.getAsJsonArray("download_url"));
            if (chosen != null) return chosen.replace("http://", "https://");
        }

        // Check more_info for download_url
        if (obj.has("more_info") && obj.getAsJsonObject("more_info").has("download_url")) {
            JsonElement dlEl = obj.getAsJsonObject("more_info").get("download_url");
            if (dlEl.isJsonArray()) {
                String chosen = selectHighestQualityJava(dlEl.getAsJsonArray());
                if (chosen != null) return chosen.replace("http://", "https://");
            }
        }

        // 3. Direct plaintext media_url
        String mediaUrl = getSafeString(obj, "media_url");
        if (mediaUrl != null && !mediaUrl.isEmpty() && !mediaUrl.contains("encrypted")) {
            return mediaUrl.replace("http://", "https://");
        }

        // 4. media_preview_url upgraded to 320 kbps
        String preview = getSafeString(obj, "media_preview_url");
        if (preview != null && !preview.isEmpty()) {
            return preview.replace("http://", "https://")
                          .replace("preview.saavncdn.com", "aac.saavncdn.com")
                          .replaceAll("_96_p\\.(mp4|m4a|mp3)$", "_320.$1")
                          .replaceAll("_48_p\\.(mp4|m4a|mp3)$", "_320.$1")
                          .replaceAll("_preview\\.(mp4|m4a|mp3)$", "_320.$1");
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

    private String selectHighestQualityJava(com.google.gson.JsonArray dlArr) {
        if (dlArr == null || dlArr.size() == 0) return null;
        
        String bestUrl = null;
        int maxBitrate = -1;
        
        for (com.google.gson.JsonElement el : dlArr) {
            if (!el.isJsonObject()) continue;
            com.google.gson.JsonObject dlObj = el.getAsJsonObject();
            String q = getSafeString(dlObj, "quality");
            String u = getSafeString(dlObj, "url", "link");
            if (u == null || u.isEmpty()) continue;
            
            int bitrate = 0;
            if (q != null) {
                String clean = q.toLowerCase().replace("kbps", "").replace(" ", "").trim();
                try {
                    bitrate = Integer.parseInt(clean);
                } catch (NumberFormatException ignored) {}
            }
            
            if (bitrate > maxBitrate) {
                maxBitrate = bitrate;
                bestUrl = u;
            }
        }
        return bestUrl;
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
