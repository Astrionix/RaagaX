package com.music.raaga.data.connect

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/**
 * HTTP client for communicating with remote Raaga Connect receivers from Desktop.
 * Supports legacy single-shot transfers, transactional Two-Phase Commit handoffs,
 * authenticated control, and high-precision monotonic clock calibration.
 * All mutating requests are authenticated with HMAC-SHA256 signatures, device IDs, and timestamps.
 */
object RaagaConnectClient {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    @Volatile
    var accountIdProvider: () -> String? = { null }

    private fun sha256Hex(input: String): String {
        return try {
            val md = java.security.MessageDigest.getInstance("SHA-256")
            val bytes = md.digest(input.toByteArray(StandardCharsets.UTF_8))
            bytes.joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            input.hashCode().toString()
        }
    }

    private fun applyAuthHeaders(
        conn: HttpURLConnection,
        method: String = "GET",
        path: String = "",
        body: String = "",
    ) {
        conn.setRequestProperty("X-Raaga-Device-Id", RaagaPairingStore.deviceId)
        val account = accountIdProvider()?.trim()
        if (!account.isNullOrBlank()) {
            conn.setRequestProperty("X-Raaga-Account-Hash", sha256Hex(account).take(16))
        }
        val syncKey = RaagaPairingStore.getSyncKey()
        if (!syncKey.isNullOrBlank()) {
            val timestamp = System.currentTimeMillis().toString()
            val payload = RaagaConnectSecurity.buildSignaturePayload(method, path, timestamp, body)
            val signature = RaagaConnectSecurity.computeHmacSha256(syncKey, payload)
            conn.setRequestProperty("X-Raaga-Timestamp", timestamp)
            if (signature.isNotBlank()) {
                conn.setRequestProperty("X-Raaga-Signature", signature)
            }
            conn.setRequestProperty("X-Raaga-Sync-Key", syncKey)
        }
    }

    suspend fun clockSync(
        device: ConnectDevice,
        clientSendMs: Long,
        clientDeviceId: String = "",
    ): Result<ConnectClockSyncResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val req = ConnectClockSyncRequest(clientSendMs = clientSendMs, clientDeviceId = clientDeviceId.ifBlank { RaagaPairingStore.deviceId })
            val body = json.encodeToString(req)

