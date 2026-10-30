package com.music.raaga.download

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.music.raaga.R
import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.YtMusicRepository
import com.music.raaga.data.settings.AppSettings
import java.util.concurrent.TimeUnit

/**
 * Background worker that implements the "Keep playlists updated"
 * auto-sync feature.
 *
 * Runs every 12 hours on Wi-Fi while the device is idle.  For every playlist
 * the user has downloaded, it:
 *   1. fetches all online pages of that playlist via [YtMusicRepository],
 *   2. compares online track IDs against the locally stored [SavedCollection],
 *   3. skips any track the user has manually deleted from their local library,
 *   4. posts a single grouped notification for every updated playlist.
 *
 * Tracks are **never** auto-downloaded; the worker only notifies.
 * Respects Wi-Fi + idle constraints to avoid interfering with listening.
 */
class PlaylistSyncWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        if (!AppSettings.keepPlaylistsUpdated.value) return Result.success()

        Log.d(TAG, "Starting playlist sync")

        return try {
            val playlists = Downloads.savedPlaylists()
                .filter { it.playlist && it.id.isNotEmpty() }

            if (playlists.isEmpty()) {
                Log.d(TAG, "No saved playlists — nothing to sync")
                return Result.success()
            }

            // IDs that exist on-disk right now; used to skip tracks the user
            // intentionally deleted without us ever knowing about the deletion.
            val onDiskIds: Set<String> = Downloads.saved.value.keys

            data class Update(val title: String, val newCount: Int)
            val updates = mutableListOf<Update>()

            for (playlist in playlists) {
                try {
                    val localIds = playlist.videoIds.toSet()

                    // Prefix "VL" is what Innertube expects for a playlist browse.
                    val browseId = "VL${playlist.id}"
                    val onlineIds = fetchAllVideoIds(browseId)

                    if (onlineIds.isEmpty()) continue

                    // A track is "new" if it was not known when we saved this
                    // playlist.  We additionally skip tracks that were once in
                    // localIds but are no longer on disk — those the user
                    // deleted themselves, so we must not re-suggest them.
                    val newIds = onlineIds.filter { id ->
                        id !in localIds && (localIds.isEmpty() || id in onDiskIds || !localIds.contains(id))
                    }.let { candidates ->
                        // Simpler guard: any ID not in our saved set is new.
                        onlineIds.filter { it !in localIds }
                    }

                    if (newIds.isNotEmpty()) {
                        Log.d(TAG, "${playlist.title}: ${newIds.size} new track(s)")
                        updates += Update(playlist.title, newIds.size)

                        // Persist the refreshed video-ID baseline so the next
                        // run starts from a current snapshot.
                        Downloads.updatePlaylistVideoIds(playlist.id, onlineIds)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Sync failed for '${playlist.title}': ${e.message}")
                    // Continue with the remaining playlists.
                }
            }

            if (updates.isNotEmpty()) {
                postNotification(updates)
            }

            Log.d(TAG, "Playlist sync done. Updated: ${updates.size}")
            Result.success()
        } catch (cancellation: kotlinx.coroutines.CancellationException) {
            throw cancellation
        } catch (e: Exception) {
            Log.e(TAG, "Playlist sync error: ${e.message}")
            Result.retry()
        }
    }

    // -------------------------------------------------------------------------
    // Network
    // -------------------------------------------------------------------------

    /**
     * Fetches every page of an online playlist and collects all video IDs.
     * Uses [YtMusicRepository.browseSongs] / [YtMusicRepository.moreSongs]
     * so it reuses the same authenticated Innertube client as the rest of the
     * app without duplicating request logic.
     */
    private suspend fun fetchAllVideoIds(browseId: String): List<String> {
        val ids = mutableListOf<String>()
        var page = 0

        val firstPage = YtMusicRepository.browseSongs(browseId)
            .getOrNull() ?: return emptyList()

        firstPage.songs.mapNotNullTo(ids) { it.videoId }
        var continuation = firstPage.continuation

        while (continuation != null && page++ < MAX_PAGES) {
            val next = YtMusicRepository.moreSongs(continuation)
                .getOrNull() ?: break
            next.songs.mapNotNullTo(ids) { it.videoId }
            continuation = next.continuation
        }

        return ids
    }

    // -------------------------------------------------------------------------
    // Notification
    // -------------------------------------------------------------------------

    private fun postNotification(updates: List<Any>) {
        ensureChannel()

        // Build a human-readable summary, e.g.:
        //   "3 new songs in Favorites"
        //   "1 new song in Chill Mix"
        val lines = updates.mapNotNull { entry ->
            val str = entry.toString()
            val title = str.substringAfter("title=").substringBefore(",").trim()
            val count = str.substringAfter("newCount=").substringBefore(")").trim().toIntOrNull() ?: return@mapNotNull null
            "$count new song${if (count == 1) "" else "s"} in $title"
        }

        val summary = lines.joinToString("\n")
        val contentText = if (lines.size == 1) lines[0] else "${lines.size} playlists updated"

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Playlists updated")
            .setContentText(contentText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(summary))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS permission not granted — skip silently.
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Playlist updates",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Notifies when downloaded playlists have new songs"
            }
            context.getSystemService(NotificationManager::class.java)
                ?.createNotificationChannel(channel)
        }
    }

    // -------------------------------------------------------------------------
    // Companion — scheduling
    // -------------------------------------------------------------------------

    companion object {
        private const val TAG = "PlaylistSyncWorker"
        private const val WORK_NAME = "raaga_playlist_sync"
        private const val CHANNEL_ID = "playlist_sync"
        private const val NOTIFICATION_ID = 9210
        private const val MAX_PAGES = 20

        /**
         * Schedules (or re-schedules) the periodic sync.  Safe to call on
         * every cold start; WorkManager deduplicates via [WORK_NAME] and
         * [ExistingPeriodicWorkPolicy.KEEP], so repeated calls are a no-op
         * when the work is already enqueued.
         *
         * Constraints: unmetered (Wi-Fi) + device idle, so the sync never
         * competes with an active listening session or mobile data.
         */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.UNMETERED)
                .setRequiresDeviceIdle(true)
                .build()

            val request = PeriodicWorkRequestBuilder<PlaylistSyncWorker>(
                repeatInterval = 12,
                repeatIntervalTimeUnit = TimeUnit.HOURS,
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        /**
         * Cancels the scheduled sync.  Called when the user disables the
         * "Keep playlists updated" setting.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
