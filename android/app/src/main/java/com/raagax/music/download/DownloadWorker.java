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
import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * DownloadWorker — WorkManager Worker for downloading high quality MP3 files to Music/RaagaX/.
 * Features:
 * - End-to-end diagnostic tracing
 * - 15-second first-byte timeout guard
 * - Rolling average download speed (bytes/sec) & ETA calculations
 * - Explicit package targeted broadcasts for reliable Android 13/14 delivery
 * - Resumable HTTP chunk streaming
 * - ID3v2.3 tagging (Title, Artist, Album, APIC Artwork)
 * - Atomic write with temporary file staging
 * - Android MediaScanner indexing for instant File Manager visibility
 */
public class DownloadWorker extends Worker {
    private static final String TAG = "DownloadWorker";
    private final RaagaXDatabase database;
    private final OkHttpClient httpClient;

    public DownloadWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
        this.database = RaagaXDatabase.getInstance(context);
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .followRedirects(true)
            .retryOnConnectionFailure(true)
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

        Log.d(TAG, "[DOWNLOAD] Worker starting");

        if (trackId == null || trackId.isEmpty()) {
            Log.e(TAG, "[DOWNLOAD] FAILED reason=missing trackId");
            return Result.failure();
        }

        Log.d(TAG, "[DOWNLOAD] Worker started (trackId=" + trackId + ", title=" + title + ", quality=" + quality + ")");
        database.downloadDao().updateProgress(trackId, "DOWNLOADING", 0, 0);
        broadcastProgress(trackId, "DOWNLOADING", 0, 0, 0, 0, 0, null);

