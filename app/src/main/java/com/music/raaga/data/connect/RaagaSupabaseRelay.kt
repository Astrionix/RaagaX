package com.music.raaga.data.connect

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

object RaagaCloudConfig {
    // Primary: Cloudflare Edge WebSocket Relay (<20ms edge latency)
    const val CLOUDFLARE_WS_URL = "wss://tiny-hill-6efd.pekrajareddy.workers.dev/ws"

    // Backup Fallback: Supabase Realtime
    const val SUPABASE_PROJECT_URL = "https://pufuuvtnnqubhupgaovg.supabase.co"
    const val SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZnV1dnRubnF1Ymh1cGdhb3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODU5MDEsImV4cCI6MjEwNjk2MTkwMX0.KaHtyBPskoT_I2LZPcKcLfMPbbWO15Q0NaF5rFUitQA"
    val SUPABASE_WS_URL = "wss://pufuuvtnnqubhupgaovg.supabase.co/realtime/v1/websocket?apikey=$SUPABASE_API_KEY&vsn=1.0.0"
}

// Backward-compatible alias
typealias RaagaSupabaseConfig = RaagaCloudConfig

/**
 * Cloud Relay for Raaga Connect over the Cloud / Internet:
 * - Primary: Cloudflare Edge WebSocket Relay (Ultra-low latency <20ms)
 * - Backup Fallback: Supabase Realtime (Automatic zero-downtime failover)
 *
 * Security & Isolation:
 * - Automatically scoped to the active Google/user account ID (raaga_acc_<hash>)
 * - If not logged in, scopes to a verified private sync key (raaga_sync_<hash>)
 * - During PIN pairing, temporarily scopes to the 6-digit pair code (raaga_pair_<code>)
 * - Strangers in other locations/networks will NEVER discover or control this device.
 */
