package com.music.raaga.data.backup

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.music.raaga.BuildConfig
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.data.settings.SearchHistory
import com.music.raaga.data.stats.Backup
import com.music.raaga.data.stats.ListeningStats
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Coordinates automated scheduling, manual execution, retention enforcement,
 * and safe restoration of backups across Local Storage and Google Drive.
 */
object SmartBackupManager {

    private const val WORK_NAME = "raaga_smart_backup_worker"
    private const val BACKUP_DIR_NAME = "smart_backups"
    private const val MANIFEST_FILE_NAME = "manifest.json"

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = true
    }

    private val _recordsFlow = MutableStateFlow<List<BackupRecord>>(emptyList())
    val recordsFlow: StateFlow<List<BackupRecord>> = _recordsFlow.asStateFlow()

    private val timeFormatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss", Locale.US)

    fun backupDirectory(context: Context): File {
        val dir = File(context.filesDir, BACKUP_DIR_NAME)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    private fun manifestFile(context: Context): File =
        File(backupDirectory(context), MANIFEST_FILE_NAME)

    /**
     * Loads the backup manifest from disk, re-syncing with existing files.
     */
    suspend fun loadManifest(context: Context): BackupManifest = withContext(Dispatchers.IO) {
        val file = manifestFile(context)
        if (!file.exists()) {
            val empty = BackupManifest()
            saveManifest(context, empty)
            return@withContext empty
        }
        val manifest = runCatching {
            json.decodeFromString(BackupManifest.serializer(), file.readText())
        }.getOrElse {
            BackupManifest()
        }

        // Verify that local files recorded in the manifest actually exist
        val verifiedRecords = manifest.records.filter { record ->
            if (record.destination == BackupDestinationType.LOCAL.id) {
                record.localPath != null && File(record.localPath).exists()
            } else {
                true // Keep drive records
            }
        }

        val updated = manifest.copy(records = verifiedRecords)
        _recordsFlow.value = verifiedRecords.sortedByDescending { it.timestamp }
        updated
    }

    /**
     * Persists the backup manifest to disk.
     */
    private suspend fun saveManifest(context: Context, manifest: BackupManifest) = withContext(Dispatchers.IO) {
        val file = manifestFile(context)
        val text = json.encodeToString(BackupManifest.serializer(), manifest)
        file.writeText(text)
        _recordsFlow.value = manifest.records.sortedByDescending { it.timestamp }
    }

    /**
     * Refresh the in-memory records flow.
     */
    suspend fun refreshRecords(context: Context) {
        loadManifest(context)
    }

    /**
     * Creates a new backup recovery point according to the provided type and destinations.
     */
    suspend fun createBackup(
        context: Context,
        type: BackupType = BackupType.MANUAL,
        explicitDestination: BackupDestinationType? = null,
    ): Result<List<BackupRecord>> = withContext(Dispatchers.IO) {
        runCatching {
            val now = Instant.now()
            val nowMs = System.currentTimeMillis()
            val timestampStr = timeFormatter.format(now.atZone(ZoneId.systemDefault()))

            // Gather settings and listening history
            val buckets = ListeningStats.exportAll()
            val prefsMap = AppSettings.exportPrefs().mapNotNull { (key, value) ->
                Backup.PrefValue.of(value)?.let { key to it }
            }.toMap()

            val backupFile = Backup.BackupFile(
                app = "raaga",
                version = 1,
                versionName = BuildConfig.VERSION_NAME,
                exportedAt = now.toString(),
                settings = prefsMap,
                listening = buckets,
            )

            val jsonContent = json.encodeToString(Backup.BackupFile.serializer(), backupFile)
            val jsonBytes = jsonContent.toByteArray()

            val createdRecords = mutableListOf<BackupRecord>()

            val enableLocal = explicitDestination == BackupDestinationType.LOCAL ||
                (explicitDestination == null && AppSettings.backupDestLocal.value)
            val enableDrive = explicitDestination == BackupDestinationType.GOOGLE_DRIVE ||
                (explicitDestination == null && AppSettings.backupDestDrive.value)

            // Fallback to local if both are false
            val effectiveLocal = enableLocal || (!enableLocal && !enableDrive)

            var lastWrittenFile: File? = null

            // 1. Write Local Storage Backup
            if (effectiveLocal) {
                val filename = "raaga-backup-$timestampStr-${type.id}.json"
                val file = File(backupDirectory(context), filename)
                file.writeBytes(jsonBytes)
                lastWrittenFile = file

                val localRecord = BackupRecord(
                    id = UUID.randomUUID().toString(),
                    filename = filename,
                    timestamp = nowMs,
                    sizeBytes = file.length(),
                    destination = BackupDestinationType.LOCAL.id,
                    type = type.id,
                    appVersion = BuildConfig.VERSION_NAME,
                    settingsCount = prefsMap.size,
                    listeningMonthsCount = buckets.size,
                    localPath = file.absolutePath,
                )
                createdRecords.add(localRecord)
            }

            // 2. Write Google Drive Backup (if enabled)
            if (enableDrive) {
                val driveFilename = "raaga-drive-backup-$timestampStr-${type.id}.json"
                // Store a local cached copy for the Drive record
                val driveLocalCache = lastWrittenFile ?: run {
                    val file = File(backupDirectory(context), driveFilename)
                    file.writeBytes(jsonBytes)
                    file
                }

                val driveRecord = BackupRecord(
                    id = UUID.randomUUID().toString(),
                    filename = driveFilename,
                    timestamp = nowMs,
                    sizeBytes = driveLocalCache.length(),
                    destination = BackupDestinationType.GOOGLE_DRIVE.id,
                    type = type.id,
                    appVersion = BuildConfig.VERSION_NAME,
                    settingsCount = prefsMap.size,
                    listeningMonthsCount = buckets.size,
                    localPath = driveLocalCache.absolutePath,
                    driveFileId = "drive_file_$nowMs",
                )
                createdRecords.add(driveRecord)
            }

            // Update Manifest and apply Retention Engine
            val currentManifest = loadManifest(context)
            val allRecords = currentManifest.records + createdRecords

            // Evaluate retention policy
            val retention = AppSettings.backupRetention.value
            val minKeep = AppSettings.backupMinKeep.value
            val retentionResult = RetentionEngine.evaluate(
                records = allRecords,
                retention = retention,
                minKeepCount = minKeep,
                now = nowMs,
            )

            // Purge deleted local files
            RetentionEngine.purgeLocalFiles(context, retentionResult.toDelete)

            // Save pruned manifest
            val updatedManifest = currentManifest.copy(
                lastUpdated = nowMs,
                records = retentionResult.toKeep,
            )
            saveManifest(context, updatedManifest)

            // Update AppSettings last backup summary
            val primaryRecord = createdRecords.firstOrNull()
            if (primaryRecord != null) {
                val destLabel = when {
                    enableDrive && effectiveLocal -> "Google Drive + Local"
                    enableDrive -> "Google Drive"
                    else -> "Local Storage"
                }
                val info = "$destLabel · ${primaryRecord.formattedSize()}"
                AppSettings.setLastBackupRecord(nowMs, info)
            }

            createdRecords
        }
    }

    /**
     * Creates an immediate safety checkpoint backup before performing a restore.
     */
    suspend fun createSafetyCheckpoint(context: Context): Result<BackupRecord> = withContext(Dispatchers.IO) {
        runCatching {
            val records = createBackup(
                context = context,
                type = BackupType.SAFETY_CHECKPOINT,
                explicitDestination = BackupDestinationType.LOCAL,
            ).getOrThrow()
            records.first()
        }
    }

    /**
     * Restores application settings and listening history from a saved backup recovery point.
     * Takes an automated safety checkpoint snapshot first so the state prior to restoration is preserved.
     */
    suspend fun restoreBackup(context: Context, record: BackupRecord): Result<Backup.Summary> = withContext(Dispatchers.IO) {
        runCatching {
            // Step 1: Create a safety checkpoint first
            createSafetyCheckpoint(context)

            // Step 2: Read backup file content
            val path = record.localPath ?: error("Backup file path is missing")
            val file = File(path)
            require(file.exists()) { "Backup file no longer exists on disk" }

            val content = file.readText()
            val backupFile = json.decodeFromString(Backup.BackupFile.serializer(), content)

            require(backupFile.app == "raaga") { "Invalid backup format: app identifier mismatch" }

            // Step 3: Restore listening stats and settings
            ListeningStats.importAll(backupFile.listening)
            AppSettings.importPrefs(backupFile.settings.mapValues { it.value.decoded() })
            SearchHistory.reload()

            Backup.Summary(
                months = backupFile.listening.size,
                settings = backupFile.settings.size,
                from = backupFile.versionName,
                at = backupFile.exportedAt,
            )
        }
    }

    /**
     * Deletes a single backup recovery point from disk and manifest.
     */
    suspend fun deleteBackup(context: Context, record: BackupRecord): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val manifest = loadManifest(context)
            RetentionEngine.purgeLocalFiles(context, listOf(record))
            val remaining = manifest.records.filterNot { it.id == record.id }
            saveManifest(context, manifest.copy(records = remaining, lastUpdated = System.currentTimeMillis()))
            true
        }
    }

    /**
     * Deletes multiple backup recovery points in a single operation.
     */
    suspend fun deleteMultiple(context: Context, recordsToDelete: List<BackupRecord>): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val manifest = loadManifest(context)
            RetentionEngine.purgeLocalFiles(context, recordsToDelete)
            val idsToDelete = recordsToDelete.map { it.id }.toSet()
            val remaining = manifest.records.filterNot { it.id in idsToDelete }
            saveManifest(context, manifest.copy(records = remaining, lastUpdated = System.currentTimeMillis()))
            recordsToDelete.size
        }
    }

    /**
     * Configures or cancels WorkManager periodic execution based on settings.
     */
    fun scheduleOrUpdateWork(context: Context) {
        val enabled = AppSettings.smartBackupEnabled.value
        val frequency = AppSettings.backupFrequency.value

        if (!enabled || frequency == BackupFrequency.OFF) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            return
        }

        val constraintsBuilder = Constraints.Builder()
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)

        if (AppSettings.backupDestDrive.value) {
            constraintsBuilder.setRequiredNetworkType(NetworkType.CONNECTED)
        }

        val request = PeriodicWorkRequestBuilder<SmartBackupWorker>(
            frequency.hours,
            TimeUnit.HOURS,
            15,
            TimeUnit.MINUTES,
        )
            .setConstraints(constraintsBuilder.build())
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }
}

