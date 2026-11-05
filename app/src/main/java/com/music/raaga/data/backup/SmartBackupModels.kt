package com.music.raaga.data.backup

import androidx.annotation.StringRes
import com.music.raaga.R
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * How often the app creates a periodic background backup.
 */
enum class BackupFrequency(
    val hours: Long,
    @StringRes val labelRes: Int,
) {
    OFF(0L, R.string.backup_frequency_off),
    EVERY_6_HOURS(6L, R.string.backup_frequency_6h),
    EVERY_12_HOURS(12L, R.string.backup_frequency_12h),
    EVERY_24_HOURS(24L, R.string.backup_frequency_24h),
    EVERY_2_DAYS(48L, R.string.backup_frequency_2d),
    EVERY_7_DAYS(168L, R.string.backup_frequency_7d);

    companion object {
        fun fromHours(hours: Long): BackupFrequency =
            entries.firstOrNull { it.hours == hours } ?: EVERY_24_HOURS
    }
}

/**
 * How long old backups are kept before automatic cleanup removes them.
 */
enum class BackupRetentionPeriod(
    val days: Int,
    @StringRes val labelRes: Int,
) {
    FOREVER(Int.MAX_VALUE, R.string.retention_forever),
    DAYS_7(7, R.string.retention_7d),
    DAYS_30(30, R.string.retention_30d),
    DAYS_90(90, R.string.retention_90d),
    MONTHS_6(180, R.string.retention_6m),
    YEAR_1(365, R.string.retention_1y);

    companion object {
        fun fromDays(days: Int): BackupRetentionPeriod =
            entries.firstOrNull { it.days == days } ?: DAYS_30
    }
}

/**
 * Where backups are stored.
 */
enum class BackupDestinationType(
    val id: String,
    @StringRes val labelRes: Int,
) {
    LOCAL("local", R.string.backup_destination_local_storage),
    GOOGLE_DRIVE("drive", R.string.backup_destination_google_drive);

    companion object {
        fun fromId(id: String): BackupDestinationType =
            entries.firstOrNull { it.id == id } ?: LOCAL
    }
}

/**
 * The trigger that caused this backup to be created.
 */
enum class BackupType(
    val id: String,
    @StringRes val labelRes: Int,
) {
    AUTOMATIC("automatic", R.string.backup_type_automatic),
    MANUAL("manual", R.string.backup_type_manual),
    SAFETY_CHECKPOINT("checkpoint", R.string.backup_type_checkpoint);

    companion object {
        fun fromId(id: String): BackupType =
            entries.firstOrNull { it.id == id } ?: MANUAL
    }
}

/**
 * A persistent entry representing a single backup recovery point.
 */
@Serializable
data class BackupRecord(
    val id: String,
    val filename: String,
    val timestamp: Long,
    val sizeBytes: Long,
    val destination: String = "local", // "local" or "drive"
    val type: String = "manual", // "automatic", "manual", "checkpoint"
    val appVersion: String = "",
    val settingsCount: Int = 0,
    val listeningMonthsCount: Int = 0,
    val localPath: String? = null,
    val driveFileId: String? = null,
) {
    val destinationType: BackupDestinationType
        get() = BackupDestinationType.fromId(destination)

    val backupType: BackupType
        get() = BackupType.fromId(type)

    fun formattedDate(): String = formatBackupDate(timestamp)

    fun formattedSize(): String = formatBackupSize(sizeBytes)
}

/**
 * Manifest tracking all saved recovery points across local and cloud destinations.
 */
@Serializable
data class BackupManifest(
    val schemaVersion: Int = 1,
    val lastUpdated: Long = System.currentTimeMillis(),
    val records: List<BackupRecord> = emptyList(),
)

private val DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM d, yyyy · h:mm a", Locale.getDefault())

fun formatBackupDate(timestamp: Long): String {
    return runCatching {
        Instant.ofEpochMilli(timestamp)
            .atZone(ZoneId.systemDefault())
            .format(DATE_FORMATTER)
    }.getOrDefault("Unknown Date")
}

fun formatBackupSize(bytes: Long): String = when {
    bytes <= 0 -> "0 B"
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> String.format(Locale.US, "%.1f KB", bytes / 1024.0)
    else -> String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
}

