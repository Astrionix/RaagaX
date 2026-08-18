package com.raagax.music.download;

import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * ID3TagWriter — Pure Java ID3v2.3 tag encoder.
 * Writes ID3v2.3 metadata directly to MP3 audio files:
 * - TIT2: Title
 * - TPE1: Artist / Lead Performer
 * - TALB: Album
 * - TPE2: Album Artist
 * - TCON: Genre
 * - TYER: Year
 * - TRCK: Track Number
 * - APIC: Attached Picture (Cover Artwork JPEG/PNG)
 */
public class ID3TagWriter {
    private static final String TAG = "ID3TagWriter";

    public static class Metadata {
        public String title;
        public String artist;
        public String album;
        public String albumArtist;
        public String genre;
        public String year;
        public String trackNumber;
        public String artworkUrl;

        public Metadata(String title, String artist, String album, String artworkUrl) {
            this.title = title != null ? title : "RaagaX Track";
            this.artist = artist != null ? artist : "Unknown Artist";
            this.album = album != null ? album : "RaagaX Music";
            this.albumArtist = artist;
            this.genre = "Music";
            this.artworkUrl = artworkUrl;
        }
    }

    /**
     * Attaches ID3v2.3 tags to an audio file and saves the output to destinationFile.
     */
    public static boolean writeID3v2Tags(File sourceAudioFile, File destinationFile, Metadata metadata) {
        if (sourceAudioFile == null || !sourceAudioFile.exists()) {
            return false;
        }

        try {
            ByteArrayOutputStream framesStream = new ByteArrayOutputStream();

            // 1. Write Text Frames (Encoding 0x03 = UTF-8)
            if (metadata.title != null && !metadata.title.isEmpty()) {
                writeTextFrame(framesStream, "TIT2", metadata.title);
            }
            if (metadata.artist != null && !metadata.artist.isEmpty()) {
                writeTextFrame(framesStream, "TPE1", metadata.artist);
            }
            if (metadata.album != null && !metadata.album.isEmpty()) {
                writeTextFrame(framesStream, "TALB", metadata.album);
            }
            if (metadata.albumArtist != null && !metadata.albumArtist.isEmpty()) {
                writeTextFrame(framesStream, "TPE2", metadata.albumArtist);
            }
            if (metadata.genre != null && !metadata.genre.isEmpty()) {
                writeTextFrame(framesStream, "TCON", metadata.genre);
            }
            if (metadata.year != null && !metadata.year.isEmpty()) {
                writeTextFrame(framesStream, "TYER", metadata.year);
            }
            if (metadata.trackNumber != null && !metadata.trackNumber.isEmpty()) {
                writeTextFrame(framesStream, "TRCK", metadata.trackNumber);
            }

            // 2. Fetch and Write APIC Frame (Cover Artwork)
            if (metadata.artworkUrl != null && !metadata.artworkUrl.isEmpty()) {
                byte[] imageBytes = downloadImageBytes(metadata.artworkUrl);
                if (imageBytes != null && imageBytes.length > 0) {
                    String mime = metadata.artworkUrl.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
                    writeArtworkFrame(framesStream, imageBytes, mime);
                }
            }

            byte[] allFrames = framesStream.toByteArray();
            int totalTagSize = allFrames.length;

            // 3. Construct ID3 Header: "ID3" + Version 2.3.0 + Flags + Synchsafe Size
            ByteArrayOutputStream headerStream = new ByteArrayOutputStream();
            headerStream.write("ID3".getBytes(StandardCharsets.US_ASCII));
            headerStream.write(0x03); // Major version 3 (ID3v2.3)
            headerStream.write(0x00); // Revision
            headerStream.write(0x00); // Flags (no unsync, no extended header, no experimental)
            headerStream.write(encodeSynchsafeInteger(totalTagSize));

            // 4. Combine ID3 Tag Header + Frames + Raw MP3 Audio Data
            try (FileOutputStream fos = new FileOutputStream(destinationFile);
                 FileInputStream fis = new FileInputStream(sourceAudioFile)) {

                // Write ID3v2 header
                fos.write(headerStream.toByteArray());
                // Write ID3v2 frames
                fos.write(allFrames);

                // Strip existing ID3 header from source if present to avoid duplicate headers
                byte[] headerProbe = new byte[10];
                int readHeader = fis.read(headerProbe);
                if (readHeader == 10 && headerProbe[0] == 'I' && headerProbe[1] == 'D' && headerProbe[2] == '3') {
                    int existingTagSize = decodeSynchsafeInteger(headerProbe, 6);
                    long skipped = fis.skip(existingTagSize);
                    Log.d(TAG, "Stripped existing ID3v2 header of size " + existingTagSize + " (skipped: " + skipped + ")");
                } else if (readHeader > 0) {
                    fos.write(headerProbe, 0, readHeader);
                }

                // Copy remaining audio data in 16KB chunks
                byte[] buffer = new byte[16384];
                int len;
                while ((len = fis.read(buffer)) != -1) {
                    fos.write(buffer, 0, len);
                }
                fos.flush();
            }

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error injecting ID3v2 tags: " + e.getMessage(), e);
            return false;
        }
    }

