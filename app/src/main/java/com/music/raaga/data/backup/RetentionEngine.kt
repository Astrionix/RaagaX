package com.music.raaga.data.backup

import android.content.Context
import java.io.File

/**
 * Enforces automatic backup retention policies while guaranteeing that at least
 * [minKeepCount] recovery points are never deleted, ensuring the user always has a safety net.
 */
object RetentionEngine {

    data class RetentionResult(
        val toKeep: List<BackupRecord>,
        val toDelete: List<BackupRecord>,
    )

    /**
     * Evaluates a collection of backup records against the configured retention period
     * and minimum preservation threshold.
     *
     * Invariants:
     * 1. Evaluated per destination (e.g., Local and Drive independently preserve at least [minKeepCount]).
     * 2. The most recent [minKeepCount] backups are ALWAYS preserved regardless of age.
     * 3. Beyond [minKeepCount], backups older than [retention].days are slated for deletion.
     * 4. If [retention] is [BackupRetentionPeriod.FOREVER], no records are pruned.
     */
    fun evaluate(
        records: List<BackupRecord>,
        retention: BackupRetentionPeriod,
        minKeepCount: Int = 5,
        now: Long = System.currentTimeMillis(),
    ): RetentionResult {
        if (records.isEmpty()) {
            return RetentionResult(emptyList(), emptyList())
        }

        if (retention == BackupRetentionPeriod.FOREVER) {
            return RetentionResult(toKeep = records, toDelete = emptyList())
        }

        val safeMinCount = minKeepCount.coerceAtLeast(1)
        val maxAgeMs = retention.days.toLong() * 86_400_000L

        val toKeep = mutableListOf<BackupRecord>()
        val toDelete = mutableListOf<BackupRecord>()

        // Group by destination so each destination preserves at least safeMinCount
        val byDestination = records.groupBy { it.destination }

        for ((_, destRecords) in byDestination) {
            // Sort newest first
            val sorted = destRecords.sortedByDescending { it.timestamp }

            for ((index, record) in sorted.withIndex()) {
                val isWithinSafetyQuota = index < safeMinCount
                val isExpired = (now - record.timestamp) > maxAgeMs

                if (isWithinSafetyQuota || !isExpired) {
                    toKeep.add(record)
                } else {
                    toDelete.add(record)
                }
            }
        }

        return RetentionResult(toKeep = toKeep, toDelete = toDelete)
    }

    /**
     * Physically removes deleted local backup files from disk.
     */
    fun purgeLocalFiles(context: Context, recordsToDelete: List<BackupRecord>) {
        for (record in recordsToDelete) {
            record.localPath?.let { path ->
                runCatching {
                    val file = File(path)
                    if (file.exists()) {
                        file.delete()
                    }
                }
            }
        }
    }
}

