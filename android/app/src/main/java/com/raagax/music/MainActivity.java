package com.raagax.music;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.raagax.music.download.RaagaXDownloadPlugin;
import com.raagax.music.permission.RaagaXPermissionsPlugin;

import java.io.PrintWriter;
import java.io.StringWriter;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        setupCrashHandler();
        try {
            SharedPreferences prefs = getSharedPreferences("CrashLog", Context.MODE_PRIVATE);
            String lastCrash = prefs.getString("last_crash", null);
            if (lastCrash != null) {
                Log.e("RaagaXCrash", "=== PREVIOUS CRASH LOG DETECTED ===\n" + lastCrash);
            }
        } catch (Exception ignored) {}

        bridgeBuilder.addWebViewListener(new com.getcapacitor.WebViewListener() {
            @Override
            public boolean onRenderProcessGone(android.webkit.WebView view, android.webkit.RenderProcessGoneDetail detail) {
                boolean crashed = detail != null && detail.didCrash();
                Log.e("RaagaX", "WebView renderer process gone (crashed=" + crashed + "). Auto-recreating activity to recover...");
                runOnUiThread(() -> {
                    try {
                        recreate();
                    } catch (Exception e) {
                        Log.e("RaagaX", "Failed to recreate activity after onRenderProcessGone", e);
                    }
                });
                return true;
            }
        });

        registerPlugin(RaagaXCapacitorPlugin.class);
        registerPlugin(RaagaXPermissionsPlugin.class);
        registerPlugin(RaagaXDownloadPlugin.class);
        registerPlugin(RaagaXUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        wakeAndRedrawWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        wakeAndRedrawWebView();
    }

    @Override
    public boolean onKeyDown(int keyCode, android.view.KeyEvent event) {
        if (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP || keyCode == android.view.KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (bridge != null && bridge.getWebView() != null) {
                final String direction = keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP ? "UP" : "DOWN";
                bridge.getWebView().post(() -> {
                    try {
                        bridge.getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('hardwareVolumeChange', { detail: { direction: '" + direction + "' } }));",
                            null
                        );
                    } catch (Exception ignored) {}
                });
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    private void wakeAndRedrawWebView() {
        if (bridge != null && bridge.getWebView() != null) {
            android.webkit.WebView wv = bridge.getWebView();
            wv.post(() -> {
                try {
                    wv.onResume();
                    wv.resumeTimers();
                    wv.postInvalidate();
                    wv.requestLayout();

                    String currentUrl = wv.getUrl();
                    if (currentUrl == null || currentUrl.isEmpty() || "about:blank".equals(currentUrl)) {
                        String appUrl = bridge.getAppUrl();
                        if (appUrl != null && !appUrl.isEmpty()) {
                            Log.w("RaagaX", "WebView current URL is blank on resume, restoring: " + appUrl);
                            wv.loadUrl(appUrl);
                        }
                    }
                } catch (Exception e) {
                    Log.w("RaagaX", "wakeAndRedrawWebView error: " + e.getMessage());
                }
            });
        }
    }

    private void setupCrashHandler() {
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            StringWriter sw = new StringWriter();
            throwable.printStackTrace(new PrintWriter(sw));
            String crashLog = sw.toString();
            Log.e("RaagaXCrash", crashLog);

            SharedPreferences prefs = getSharedPreferences("CrashLog", Context.MODE_PRIVATE);
            prefs.edit().putString("last_crash", crashLog).commit();

            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            } else {
                System.exit(2);
            }
        });
    }
}