    private static void writeTextFrame(ByteArrayOutputStream out, String frameId, String text) throws Exception {
        byte[] textBytes = text.getBytes(StandardCharsets.UTF_8);
        int frameSize = 1 + textBytes.length; // 1 byte for text encoding descriptor (0x03 = UTF-8)

        out.write(frameId.getBytes(StandardCharsets.US_ASCII));
        out.write(encodeInt32(frameSize));
        out.write(new byte[]{0x00, 0x00}); // Frame flags
        out.write(0x03); // UTF-8 text encoding
        out.write(textBytes);
    }

    private static void writeArtworkFrame(ByteArrayOutputStream out, byte[] imageBytes, String mimeType) throws Exception {
        byte[] mimeBytes = mimeType.getBytes(StandardCharsets.US_ASCII);
        // APIC Frame Layout:
        // [Encoding: 1 byte (0x00 ISO-8859-1)]
        // [MIME type string + 0x00 delimiter]
        // [Picture type: 1 byte (0x03 = Cover Front)]
        // [Description: 0x00 (empty string null-terminated)]
        // [Binary image data]
        int frameSize = 1 + mimeBytes.length + 1 + 1 + 1 + imageBytes.length;

        out.write("APIC".getBytes(StandardCharsets.US_ASCII));
        out.write(encodeInt32(frameSize));
        out.write(new byte[]{0x00, 0x00}); // Frame flags
        out.write(0x00); // ISO-8859-1 for MIME and description
        out.write(mimeBytes);
        out.write(0x00); // Null delimiter for MIME
        out.write(0x03); // Picture Type: 0x03 = Cover (front)
        out.write(0x00); // Empty description null delimiter
        out.write(imageBytes);
    }

    private static byte[] encodeSynchsafeInteger(int value) {
        byte[] out = new byte[4];
        out[0] = (byte) ((value >> 21) & 0x7F);
        out[1] = (byte) ((value >> 14) & 0x7F);
        out[2] = (byte) ((value >> 7) & 0x7F);
        out[3] = (byte) (value & 0x7F);
        return out;
    }

    private static int decodeSynchsafeInteger(byte[] buffer, int offset) {
        return ((buffer[offset] & 0x7F) << 21)
                | ((buffer[offset + 1] & 0x7F) << 14)
                | ((buffer[offset + 2] & 0x7F) << 7)
                | (buffer[offset + 3] & 0x7F);
    }

    private static byte[] encodeInt32(int value) {
        return new byte[]{
                (byte) ((value >> 24) & 0xFF),
                (byte) ((value >> 16) & 0xFF),
                (byte) ((value >> 8) & 0xFF),
                (byte) (value & 0xFF)
        };
    }

    private static byte[] downloadImageBytes(String imageUrl) {
        if (imageUrl == null || imageUrl.isEmpty()) return null;
        try {
            URL url = new URL(imageUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(8000);
            conn.setDoInput(true);
            conn.connect();

            if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                try (InputStream in = conn.getInputStream();
                     ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = in.read(buffer)) != -1) {
                        baos.write(buffer, 0, len);
                    }
                    return baos.toByteArray();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to download artwork for ID3 tagging: " + e.getMessage());
        }
        return null;
    }
}