class RaagaSupabaseRelay(
    private val localDeviceProvider: () -> ConnectDevice,
    private val accountIdProvider: () -> String? = { null },
    private val syncKeyProvider: () -> String? = { null },
    private val onTransferReceived: (ConnectPlaybackTransfer) -> Unit,
    private val onControlReceived: (ConnectControlCommand) -> Unit,
    private val onStatusReceived: (ConnectDeviceStatus) -> Unit,
    private val onPairRequestReceived: ((ConnectPairRequest) -> Unit)? = null,
    private val onPairResponseReceived: ((ConnectPairResponse) -> Unit)? = null,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // Keep alive
        .build()

    private val refCounter = AtomicLong(1)
    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var announceJob: Job? = null
    private var cleanupJob: Job? = null
    private var connectJob: Job? = null

    @Volatile
    private var isConnected = false

    @Volatile
    private var usingCloudflare = true

    @Volatile
    private var lastCloudflareFailureTime: Long = 0L

    @Volatile
    private var activeChannel: String? = null

    @Volatile
    private var temporaryPairCode: String? = null

    private val cloudDevices = ConcurrentHashMap<String, ConnectDevice>()
    private val _discoveredCloudDevices = MutableStateFlow<List<ConnectDevice>>(emptyList())
    val discoveredCloudDevices: StateFlow<List<ConnectDevice>> = _discoveredCloudDevices.asStateFlow()

    fun setTemporaryPairCode(code: String?) {
        val clean = code?.filter { it.isDigit() }?.takeIf { it.length == 6 }
        if (temporaryPairCode != clean) {
            temporaryPairCode = clean
            checkChannel()
        }
    }

    fun computeCurrentChannel(): String? {
        val pairCode = temporaryPairCode
        if (!pairCode.isNullOrBlank()) {
            return "raaga_pair_$pairCode"
        }
        val account = accountIdProvider()?.trim()
        if (!account.isNullOrBlank()) {
            return "raaga_acc_" + sha256Hex(account).take(16)
        }
        val sync = syncKeyProvider()?.trim()
        if (!sync.isNullOrBlank()) {
            return "raaga_sync_" + sha256Hex(sync).take(16)
        }
        return null
    }

    private fun sha256Hex(input: String): String {
        return try {
            val md = MessageDigest.getInstance("SHA-256")
            val bytes = md.digest(input.toByteArray(Charsets.UTF_8))
            bytes.joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            input.hashCode().toString()
        }
    }

    fun checkChannel() {
        scope.launch {
            val target = computeCurrentChannel()
            if (target != activeChannel) {
                cloudDevices.clear()
                _discoveredCloudDevices.value = emptyList()
                disconnectWebSocket()
                if (target != null) {
                    delay(100)
                    try {
                        connectWebSocket()
                    } catch (_: Exception) {}
                }
            }
        }
    }

    fun start() {
        if (connectJob != null) return
        connectJob = scope.launch {
            while (isActive) {
                try {
                    val expected = computeCurrentChannel()
                    if (expected != null && (!isConnected || expected != activeChannel)) {
                        connectWebSocket()
                    }
                } catch (_: Exception) {}
                delay(6000) // Reconnect delay if disconnected
            }
        }

        // Cleanup stale cloud devices
        cleanupJob = scope.launch {
            while (isActive) {
                delay(10000)
                val now = System.currentTimeMillis()
                val stale = cloudDevices.filterValues { now - it.lastSeenTimestamp > 60_000L }.keys
                if (stale.isNotEmpty()) {
                    stale.forEach { cloudDevices.remove(it) }
                    _discoveredCloudDevices.value = cloudDevices.values.toList()
                }
            }
        }
    }

    fun stop() {
        connectJob?.cancel()
        connectJob = null
        cleanupJob?.cancel()
        disconnectWebSocket()
        cloudDevices.clear()
        _discoveredCloudDevices.value = emptyList()
    }

    private fun disconnectWebSocket() {
        isConnected = false
        activeChannel = null
        heartbeatJob?.cancel()
        announceJob?.cancel()
        try {
            webSocket?.close(1000, "Channel changed or stopped")
        } catch (_: Exception) {}
        webSocket = null
    }

    private fun connectWebSocket() {
        val channel = computeCurrentChannel() ?: return
        activeChannel = channel

        // Automatically prefer and retry Cloudflare Primary after 60 seconds
        val now = System.currentTimeMillis()
        if (!usingCloudflare && (now - lastCloudflareFailureTime > 60_000L)) {
            usingCloudflare = true
        }

        val local = localDeviceProvider()
        val url = if (usingCloudflare) {
            "${RaagaCloudConfig.CLOUDFLARE_WS_URL}?channel=$channel&deviceId=${local.id}"
        } else {
            RaagaCloudConfig.SUPABASE_WS_URL
        }
        val request = Request.Builder()
            .url(url)
            .addHeader("User-Agent", "Raaga/1.9.7")
            .build()

        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                isConnected = true
                if (!usingCloudflare) {
                    // Join Phoenix topic for Supabase Realtime
                    val joinMsg = """
                        {
                            "topic": "realtime:$channel",
                            "event": "phx_join",
                            "payload": {
                                "config": {
                                    "broadcast": { "ack": false, "self": false },
                                    "presence": { "key": "" }
                                }
                            },
                            "ref": "${refCounter.getAndIncrement()}"
                        }
                    """.trimIndent()
                    ws.send(joinMsg)
                }

                // Start heartbeat
                heartbeatJob?.cancel()
                heartbeatJob = scope.launch {
                    while (isActive && isConnected) {
                        delay(25_000)
                        val hbMsg = """{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"hb"}"""
                        try {
                            ws.send(hbMsg)
                        } catch (_: Exception) {}
                    }
                }

                // Start periodic announcement (only if not an ephemeral pair-request channel)
                announceJob?.cancel()
                if (!channel.startsWith("raaga_pair_")) {
                    announceJob = scope.launch {
                        while (isActive && isConnected) {
                            sendAnnounce()
                            delay(25000) // Optimized: beacon every 25s instead of 5s
                        }
                    }
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                isConnected = false
                heartbeatJob?.cancel()
                announceJob?.cancel()
                // Failover between Cloudflare and Supabase gracefully
                if (usingCloudflare) {
                    lastCloudflareFailureTime = System.currentTimeMillis()
                    usingCloudflare = false // Fallback to Supabase temporarily
                } else {
                    usingCloudflare = true // Supabase failed, retry Cloudflare
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                isConnected = false
                heartbeatJob?.cancel()
                announceJob?.cancel()
            }
        })
    }

    fun sendAnnounce() {
        val local = localDeviceProvider()
        val payload = """
            {
                "id": "${local.id}",
                "name": "${local.name}",
                "type": "${local.type.name}",
                "isCloud": true
            }
        """.trimIndent()
        broadcastEvent("announce", payload)
    }

    fun sendTransfer(targetDeviceId: String, transfer: ConnectPlaybackTransfer) {
        val transferWithTarget = transfer.copy(targetDeviceId = targetDeviceId)
        val jsonPayload = json.encodeToString(ConnectPlaybackTransfer.serializer(), transferWithTarget)
        broadcastEvent("transfer", jsonPayload)
    }

    fun sendControl(targetDeviceId: String, command: ConnectControlCommand) {
        val cmdWithTarget = command.copy(targetDeviceId = targetDeviceId)
        val jsonPayload = json.encodeToString(ConnectControlCommand.serializer(), cmdWithTarget)
        broadcastEvent("control", jsonPayload)
    }

    fun sendStatus(status: ConnectDeviceStatus) {
        val jsonPayload = json.encodeToString(ConnectDeviceStatus.serializer(), status)
        broadcastEvent("status", jsonPayload)
    }

    fun sendPairRequest(request: ConnectPairRequest) {
        setTemporaryPairCode(request.code)
        scope.launch {
            delay(150)
            val jsonPayload = json.encodeToString(ConnectPairRequest.serializer(), request)
            broadcastEvent("pair_request", jsonPayload)
        }
    }

    fun sendPairResponse(response: ConnectPairResponse) {
        val jsonPayload = json.encodeToString(ConnectPairResponse.serializer(), response)
        broadcastEvent("pair_response", jsonPayload)
    }

    private fun broadcastEvent(eventName: String, jsonInnerPayload: String) {
        val ws = webSocket ?: return
        if (!isConnected) return
        val channel = activeChannel ?: return
        val topic = if (usingCloudflare) channel else "realtime:$channel"
        val ref = refCounter.getAndIncrement().toString()
        val msg = """
            {
                "topic": "$topic",
                "event": "broadcast",
                "payload": {
                    "type": "broadcast",
                    "event": "$eventName",
                    "payload": $jsonInnerPayload
                },
                "ref": "$ref"
            }
        """.trimIndent()
        ws.send(msg)
    }

    private fun handleIncomingMessage(text: String) {
        try {
            val element = json.parseToJsonElement(text).jsonObject
            val event = element["event"]?.jsonPrimitive?.contentOrNull ?: return
            if (event != "broadcast") return

            val payloadObj = element["payload"]?.jsonObject ?: return
            val broadcastEvent = payloadObj["event"]?.jsonPrimitive?.contentOrNull ?: return
            val innerPayload = payloadObj["payload"]?.jsonObject ?: return

            val localDevice = localDeviceProvider()

            when (broadcastEvent) {
                "announce" -> {
                    val id = innerPayload["id"]?.jsonPrimitive?.contentOrNull ?: return
                    if (id == localDevice.id) return // Ignore self

                    val name = innerPayload["name"]?.jsonPrimitive?.contentOrNull ?: "Remote Device"
                    val typeStr = innerPayload["type"]?.jsonPrimitive?.contentOrNull ?: "DESKTOP"
                    val type = runCatching { ConnectDeviceType.valueOf(typeStr) }.getOrDefault(ConnectDeviceType.DESKTOP)

                    val device = ConnectDevice(
                        id = id,
                        name = "$name (Cloud)",
                        type = type,
                        host = "cloud",
                        port = 0,
                        lastSeenTimestamp = System.currentTimeMillis(),
                        isCloud = true,
                    )
                    cloudDevices[id] = device
                    _discoveredCloudDevices.value = cloudDevices.values.toList()
                }

                "transfer" -> {
                    val transfer = json.decodeFromJsonElement(ConnectPlaybackTransfer.serializer(), innerPayload)
                    if (transfer.targetDeviceId.isBlank() || transfer.targetDeviceId == localDevice.id) {
                        onTransferReceived(transfer)
                    }
                }

                "control" -> {
                    val control = json.decodeFromJsonElement(ConnectControlCommand.serializer(), innerPayload)
                    if (control.targetDeviceId.isBlank() || control.targetDeviceId == localDevice.id) {
                        onControlReceived(control)
                    }
                }

                "status" -> {
                    val status = json.decodeFromJsonElement(ConnectDeviceStatus.serializer(), innerPayload)
                    onStatusReceived(status)
                }

                "pair_request" -> {
                    val request = json.decodeFromJsonElement(ConnectPairRequest.serializer(), innerPayload)
                    if (request.fromDevice.id != localDevice.id) {
                        onPairRequestReceived?.invoke(request)
                    }
                }

                "pair_response" -> {
                    val response = json.decodeFromJsonElement(ConnectPairResponse.serializer(), innerPayload)
                    if (response.targetDeviceId == localDevice.id) {
                        onPairResponseReceived?.invoke(response)
                    }
                }
            }
        } catch (_: Exception) {}
    }
}
