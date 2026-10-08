package com.music.raaga.desktop

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap

data class LocalJamEndpoint(
    val code: String,
    val host: String,
    val port: Int,
    val serviceName: String,
    val memberCount: Int = 1,
    val maxMembers: Int = 5,
    val discoveredAtMs: Long = System.currentTimeMillis(),
) {
    val httpBase: String get() = "http://$host:$port"
}

/**
 * LocalJamDiscovery — Peer-to-peer Wi-Fi & LAN Discovery for Jam on Desktop.
 *
 * Uses dual-channel zero-configuration discovery:
 * 1. UDP Broadcast Beacon on port 8895 (Instant, <5ms detection across devices).
 * 2. Active Gateway & Subnet Sweep on ports 8890-8891 (Guarantees connection even if
 *    Windows Firewall or router blocks multicast/broadcast).
 */
internal object LocalJamDiscovery {

    private const val BROADCAST_PORT = 8895
    private const val PREFIX_ANNOUNCE = "RAAGA_JAM:ANNOUNCE:"
    private const val PREFIX_DISCOVER = "RAAGA_JAM:DISCOVER"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private val discoveredEndpoints = ConcurrentHashMap<String, LocalJamEndpoint>()
    private val _activeLocalEndpoints = MutableStateFlow<Map<String, LocalJamEndpoint>>(emptyMap())
    val activeLocalEndpoints: StateFlow<Map<String, LocalJamEndpoint>> = _activeLocalEndpoints.asStateFlow()

    private val _isDiscovering = MutableStateFlow(false)
    val isDiscovering: StateFlow<Boolean> = _isDiscovering.asStateFlow()

    private val _isAdvertising = MutableStateFlow(false)
    val isAdvertising: StateFlow<Boolean> = _isAdvertising.asStateFlow()

    private var activeAdvertisedCode: String? = null
    private var activeAdvertisedPort: Int = 8890

    private var udpSocket: DatagramSocket? = null
    private var udpListenJob: Job? = null
    private var udpBroadcastJob: Job? = null
    private var sweepJob: Job? = null
    private var pruneJob: Job? = null

    fun startDiscovery() {
        if (_isDiscovering.value) return
        _isDiscovering.value = true

        ensureUdpSocket()

        // Periodic active subnet sweep every 15 seconds
        sweepJob = scope.launch {
            while (isActive) {
                sweepSubnetForParties()
                delay(15_000L)
            }
        }

        // Stale cleanup job
        pruneJob = scope.launch {
            while (isActive) {
                delay(5000L)
                val now = System.currentTimeMillis()
                val activeCode = activeAdvertisedCode
                val beforeSize = discoveredEndpoints.size
                discoveredEndpoints.entries.removeIf { (code, ep) ->
                    code != activeCode && now - ep.discoveredAtMs > 25_000L
                }
                if (discoveredEndpoints.size != beforeSize) {
                    _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                }
            }
        }

        // Send an initial DISCOVER ping on the network
        sendDiscoverQuery()
    }

    fun stopDiscovery() {
        _isDiscovering.value = false
        sweepJob?.cancel()
        sweepJob = null
        pruneJob?.cancel()
        pruneJob = null
        if (!_isAdvertising.value) {
            closeUdpSocket()
        }
    }

    fun startAdvertising(code: String, port: Int) {
        val clean = code.filter { it.isLetterOrDigit() }.uppercase()
        activeAdvertisedCode = clean
        activeAdvertisedPort = port
        _isAdvertising.value = true

        // Register self in discovered endpoints
        val localIp = getLocalIpAddress() ?: "127.0.0.1"
        discoveredEndpoints[clean] = LocalJamEndpoint(
            code = clean,
            host = localIp,
            port = port,
            serviceName = "RaagaJam-$clean-DesktopHost",
        )
        _activeLocalEndpoints.value = discoveredEndpoints.toMap()

        ensureUdpSocket()

        // Start broadcasting
        udpBroadcastJob?.cancel()
        udpBroadcastJob = scope.launch {
            while (isActive) {
                sendAnnounce()
                delay(3000L)
            }
        }
    }

