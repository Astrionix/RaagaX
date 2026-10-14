package com.music.raaga.data.connect

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Log
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
import java.util.ArrayDeque
import java.util.concurrent.ConcurrentHashMap

/**
 * Peer-to-peer discovery on local Wi-Fi for Raaga Connect on Android.
 * Dual-stack architecture:
 * 1. Android NSD (mDNS/DNS-SD `_raaga-connect._tcp`) for zero-conf cross-device discovery.
 * 2. UDP broadcast (port 8894) compatibility path across hotspot and legacy networks.
 */
class RaagaConnectDiscovery(
    private val localDeviceProvider: () -> ConnectDevice,
    private val broadcastPort: Int = 8894,
) {
    companion object {
        private const val TAG = "RaagaConnectDiscovery"
        const val SERVICE_TYPE = "_raaga-connect._tcp"
        private const val PREFIX_ANNOUNCE = "RAAGA_CONNECT:ANNOUNCE:"
        private const val PREFIX_DISCOVER = "RAAGA_CONNECT:DISCOVER:"
        private const val DEVICE_TIMEOUT_MS = 14_000L
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
    private var multicastLock: WifiManager.MulticastLock? = null

    // NSD Discovery and Registration
    private var nsdManager: NsdManager? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private val resolveQueue = ArrayDeque<NsdServiceInfo>()
    private var isResolving = false

    val isRunning: Boolean get() = (listenSocket != null && listenJob?.isActive == true) || discoveryListener != null

    fun start() {
        if (isRunning) return

        val ctx = AndroidConnect.appContext
        if (ctx != null) {
            try {
                val wifi = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                multicastLock = wifi?.createMulticastLock("raaga_connect_discovery")?.apply {
                    setReferenceCounted(true)
                    acquire()
                }
            } catch (_: Exception) {}

            try {
                startNsd(ctx)
            } catch (e: Exception) {
                Log.w(TAG, "NSD initialization failed: ${e.message}")
            }
        }

        // UDP broadcast socket setup
        try {
            val socket = DatagramSocket(null).apply {
                reuseAddress = true
                broadcast = true
                bind(InetSocketAddress(broadcastPort))
            }
            listenSocket = socket
        } catch (_: Exception) {
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

        stopNsd()

        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
            multicastLock = null
        } catch (_: Exception) {}

        deviceMap.clear()
        _discoveredDevices.value = emptyList()
    }

    private fun startNsd(context: Context) {
        val nsd = context.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
        nsdManager = nsd
        val local = localDeviceProvider()

        // 1. Register Local Service
        val serviceInfo = NsdServiceInfo().apply {
            serviceName = "RaagaConnect-${local.id.take(8)}"
            serviceType = SERVICE_TYPE
            port = local.port
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                setAttribute("id", local.id)
                setAttribute("name", local.name)
                setAttribute("type", local.type.name)
                setAttribute("v", "2")
            }
        }

        val regListener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(service: NsdServiceInfo) {
                Log.d(TAG, "Raaga Connect NSD service registered: ${service.serviceName}")
            }
            override fun onRegistrationFailed(service: NsdServiceInfo, errorCode: Int) {
                Log.w(TAG, "Raaga Connect NSD registration failed: $errorCode")
            }
            override fun onServiceUnregistered(service: NsdServiceInfo) {}
            override fun onUnregistrationFailed(service: NsdServiceInfo, errorCode: Int) {}
        }
        registrationListener = regListener

        try {
            nsd.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, regListener)
        } catch (e: Exception) {
            Log.w(TAG, "registerService error: ${e.message}")
        }

        // 2. Discover Remote Services
        val discListener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(regType: String) {
                Log.d(TAG, "NSD discovery started for $regType")
            }

            override fun onServiceFound(service: NsdServiceInfo) {
                val sName = service.serviceName ?: return
                if (!sName.startsWith("RaagaConnect-") && !sName.startsWith("Raaga-")) return
                queueResolve(nsd, service)
            }

            override fun onServiceLost(service: NsdServiceInfo) {
                Log.d(TAG, "NSD service lost: ${service.serviceName}")
            }

            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.w(TAG, "NSD startDiscovery failed: $errorCode")
            }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
        }
        discoveryListener = discListener

        try {
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discListener)
        } catch (e: Exception) {
            Log.w(TAG, "discoverServices error: ${e.message}")
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
                        val local = localDeviceProvider()
                        if (host != null && !host.startsWith("127.")) {
                            var deviceId = ""
                            var deviceName = resolved.serviceName
                            var deviceType = ConnectDeviceType.DESKTOP

                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                resolved.attributes["id"]?.let {
                                    deviceId = String(it, StandardCharsets.UTF_8).trim()
                                }
                                resolved.attributes["name"]?.let {
                                    deviceName = String(it, StandardCharsets.UTF_8).trim()
                                }
                                resolved.attributes["type"]?.let {
                                    val str = String(it, StandardCharsets.UTF_8).trim()
                                    deviceType = runCatching { ConnectDeviceType.valueOf(str) }.getOrDefault(ConnectDeviceType.DESKTOP)
                                }
                            }

                            if (deviceId.isNotBlank() && deviceId != local.id) {
                                val discovered = ConnectDevice(
                                    id = deviceId,
                                    name = deviceName,
                                    type = deviceType,
                                    host = host,
                                    port = resolved.port,
                                    lastSeenTimestamp = System.currentTimeMillis(),
                                    isCloud = false,
                                )
                                deviceMap[deviceId] = discovered
                                _discoveredDevices.value = deviceMap.values.toList()
                            }
                        }
                    } finally {
                        resolveNext(nsd)
                    }
                }

                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    resolveNext(nsd)
                }
            })
        } catch (e: Exception) {
            resolveNext(nsd)
        }
    }

    private fun stopNsd() {
        val nsd = nsdManager ?: return
        try {
            registrationListener?.let { nsd.unregisterService(it) }
        } catch (_: Exception) {}
        registrationListener = null

        try {
            discoveryListener?.let { nsd.stopServiceDiscovery(it) }
        } catch (_: Exception) {}
        discoveryListener = null

        synchronized(resolveQueue) {
            resolveQueue.clear()
            isResolving = false
        }
        nsdManager = null
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
                    sendAnnounce()
                }
            }
        }
    }
}
