package com.music.aether.data.listentogether.local

import com.music.aether.data.DebugLog as Log
import com.music.aether.data.listentogether.PartyMember
import com.music.aether.data.listentogether.PartyPlayback
import com.music.aether.data.listentogether.PartyPreview
import com.music.aether.data.listentogether.PartyPreviewMember
import com.music.aether.data.listentogether.PartyQueue
import com.music.aether.data.listentogether.PartySnapshot
import com.music.aether.data.listentogether.PartyTrack
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * LocalJamHostServer — Embedded zero-dependency HTTP + RFC 6455 WebSocket party server.
 *
 * Runs locally on the Android device that creates a Jam room on the local Wi-Fi.
 * Enables zero cloud data usage and sub-5ms latency for all members on the same LAN.
 */
class LocalJamHostServer(
    val requestedPort: Int = 8890,
) {
    companion object {
        private const val TAG = "LocalJamHostServer"
        private const val MAGIC_WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        private const val CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTUVWXYZ"
        private val random = SecureRandom()

        fun generateCode(): String = (1..6)
            .map { CODE_ALPHABET[random.nextInt(CODE_ALPHABET.length)] }
            .joinToString("")

        fun randomHex(bytes: Int): String {
            val b = ByteArray(bytes)
            random.nextBytes(b)
            return b.joinToString("") { "%02x".format(it) }
        }
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var serverSocket: ServerSocket? = null
    private var acceptJob: Job? = null
    private var heartbeatJob: Job? = null

    private val stateMutex = Mutex()

    // Active party state
    var code: String = ""
        private set
    var maxMembers: Int = 5
        private set
    var hostOnlyControl: Boolean = false
        private set

    private val members = ConcurrentHashMap<String, PartyMember>() // memberId -> PartyMember
    private val tokens = ConcurrentHashMap<String, String>() // token -> memberId
    private val deviceToMember = ConcurrentHashMap<String, String>() // deviceId -> memberId

    private var playback = PartyPlayback()
    private var queue = PartyQueue()

    private val activeConnections = CopyOnWriteArrayList<WsConnection>()

    val port: Int get() = serverSocket?.localPort ?: requestedPort
    val isRunning: Boolean get() = serverSocket?.isClosed == false && acceptJob?.isActive == true

    /**
     * Starts the embedded server on the local device.
     */
    fun start(): Int {
        if (isRunning) return port

        var ss: ServerSocket? = null
        var currentPort = requestedPort
        // Try requested port first, then sequential fallbacks if port is temporarily occupied
        for (attempt in 0..10) {
            try {
                ss = ServerSocket(currentPort)
                break
            } catch (_: Exception) {
                currentPort++
            }
        }
        if (ss == null) {
            ss = ServerSocket(0) // Assign any free ephemeral port
        }

        serverSocket = ss
        val boundPort = ss.localPort
        Log.i(TAG, "Local Jam server listening on port $boundPort")

        acceptJob = scope.launch {
            while (isActive && !ss.isClosed) {
                try {
                    val socket = ss.accept()
                    launch { handleClientSocket(socket) }
                } catch (e: Exception) {
                    if (!ss.isClosed) {
                        Log.w(TAG, "Accept error: ${e.message}")
                    }
                }
            }
        }

        heartbeatJob = scope.launch {
            while (isActive) {
                delay(3000)
                if (activeConnections.isNotEmpty()) {
                    broadcastState()
                }
            }
        }

        return boundPort
    }

    fun stop() {
        Log.i(TAG, "Stopping Local Jam server on port $port")
        acceptJob?.cancel()
        heartbeatJob?.cancel()
        activeConnections.forEach { it.close() }
        activeConnections.clear()
        try {
            serverSocket?.close()
        } catch (_: Exception) {}
        serverSocket = null
    }

    private suspend fun handleClientSocket(socket: Socket) {
        val inputStream = socket.getInputStream()
        val outputStream = socket.getOutputStream()

        try {
            val reqHeaders = readHttpHeaders(inputStream) ?: run {
                socket.close()
                return
            }

            val reqLine = reqHeaders.firstOrNull() ?: run {
                socket.close()
                return
            }

            val parts = reqLine.split(" ")
            if (parts.size < 2) {
                socket.close()
                return
            }

            val method = parts[0].uppercase()
            val fullPath = parts[1]
            val path = fullPath.substringBefore("?")

            val headerMap = HashMap<String, String>()
            for (i in 1 until reqHeaders.size) {
                val line = reqHeaders[i]
                val idx = line.indexOf(":")
                if (idx != -1) {
                    headerMap[line.substring(0, idx).trim().lowercase()] = line.substring(idx + 1).trim()
                }
            }

            val isWebSocket = headerMap["upgrade"]?.equals("websocket", ignoreCase = true) == true

            if (isWebSocket && method == "GET" && path.startsWith("/ws/parties/")) {
                handleWebSocketUpgrade(socket, inputStream, outputStream, path, headerMap)
                return
            }

            // Read HTTP Body if Content-Length present
            val contentLength = headerMap["content-length"]?.toIntOrNull() ?: 0
            val body = if (contentLength > 0) {
                readExact(inputStream, contentLength)
            } else ""

            handleHttpRest(outputStream, method, path, body, headerMap)
        } catch (e: Exception) {
            Log.w(TAG, "Error handling client connection: ${e.message}")
        } finally {
            // Note: If upgraded to WebSocket, handleWebSocketUpgrade takes ownership of socket.
        }
    }

    private suspend fun handleHttpRest(
        out: OutputStream,
        method: String,
        path: String,
        body: String,
        headers: Map<String, String>,
    ) {
        when {
            method == "GET" && (path == "/healthz" || path == "/api/time") -> {
                val now = System.currentTimeMillis()
                sendJson(out, 200, "OK", """{"ok":true,"serverMs":$now}""")
            }

            method == "POST" && path == "/api/parties" -> {
                // Host creating the party
                stateMutex.withLock {
                    if (code.isEmpty()) {
                        code = generateCode()
                    }
                    val now = System.currentTimeMillis()
                    val reqJson = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull()
                    val userId = reqJson?.get("userId")?.jsonPrimitive?.content.orEmpty()
                    val deviceId = reqJson?.get("deviceId")?.jsonPrimitive?.content.orEmpty()
                    val displayName = reqJson?.get("displayName")?.jsonPrimitive?.content.orEmpty().ifBlank { "Host" }
                    val avatarUrl = reqJson?.get("avatarUrl")?.jsonPrimitive?.content
                    val maxM = reqJson?.get("maxMembers")?.jsonPrimitive?.intOrNull ?: 5
                    val autoplay = reqJson?.get("autoplayEnabled")?.jsonPrimitive?.booleanOrNull ?: false

                    maxMembers = maxM
                    playback = playback.copy(
                        autoplayEnabled = autoplay,
                        anchorMs = now,
                        updatedAtMs = now,
                    )

                    val memberId = randomHex(8)
                    val token = randomHex(24)
                    val you = PartyMember(
                        memberId = memberId,
                        userId = userId,
                        displayName = displayName,
                        avatarUrl = avatarUrl,
                        isHost = true,
                        connected = false,
                        joinedAtMs = now,
                        lastSeenMs = now,
                    )
                    members[memberId] = you
                    tokens[token] = memberId
                    if (deviceId.isNotEmpty()) deviceToMember[deviceId] = memberId

                    val snapshot = buildSnapshot(now)
                    val resp = buildMembershipJson(code, token, you, snapshot, now)
                    sendJson(out, 201, "Created", resp)
                }
            }

            method == "POST" && path.matches(Regex("/api/parties/[A-Za-z0-9]+/join")) -> {
                val targetCode = path.substringAfter("/api/parties/").substringBefore("/join").uppercase()
                stateMutex.withLock {
                    if (code.isEmpty() || !code.equals(targetCode, ignoreCase = true)) {
                        sendJsonError(out, 404, "no_such_party", "Party not found on this local server.")
                        return@withLock
                    }

                    if (members.size >= maxMembers) {
                        sendJsonError(out, 409, "party_full", "This local party is full.")
                        return@withLock
                    }

                    val now = System.currentTimeMillis()
                    val reqJson = runCatching { json.parseToJsonElement(body).jsonObject }.getOrNull()
                    val userId = reqJson?.get("userId")?.jsonPrimitive?.content.orEmpty()
                    val deviceId = reqJson?.get("deviceId")?.jsonPrimitive?.content.orEmpty()
                    val displayName = reqJson?.get("displayName")?.jsonPrimitive?.content.orEmpty().ifBlank { "Guest" }
                    val avatarUrl = reqJson?.get("avatarUrl")?.jsonPrimitive?.content

                    // Rejoining device check
                    val existingMemberId = if (deviceId.isNotEmpty()) deviceToMember[deviceId] else null
                    val memberId = existingMemberId ?: randomHex(8)
                    val token = randomHex(24)

                    val you = PartyMember(
                        memberId = memberId,
                        userId = userId,
                        displayName = displayName,
                        avatarUrl = avatarUrl,
                        isHost = members.isEmpty(),
                        connected = false,
                        joinedAtMs = members[memberId]?.joinedAtMs ?: now,
                        lastSeenMs = now,
                    )
                    members[memberId] = you
                    tokens[token] = memberId
                    if (deviceId.isNotEmpty()) deviceToMember[deviceId] = memberId

                    val snapshot = buildSnapshot(now)
                    val resp = buildMembershipJson(code, token, you, snapshot, now)
                    sendJson(out, 200, "OK", resp)
                }
            }

            method == "GET" && path.matches(Regex("/api/parties/[A-Za-z0-9]+/preview")) -> {
                stateMutex.withLock {
                    val now = System.currentTimeMillis()
                    val hostMember = members.values.firstOrNull { it.isHost }
                    val previewMembers = members.values.map {
                        PartyPreviewMember(it.displayName, it.avatarUrl, it.isHost)
                    }
                    val preview = PartyPreview(
                        code = code,
                        hostName = hostMember?.displayName.orEmpty(),
                        memberCount = members.size,
                        maxMembers = maxMembers,
                        isFull = members.size >= maxMembers,
                        members = previewMembers,
                    )
                    sendJson(out, 200, "OK", json.encodeToString(PartyPreview.serializer(), preview))
                }
            }

            method == "POST" && path.matches(Regex("/api/parties/[A-Za-z0-9]+/leave")) -> {
                val authHeader = headers["authorization"].orEmpty()
                val token = authHeader.removePrefix("Bearer ").trim()
                stateMutex.withLock {
                    val memberId = tokens.remove(token)
                    if (memberId != null) {
                        val removed = members.remove(memberId)
                        if (removed?.isHost == true && members.isNotEmpty()) {
                            val nextHost = members.values.first()
                            members[nextHost.memberId] = nextHost.copy(isHost = true)
                        }
                    }
                    broadcastMembers()
                    sendJson(out, 200, "OK", """{"ok":true}""")
                }
            }

            else -> {
                sendJson(out, 404, "Not Found", """{"error":"not_found"}""")
            }
        }
    }

    private suspend fun handleWebSocketUpgrade(
        socket: Socket,
        inputStream: InputStream,
        outputStream: OutputStream,
        path: String,
        headers: Map<String, String>,
    ) {
        val clientKey = headers["sec-websocket-key"] ?: run {
            sendJsonError(outputStream, 400, "bad_request", "Missing Sec-WebSocket-Key")
            socket.close()
            return
        }

        val authHeader = headers["authorization"].orEmpty()
        val token = authHeader.removePrefix("Bearer ").trim()
        val memberId = tokens[token]

        if (memberId == null) {
            sendJsonError(outputStream, 401, "unauthorized", "Invalid or missing token")
            socket.close()
            return
        }

        // Perform RFC 6455 Handshake
        val acceptKey = makeAcceptKey(clientKey)
        val handshakeResp = "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                "Sec-WebSocket-Accept: $acceptKey\r\n\r\n"

        outputStream.write(handshakeResp.toByteArray(StandardCharsets.UTF_8))
        outputStream.flush()

        val wsConn = WsConnection(socket, inputStream, outputStream, memberId)
        activeConnections.add(wsConn)

        val now = System.currentTimeMillis()
        var currentMember: PartyMember? = null
        stateMutex.withLock {
            val m = members[memberId]
            if (m != null) {
                val updated = m.copy(connected = true, lastSeenMs = now)
                members[memberId] = updated
                currentMember = updated
            }
        }

        currentMember?.let { you ->
            // Send initial welcome frame
            val snapshot = stateMutex.withLock { buildSnapshot(now) }
            val welcomeJson = buildJsonObjectString(
                "type" to "\"welcome\"",
                "serverMs" to now.toString(),
                "you" to json.encodeToString(PartyMember.serializer(), you),
                "party" to json.encodeToString(PartySnapshot.serializer(), snapshot),
            )
            wsConn.sendText(welcomeJson)
            broadcastMembers()
        }

        // Run frame reading loop
        try {
            while (kotlinx.coroutines.currentCoroutineContext().isActive && !socket.isClosed) {
                val frame = readWebSocketFrame(inputStream) ?: break
                when (frame.opcode) {
                    0x1 -> { // Text Frame
                        val text = String(frame.payload, StandardCharsets.UTF_8)
                        handleIncomingSocketJson(wsConn, memberId, text)
                    }
                    0x8 -> { // Close Frame
                        wsConn.sendFrame(0x8, ByteArray(0))
                        break
                    }
                    0x9 -> { // Ping Frame
                        wsConn.sendFrame(0xA, frame.payload) // Pong
                    }
                }
            }
        } catch (e: Exception) {
            Log.d(TAG, "Socket closed for member $memberId: ${e.message}")
        } finally {
            activeConnections.remove(wsConn)
            wsConn.close()
            stateMutex.withLock {
                val m = members[memberId]
                if (m != null) {
                    members[memberId] = m.copy(connected = false, lastSeenMs = System.currentTimeMillis())
                }
            }
            broadcastMembers()
        }
    }

    private suspend fun handleIncomingSocketJson(conn: WsConnection, memberId: String, text: String) {
        val root = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
        val type = root["type"]?.jsonPrimitive?.content ?: return
        val now = System.currentTimeMillis()

        when (type) {
            "ping" -> {
                val clientMs = root["clientMs"]?.jsonPrimitive?.longOrNull ?: 0L
                val pongJson = """{"type":"pong","clientMs":$clientMs,"serverMs":$now}"""
                conn.sendText(pongJson)
            }

            "sync" -> {
                stateMutex.withLock {
                    conn.sendText(buildStateFrame(now))
                }
            }

            "syncQueue" -> {
                stateMutex.withLock {
                    conn.sendText(buildQueueFrame())
                }
            }

            "report" -> {
                // Heartbeat / playhead position tracking
                stateMutex.withLock {
                    members[memberId]?.let {
                        members[memberId] = it.copy(lastSeenMs = now)
                    }
                }
            }

            "control" -> {
                val action = root["action"]?.jsonPrimitive?.content ?: return
                stateMutex.withLock {
                    val caller = members[memberId] ?: return@withLock
                    if (hostOnlyControl && !caller.isHost) {
                        conn.sendText("""{"type":"error","error":"host_only","message":"Only the host can control the music."}""")
                        return@withLock
                    }

                    applyControl(caller, action, root, now)
                }
            }
        }
    }

    private fun applyControl(caller: PartyMember, action: String, frame: JsonObject, now: Long) {
        when (action) {
            "play" -> {
                val pos = frame["positionMs"]?.jsonPrimitive?.longOrNull ?: effectivePosition(now)
                playback = playback.copy(
                    isPlaying = true,
                    positionMs = pos,
                    anchorMs = now + 400L, // 400ms lead for network sync
                    effectivePositionMs = pos,
                    seq = playback.seq + 1,
                    updatedBy = caller.memberId,
                    updatedAtMs = now,
                )
                broadcastState()
            }

            "pause" -> {
                val pos = frame["positionMs"]?.jsonPrimitive?.longOrNull ?: effectivePosition(now)
                playback = playback.copy(
                    isPlaying = false,
                    positionMs = pos,
                    anchorMs = now,
                    effectivePositionMs = pos,
                    seq = playback.seq + 1,
                    updatedBy = caller.memberId,
                    updatedAtMs = now,
                )
                broadcastState()
            }

            "seek" -> {
                val pos = frame["positionMs"]?.jsonPrimitive?.longOrNull ?: 0L
                playback = playback.copy(
                    positionMs = pos,
                    anchorMs = if (playback.isPlaying) now + 400L else now,
                    effectivePositionMs = pos,
                    seq = playback.seq + 1,
                    updatedBy = caller.memberId,
                    updatedAtMs = now,
                )
                broadcastState()
            }

            "setTrack" -> {
                val trackObj = frame["track"]?.jsonObject
                val track = trackObj?.let { runCatching { json.decodeFromJsonElement(PartyTrack.serializer(), it) }.getOrNull() }
                val pos = frame["positionMs"]?.jsonPrimitive?.longOrNull ?: 0L
                val isPlaying = frame["isPlaying"]?.jsonPrimitive?.booleanOrNull ?: true

                // Update queue index if track is in queue
                var matchedIdx = playback.queueIndex
                if (track != null) {
                    val idx = queue.items.indexOfFirst { it.videoId == track.videoId }
                    if (idx != -1) matchedIdx = idx
                }

                playback = playback.copy(
                    track = track,
                    positionMs = pos,
                    isPlaying = isPlaying && track != null,
                    anchorMs = if (isPlaying && track != null) now + 400L else now,
                    effectivePositionMs = pos,
                    queueIndex = matchedIdx,
                    startedBy = caller.memberId,
                    startedByName = caller.displayName,
                    seq = playback.seq + 1,
                    updatedBy = caller.memberId,
                    updatedAtMs = now,
                )
                broadcastState()
            }

            "setQueue" -> {
                val itemsArr = frame["queue"]?.jsonArray
                val items = itemsArr?.mapNotNull {
                    runCatching { json.decodeFromJsonElement(PartyTrack.serializer(), it) }.getOrNull()
                } ?: emptyList()
                val qIdx = frame["queueIndex"]?.jsonPrimitive?.intOrNull ?: -1

                queue = PartyQueue(
                    seq = queue.seq + 1,
                    index = qIdx,
                    items = items,
                )
                playback = playback.copy(
                    queueSeq = queue.seq,
                    queueIndex = qIdx,
                    queueLength = items.size,
                    seq = playback.seq + 1,
                    updatedBy = caller.memberId,
                    updatedAtMs = now,
                )
                broadcastQueue()
                broadcastState()
            }

            "queueAdd" -> {
                val tracksArr = frame["tracks"]?.jsonArray
                val tracks = tracksArr?.mapNotNull {
                    runCatching { json.decodeFromJsonElement(PartyTrack.serializer(), it) }.getOrNull()
                } ?: emptyList()
                val playNext = frame["playNext"]?.jsonPrimitive?.booleanOrNull ?: false

                val newItems = ArrayList(queue.items)
                if (playNext && queue.index in 0 until newItems.size) {
                    newItems.addAll(queue.index + 1, tracks)
                } else {
                    newItems.addAll(tracks)
                }

                queue = queue.copy(
                    seq = queue.seq + 1,
                    items = newItems,
                )
                playback = playback.copy(
                    queueSeq = queue.seq,
                    queueLength = newItems.size,
                    seq = playback.seq + 1,
                    updatedBy = caller.memberId,
                    updatedAtMs = now,
                )
                broadcastQueue()
                broadcastState()
            }

            "queueRemove" -> {
                val videoId = frame["videoId"]?.jsonPrimitive?.content ?: return
                val newItems = queue.items.filterNot { it.videoId == videoId }
                var newIdx = queue.index
                val removedIdx = queue.items.indexOfFirst { it.videoId == videoId }
                if (removedIdx != -1 && removedIdx < queue.index) {
                    newIdx = (newIdx - 1).coerceAtLeast(0)
                }

                queue = queue.copy(
                    seq = queue.seq + 1,
                    index = newIdx,
                    items = newItems,
                )
                playback = playback.copy(
                    queueSeq = queue.seq,
                    queueIndex = newIdx,
                    queueLength = newItems.size,
                    seq = playback.seq + 1,
                    updatedBy = caller.memberId,
                    updatedAtMs = now,
                )
                broadcastQueue()
                broadcastState()
            }

            "queueClear" -> {
                // Keep history and current playing track, clear upcoming
                val newItems = if (queue.index in 0 until queue.items.size) {
                    queue.items.take(queue.index + 1)
                } else emptyList()

                queue = queue.copy(
                    seq = queue.seq + 1,
                    items = newItems,
                )
                playback = playback.copy(
                    queueSeq = queue.seq,
                    queueLength = newItems.size,
                    seq = playback.seq + 1,
                    updatedBy = caller.memberId,
                    updatedAtMs = now,
                )
                broadcastQueue()
                broadcastState()
            }

            "next" -> {
                val nextIdx = queue.index + 1
                if (nextIdx in 0 until queue.items.size) {
                    val nextTrack = queue.items[nextIdx]
                    queue = queue.copy(index = nextIdx)
                    playback = playback.copy(
                        track = nextTrack,
                        positionMs = 0L,
                        anchorMs = now + 400L,
                        effectivePositionMs = 0L,
                        queueIndex = nextIdx,
                        isPlaying = true,
                        startedBy = caller.memberId,
                        startedByName = caller.displayName,
                        seq = playback.seq + 1,
                        updatedBy = caller.memberId,
                        updatedAtMs = now,
                    )
                    broadcastState()
                }
            }

            "previous" -> {
                val prevIdx = queue.index - 1
                if (prevIdx in 0 until queue.items.size) {
                    val prevTrack = queue.items[prevIdx]
                    queue = queue.copy(index = prevIdx)
                    playback = playback.copy(
                        track = prevTrack,
                        positionMs = 0L,
                        anchorMs = now + 400L,
                        effectivePositionMs = 0L,
                        queueIndex = prevIdx,
                        isPlaying = true,
                        startedBy = caller.memberId,
                        startedByName = caller.displayName,
                        seq = playback.seq + 1,
                        updatedBy = caller.memberId,
                        updatedAtMs = now,
                    )
                    broadcastState()
                }
            }

            "setMaxMembers" -> {
                if (caller.isHost) {
                    frame["maxMembers"]?.jsonPrimitive?.intOrNull?.let {
                        maxMembers = it.coerceIn(2, 10)
                        broadcastMembers()
                    }
                }
            }

            "setHostOnlyControl" -> {
                if (caller.isHost) {
                    frame["enabled"]?.jsonPrimitive?.booleanOrNull?.let {
                        hostOnlyControl = it
                        broadcastMembers()
                    }
                }
            }

            "setAutoplay" -> {
                frame["enabled"]?.jsonPrimitive?.booleanOrNull?.let {
                    playback = playback.copy(autoplayEnabled = it, seq = playback.seq + 1, updatedAtMs = now)
                    broadcastState()
                }
            }

            "kick" -> {
                if (caller.isHost) {
                    val targetId = frame["memberId"]?.jsonPrimitive?.content ?: return
                    val kickedConn = activeConnections.firstOrNull { it.memberId == targetId }
                    kickedConn?.sendText("""{"type":"bye","reason":"kicked"}""")
                    kickedConn?.close()
                    members.remove(targetId)
                    broadcastMembers()
                }
            }
        }
    }

    private fun effectivePosition(serverMs: Long): Long {
        if (!playback.isPlaying) return playback.positionMs
        val elapsed = (serverMs - playback.anchorMs).coerceAtLeast(0L)
        val pos = playback.positionMs + elapsed
        val dur = playback.track?.durationMs
        return if (dur != null && dur > 0) minOf(pos, dur) else pos
    }

    private fun broadcastState() {
        val now = System.currentTimeMillis()
        val text = buildStateFrame(now)
        activeConnections.forEach { it.sendText(text) }
    }

    private fun broadcastQueue() {
        val text = buildQueueFrame()
        activeConnections.forEach { it.sendText(text) }
    }

    private fun broadcastMembers() {
        val membersList = members.values.sortedBy { it.joinedAtMs }
        val membersJson = json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(PartyMember.serializer()),
            membersList,
        )
        val text = """{"type":"members","members":$membersJson,"maxMembers":$maxMembers,"hostOnlyControl":$hostOnlyControl}"""
        activeConnections.forEach { it.sendText(text) }
    }

    private fun buildStateFrame(now: Long): String {
        val pb = playback.copy(effectivePositionMs = effectivePosition(now))
        val pbJson = json.encodeToString(PartyPlayback.serializer(), pb)
        return """{"type":"state","playback":$pbJson}"""
    }

    private fun buildQueueFrame(): String {
        val qJson = json.encodeToString(PartyQueue.serializer(), queue)
        return """{"type":"queue","queue":$qJson}"""
    }

    private fun buildSnapshot(now: Long): PartySnapshot {
        val pb = playback.copy(effectivePositionMs = effectivePosition(now))
        val membersList = members.values.sortedBy { it.joinedAtMs }
        return PartySnapshot(
            code = code,
            createdAtMs = now,
            maxMembers = maxMembers,
            hostOnlyControl = hostOnlyControl,
            members = membersList,
            playback = pb,
            queue = queue,
            serverMs = now,
        )
    }

    private fun buildMembershipJson(
        code: String,
        token: String,
        you: PartyMember,
        snapshot: PartySnapshot,
        now: Long,
    ): String {
        val youJson = json.encodeToString(PartyMember.serializer(), you)
        val partyJson = json.encodeToString(PartySnapshot.serializer(), snapshot)
        return """{"code":"$code","token":"$token","you":$youJson,"party":$partyJson,"serverMs":$now}"""
    }

    // ------------------------------------------------------------- Socket Wire --

    private class WsConnection(
        private val socket: Socket,
        private val input: InputStream,
        private val output: OutputStream,
        val memberId: String,
    ) {
        private val writeMutex = Any()

        fun sendText(text: String) {
            sendFrame(0x1, text.toByteArray(StandardCharsets.UTF_8))
        }

        fun sendFrame(opcode: Int, payload: ByteArray) {
            synchronized(writeMutex) {
                if (socket.isClosed) return
                try {
                    val out = output
                    out.write(0x80 or (opcode and 0x0F)) // FIN + opcode
                    val len = payload.size
                    when {
                        len <= 125 -> {
                            out.write(len)
                        }
                        len <= 65535 -> {
                            out.write(126)
                            out.write((len shr 8) and 0xFF)
                            out.write(len and 0xFF)
                        }
                        else -> {
                            out.write(127)
                            for (i in 7 downTo 0) {
                                out.write(((len.toLong() shr (i * 8)) and 0xFF).toInt())
                            }
                        }
                    }
                    out.write(payload)
                    out.flush()
                } catch (_: Exception) {}
            }
        }

        fun close() {
            try {
                socket.close()
            } catch (_: Exception) {}
        }
    }

    private data class WsFrame(val opcode: Int, val payload: ByteArray)

    private fun readWebSocketFrame(input: InputStream): WsFrame? {
        val b0 = input.read()
        if (b0 == -1) return null
        val opcode = b0 and 0x0F

        val b1 = input.read()
        if (b1 == -1) return null
        val masked = (b1 and 0x80) != 0
        var payloadLen = (b1 and 0x7F).toLong()

        if (payloadLen == 126L) {
            val h = input.read()
            val l = input.read()
            if (h == -1 || l == -1) return null
            payloadLen = ((h shl 8) or l).toLong()
        } else if (payloadLen == 127L) {
            var len = 0L
            for (i in 0 until 8) {
                val b = input.read()
                if (b == -1) return null
                len = (len shl 8) or (b.toLong() and 0xFF)
            }
            payloadLen = len
        }

        if (payloadLen > 10 * 1024 * 1024) return null // 10MB safety guard

        val maskKey = if (masked) {
            val key = ByteArray(4)
            if (readFully(input, key) != 4) return null
            key
        } else null

        val payload = ByteArray(payloadLen.toInt())
        if (readFully(input, payload) != payload.size) return null

        if (maskKey != null) {
            for (i in payload.indices) {
                payload[i] = (payload[i].toInt() xor maskKey[i % 4].toInt()).toByte()
            }
        }

        return WsFrame(opcode, payload)
    }

    private fun readHttpHeaders(input: InputStream): List<String>? {
        val lines = ArrayList<String>()
        var line = readLine(input) ?: return null
        while (line.isNotEmpty()) {
            lines.add(line)
            line = readLine(input) ?: break
        }
        return lines
    }

    private fun readLine(input: InputStream): String? {
        val baos = ByteArrayOutputStream()
        while (true) {
            val b = input.read()
            if (b == -1) {
                if (baos.size() == 0) return null
                break
            }
            if (b == '\n'.code) break
            if (b != '\r'.code) {
                baos.write(b)
            }
        }
        return baos.toString("UTF-8")
    }

    private fun readExact(input: InputStream, len: Int): String {
        val b = ByteArray(len)
        readFully(input, b)
        return String(b, StandardCharsets.UTF_8)
    }

    private fun readFully(input: InputStream, buffer: ByteArray): Int {
        var total = 0
        while (total < buffer.size) {
            val count = input.read(buffer, total, buffer.size - total)
            if (count == -1) break
            total += count
        }
        return total
    }

    private fun sendJson(out: OutputStream, status: Int, statusText: String, json: String) {
        val bytes = json.toByteArray(StandardCharsets.UTF_8)
        val resp = "HTTP/1.1 $status $statusText\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: ${bytes.size}\r\n" +
                "Connection: close\r\n" +
                "Access-Control-Allow-Origin: *\r\n\r\n"
        out.write(resp.toByteArray(StandardCharsets.UTF_8))
        out.write(bytes)
        out.flush()
    }

    private fun sendJsonError(out: OutputStream, status: Int, code: String, message: String) {
        sendJson(out, status, "Error", """{"error":"$code","message":"$message"}""")
    }

    private fun makeAcceptKey(clientKey: String): String {
        val combined = clientKey.trim() + MAGIC_WEBSOCKET_GUID
        val sha1 = MessageDigest.getInstance("SHA-1").digest(combined.toByteArray(StandardCharsets.UTF_8))
        return android.util.Base64.encodeToString(sha1, android.util.Base64.NO_WRAP)
    }

    private fun buildJsonObjectString(vararg pairs: Pair<String, String>): String {
        return "{" + pairs.joinToString(",") { "\"${it.first}\":${it.second}" } + "}"
    }
}
