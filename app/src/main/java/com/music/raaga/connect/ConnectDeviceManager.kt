package com.music.raaga.connect

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import com.music.raaga.data.TrackLog
import com.music.raaga.playback.AudioOutputStatus
import com.music.raaga.playback.AudioRouting
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * ConnectDeviceManager — Manages local hardware audio sinks and discovered remote
 * devices for Spotify Connect-style playback handover and remote control.
 *
 * Real device discovery is performed through:
 * 1. Android NSD (mDNS DNS-SD) for low-latency LAN devices on Wi-Fi.
 * 2. RaagaSyncClient real-time WebSocket coordinator for Web / PC / Mac peers.
 */
object ConnectDeviceManager {

    private const val TAG = "ConnectDeviceManager"
    private const val SERVICE_TYPE = "_raaga-connect._tcp"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private const val LOCAL_DEVICE_ID = "this_device"

    private val _activeDeviceId = MutableStateFlow(LOCAL_DEVICE_ID)
    val activeDeviceId: StateFlow<String> = _activeDeviceId.asStateFlow()

    private val _remoteVolume = MutableStateFlow(0.85f)
    val remoteVolume: StateFlow<Float> = _remoteVolume.asStateFlow()

    // Discovered network devices (LAN & Cloud Connect peers) — empty by default, populated dynamically
    private val _networkDevices = MutableStateFlow<List<ConnectDevice>>(emptyList())
    val networkDevices: StateFlow<List<ConnectDevice>> = _networkDevices.asStateFlow()

    private val _lastRemoteSnapshot = MutableStateFlow<RemotePlaybackSnapshot?>(null)
    val lastRemoteSnapshot: StateFlow<RemotePlaybackSnapshot?> = _lastRemoteSnapshot.asStateFlow()

    val isRemoteActive: StateFlow<Boolean> = combine(activeDeviceId) { (currentId) ->
        currentId != LOCAL_DEVICE_ID
    }.stateIn(scope, SharingStarted.Eagerly, false)

    private var nsdManager: NsdManager? = null
    private var isNsdStarted = false
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null

    fun startDiscovery(context: Context) {
        RaagaSyncClient.start()
        startNsd(context)
    }

    fun stopDiscovery() {
        if (!isRemoteActive.value && !com.music.raaga.data.listentogether.ListenTogether.state.value.inParty) {
            stopNsd()
            RaagaSyncClient.stop()
        }
    }

    fun startNsd(context: Context) {
        if (isNsdStarted) return
        try {
            val nsd = context.applicationContext.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
            nsdManager = nsd
            isNsdStarted = true

            // Register this device
            val serviceInfo = NsdServiceInfo().apply {
                serviceName = "Raaga ${Build.MODEL.ifBlank { "Mobile" }}"
                serviceType = SERVICE_TYPE
                port = 8888
            }

            val regListener = object : NsdManager.RegistrationListener {
                override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {
                    TrackLog.d(TAG, "NSD registered: ${serviceInfo.serviceName}")
                }
                override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    TrackLog.w(TAG, "NSD registration failed: $errorCode")
                }
                override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {}
                override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
            }
            registrationListener = regListener
            nsd.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, regListener)

