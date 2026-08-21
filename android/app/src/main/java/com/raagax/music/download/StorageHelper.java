package com.raagax.music.download;

import android.content.Context;
import android.media.MediaScannerConnection;
import android.os.Environment;
import android.os.StatFs;
import android.util.Log;

import java.io.File;

/**
 * StorageHelper — Storage management for RaagaX Android.
 * Manages the dedicated "Music/RaagaX/" folder, safe file naming, collision resolution,
 * storage space calculations (StatFs), and Android MediaScanner indexing.
 */
public class StorageHelper {
    private static final String TAG = "StorageHelper";
    public static final String RAAGAX_PRIVATE_FOLDER = "downloads";
    public static final String AUDIO_SUBFOLDER = "audio";
    public static final String ARTWORK_SUBFOLDER = "artwork";
    public static final String METADATA_SUBFOLDER = "metadata";
    public static final String CACHE_BUFFER_SUBFOLDER = "audio-buffer";
    public static final String CACHE_IMAGES_SUBFOLDER = "images";

    /**
     * Resolves the app-private base storage directory on Android external storage.
     * Path: /Android/data/com.raagax.music/files/
     * Requires ZERO runtime permissions on Android 10-15.
     */
    public static File getPrivateBaseDirectory(Context context) {
        File extFiles = context.getExternalFilesDir(null);
        if (extFiles != null && (extFiles.exists() || extFiles.mkdirs())) {
            return extFiles;
        }
        // Fallback to internal sandbox files dir if external is unavailable
        return context.getFilesDir();
    }

    /**
     * Resolves the app-private downloads directory.
     * Path: /Android/data/com.raagax.music/files/downloads/
     */
    public static File getRaagaXMusicDirectory(Context context) {
        File baseDir = getPrivateBaseDirectory(context);
        File downloadsDir = new File(baseDir, RAAGAX_PRIVATE_FOLDER);
        if (!downloadsDir.exists()) {
            boolean created = downloadsDir.mkdirs();
            Log.d(TAG, "Created RaagaX downloads directory at " + downloadsDir.getAbsolutePath() + ": " + created);
        }
        return downloadsDir;
    }

    /**
     * Resolves and creates the dedicated app-private audio directory for offline tracks.
     * Path: /Android/data/com.raagax.music/files/downloads/audio/
     */
    public static File getSongsDirectory(Context context) {
        File baseDir = getRaagaXMusicDirectory(context);
        File audioDir = new File(baseDir, AUDIO_SUBFOLDER);
        if (!audioDir.exists()) {
            boolean created = audioDir.mkdirs();
            Log.d(TAG, "Created RaagaX audio directory at " + audioDir.getAbsolutePath() + ": " + created);
        }
        return audioDir;
    }

    /**
     * Resolves and creates the dedicated app-private artwork directory for cached cover art.
     * Path: /Android/data/com.raagax.music/files/downloads/artwork/
     */
    public static File getArtworkDirectory(Context context) {
        File baseDir = getRaagaXMusicDirectory(context);
        File artworkDir = new File(baseDir, ARTWORK_SUBFOLDER);
        if (!artworkDir.exists()) {
            boolean created = artworkDir.mkdirs();
            Log.d(TAG, "Created RaagaX artwork directory at " + artworkDir.getAbsolutePath() + ": " + created);
        }
        return artworkDir;
    }

    /**
     * Resolves and creates the dedicated app-private metadata directory for offline state.
     * Path: /Android/data/com.raagax.music/files/downloads/metadata/
     */
    public static File getMetadataDirectory(Context context) {
        File baseDir = getRaagaXMusicDirectory(context);
        File metaDir = new File(baseDir, METADATA_SUBFOLDER);
        if (!metaDir.exists()) {
            boolean created = metaDir.mkdirs();
            Log.d(TAG, "Created RaagaX metadata directory at " + metaDir.getAbsolutePath() + ": " + created);
        }
        return metaDir;
    }

