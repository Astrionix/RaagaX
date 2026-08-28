package com.raagax.music;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.StatFs;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

@CapacitorPlugin(name = "RaagaXUpdater")
public class RaagaXUpdaterPlugin extends Plugin {
    private static final String TAG = "RaagaXUpdater";
    private Thread downloadThread = null;
    private boolean isCancelled = false;

    @PluginMethod
    public void getAppVersionInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo pInfo = pm.getPackageInfo(context.getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= 28 ? pInfo.getLongVersionCode() : pInfo.versionCode;
            String versionName = pInfo.versionName;

            JSObject ret = new JSObject();
            ret.put("versionCode", versionCode);
            ret.put("versionName", versionName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get version info: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("granted", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } else {
                call.resolve();
            }
        } catch (Exception e) {
            call.reject("Failed to open settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String urlString = call.getString("url");
        String sha256Expected = call.getString("sha256");
        long expectedSize = call.getLong("fileSize", 0L);

        if (urlString == null || urlString.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        // Cancel any active download first
        cancelActiveDownload();

        isCancelled = false;
        downloadThread = new Thread(() -> {
            File apkFile = null;
            try {
                Context context = getContext();
                
                // Check disk space (verify we have enough room for APK download)
                File cacheDir = context.getCacheDir();
                StatFs stat = new StatFs(cacheDir.getPath());
                long bytesAvailable = stat.getAvailableBytes();
                if (expectedSize > 0 && bytesAvailable < (expectedSize * 2)) { // Require at least 2x the file size space
                    notifyError(call, "INSUFFICIENT_STORAGE", "Not enough storage space available to download the update (" + (bytesAvailable / (1024 * 1024)) + " MB free)");
                    return;
                }

                apkFile = new File(cacheDir, "raagax_update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                URL url = new URL(urlString);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.connect();

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    notifyError(call, "DOWNLOAD_FAILED", "Server returned HTTP response code: " + responseCode);
                    return;
                }

                int fileLength = connection.getContentLength();
                InputStream input = new BufferedInputStream(connection.getInputStream());
                OutputStream output = new FileOutputStream(apkFile);

                byte[] data = new byte[8192];
                long total = 0;
                int count;
                long lastProgressTime = 0;

                while ((count = input.read(data)) != -1) {
                    if (isCancelled) {
                        input.close();
                        output.close();
                        if (apkFile.exists()) apkFile.delete();
                        notifyError(call, "DOWNLOAD_CANCELLED", "Download was cancelled by user");
                        return;
                    }
                    total += count;
                    output.write(data, 0, count);

                    // Throttle progress events to at most once per 150ms to avoid overwhelming WebView
                    long currentTime = System.currentTimeMillis();
                    if (currentTime - lastProgressTime > 150) {
                        lastProgressTime = currentTime;
                        notifyProgress(total, fileLength);
                    }
                }

                output.flush();
                output.close();
                input.close();

                // Verification Phase
                notifyStatus("VERIFYING");
                String calculatedHash = calculateSHA256(apkFile);
                if (sha256Expected != null && !sha256Expected.isEmpty() && !calculatedHash.equalsIgnoreCase(sha256Expected)) {
                    if (apkFile.exists()) apkFile.delete();
                    notifyError(call, "CHECKSUM_MISMATCH", "SHA-256 verification failed (expected: " + sha256Expected + ", got: " + calculatedHash + ")");
                    return;
                }

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("filePath", apkFile.getAbsolutePath());
                result.put("sha256", calculatedHash);
                call.resolve(result);

            } catch (Exception e) {
                if (apkFile != null && apkFile.exists()) {
                    apkFile.delete();
                }
                notifyError(call, "DOWNLOAD_FAILED", e.getMessage());
            }
        });
        downloadThread.start();
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelActiveDownload();
        call.resolve();
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.isEmpty()) {
            call.reject("File path is required");
            return;
        }

        try {
            Context context = getContext();
            File apkFile = new File(filePath);
            if (!apkFile.exists()) {
                call.reject("APK file not found at path: " + filePath);
                return;
            }

            // Verify install permission on Oreo and above
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.getPackageManager().canRequestPackageInstalls()) {
                    JSObject ret = new JSObject();
                    ret.put("permissionRequired", true);
                    call.resolve(ret);
                    return;
                }
            }

            Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apkFile);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Installation failed: " + e.getMessage());
        }
    }

    private void cancelActiveDownload() {
        isCancelled = true;
        if (downloadThread != null && downloadThread.isAlive()) {
            try {
                downloadThread.interrupt();
            } catch (Exception ignored) {}
        }
        downloadThread = null;
    }

    private void notifyProgress(long downloaded, long total) {
        JSObject progress = new JSObject();
        progress.put("downloadedBytes", downloaded);
        progress.put("totalBytes", total);
        double percentage = total > 0 ? ((double) downloaded / total) * 100 : 0;
        progress.put("percentage", Math.round(percentage));
        notifyListeners("updateDownloadProgress", progress);
    }

    private void notifyStatus(String status) {
        JSObject data = new JSObject();
        data.put("status", status);
        notifyListeners("updateStatusChanged", data);
    }

    private void notifyError(PluginCall call, String code, String message) {
        JSObject error = new JSObject();
        error.put("code", code);
        error.put("message", message);
        notifyListeners("updateError", error);
        call.reject(message, code);
    }

    private String calculateSHA256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        InputStream is = new BufferedInputStream(new java.io.FileInputStream(file));
        byte[] buffer = new byte[8192];
        int read;
        while ((read = is.read(buffer)) > 0) {
            digest.update(buffer, 0, read);
        }
        is.close();
        byte[] mdbytes = digest.digest();
        StringBuilder sb = new StringBuilder();
        for (byte mdbyte : mdbytes) {
            sb.append(Integer.toString((mdbyte & 0xff) + 0x100, 16).substring(1));
        }
        return sb.toString();
    }
}