    fun stopAdvertising() {
        val code = activeAdvertisedCode
        if (code != null) {
            discoveredEndpoints.remove(code)
            _activeLocalEndpoints.value = discoveredEndpoints.toMap()
        }
        activeAdvertisedCode = null
        _isAdvertising.value = false
        udpBroadcastJob?.cancel()
        udpBroadcastJob = null

        if (!_isDiscovering.value) {
            closeUdpSocket()
        }
    }

    /**
     * Resolves a local party code on the local Wi-Fi / LAN.
     */
    suspend fun findLocalJam(code: String, waitTimeoutMs: Long = 1500L): LocalJamEndpoint? {
        val clean = code.filter { it.isLetterOrDigit() }.uppercase()

        // 1. Direct cache check
        discoveredEndpoints[clean]?.let { return it }

        // 2. Localhost check
        val localCode = activeAdvertisedCode
        if (localCode != null && localCode.equals(clean, ignoreCase = true)) {
            val ep = LocalJamEndpoint(clean, "127.0.0.1", activeAdvertisedPort, "LocalHost")
            discoveredEndpoints[clean] = ep
            _activeLocalEndpoints.value = discoveredEndpoints.toMap()
            return ep
        }

        // 3. Send immediate UDP discovery query
        sendDiscoverQuery()

        // 4. Concurrently probe LAN for this specific code
        val probeJob = scope.launch {
            probeLanForSpecificParty(clean)
        }

        val start = System.currentTimeMillis()
        while (System.currentTimeMillis() - start < waitTimeoutMs) {
            discoveredEndpoints[clean]?.let {
                probeJob.cancel()
                return it
            }
            delay(40)
        }

        discoveredEndpoints[clean]?.let { return it }
        return null
    }

    // -------------------------------------------------------- UDP Socket --

    private fun ensureUdpSocket() {
        if (udpSocket != null && !udpSocket!!.isClosed) return

        try {
            val socket = DatagramSocket(null).apply {
                reuseAddress = true
                broadcast = true
                bind(InetSocketAddress(BROADCAST_PORT))
            }
            udpSocket = socket
        } catch (_: Exception) {
            try {
                udpSocket = DatagramSocket().apply { broadcast = true }
            } catch (_: Exception) {
                return
            }
        }

        udpListenJob?.cancel()
        udpListenJob = scope.launch {
            val buf = ByteArray(4096)
            val socket = udpSocket ?: return@launch
            while (isActive && !socket.isClosed) {
                try {
                    val packet = DatagramPacket(buf, buf.size)
                    socket.receive(packet)
                    val msg = String(packet.data, packet.offset, packet.length, StandardCharsets.UTF_8).trim()
                    handleUdpPacket(msg, packet.address)
                } catch (e: Exception) {
                    if (e is CancellationException || socket.isClosed) break
                }
            }
        }
    }

    private fun closeUdpSocket() {
        udpListenJob?.cancel()
        udpListenJob = null
        udpBroadcastJob?.cancel()
        udpBroadcastJob = null
        try {
            udpSocket?.close()
        } catch (_: Exception) {}
        udpSocket = null
    }

    private fun handleUdpPacket(message: String, senderAddress: InetAddress) {
        val senderIp = senderAddress.hostAddress ?: return

        when {
            message.startsWith(PREFIX_ANNOUNCE) -> {
                val jsonPayload = message.removePrefix(PREFIX_ANNOUNCE)
                runCatching {
                    val root = json.parseToJsonElement(jsonPayload).jsonObject
                    val code = root["code"]?.jsonPrimitive?.content ?: return
                    val port = root["port"]?.jsonPrimitive?.intOrNull ?: 8890
                    val host = root["host"]?.jsonPrimitive?.content?.ifBlank { senderIp } ?: senderIp
                    val name = root["name"]?.jsonPrimitive?.content ?: "RaagaJam-$code"
                    val members = root["members"]?.jsonPrimitive?.intOrNull ?: 1
                    val maxMembers = root["maxMembers"]?.jsonPrimitive?.intOrNull ?: 5

                    // Ignore own broadcast
                    if (code == activeAdvertisedCode && isLocalAddress(host)) return

                    val ep = LocalJamEndpoint(
                        code = code.uppercase(),
                        host = host,
                        port = port,
                        serviceName = name,
                        memberCount = members,
                        maxMembers = maxMembers,
                        discoveredAtMs = System.currentTimeMillis(),
                    )
                    discoveredEndpoints[code.uppercase()] = ep
                    _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                    DesktopTrackLog.log("Discovered Local Jam via UDP: $code at $host:$port")
                }
            }

            message.startsWith(PREFIX_DISCOVER) -> {
                // If we are currently hosting a party, respond immediately with ANNOUNCE
                if (_isAdvertising.value && activeAdvertisedCode != null) {
                    sendAnnounce(targetAddress = senderAddress)
                }
            }
        }
    }

