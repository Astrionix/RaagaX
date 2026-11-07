package com.music.raaga.auth

import android.content.Context
import android.content.SharedPreferences
import android.os.SystemClock
import com.music.raaga.data.connect.AndroidConnect
import com.music.raaga.data.discord.DiscordRPC
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.security.SecureRandom
import kotlin.math.pow

sealed class PinVerifyResult {
    object Success : PinVerifyResult()
    data class Failure(val remainingAttempts: Int) : PinVerifyResult()
    data class LockedOut(val waitSeconds: Long) : PinVerifyResult()
}

/**
 * SHA-256 + Salt PIN security for profiles with exponential backoff throttling
 * and automatic external session teardown (Discord RPC, Raaga Connect).
 */
object ProfilePinSecurity {

    private const val PREFS_NAME = "raaga_profile_pin_sec"
    private const val KEY_PIN_PREFIX = "pin_hash_"
    private const val KEY_SALT_PREFIX = "pin_salt_"

    private lateinit var prefs: SharedPreferences
    private val failedAttempts = mutableMapOf<String, Int>()
    private val lockoutUntil = mutableMapOf<String, Long>()

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun isPinSet(profileId: String): Boolean {
        if (!::prefs.isInitialized || profileId.isBlank()) return false
        return prefs.contains(KEY_PIN_PREFIX + profileId)
    }

    fun setPin(profileId: String, pin: String) {
        if (!::prefs.isInitialized || profileId.isBlank() || pin.isBlank()) return
        val salt = generateSalt()
        val hash = hashPin(pin, salt)
        prefs.edit()
            .putString(KEY_SALT_PREFIX + profileId, salt)
            .putString(KEY_PIN_PREFIX + profileId, hash)
            .apply()
        failedAttempts.remove(profileId)
        lockoutUntil.remove(profileId)
    }

    fun removePin(profileId: String) {
        if (!::prefs.isInitialized || profileId.isBlank()) return
        prefs.edit()
            .remove(KEY_SALT_PREFIX + profileId)
            .remove(KEY_PIN_PREFIX + profileId)
            .apply()
        failedAttempts.remove(profileId)
        lockoutUntil.remove(profileId)
    }

    fun verifyPin(profileId: String, inputPin: String): PinVerifyResult {
        if (!isPinSet(profileId)) return PinVerifyResult.Success

        val now = SystemClock.elapsedRealtime()
        val lockedTime = lockoutUntil[profileId] ?: 0L
        if (now < lockedTime) {
            val remainingSec = ((lockedTime - now) / 1000L).coerceAtLeast(1L)
            return PinVerifyResult.LockedOut(remainingSec)
        }

        val salt = prefs.getString(KEY_SALT_PREFIX + profileId, "") ?: ""
        val expectedHash = prefs.getString(KEY_PIN_PREFIX + profileId, "") ?: ""
        val actualHash = hashPin(inputPin, salt)

        return if (actualHash == expectedHash && expectedHash.isNotEmpty()) {
            failedAttempts.remove(profileId)
            lockoutUntil.remove(profileId)
            PinVerifyResult.Success
        } else {
            val count = (failedAttempts[profileId] ?: 0) + 1
            failedAttempts[profileId] = count
            if (count >= 3) {
                val backoffSec = (2.0.pow(count - 3) * 2.0).toLong().coerceIn(2L, 30L)
                lockoutUntil[profileId] = now + (backoffSec * 1000L)
                PinVerifyResult.LockedOut(backoffSec)
            } else {
                PinVerifyResult.Failure(3 - count)
            }
        }
    }

    /**
     * Automatic teardown of external sync and RPC sessions upon profile sign-out or switch.
     */
    fun teardownExternalSessions(context: Context) {
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                // 1. Disconnect Raaga Connect / Party mesh session
                AndroidConnect.manager.transferBackToThisDevice()
            }
            runCatching {
                // 2. Clear Discord RPC presence
                val token = AuthStore(context).discordToken
                if (!token.isNullOrBlank()) {
                    val rpc = DiscordRPC(context, token)
                    rpc.close()
                    rpc.closeRPC()
                }
            }
        }
    }

    private fun generateSalt(): String {
        val random = SecureRandom()
        val bytes = ByteArray(16)
        random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun hashPin(pin: String, salt: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        val combined = "$salt:$pin".toByteArray(Charsets.UTF_8)
        val digest = md.digest(combined)
        return digest.joinToString("") { "%02x".format(it) }
    }
}