            // Discover other Raaga devices on local Wi-Fi
            val discListener = object : NsdManager.DiscoveryListener {
                override fun onDiscoveryStarted(regType: String) {
                    TrackLog.d(TAG, "NSD discovery started: $regType")
                }
                override fun onServiceFound(service: NsdServiceInfo) {
                    if (service.serviceName.contains(Build.MODEL)) return // skip self
                    nsd.resolveService(service, object : NsdManager.ResolveListener {
                        override fun onServiceResolved(resolved: NsdServiceInfo) {
                            val host = resolved.host?.hostAddress ?: return
                            val device = ConnectDevice(
                                id = "lan_$host",
                                name = resolved.serviceName,
                                type = DeviceType.SPEAKER,
                                transport = TransportKind.LOCAL_LAN,
                                latencyMs = 8,
                                ipAddress = host,
                                canReceiveAudio = true,
                                canControl = true,
                            )
                            addDiscoveredDevice(device)
                        }
                        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                    })
                }
                override fun onServiceLost(service: NsdServiceInfo) {
                    _networkDevices.update { list -> list.filter { it.name != service.serviceName } }
                }
                override fun onDiscoveryStopped(serviceType: String) {}
                override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
                override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
            }
            discoveryListener = discListener
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discListener)
        } catch (e: Exception) {
            TrackLog.w(TAG, "Failed to start NSD: ${e.message}")
        }
    }

    fun stopNsd() {
        if (!isNsdStarted) return
        try {
            val nsd = nsdManager ?: return
            discoveryListener?.let { runCatching { nsd.stopServiceDiscovery(it) } }
            registrationListener?.let { runCatching { nsd.unregisterService(it) } }
        } catch (e: Exception) {
            TrackLog.w(TAG, "Error stopping NSD: ${e.message}")
        } finally {
            isNsdStarted = false
            discoveryListener = null
            registrationListener = null
        }
    }

    fun isCurrentDevice(id: String): Boolean = _activeDeviceId.value == id

    /**
     * Handover playback to a target device (Local or Remote).
     *
     * @param targetId Target device ID
     * @param currentTrackId Currently playing videoId (if any)
     * @param positionMs Current position in milliseconds
     * @param isPlaying Whether playback was actively in progress
     * @param title Track title (if available)
     * @param artist Track artist (if available)
     * @param thumbnailUrl Cover art URL (if available)
     * @param onPauseLocal Callback to pause local ExoPlayer when moving to remote
     * @param onResumeLocal Callback to resume local ExoPlayer when returning to local
     */
    fun transferPlayback(
        targetId: String,
        currentTrackId: String?,
        positionMs: Long,
        isPlaying: Boolean,
        title: String? = null,
        artist: String? = null,
        thumbnailUrl: String? = null,
        onPauseLocal: () -> Unit = {},
        onResumeLocal: (seekMs: Long) -> Unit = {},
    ) {
        val previousId = _activeDeviceId.value
        if (previousId == targetId) return

        _activeDeviceId.value = targetId

        if (targetId == LOCAL_DEVICE_ID) {
            // Handover from remote to local
            val remotePos = _lastRemoteSnapshot.value?.positionMs ?: positionMs
            onResumeLocal(remotePos)
        } else {
            // Handover from local to remote target
            onPauseLocal()
            _lastRemoteSnapshot.value = RemotePlaybackSnapshot(
                videoId = currentTrackId,
                title = title,
                artist = artist,
                thumbnailUrl = thumbnailUrl,
                positionMs = positionMs,
                durationMs = 0,
                isPlaying = isPlaying,
                volume = _remoteVolume.value,
            )
            // Send live Spotify Connect handover to PC (raaga.me) via RaagaSyncCoordinator
            RaagaSyncClient.sendTransferToPeer(
                targetDeviceId = targetId,
                trackId = currentTrackId,
                title = title,
                artist = artist,
                coverUrl = thumbnailUrl,
                positionMs = positionMs,
                isPlaying = isPlaying,
            )
            // Dispatch SWITCH_PLAYBACK remote command to target device
            dispatchRemoteCommand(
                RemoteCommand.SwitchPlayback(
                    videoId = currentTrackId ?: "",
                    positionMs = positionMs,
                    isPlaying = isPlaying,
                ),
            )
        }
    }

    fun setRemoteVolume(vol: Float) {
        val clamped = vol.coerceIn(0f, 1f)
        _remoteVolume.value = clamped
        dispatchRemoteCommand(RemoteCommand.Volume(clamped))
    }

    fun dispatchRemoteCommand(command: RemoteCommand) {
        val target = _activeDeviceId.value
        if (target != LOCAL_DEVICE_ID) {
            RaagaSyncClient.sendRemoteCommand(target, command)
        }
        scope.launch {
            when (command) {
                is RemoteCommand.Play -> {
                    _lastRemoteSnapshot.update { it?.copy(isPlaying = true) }
                }
                is RemoteCommand.Pause -> {
                    _lastRemoteSnapshot.update { it?.copy(isPlaying = false) }
                }
                is RemoteCommand.Seek -> {
                    _lastRemoteSnapshot.update { it?.copy(positionMs = command.positionMs) }
                }
                is RemoteCommand.Volume -> {
                    _remoteVolume.value = command.volume
                }
                else -> Unit
            }
        }
    }

    /** Helper to format audio specification string from [AudioOutputStatus.Snapshot]. */
    fun formatLocalSpec(status: AudioOutputStatus.Snapshot): String {
        val encoding = AudioOutputStatus.encodingLabel(status)
        val rate = status.actualSampleRateHz?.takeIf { it > 0 } ?: return encoding
        val khz = "%.1f".format(Locale.ROOT, rate / 1000f).removeSuffix(".0")
        return "$encoding · $khz kHz"
    }

    fun addDiscoveredDevice(device: ConnectDevice) {
        _networkDevices.update { list ->
            if (list.any { it.id == device.id }) {
                list.map { if (it.id == device.id) device else it }
            } else {
                list + device
            }
        }
    }

    fun updateDiscoveredDevices(remoteList: List<ConnectDevice>) {
        if (remoteList.isEmpty()) {
            // Keep local LAN devices, remove cloud devices that went offline
            _networkDevices.update { current -> current.filter { it.transport == TransportKind.LOCAL_LAN } }
            return
        }
        _networkDevices.update { current ->
            val lanDevices = current.filter { it.transport == TransportKind.LOCAL_LAN }
            val existingLanIds = lanDevices.map { it.id }.toSet()
            val filteredRemote = remoteList.filter { it.id !in existingLanIds }
            lanDevices + filteredRemote
        }
    }
}

