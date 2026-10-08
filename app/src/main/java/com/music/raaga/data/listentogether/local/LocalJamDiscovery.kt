package com.music.raaga.data.listentogether.local

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.listentogether.ListenTogether
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
import java.util.ArrayDeque
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import org.json.JSONObject

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
 * LocalJamDiscovery — Hybrid UDP Broadcast, Subnet Sweeper & Android NSD
 * for Peer-to-Peer Local Wi-Fi Jam.
 *
 * Guarantees instant, reliable discovery between Android and Desktop devices on the same Wi-Fi,
 * mobile hotspot, or local network without cloud dependency or router multicast filtering issues.
 */
object LocalJamDiscovery {

    private const val TAG = "LocalJamDiscovery"
    const val SERVICE_TYPE = "_raaga-jam._tcp"

    private const val BROADCAST_PORT = 8895
    private const val PREFIX_ANNOUNCE = "RAAGA_JAM:ANNOUNCE:"
    private const val PREFIX_DISCOVER = "RAAGA_JAM:DISCOVER"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var nsdManager: NsdManager? = null
    private var multicastLock: WifiManager.MulticastLock? = null

    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null

    private val _isDiscovering = MutableStateFlow(false)
    val isDiscovering: StateFlow<Boolean> = _isDiscovering.asStateFlow()

    private val _isAdvertising = MutableStateFlow(false)
    val isAdvertising: StateFlow<Boolean> = _isAdvertising.asStateFlow()

    // Key is party code in uppercase, value is local Wi-Fi endpoint
    private val discoveredEndpoints = ConcurrentHashMap<String, LocalJamEndpoint>()

    private val _activeLocalEndpoints = MutableStateFlow<Map<String, LocalJamEndpoint>>(emptyMap())
    val activeLocalEndpoints: StateFlow<Map<String, LocalJamEndpoint>> = _activeLocalEndpoints.asStateFlow()

    private var activeAdvertisedCode: String? = null
    private var activeAdvertisedPort: Int = 8890

    private var udpSocket: DatagramSocket? = null
    private var udpListenJob: Job? = null
    private var udpBroadcastJob: Job? = null
    private var sweepJob: Job? = null
    private var pruneJob: Job? = null

    // Sequential resolution queue to avoid FAILURE_ALREADY_ACTIVE on Android NSD
    private val resolveQueue = ArrayDeque<NsdServiceInfo>()
    private var isResolving = false

    fun startDiscovery(context: Context) {
        if (_isDiscovering.value) return
        _isDiscovering.value = true

        try {
            // Acquire MulticastLock so Android Wi-Fi chip doesn't filter out broadcast/multicast packets
            val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            try {
                multicastLock = wifi?.createMulticastLock("raaga_jam_mdns")?.apply {
                    setReferenceCounted(true)
                    acquire()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not acquire MulticastLock: ${e.message}")
            }

            // Start Android NSD
            startNsdDiscovery(context)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize NSD discovery: ${e.message}")
        }

        // Start UDP broadcast listener
        ensureUdpSocket()

        // Periodic active subnet sweep every 15 seconds
        sweepJob?.cancel()
        sweepJob = scope.launch {
            while (isActive) {
                sweepSubnetForParties(context)
                delay(15_000L)
            }
        }

        // Stale endpoints cleanup job
        pruneJob?.cancel()
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

        // Send an initial DISCOVER broadcast ping
        sendDiscoverQuery()
    }

    private fun startNsdDiscovery(context: Context) {
        val nsd = context.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
        nsdManager = nsd

        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(regType: String) {
                Log.d(TAG, "Local Wi-Fi Jam NSD discovery started: $regType")
            }

            override fun onServiceFound(service: NsdServiceInfo) {
                val name = service.serviceName ?: return
                if (!name.startsWith("RaagaJam-")) return
                if (name.contains(Build.MODEL) && activeAdvertisedCode != null) return // Skip own broadcast

                queueResolve(nsd, service)
            }

            override fun onServiceLost(service: NsdServiceInfo) {
                val name = service.serviceName ?: return
                val code = extractCode(name) ?: return
                discoveredEndpoints.remove(code)
                _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                Log.d(TAG, "Lost local Wi-Fi Jam: $code ($name)")
            }

            override fun onDiscoveryStopped(serviceType: String) {
                Log.d(TAG, "Local Wi-Fi Jam NSD discovery stopped")
            }

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.w(TAG, "Start discovery failed: $errorCode")
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
        }

        discoveryListener = listener
        try {
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            Log.w(TAG, "nsd.discoverServices error: ${e.message}")
        }
    }