            val url = URL("http://${device.host}:${device.port}/raaga-connect/time-sync")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 1500
                readTimeout = 1500
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                applyAuthHeaders(this, "POST", "/raaga-connect/time-sync", body)
            }

            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            if (responseCode !in 200..299) {
                conn.disconnect()
                error("Clock sync failed with HTTP $responseCode")
            }

            val respBody = BufferedReader(InputStreamReader(conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
            conn.disconnect()
            json.decodeFromString<ConnectClockSyncResponse>(respBody)
        }
    }

    suspend fun handoffPrepare(
        device: ConnectDevice,
        packet: ConnectHandoffPacket,
    ): Result<ConnectHandoffPacket> = withContext(Dispatchers.IO) {
        runCatching {
            val signedPacket = if (packet.syncKey.isNullOrBlank()) {
                packet.copy(syncKey = RaagaPairingStore.getSyncKey())
            } else packet
            val body = json.encodeToString(signedPacket)

            val url = URL("http://${device.host}:${device.port}/raaga-connect/handoff/prepare")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 5000
                readTimeout = 5000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                applyAuthHeaders(this, "POST", "/raaga-connect/handoff/prepare", body)
            }

            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            if (responseCode !in 200..299) {
                val errBody = runCatching {
                    BufferedReader(InputStreamReader(conn.errorStream ?: conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
                }.getOrNull()
                conn.disconnect()
                error("Handoff prepare failed (HTTP $responseCode): $errBody")
            }

            val respBody = BufferedReader(InputStreamReader(conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
            conn.disconnect()
            json.decodeFromString<ConnectHandoffPacket>(respBody)
        }
    }

    suspend fun handoffCommit(
        device: ConnectDevice,
        packet: ConnectHandoffPacket,
    ): Result<ConnectHandoffPacket> = withContext(Dispatchers.IO) {
        runCatching {
            val signedPacket = if (packet.syncKey.isNullOrBlank()) {
                packet.copy(syncKey = RaagaPairingStore.getSyncKey())
            } else packet
            val body = json.encodeToString(signedPacket)

            val url = URL("http://${device.host}:${device.port}/raaga-connect/handoff/commit")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 3000
                readTimeout = 3000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                applyAuthHeaders(this, "POST", "/raaga-connect/handoff/commit", body)
            }

            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            if (responseCode !in 200..299) {
                val errBody = runCatching {
                    BufferedReader(InputStreamReader(conn.errorStream ?: conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
                }.getOrNull()
                conn.disconnect()
                error("Handoff commit failed (HTTP $responseCode): $errBody")
            }

            val respBody = BufferedReader(InputStreamReader(conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
            conn.disconnect()
            json.decodeFromString<ConnectHandoffPacket>(respBody)
        }
    }

    suspend fun handoffAbort(
        device: ConnectDevice,
        packet: ConnectHandoffPacket,
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val signedPacket = if (packet.syncKey.isNullOrBlank()) {
                packet.copy(syncKey = RaagaPairingStore.getSyncKey())
            } else packet
            val body = json.encodeToString(signedPacket)

            val url = URL("http://${device.host}:${device.port}/raaga-connect/handoff/abort")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 2000
                readTimeout = 2000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                applyAuthHeaders(this, "POST", "/raaga-connect/handoff/abort", body)
            }

            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            conn.disconnect()
            responseCode in 200..299
        }
    }

    suspend fun transferPlayback(
        device: ConnectDevice,
        transfer: ConnectPlaybackTransfer,
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val signed = if (transfer.syncKey.isNullOrBlank()) {
                transfer.copy(syncKey = RaagaPairingStore.getSyncKey())
            } else transfer
            val body = json.encodeToString(signed)

            val url = URL("http://${device.host}:${device.port}/raaga-connect/transfer")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 4000
                readTimeout = 4000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                applyAuthHeaders(this, "POST", "/raaga-connect/transfer", body)
            }

            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            conn.disconnect()
            responseCode in 200..299
        }
    }

    suspend fun sendControl(
        device: ConnectDevice,
        command: ConnectControlCommand,
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val signed = if (command.syncKey.isNullOrBlank()) {
                command.copy(syncKey = RaagaPairingStore.getSyncKey())
            } else command
            val body = json.encodeToString(signed)

            val url = URL("http://${device.host}:${device.port}/raaga-connect/control")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 3000
                readTimeout = 3000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                applyAuthHeaders(this, "POST", "/raaga-connect/control", body)
            }

            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            conn.disconnect()
            responseCode in 200..299
        }
    }

    suspend fun queryStatus(device: ConnectDevice): Result<ConnectDeviceStatus> = withContext(Dispatchers.IO) {
        runCatching {
            val url = URL("http://${device.host}:${device.port}/raaga-connect/info")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 3000
                readTimeout = 3000
                setRequestProperty("Accept", "application/json")
                applyAuthHeaders(this, "GET", "/raaga-connect/info", "")
            }

            val responseCode = conn.responseCode
            if (responseCode !in 200..299) {
                conn.disconnect()
                error("Status query failed with HTTP $responseCode")
            }

            val body = BufferedReader(InputStreamReader(conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
            conn.disconnect()
            json.decodeFromString<ConnectDeviceStatus>(body)
        }
    }

    suspend fun pair(
        device: ConnectDevice,
        request: ConnectPairRequest,
    ): Result<ConnectPairResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val body = json.encodeToString(request)
            val url = URL("http://${device.host}:${device.port}/raaga-connect/pair")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 4000
                readTimeout = 4000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                applyAuthHeaders(this, "POST", "/raaga-connect/pair", body)
            }

            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            if (responseCode !in 200..299) {
                error("Direct LAN pairing failed with HTTP $responseCode")
            }

            val respBody = BufferedReader(InputStreamReader(conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
            conn.disconnect()
            json.decodeFromString<ConnectPairResponse>(respBody)
        }
    }
}