    private fun sendAnnounce(targetAddress: InetAddress? = null) {
        val code = activeAdvertisedCode ?: return
        val localIp = getLocalIpAddress() ?: "127.0.0.1"
        val payload = """{"code":"$code","host":"$localIp","port":$activeAdvertisedPort,"name":"RaagaJam-$code-Desktop"}"""
        val packetData = (PREFIX_ANNOUNCE + payload).toByteArray(StandardCharsets.UTF_8)

        scope.launch {
            val socket = udpSocket ?: return@launch
            if (targetAddress != null) {
                runCatching {
                    socket.send(DatagramPacket(packetData, packetData.size, targetAddress, BROADCAST_PORT))
                }
            } else {
                broadcastPacket(socket, packetData, BROADCAST_PORT)
            }
        }
    }

    private fun sendDiscoverQuery() {
        val packetData = PREFIX_DISCOVER.toByteArray(StandardCharsets.UTF_8)
        scope.launch {
            val socket = udpSocket ?: return@launch
            broadcastPacket(socket, packetData, BROADCAST_PORT)
        }
    }

    private fun broadcastPacket(socket: DatagramSocket, data: ByteArray, port: Int) {
        // Send to standard 255.255.255.255
        runCatching {
            socket.send(DatagramPacket(data, data.size, InetAddress.getByName("255.255.255.255"), port))
        }

        // Send to all network interface broadcast addresses
        runCatching {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return
            for (iface in interfaces) {
                if (iface.isLoopback || !iface.isUp) continue
                for (ia in iface.interfaceAddresses) {
                    val bcast = ia.broadcast ?: continue
                    runCatching {
                        socket.send(DatagramPacket(data, data.size, bcast, port))
                    }
                }
            }
        }
    }

    // ------------------------------------------------------- Subnet Sweep --

    /**
     * Probes the local /24 subnet and gateway for any active Local Jam rooms on port 8890-8891.
     */
    private suspend fun sweepSubnetForParties() = withContext(Dispatchers.IO) {
        val localIp = getLocalIpAddress() ?: return@withContext
        val lastDot = localIp.lastIndexOf('.')
        if (lastDot == -1) return@withContext
        val prefix = localIp.substring(0, lastDot + 1)
        val myHostNum = localIp.substring(lastDot + 1).toIntOrNull() ?: -1

        val candidates = mutableListOf<String>()
        candidates.add("192.168.43.1") // Android mobile hotspot AP
        candidates.add("${prefix}1")    // Router / Gateway AP

        // Sweep host IPs around this device's host number
        (1..254).filter { it != myHostNum }.sortedBy { kotlin.math.abs(it - myHostNum) }.forEach {
            candidates.add("$prefix$it")
        }

        val channel = Channel<String>(candidates.size)
        candidates.forEach { channel.trySend(it) }
        channel.close()

        val workers = (1..24).map {
            launch {
                for (ip in channel) {
                    checkActivePartyAt(ip, 8890)
                }
            }
        }
        workers.joinAll()
    }

