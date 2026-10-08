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
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

object RaagaSupabaseConfig {
    const val PROJECT_URL = "https://pufuuvtnnqubhupgaovg.supabase.co"
    const val API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZnV1dnRubnF1Ymh1cGdhb3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODU5MDEsImV4cCI6MjEwNjk2MTkwMX0.KaHtyBPskoT_I2LZPcKcLfMPbbWO15Q0NaF5rFUitQA"
    const val TOPIC = "realtime:raaga_cloud"
    val WS_URL = "wss://pufuuvtnnqubhupgaovg.supabase.co/realtime/v1/websocket?apikey=$API_KEY&vsn=1.0.0"
}

/**
 * Supabase Realtime Relay for Raaga Connect over the Cloud / Internet.
 * Enables 2-way playback transfer and remote control when devices are on different networks (e.g. 5G vs Wi-Fi).
 */
class RaagaSupabaseRelay(
    private val localDeviceProvider: () -> ConnectDevice,
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

    private val cloudDevices = ConcurrentHashMap<String, ConnectDevice>()
    private val _discoveredCloudDevices = MutableStateFlow<List<ConnectDevice>>(emptyList())
    val discoveredCloudDevices: StateFlow<List<ConnectDevice>> = _discoveredCloudDevices.asStateFlow()

    fun start() {
        if (connectJob != null) return
        connectJob = scope.launch {
            while (isActive) {
                try {
                    connectWebSocket()
                } catch (_: Exception) {}
                delay(6000) // Reconnect delay if disconnected
            }
        }

        // Cleanup stale cloud devices
        cleanupJob = scope.launch {
            while (isActive) {
                delay(5000)
                val now = System.currentTimeMillis()
                val stale = cloudDevices.filterValues { now - it.lastSeenTimestamp > 25_000L }.keys
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
        heartbeatJob?.cancel()
        announceJob?.cancel()
        try {
            webSocket?.close(1000, "App closed")
        } catch (_: Exception) {}
        webSocket = null
        isConnected = false
        cloudDevices.clear()
        _discoveredCloudDevices.value = emptyList()
    }

    private fun connectWebSocket() {
        val request = Request.Builder().url(RaagaSupabaseConfig.WS_URL).build()
        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                isConnected = true
                // Join Phoenix topic
                val joinMsg = """
                    {
                        "topic": "${RaagaSupabaseConfig.TOPIC}",
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

                // Start heartbeat
                heartbeatJob?.cancel()
                heartbeatJob = scope.launch {
                    while (isActive && isConnected) {
                        delay(25_000)
                        val hbMsg = """{"topic":"phoenix","event":"heartbeat","payload":{},"ref":"hb"}"""
                        ws.send(hbMsg)
                    }
                }

                // Start periodic announcement
                announceJob?.cancel()
                announceJob = scope.launch {
                    while (isActive && isConnected) {
                        sendAnnounce()
                        delay(5000)
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
        val jsonPayload = json.encodeToString(ConnectPairRequest.serializer(), request)
        broadcastEvent("pair_request", jsonPayload)
    }

    fun sendPairResponse(response: ConnectPairResponse) {
        val jsonPayload = json.encodeToString(ConnectPairResponse.serializer(), response)
        broadcastEvent("pair_response", jsonPayload)
    }

    private fun broadcastEvent(eventName: String, jsonInnerPayload: String) {
        val ws = webSocket ?: return
        if (!isConnected) return
        val ref = refCounter.getAndIncrement().toString()
        val msg = """
            {
                "topic": "${RaagaSupabaseConfig.TOPIC}",
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
