package com.raagax.music;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.raagax.music.permission.RaagaXPermissionsPlugin;

import java.io.PrintWriter;
import java.io.StringWriter;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        setupCrashHandler();
        registerPlugin(RaagaXCapacitorPlugin.class);
        registerPlugin(RaagaXPermissionsPlugin.class);
        super.onCreate(savedInstanceState);
        checkAndShowCrash();
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

    private void checkAndShowCrash() {
        SharedPreferences prefs = getSharedPreferences("CrashLog", Context.MODE_PRIVATE);
        String lastCrash = prefs.getString("last_crash", null);
        if (lastCrash != null) {
            prefs.edit().remove("last_crash").apply();
            new AlertDialog.Builder(this)
                .setTitle("App Crashed Last Time")
                .setMessage(lastCrash)
                .setPositiveButton("OK", null)
                .show();
        }
    }
}
