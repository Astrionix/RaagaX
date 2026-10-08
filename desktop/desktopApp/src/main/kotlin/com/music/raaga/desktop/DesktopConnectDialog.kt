package com.music.raaga.desktop

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Speaker
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.music.raaga.data.connect.ConnectDevice
import com.music.raaga.data.connect.ConnectDeviceType

private val ConnectGreen = Color(0xFF1DB954)
private val RowShape = RoundedCornerShape(12.dp)

/**
 * Desktop modal dialog for Raaga Connect & device management.
 */
@Composable
internal fun DesktopConnectDialog(onDismiss: () -> Unit) {
    DesktopDialogPanel(onDismiss = onDismiss, maxWidth = 480) {
        ConnectDeviceContent(
            modifier = Modifier
                .padding(horizontal = panelInset(22.dp), vertical = 20.dp)
                .heightIn(max = 560.dp),
            showHeader = true,
            onDismiss = onDismiss,
        )
    }
}

/**
 * Side panel column for Raaga Connect, displayed beside the page just like
 * the Queue and Lyrics side panels.
 */
@Composable
internal fun ConnectSidePanel(modifier: Modifier = Modifier) {
    ConnectDeviceContent(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 6.dp, vertical = 6.dp),
        showHeader = false,
        onDismiss = null,
    )
}

/**
 * Main content body for Raaga Connect & device discovery.
 */
