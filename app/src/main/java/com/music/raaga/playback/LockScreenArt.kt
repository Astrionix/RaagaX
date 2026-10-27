package com.music.raaga.playback

import android.app.Activity
import android.app.Application
import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.net.Uri
import android.os.Bundle
import android.graphics.RectF
import android.graphics.Shader
import androidx.core.graphics.ColorUtils
import java.io.File
import androidx.palette.graphics.Palette
import coil3.SingletonImageLoader
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.toBitmap
import com.music.raaga.data.model.artworkAt
import com.music.raaga.data.settings.AppSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * Paints the lock screen the way Apple Music does: a soft gradient taken from
 * the cover's own colours, with the cover itself as a large rounded tile.
 *
 * Android does not let an app draw its own lock screen. What it does let an app
 * do is set the lock *wallpaper*, and from Android 13 the system media card is
 * drawn over that wallpaper. So the picture is composed here as a screen-sized
 * bitmap — gradient, tile, empty space where the system's own card lands — and
 * handed to [WallpaperManager] with [WallpaperManager.FLAG_LOCK]. The home
 * screen is never touched.
 *
 * Opt-in (see AppSettings.lockScreenArt), because it replaces whatever lock
 * wallpaper the user chose while music is playing. [restore] puts that back.
 */
object LockScreenArt {

    /**
     * Where the tile sits, as fractions of the screen. Lock screens differ a
     * lot between OEMs — the clock height and the spot the media card lands in
     * are the two things that move — so these are the only numbers to tune
     * per device. The width is fixed; the top comes from the "Cover position"
     * setting ([AppSettings.lockScreenArtTop]) so each phone can be lined up
     * once, by eye, rather than guessed at here.
     */
    private const val TILE_WIDTH_FRACTION = 0.78f
    private const val TILE_CORNER_FRACTION = 0.06f

    private const val ART_REQUEST_PX = 1000
    private const val DEBOUNCE_MS = 600L
    private const val PREFS = "lock_screen_art"
    private const val KEY_APPLIED = "applied"
    private const val IDLE_RESTORE_MS = 60_000L
    private const val ORIGINAL_MAX_PX = 2600

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val lock = Mutex()
    private var pending: Job? = null
    private var lastArt: String? = null
    private var currentArt: String? = null

    /** Set when the app was cleared from recents; cleared when the UI opens again. */
    @Volatile private var held = false
    private var idleJob: Job? = null

    /** Bumped by every restore, so a paint already in flight knows it lost the race. */
    @Volatile private var generation = 0

