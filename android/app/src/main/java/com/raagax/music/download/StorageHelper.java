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
    public static final String RAAGAX_MUSIC_FOLDER = "RaagaX";

    /**
     * Resolves and creates the dedicated Music/RaagaX directory in public internal storage.
     * Path: /storage/emulated/0/Music/RaagaX/
     */
    public static File getRaagaXMusicDirectory(Context context) {
        File musicPublicDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
        File raagaXDir = new File(musicPublicDir, RAAGAX_MUSIC_FOLDER);

        if (!raagaXDir.exists()) {
            boolean created = raagaXDir.mkdirs();
            Log.d(TAG, "Created RaagaX music directory at " + raagaXDir.getAbsolutePath() + ": " + created);
        }

        // Fallback to app-specific external files dir if public directory cannot be created
        if (!raagaXDir.exists() || !raagaXDir.canWrite()) {
            File fallbackDir = new File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC), RAAGAX_MUSIC_FOLDER);
            if (!fallbackDir.exists()) {
                fallbackDir.mkdirs();
            }
            return fallbackDir;
        }

        return raagaXDir;
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
}
