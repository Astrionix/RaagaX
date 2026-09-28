package com.music.aether.data.listentogether.local

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import com.music.aether.data.DebugLog as Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.net.InetAddress
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
 * LocalJamDiscovery — Manages mDNS / DNS-SD on the local Wi-Fi network.
 *
 * Advertises active local Jam party codes and discovers peers on the same LAN,
 * enabling sub-5ms latency and zero cloud data consumption when users are on
 * the same Wi-Fi.
 */
object LocalJamDiscovery {

    private const val TAG = "LocalJamDiscovery"
    const val SERVICE_TYPE = "_aether-jam._tcp."

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var nsdManager: NsdManager? = null

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

    fun startDiscovery(context: Context) {
        if (_isDiscovering.value) return
        try {
            val nsd = context.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
            nsdManager = nsd

            val listener = object : NsdManager.DiscoveryListener {
                override fun onDiscoveryStarted(regType: String) {
                    _isDiscovering.value = true
                    Log.d(TAG, "Local Wi-Fi Jam discovery started: $regType")
                }

                override fun onServiceFound(service: NsdServiceInfo) {
                    val name = service.serviceName ?: return
                    // Service name format: AetherJam-CODE or AetherJam-CODE-extra
                    if (!name.startsWith("AetherJam-")) return
                    if (name.contains(Build.MODEL) && activeAdvertisedCode != null) return // Skip own broadcast

                    resolveService(nsd, service)
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

    private fun resolveService(nsd: NsdManager, service: NsdServiceInfo) {
        try {
            nsd.resolveService(service, object : NsdManager.ResolveListener {
                override fun onServiceResolved(resolved: NsdServiceInfo) {
                    val host = resolved.host?.hostAddress ?: return
                    // Avoid local loopback if on another device
                    if (host.startsWith("127.")) return
                    val port = resolved.port
                    val name = resolved.serviceName
                    val code = extractCode(name) ?: return

                    val endpoint = LocalJamEndpoint(
                        code = code,
                        host = host,
                        port = port,
                        serviceName = name,
                    )
                    discoveredEndpoints[code] = endpoint
                    _activeLocalEndpoints.value = discoveredEndpoints.toMap()
                    Log.i(TAG, "Found Local Wi-Fi Jam: $code at http://$host:$port")
                }

                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    Log.w(TAG, "Failed to resolve local Jam service: $errorCode")
                }
            })
        } catch (e: Exception) {
            Log.w(TAG, "Error resolving service: ${e.message}")
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
    }

    fun startAdvertising(context: Context, code: String, port: Int) {
        stopAdvertising()
        try {
            val nsd = context.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
            nsdManager = nsd
            val cleanCode = code.filter { it.isLetterOrDigit() }.uppercase()
            activeAdvertisedCode = cleanCode

            val serviceInfo = NsdServiceInfo().apply {
                serviceName = "AetherJam-$cleanCode-${Build.MODEL.filter { it.isLetterOrDigit() }.take(6)}"
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
     * Checks if a party code is available on the local Wi-Fi network.
     *
     * @param code The 6-character party room code
     * @param waitTimeoutMs How long to wait for mDNS discovery if not cached yet
     * @return [LocalJamEndpoint] if found on local Wi-Fi, null if not found (fallback to Cloud)
     */
    suspend fun findLocalJam(code: String, waitTimeoutMs: Long = 500L): LocalJamEndpoint? {
        val clean = code.filter { it.isLetterOrDigit() }.uppercase()
        // 1. Check existing cache
        discoveredEndpoints[clean]?.let { return it }

        // 2. Brief wait loop in case discovery is actively resolving
        val start = System.currentTimeMillis()
        while (System.currentTimeMillis() - start < waitTimeoutMs) {
            delay(50)
            discoveredEndpoints[clean]?.let { return it }
        }
        return null
    }

    private fun extractCode(serviceName: String): String? {
        if (!serviceName.startsWith("AetherJam-")) return null
        val parts = serviceName.removePrefix("AetherJam-").split("-")
        return parts.firstOrNull()?.filter { it.isLetterOrDigit() }?.uppercase()?.take(6)
    }
}