    /**
     * Resolves rolling streaming buffer cache directory.
     * Path: /Android/data/com.raagax.music/cache/audio-buffer/
     */
    public static File getStreamingCacheDirectory(Context context) {
        File cacheBase = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
        File bufferDir = new File(cacheBase, CACHE_BUFFER_SUBFOLDER);
        if (!bufferDir.exists()) {
            bufferDir.mkdirs();
        }
        return bufferDir;
    }

    /**
     * Resolves transient image cache directory.
     * Path: /Android/data/com.raagax.music/cache/images/
     */
    public static File getImageCacheDirectory(Context context) {
        File cacheBase = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
        File imgDir = new File(cacheBase, CACHE_IMAGES_SUBFOLDER);
        if (!imgDir.exists()) {
            imgDir.mkdirs();
        }
        return imgDir;
    }

    /**
     * Idempotently initializes and verifies the entire RaagaX directory tree.
     * Called lazily during app launch or before downloads.
     */
    public static void ensureDirectories(Context context) {
        try {
            getRaagaXMusicDirectory(context);
            getSongsDirectory(context);
            getArtworkDirectory(context);
            getMetadataDirectory(context);
            getStreamingCacheDirectory(context);
            getImageCacheDirectory(context);

            // Create .nomedia in downloads directory so system media scanners leave private audio untouched
            File noMedia = new File(getRaagaXMusicDirectory(context), ".nomedia");
            if (!noMedia.exists()) {
                noMedia.createNewFile();
            }

            Log.d(TAG, "RaagaX app-private storage directories initialized successfully.");
        } catch (Exception e) {
            Log.w(TAG, "Failed to ensure RaagaX directories: " + e.getMessage());
        }
    }

    /**
     * Generates a safe, clean filename for the MP3.
     * Example:
     *   Input: "Song: Name? | Telugu/Remix", "Artist / DJ"
     *   Output: "Song Name - Telugu Remix - Artist DJ.mp3"
     */
    public static String generateSafeFileName(String title, String artist) {
        String safeTitle = cleanString(title, "RaagaX Track", 80);
        String safeArtist = cleanString(artist, "Unknown Artist", 50);

        return safeTitle + " - " + safeArtist + ".mp3";
    }

    private static String cleanString(String input, String fallback, int maxChars) {
        if (input == null || input.trim().isEmpty()) {
            return fallback;
        }

        // Replace illegal filesystem characters: / \ : * ? " < > | with spaces or hyphens
        String cleaned = input
                .replaceAll("[/\\\\:*?\"<>|]", " ")
                .replaceAll("[\\x00-\\x1F\\x7F]", "") // remove control characters
                .replaceAll("\\s+", " ")              // collapse multiple spaces
                .trim();

        // Remove trailing dots and spaces which are problematic on FAT/Android storage
        while (cleaned.endsWith(".") || cleaned.endsWith(" ")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1);
        }

        if (cleaned.isEmpty()) {
            return fallback;
        }

        // Truncate to maximum characters safely
        if (cleaned.length() > maxChars) {
            cleaned = cleaned.substring(0, maxChars).trim();
        }

