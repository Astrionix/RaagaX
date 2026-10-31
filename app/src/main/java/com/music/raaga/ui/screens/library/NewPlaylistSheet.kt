package com.music.raaga.ui.screens.library

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.music.raaga.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewPlaylistSheet(
    onDismiss: () -> Unit,
    onCreate: (title: String, description: String, isPublic: Boolean) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var isPublic by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color(0xFF1C1C1E),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Header Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onDismiss) {
                    Text(
                        text = stringResource(R.string.cancel),
                        color = RaagaAccentRed,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
                Text(
                    text = stringResource(R.string.new_playlist),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White,
                )
                TextButton(
                    onClick = {
                        val trimmed = title.trim()
                        if (trimmed.isNotEmpty()) {
                            onCreate(trimmed, description.trim(), isPublic)
                            onDismiss()
                        }
                    },
                    enabled = title.isNotBlank(),
                ) {
                    Text(
                        text = stringResource(R.string.done),
                        color = if (title.isNotBlank()) RaagaAccentRed else TextSecondaryGrey,
                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            // Artwork Camera Box
            Box(
                modifier = Modifier
                    .size(140.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(AmoledCardBackground)
                    .clickable { /* Select artwork */ },
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Rounded.CameraAlt,
                        contentDescription = "Add Artwork",
                        tint = RaagaAccentRed,
                        modifier = Modifier.size(36.dp),
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            // Playlist Title Input
            TextField(
                value = title,
                onValueChange = { title = it },
                placeholder = {
                    Text(
                        text = stringResource(R.string.title),
                        color = TextSecondaryGrey,
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                },
                singleLine = true,
                textStyle = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    textAlign = TextAlign.Center,
                ),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = RaagaAccentRed,
                    unfocusedIndicatorColor = AmoledBorderColor,
                    cursorColor = RaagaAccentRed,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 48.dp),
            )

            Spacer(Modifier.height(16.dp))

            // Description Input (Optional)
            TextField(
                value = description,
                onValueChange = { description = it },
                placeholder = {
                    Text(
                        text = "Description (optional)",
                        color = TextSecondaryGrey,
                        fontSize = 14.sp,
                    )
                },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    cursorColor = RaagaAccentRed,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
            )

            HorizontalDivider(
                thickness = 0.5.dp,
                color = AmoledBorderColor,
                modifier = Modifier.padding(horizontal = 32.dp, vertical = 8.dp),
            )

            // Show on Profile & Search Switch
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = stringResource(R.string.show_on_profile_search),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White,
                )
                Switch(
                    checked = isPublic,
                    onCheckedChange = { isPublic = it },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = RaagaAccentRed,
                        uncheckedThumbColor = Color(0xFFB3B3B3),
                        uncheckedTrackColor = AmoledCardBackground,
                    ),
                )
            }
        }
    }
}

