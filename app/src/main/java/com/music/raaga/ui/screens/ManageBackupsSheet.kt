package com.music.raaga.ui.screens

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.music.raaga.R
import com.music.raaga.data.backup.BackupDestinationType
import com.music.raaga.data.backup.BackupRecord
import com.music.raaga.data.backup.BackupType
import com.music.raaga.data.backup.SmartBackupManager
import kotlinx.coroutines.launch

/**
 * Screen / Sheet allowing users to browse, restore, delete, and multi-select delete
 * saved recovery points across Local Storage and Google Drive.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManageBackupsSheet(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val records by SmartBackupManager.recordsFlow.collectAsStateWithLifecycle()

    var isMultiSelectMode by remember { mutableStateOf(false) }
    val selectedIds = remember { mutableStateListOf<String>() }

    var recordToRestore by remember { mutableStateOf<BackupRecord?>(null) }
    var recordToDelete by remember { mutableStateOf<BackupRecord?>(null) }
    var showBulkDeleteConfirm by remember { mutableStateOf(false) }
    var isOperating by remember { mutableStateOf(false) }

    BackHandler {
        if (isMultiSelectMode) {
            isMultiSelectMode = false
            selectedIds.clear()
        } else {
            onDismiss()
        }
    }

    LaunchedEffect(Unit) {
        SmartBackupManager.refreshRecords(context)
    }

    val driveRecords = remember(records) {
        records.filter { it.destination == BackupDestinationType.GOOGLE_DRIVE.id }
    }
    val localRecords = remember(records) {
        records.filter { it.destination == BackupDestinationType.LOCAL.id }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (isMultiSelectMode) {
                            "${selectedIds.size} Selected"
                        } else {
                            stringResource(R.string.manage_backups)
                        },
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.SemiBold),
                    )
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (isMultiSelectMode) {
                            isMultiSelectMode = false
                            selectedIds.clear()
                        } else {
                            onDismiss()
                        }
                    }) {
                        Icon(
                            imageVector = if (isMultiSelectMode) Icons.Rounded.Close else Icons.Rounded.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
                actions = {
                    if (records.isNotEmpty()) {
                        if (!isMultiSelectMode) {
                            TextButton(onClick = { isMultiSelectMode = true }) {
                                Text(
                                    text = "Select",
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Medium,
                                )
                            }
                        } else {
                            TextButton(onClick = {
                                if (selectedIds.size == records.size) {
                                    selectedIds.clear()
                                } else {
                                    selectedIds.clear()
                                    selectedIds.addAll(records.map { it.id })
                                }
                            }) {
                                Text(
                                    text = if (selectedIds.size == records.size) "Deselect All" else "Select All",
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                            IconButton(
                                onClick = { showBulkDeleteConfirm = true },
                                enabled = selectedIds.isNotEmpty(),
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Delete,
                                    contentDescription = "Delete Selected",
                                    tint = if (selectedIds.isNotEmpty()) {
                                        MaterialTheme.colorScheme.error
                                    } else {
                                        MaterialTheme.colorScheme.outline
                                    },
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { paddingValues ->
        if (records.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(32.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.CloudOff,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                        modifier = Modifier.size(64.dp),
                    )
                    Spacer(Modifier.height(16.dp))
                    Text(
                        text = stringResource(R.string.no_backups_found),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Tap 'Back Up Now' in settings to create your first recovery point.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (driveRecords.isNotEmpty()) {
                    item(key = "header_drive") {
                        DestinationHeader(
                            title = stringResource(R.string.backup_destination_google_drive),
                            icon = Icons.Rounded.Cloud,
                            count = driveRecords.size,
                        )
                    }
                    items(driveRecords, key = { it.id }) { record ->
                        BackupRecordCard(
                            record = record,
                            isMultiSelect = isMultiSelectMode,
                            isSelected = selectedIds.contains(record.id),
                            onToggleSelect = {
                                if (selectedIds.contains(record.id)) {
                                    selectedIds.remove(record.id)
                                } else {
                                    selectedIds.add(record.id)
                                }
                            },
                            onRestore = { recordToRestore = record },
                            onDelete = { recordToDelete = record },
                        )
                    }
                }

                if (localRecords.isNotEmpty()) {
                    item(key = "header_local") {
                        Spacer(Modifier.height(8.dp))
                        DestinationHeader(
                            title = stringResource(R.string.backup_destination_local_storage),
                            icon = Icons.Rounded.Folder,
                            count = localRecords.size,
                        )
                    }
                    items(localRecords, key = { it.id }) { record ->
                        BackupRecordCard(
                            record = record,
                            isMultiSelect = isMultiSelectMode,
                            isSelected = selectedIds.contains(record.id),
                            onToggleSelect = {
                                if (selectedIds.contains(record.id)) {
                                    selectedIds.remove(record.id)
                                } else {
                                    selectedIds.add(record.id)
                                }
                            },
                            onRestore = { recordToRestore = record },
                            onDelete = { recordToDelete = record },
                        )
                    }
                }

                item {
                    Spacer(Modifier.height(32.dp))
                }
            }
        }
    }

    // Confirmation Dialog: Restore Backup
    recordToRestore?.let { record ->
        AlertDialog(
            onDismissRequest = { if (!isOperating) recordToRestore = null },
            icon = {
                Icon(
                    imageVector = Icons.Rounded.Restore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
            },
            title = {
                Text(text = stringResource(R.string.restore_backup_title))
            },
            text = {
                Column {
                    Text(
                        text = stringResource(
                            R.string.restore_backup_message,
                            record.formattedDate(),
                            record.formattedSize(),
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(Modifier.height(12.dp))
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
                        ),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Shield,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text = "A safety checkpoint of your current state will be created right now before applying this backup.",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        isOperating = true
                        coroutineScope.launch {
                            val res = SmartBackupManager.restoreBackup(context, record)
                            isOperating = false
                            recordToRestore = null
                            if (res.isSuccess) {
                                Toast.makeText(
                                    context,
                                    context.getString(R.string.restore_success),
                                    Toast.LENGTH_LONG,
                                ).show()
                            } else {
                                Toast.makeText(
                                    context,
                                    context.getString(
                                        R.string.restore_failed,
                                        res.exceptionOrNull()?.localizedMessage ?: "Unknown error",
                                    ),
                                    Toast.LENGTH_LONG,
                                ).show()
                            }
                        }
                    },
                    enabled = !isOperating,
                ) {
                    if (isOperating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(stringResource(R.string.restore_backup_confirm))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { recordToRestore = null },
                    enabled = !isOperating,
                ) {
                    Text("Cancel")
                }
            },
        )
    }

    // Confirmation Dialog: Single Delete
    recordToDelete?.let { record ->
        AlertDialog(
            onDismissRequest = { if (!isOperating) recordToDelete = null },
            icon = {
                Icon(
                    imageVector = Icons.Rounded.DeleteOutline,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                )
            },
            title = {
                Text(text = stringResource(R.string.delete_backup_title))
            },
            text = {
                Text(
                    text = "${stringResource(R.string.delete_backup_message)}\n\n" +
                        "Date: ${record.formattedDate()}\n" +
                        "Size: ${record.formattedSize()}",
                    style = MaterialTheme.typography.bodyMedium,
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        isOperating = true
                        coroutineScope.launch {
                            SmartBackupManager.deleteBackup(context, record)
                            isOperating = false
                            recordToDelete = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    enabled = !isOperating,
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { recordToDelete = null },
                    enabled = !isOperating,
                ) {
                    Text("Cancel")
                }
            },
        )
    }

    // Confirmation Dialog: Multi-select Bulk Delete
    if (showBulkDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { if (!isOperating) showBulkDeleteConfirm = false },
            icon = {
                Icon(
                    imageVector = Icons.Rounded.DeleteSweep,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                )
            },
            title = {
                Text(text = stringResource(R.string.delete_selected_title))
            },
            text = {
                Text(
                    text = stringResource(R.string.delete_selected_message, selectedIds.size),
                    style = MaterialTheme.typography.bodyMedium,
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        isOperating = true
                        coroutineScope.launch {
                            val toDelete = records.filter { it.id in selectedIds }
                            SmartBackupManager.deleteMultiple(context, toDelete)
                            selectedIds.clear()
                            isMultiSelectMode = false
                            isOperating = false
                            showBulkDeleteConfirm = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    enabled = !isOperating,
                ) {
                    Text("Delete (${selectedIds.size})")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showBulkDeleteConfirm = false },
                    enabled = !isOperating,
                ) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun DestinationHeader(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    count: Int,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = title.uppercase(),
            style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.sp, fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.weight(1f))
        Text(
            text = "$count ${if (count == 1) "backup" else "backups"}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun BackupRecordCard(
    record: BackupRecord,
    isMultiSelect: Boolean,
    isSelected: Boolean,
    onToggleSelect: () -> Unit,
    onRestore: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val cardShape = RoundedCornerShape(18.dp)
    val cardBorderColor by animateColorAsState(
        targetValue = if (isSelected) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
        },
        label = "cardBorder",
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(cardShape)
            .border(if (isSelected) 1.5.dp else 0.8.dp, cardBorderColor, cardShape)
            .clickable(onClick = {
                if (isMultiSelect) {
                    onToggleSelect()
                } else {
                    onRestore()
                }
            }),
        shape = cardShape,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f),
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (isMultiSelect) {
                Checkbox(
                    checked = isSelected,
                    onCheckedChange = { onToggleSelect() },
                    modifier = Modifier.padding(end = 12.dp),
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = record.formattedDate(),
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                Spacer(Modifier.height(4.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    // Type Badge
                    BackupTypeBadge(record.backupType)

                    // Size Badge
                    Text(
                        text = "·",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = record.formattedSize(),
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    if (record.settingsCount > 0) {
                        Text(
                            text = "·",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = "${record.settingsCount} settings",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            if (!isMultiSelect) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    FilledTonalButton(
                        onClick = onRestore,
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                            contentColor = MaterialTheme.colorScheme.primary,
                        ),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Restore,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "Restore",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                        )
                    }

                    IconButton(onClick = onDelete) {
                        Icon(
                            imageVector = Icons.Rounded.DeleteOutline,
                            contentDescription = "Delete",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BackupTypeBadge(
    type: BackupType,
    modifier: Modifier = Modifier,
) {
    val (label, containerColor, textColor) = when (type) {
        BackupType.AUTOMATIC -> Triple(
            "Automatic",
            MaterialTheme.colorScheme.tertiary.copy(alpha = 0.15f),
            MaterialTheme.colorScheme.tertiary,
        )
        BackupType.MANUAL -> Triple(
            "Manual",
            MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
            MaterialTheme.colorScheme.primary,
        )
        BackupType.SAFETY_CHECKPOINT -> Triple(
            "Checkpoint",
            MaterialTheme.colorScheme.secondary.copy(alpha = 0.15f),
            MaterialTheme.colorScheme.secondary,
        )
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(containerColor)
            .padding(horizontal = 7.dp, vertical = 2.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp, fontWeight = FontWeight.Medium),
            color = textColor,
        )
    }
}

