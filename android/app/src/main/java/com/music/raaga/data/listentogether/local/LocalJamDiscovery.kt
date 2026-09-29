package com.music.raaga.data.listentogether.local

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import com.music.raaga.data.DebugLog as Log
import com.music.raaga.data.listentogether.ListenTogether
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.ArrayDeque
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

data class LocalJamEndpoint(
    val code: String,
    val host: String,
    val port: Int,
    val serviceName: String,
    val discoveredAtMs: Long = System.currentTimeMillis(),
) {
    val httpBase: String get() = "http://$host:$port"
}

/**
 * LocalJamDiscovery — Hybrid mDNS/DNS-SD & Direct LAN Discovery for Local Jam.
 *
 * Combines Android NSD with active Gateway/Subnet probing and MulticastLock to
 * guarantee reliable, instant discovery across home Wi-Fi, mesh networks,
 * and mobile hotspots without dependency on flaky router multicast filtering.
 */
object LocalJamDiscovery {

    private const val TAG = "LocalJamDiscovery"
    const val SERVICE_TYPE = "_raaga-jam._tcp"

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

    // Sequential resolution queue to avoid FAILURE_ALREADY_ACTIVE on Android NSD
    private val resolveQueue = ArrayDeque<NsdServiceInfo>()
    private var isResolving = false

    fun startDiscovery(context: Context) {
        if (_isDiscovering.value) return
        try {
            // Acquire MulticastLock so Android Wi-Fi chip doesn't filter out mDNS broadcast packets
            val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            try {
                multicastLock = wifi?.createMulticastLock("raaga_jam_mdns")?.apply {
                    setReferenceCounted(true)
                    acquire()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not acquire MulticastLock: ${e.message}")
            }

            val nsd = context.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
            nsdManager = nsd

            val listener = object : NsdManager.DiscoveryListener {
                override fun onDiscoveryStarted(regType: String) {
                    _isDiscovering.value = true
                    Log.d(TAG, "Local Wi-Fi Jam discovery started: $regType")
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
                    _isDiscovering.value = false
                    Log.d(TAG, "Local Wi-Fi Jam discovery stopped")
                }

                override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                    _isDiscovering.value = false
                    Log.w(TAG, "Start discovery failed: $errorCode")
                }

                override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                    _isDiscovering.value = false
                }
            }

            discoveryListener = listener
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize NSD discovery: ${e.message}")
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
        if (!_isDiscovering.value) return
        val nsd = nsdManager ?: return
        discoveryListener?.let {
            runCatching { nsd.stopServiceDiscovery(it) }
        }
        discoveryListener = null
        _isDiscovering.value = false

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
    }

    fun startAdvertising(context: Context, code: String, port: Int) {
        stopAdvertising()
        try {
            val nsd = context.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
            nsdManager = nsd
            val cleanCode = code.filter { it.isLetterOrDigit() }.uppercase()
            activeAdvertisedCode = cleanCode

            val serviceInfo = NsdServiceInfo().apply {
                serviceName = "RaagaJam-$cleanCode-${Build.MODEL.filter { it.isLetterOrDigit() }.take(6)}"
                serviceType = SERVICE_TYPE
                setPort(port)
            }

            val listener = object : NsdManager.RegistrationListener {
                override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {
                    _isAdvertising.value = true
                    Log.i(TAG, "Local Wi-Fi Jam advertised on LAN: ${serviceInfo.serviceName} at port $port")
                }

                override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    _isAdvertising.value = false
                    Log.w(TAG, "Local Wi-Fi Jam advertising failed: $errorCode")
                }

                override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {
                    _isAdvertising.value = false
                }

                override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    _isAdvertising.value = false
                }
            }

            registrationListener = listener
            nsd.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            Log.w(TAG, "Error advertising local Jam: ${e.message}")
        }
    }

    fun stopAdvertising() {
        activeAdvertisedCode = null
        val nsd = nsdManager ?: return
        registrationListener?.let {
            runCatching { nsd.unregisterService(it) }
        }
        registrationListener = null
        _isAdvertising.value = false
    }

    /**
     * Finds a local party code on the local Wi-Fi or Hotspot network.
     * Uses local cache, self-host check, active gateway/subnet probing, and mDNS.
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

        // 3. Launch active Gateway & Subnet probe in parallel with discovery wait loop
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

            // Prioritize nearby IPs around this device's address
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

            // 32 concurrent probe workers for rapid LAN sweep
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
