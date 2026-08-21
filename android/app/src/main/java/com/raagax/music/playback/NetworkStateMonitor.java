package com.raagax.music.playback;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;

import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * NetworkStateMonitor — Centralized singleton for online/offline detection.
 *
 * Replaces the scattered inline ConnectivityManager.getActiveNetworkInfo() calls
 * throughout the codebase with a single source of truth.
 *
 * Uses ConnectivityManager.NetworkCallback (API 21+) for real-time updates,
 * with a synchronous fallback check for callers that need the current state immediately.
 *
 * Usage:
 *   NetworkStateMonitor.getInstance(context).isOnline()
 *   NetworkStateMonitor.getInstance(context).addListener(listener)
 *
 * Thread safety: all methods are thread-safe.
 */
public class NetworkStateMonitor {

    private static final String TAG = "NetworkStateMonitor";

    public interface OnNetworkChangeListener {
        /** Called on any thread when the network state changes. */
        void onNetworkChanged(boolean isOnline);
    }

    // ── Singleton ────────────────────────────────────────────────────────────

    private static volatile NetworkStateMonitor INSTANCE;

    public static NetworkStateMonitor getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (NetworkStateMonitor.class) {
                if (INSTANCE == null) {
                    INSTANCE = new NetworkStateMonitor(context.getApplicationContext());
                }
            }
        }
        return INSTANCE;
    }

    // ── State ────────────────────────────────────────────────────────────────

    private final ConnectivityManager connectivityManager;
    private final AtomicBoolean online = new AtomicBoolean(true);
    private final CopyOnWriteArrayList<OnNetworkChangeListener> listeners = new CopyOnWriteArrayList<>();

    private NetworkStateMonitor(Context context) {
        this.connectivityManager =
                (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);

        // Synchronously check the current state so isOnline() works before
        // the first NetworkCallback fires.
        this.online.set(checkCurrentlyOnline());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            registerNetworkCallback();
        }

        Log.d(TAG, "[NetworkStateMonitor] initialized. isOnline=" + this.online.get());
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns true if the device currently has an active internet-capable connection.
     * Always safe to call from any thread, including the main thread.
     */
    public boolean isOnline() {
        return online.get();
    }

    /**
     * Adds a listener that will be called whenever the network state changes.
     * The listener is called on a background thread — do not update UI directly.
     */
    public void addListener(OnNetworkChangeListener listener) {
        if (listener != null && !listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    /**
     * Removes a previously registered listener.
     */
    public void removeListener(OnNetworkChangeListener listener) {
        listeners.remove(listener);
    }

    /**
     * Force a fresh synchronous network check. Use this when registering a new component
     * that needs to know the current state immediately (e.g., on Activity/Service resume).
     */
    public boolean refresh() {
        boolean current = checkCurrentlyOnline();
        online.set(current);
        return current;
    }

    // ── Internal ────────────────────────────────────────────────────────────

    @SuppressWarnings("deprecation")
    private boolean checkCurrentlyOnline() {
        if (connectivityManager == null) return true; // Assume online if manager unavailable

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network activeNetwork = connectivityManager.getActiveNetwork();
            if (activeNetwork == null) return false;
            NetworkCapabilities caps = connectivityManager.getNetworkCapabilities(activeNetwork);
            if (caps == null) return false;
            return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } else {
            // Legacy path for API < 23
            android.net.NetworkInfo info = connectivityManager.getActiveNetworkInfo();
            return info != null && info.isConnectedOrConnecting();
        }
    }

    private void registerNetworkCallback() {
        try {
            NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();

            connectivityManager.registerNetworkCallback(request, new ConnectivityManager.NetworkCallback() {

                @Override
                public void onAvailable(@NonNull Network network) {
                    boolean wasOnline = online.getAndSet(true);
                    if (!wasOnline) {
                        Log.d(TAG, "[NetworkStateMonitor] Network available → ONLINE");
                        notifyListeners(true);
                    }
                }

                @Override
                public void onCapabilitiesChanged(@NonNull Network network,
                                                  @NonNull NetworkCapabilities capabilities) {
                    boolean validated = capabilities.hasCapability(
                            NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                    boolean wasOnline = online.getAndSet(validated);
                    if (wasOnline != validated) {
                        Log.d(TAG, "[NetworkStateMonitor] Capabilities changed → isOnline=" + validated);
                        notifyListeners(validated);
                    }
                }

                @Override
                public void onLost(@NonNull Network network) {
                    // Re-check: another network might still be available
                    boolean stillOnline = checkCurrentlyOnline();
                    boolean wasOnline = online.getAndSet(stillOnline);
                    if (wasOnline != stillOnline) {
                        Log.d(TAG, "[NetworkStateMonitor] Network lost → isOnline=" + stillOnline);
                        notifyListeners(stillOnline);
                    }
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "[NetworkStateMonitor] Failed to register NetworkCallback: " + e.getMessage());
        }
    }

    private void notifyListeners(boolean isOnline) {
        for (OnNetworkChangeListener listener : listeners) {
            try {
                listener.onNetworkChanged(isOnline);
            } catch (Exception e) {
                Log.w(TAG, "[NetworkStateMonitor] Listener error: " + e.getMessage());
            }
        }
    }
}