        try {
            Context context = getApplicationContext();

            // 1. Resolve stream URL if missing, dynamic, or relative proxy
            if (streamUrl == null || streamUrl.isEmpty()
                    || streamUrl.contains("pixabay.com")
                    || streamUrl.startsWith("/")
                    || streamUrl.contains("localhost")
                    || streamUrl.contains("127.0.0.1")
                    || streamUrl.contains("/api/download")
                    || streamUrl.contains("/api/stream")) {
                Log.d(TAG, "[DOWNLOAD] Resolving direct audio stream for song ID: " + trackId);
                try {
                    SaavnMusicProvider provider = new SaavnMusicProvider();
                    MusicTrack track = provider.getTrackDetails(trackId);
                    if (track != null && track.streamUrl != null && !track.streamUrl.isEmpty()) {
                        streamUrl = track.streamUrl;
                        if (title == null || title.isEmpty()) title = track.title;
                        if (artist == null || artist.isEmpty()) artist = track.artist;
                        if (album == null || album.isEmpty()) album = track.album;
                        if (artworkUrl == null || artworkUrl.isEmpty()) artworkUrl = track.artworkUrl;
                    }
                } catch (Exception e) {
                    Log.w(TAG, "[DOWNLOAD] SaavnMusicProvider resolve error: " + e.getMessage());
                }
            }

            if (streamUrl == null || streamUrl.isEmpty()) {
                String error = "Unable to retrieve audio stream from source";
                Log.e(TAG, "[DOWNLOAD] FAILED trackId=" + trackId + " reason=" + error);
                database.downloadDao().markFailed(trackId, error);
                broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
                return Result.failure();
            }

            // Adjust bitrate while preserving original media extension
            streamUrl = adjustBitrateUrl(streamUrl, quality);
            Log.d(TAG, "[DOWNLOAD] Source URL = " + streamUrl);

            // 2. Storage space validation
            long availableBytes = StorageHelper.getAvailableStorageBytes(context);
            if (availableBytes < 15L * 1024 * 1024) { // Minimum 15MB required
                String error = "Not enough storage. Required: 15 MB, Available: " + (availableBytes / (1024 * 1024)) + " MB";
                Log.e(TAG, "[DOWNLOAD] FAILED trackId=" + trackId + " reason=" + error);
                database.downloadDao().markFailed(trackId, error);
                broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
                return Result.failure();
            }

            // 3. Prepare target and staging paths in Music/RaagaX/Songs/
            File targetDir = StorageHelper.getSongsDirectory(context);
            File finalFile = StorageHelper.getDisambiguatedFile(targetDir, title, artist, trackId);
            File tempRawFile = new File(targetDir, ".tmp_raw_" + trackId + ".mp3");

            // 4. Resumable chunk download with 15-second first byte timeout guard
            long existingBytes = tempRawFile.exists() ? tempRawFile.length() : 0L;

            Request.Builder requestBuilder = new Request.Builder()
                .url(streamUrl)
                .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 RaagaX/1.0");

            if (existingBytes > 0) {
                requestBuilder.addHeader("Range", "bytes=" + existingBytes + "-");
                Log.d(TAG, "[DOWNLOAD] Resuming download for " + trackId + " from byte " + existingBytes);
            }

            Log.d(TAG, "[DOWNLOAD] Request starting");
            Request request = requestBuilder.build();
            Log.d(TAG, "[DOWNLOAD] Request sent to " + streamUrl);

            long requestStartTime = System.currentTimeMillis();

            try (Response response = httpClient.newCall(request).execute()) {
                Log.d(TAG, "[DOWNLOAD] Response received");
                int code = response.code();
                Log.d(TAG, "[DOWNLOAD] HTTP status = " + code);

                if (code != 200 && code != 206) {
                    if (code == 416) {
                        // Range not satisfiable -> clean and restart
                        tempRawFile.delete();
                        existingBytes = 0;
                        request = new Request.Builder().url(streamUrl).build();
                        response.close();
                        Response retryRes = httpClient.newCall(request).execute();
                        if (!retryRes.isSuccessful() || retryRes.body() == null) {
                            String error = "HTTP download failed with code " + retryRes.code();
                            database.downloadDao().markFailed(trackId, error);
                            broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
                            return Result.failure();
                        }
                    } else {
                        String error = "HTTP error " + code + " from audio server";
                        Log.e(TAG, "[DOWNLOAD] FAILED trackId=" + trackId + " reason=" + error);
                        database.downloadDao().markFailed(trackId, error);
                        broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
                        return Result.failure();
                    }
                }

                ResponseBody body = response.body();
                if (body == null) {
                    String error = "Empty response body from audio server";
                    Log.e(TAG, "[DOWNLOAD] FAILED trackId=" + trackId + " reason=" + error);
                    database.downloadDao().markFailed(trackId, error);
                    broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
                    return Result.failure();
                }

                String contentType = response.header("Content-Type", "audio/mpeg");
                long contentLength = body.contentLength();
                Log.d(TAG, "[DOWNLOAD] Content-Type = " + contentType);
                Log.d(TAG, "[DOWNLOAD] Content-Length = " + contentLength);

                long totalBytes = contentLength;
                if (code == 206) {
                    totalBytes += existingBytes;
                }
                long downloadedBytes = existingBytes;

                Log.d(TAG, "[DOWNLOAD] Stream opened");
                Log.d(TAG, "[DOWNLOAD] File write started: " + tempRawFile.getAbsolutePath());

                try (InputStream inputStream = body.byteStream();
                     FileOutputStream outputStream = new FileOutputStream(tempRawFile, existingBytes > 0)) {

                    byte[] buffer = new byte[16384];
                    int read;
                    int lastProgress = 0;
                    long lastBroadcastTime = 0;
                    boolean firstBytesLogged = false;

                    // Rolling speed calculation window
                    long windowStartTime = System.currentTimeMillis();
                    long windowStartBytes = downloadedBytes;
                    long speedBytesPerSec = 0;
                    long etaSeconds = 0;

                    while ((read = inputStream.read(buffer)) != -1) {
                        if (!firstBytesLogged) {
                            Log.d(TAG, "[DOWNLOAD] First bytes received (" + read + " bytes in " + (System.currentTimeMillis() - requestStartTime) + "ms)");
                            firstBytesLogged = true;
                        }

                        if (isStopped()) {
                            Log.d(TAG, "[DOWNLOAD] Paused by WorkManager / user for trackId=" + trackId);
                            database.downloadDao().updateProgress(trackId, "PAUSED", lastProgress, downloadedBytes);
                            broadcastProgress(trackId, "PAUSED", lastProgress, downloadedBytes, totalBytes, 0, 0, null);
                            return Result.failure();
                        }

                        outputStream.write(buffer, 0, read);
                        downloadedBytes += read;

                        long now = System.currentTimeMillis();
                        long windowElapsed = now - windowStartTime;

                        // Calculate rolling average speed every 800ms
                        if (windowElapsed >= 800) {
                            long bytesInWindow = downloadedBytes - windowStartBytes;
                            speedBytesPerSec = (bytesInWindow * 1000L) / Math.max(1, windowElapsed);
                            windowStartTime = now;
                            windowStartBytes = downloadedBytes;

                            if (speedBytesPerSec > 0 && totalBytes > downloadedBytes) {
                                etaSeconds = (totalBytes - downloadedBytes) / speedBytesPerSec;
                            }
                        }

                        int progress = totalBytes > 0 ? (int) ((downloadedBytes * 100) / totalBytes) : 0;

                        // Broadcast progress update every 3% or every 800ms
                        if (progress - lastProgress >= 3 || (now - lastBroadcastTime > 800) || progress >= 99) {
                            lastProgress = progress;
                            lastBroadcastTime = now;
                            database.downloadDao().updateProgress(trackId, "DOWNLOADING", progress, downloadedBytes);
                            broadcastProgress(trackId, "DOWNLOADING", progress, downloadedBytes, totalBytes, speedBytesPerSec, etaSeconds, null);

                            if (progress % 10 == 0 || progress >= 99) {
                                Log.d(TAG, "[DOWNLOAD] Progress = " + progress + "% (" + downloadedBytes + "/" + totalBytes + " bytes, " + (speedBytesPerSec / 1024) + " KB/s, ETA: " + etaSeconds + "s)");
                            }
                        }
                    }
                    outputStream.flush();
                }

                Log.d(TAG, "[DOWNLOAD] Bytes received = " + downloadedBytes + " / " + totalBytes);

                // 5. Verify integrity of downloaded stream
                Log.d(TAG, "[DOWNLOAD] Verifying raw file integrity (rawSize=" + tempRawFile.length() + " bytes)");
                database.downloadDao().updateProgress(trackId, "VERIFYING", 99, downloadedBytes);
                broadcastProgress(trackId, "VERIFYING", 99, downloadedBytes, totalBytes, 0, 0, null);

                if (!tempRawFile.exists() || tempRawFile.length() < 2048) {
                    tempRawFile.delete();
                    String error = "Incomplete audio download (" + tempRawFile.length() + " bytes)";
                    Log.e(TAG, "[DOWNLOAD] FAILED trackId=" + trackId + " reason=" + error);
                    database.downloadDao().markFailed(trackId, error);
                    broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
                    return Result.failure();
                }

                // 6. ID3 Tag Injection & Atomic Commit to Music/RaagaX/*.mp3
                ID3TagWriter.Metadata id3Meta = new ID3TagWriter.Metadata(title, artist, album, artworkUrl);
                boolean tagged = ID3TagWriter.writeID3v2Tags(tempRawFile, finalFile, id3Meta);

                // Clean up raw temp file
                tempRawFile.delete();

                if (!tagged || !finalFile.exists() || finalFile.length() == 0) {
                    String error = "ID3 tag encoding & commit failed";
                    Log.e(TAG, "[DOWNLOAD] FAILED trackId=" + trackId + " reason=" + error);
                    database.downloadDao().markFailed(trackId, error);
                    broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
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

                broadcastProgress(trackId, "COMPLETED", 100, finalSize, finalSize, 0, 0, null);
                broadcastCompleted(trackId, finalFile.getAbsolutePath(), finalFile.getName(), finalSize, quality, title, artist);

                Log.d(TAG, "[DOWNLOAD] File verified = " + finalSize + " bytes at " + finalFile.getAbsolutePath());
                Log.d(TAG, "[DOWNLOAD] Download completed successfully for trackId=" + trackId);
                return Result.success();
            }
        } catch (InterruptedIOException e) {
            String error = "Download connection timed out after 15s. Please check network.";
            Log.e(TAG, "[DOWNLOAD] FAILED trackId=" + trackId + " reason=" + error, e);
            database.downloadDao().markFailed(trackId, error);
            broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
            return Result.failure();
        } catch (Exception e) {
            String error = e.getMessage() != null ? e.getMessage() : "Unexpected download failure";
            Log.e(TAG, "[DOWNLOAD] FAILED trackId=" + trackId + " reason=" + error, e);
            database.downloadDao().markFailed(trackId, error);
            broadcastProgress(trackId, "FAILED", 0, 0, 0, 0, 0, error);
            return Result.failure();
        }
    }

