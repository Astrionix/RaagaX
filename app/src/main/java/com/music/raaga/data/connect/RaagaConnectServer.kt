package com.music.raaga.data.connect

import com.music.raaga.data.MonotonicClock
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Collections
import java.util.LinkedHashMap

/**
 * Embedded HTTP server for Raaga Connect receiver on Android local network.
 * Handles incoming playback transfer requests, Two-Phase Commit handoffs,
 * monotonic clock calibration, authentication verification, and deduplicated control.
 *
 * Security:
 * - LAN bypass is disabled: devices on the same Wi-Fi must be explicitly paired or authenticated.
 * - State-mutating requests (transfer, handoff, control) must be signed with HMAC-SHA256
 *   using the shared sync key, or verified against paired device credentials.
 * - Silent auto-pairing on transfer is removed; devices can only be paired via explicit PIN handshake.
 */
class RaagaConnectServer(
    private val getStatus: () -> ConnectDeviceStatus,
    private val onTransfer: (ConnectPlaybackTransfer) -> Unit,
    private val onControl: (ConnectControlCommand) -> Unit,
    private val onHandoffPrepare: (suspend (ConnectHandoffPacket) -> ConnectHandoffPacket)? = null,
    private val onHandoffCommit: (suspend (ConnectHandoffPacket) -> ConnectHandoffPacket)? = null,
    private val onHandoffAbort: ((ConnectHandoffPacket) -> Unit)? = null,
    private val onPair: ((ConnectPairRequest) -> ConnectPairResponse)? = null,
    private val preferredPort: Int = 8895,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    private var serverSocket: ServerSocket? = null
    private var acceptJob: Job? = null

    // LRU deduplication cache for recent command IDs (capacity 64)
    private val processedCommandIds = Collections.newSetFromMap(
        Collections.synchronizedMap(
            object : LinkedHashMap<String, Boolean>(64, 0.75f, true) {
                override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Boolean>?): Boolean = size > 64
            }
        )
    )

    val port: Int get() = serverSocket?.localPort ?: preferredPort
    val isRunning: Boolean get() = serverSocket?.isClosed == false && acceptJob?.isActive == true

    fun start(): Int {
        if (isRunning) return port

        // Try preferred port, or scan up to 10 ports
        var boundSocket: ServerSocket? = null
        for (candidate in preferredPort..(preferredPort + 10)) {
            try {
                boundSocket = ServerSocket(candidate)
                break
            } catch (_: Exception) {}
        }

        if (boundSocket == null) {
            boundSocket = ServerSocket(0) // Bind any available port
        }

        serverSocket = boundSocket

        acceptJob = scope.launch {
            while (isActive && !boundSocket.isClosed) {
                try {
                    val client = boundSocket.accept()
                    launch { handleClient(client) }
                } catch (e: Exception) {
                    if (e is CancellationException || boundSocket.isClosed) break
                }
            }
        }

        return boundSocket.localPort
    }

    fun stop() {
        try {
            acceptJob?.cancel()
            serverSocket?.close()
        } catch (_: Exception) {}
        serverSocket = null
    }

    private fun isAuthorized(
        senderDeviceId: String,
        syncKey: String?,
        timestampStr: String,
        signature: String,
        method: String,
        path: String,
        body: String,
    ): Boolean {
        val pairedList = RaagaPairingStore.pairedDevices.value
        val localSyncKey = RaagaPairingStore.getSyncKey()

        // Discovered != Authorized: without pairing or sync key, reject mutating requests
        if (pairedList.isEmpty() && localSyncKey.isNullOrBlank()) {
            return false
        }

        val isPairedDevice = senderDeviceId.isNotBlank() && RaagaPairingStore.isPaired(senderDeviceId)

        // 1. Primary Security Check: HMAC-SHA256 signature verification with timestamp freshness
        if (!localSyncKey.isNullOrBlank() && signature.isNotBlank() && timestampStr.isNotBlank()) {
            if (!RaagaConnectSecurity.isTimestampFresh(timestampStr)) {
                return false // Replay attack or excessive clock drift (>60s)
            }
            val canonicalPayload = RaagaConnectSecurity.buildSignaturePayload(method, path, timestampStr, body)
            if (RaagaConnectSecurity.verifySignature(localSyncKey, canonicalPayload, signature)) {
                return true
            }
        }

        // 2. Fallback Security Check: Constant-time sync key comparison for paired devices
        if (!localSyncKey.isNullOrBlank() && !syncKey.isNullOrBlank()) {
            val keysMatch = MessageDigest.isEqual(
                localSyncKey.toByteArray(StandardCharsets.UTF_8),
                syncKey.toByteArray(StandardCharsets.UTF_8),
            )
            if (keysMatch && (isPairedDevice || pairedList.isEmpty())) {
                return true
            }
        }

        // 3. Fallback: If device is explicitly paired and no sync key was established yet
        if (isPairedDevice && localSyncKey.isNullOrBlank()) {
            return true
        }

        return false
    }

    private fun handleClient(socket: Socket) {
        socket.use { s ->
            s.soTimeout = 6000
            val reader = BufferedReader(InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8))
            val writer = OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8)

            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return

            val method = parts[0].uppercase()
            val path = parts[1]

            // Read headers to determine Content-Length, Sender Device ID, Sync Key, Timestamp, and HMAC Signature
            var contentLength = 0
            var senderDeviceId = ""
            var headerSyncKey = ""
            var headerTimestamp = ""
            var headerSignature = ""
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                if (line.isNullOrBlank()) break
                val header = line
                if (header.startsWith("Content-Length:", ignoreCase = true)) {
                    contentLength = header.substringAfter(":").trim().toIntOrNull() ?: 0
                } else if (header.startsWith("X-Raaga-Device-Id:", ignoreCase = true)) {
                    senderDeviceId = header.substringAfter(":").trim()
                } else if (header.startsWith("X-Raaga-Sync-Key:", ignoreCase = true)) {
                    headerSyncKey = header.substringAfter(":").trim()
                } else if (header.startsWith("X-Raaga-Timestamp:", ignoreCase = true)) {
                    headerTimestamp = header.substringAfter(":").trim()
                } else if (header.startsWith("X-Raaga-Signature:", ignoreCase = true)) {
                    headerSignature = header.substringAfter(":").trim()
                }
            }

            // Read body if POST
            val body = if (contentLength > 0) {
                val chars = CharArray(contentLength)
                var readTotal = 0
                while (readTotal < contentLength) {
                    val r = reader.read(chars, readTotal, contentLength - readTotal)
                    if (r == -1) break
                    readTotal += r
                }
                String(chars, 0, readTotal)
            } else ""

            when {
                method == "GET" && path.startsWith("/raaga-connect/info") -> {
                    val status = getStatus()
                    val jsonStr = json.encodeToString(status)
                    writeResponse(writer, 200, "OK", jsonStr)
                }

                method == "POST" && path.startsWith("/raaga-connect/time-sync") -> {
                    try {
                        val req = json.decodeFromString<ConnectClockSyncRequest>(body)
                        val recvMs = MonotonicClock.nowMs()
                        val sendMs = MonotonicClock.nowMs()
                        val resp = ConnectClockSyncResponse(
                            clientSendMs = req.clientSendMs,
                            serverReceiveMs = recvMs,
                            serverTransmitMs = sendMs,
                        )
                        writeResponse(writer, 200, "OK", json.encodeToString(resp))
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                method == "POST" && path.startsWith("/raaga-connect/pair") -> {
                    try {
                        val req = json.decodeFromString<ConnectPairRequest>(body)
                        val resp = onPair?.invoke(req)
                        if (resp != null) {
                            writeResponse(writer, 200, "OK", json.encodeToString(resp))
                        } else {
                            writeResponse(writer, 400, "Bad Request", """{"success":false,"message":"Pairing handler not available"}""")
                        }
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                method == "POST" && path.startsWith("/raaga-connect/handoff/prepare") -> {
                    try {
                        val packet = json.decodeFromString<ConnectHandoffPacket>(body)
                        val effectiveSenderId = senderDeviceId.ifBlank { packet.sourceDeviceId }
                        val effectiveSyncKey = headerSyncKey.ifBlank { packet.syncKey ?: "" }
                        if (!isAuthorized(effectiveSenderId, effectiveSyncKey, headerTimestamp, headerSignature, method, path, body)) {
                            writeResponse(writer, 401, "Unauthorized", """{"error":"Unauthorized device"}""")
                            return
                        }

                        val result = if (onHandoffPrepare != null) {
                            runBlocking { onHandoffPrepare.invoke(packet) }
                        } else {
                            packet.copy(phase = HandoffPhase.READY, bufferReadyDurationMs = 1500L)
                        }
                        val statusCode = if (result.phase == HandoffPhase.READY) 200 else 400
                        writeResponse(writer, statusCode, if (statusCode == 200) "OK" else "Bad Request", json.encodeToString(result))
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                method == "POST" && path.startsWith("/raaga-connect/handoff/commit") -> {
                    try {
                        val packet = json.decodeFromString<ConnectHandoffPacket>(body)
                        val effectiveSenderId = senderDeviceId.ifBlank { packet.sourceDeviceId }
                        val effectiveSyncKey = headerSyncKey.ifBlank { packet.syncKey ?: "" }
                        if (!isAuthorized(effectiveSenderId, effectiveSyncKey, headerTimestamp, headerSignature, method, path, body)) {
                            writeResponse(writer, 401, "Unauthorized", """{"error":"Unauthorized device"}""")
                            return
                        }

                        val result = if (onHandoffCommit != null) {
                            runBlocking { onHandoffCommit.invoke(packet) }
                        } else {
                            packet.copy(phase = HandoffPhase.CONFIRMED)
                        }
                        val statusCode = if (result.phase == HandoffPhase.CONFIRMED) 200 else 400
                        writeResponse(writer, statusCode, if (statusCode == 200) "OK" else "Bad Request", json.encodeToString(result))
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                method == "POST" && path.startsWith("/raaga-connect/handoff/abort") -> {
                    try {
                        val packet = json.decodeFromString<ConnectHandoffPacket>(body)
                        val effectiveSenderId = senderDeviceId.ifBlank { packet.sourceDeviceId }
                        val effectiveSyncKey = headerSyncKey.ifBlank { packet.syncKey ?: "" }
                        if (!isAuthorized(effectiveSenderId, effectiveSyncKey, headerTimestamp, headerSignature, method, path, body)) {
                            writeResponse(writer, 401, "Unauthorized", """{"error":"Unauthorized device"}""")
                            return
                        }

                        onHandoffAbort?.invoke(packet)
                        writeResponse(writer, 200, "OK", """{"success":true}""")
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                method == "POST" && path.startsWith("/raaga-connect/transfer") -> {
                    try {
                        val payload = json.decodeFromString<ConnectPlaybackTransfer>(body)
                        val effectiveSenderId = senderDeviceId.ifBlank { payload.sourceDeviceId }
                        val effectiveSyncKey = headerSyncKey.ifBlank { payload.syncKey ?: "" }
                        if (!isAuthorized(effectiveSenderId, effectiveSyncKey, headerTimestamp, headerSignature, method, path, body)) {
                            writeResponse(writer, 401, "Unauthorized", """{"error":"Unauthorized device"}""")
                            return
                        }

                        onTransfer(payload)
                        writeResponse(writer, 200, "OK", """{"success":true}""")
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                method == "POST" && path.startsWith("/raaga-connect/control") -> {
                    try {
                        val payload = json.decodeFromString<ConnectControlCommand>(body)
                        val effectiveSenderId = senderDeviceId.ifBlank { payload.senderDeviceId }
                        val effectiveSyncKey = headerSyncKey.ifBlank { payload.syncKey ?: "" }
                        if (!isAuthorized(effectiveSenderId, effectiveSyncKey, headerTimestamp, headerSignature, method, path, body)) {
                            writeResponse(writer, 401, "Unauthorized", """{"error":"Unauthorized device"}""")
                            return
                        }

                        if (payload.commandId.isNotBlank() && !processedCommandIds.add(payload.commandId)) {
                            // Idempotent duplicate: ack without re-executing
                            writeResponse(writer, 200, "OK", """{"success":true,"deduplicated":true}""")
                        } else {
                            onControl(payload)
                            writeResponse(writer, 200, "OK", """{"success":true}""")
                        }
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                else -> {
                    writeResponse(writer, 404, "Not Found", """{"error":"Not Found"}""")
                }
            }
        }
    }

    private fun writeResponse(writer: OutputStreamWriter, code: Int, message: String, jsonBody: String) {
        val bytes = jsonBody.toByteArray(StandardCharsets.UTF_8)
        writer.write("HTTP/1.1 $code $message\r\n")
        writer.write("Content-Type: application/json; charset=utf-8\r\n")
        writer.write("Content-Length: ${bytes.size}\r\n")
        writer.write("Access-Control-Allow-Origin: *\r\n")
        writer.write("Connection: close\r\n\r\n")
        writer.write(jsonBody)
        writer.flush()
    }
}
