package com.music.raaga.data.connect

import com.music.raaga.data.MonotonicClock
import kotlinx.coroutines.CompletableDeferred
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
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.net.InetAddress
import java.net.NetworkInterface
import java.security.SecureRandom
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Coordinates Raaga Connect functionality on Desktop:
 * - Local receiver server (LAN) with Two-Phase Commit and clock synchronization
 * - Wi-Fi device discovery (UDP)
 * - Supabase / Cloudflare Cloud Realtime relay (Internet / 5G / Remote)
 * - 2-Way Playback transfer, scheduled handoffs, and remote control
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
    private val accountIdProvider: () -> String? = { null },
    private val onHandoffPrepareRequested: (suspend (ConnectHandoffPacket) -> ConnectHandoffPacket)? = null,
    private val onHandoffCommitRequested: (suspend (ConnectHandoffPacket) -> ConnectHandoffPacket)? = null,
    private val onHandoffAbortRequested: ((ConnectHandoffPacket) -> Unit)? = null,
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

    private val pendingHandoffDeferred = ConcurrentHashMap<String, CompletableDeferred<ConnectHandoffPacket>>()
    private val pendingClockSyncDeferred = ConcurrentHashMap<Long, CompletableDeferred<ConnectClockSyncResponse>>()
    @Volatile
    private var lastCalibratedClockOffsetMs: Long = 0L
    private var commandSeq = 0L

    private val server = RaagaConnectServer(
        getStatus = {
            val localStatus = getLocalPlaybackStatus()
            val isRemoteController = _activeRemoteDevice.value != null
            localStatus.copy(
                deviceId = deviceId,
                deviceName = deviceName,
                deviceType = deviceType,
                protocolVersion = 2,
                activeSpeakerDeviceId = if (!isRemoteController && localStatus.isPlaying) deviceId else null,
                anchorMonotonicMs = MonotonicClock.nowMs(),
            )
        },
        onTransfer = { transfer ->
            _activeRemoteDevice.value = null
            onPlaybackTransferredToMe(transfer)
        },
        onControl = { cmd ->
            onRemoteControlCommand(cmd)
        },
        onHandoffPrepare = { packet ->
            onHandoffPrepareRequested?.invoke(packet)
                ?: packet.copy(phase = HandoffPhase.READY, bufferReadyDurationMs = 1500L)
        },
        onHandoffCommit = { packet ->
            _activeRemoteDevice.value = null
            onHandoffCommitRequested?.invoke(packet)
                ?: packet.copy(phase = HandoffPhase.CONFIRMED)
        },
        onHandoffAbort = { packet ->
            onHandoffAbortRequested?.invoke(packet)
        },
        onPair = { req -> handlePairRequestDirect(req) },
        accountIdProvider = accountIdProvider,
        preferredPort = 8895,
    )

    private val discovery = RaagaConnectDiscovery(
        localDeviceProvider = { localDevice },
        broadcastPort = 8894,
    )

    private val supabaseRelay = RaagaSupabaseRelay(
        localDeviceProvider = { localDevice },
        accountIdProvider = accountIdProvider,
        syncKeyProvider = { RaagaPairingStore.getSyncKey() },
        onTransferReceived = { transfer ->
            if (isCloudMessageAuthorized(transfer.sourceDeviceId, transfer.syncKey)) {
                _activeRemoteDevice.value = null
                onPlaybackTransferredToMe(transfer)
                scope.launch {
                    delay(300)
                    broadcastLocalStatusToCloud()
                }
            }
        },
        onControlReceived = { cmd ->
            if (isCloudMessageAuthorized(cmd.senderDeviceId, cmd.syncKey)) {
                if (cmd.action == "QUERY_STATUS") {
                    broadcastLocalStatusToCloud()
                } else {
                    onRemoteControlCommand(cmd)
                    scope.launch {
                        delay(200)
                        broadcastLocalStatusToCloud()
                    }
                }
            }
        },
        onStatusReceived = { status ->
            val active = _activeRemoteDevice.value
            if (active != null && (active.id == status.deviceId || status.deviceId.isBlank())) {
                lastRemoteStatusReceivedAt = System.currentTimeMillis()
                val dur = if (status.durationMs > 0L) status.durationMs else parseDurationTextToMs(status.track?.durationText)
                _remoteStatus.value = status.copy(durationMs = dur)
                checkAndCorrectDrift(status)
            }
        },
        onPairRequestReceived = { req ->
            handlePairRequest(req)
        },
        onPairResponseReceived = { resp ->
            handlePairResponse(resp)
        },
        onHandoffReceived = { packet ->
            if (isCloudMessageAuthorized(packet.sourceDeviceId, packet.syncKey)) {
                handleCloudHandoffPacket(packet)
            }
        },
        onClockSyncResponseReceived = { resp ->
            pendingClockSyncDeferred[resp.clientSendMs]?.complete(resp)
        },
    )

    private fun handleCloudHandoffPacket(packet: ConnectHandoffPacket) {
        scope.launch {
            when (packet.phase) {
                HandoffPhase.PREPARE -> {
                    val resp = onHandoffPrepareRequested?.invoke(packet)
                        ?: packet.copy(phase = HandoffPhase.READY, bufferReadyDurationMs = 1500L)
                    supabaseRelay.sendHandoff(packet.sourceDeviceId, resp)
                }
                HandoffPhase.COMMIT -> {
                    _activeRemoteDevice.value = null
                    val resp = onHandoffCommitRequested?.invoke(packet)
                        ?: packet.copy(phase = HandoffPhase.CONFIRMED)
                    supabaseRelay.sendHandoff(packet.sourceDeviceId, resp)
                }
                HandoffPhase.ABORT -> {
                    onHandoffAbortRequested?.invoke(packet)
                }
                HandoffPhase.READY, HandoffPhase.CONFIRMED -> {
                    pendingHandoffDeferred[packet.handoffId]?.complete(packet)
                }
            }
        }
    }

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
    private var volumeJob: Job? = null
    @Volatile
    private var lastRemoteStatusReceivedAt: Long = 0L

    init {
        RaagaConnectClient.accountIdProvider = accountIdProvider
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

    private val failedPairAttempts = ConcurrentHashMap<String, MutableList<Long>>()
    private val MAX_FAILED_PAIR_ATTEMPTS = 5
    private val PAIR_LOCKOUT_DURATION_MS = 5 * 60 * 1000L

    private fun isCloudMessageAuthorized(sourceDeviceId: String, messageSyncKey: String?): Boolean {
        val localSyncKey = RaagaPairingStore.getSyncKey()
        val isPaired = sourceDeviceId.isNotBlank() && RaagaPairingStore.isPaired(sourceDeviceId)
        if (isPaired) return true
        if (!localSyncKey.isNullOrBlank() && !messageSyncKey.isNullOrBlank() && localSyncKey == messageSyncKey) {
            return true
        }
        val accountId = accountIdProvider()
        if (!accountId.isNullOrBlank() && sourceDeviceId.isNotBlank()) {
            return true
        }
        return false
    }

    fun generatePairCode(): String {
        val secureRandom = SecureRandom()
        val code = (100000 + secureRandom.nextInt(900000)).toString()
        activePairCode.value = code
        activePairCodeExpiresAt.value = System.currentTimeMillis() + 5 * 60 * 1000L
        pairingFeedback.value = null
        supabaseRelay.setTemporaryPairCode(code)
        return code
    }

    fun cancelPairCode() {
        activePairCode.value = null
        isPairingSubmitting.value = false
        pendingPairJob?.cancel()
        pendingPairJob = null
        pairingFeedback.value = null
        supabaseRelay.setTemporaryPairCode(null)
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
        supabaseRelay.setTemporaryPairCode(clean)

        pendingPairJob?.cancel()
        pendingPairJob = scope.launch {
            val pairReq = ConnectPairRequest(code = clean, fromDevice = localDevice)
            val startTime = System.currentTimeMillis()

            // 1. Attempt direct LAN pairing with any discovered local un-paired devices
            val localCandidates = _mergedDevices.value.filter { !it.isCloud }
            for (candidate in localCandidates) {
                val lanRes = RaagaConnectClient.pair(candidate, pairReq)
                if (lanRes.isSuccess) {
                    val pairResp = lanRes.getOrNull()
                    if (pairResp != null && pairResp.success) {
                        handlePairResponse(pairResp)
                        onResult(true, "Paired via local network!")
                        return@launch
                    }
                }
            }

            // 2. Fall back to cloud relay pairing loop
            while (isActive && !supabaseRelay.isSocketConnected() && System.currentTimeMillis() - startTime < 3000L) {
                delay(100)
            }
            while (isActive && isPairingSubmitting.value && System.currentTimeMillis() - startTime < 14_000L) {
                supabaseRelay.sendPairRequest(pairReq)
                delay(500)
            }
            if (isPairingSubmitting.value) {
                isPairingSubmitting.value = false
                supabaseRelay.setTemporaryPairCode(null)
                val timeoutMsg = "Device not found or code expired. Try again."
                pairingFeedback.value = timeoutMsg
                onResult(false, timeoutMsg)
            }
        }
    }

    fun unpairDevice(deviceId: String) {
        RaagaPairingStore.removePairedDevice(deviceId)
        if (RaagaPairingStore.pairedDevices.value.isEmpty()) {
            RaagaPairingStore.saveSyncKey(null)
            supabaseRelay.checkChannel()
        }
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

    fun handlePairRequestDirect(request: ConnectPairRequest): ConnectPairResponse {
        val callerKey = request.fromDevice.id.ifBlank { "unknown" }
        val now = System.currentTimeMillis()

        // Rate limiting check per caller device
        val attempts = failedPairAttempts.computeIfAbsent(callerKey) { Collections.synchronizedList(mutableListOf()) }
        synchronized(attempts) {
            attempts.removeAll { now - it > PAIR_LOCKOUT_DURATION_MS }
            if (attempts.size >= MAX_FAILED_PAIR_ATTEMPTS) {
                val remainingMin = ((PAIR_LOCKOUT_DURATION_MS - (now - attempts.first())) / 60000L).coerceAtLeast(1)
                return ConnectPairResponse(
                    code = request.code,
                    success = false,
                    message = "Too many failed attempts. Locked out for $remainingMin min.",
                    fromDevice = localDevice,
                    targetDeviceId = request.fromDevice.id,
                )
            }
        }

        val code = activePairCode.value
        val expiresAt = activePairCodeExpiresAt.value
        if (code != null && code == request.code && now <= expiresAt) {
            failedPairAttempts.remove(callerKey)
            val cleanName = request.fromDevice.name.removeSuffix(" (Cloud)")
            val paired = PairedDevice(
                id = request.fromDevice.id,
                name = cleanName,
                type = request.fromDevice.type,
                pairedAt = now,
            )
            RaagaPairingStore.addPairedDevice(paired)
            var syncKey = RaagaPairingStore.getSyncKey()
            if (syncKey.isNullOrBlank()) {
                syncKey = UUID.randomUUID().toString()
                RaagaPairingStore.saveSyncKey(syncKey)
            }

            val response = ConnectPairResponse(
                code = request.code,
                success = true,
                message = "Paired with $deviceName",
                fromDevice = localDevice,
                targetDeviceId = request.fromDevice.id,
                syncKey = syncKey,
            )
            pairingFeedback.value = "Successfully paired with $cleanName!"
            activePairCode.value = null
            supabaseRelay.setTemporaryPairCode(null)
            supabaseRelay.checkChannel()
            return response
        }

        synchronized(attempts) {
            attempts.add(now)
        }
        return ConnectPairResponse(
            code = request.code,
            success = false,
            message = "Pairing code mismatch or expired",
            fromDevice = localDevice,
            targetDeviceId = request.fromDevice.id,
        )
    }

    private fun handlePairRequest(request: ConnectPairRequest) {
        val response = handlePairRequestDirect(request)
        if (response.success) {
            supabaseRelay.sendPairResponse(response)
            scope.launch {
                delay(200)
                supabaseRelay.sendPairResponse(response)
                delay(200)
                supabaseRelay.sendPairResponse(response)
                delay(250)
                supabaseRelay.sendAnnounce()
                delay(1500)
                supabaseRelay.sendAnnounce()
            }
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
            if (!response.syncKey.isNullOrBlank()) {
                RaagaPairingStore.saveSyncKey(response.syncKey)
            }
            isPairingSubmitting.value = false
            pendingPairJob?.cancel()
            pendingPairJob = null
            pairingFeedback.value = "Successfully paired with $cleanName!"

            scope.launch {
                delay(500)
                supabaseRelay.setTemporaryPairCode(null)
                supabaseRelay.checkChannel()
                delay(250)
                supabaseRelay.sendAnnounce()
                delay(1500)
                supabaseRelay.sendAnnounce()
            }
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
            anchorMonotonicMs = MonotonicClock.nowMs(),
        )
        supabaseRelay.sendStatus(fullStatus)
    }

    private fun startCloudStatusBroadcast() {
        cloudStatusBroadcastJob?.cancel()
        cloudStatusBroadcastJob = scope.launch {
            var lastTrackId: String? = null
            var lastIsPlaying: Boolean? = null
            var lastDurationMs: Long = 0L
            var lastPositionMs: Long = 0L
            var ticks = 0
            while (isActive) {
                if (_activeRemoteDevice.value == null) {
                    val status = getLocalPlaybackStatus()
                    val track = status.track
                    if (track != null) {
                        val trackChanged = track.videoId != lastTrackId
                        val playStateChanged = status.isPlaying != lastIsPlaying
                        val durationChanged = status.durationMs != lastDurationMs
                        val seekJumped = lastIsPlaying == status.isPlaying &&
                            kotlin.math.abs(status.positionMs - (lastPositionMs + 1000L)) > 3000L
                        val periodicSync = if (status.isPlaying) (ticks % 4 == 0) else (ticks % 20 == 0)

                        if (trackChanged || playStateChanged || durationChanged || seekJumped || periodicSync) {
                            broadcastLocalStatusToCloud()
                        }
                        lastTrackId = track.videoId
                        lastIsPlaying = status.isPlaying
                        lastDurationMs = status.durationMs
                        lastPositionMs = status.positionMs
                    }
                }
                ticks++
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
        supabaseRelay.checkChannel()
        discovery.sendDiscover()
        supabaseRelay.sendDiscover()
        supabaseRelay.sendAnnounce()
    }

    /**
     * Calibrate monotonic clock offset with the target device using an NTP minimum-filter algorithm.
     * Returns full calibration result including offset, min RTT, and uncertainty.
     */
    suspend fun calibrateClockDetailed(target: ConnectDevice): ClockCalibrationResult = withContext(Dispatchers.IO) {
        val samples = mutableListOf<ClockSyncSample>()
        if (!target.isCloud) {
            for (i in 0 until 4) {
                val t1 = MonotonicClock.nowMs()
                val res = RaagaConnectClient.clockSync(target, t1, deviceId)
                val t4 = MonotonicClock.nowMs()
                if (res.isSuccess) {
                    val resp = res.getOrNull()
                    if (resp != null) {
                        samples.add(
                            ClockSyncSample(
                                t1ClientSendMs = t1,
                                t2ServerRecvMs = resp.serverReceiveMs,
                                t3ServerTransmitMs = resp.serverTransmitMs,
                                t4ClientRecvMs = t4,
                            )
                        )
                    }
                }
                delay(20)
            }
        }
        if (samples.isEmpty()) {
            val t1 = MonotonicClock.nowMs()
            val deferred = CompletableDeferred<ConnectClockSyncResponse>()
            pendingClockSyncDeferred[t1] = deferred
            try {
                supabaseRelay.sendClockSyncRequest(target.id, ConnectClockSyncRequest(clientSendMs = t1, clientDeviceId = deviceId))
                val resp = withTimeoutOrNull(1500) { deferred.await() }
                val t4 = MonotonicClock.nowMs()
                if (resp != null) {
                    samples.add(
                        ClockSyncSample(
                            t1ClientSendMs = t1,
                            t2ServerRecvMs = resp.serverReceiveMs,
                            t3ServerTransmitMs = resp.serverTransmitMs,
                            t4ClientRecvMs = t4,
                        )
                    )
                }
            } finally {
                pendingClockSyncDeferred.remove(t1)
            }
        }

        val result = RaagaConnectTiming.filterBestSample(samples)
            ?: ClockCalibrationResult(offsetMs = 0L, rttMs = 120L, uncertaintyMs = 60L, sampleCount = 0)
        lastCalibratedClockOffsetMs = result.offsetMs
        result
    }

    suspend fun calibrateClock(target: ConnectDevice): Long = calibrateClockDetailed(target).offsetMs

    /**
     * Transfer playback to another device on the network or cloud using a verified
     * Two-Phase Commit protocol (PREPARE -> READY -> COMMIT -> CONFIRMED).
     * Local playback is retained and smoothly crossfaded ONLY upon positive confirmation.
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
            try {
                // 1. Clock Calibration (ORCHESTRA monotonic clock offset & uncertainty estimation)
                val calibration = calibrateClockDetailed(target)
                val clockOffset = calibration.offsetMs

                // 2. Prepare Phase (Transaction initialization with protocol version & session ID)
                val handoffId = UUID.randomUUID().toString()
                val sessionId = UUID.randomUUID().toString()
                val preparePacket = ConnectHandoffPacket(
                    handoffId = handoffId,
                    phase = HandoffPhase.PREPARE,
                    protocolVersion = 2,
                    sessionId = sessionId,
                    sourceDeviceId = deviceId,
                    sourceDeviceName = deviceName,
                    targetDeviceId = target.id,
                    track = currentTrack,
                    positionMs = positionMs,
                    isPlaying = isPlaying,
                    volume = volume,
                    queue = queue,
                    timestampMs = MonotonicClock.nowMs(),
                    syncKey = RaagaPairingStore.getSyncKey(),
                )

                var readyPacket: ConnectHandoffPacket? = null
                var usedLan = false

                if (!target.isCloud) {
                    val prepRes = RaagaConnectClient.handoffPrepare(target, preparePacket)
                    if (prepRes.isSuccess) {
                        readyPacket = prepRes.getOrNull()
                        usedLan = true
                    }
                }

                // Transparent Cloud Fallback if LAN failed or target is remote
                if (readyPacket == null || readyPacket.phase != HandoffPhase.READY) {
                    val deferred = CompletableDeferred<ConnectHandoffPacket>()
                    pendingHandoffDeferred[handoffId] = deferred
                    try {
                        supabaseRelay.sendHandoff(target.id, preparePacket)
                        readyPacket = withTimeoutOrNull(6000) { deferred.await() }
                    } finally {
                        pendingHandoffDeferred.remove(handoffId)
                    }
                }

                if (readyPacket == null || readyPacket.phase != HandoffPhase.READY) {
                    _connectingDeviceId.value = null
                    // Keep playing locally! Rollback with zero interruption to local music
                    onError(Exception(readyPacket?.errorMessage ?: "Target device was not ready to receive playback"))
                    return@launch
                }

                // 3. Commit Phase with Adaptive Scheduled Playout Anchor
                val leadTimeMs = RaagaConnectTiming.computeAdaptiveLeadTime(
                    rttMs = calibration.rttMs,
                    isCloud = !usedLan || target.isCloud,
                    bufferReadyDurationMs = readyPacket.bufferReadyDurationMs,
                )
                val localScheduledAt = MonotonicClock.nowMs() + leadTimeMs
                val targetScheduledAt = RaagaConnectTiming.computeTargetAnchorMs(localScheduledAt, clockOffset)

                val commitPacket = preparePacket.copy(
                    phase = HandoffPhase.COMMIT,
                    scheduledStartEpochMs = targetScheduledAt,
                )

                var confirmedPacket: ConnectHandoffPacket? = null
                if (usedLan) {
                    val commitRes = RaagaConnectClient.handoffCommit(target, commitPacket)
                    if (commitRes.isSuccess) {
                        confirmedPacket = commitRes.getOrNull()
                    }
                }

                // Cloud fallback for commit
                if (confirmedPacket == null || confirmedPacket.phase != HandoffPhase.CONFIRMED) {
                    val deferred = CompletableDeferred<ConnectHandoffPacket>()
                    pendingHandoffDeferred[handoffId] = deferred
                    try {
                        supabaseRelay.sendHandoff(target.id, commitPacket)
                        confirmedPacket = withTimeoutOrNull(4000) { deferred.await() }
                    } finally {
                        pendingHandoffDeferred.remove(handoffId)
                    }
                }

                if (confirmedPacket == null || confirmedPacket.phase != HandoffPhase.CONFIRMED) {
                    _connectingDeviceId.value = null
                    // Target failed to confirm commit; abort target session and roll back locally
                    val abortPacket = preparePacket.copy(phase = HandoffPhase.ABORT)
                    if (usedLan) {
                        RaagaConnectClient.handoffAbort(target, abortPacket)
                    } else {
                        supabaseRelay.sendHandoff(target.id, abortPacket)
                    }
                    onError(Exception(confirmedPacket?.errorMessage ?: "Target device failed to confirm playback start"))
                    return@launch
                }

                // 4. Wait out until scheduled start instant for seamless transition
                val waitBeforeCutover = (localScheduledAt - MonotonicClock.nowMs()).coerceAtLeast(0L)
                if (waitBeforeCutover > 0L) {
                    delay(waitBeforeCutover)
                }

                // Seamless handoff complete: transfer speaker ownership and pause local playback
                _activeRemoteDevice.value = target
                startRemoteStatusPolling(target)
                onLocalPlaybackHandoffCompleted()
                _connectingDeviceId.value = null
                onSuccess()

            } catch (t: Throwable) {
                _connectingDeviceId.value = null
                onError(t)
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
                val cur = _remoteStatus.value
                if (cur != null && cur.isPlaying && cur.positionMs > 0L) {
                    val elapsed = (System.currentTimeMillis() - lastRemoteStatusReceivedAt).coerceAtLeast(0L)
                    val estPos = (cur.positionMs + elapsed).coerceAtMost(if (cur.durationMs > 0L) cur.durationMs else Long.MAX_VALUE)
                    cur.copy(positionMs = estPos)
                } else {
                    cur
                }
            } else {
                RaagaConnectClient.queryStatus(target).getOrNull()
            }

            // 2. Pause remote device
            val pauseCmd = ConnectControlCommand(
                action = "PAUSE",
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
                senderDeviceId = deviceId,
                syncKey = RaagaPairingStore.getSyncKey(),
            )
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, pauseCmd)
            } else {
                val res = RaagaConnectClient.sendControl(target, pauseCmd)
                if (res.isFailure) {
                    supabaseRelay.sendControl(target.id, pauseCmd)
                }
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

    // --- Remote Control Actions with Idempotency ---

    fun sendPlay() {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            val cmd = ConnectControlCommand(
                action = "PLAY",
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
                senderDeviceId = deviceId,
                syncKey = RaagaPairingStore.getSyncKey(),
            )
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, cmd)
            } else {
                val res = RaagaConnectClient.sendControl(target, cmd)
                if (res.isFailure) {
                    supabaseRelay.sendControl(target.id, cmd)
                }
            }
            updateRemoteStatusOptimistically { it.copy(isPlaying = true) }
            delay(150)
            pollRemoteStatusNow(target)
        }
    }

    fun sendPause() {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            val cmd = ConnectControlCommand(
                action = "PAUSE",
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
                senderDeviceId = deviceId,
                syncKey = RaagaPairingStore.getSyncKey(),
            )
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, cmd)
            } else {
                val res = RaagaConnectClient.sendControl(target, cmd)
                if (res.isFailure) {
                    supabaseRelay.sendControl(target.id, cmd)
                }
            }
            updateRemoteStatusOptimistically { it.copy(isPlaying = false) }
            delay(150)
            pollRemoteStatusNow(target)
        }
    }

    fun sendToggle() {
        val target = _activeRemoteDevice.value ?: return
        val currentPlay = _remoteStatus.value?.isPlaying ?: true
        if (currentPlay) sendPause() else sendPlay()
    }

    fun sendNext() {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            val cmd = ConnectControlCommand(
                action = "NEXT",
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
                senderDeviceId = deviceId,
                syncKey = RaagaPairingStore.getSyncKey(),
            )
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, cmd)
            } else {
                val res = RaagaConnectClient.sendControl(target, cmd)
                if (res.isFailure) {
                    supabaseRelay.sendControl(target.id, cmd)
                }
            }
            delay(800)
            pollRemoteStatusNow(target)
        }
    }

    fun sendPrev() {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            val cmd = ConnectControlCommand(
                action = "PREV",
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
                senderDeviceId = deviceId,
                syncKey = RaagaPairingStore.getSyncKey(),
            )
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, cmd)
            } else {
                val res = RaagaConnectClient.sendControl(target, cmd)
                if (res.isFailure) {
                    supabaseRelay.sendControl(target.id, cmd)
                }
            }
            delay(800)
            pollRemoteStatusNow(target)
        }
    }

    fun sendPrevious() = sendPrev()

    fun sendSeek(positionMs: Long) {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            val cmd = ConnectControlCommand(
                action = "SEEK",
                positionMs = positionMs,
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
                senderDeviceId = deviceId,
                syncKey = RaagaPairingStore.getSyncKey(),
            )
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, cmd)
            } else {
                val res = RaagaConnectClient.sendControl(target, cmd)
                if (res.isFailure) {
                    supabaseRelay.sendControl(target.id, cmd)
                }
            }
            updateRemoteStatusOptimistically { it.copy(positionMs = positionMs) }
            delay(250)
            pollRemoteStatusNow(target)
        }
    }

    fun sendPlaybackSpeed(speed: Float) {
        val target = _activeRemoteDevice.value ?: return
        scope.launch {
            val cmd = ConnectControlCommand(
                action = "SPEED",
                playbackSpeed = speed,
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
                senderDeviceId = deviceId,
                syncKey = RaagaPairingStore.getSyncKey(),
            )
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, cmd)
            } else {
                val res = RaagaConnectClient.sendControl(target, cmd)
                if (res.isFailure) {
                    supabaseRelay.sendControl(target.id, cmd)
                }
            }
        }
    }

    fun sendVolume(volume: Float) {
        val target = _activeRemoteDevice.value ?: return
        updateRemoteStatusOptimistically { it.copy(volume = volume) }
        volumeJob?.cancel()
        volumeJob = scope.launch {
            delay(50)
            val cmd = ConnectControlCommand(
                action = "VOLUME",
                volume = volume,
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
                senderDeviceId = deviceId,
                syncKey = RaagaPairingStore.getSyncKey(),
            )
            if (target.isCloud) {
                supabaseRelay.sendControl(target.id, cmd)
            } else {
                val res = RaagaConnectClient.sendControl(target, cmd)
                if (res.isFailure) {
                    supabaseRelay.sendControl(target.id, cmd)
                }
            }
        }
    }

    // --- Closed-Loop Drift Correction ---

    private var lastDriftCorrectionAt = 0L
    private var driftStrikes = 0

    private fun checkAndCorrectDrift(status: ConnectDeviceStatus) {
        if (!status.isPlaying || status.anchorMonotonicMs <= 0L) return
        val now = MonotonicClock.nowMs()
        if (now - lastDriftCorrectionAt < 3000L) return // Throttle drift evaluation to every 3s

        val targetMonotonicNow = now + lastCalibratedClockOffsetMs
        val expectedPos = RaagaConnectTiming.computeExpectedPositionMs(
            anchorPositionMs = status.positionMs,
            anchorMonotonicMs = status.anchorMonotonicMs,
            currentMonotonicMs = targetMonotonicNow,
            playbackSpeed = status.playbackSpeed,
            durationMs = status.durationMs,
        )
        val drift = RaagaConnectTiming.calculateDriftMs(status.positionMs, expectedPos)
        val action = RaagaConnectTiming.evaluateDriftAction(drift, expectedPos, status.playbackSpeed)

        when (action) {
            is RaagaConnectTiming.DriftAction.InSync -> {
                driftStrikes = 0
            }
            is RaagaConnectTiming.DriftAction.RateAdjust -> {
                driftStrikes++
                if (driftStrikes >= 2) {
                    lastDriftCorrectionAt = now
                    sendPlaybackSpeed(action.newSpeed)
                }
            }
            is RaagaConnectTiming.DriftAction.HardSeek -> {
                driftStrikes++
                if (driftStrikes >= 2) {
                    lastDriftCorrectionAt = now
                    sendSeek(action.targetPositionMs)
                    driftStrikes = 0
                }
            }
        }
    }

    private fun startRemoteStatusPolling(target: ConnectDevice) {
        statusPollJob?.cancel()
        statusPollJob = scope.launch {
            pollRemoteStatusNow(target)
            while (isActive && _activeRemoteDevice.value?.id == target.id) {
                val pollDelay = if (target.isCloud) 4_000L else 800L
                delay(pollDelay)
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
                    checkAndCorrectDrift(s)
                    return
                }
            }
        }
        supabaseRelay.sendControl(
            target.id,
            ConnectControlCommand(
                action = "QUERY_STATUS",
                targetDeviceId = target.id,
                commandId = UUID.randomUUID().toString(),
                seq = ++commandSeq,
            ),
        )
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