    /**
     * Called for each new track. Skipping through a queue fires this in a
     * burst, so only the track that stays for [DEBOUNCE_MS] is painted.
     */
    fun onTrack(context: Context, artUrl: String?, force: Boolean = false) {
        val app = context.applicationContext
        if (!artUrl.isNullOrBlank()) currentArt = artUrl
        if (held) return
        if (artUrl.isNullOrBlank() || (artUrl == lastArt && !force)) return
        pending?.cancel()
        val startedAt = generation
        pending = scope.launch {
            delay(DEBOUNCE_MS)
            lock.withLock {
                val bitmap = compose(app, artUrl) ?: return@withLock
                val ok = withContext(Dispatchers.IO) {
                    // A restore that ran while this was composing wins.
                    if (generation != startedAt) return@withContext false
                    runCatching {
                        WallpaperManager.getInstance(app)
                            .setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK)
                    }.isSuccess
                }
                bitmap.recycle()
                if (ok) {
                    lastArt = artUrl
                    prefs(app).edit().putBoolean(KEY_APPLIED, true).apply()
                }
            }
        }
    }

    /** Compatibility alias */
    fun apply(context: Context, artUrl: String?) {
        if (!AppSettings.lockScreenArt.value && !AppSettings.lockScreenCanvas.value) return
        onTrack(context, artUrl)
    }

    /** Repaints the current cover, after the position slider moved. */
    fun relayout(context: Context) {
        onTrack(context, currentArt, force = true)
    }

    /**
     * Gives the user their lock screen back: their own wallpaper if they saved
     * one with [saveOriginalAsync], otherwise the lock slot is cleared so it
     * follows the home wallpaper again. Android 13+ will not let an app read
     * the current wallpaper back, which is why the user picks it once.
     *
     * [hold] keeps later track changes from painting again until the UI is
     * opened (see [install]) — what "clear the app" should mean.
     */
    fun restore(context: Context, hold: Boolean = false) {
        val app = context.applicationContext
        pending?.cancel()
        idleJob?.cancel()
        generation++
        if (hold) held = true
        lastArt = null
        if (!prefs(app).getBoolean(KEY_APPLIED, false)) return
        val original = loadOriginal(app)
        runCatching {
            val wm = WallpaperManager.getInstance(app)
            if (original != null) {
                wm.setBitmap(original, null, true, WallpaperManager.FLAG_LOCK)
            } else {
                wm.clear(WallpaperManager.FLAG_LOCK)
            }
        }
        original?.recycle()
        prefs(app).edit().putBoolean(KEY_APPLIED, false).apply()
    }

    /**
     * Playback state from the service. Paused or stopped for a minute puts the
     * user's wallpaper back; playing again paints the cover again.
     */
    fun onPlaying(context: Context, playing: Boolean) {
        if (!AppSettings.lockScreenArt.value) return
        val app = context.applicationContext
        idleJob?.cancel()
        if (playing) {
            if (!held && lastArt == null && currentArt != null) onTrack(app, currentArt, force = true)
        } else {
            idleJob = scope.launch {
                delay(IDLE_RESTORE_MS)
                restore(app)
            }
        }
    }

    /** Lets the app being opened again lift the hold set by a clear-from-recents. */
    fun install(app: Application) {
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityStarted(activity: Activity) { held = false }
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityResumed(activity: Activity) {}
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
    }

    private fun originalFile(context: Context) = File(context.filesDir, "lock_screen_original.jpg")

    fun hasOriginal(context: Context): Boolean = originalFile(context).exists()

    /** Copies the wallpaper the user picked into app storage, scaled to a sane size. */
    fun saveOriginalAsync(context: Context, uri: Uri, onDone: (Boolean) -> Unit) {
        val app = context.applicationContext
        scope.launch {
            val ok = withContext(Dispatchers.IO) {
                runCatching {
                    val resolver = app.contentResolver
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
                    var sample = 1
                    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > ORIGINAL_MAX_PX) sample *= 2
                    val bitmap = resolver.openInputStream(uri)?.use {
                        BitmapFactory.decodeStream(
                            it, null, BitmapFactory.Options().apply { inSampleSize = sample },
                        )
                    } ?: return@runCatching false
                    originalFile(app).outputStream().use {
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it)
                    }
                    bitmap.recycle()
                    true
                }.getOrDefault(false)
            }
            withContext(Dispatchers.Main) { onDone(ok) }
        }
    }

    /** The saved wallpaper, centre-cropped to the screen, or null if none was saved. */
    private fun loadOriginal(context: Context): Bitmap? {
        val file = originalFile(context)
        if (!file.exists()) return null
        val src = BitmapFactory.decodeFile(file.absolutePath) ?: return null
        val metrics = context.resources.displayMetrics
        val w = metrics.widthPixels
        val h = metrics.heightPixels
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val scale = maxOf(w / src.width.toFloat(), h / src.height.toFloat())
        val sw = w / scale
        val sh = h / scale
        Canvas(out).drawBitmap(
            src,
            android.graphics.Rect(
                ((src.width - sw) / 2).toInt(), ((src.height - sh) / 2).toInt(),
                ((src.width + sw) / 2).toInt(), ((src.height + sh) / 2).toInt(),
            ),
            RectF(0f, 0f, w.toFloat(), h.toFloat()),
            Paint(Paint.FILTER_BITMAP_FLAG),
        )
        src.recycle()
        return out
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private suspend fun compose(context: Context, artUrl: String): Bitmap? =
        withContext(Dispatchers.IO) {
            val request = ImageRequest.Builder(context)
                .data(artUrl.artworkAt(ART_REQUEST_PX) ?: artUrl)
                .allowHardware(false)
                .build()
            val art = SingletonImageLoader.get(context).execute(request)
                .image?.toBitmap() ?: return@withContext null

            val metrics = context.resources.displayMetrics
            val w = metrics.widthPixels
            val h = metrics.heightPixels
            val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(out)

            // Background: the cover itself, blurred hard and tinted dark. Shrinking
            // it to a few pixels and scaling it back up in two filtered steps is
            // a cheap blur that needs no extra library, and it keeps the cover's
            // own colours in the right places (a red top stays red). The tint
            // on top sinks to near-black at the bottom, which also keeps the
            // system card and the unlock circle readable on any cover.
            val tiny = Bitmap.createScaledBitmap(art, 24, 24, true)
            val soft = Bitmap.createScaledBitmap(tiny, 96, 96, true)
            canvas.drawBitmap(
                soft,
                null,
                RectF(0f, 0f, w.toFloat(), h.toFloat()),
                Paint(Paint.FILTER_BITMAP_FLAG),
            )
            tiny.recycle()
            soft.recycle()

            val palette = Palette.from(art).maximumColorCount(16).generate()
            val top = palette.getVibrantColor(palette.getDominantColor(Color.DKGRAY))
            val bottom = palette.getDarkMutedColor(darken(top, 0.35f))
            canvas.drawRect(
                0f, 0f, w.toFloat(), h.toFloat(),
                Paint().apply {
                    shader = LinearGradient(
                        0f, 0f, 0f, h.toFloat(),
                        intArrayOf(
                            ColorUtils.setAlphaComponent(darken(top, 0.60f), 0x99),
                            ColorUtils.setAlphaComponent(darken(top, 0.45f), 0xB3),
                            ColorUtils.setAlphaComponent(darken(bottom, 0.30f), 0xEB),
                        ),
                        floatArrayOf(0f, 0.55f, 1f),
                        Shader.TileMode.CLAMP,
                    )
                },
            )

            // The tile: square, centre-cropped, rounded, with a soft shadow.
            val size = w * TILE_WIDTH_FRACTION
            val left = (w - size) / 2f
            val topPx = h * (AppSettings.lockScreenArtTop.value / 100f)
            val rect = RectF(left, topPx, left + size, topPx + size)
            val radius = size * TILE_CORNER_FRACTION

            canvas.drawRoundRect(
                rect, radius, radius,
                Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.BLACK
                    setShadowLayer(size * 0.05f, 0f, size * 0.02f, 0x66000000)
                },
            )
            canvas.save()
            canvas.clipPath(Path().apply { addRoundRect(rect, radius, radius, Path.Direction.CW) })
            val side = minOf(art.width, art.height)
            val src = android.graphics.Rect(
                (art.width - side) / 2, (art.height - side) / 2,
                (art.width + side) / 2, (art.height + side) / 2,
            )
            canvas.drawBitmap(art, src, rect, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
            canvas.restore()
            out
        }

    private fun darken(color: Int, amount: Float): Int {
        val hsl = FloatArray(3)
        ColorUtils.colorToHSL(color, hsl)
        hsl[2] = (hsl[2] * amount).coerceIn(0f, 1f)
        return ColorUtils.HSLToColor(hsl)
    }
}