@Composable
internal fun ConnectDeviceContent(
    modifier: Modifier = Modifier,
    showHeader: Boolean = true,
    onDismiss: (() -> Unit)? = null,
) {
    val connectManager = DesktopConnect.manager
    val activeRemote by connectManager.activeRemoteDevice.collectAsState()
    val remoteStatus by connectManager.remoteStatus.collectAsState()
    val pairedDevicesWithStatus by connectManager.pairedDevicesWithStatus.collectAsState()
    val unpairedDevices by connectManager.unpairedDiscoveredDevices.collectAsState()
    val activePairCode by connectManager.activePairCode.collectAsState()
    val pairingFeedback by connectManager.pairingFeedback.collectAsState()
    val isPairingSubmitting by connectManager.isPairingSubmitting.collectAsState()
    val connectingDeviceId by connectManager.connectingDeviceId.collectAsState()
    val controlledByDevice by DesktopConnect.controlledByDeviceName.collectAsState()

    var showPairingCard by remember { mutableStateOf(false) }
    var pairTab by remember { mutableIntStateOf(0) } // 0 = Show Code, 1 = Enter Code
    var enteredCode by remember { mutableStateOf("") }

    val localDeviceName by connectManager.currentDeviceName.collectAsState()
    var isEditingName by remember { mutableStateOf(false) }
    var editedName by remember(localDeviceName) { mutableStateOf(localDeviceName) }

    val selectedAudio by DesktopAudioDevices.selected.collectAsState()
    val audioChanges by DesktopAudioDevices.changes.collectAsState()
    val audioDevices = remember(audioChanges) { DesktopAudioDevices.available() }

    LaunchedEffect(Unit) {
        connectManager.refreshDiscovery()
    }

    Column(
        modifier = modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // Header (only shown if requested, since side panel column has its own header)
        if (showHeader) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(ConnectGreen.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Devices,
                            contentDescription = null,
                            tint = ConnectGreen,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Column {
                        Text(
                            text = DesktopStrings["connect_to_device", "Connect to a device"],
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            text = if (activeRemote != null) "Playing remotely on ${activeRemote?.name}" else "Listen across Phone, PC & Speakers",
                            style = MaterialTheme.typography.bodySmall,
                            color = DesktopSecondary,
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(
                        onClick = { connectManager.refreshDiscovery() },
                        modifier = Modifier.size(32.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Refresh,
                            contentDescription = "Refresh",
                            tint = DesktopSecondary,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    if (onDismiss != null) {
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.size(32.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Close,
                                contentDescription = "Close",
                                tint = DesktopSecondary,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                }
            }
        }

        // Active Remote Controller Banner (if currently controlling another device)
        if (activeRemote != null) {
            val remote = activeRemote!!
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RowShape)
                    .background(ConnectGreen.copy(alpha = 0.15f))
                    .border(1.dp, ConnectGreen.copy(alpha = 0.4f), RowShape)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(ConnectGreen),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = when (remote.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = Color.Black,
                            modifier = Modifier.size(20.dp),
                        )
                    }

                    Spacer(Modifier.width(12.dp))

                    Column(Modifier.weight(1f)) {
                        Text(
                            text = remote.name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        val track = remoteStatus?.track
                        val caption = if (track != null) "${track.title} • ${track.artist}" else "Remote playback active"
                        Text(
                            text = caption,
                            style = MaterialTheme.typography.bodySmall,
                            color = ConnectGreen,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    // Play/Pause button for remote
                    IconButton(
                        onClick = { connectManager.sendToggle() },
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.15f)),
                    ) {
                        val isPlaying = remoteStatus?.isPlaying ?: true
                        Icon(
                            imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }

                // Button to transfer playback back to PC
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable {
                            connectManager.transferBackToThisDevice()
                        }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Play on this computer instead",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                    )
                }
            }
        } else {
            // CURRENT LOCAL DEVICE CARD
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RowShape)
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(ConnectGreen.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Tv,
                        contentDescription = null,
                        tint = ConnectGreen,
                        modifier = Modifier.size(20.dp),
                    )
                }

                Spacer(Modifier.width(12.dp))

                Column(Modifier.weight(1f)) {
                    if (isEditingName) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            BasicTextField(
                                value = editedName,
                                onValueChange = { editedName = it },
                                textStyle = MaterialTheme.typography.bodyMedium.copy(
                                    color = Color.White,
                                    fontWeight = FontWeight.SemiBold,
                                ),
                                singleLine = true,
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                            )
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(ConnectGreen)
                                    .clickable {
                                        connectManager.updateDeviceName(editedName)
                                        isEditingName = false
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Rounded.Check,
                                    contentDescription = "Save",
                                    tint = Color.Black,
                                    modifier = Modifier.size(14.dp),
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.1f))
                                    .clickable {
                                        editedName = localDeviceName
                                        isEditingName = false
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Rounded.Close,
                                    contentDescription = "Cancel",
                                    tint = Color.White,
                                    modifier = Modifier.size(14.dp),
                                )
                            }
                        }
                    } else {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                text = localDeviceName,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false),
                            )
                            Icon(
                                imageVector = Icons.Rounded.Edit,
                                contentDescription = "Edit device name",
                                tint = Color.White.copy(alpha = 0.45f),
                                modifier = Modifier
                                    .size(14.dp)
                                    .clickable {
                                        editedName = localDeviceName
                                        isEditingName = true
                                    },
                            )
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.GraphicEq,
                            contentDescription = null,
                            tint = ConnectGreen,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(5.dp))
                        val statusDesc = if (controlledByDevice != null) {
                            "Listening on this computer • Controlled by $controlledByDevice"
                        } else {
                            "Listening on this computer"
                        }
                        Text(
                            text = statusDesc,
                            style = MaterialTheme.typography.bodySmall,
                            color = ConnectGreen,
                        )
                    }
                }
            }
        }

        // Pair Device button and Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "PAIRING & DISCOVERY",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = DesktopSecondary,
                    letterSpacing = 1.2.sp,
                )
                if (!showHeader) {
                    IconButton(
                        onClick = { connectManager.refreshDiscovery() },
                        modifier = Modifier.size(22.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Refresh,
                            contentDescription = "Refresh",
                            tint = DesktopSecondary,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }

            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(if (showPairingCard) ConnectGreen else ConnectGreen.copy(alpha = 0.16f))
                    .clickable {
                        showPairingCard = !showPairingCard
                        if (showPairingCard && activePairCode == null) {
                            connectManager.generatePairCode()
                        }
                    }
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(
                        imageVector = if (showPairingCard) Icons.Rounded.Close else Icons.Rounded.Key,
                        contentDescription = null,
                        tint = if (showPairingCard) Color.Black else ConnectGreen,
                        modifier = Modifier.size(13.dp),
                    )
                    Text(
                        text = if (showPairingCard) "Close" else "Pair Device",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (showPairingCard) Color.Black else ConnectGreen,
                    )
                }
            }
        }

        // Pairing Card (6-Digit PIN)
        AnimatedVisibility(visible = showPairingCard, enter = fadeIn(), exit = fadeOut()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RowShape)
                    .background(Color(0xFF18181A))
                    .border(1.dp, ConnectGreen.copy(alpha = 0.35f), RowShape)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // Switcher tabs
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.07f))
                        .padding(3.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .background(if (pairTab == 0) ConnectGreen else Color.Transparent)
                            .clickable {
                                pairTab = 0
                                if (activePairCode == null) connectManager.generatePairCode()
                            }
                            .padding(vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Show Code",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (pairTab == 0) Color.Black else Color.White.copy(alpha = 0.7f),
                        )
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .background(if (pairTab == 1) ConnectGreen else Color.Transparent)
                            .clickable { pairTab = 1 }
                            .padding(vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Enter Code",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (pairTab == 1) Color.Black else Color.White.copy(alpha = 0.7f),
                        )
                    }
                }

                if (pairTab == 0) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "Enter this code in Raaga on your phone or other device:",
                            style = MaterialTheme.typography.bodySmall,
                            color = DesktopSecondary,
                            textAlign = TextAlign.Center,
                        )

                        val code = activePairCode ?: "------"
                        val formattedCode = if (code.length == 6) {
                            "${code.substring(0, 3)} - ${code.substring(3)}"
                        } else {
                            code
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.Black.copy(alpha = 0.5f))
                                .border(1.dp, ConnectGreen.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = formattedCode,
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.ExtraBold,
                                color = ConnectGreen,
                                letterSpacing = 4.sp,
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = "Expires in 5 minutes",
                                style = MaterialTheme.typography.labelSmall,
                                color = DesktopSecondary,
                            )
                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(Color.White.copy(alpha = 0.1f))
                                    .clickable { connectManager.generatePairCode() }
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                            ) {
                                Text(
                                    text = "New Code",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.White,
                                )
                            }
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = "Enter the 6-digit code displayed on your other device:",
                            style = MaterialTheme.typography.bodySmall,
                            color = DesktopSecondary,
                            textAlign = TextAlign.Center,
                        )

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.Black.copy(alpha = 0.5f))
                                .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(10.dp))
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            BasicTextField(
                                value = enteredCode,
                                onValueChange = {
                                    val digitsOnly = it.filter { c -> c.isDigit() }
                                    if (digitsOnly.length <= 6) enteredCode = digitsOnly
                                },
                                textStyle = TextStyle(
                                    color = Color.White,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center,
                                    letterSpacing = 5.sp,
                                ),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth(),
                            )
                            if (enteredCode.isEmpty()) {
                                Text(
                                    text = "000000",
                                    style = TextStyle(
                                        color = Color.White.copy(alpha = 0.2f),
                                        fontSize = 22.sp,
                                        fontWeight = FontWeight.Bold,
                                        textAlign = TextAlign.Center,
                                        letterSpacing = 5.sp,
                                    ),
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }

                        val canSubmit = enteredCode.length == 6 && !isPairingSubmitting
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(CircleShape)
                                .background(if (canSubmit) ConnectGreen else Color.White.copy(alpha = 0.12f))
                                .clickable(enabled = canSubmit) {
                                    connectManager.submitPairCode(enteredCode)
                                }
                                .padding(vertical = 9.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = if (isPairingSubmitting) "Connecting..." else "Pair Device",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (canSubmit) Color.Black else Color.White.copy(alpha = 0.4f),
                            )
                        }
                    }
                }

                if (pairingFeedback != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(ConnectGreen.copy(alpha = 0.15f))
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = pairingFeedback!!,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = ConnectGreen,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }

        // PAIRED DEVICES LIST
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "PAIRED DEVICES (${pairedDevicesWithStatus.size})",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = DesktopSecondary,
                letterSpacing = 1.2.sp,
            )

            if (pairedDevicesWithStatus.isEmpty()) {
                Text(
                    text = "No paired devices yet. Click 'Pair Device' above to link your Phone or PC.",
                    style = MaterialTheme.typography.bodySmall,
                    color = DesktopSecondary.copy(alpha = 0.7f),
                    modifier = Modifier.padding(vertical = 4.dp),
                )
            } else {
                pairedDevicesWithStatus.forEach { item ->
                    val paired = item.paired
                    val isOnline = item.isOnline
                    val onlineDev = item.onlineDevice
                    val isConnecting = connectingDeviceId == paired.id
                    val isCurrentlyActive = activeRemote?.id == paired.id

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RowShape)
                            .background(if (isCurrentlyActive) ConnectGreen.copy(alpha = 0.14f) else Color.White.copy(alpha = 0.04f))
                            .clickable(enabled = isOnline && !isCurrentlyActive && !isConnecting) {
                                if (onlineDev != null) {
                                    connectManager.transferLocalPlaybackTo(onlineDev)
                                }
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = when (paired.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = if (isOnline) ConnectGreen else DesktopSecondary,
                            modifier = Modifier.size(22.dp),
                        )

                        Spacer(Modifier.width(12.dp))

                        Column(Modifier.weight(1f)) {
                            Text(
                                text = paired.name,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isOnline) Color.White else Color.White.copy(alpha = 0.6f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            val statusText = when {
                                isConnecting -> "Connecting to ${paired.name}..."
                                isCurrentlyActive -> "Playing remotely"
                                isOnline -> "Online on Wi-Fi (Click to play)"
                                else -> "Offline"
                            }
                            Text(
                                text = statusText,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (isConnecting || isCurrentlyActive || isOnline) ConnectGreen else DesktopSecondary,
                            )
                        }

                        if (isConnecting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = ConnectGreen,
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.width(6.dp))
                        }

                        IconButton(
                            onClick = { connectManager.unpairDevice(paired.id) },
                            modifier = Modifier.size(28.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.DeleteOutline,
                                contentDescription = "Unpair",
                                tint = DesktopSecondary.copy(alpha = 0.6f),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }
            }
        }

        // NEARBY UNPAIRED DEVICES
        if (unpairedDevices.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "NEARBY WI-FI DEVICES (${unpairedDevices.size})",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = DesktopSecondary,
                    letterSpacing = 1.2.sp,
                )

                unpairedDevices.forEach { device ->
                    val isConnecting = connectingDeviceId == device.id
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RowShape)
                            .background(Color.White.copy(alpha = 0.04f))
                            .clickable(enabled = !isConnecting) {
                                connectManager.pairDeviceDirectly(device)
                                connectManager.transferLocalPlaybackTo(device)
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = when (device.type) {
                                ConnectDeviceType.PHONE -> Icons.Rounded.PhoneAndroid
                                ConnectDeviceType.DESKTOP -> Icons.Rounded.Tv
                                ConnectDeviceType.SPEAKER -> Icons.Rounded.Speaker
                            },
                            contentDescription = null,
                            tint = ConnectGreen,
                            modifier = Modifier.size(22.dp),
                        )

                        Spacer(Modifier.width(12.dp))

                        Column(Modifier.weight(1f)) {
                            Text(
                                text = device.name,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            val statusText = if (isConnecting) {
                                "Connecting to ${device.name}..."
                            } else {
                                "Discovered on Wi-Fi • Click to connect"
                            }
                            Text(
                                text = statusText,
                                style = MaterialTheme.typography.bodySmall,
                                color = ConnectGreen,
                            )
                        }

                        if (isConnecting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = ConnectGreen,
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.width(6.dp))
                        }
                    }
                }
            }
        }

        HorizontalDivider(
            thickness = 1.dp,
            color = Color.White.copy(alpha = 0.08f),
        )

        // HARDWARE AUDIO OUTPUT ROUTING
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = DesktopStrings["audio_output", "AUDIO OUTPUT HARDWARE"],
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = DesktopSecondary,
                letterSpacing = 1.2.sp,
            )

            // System Default
            AudioRow(
                name = DesktopStrings["d_system_default", "System default"],
                description = "Operating system default audio route",
                chosen = selectedAudio == DesktopAudioDevices.SYSTEM_DEFAULT,
            ) {
                DesktopAudioDevices.select(DesktopAudioDevices.SYSTEM_DEFAULT)
            }

            // Available hardware endpoints
            audioDevices.forEach { dev ->
                AudioRow(
                    name = dev.name,
                    description = dev.description,
                    chosen = selectedAudio == dev.id,
                ) {
                    DesktopAudioDevices.select(dev.id)
                }
            }
        }
    }
}

@Composable
private fun AudioRow(
    name: String,
    description: String,
    chosen: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RowShape)
            .desktopRowClickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Rounded.Headphones,
            contentDescription = null,
            tint = if (chosen) ConnectGreen else DesktopSecondary,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (chosen) FontWeight.SemiBold else FontWeight.Normal,
                color = if (chosen) Color.White else Color.White.copy(alpha = 0.8f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (description.isNotBlank()) {
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = DesktopSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (chosen) {
            Spacer(Modifier.width(8.dp))
            Icon(
                imageVector = Icons.Rounded.Check,
                contentDescription = null,
                tint = ConnectGreen,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
