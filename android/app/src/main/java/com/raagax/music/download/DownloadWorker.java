package com.raagax.music.download;

import android.content.Context;
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

public class DownloadWorker extends Worker {
    private static final String MUSIC_DIR_NAME = "RaagaX_Music";
    private final RaagaXDatabase database;
    private final OkHttpClient httpClient;

    public DownloadWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
        this.database = RaagaXDatabase.getInstance(context);
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build();
    }

    @NonNull
    @Override
    public Result doWork() {
        String trackId = getInputData().getString("trackId");
        String streamUrl = getInputData().getString("streamUrl");

        if (trackId == null || trackId.isEmpty()) {
            return Result.failure();
        }

        database.downloadDao().updateProgress(trackId, "DOWNLOADING", 0, 0);

        try {
            // 1. If streamUrl is missing, resolve dynamically
            if (streamUrl == null || streamUrl.isEmpty()) {
                SaavnMusicProvider provider = new SaavnMusicProvider();
                MusicTrack track = provider.getTrackDetails(trackId);
                if (track != null) {
                    streamUrl = track.streamUrl;
                }
            }

            if (streamUrl == null || streamUrl.isEmpty()) {
                database.downloadDao().markFailed(trackId, "Could not resolve audio stream URL");
                return Result.failure();
            }

            // 2. Setup directory and staging paths
            File baseDir = new File(getApplicationContext().getFilesDir(), MUSIC_DIR_NAME);
            if (!baseDir.exists()) {
                baseDir.mkdirs();
            }

            String extension = streamUrl.contains(".mp3") ? ".mp3" : ".m4a";
            String mimeType = extension.equals(".mp3") ? "audio/mpeg" : "audio/mp4";
            File tempFile = new File(baseDir, "track_" + trackId + ".tmp");
            File finalFile = new File(baseDir, "track_" + trackId + extension);

            // 3. Download bytes with progress
            Request request = new Request.Builder().url(streamUrl).build();
            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    database.downloadDao().markFailed(trackId, "HTTP download failed: " + response.code());
                    return Result.retry();
                }

                ResponseBody body = response.body();
                long totalBytes = body.contentLength();
                long downloadedBytes = 0;

                try (InputStream inputStream = body.byteStream();
                     FileOutputStream outputStream = new FileOutputStream(tempFile)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    int lastProgress = 0;

                    while ((read = inputStream.read(buffer)) != -1) {
                        if (isStopped()) {
                            tempFile.delete();
                            database.downloadDao().updateProgress(trackId, "CANCELLED", 0, 0);
                            return Result.failure();
                        }
                        outputStream.write(buffer, 0, read);
                        downloadedBytes += read;

                        if (totalBytes > 0) {
                            int progress = (int) ((downloadedBytes * 100) / totalBytes);
                            if (progress - lastProgress >= 5) {
                                lastProgress = progress;
                                database.downloadDao().updateProgress(trackId, "DOWNLOADING", progress, downloadedBytes);
                            }
                        }
                    }
                    outputStream.flush();
                }

                // 4. Verify downloaded file
                database.downloadDao().updateProgress(trackId, "VERIFYING", 99, downloadedBytes);
                if (!tempFile.exists() || tempFile.length() == 0) {
                    tempFile.delete();
                    database.downloadDao().markFailed(trackId, "Zero byte file downloaded");
                    return Result.retry();
                }

                // 5. Atomic rename to final file
                if (finalFile.exists()) {
                    finalFile.delete();
                }
                boolean renamed = tempFile.renameTo(finalFile);
                if (!renamed) {
                    database.downloadDao().markFailed(trackId, "Atomic rename failed");
                    return Result.failure();
                }

                // 6. Mark COMPLETED in Room
                database.downloadDao().markCompleted(
                    trackId,
                    finalFile.getAbsolutePath(),
                    finalFile.length(),
                    mimeType,
                    System.currentTimeMillis()
                );

                return Result.success();
            }
        } catch (Exception e) {
            database.downloadDao().markFailed(trackId, e.getMessage());
            return Result.retry();
        }
    }
}
