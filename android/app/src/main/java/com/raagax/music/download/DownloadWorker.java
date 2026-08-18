package com.raagax.music.download;

import android.content.Context;
import android.content.Intent;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.model.MusicTrack;
import com.raagax.music.data.provider.SaavnMusicProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * DownloadWorker — WorkManager Worker for downloading MP3 files to Music/RaagaX/.
 * Features:
 * - Resumable HTTP Range chunk streaming
 * - ID3v2.3 tagging (Title, Artist, Album, APIC Artwork)
 * - Atomic write with temporary file staging
 * - Android MediaScanner indexing
 * - Live progress reporting & Room database state management
 */
public class DownloadWorker extends Worker {
    private static final String TAG = "DownloadWorker";
    private final RaagaXDatabase database;
    private final OkHttpClient httpClient;

    public DownloadWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
        this.database = RaagaXDatabase.getInstance(context);
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .followRedirects(true)
            .build();
    }

    @NonNull
    @Override
    public Result doWork() {
        String trackId   = getInputData().getString("trackId");
        String streamUrl = getInputData().getString("streamUrl");
        String title     = getInputData().getString("title");
        String artist    = getInputData().getString("artist");
        String album     = getInputData().getString("album");
        String artworkUrl = getInputData().getString("artworkUrl");
        String quality   = getInputData().getString("quality");
        if (quality == null || quality.isEmpty()) quality = "320 kbps";

        if (trackId == null || trackId.isEmpty()) {
            return Result.failure();
        }

        database.downloadDao().updateProgress(trackId, "DOWNLOADING", 0, 0);
        broadcastProgress(trackId, "DOWNLOADING", 0, 0, 0);

        try {
            Context context = getApplicationContext();

            // 1. Resolve stream URL if missing or dynamic
            if (streamUrl == null || streamUrl.isEmpty() || streamUrl.contains("pixabay.com")) {
                try {
                    SaavnMusicProvider provider = new SaavnMusicProvider();
                    MusicTrack track = provider.getTrackDetails(trackId);
                    if (track != null) {
                        streamUrl = track.streamUrl;
                        if (title == null || title.isEmpty()) title = track.title;
                        if (artist == null || artist.isEmpty()) artist = track.artist;
                        if (album == null || album.isEmpty()) album = track.album;
                        if (artworkUrl == null || artworkUrl.isEmpty()) artworkUrl = track.artworkUrl;
                    }
                } catch (Exception e) {
                    Log.w(TAG, "SaavnMusicProvider resolve failed: " + e.getMessage());
                }
            }

            if (streamUrl == null || streamUrl.isEmpty()) {
                database.downloadDao().markFailed(trackId, "Could not resolve audio stream URL");
                broadcastProgress(trackId, "FAILED", 0, 0, 0);
                return Result.failure();
            }

            // Apply target quality URL rewriting if candidate template exists
            streamUrl = adjustBitrateUrl(streamUrl, quality);

            // 2. Storage validation
            long availableBytes = StorageHelper.getAvailableStorageBytes(context);
            if (availableBytes < 15L * 1024 * 1024) { // Minimum 15MB free space required
                String error = "Not enough storage. Required: 15 MB, Available: " + (availableBytes / (1024 * 1024)) + " MB";
                database.downloadDao().markFailed(trackId, error);
                broadcastProgress(trackId, "FAILED", 0, 0, 0);
                return Result.failure();
            }

            // 3. Prepare target and staging paths in Music/RaagaX/
            File targetDir = StorageHelper.getRaagaXMusicDirectory(context);
            File finalFile = StorageHelper.getDisambiguatedFile(targetDir, title, artist, trackId);
            File tempRawFile = new File(targetDir, ".tmp_raw_" + trackId + ".mp3");

            // 4. Resumable chunk download
            long existingBytes = tempRawFile.exists() ? tempRawFile.length() : 0L;

            Request.Builder requestBuilder = new Request.Builder()
                .url(streamUrl)
                .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 RaagaX/1.0");

            if (existingBytes > 0) {
                requestBuilder.addHeader("Range", "bytes=" + existingBytes + "-");
                Log.d(TAG, "Resuming download for " + trackId + " from byte " + existingBytes);
            }

            Request request = requestBuilder.build();
            try (Response response = httpClient.newCall(request).execute()) {
                int code = response.code();
                if (code != 200 && code != 206) {
                    // If range was not satisfiable, restart from byte 0
                    if (code == 416) {
                        tempRawFile.delete();
                        existingBytes = 0;
                        request = new Request.Builder().url(streamUrl).build();
                        response.close();
                        Response retryRes = httpClient.newCall(request).execute();
                        if (!retryRes.isSuccessful() || retryRes.body() == null) {
                            database.downloadDao().markFailed(trackId, "HTTP download failed: " + retryRes.code());
                            return Result.retry();
                        }
                    } else {
                        database.downloadDao().markFailed(trackId, "HTTP download failed: " + code);
                        return Result.retry();
                    }
                }

                ResponseBody body = response.body();
                if (body == null) {
                    database.downloadDao().markFailed(trackId, "Empty response body");
                    return Result.retry();
                }

                long totalBytes = body.contentLength();
                if (code == 206) {
                    totalBytes += existingBytes;
                }
                long downloadedBytes = existingBytes;

                try (InputStream inputStream = body.byteStream();
                     FileOutputStream outputStream = new FileOutputStream(tempRawFile, existingBytes > 0)) {

                    byte[] buffer = new byte[16384];
                    int read;
                    int lastProgress = 0;
                    long lastBroadcastTime = 0;

                    while ((read = inputStream.read(buffer)) != -1) {
                        if (isStopped()) {
                            // WorkManager requested stop / pause
                            database.downloadDao().updateProgress(trackId, "PAUSED", lastProgress, downloadedBytes);
                            broadcastProgress(trackId, "PAUSED", lastProgress, downloadedBytes, totalBytes);
                            return Result.failure();
                        }

                        outputStream.write(buffer, 0, read);
                        downloadedBytes += read;

                        if (totalBytes > 0) {
                            int progress = (int) ((downloadedBytes * 100) / totalBytes);
                            long now = System.currentTimeMillis();
                            if (progress - lastProgress >= 3 || (now - lastBroadcastTime > 800)) {
                                lastProgress = progress;
                                lastBroadcastTime = now;
                                database.downloadDao().updateProgress(trackId, "DOWNLOADING", progress, downloadedBytes);
                                broadcastProgress(trackId, "DOWNLOADING", progress, downloadedBytes, totalBytes);
                            }
                        }
                    }
                    outputStream.flush();
                }

                // 5. Verify integrity of downloaded stream
                database.downloadDao().updateProgress(trackId, "VERIFYING", 99, downloadedBytes);
                broadcastProgress(trackId, "VERIFYING", 99, downloadedBytes, totalBytes);

                if (!tempRawFile.exists() || tempRawFile.length() < 2048) {
                    tempRawFile.delete();
                    database.downloadDao().markFailed(trackId, "Incomplete/corrupt audio download");
                    return Result.retry();
                }

                // 6. ID3 Tag Injection & Atomic Commit to Music/RaagaX/*.mp3
                ID3TagWriter.Metadata id3Meta = new ID3TagWriter.Metadata(title, artist, album, artworkUrl);
                boolean tagged = ID3TagWriter.writeID3v2Tags(tempRawFile, finalFile, id3Meta);
                
                // Clean up raw temp file
                tempRawFile.delete();

                if (!tagged || !finalFile.exists() || finalFile.length() == 0) {
                    database.downloadDao().markFailed(trackId, "ID3 tag encoding & commit failed");
                    return Result.failure();
                }

                // 7. MediaScanner Indexing for Android File Manager & Music Players
                StorageHelper.scanMediaFile(context, finalFile, null);

                // 8. Mark COMPLETED in Room Database
                long finalSize = finalFile.length();
                database.downloadDao().markCompleted(
                    trackId,
                    finalFile.getAbsolutePath(),
                    finalFile.getName(),
                    finalSize,
                    "audio/mpeg",
                    quality,
                    System.currentTimeMillis()
                );

                broadcastProgress(trackId, "COMPLETED", 100, finalSize, finalSize);
                broadcastCompleted(trackId, finalFile.getAbsolutePath(), finalFile.getName(), finalSize, quality, title, artist);

                Log.d(TAG, "Successfully downloaded & tagged: " + finalFile.getAbsolutePath() + " (" + finalSize + " bytes)");
                return Result.success();
            }
        } catch (Exception e) {
            Log.e(TAG, "Download worker execution error for track " + trackId + ": " + e.getMessage(), e);
            database.downloadDao().markFailed(trackId, e.getMessage());
            broadcastProgress(trackId, "FAILED", 0, 0, 0);
            return Result.retry();
        }
    }

    private String adjustBitrateUrl(String originalUrl, String quality) {
        if (originalUrl == null) return "";
        String normalized = originalUrl.replace("http://", "https://");

        String targetSuffix = "_320.mp3";
        if ("128 kbps".equalsIgnoreCase(quality) || "128".equals(quality)) {
            targetSuffix = "_128.mp3";
        } else if ("192 kbps".equalsIgnoreCase(quality) || "160 kbps".equalsIgnoreCase(quality) || "160".equals(quality)) {
            targetSuffix = "_160.mp3";
        } else if ("320 kbps".equalsIgnoreCase(quality) || "320".equals(quality) || "Lossless".equalsIgnoreCase(quality)) {
            targetSuffix = "_320.mp3";
        }

        if (normalized.matches(".*_(?:12|48|96|128|160|320)\\.(?:mp3|m4a|mp4)$")) {
            return normalized.replaceAll("_(?:12|48|96|128|160|320)\\.(?:mp3|m4a|mp4)$", targetSuffix);
        }
        return normalized;
    }

    private void broadcastProgress(String trackId, String state, int progress, long bytesDownloaded, long totalBytes) {
        Intent intent = new Intent("com.raagax.music.DOWNLOAD_PROGRESS");
        intent.putExtra("trackId", trackId);
        intent.putExtra("songId", trackId);
        intent.putExtra("state", state);
        intent.putExtra("progress", progress);
        intent.putExtra("downloadedBytes", bytesDownloaded);
        intent.putExtra("totalBytes", totalBytes);
        getApplicationContext().sendBroadcast(intent);
    }

    private void broadcastCompleted(String trackId, String localPath, String fileName, long fileSize, String quality, String title, String artist) {
        Intent intent = new Intent("com.raagax.music.DOWNLOAD_COMPLETED");
        intent.putExtra("trackId", trackId);
        intent.putExtra("songId", trackId);
        intent.putExtra("localPath", localPath);
        intent.putExtra("fileName", fileName);
        intent.putExtra("fileSize", fileSize);
        intent.putExtra("quality", quality);
        intent.putExtra("title", title != null ? title : "RaagaX");
        intent.putExtra("artist", artist != null ? artist : "");
        getApplicationContext().sendBroadcast(intent);
    }
}