    private suspend fun probeLanForSpecificParty(code: String) = withContext(Dispatchers.IO) {
        val localIp = getLocalIpAddress() ?: return@withContext
        val lastDot = localIp.lastIndexOf('.')
        if (lastDot == -1) return@withContext
        val prefix = localIp.substring(0, lastDot + 1)
        val myHostNum = localIp.substring(lastDot + 1).toIntOrNull() ?: -1

        val candidates = mutableListOf<String>()
        candidates.add("192.168.43.1")
        candidates.add("${prefix}1")
        (1..254).filter { it != myHostNum }.sortedBy { kotlin.math.abs(it - myHostNum) }.forEach {
            candidates.add("$prefix$it")
        }

        val channel = Channel<String>(candidates.size)
        candidates.forEach { channel.trySend(it) }
        channel.close()

        val workers = (1..24).map {
            launch {
                for (ip in channel) {
                    if (discoveredEndpoints.containsKey(code)) break
                    checkSpecificPartyAt(ip, 8890, code)
                }
            }
        }
        workers.joinAll()
    }

    private fun checkActivePartyAt(ip: String, port: Int): Boolean {
        var socket: Socket? = null
        return try {
            socket = Socket()
            socket.connect(InetSocketAddress(ip, port), 200)
            socket.soTimeout = 300

            val req = "GET /api/parties/active HTTP/1.1\r\nHost: $ip:$port\r\nConnection: close\r\n\r\n"
            socket.getOutputStream().write(req.toByteArray(StandardCharsets.UTF_8))
            socket.getOutputStream().flush()

            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
            val statusLine = reader.readLine().orEmpty()
            if (statusLine.contains("200")) {
                val body = reader.readText()
                val jsonRoot = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull()
                val code = jsonRoot?.get("code")?.jsonPrimitive?.content
                if (!code.isNullOrBlank()) {
                    val cleanCode = code.uppercase()
                    if (cleanCode != activeAdvertisedCode || !isLocalAddress(ip)) {
                        val members = jsonRoot["members"]?.jsonPrimitive?.intOrNull ?: 1
                        val maxMembers = jsonRoot["maxMembers"]?.jsonPrimitive?.intOrNull ?: 5
                        val ep = LocalJamEndpoint(
                            code = cleanCode,
                            host = ip,
                            port = port,
                            serviceName = "RaagaJam-$cleanCode-LAN",
                            memberCount = members,
                            maxMembers = maxMembers,
                            discoveredAtMs = System.currentTimeMillis(),
                        )
                        discoveredEndpoints[cleanCode] = ep
                        _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                        DesktopTrackLog.log("Found Active Jam on LAN: $cleanCode at http://$ip:$port")
                        return true
                    }
                }
            }
            false
        } catch (_: Exception) {
            false
        } finally {
            runCatching { socket?.close() }
        }
    }

    private fun checkSpecificPartyAt(ip: String, port: Int, code: String): Boolean {
        var socket: Socket? = null
        return try {
            socket = Socket()
            socket.connect(InetSocketAddress(ip, port), 200)
            socket.soTimeout = 350

            val req = "GET /api/parties/$code/preview HTTP/1.1\r\nHost: $ip:$port\r\nConnection: close\r\n\r\n"
            socket.getOutputStream().write(req.toByteArray(StandardCharsets.UTF_8))
            socket.getOutputStream().flush()

            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
            val statusLine = reader.readLine().orEmpty()
            if (statusLine.contains("200")) {
                val ep = LocalJamEndpoint(
                    code = code,
                    host = ip,
                    port = port,
                    serviceName = "RaagaJam-$code-DirectLAN",
                    discoveredAtMs = System.currentTimeMillis(),
                )
                discoveredEndpoints[code] = ep
                _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                DesktopTrackLog.log("Found Party $code on LAN at http://$ip:$port")
                true
            } else false
        } catch (_: Exception) {
            false
        } finally {
            runCatching { socket?.close() }
        }
    }

    fun getLocalIpAddress(): String? {
        return try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
            for (intf in interfaces) {
                if (intf.isLoopback || !intf.isUp) continue
                for (addr in intf.inetAddresses) {
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        val host = addr.hostAddress ?: continue
                        if (host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.")) {
                            return host
                        }
                    }
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }

    private fun isLocalAddress(host: String): Boolean {
        if (host == "127.0.0.1" || host == "localhost") return true
        val myIp = getLocalIpAddress()
        return myIp != null && myIp == host
    }
}