    /**
     * Adjusts quality while preserving original media extension.
     */
    private String adjustBitrateUrl(String originalUrl, String quality) {
        if (originalUrl == null) return "";
        String normalized = originalUrl.replace("http://", "https://");

        String targetQuality = "_320";
        if ("128 kbps".equalsIgnoreCase(quality) || "128".equals(quality)) {
            targetQuality = "_128";
        } else if ("192 kbps".equalsIgnoreCase(quality) || "160 kbps".equalsIgnoreCase(quality) || "160".equals(quality)) {
            targetQuality = "_160";
        }

        if (normalized.matches(".*_(?:12|48|96|128|160|320)\\.(mp3|m4a|mp4)$")) {
            String ext = normalized.substring(normalized.lastIndexOf('.'));
            return normalized.replaceAll("_(?:12|48|96|128|160|320)\\.(mp3|m4a|mp4)$", targetQuality + ext);
        }
        return normalized;
    }

    private void broadcastProgress(String trackId, String state, int progress, long bytesDownloaded, long totalBytes, long speedBytesPerSec, long etaSeconds, String error) {
        try {
            Context ctx = getApplicationContext();
            Intent intent = new Intent("com.raagax.music.DOWNLOAD_PROGRESS");
            intent.setPackage(ctx.getPackageName()); // Crucial for Android 13/14 reliable delivery
            intent.putExtra("trackId", trackId);
            intent.putExtra("songId", trackId);
            intent.putExtra("state", state);
            intent.putExtra("progress", progress);
            intent.putExtra("downloadedBytes", bytesDownloaded);
            intent.putExtra("totalBytes", totalBytes);
            intent.putExtra("speedBytesPerSec", speedBytesPerSec);
            intent.putExtra("etaSeconds", etaSeconds);
            if (error != null) {
                intent.putExtra("error", error);
            }
            ctx.sendBroadcast(intent);
        } catch (Exception e) {
            Log.w(TAG, "Error broadcasting download progress: " + e.getMessage());
        }
    }

    private void broadcastCompleted(String trackId, String localPath, String fileName, long fileSize, String quality, String title, String artist) {
        try {
            Context ctx = getApplicationContext();
            Intent intent = new Intent("com.raagax.music.DOWNLOAD_COMPLETED");
            intent.setPackage(ctx.getPackageName()); // Crucial for Android 13/14 delivery
            intent.putExtra("trackId", trackId);
            intent.putExtra("songId", trackId);
            intent.putExtra("localPath", localPath);
            intent.putExtra("fileName", fileName);
            intent.putExtra("fileSize", fileSize);
            intent.putExtra("quality", quality);
            intent.putExtra("title", title != null ? title : "RaagaX");
            intent.putExtra("artist", artist != null ? artist : "");
            ctx.sendBroadcast(intent);
        } catch (Exception e) {
            Log.w(TAG, "Error broadcasting download completed: " + e.getMessage());
        }
    }
}
