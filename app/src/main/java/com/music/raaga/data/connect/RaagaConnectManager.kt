package com.music.raaga.data.connect

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.net.InetAddress
import java.net.NetworkInterface
import java.util.UUID

/**
 * Coordinates Raaga Connect functionality on Android:
 * - Local receiver server (LAN)
 * - Wi-Fi device discovery (UDP)
 * - Supabase Cloud Realtime relay (Internet / 5G / Remote)
 * - 2-Way Playback transfer & remote control
 */
class RaagaConnectManager(
    initialDeviceName: String,
    val deviceType: ConnectDeviceType,
    private val getLocalPlaybackStatus: () -> ConnectDeviceStatus,
    private val getLocalPlaybackQueue: () -> List<ConnectTrack> = { emptyList() },
    private val onPlaybackTransferredToMe: (ConnectPlaybackTransfer) -> Unit,
    private val onRemoteControlCommand: (ConnectControlCommand) -> Unit,
    private val onTransferBackRequested: (ConnectTrack?, Long, Boolean) -> Unit = { _, _, _ -> },
    private val onLocalPlaybackHandoffCompleted: () -> Unit = {},
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val deviceId: String = RaagaPairingStore.deviceId

    private val _deviceName = MutableStateFlow(
        RaagaPairingStore.getCustomDeviceName() ?: initialDeviceName
    )
    val currentDeviceName: StateFlow<String> = _deviceName.asStateFlow()
    val deviceName: String get() = _deviceName.value

    fun updateDeviceName(name: String) {
        val trimmed = name.trim()
        if (trimmed.isNotBlank()) {
            _deviceName.value = trimmed
            RaagaPairingStore.saveCustomDeviceName(trimmed)
            refreshDiscovery()
        }
    }

    private var serverPort: Int = 8895

    val localDevice: ConnectDevice
        get() = ConnectDevice(
            id = deviceId,
            name = deviceName,
            type = deviceType,
            host = getLocalIpAddress(),
            port = serverPort,
            lastSeenTimestamp = System.currentTimeMillis(),
            isCloud = false,
        )

    private val server = RaagaConnectServer(
        getStatus = {
            getLocalPlaybackStatus().copy(
                deviceId = deviceId,
                deviceName = deviceName,
                deviceType = deviceType,
            )
        },
        onTransfer = { transfer ->
            _activeRemoteDevice.value = null
            onPlaybackTransferredToMe(transfer)
        },
        onControl = { cmd ->
            onRemoteControlCommand(cmd)
        },
        preferredPort = 8895,
    )

    private val discovery = RaagaConnectDiscovery(
        localDeviceProvider = { localDevice },
        broadcastPort = 8894,
    )

    private val supabaseRelay = RaagaSupabaseRelay(
        localDeviceProvider = { localDevice },
        onTransferReceived = { transfer ->
            _activeRemoteDevice.value = null
            onPlaybackTransferredToMe(transfer)
            scope.launch {
                delay(300)
                broadcastLocalStatusToCloud()
            }
        },
        onControlReceived = { cmd ->
            if (cmd.action == "QUERY_STATUS") {
                broadcastLocalStatusToCloud()
            } else {
                onRemoteControlCommand(cmd)
                scope.launch {
                    delay(200)
                    broadcastLocalStatusToCloud()
                }
            }
        },
        onStatusReceived = { status ->
            val active = _activeRemoteDevice.value
            if (active != null && (active.id == status.deviceId || status.deviceId.isBlank())) {
                val dur = if (status.durationMs > 0L) status.durationMs else parseDurationTextToMs(status.track?.durationText)
                _remoteStatus.value = status.copy(durationMs = dur)
            }
        },
        onPairRequestReceived = { req ->
            handlePairRequest(req)
        },
        onPairResponseReceived = { resp ->
            handlePairResponse(resp)
        },
    )

    private val _mergedDevices = MutableStateFlow<List<ConnectDevice>>(emptyList())
    val discoveredDevices: StateFlow<List<ConnectDevice>> = _mergedDevices.asStateFlow()

    private val _pairedDevicesWithStatus = MutableStateFlow<List<PairedDeviceWithStatus>>(emptyList())
    val pairedDevicesWithStatus: StateFlow<List<PairedDeviceWithStatus>> = _pairedDevicesWithStatus.asStateFlow()

    private val _unpairedDiscoveredDevices = MutableStateFlow<List<ConnectDevice>>(emptyList())
    val unpairedDiscoveredDevices: StateFlow<List<ConnectDevice>> = _unpairedDiscoveredDevices.asStateFlow()

    val activePairCode = MutableStateFlow<String?>(null)
    val activePairCodeExpiresAt = MutableStateFlow<Long>(0L)
    val pairingFeedback = MutableStateFlow<String?>(null)
    val isPairingSubmitting = MutableStateFlow<Boolean>(false)

    private val _connectingDeviceId = MutableStateFlow<String?>(null)
    /** ID of device currently in the process of handoff/connecting */
    val connectingDeviceId: StateFlow<String?> = _connectingDeviceId.asStateFlow()

    private val _activeRemoteDevice = MutableStateFlow<ConnectDevice?>(null)
    /** When non-null, this device is acting as remote controller for the target device. */
    val activeRemoteDevice: StateFlow<ConnectDevice?> = _activeRemoteDevice.asStateFlow()

    private val _remoteStatus = MutableStateFlow<ConnectDeviceStatus?>(null)
    val remoteStatus: StateFlow<ConnectDeviceStatus?> = _remoteStatus.asStateFlow()

    private var statusPollJob: Job? = null
    private var pendingPairJob: Job? = null

    init {
        scope.launch {
            combine(
                discovery.discoveredDevices,
                supabaseRelay.discoveredCloudDevices,
            ) { local, cloud ->
                val localIds = local.map { it.id }.toSet()
                // Prefer local low-latency connection, append remote cloud devices
                local + cloud.filter { it.id !in localIds }
            }.collect {
                _mergedDevices.value = it
            }
        }

        // Combine paired devices with live discovered status
        scope.launch {
            combine(
                RaagaPairingStore.pairedDevices,
                _mergedDevices,
            ) { paired, discovered ->
                val discMap = discovered.associateBy { it.id }
                paired.map { p ->
                    PairedDeviceWithStatus(
                        paired = p,
                        onlineDevice = discMap[p.id],
                    )
                }
            }.collect {
                _pairedDevicesWithStatus.value = it
            }
        }

        // Discovered devices that are not yet paired
        scope.launch {
            combine(
                RaagaPairingStore.pairedDevices,
                _mergedDevices,
            ) { paired, discovered ->
                val pairedIds = paired.map { it.id }.toSet()
                discovered.filter { it.id !in pairedIds }
            }.collect {
                _unpairedDiscoveredDevices.value = it
            }
        }
    }

    fun generatePairCode(): String {
        val code = (100000..999999).random().toString()
        activePairCode.value = code
        activePairCodeExpiresAt.value = System.currentTimeMillis() + 5 * 60 * 1000L
        pairingFeedback.value = null
        return code
    }

    fun cancelPairCode() {
        activePairCode.value = null
        pairingFeedback.value = null
    }

    fun submitPairCode(rawCode: String, onResult: (Boolean, String) -> Unit = { _, _ -> }) {
        val clean = rawCode.filter { it.isDigit() }
        if (clean.length != 6) {
            val msg = "Please enter a 6-digit code"
            pairingFeedback.value = msg
            onResult(false, msg)
            return
        }
        isPairingSubmitting.value = true
        pairingFeedback.value = "Connecting to device..."
        supabaseRelay.sendPairRequest(ConnectPairRequest(code = clean, fromDevice = localDevice))

        pendingPairJob?.cancel()
        pendingPairJob = scope.launch {
            val start = System.currentTimeMillis()
            while (isActive && System.currentTimeMillis() - start < 10_000L) {
                delay(300)
                if (!isPairingSubmitting.value) {
                    return@launch
                }
            }
            if (isPairingSubmitting.value) {
                isPairingSubmitting.value = false
                val timeoutMsg = "Device not found or code expired. Try again."
                pairingFeedback.value = timeoutMsg
                onResult(false, timeoutMsg)
            }
        }
    }

    fun unpairDevice(deviceId: String) {
        RaagaPairingStore.removePairedDevice(deviceId)
    }

    fun pairDeviceDirectly(device: ConnectDevice) {
        val cleanName = device.name.removeSuffix(" (Cloud)").removeSuffix(" (PC)")
        RaagaPairingStore.addPairedDevice(
            PairedDevice(
                id = device.id,
                name = cleanName,
                type = device.type,
                pairedAt = System.currentTimeMillis(),
            )
        )
    }

    private fun handlePairRequest(request: ConnectPairRequest) {
        val code = activePairCode.value
        val expiresAt = activePairCodeExpiresAt.value
        if (code != null && code == request.code && System.currentTimeMillis() <= expiresAt) {
            val cleanName = request.fromDevice.name.removeSuffix(" (Cloud)")
            val paired = PairedDevice(
                id = request.fromDevice.id,
                name = cleanName,
                type = request.fromDevice.type,
                pairedAt = System.currentTimeMillis(),
            )
            RaagaPairingStore.addPairedDevice(paired)
            activePairCode.value = null
            pairingFeedback.value = "Successfully paired with $cleanName!"
            supabaseRelay.sendPairResponse(
                ConnectPairResponse(
                    code = request.code,
                    success = true,
                    message = "Paired with $deviceName",
                    fromDevice = localDevice,
                    targetDeviceId = request.fromDevice.id,
                )
            )
        }
    }

    private fun handlePairResponse(response: ConnectPairResponse) {
        if (response.targetDeviceId == deviceId && response.success) {
            val cleanName = response.fromDevice.name.removeSuffix(" (Cloud)")
            val paired = PairedDevice(
                id = response.fromDevice.id,
                name = cleanName,
                type = response.fromDevice.type,
                pairedAt = System.currentTimeMillis(),
            )
            RaagaPairingStore.addPairedDevice(paired)
            isPairingSubmitting.value = false
            pairingFeedback.value = "Successfully paired with $cleanName!"
        }
    }

    private var cloudStatusBroadcastJob: Job? = null

    fun broadcastLocalStatusToCloud() {
        val base = getLocalPlaybackStatus()
        val dur = if (base.durationMs > 0L) base.durationMs else parseDurationTextToMs(base.track?.durationText)
        val fullStatus = base.copy(
            deviceId = deviceId,
            deviceName = deviceName,
            deviceType = deviceType,
            durationMs = dur,
        )
        supabaseRelay.sendStatus(fullStatus)
    }

    private fun startCloudStatusBroadcast() {
        cloudStatusBroadcastJob?.cancel()
        cloudStatusBroadcastJob = scope.launch {
            var lastTrackId: String? = null
            var lastIsPlaying: Boolean? = null
            var idleTicks = 0
            while (isActive) {
                // Broadcast local status when this device is the speaker (not controlling a remote device)
                if (_activeRemoteDevice.value == null) {
                    val status = getLocalPlaybackStatus()
                    val track = status.track
                    if (track != null) {
                        val trackChanged = track.videoId != lastTrackId
                        val playStateChanged = status.isPlaying != lastIsPlaying
                        if (status.isPlaying || trackChanged || playStateChanged || idleTicks % 3 == 0) {
                            broadcastLocalStatusToCloud()
                        }
                        lastTrackId = track.videoId
                        lastIsPlaying = status.isPlaying
                        if (!status.isPlaying) idleTicks++ else idleTicks = 0
                    }
                }
                delay(1000)
            }
        }
    }

    fun start() {
        serverPort = server.start()
        discovery.start()
        supabaseRelay.start()
        startCloudStatusBroadcast()
    }

    fun stop() {
        cloudStatusBroadcastJob?.cancel()
        statusPollJob?.cancel()
        discovery.stop()
        supabaseRelay.stop()
        server.stop()
    }

    fun refreshDiscovery() {
        discovery.sendDiscover()
        supabaseRelay.sendAnnounce()
    }

    /**
     * Transfer playback to another device on the network or cloud.
     */
    fun transferTo(
        target: ConnectDevice,
        currentTrack: ConnectTrack?,
        positionMs: Long,
        isPlaying: Boolean,
        volume: Float? = null,
        queue: List<ConnectTrack> = emptyList(),
        onSuccess: () -> Unit = {},
        onError: (Throwable) -> Unit = {},
    ) {
        if (currentTrack == null) {
            _activeRemoteDevice.value = target
            startRemoteStatusPolling(target)
            onSuccess()
            return
        }

        _connectingDeviceId.value = target.id
        scope.launch {
            val payload = ConnectPlaybackTransfer(
                track = currentTrack,
                positionMs = positionMs,
                isPlaying = isPlaying,
                volume = volume,
                queue = queue,
                sourceDeviceId = deviceId,
                sourceDeviceName = deviceName,
                targetDeviceId = target.id,
            )

            if (target.isCloud) {
                val initialDur = if (currentTrack.durationText != null) {
                    parseDurationTextToMs(currentTrack.durationText)
                } else 0L
                _remoteStatus.value = ConnectDeviceStatus(
                    deviceId = target.id,
                    deviceName = target.name,
                    deviceType = target.type,
                    isPlaying = isPlaying,
                    track = currentTrack,
                    positionMs = positionMs,
                    durationMs = initialDur,
                    volume = volume ?: 1.0f,
                )
                supabaseRelay.sendTransfer(target.id, payload)
                _activeRemoteDevice.value = target
                startRemoteStatusPolling(target)
                onLocalPlaybackHandoffCompleted()
                _connectingDeviceId.value = null
                onSuccess()
            } else {
                val res = RaagaConnectClient.transferPlayback(target, payload)
                if (res.isSuccess && res.getOrNull() == true) {
                    _activeRemoteDevice.value = target
                    startRemoteStatusPolling(target)
                    onLocalPlaybackHandoffCompleted()
                    _connectingDeviceId.value = null
                    onSuccess()
                } else {
                    _connectingDeviceId.value = null
                    onError(res.exceptionOrNull() ?: Exception("Transfer failed"))
                }
            }
        }
    }

    /**
     * Helper to transfer whatever is currently loaded/playing locally.
     */
    fun transferLocalPlaybackTo(
        target: ConnectDevice,
        onSuccess: () -> Unit = {},
        onError: (Throwable) -> Unit = {},
    ) {
        val status = getLocalPlaybackStatus()
        val queue = getLocalPlaybackQueue()
        transferTo(
            target = target,
            currentTrack = status.track,
            positionMs = status.positionMs,
            isPlaying = status.isPlaying,
            volume = status.volume,
            queue = queue,
            onSuccess = onSuccess,
            onError = onError,
        )
    }

    /**
     * Switch playback back from the remote device to this local device.
     */
    fun transferBackToThisDevice() {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            // 1. Get latest status from remote device
            val status = if (target.isCloud) {
                _remoteStatus.value
            } else {
                RaagaConnectClient.queryStatus(target).getOrNull()
            }

            // 2. Pause remote device
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, ConnectControlCommand(action = "PAUSE", targetDeviceId = target.id))
            } else {
                RaagaConnectClient.sendControl(target, ConnectControlCommand(action = "PAUSE"))
            }

            // 3. Clear remote state
            statusPollJob?.cancel()
            _activeRemoteDevice.value = null
            _remoteStatus.value = null

            // 4. Resume locally
            if (status?.track != null) {
                onTransferBackRequested(status.track, status.positionMs, status.isPlaying)
            }
        }
    }

    // --- Remote Control Actions ---

    fun sendPlay() {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, ConnectControlCommand(action = "PLAY", targetDeviceId = target.id))
            } else {
                RaagaConnectClient.sendControl(target, ConnectControlCommand(action = "PLAY"))
            }
            updateRemoteStatusOptimistically { it.copy(isPlaying = true) }
            delay(150)
            pollRemoteStatusNow(target)
        }
    }

    fun sendPause() {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, ConnectControlCommand(action = "PAUSE", targetDeviceId = target.id))
            } else {
                RaagaConnectClient.sendControl(target, ConnectControlCommand(action = "PAUSE"))
            }
            updateRemoteStatusOptimistically { it.copy(isPlaying = false) }
            delay(150)
            pollRemoteStatusNow(target)
        }
    }

    fun sendToggle() {
        val target = _activeRemoteDevice.value ?: return
        val currentIsPlaying = _remoteStatus.value?.isPlaying ?: false
        val nextPlaying = !currentIsPlaying
        scope.launch {
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, ConnectControlCommand(action = "TOGGLE", targetDeviceId = target.id))
            } else {
                RaagaConnectClient.sendControl(target, ConnectControlCommand(action = "TOGGLE"))
            }
            updateRemoteStatusOptimistically { it.copy(isPlaying = nextPlaying) }
            delay(150)
            pollRemoteStatusNow(target)
        }
    }

    private var volumeJob: Job? = null
    private var lastSkipTimestamp: Long = 0L

    fun sendNext() {
        val target = _activeRemoteDevice.value ?: return
        val now = System.currentTimeMillis()
        if (now - lastSkipTimestamp < 350L) return
        lastSkipTimestamp = now

        scope.launch {
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, ConnectControlCommand(action = "NEXT", targetDeviceId = target.id))
            } else {
                RaagaConnectClient.sendControl(target, ConnectControlCommand(action = "NEXT"))
            }
            delay(800)
            pollRemoteStatusNow(target)
        }
    }

    fun sendPrevious() {
        val target = _activeRemoteDevice.value ?: return
        val now = System.currentTimeMillis()
        if (now - lastSkipTimestamp < 350L) return
        lastSkipTimestamp = now

        scope.launch {
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, ConnectControlCommand(action = "PREV", targetDeviceId = target.id))
            } else {
                RaagaConnectClient.sendControl(target, ConnectControlCommand(action = "PREV"))
            }
            delay(800)
            pollRemoteStatusNow(target)
        }
    }

    fun sendSeek(positionMs: Long) {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, ConnectControlCommand(action = "SEEK", positionMs = positionMs, targetDeviceId = target.id))
            } else {
                RaagaConnectClient.sendControl(target, ConnectControlCommand(action = "SEEK", positionMs = positionMs))
            }
            updateRemoteStatusOptimistically { it.copy(positionMs = positionMs) }
            delay(250)
            pollRemoteStatusNow(target)
        }
    }

    fun sendVolume(volume: Float) {
        val target = _activeRemoteDevice.value ?: return
        updateRemoteStatusOptimistically { it.copy(volume = volume) }
        volumeJob?.cancel()
        volumeJob = scope.launch {
            delay(50)
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, ConnectControlCommand(action = "VOLUME", volume = volume, targetDeviceId = target.id))
            } else {
                RaagaConnectClient.sendControl(target, ConnectControlCommand(action = "VOLUME", volume = volume))
            }
        }
    }

    private fun startRemoteStatusPolling(target: ConnectDevice) {
        statusPollJob?.cancel()
        statusPollJob = scope.launch {
            pollRemoteStatusNow(target)
            while (isActive && _activeRemoteDevice.value?.id == target.id) {
                delay(800)
                pollRemoteStatusNow(target)
            }
        }
    }

    private suspend fun pollRemoteStatusNow(target: ConnectDevice) {
        if (!target.isCloud) {
            val res = RaagaConnectClient.queryStatus(target)
            if (res.isSuccess) {
                val s = res.getOrNull()
                if (s != null) {
                    val dur = if (s.durationMs > 0L) s.durationMs else parseDurationTextToMs(s.track?.durationText)
                    _remoteStatus.value = s.copy(durationMs = dur)
                }
            }
        } else {
            supabaseRelay.sendControl(
                target.id,
                ConnectControlCommand(action = "QUERY_STATUS", targetDeviceId = target.id),
            )
        }
    }

    private fun updateRemoteStatusOptimistically(transform: (ConnectDeviceStatus) -> ConnectDeviceStatus) {
        val cur = _remoteStatus.value ?: return
        _remoteStatus.value = transform(cur)
    }

    private fun getLocalIpAddress(): String {
        return try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue
                val addresses = iface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (!addr.isLoopbackAddress && addr.isSiteLocalAddress) {
                        return addr.hostAddress ?: "127.0.0.1"
                    }
                }
            }
            "127.0.0.1"
        } catch (_: Exception) {
            "127.0.0.1"
        }
    }
}
