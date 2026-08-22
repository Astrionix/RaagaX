package com.raagax.music.download;

import android.content.Context;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.media3.common.MediaItem;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.database.DatabaseProvider;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.FileDataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.datasource.cache.Cache;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.NoOpCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import androidx.media3.exoplayer.offline.Download;
import androidx.media3.exoplayer.offline.DownloadCursor;
import androidx.media3.exoplayer.offline.DownloadIndex;
import androidx.media3.exoplayer.offline.DownloadManager;
import androidx.media3.exoplayer.offline.DownloadRequest;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.extractor.DefaultExtractorsFactory;

import java.io.File;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Media3DownloadHelper — Central singleton provider for AndroidX Media3 DownloadManager,
 * SimpleCache, HttpDataSource.Factory, and unified CacheDataSource for ExoPlayer playback.
 */
@OptIn(markerClass = UnstableApi.class)
public final class Media3DownloadHelper {
    private static final String TAG = "Media3DownloadHelper";
    private static final String DOWNLOAD_CONTENT_DIRECTORY = "downloads";
    private static final String USER_AGENT = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 RaagaX/1.0";

    private static DatabaseProvider databaseProvider;
    private static File downloadDirectory;
    private static Cache downloadCache;
    private static HttpDataSource.Factory httpDataSourceFactory;
    private static DownloadManager downloadManager;
    private static CacheDataSource.Factory playbackCacheDataSourceFactory;
    private static Executor downloadExecutor;

    private Media3DownloadHelper() {}

    public static synchronized DatabaseProvider getDatabaseProvider(Context context) {
        if (databaseProvider == null) {
            try {
                databaseProvider = new StandaloneDatabaseProvider(context.getApplicationContext());
            } catch (Exception e) {
                Log.e(TAG, "StandaloneDatabaseProvider error: " + e.getMessage());
            }
        }
        return databaseProvider;
    }

    public static synchronized File getDownloadDirectory(Context context) {
        if (downloadDirectory == null) {
            File externalDir = context.getApplicationContext().getExternalFilesDir(null);
            if (externalDir == null) {
                externalDir = context.getApplicationContext().getFilesDir();
            }
            downloadDirectory = new File(externalDir, DOWNLOAD_CONTENT_DIRECTORY);
            if (!downloadDirectory.exists()) {
                downloadDirectory.mkdirs();
            }
        }
        return downloadDirectory;
    }

    public static synchronized Cache getDownloadCache(Context context) {
        if (downloadCache == null) {
            File downloadContentDirectory = getDownloadDirectory(context);
            try {
                DatabaseProvider dbProvider = getDatabaseProvider(context);
                downloadCache = new SimpleCache(
                        downloadContentDirectory,
                        new NoOpCacheEvictor(),
                        dbProvider
                );
            } catch (Exception e) {
                Log.e(TAG, "[DOWNLOAD_CACHE_ERROR] Failed to initialize SimpleCache: " + e.getMessage() + ", recovering...", e);
                try {
                    File lockFile = new File(downloadContentDirectory, ".exo.lock");
                    if (lockFile.exists()) {
                        lockFile.delete();
                    }
                    DatabaseProvider dbProvider = getDatabaseProvider(context);
                    downloadCache = new SimpleCache(
                            downloadContentDirectory,
                            new NoOpCacheEvictor(),
                            dbProvider
                    );
                } catch (Exception retryEx) {
                    Log.e(TAG, "[DOWNLOAD_CACHE_FATAL] Fallback cache initialization: " + retryEx.getMessage());
                    File fallbackDir = new File(context.getApplicationContext().getCacheDir(), "media3_fallback_downloads");
                    if (!fallbackDir.exists()) fallbackDir.mkdirs();
                    try {
                        downloadCache = new SimpleCache(
                                fallbackDir,
                                new NoOpCacheEvictor(),
                                new StandaloneDatabaseProvider(context.getApplicationContext())
                        );
                    } catch (Exception ignored) {}
                }
            }
        }
        return downloadCache;
    }

