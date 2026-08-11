package com.raagax.music.permission;

import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RaagaXPermissionsPlugin — Capacitor bridge for the JS permission layer.
 *
 * Exposes three methods to JavaScript:
 *   getStatus()            → current state of all permissions
 *   requestNotifications() → triggers POST_NOTIFICATIONS dialog (once, on first play)
 *   requestBluetooth()     → triggers Bluetooth dialog (only from Connect screen)
 */
@CapacitorPlugin(name = "RaagaXPermissions")
public class RaagaXPermissionsPlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        PermissionManager.PermissionStatus status =
                PermissionManager.getInstance().getStatus(getContext());

        JSObject result = new JSObject();
        result.put("notifications",    status.notifications);
        result.put("bluetoothConnect", status.bluetoothConnect);
        result.put("bluetoothScan",    status.bluetoothScan);
        call.resolve(result);
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        boolean alreadyGranted = PermissionManager.getInstance()
                .hasNotificationPermission(getContext());

        if (alreadyGranted) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionManager.getInstance().requestNotificationPermission(getActivity());
        }

        // Resolve optimistically — the OS dialog is async.
        // The notification channel will be created by RaagaXPlaybackService.
        JSObject result = new JSObject();
        result.put("granted", false); // real state unknown until user taps Allow
        call.resolve(result);
    }

    @PluginMethod
    public void requestBluetooth(PluginCall call) {
        boolean connect = PermissionManager.getInstance().hasBluetoothConnectPermission(getContext());
        boolean scan    = PermissionManager.getInstance().hasBluetoothScanPermission(getContext());

        if (connect && scan) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        PermissionManager.getInstance().requestBluetoothPermissions(getActivity());

        // Resolve with current best-known state
        JSObject result = new JSObject();
        result.put("granted", false);
        call.resolve(result);
    }
}