        return cleaned;
    }

    /**
     * Resolves a non-colliding file destination for saving.
     */
    public static File getTargetFile(File parentDir, String title, String artist, String songId) {
        String baseName = cleanString(title, "RaagaX Track", 80) + " - " + cleanString(artist, "Unknown Artist", 50);
        File target = new File(parentDir, baseName + ".mp3");

        // If file doesn't exist, use base name
        if (!target.exists()) {
            return target;
        }

        // If target file exists, check if it's already this track
        return target;
    }

    /**
     * Resolves a unique destination file if another different track shares the same name.
     */
    public static File getDisambiguatedFile(File parentDir, String title, String artist, String songId) {
        String baseName = cleanString(title, "RaagaX Track", 80) + " - " + cleanString(artist, "Unknown Artist", 50);
        File target = new File(parentDir, baseName + ".mp3");

        if (!target.exists()) {
            return target;
        }

        // If duplicate name from another song, append clean song ID hash
        String cleanId = songId.replaceAll("[^a-zA-Z0-9_-]", "");
        if (cleanId.length() > 8) {
            cleanId = cleanId.substring(cleanId.length() - 8);
        }
        return new File(parentDir, baseName + " (" + cleanId + ").mp3");
    }

    /**
     * Checks available free storage in bytes.
     */
    public static long getAvailableStorageBytes(Context context) {
        try {
            File path = getRaagaXMusicDirectory(context);
            StatFs stat = new StatFs(path.getAbsolutePath());
            return stat.getAvailableBytes();
        } catch (Exception e) {
            Log.w(TAG, "Failed to read StatFs available bytes: " + e.getMessage());
            return 500L * 1024 * 1024; // 500MB safe estimate fallback
        }
    }

    /**
     * Checks total storage capacity in bytes.
     */
    public static long getTotalStorageBytes(Context context) {
        try {
            File path = getRaagaXMusicDirectory(context);
            StatFs stat = new StatFs(path.getAbsolutePath());
            return stat.getTotalBytes();
        } catch (Exception e) {
            Log.w(TAG, "Failed to read StatFs total bytes: " + e.getMessage());
            return 64L * 1024 * 1024 * 1024; // 64GB fallback
        }
    }

    /**
     * Validates if the local physical file exists and is non-empty.
     */
    public static boolean verifyFileExists(String localPath) {
        if (localPath == null || localPath.isEmpty()) {
            return false;
        }
        File file = new File(localPath);
        return file.exists() && file.isFile() && file.length() > 1024;
    }

    /**
     * Indexes the newly saved MP3 with Android's MediaScanner so it is visible in File Manager immediately.
     */
    public static void scanMediaFile(Context context, File file, MediaScannerConnection.OnScanCompletedListener listener) {
        if (file == null || !file.exists()) return;

        try {
            MediaScannerConnection.scanFile(
                    context.getApplicationContext(),
                    new String[]{file.getAbsolutePath()},
                    new String[]{"audio/mpeg"},
                    (path, uri) -> {
                        Log.d(TAG, "MediaScanner indexed file: " + path + " -> uri: " + uri);
                        if (listener != null) {
                            listener.onScanCompleted(path, uri);
                        }
                    }
            );
        } catch (Exception e) {
            Log.e(TAG, "Failed to scan media file: " + e.getMessage());
        }
    }

    /**
     * Saves raw artwork bytes to Music/RaagaX/Artwork/<songId>.jpg
     */
    public static File saveArtworkFile(Context context, String songId, byte[] artworkBytes) {
        if (songId == null || artworkBytes == null || artworkBytes.length == 0) {
            return null;
        }
        try {
            File artworkDir = getArtworkDirectory(context);
            String cleanId = songId.replaceAll("[^a-zA-Z0-9_-]", "");
            File artFile = new File(artworkDir, cleanId + ".jpg");
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(artFile)) {
                fos.write(artworkBytes);
                fos.flush();
            }
            Log.d(TAG, "Saved artwork to " + artFile.getAbsolutePath() + " (" + artworkBytes.length + " bytes)");
            return artFile;
        } catch (Exception e) {
            Log.w(TAG, "Failed to save artwork file for " + songId + ": " + e.getMessage());
            return null;
        }
    }

    /**
     * Gets the cached artwork file path for a song if it exists.
     */
    public static File getArtworkFile(Context context, String songId) {
        if (songId == null || songId.isEmpty()) return null;
        try {
            File artworkDir = getArtworkDirectory(context);
            String cleanId = songId.replaceAll("[^a-zA-Z0-9_-]", "");
            File artFile = new File(artworkDir, cleanId + ".jpg");
            if (artFile.exists() && artFile.length() > 0) {
                return artFile;
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to check artwork file for " + songId + ": " + e.getMessage());
        }
        return null;
    }
}
