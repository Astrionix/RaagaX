package com.raagax.music.permission;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

/**
 * PermissionManager — Central authority for all runtime permission requests.
 *
 * Philosophy: Only ask for permissions in the right context.
 *   - No permissions on first launch
 *   - Notification permission: when user first plays a song
 *   - Bluetooth permission: only when user opens "Connect Device"
 *   - Everything else: declared in manifest, no runtime prompt needed
 */
public class PermissionManager {

    private static final String TAG = "RaagaXPermissionManager";
    private static PermissionManager instance;

    public static final int REQUEST_CODE_NOTIFICATIONS = 1001;
    public static final int REQUEST_CODE_BLUETOOTH     = 1002;

    private PermissionManager() {}

    public static PermissionManager getInstance() {
        if (instance == null) {
            instance = new PermissionManager();
        }
        return instance;
    }

    // ── Notification Permission ───────────────────────────────────────────────

    /**
     * Returns true if POST_NOTIFICATIONS is granted (or not required on this OS version).
     * Android 13+ requires explicit user grant; older versions always return true.
     */
    public boolean hasNotificationPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Request POST_NOTIFICATIONS.
     * Call this ONLY when the user plays their first song — not at app launch.
     * Activity's onRequestPermissionsResult will receive REQUEST_CODE_NOTIFICATIONS.
     */
    public void requestNotificationPermission(Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (hasNotificationPermission(activity)) return;

        Log.d(TAG, "Requesting POST_NOTIFICATIONS permission");
        ActivityCompat.requestPermissions(
                activity,
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                REQUEST_CODE_NOTIFICATIONS
        );
    }

    // ── Bluetooth Permissions ─────────────────────────────────────────────────

    /**
     * Returns true if BLUETOOTH_CONNECT is granted (or not required on this OS version).
     * Android 12+ (API 31+) requires explicit user grant.
     */
    public boolean hasBluetoothConnectPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Returns true if BLUETOOTH_SCAN is granted (or not required on this OS version).
     */
    public boolean hasBluetoothScanPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN)
                == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Request BLUETOOTH_CONNECT + BLUETOOTH_SCAN.
     * Call this ONLY when the user explicitly opens the "Connect Device" screen.
     * Activity's onRequestPermissionsResult will receive REQUEST_CODE_BLUETOOTH.
     */
    public void requestBluetoothPermissions(Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;

        List<String> toRequest = new ArrayList<>();
        if (!hasBluetoothConnectPermission(activity)) {
            toRequest.add(Manifest.permission.BLUETOOTH_CONNECT);
        }
        if (!hasBluetoothScanPermission(activity)) {
            toRequest.add(Manifest.permission.BLUETOOTH_SCAN);
        }
        if (toRequest.isEmpty()) return;

        Log.d(TAG, "Requesting Bluetooth permissions: " + toRequest);
        ActivityCompat.requestPermissions(
                activity,
                toRequest.toArray(new String[0]),
                REQUEST_CODE_BLUETOOTH
        );
    }

    // ── Status Summary ────────────────────────────────────────────────────────

    /**
     * Returns a summary of all permission states for the Capacitor bridge.
     */
    public PermissionStatus getStatus(Context context) {
        return new PermissionStatus(
                hasNotificationPermission(context),
                hasBluetoothConnectPermission(context),
                hasBluetoothScanPermission(context)
        );
    }

    public static class PermissionStatus {
        public final boolean notifications;
        public final boolean bluetoothConnect;
        public final boolean bluetoothScan;

        PermissionStatus(boolean notifications, boolean bluetoothConnect, boolean bluetoothScan) {
            this.notifications     = notifications;
            this.bluetoothConnect  = bluetoothConnect;
            this.bluetoothScan     = bluetoothScan;
        }
    }
}
