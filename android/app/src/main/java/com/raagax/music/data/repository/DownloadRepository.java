package com.raagax.music.data.repository;

import android.content.Context;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.raagax.music.data.db.RaagaXDatabase;
import com.raagax.music.data.db.entity.DownloadEntity;
import com.raagax.music.data.model.MusicTrack;
import com.raagax.music.download.DownloadWorker;
import java.io.File;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DownloadRepository {
    private static volatile DownloadRepository INSTANCE;
    private final Context context;
    private final RaagaXDatabase database;
    private final WorkManager workManager;
    private final ExecutorService executor;
    private final Gson gson;

    private DownloadRepository(Context context) {
        this.context = context.getApplicationContext();
        this.database = RaagaXDatabase.getInstance(this.context);
        this.workManager = WorkManager.getInstance(this.context);
        this.executor = Executors.newFixedThreadPool(2);
        this.gson = new Gson();
    }

    public static DownloadRepository getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (DownloadRepository.class) {
                if (INSTANCE == null) {
                    INSTANCE = new DownloadRepository(context);
                }
            }
        }
        return INSTANCE;
    }

    public void enqueueDownload(MusicTrack track, String referenceSource) {
        executor.execute(() -> {
            if (track == null || track.id == null) return;

            // 1. Ensure track is saved in Room
            MusicRepository.getInstance(context).saveTrack(track);

            // 2. Check if already downloaded
            DownloadEntity existing = database.downloadDao().getDownloadByTrackId(track.id);
            if (existing != null && "COMPLETED".equals(existing.downloadState) && existing.localPath != null) {
                File file = new File(existing.localPath);
                if (file.exists() && file.length() > 0) {
                    // Just add reference
                    addReference(existing, referenceSource);
                    return;
                }
            }

            // 3. Create or update QUEUED download entity
            String downloadId = "dl_" + track.id;
            DownloadEntity entity = new DownloadEntity(downloadId, track.id, "QUEUED");
            addReference(entity, referenceSource);
            database.downloadDao().insertOrUpdate(entity);

            // 4. Enqueue WorkManager Job
            Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

            Data inputData = new Data.Builder()
                .putString("trackId", track.id)
                .putString("title", track.title)
                .putString("streamUrl", track.streamUrl)
                .putString("artworkUrl", track.artworkUrl)
                .build();

            OneTimeWorkRequest workRequest = new OneTimeWorkRequest.Builder(DownloadWorker.class)
                .setConstraints(constraints)
                .setInputData(inputData)
                .addTag("download_" + track.id)
                .build();

            workManager.enqueueUniqueWork(
                "download_" + track.id,
                ExistingWorkPolicy.KEEP,
                workRequest
            );
        });
    }

    public void removeDownload(String trackId, String referenceSource, boolean forceDelete) {
        executor.execute(() -> {
            DownloadEntity entity = database.downloadDao().getDownloadByTrackId(trackId);
            if (entity == null) return;

            Type type = new TypeToken<Set<String>>(){}.getType();
            Set<String> refs = gson.fromJson(entity.referencesJson, type);
            if (refs == null) refs = new HashSet<>();

            if (referenceSource != null) {
                refs.remove(referenceSource);
            }

            if (forceDelete || refs.isEmpty()) {
                // Delete physical audio file
                if (entity.localPath != null) {
                    File file = new File(entity.localPath);
                    if (file.exists()) {
                        file.delete();
                    }
                }
                database.downloadDao().deleteDownload(trackId);
            } else {
                entity.referencesJson = gson.toJson(refs);
                database.downloadDao().insertOrUpdate(entity);
            }
        });
    }

    public List<DownloadEntity> getAllCompletedDownloads() {
        return database.downloadDao().getAllCompletedDownloads();
    }

    public long getTotalDownloadedBytes() {
        return database.downloadDao().getTotalDownloadedBytes();
    }

    private void addReference(DownloadEntity entity, String source) {
        if (source == null) return;
        Type type = new TypeToken<Set<String>>(){}.getType();
        Set<String> refs = gson.fromJson(entity.referencesJson, type);
        if (refs == null) refs = new HashSet<>();
        refs.add(source);
        entity.referencesJson = gson.toJson(refs);
    }
}