    public static synchronized HttpDataSource.Factory getHttpDataSourceFactory(Context context) {
        if (httpDataSourceFactory == null) {
            // JioSaavn CDN (aac.saavncdn.com) requires Referer + Origin headers.
            // Without these the CDN returns 403 Forbidden and Media3 retries forever with 0 bytes.
            java.util.Map<String, String> defaultHeaders = new java.util.HashMap<>();
            defaultHeaders.put("Accept", "*/*");
            defaultHeaders.put("Accept-Encoding", "identity");
            defaultHeaders.put("Connection", "keep-alive");
            defaultHeaders.put("Referer", "https://www.jiosaavn.com/");
            defaultHeaders.put("Origin", "https://www.jiosaavn.com");

            httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                    .setUserAgent(USER_AGENT)
                    .setConnectTimeoutMs(25000)
                    .setReadTimeoutMs(60000)
                    .setAllowCrossProtocolRedirects(true)
                    .setDefaultRequestProperties(defaultHeaders);

            Log.d(TAG, "[DOWNLOAD_HTTP_FACTORY] Initialized with Referer=https://www.jiosaavn.com/");
        }
        return httpDataSourceFactory;
    }

    public static synchronized Executor getDownloadExecutor() {
        if (downloadExecutor == null) {
            downloadExecutor = Executors.newFixedThreadPool(4);
        }
        return downloadExecutor;
    }

    public static synchronized DownloadManager getDownloadManager(Context context) {
        if (downloadManager == null) {
            try {
                Cache cache = getDownloadCache(context);
                DatabaseProvider dbProvider = getDatabaseProvider(context);
                downloadManager = new DownloadManager(
                        context.getApplicationContext(),
                        dbProvider,
                        cache,
                        getHttpDataSourceFactory(context),
                        getDownloadExecutor()
                );
                downloadManager.setMaxParallelDownloads(3);
            } catch (Exception e) {
                Log.e(TAG, "getDownloadManager safe init catch: " + e.getMessage(), e);
                try {
                    File fallbackDir = new File(context.getApplicationContext().getCacheDir(), "media3_fb_dl");
                    if (!fallbackDir.exists()) fallbackDir.mkdirs();
                    StandaloneDatabaseProvider fbDb = new StandaloneDatabaseProvider(context.getApplicationContext());
                    SimpleCache fbCache = new SimpleCache(fallbackDir, new NoOpCacheEvictor(), fbDb);
                    downloadManager = new DownloadManager(
                            context.getApplicationContext(),
                            fbDb,
                            fbCache,
                            getHttpDataSourceFactory(context),
                            getDownloadExecutor()
                    );
                } catch (Exception fatalEx) {
                    Log.e(TAG, "Fatal download manager init: " + fatalEx.getMessage());
                }
            }
        }
        return downloadManager;
    }

    /**
     * CacheDataSource.Factory for ExoPlayer playback.
     * Configured as READ-ONLY from the download cache during playback so ordinary streaming
     * does not accidentally write to or corrupt the offline download cache.
     */
    public static synchronized CacheDataSource.Factory getPlaybackCacheDataSourceFactory(Context context) {
        if (playbackCacheDataSourceFactory == null) {
            try {
                Cache cache = getDownloadCache(context);
                DataSource.Factory upstreamFactory = new DefaultDataSource.Factory(
                        context.getApplicationContext(),
                        getHttpDataSourceFactory(context)
                );

                if (cache != null) {
                    playbackCacheDataSourceFactory = new CacheDataSource.Factory()
                            .setCache(cache)
                            .setUpstreamDataSourceFactory(upstreamFactory)
                            .setCacheReadDataSourceFactory(new FileDataSource.Factory())
                            .setCacheWriteDataSinkFactory(null) // Read-only during playback
                            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
                }
            } catch (Exception e) {
                Log.e(TAG, "getPlaybackCacheDataSourceFactory catch: " + e.getMessage());
            }
        }
        return playbackCacheDataSourceFactory;
    }