    private fun queueResolve(nsd: NsdManager, service: NsdServiceInfo) {
        synchronized(resolveQueue) {
            resolveQueue.add(service)
            if (!isResolving) {
                resolveNext(nsd)
            }
        }
    }

    private fun resolveNext(nsd: NsdManager) {
        val nextService: NsdServiceInfo
        synchronized(resolveQueue) {
            if (resolveQueue.isEmpty()) {
                isResolving = false
                return
            }
            isResolving = true
            nextService = resolveQueue.removeFirst()
        }

        try {
            nsd.resolveService(nextService, object : NsdManager.ResolveListener {
                override fun onServiceResolved(resolved: NsdServiceInfo) {
                    try {
                        val host = resolved.host?.hostAddress
                        if (host != null && !host.startsWith("127.")) {
                            val port = resolved.port
                            val name = resolved.serviceName
                            val code = extractCode(name)
                            if (code != null) {
                                val endpoint = LocalJamEndpoint(
                                    code = code,
                                    host = host,
                                    port = port,
                                    serviceName = name,
                                )
                                discoveredEndpoints[code] = endpoint
                                _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                                Log.i(TAG, "Found Local Wi-Fi Jam via NSD: $code at http://$host:$port")
                            }
                        }
                    } finally {
                        resolveNext(nsd)
                    }
                }

                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    Log.w(TAG, "Failed to resolve local Jam service: $errorCode")
                    resolveNext(nsd)
                }
            })
        } catch (e: Exception) {
            Log.w(TAG, "Error resolving service: ${e.message}")
            resolveNext(nsd)
        }
    }

    fun stopDiscovery() {
        _isDiscovering.value = false
        sweepJob?.cancel()
        sweepJob = null
        pruneJob?.cancel()
        pruneJob = null

        val nsd = nsdManager
        discoveryListener?.let {
            runCatching { nsd?.stopServiceDiscovery(it) }
        }
        discoveryListener = null

        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
        } catch (_: Exception) {}
        multicastLock = null

        synchronized(resolveQueue) {
            resolveQueue.clear()
            isResolving = false
        }

        if (!_isAdvertising.value) {
            closeUdpSocket()
        }
    }

    fun startAdvertising(context: Context, code: String, port: Int) {
        stopAdvertising()
        val cleanCode = code.filter { it.isLetterOrDigit() }.uppercase()
        activeAdvertisedCode = cleanCode
        activeAdvertisedPort = port
        _isAdvertising.value = true

        // Register self in discovered endpoints
        val localIp = getLocalIpAddress() ?: "127.0.0.1"
        discoveredEndpoints[cleanCode] = LocalJamEndpoint(
            code = cleanCode,
            host = localIp,
            port = port,
            serviceName = "RaagaJam-$cleanCode-AndroidHost",
        )
        _activeLocalEndpoints.value = discoveredEndpoints.toMap()

        // 1. Android NSD registration
        try {
            val nsd = context.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager
            if (nsd != null) {
                nsdManager = nsd
                val serviceInfo = NsdServiceInfo().apply {
                    serviceName = "RaagaJam-$cleanCode-${Build.MODEL.filter { it.isLetterOrDigit() }.take(6)}"
                    serviceType = SERVICE_TYPE
                    setPort(port)
                }

                val listener = object : NsdManager.RegistrationListener {
                    override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {
                        Log.i(TAG, "Local Wi-Fi Jam advertised on NSD: ${serviceInfo.serviceName} at port $port")
                    }

                    override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                        Log.w(TAG, "Local Wi-Fi Jam advertising failed on NSD: $errorCode")
                    }

                    override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {}
                    override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                }

                registrationListener = listener
                nsd.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, listener)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error advertising via NSD: ${e.message}")
        }

        // 2. UDP Beacon broadcast loop
        ensureUdpSocket()
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

        val nsd = nsdManager
        registrationListener?.let {
            runCatching { nsd?.unregisterService(it) }
        }
        registrationListener = null

        udpBroadcastJob?.cancel()
        udpBroadcastJob = null

        if (!_isDiscovering.value) {
            closeUdpSocket()
        }
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
                    val root = JSONObject(jsonPayload)
                    val code = root.optString("code")
                    if (code.isBlank()) return@runCatching
                    val port = root.optInt("port", 8890)
                    val hostRaw = root.optString("host")
                    val host = if (hostRaw.isNotBlank()) hostRaw else senderIp
                    val name = root.optString("name", "RaagaJam-$code")
                    val members = root.optInt("members", 1)
                    val maxMembers = root.optInt("maxMembers", 5)

                    val cleanCode = code.uppercase()
                    // Ignore own broadcast
                    if (cleanCode == activeAdvertisedCode && isLocalAddress(host)) return

                    val ep = LocalJamEndpoint(
                        code = cleanCode,
                        host = host,
                        port = port,
                        serviceName = name,
                        memberCount = members,
                        maxMembers = maxMembers,
                        discoveredAtMs = System.currentTimeMillis(),
                    )
                    discoveredEndpoints[cleanCode] = ep
                    _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                    Log.i(TAG, "Discovered Local Jam via UDP: $cleanCode at $host:$port")
                }
            }

            message.startsWith(PREFIX_DISCOVER) -> {
                if (_isAdvertising.value && activeAdvertisedCode != null) {
                    sendAnnounce(targetAddress = senderAddress)
                }
            }
        }
    }

    private fun sendAnnounce(targetAddress: InetAddress? = null) {
        val code = activeAdvertisedCode ?: return
        val localIp = getLocalIpAddress() ?: "127.0.0.1"
        val payload = """{"code":"$code","host":"$localIp","port":$activeAdvertisedPort,"name":"RaagaJam-$code-Android"}"""
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

    // -------------------------------------------------------- Direct LAN Probe --

    /**
     * Finds a local party code on the local Wi-Fi or Hotspot network.
     * Uses local cache, self-host check, UDP ping, active gateway/subnet probing, and mDNS.
     */
    suspend fun findLocalJam(
        code: String,
        waitTimeoutMs: Long = 1500L,
        context: Context? = null,
    ): LocalJamEndpoint? {
        val clean = code.filter { it.isLetterOrDigit() }.uppercase()

        // 1. Check existing cache
        discoveredEndpoints[clean]?.let { return it }

        // 2. Check if local host server is running right on this device
        val localPort = ListenTogether.localHostPort()
        val localCode = ListenTogether.localHostCode()
        if (localPort > 0 && localCode?.equals(clean, ignoreCase = true) == true) {
            val ep = LocalJamEndpoint(clean, "127.0.0.1", localPort, "LocalHost")
            discoveredEndpoints[clean] = ep
            _activeLocalEndpoints.value = discoveredEndpoints.toMap()
            return ep
        }

        // 3. Send immediate UDP ping
        sendDiscoverQuery()

        // 4. Launch active Gateway & Subnet probe in parallel with discovery wait loop
        val probeJob = scope.launch {
            probeLanForParty(clean, context)
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

    /**
     * Sweeps the local subnet and gateway for any active parties.
     */
    private suspend fun sweepSubnetForParties(context: Context?) = withContext(Dispatchers.IO) {
        val localIp = getLocalIpAddress() ?: return@withContext
        val lastDot = localIp.lastIndexOf('.')
        if (lastDot == -1) return@withContext
        val prefix = localIp.substring(0, lastDot + 1)
        val myHostNum = localIp.substring(lastDot + 1).toIntOrNull() ?: -1

        val candidates = mutableListOf<String>()
        val gateway = getGatewayIp(context)
        if (!gateway.isNullOrBlank() && gateway != "0.0.0.0") candidates.add(gateway)
        candidates.add("192.168.43.1") // Android mobile hotspot
        candidates.add("${prefix}1")   // Default gateway

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
                val jsonRoot = runCatching { JSONObject(body) }.getOrNull()
                val code = jsonRoot?.optString("code")
                if (!code.isNullOrBlank()) {
                    val cleanCode = code.uppercase()
                    if (cleanCode != activeAdvertisedCode || !isLocalAddress(ip)) {
                        val members = jsonRoot.optInt("members", 1)
                        val maxMembers = jsonRoot.optInt("maxMembers", 5)
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
                        Log.i(TAG, "Found Active Jam on LAN: $cleanCode at http://$ip:$port")
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

    /**
     * Probes the Gateway IP and local /24 subnet directly on ports 8890-8891 for party preview.
     * Bypasses router multicast/mDNS blocking completely.
     */
    private suspend fun probeLanForParty(code: String, context: Context?) {
        withContext(Dispatchers.IO) {
            val testedIps = ConcurrentHashMap.newKeySet<String>()

            // A. Check Gateway IP (Hotspot host or Wi-Fi AP)
            val gateway = getGatewayIp(context)
            val candidates = mutableListOf<String>()
            if (!gateway.isNullOrBlank() && gateway != "0.0.0.0") {
                candidates.add(gateway)
            }
            candidates.add("192.168.43.1") // Common Android mobile hotspot gateway

            for (ip in candidates) {
                if (discoveredEndpoints.containsKey(code)) return@withContext
                if (testedIps.add(ip)) {
                    if (checkPartyAt(ip, 8890, code) || checkPartyAt(ip, 8891, code)) {
                        return@withContext
                    }
                }
            }

            // B. Check local /24 subnet
            val localIp = getLocalIpAddress() ?: return@withContext
            val lastDot = localIp.lastIndexOf('.')
            if (lastDot == -1) return@withContext
            val prefix = localIp.substring(0, lastDot + 1)
            val myHostNum = localIp.substring(lastDot + 1).toIntOrNull() ?: -1

            val targetHosts = (1..254).filter { it != myHostNum }
                .sortedBy { kotlin.math.abs(it - myHostNum) }

            val channel = Channel<String>(255)
            for (h in targetHosts) {
                val ip = "$prefix$h"
                if (!testedIps.contains(ip)) {
                    channel.trySend(ip)
                }
            }
            channel.close()

            val workers = (1..32).map {
                launch {
                    for (ip in channel) {
                        if (discoveredEndpoints.containsKey(code)) break
                        if (testedIps.add(ip)) {
                            if (checkPartyAt(ip, 8890, code)) break
                        }
                    }
                }
            }
            workers.joinAll()
        }
    }

    private fun checkPartyAt(ip: String, port: Int, code: String): Boolean {
        var socket: Socket? = null
        return try {
            socket = Socket()
            socket.connect(InetSocketAddress(ip, port), 250) // 250ms connect timeout
            socket.soTimeout = 400

            val request = "GET /api/parties/$code/preview HTTP/1.1\r\nHost: $ip:$port\r\nConnection: close\r\n\r\n"
            val out = socket.getOutputStream()
            out.write(request.toByteArray(StandardCharsets.UTF_8))
            out.flush()

            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
            val statusLine = reader.readLine().orEmpty()
            if (statusLine.contains("200")) {
                val ep = LocalJamEndpoint(
                    code = code,
                    host = ip,
                    port = port,
                    serviceName = "RaagaJam-$code-DirectLAN",
                )
                discoveredEndpoints[code] = ep
                _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                Log.i(TAG, "Direct LAN probe found party $code at http://$ip:$port")
                true
            } else {
                false
            }
        } catch (_: Exception) {
            false
        } finally {
            runCatching { socket?.close() }
        }
    }

    private fun isLocalAddress(host: String): Boolean {
        if (host == "127.0.0.1" || host == "localhost" || host == "::1") return true
        val myIp = getLocalIpAddress() ?: return false
        return host == myIp
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

    fun getGatewayIp(context: Context?): String? {
        val ctx = context ?: return null
        return try {
            val wifi = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val dhcp = wifi?.dhcpInfo ?: return null
            val gateway = dhcp.gateway
            if (gateway != 0) {
                String.format(
                    Locale.US,
                    "%d.%d.%d.%d",
                    gateway and 0xff,
                    gateway shr 8 and 0xff,
                    gateway shr 16 and 0xff,
                    gateway shr 24 and 0xff,
                )
            } else null
        } catch (_: Exception) {
            null
        }
    }

    private fun extractCode(serviceName: String): String? {
        if (!serviceName.startsWith("RaagaJam-")) return null
        val parts = serviceName.removePrefix("RaagaJam-").split("-")
        return parts.firstOrNull()?.filter { it.isLetterOrDigit() }?.uppercase()?.take(6)
    }
}
