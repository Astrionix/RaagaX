package com.music.raaga.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.RaagaApplication
import com.music.raaga.data.backup.*
import com.music.raaga.data.settings.AppSettings
import com.music.raaga.ui.theme.settingsSwitchColors
import kotlinx.coroutines.launch
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/**
 * Dedicated settings screen for Smart Backup & Restore.
 * Configures automatic background backups, storage destinations (Local & Google Drive),
 * retention rules, and manual execution.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupSettingsSubScreen(
    onSignIn: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    val enabled by AppSettings.smartBackupEnabled.collectAsStateWithLifecycle()
    val frequency by AppSettings.backupFrequency.collectAsStateWithLifecycle()
    val destLocal by AppSettings.backupDestLocal.collectAsStateWithLifecycle()
    val destDrive by AppSettings.backupDestDrive.collectAsStateWithLifecycle()
    val retention by AppSettings.backupRetention.collectAsStateWithLifecycle()
    val minKeep by AppSettings.backupMinKeep.collectAsStateWithLifecycle()
    val lastBackupTime by AppSettings.lastBackupTime.collectAsStateWithLifecycle()
    val lastBackupInfo by AppSettings.lastBackupInfo.collectAsStateWithLifecycle()

    val records by SmartBackupManager.recordsFlow.collectAsStateWithLifecycle()

    var isBackingUp by remember { mutableStateOf(false) }
    var showFrequencySheet by remember { mutableStateOf(false) }
    var showRetentionSheet by remember { mutableStateOf(false) }
    var showMinKeepSheet by remember { mutableStateOf(false) }
    var showManageBackups by remember { mutableStateOf(false) }

    val activeGoogleSession = remember {
        runCatching { RaagaApplication.authStore.activeSession }.getOrNull()
    }

    LaunchedEffect(Unit) {
        SmartBackupManager.refreshRecords(context)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 32.dp),
    ) {
        // ── Card 1: Automatic Backup ──────────────────────────────────────────
        SettingsGroup(
            header = stringResource(R.string.automatic_backup),
            footer = stringResource(R.string.enable_automatic_backup_desc),
        ) {
            // Row 1: Enable Automatic Backup Switch
            SettingsRow(
                icon = Icons.Rounded.Schedule,
                title = stringResource(R.string.enable_automatic_backup),
                trailing = {
                    Switch(
                        checked = enabled,
                        onCheckedChange = { isChecked ->
                            AppSettings.setSmartBackupEnabled(isChecked)
                            SmartBackupManager.scheduleOrUpdateWork(context)
                        },
                        colors = settingsSwitchColors(),
                    )
                },
                onClick = {
                    val next = !enabled
                    AppSettings.setSmartBackupEnabled(next)
                    SmartBackupManager.scheduleOrUpdateWork(context)
                },
            )

            AnimatedVisibility(visible = enabled) {
                Column {
                    RowDivider()

                    // Row 2: Backup Frequency Picker
                    SettingsRow(
                        icon = Icons.Rounded.Timelapse,
                        title = stringResource(R.string.backup_frequency),
                        value = stringResource(frequency.labelRes),
                        onClick = { showFrequencySheet = true },
                    )

                    RowDivider()

                    // Row 3: Google Drive Destination
                    SettingsRow(
                        icon = Icons.Rounded.Cloud,
                        title = stringResource(R.string.backup_destination_google_drive),
                        subtitle = if (activeGoogleSession != null && activeGoogleSession.email.isNotBlank()) {
                            stringResource(R.string.google_drive_connected, activeGoogleSession.email)
                        } else {
                            stringResource(R.string.google_drive_not_connected)
                        },
                        trailing = {
                            Checkbox(
                                checked = destDrive,
                                onCheckedChange = { isChecked ->
                                    if (isChecked && (activeGoogleSession == null || activeGoogleSession.email.isBlank())) {
                                        onSignIn()
                                    }
                                    AppSettings.setBackupDestDrive(isChecked)
                                    SmartBackupManager.scheduleOrUpdateWork(context)
                                },
                            )
                        },
                        onClick = {
                            val next = !destDrive
                            if (next && (activeGoogleSession == null || activeGoogleSession.email.isBlank())) {
                                onSignIn()
                            }
                            AppSettings.setBackupDestDrive(next)
                            SmartBackupManager.scheduleOrUpdateWork(context)
                        },
                    )

                    RowDivider()

                    // Row 4: Local Storage Destination
                    SettingsRow(
                        icon = Icons.Rounded.Folder,
                        title = stringResource(R.string.backup_destination_local_storage),
                        subtitle = stringResource(R.string.backup_destination_local_storage_desc),
                        trailing = {
                            Checkbox(
                                checked = destLocal,
                                onCheckedChange = { isChecked ->
                                    // Guarantee at least one destination remains checked
                                    if (!isChecked && !destDrive) {
                                        Toast.makeText(
                                            context,
                                            "At least one backup destination must remain enabled",
                                            Toast.LENGTH_SHORT,
                                        ).show()
                                        return@Checkbox
                                    }
                                    AppSettings.setBackupDestLocal(isChecked)
                                },
                            )
                        },
                        onClick = {
                            val next = !destLocal
                            if (!next && !destDrive) {
                                Toast.makeText(
                                    context,
                                    "At least one backup destination must remain enabled",
                                    Toast.LENGTH_SHORT,
                                ).show()
                                return@SettingsRow
                            }
                            AppSettings.setBackupDestLocal(next)
                        },
                    )
                }
            }
        }

        // ── Card 2: Backup Management ──────────────────────────────────────────
        SettingsGroup(
            header = stringResource(R.string.backup_management),
        ) {
            SettingsRow(
                icon = Icons.Rounded.Inventory2,
                title = stringResource(R.string.manage_backups),
                subtitle = stringResource(R.string.manage_backups_subtitle),
                badge = if (records.isNotEmpty()) "${records.size}" else null,
                trailing = {
                    Icon(
                        imageVector = Icons.Rounded.ChevronRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                onClick = { showManageBackups = true },
            )
        }

        // ── Card 3: Retention Policy ──────────────────────────────────────────
        SettingsGroup(
            header = stringResource(R.string.retention_title),
            footer = stringResource(R.string.keep_at_least_desc),
        ) {
            // Row 1: Delete backups older than
            SettingsRow(
                icon = Icons.Rounded.HistoryToggleOff,
                title = stringResource(R.string.delete_backups_older_than),
                value = stringResource(retention.labelRes),
                onClick = { showRetentionSheet = true },
            )

            RowDivider()

            // Row 2: Keep at least X backups
            SettingsRow(
                icon = Icons.Rounded.Shield,
                title = stringResource(R.string.keep_at_least),
                value = stringResource(R.string.keep_at_least_count, minKeep),
                onClick = { showMinKeepSheet = true },
            )
        }

        Spacer(Modifier.height(24.dp))

        // ── Card 4: Action Button & Last Backup Card ──────────────────────────
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = GROUP_INSET),
        ) {
            val buttonShape = RoundedCornerShape(20.dp)
            val isEnabled = !isBackingUp

            Button(
                onClick = {
                    if (isBackingUp) return@Button
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    isBackingUp = true
                    coroutineScope.launch {
                        val result = SmartBackupManager.createBackup(
                            context = context,
                            type = BackupType.MANUAL,
                        )
                        isBackingUp = false
                        if (result.isSuccess) {
                            Toast.makeText(
                                context,
                                context.getString(R.string.backup_success),
                                Toast.LENGTH_SHORT,
                            ).show()
                        } else {
                            Toast.makeText(
                                context,
                                context.getString(
                                    R.string.backup_failed,
                                    result.exceptionOrNull()?.localizedMessage ?: "Unknown error",
                                ),
                                Toast.LENGTH_LONG,
                            ).show()
                        }
                    }
                },
                enabled = isEnabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = buttonShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            ) {
                if (isBackingUp) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.5.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = stringResource(R.string.backing_up),
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                    )
                } else {
                    Icon(
                        imageVector = Icons.Rounded.CloudUpload,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = stringResource(R.string.back_up_now),
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Last Backup Info Display
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = GROUP_INSET),
            shape = GroupShape,
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            ),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.CheckCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                }
                Spacer(Modifier.width(14.dp))
                Column {
                    Text(
                        text = stringResource(R.string.last_backup),
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(2.dp))
                    if (lastBackupTime > 0) {
                        Text(
                            text = formatBackupDate(lastBackupTime),
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        if (lastBackupInfo.isNotBlank()) {
                            Text(
                                text = lastBackupInfo,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        Text(
                            text = stringResource(R.string.no_backup_yet),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }

    // ── Frequency Picker Sheet ────────────────────────────────────────────────
    if (showFrequencySheet) {
        ModalBottomSheet(
            onDismissRequest = { showFrequencySheet = false },
            containerColor = MaterialTheme.colorScheme.background,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
            ) {
                Text(
                    text = stringResource(R.string.backup_frequency),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.padding(start = 22.dp, end = 22.dp, bottom = 14.dp),
                )
                BackupFrequency.entries.forEach { option ->
                    val isSelected = option == frequency
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                AppSettings.setBackupFrequency(option)
                                SmartBackupManager.scheduleOrUpdateWork(context)
                                showFrequencySheet = false
                            }
                            .padding(horizontal = 22.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(option.labelRes),
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                            ),
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f),
                        )
                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Rounded.Check,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
        }
    }

    // ── Retention Period Picker Sheet ─────────────────────────────────────────
    if (showRetentionSheet) {
        ModalBottomSheet(
            onDismissRequest = { showRetentionSheet = false },
            containerColor = MaterialTheme.colorScheme.background,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
            ) {
                Text(
                    text = stringResource(R.string.delete_backups_older_than),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.padding(start = 22.dp, end = 22.dp, bottom = 14.dp),
                )
                BackupRetentionPeriod.entries.forEach { option ->
                    val isSelected = option == retention
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                AppSettings.setBackupRetention(option)
                                showRetentionSheet = false
                            }
                            .padding(horizontal = 22.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(option.labelRes),
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                            ),
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f),
                        )
                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Rounded.Check,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
        }
    }

    // ── Keep At Least Picker Sheet ────────────────────────────────────────────
    if (showMinKeepSheet) {
        val options = listOf(1, 3, 5, 10, 15, 20)
        ModalBottomSheet(
            onDismissRequest = { showMinKeepSheet = false },
            containerColor = MaterialTheme.colorScheme.background,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
            ) {
                Text(
                    text = stringResource(R.string.keep_at_least),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.padding(start = 22.dp, end = 22.dp, bottom = 6.dp),
                )
                Text(
                    text = stringResource(R.string.keep_at_least_desc),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 22.dp, end = 22.dp, bottom = 14.dp),
                )
                options.forEach { count ->
                    val isSelected = count == minKeep
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                AppSettings.setBackupMinKeep(count)
                                showMinKeepSheet = false
                            }
                            .padding(horizontal = 22.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = if (count == 5) "$count backups (Recommended)" else "$count backups",
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                            ),
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f),
                        )
                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Rounded.Check,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
        }
    }

    // ── Manage Backups Sheet ──────────────────────────────────────────────────
    if (showManageBackups) {
        Dialog(
            onDismissRequest = { showManageBackups = false },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
            ),
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background,
            ) {
                ManageBackupsSheet(
                    onDismiss = { showManageBackups = false },
                )
            }
        }
    }
}
