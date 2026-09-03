package com.raagax.music;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * RaagaXWidgetProvider — Home screen glanceable widget for RaagaX Lossless Pro.
 */
public class RaagaXWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WIDGET_PLAY_PAUSE = "com.raagax.music.WIDGET_PLAY_PAUSE";
    public static final String ACTION_WIDGET_NEXT       = "com.raagax.music.WIDGET_NEXT";
    public static final String ACTION_WIDGET_PREV       = "com.raagax.music.WIDGET_PREV";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_raaga_player);

        // Click on widget -> Open MainActivity
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) {
            intent = new Intent(context, MainActivity.class);
            intent.setAction(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
        }
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_album_art, pendingIntent);

        // Play/Pause Action
        Intent playIntent = new Intent(context, RaagaXPlaybackService.class);
        playIntent.setAction("TOGGLE_PLAY");
        PendingIntent playPendingIntent = PendingIntent.getService(
                context, 1, playIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_play_pause, playPendingIntent);

        // Next Track Action
        Intent nextIntent = new Intent(context, RaagaXPlaybackService.class);
        nextIntent.setAction("NEXT");
        PendingIntent nextPendingIntent = PendingIntent.getService(
                context, 2, nextIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_next, nextPendingIntent);

        // Prev Track Action
        Intent prevIntent = new Intent(context, RaagaXPlaybackService.class);
        prevIntent.setAction("PREV");
        PendingIntent prevPendingIntent = PendingIntent.getService(
                context, 3, prevIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_prev, prevPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
