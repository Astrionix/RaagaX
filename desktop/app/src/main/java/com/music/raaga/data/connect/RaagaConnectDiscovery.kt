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
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap

/**
 * Peer-to-peer UDP broadcast discovery on local Wi-Fi for Raaga Connect on Android.
 * Announces local device and discovers other active Raaga devices (Android & Desktop).
 */
class RaagaConnectDiscovery(
    private val localDeviceProvider: () -> ConnectDevice,
    private val broadcastPort: Int = 8894,
) {
    companion object {
        private const val PREFIX_ANNOUNCE = "RAAGA_CONNECT:ANNOUNCE:"
        private const val PREFIX_DISCOVER = "RAAGA_CONNECT:DISCOVER:"
        private const val DEVICE_TIMEOUT_MS = 12_000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    private val deviceMap = ConcurrentHashMap<String, ConnectDevice>()
    private val _discoveredDevices = MutableStateFlow<List<ConnectDevice>>(emptyList())
    val discoveredDevices: StateFlow<List<ConnectDevice>> = _discoveredDevices.asStateFlow()

    private var listenSocket: DatagramSocket? = null
    private var listenJob: Job? = null
    private var broadcastJob: Job? = null
    private var cleanupJob: Job? = null

    val isRunning: Boolean get() = listenSocket != null && listenJob?.isActive == true

    fun start() {
        if (isRunning) return

        try {
            val socket = DatagramSocket(null).apply {
                reuseAddress = true
                broadcast = true
                bind(InetSocketAddress(broadcastPort))
            }
            listenSocket = socket
        } catch (_: Exception) {
            // Fallback to ephemeral port for listening
            try {
                listenSocket = DatagramSocket().apply { broadcast = true }
            } catch (_: Exception) {
                return
            }
        }

        // Listener loop
        listenJob = scope.launch {
            val buffer = ByteArray(4096)
            val socket = listenSocket ?: return@launch
            while (isActive && !socket.isClosed) {
                try {
                    val packet = DatagramPacket(buffer, buffer.size)
                    socket.receive(packet)
                    val message = String(packet.data, packet.offset, packet.length, StandardCharsets.UTF_8).trim()
                    handleIncomingPacket(message, packet.address)
                } catch (e: Exception) {
                    if (e is CancellationException || socket.isClosed) break
                }
            }
        }

        // Periodic broadcast loop
        broadcastJob = scope.launch {
            while (isActive) {
                sendAnnounce()
                delay(3000)
            }
        }

        // Cleanup stale devices
        cleanupJob = scope.launch {
            while (isActive) {
                delay(4000)
                val now = System.currentTimeMillis()
                val staleIds = deviceMap.filterValues { now - it.lastSeenTimestamp > DEVICE_TIMEOUT_MS }.keys
                if (staleIds.isNotEmpty()) {
                    staleIds.forEach { deviceMap.remove(it) }
                    _discoveredDevices.value = deviceMap.values.toList()
                }
            }
        }

        // Send initial discover probe
        sendDiscover()
    }

    fun stop() {
        listenJob?.cancel()
        broadcastJob?.cancel()
        cleanupJob?.cancel()
        try {
            listenSocket?.close()
        } catch (_: Exception) {}
        listenSocket = null
        deviceMap.clear()
        _discoveredDevices.value = emptyList()
    }

    fun sendDiscover() {
        scope.launch {
            try {
                val localId = localDeviceProvider().id
                val msg = "$PREFIX_DISCOVER$localId"
                sendBroadcast(msg)
            } catch (_: Exception) {}
        }
    }

    fun sendAnnounce() {
        scope.launch {
            try {
                val device = localDeviceProvider()
                val jsonPayload = json.encodeToString(device)
                val msg = "$PREFIX_ANNOUNCE$jsonPayload"
                sendBroadcast(msg)
            } catch (_: Exception) {}
        }
    }

    private fun sendBroadcast(message: String) {
        val bytes = message.toByteArray(StandardCharsets.UTF_8)
        val socket = listenSocket ?: return
        val broadcastAddress = InetAddress.getByName("255.255.255.255")
        val packet = DatagramPacket(bytes, bytes.size, broadcastAddress, broadcastPort)
        socket.send(packet)
    }

    private fun handleIncomingPacket(message: String, senderAddress: InetAddress) {
        val localDevice = localDeviceProvider()
        val now = System.currentTimeMillis()

        when {
            message.startsWith(PREFIX_ANNOUNCE) -> {
                val jsonStr = message.removePrefix(PREFIX_ANNOUNCE)
                try {
                    val rawDevice = json.decodeFromString<ConnectDevice>(jsonStr)
                    if (rawDevice.id == localDevice.id) return // Ignore self

                    // If host is loopback or empty, resolve to sender's IP
                    val actualHost = if (rawDevice.host.isBlank() || rawDevice.host == "127.0.0.1" || rawDevice.host == "localhost") {
                        senderAddress.hostAddress ?: rawDevice.host
                    } else {
                        rawDevice.host
                    }

                    val updatedDevice = rawDevice.copy(
                        host = actualHost,
                        lastSeenTimestamp = now,
                    )

                    deviceMap[updatedDevice.id] = updatedDevice
                    _discoveredDevices.value = deviceMap.values.toList()
                } catch (_: Exception) {}
            }

            message.startsWith(PREFIX_DISCOVER) -> {
                val sourceId = message.removePrefix(PREFIX_DISCOVER).trim()
                if (sourceId != localDevice.id) {
                    // Send an immediate announcement back
                    sendAnnounce()
                }
            }
        }
    }
}