    /**
     * Create MediaSource.Factory for ExoPlayer configured with the unified CacheDataSource.
     */
    public static MediaSource.Factory createPlaybackMediaSourceFactory(Context context) {
        DefaultExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()
                .setConstantBitrateSeekingEnabled(true);

        try {
            CacheDataSource.Factory playbackFactory = getPlaybackCacheDataSourceFactory(context);
            if (playbackFactory != null) {
                return new DefaultMediaSourceFactory(playbackFactory, extractorsFactory);
            }
        } catch (Exception e) {
            Log.e(TAG, "createPlaybackMediaSourceFactory fallback to online factory: " + e.getMessage());
        }

        // Direct online fallback factory
        return new DefaultMediaSourceFactory(
                new DefaultDataSource.Factory(context.getApplicationContext(), getHttpDataSourceFactory(context)),
                extractorsFactory
        );
    }

    /**
     * Detects actual MIME type from URI / file extension.
     */
    public static String detectMimeType(Uri uri) {
        if (uri == null) return "audio/mpeg";
        String path = uri.getPath();
        if (path == null) path = uri.toString();
        path = path.toLowerCase();
        if (path.endsWith(".mp4") || path.endsWith(".m4a") || path.endsWith(".aac")) {
            return "audio/mp4";
        } else if (path.endsWith(".flac")) {
            return "audio/flac";
        } else if (path.endsWith(".ogg") || path.endsWith(".opus")) {
            return "audio/ogg";
        } else if (path.endsWith(".wav")) {
            return "audio/wav";
        }
        return "audio/mpeg";
    }

    /**
     * Builds a standard DownloadRequest for a track with detected MIME type.
     */
    public static DownloadRequest buildDownloadRequest(@NonNull String trackId, @NonNull Uri uri, byte[] data) {
        String mimeType = detectMimeType(uri);
        DownloadRequest.Builder builder = new DownloadRequest.Builder(trackId, uri)
                .setMimeType(mimeType);
        if (data != null && data.length > 0) {
            builder.setData(data);
        }
        return builder.build();
    }

    /**
     * Verifies that the track exists in the Media3 cache with valid bytes.
     */
    public static boolean verifyDownloadedTrack(Context context, @NonNull String trackId) {
        try {
            DownloadManager dm = getDownloadManager(context);
            if (dm == null) return false;
            DownloadIndex downloadIndex = dm.getDownloadIndex();
            Download download = downloadIndex.getDownload(trackId);
            if (download != null && download.state == Download.STATE_COMPLETED && download.getBytesDownloaded() > 0) {
                return true;
            }
        } catch (Exception e) {
            Log.w(TAG, "verifyDownloadedTrack exception for " + trackId + ": " + e.getMessage());
        }
        return false;
    }

    public static boolean isTrackDownloaded(Context context, @NonNull String trackId) {
        return verifyDownloadedTrack(context, trackId);
    }

    /**
     * Helper to resolve playable MediaItem.
     */
    public static MediaItem buildMediaItem(@NonNull String trackId, @NonNull Uri uri, @Nullable String title, @Nullable String artist, @Nullable String artworkUrl) {
        androidx.media3.common.MediaMetadata.Builder metaBuilder = new androidx.media3.common.MediaMetadata.Builder()
                .setTitle(title != null ? title : "RaagaX Track")
                .setArtist(artist != null ? artist : "RaagaX")
                .setDisplayTitle(title != null ? title : "RaagaX Track");

        if (artworkUrl != null && !artworkUrl.isEmpty()) {
            metaBuilder.setArtworkUri(Uri.parse(artworkUrl));
        }

        return new MediaItem.Builder()
                .setMediaId(trackId)
                .setUri(uri)
                .setMimeType(detectMimeType(uri))
                .setMediaMetadata(metaBuilder.build())
                .build();
    }
}
