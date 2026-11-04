package com.music.raaga.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import com.music.raaga.R

/**
 * Copies [text] to the Android system clipboard with a toast notification and haptic feedback.
 */
fun copyToClipboard(context: Context, text: String, toastMessage: String? = null) {
    if (text.isBlank()) return
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
    val clip = ClipData.newPlainText("Raaga", text)
    clipboard.setPrimaryClip(clip)
    val msg = toastMessage ?: context.getString(R.string.copied_to_clipboard, text)
    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
}

/**
 * Modifier that attaches a long-press handler to instantly copy [textToCopy] to the clipboard,
 * while preserving optional tap-to-navigate [onClick] behavior.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun Modifier.copyOnLongPress(
    textToCopy: String?,
    toastMessage: String? = null,
    onClick: (() -> Unit)? = null,
): Modifier {
    if (textToCopy.isNullOrBlank()) {
        return if (onClick != null) {
            clip(RoundedCornerShape(6.dp)).combinedClickable(onClick = onClick)
        } else {
            this
        }
    }
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current

    return clip(RoundedCornerShape(6.dp)).combinedClickable(
        onClick = { onClick?.invoke() },
        onLongClick = {
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            copyToClipboard(context, textToCopy, toastMessage)
        }
    )
}

