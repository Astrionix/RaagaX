package com.music.raaga.data.connect

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets

/**
 * Embedded HTTP server for Raaga Connect receiver on Android local network.
 * Handles incoming playback transfer requests and remote control commands.
 */
class RaagaConnectServer(
    private val getStatus: () -> ConnectDeviceStatus,
    private val onTransfer: (ConnectPlaybackTransfer) -> Unit,
    private val onControl: (ConnectControlCommand) -> Unit,
    private val preferredPort: Int = 8895,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    private var serverSocket: ServerSocket? = null
    private var acceptJob: Job? = null

    val port: Int get() = serverSocket?.localPort ?: preferredPort
    val isRunning: Boolean get() = serverSocket?.isClosed == false && acceptJob?.isActive == true

    fun start(): Int {
        if (isRunning) return port

        // Try preferred port, or scan up to 10 ports
        var boundSocket: ServerSocket? = null
        for (candidate in preferredPort..(preferredPort + 10)) {
            try {
                boundSocket = ServerSocket(candidate)
                break
            } catch (_: Exception) {}
        }

        if (boundSocket == null) {
            boundSocket = ServerSocket(0) // Bind any available port
        }

        serverSocket = boundSocket

        acceptJob = scope.launch {
            while (isActive && !boundSocket.isClosed) {
                try {
                    val client = boundSocket.accept()
                    launch { handleClient(client) }
                } catch (e: Exception) {
                    if (e is CancellationException || boundSocket.isClosed) break
                }
            }
        }

        return boundSocket.localPort
    }

    fun stop() {
        try {
            acceptJob?.cancel()
            serverSocket?.close()
        } catch (_: Exception) {}
        serverSocket = null
    }

    private fun handleClient(socket: Socket) {
        socket.use { s ->
            s.soTimeout = 5000
            val reader = BufferedReader(InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8))
            val writer = OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8)

            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return

            val method = parts[0].uppercase()
            val path = parts[1]

            // Read headers to determine Content-Length
            var contentLength = 0
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                if (line.isNullOrBlank()) break
                val header = line!!
                if (header.startsWith("Content-Length:", ignoreCase = true)) {
                    contentLength = header.substringAfter(":").trim().toIntOrNull() ?: 0
                }
            }

            // Read body if POST
            val body = if (contentLength > 0) {
                val chars = CharArray(contentLength)
                var readTotal = 0
                while (readTotal < contentLength) {
                    val r = reader.read(chars, readTotal, contentLength - readTotal)
                    if (r == -1) break
                    readTotal += r
                }
                String(chars, 0, readTotal)
            } else ""

            when {
                method == "GET" && path.startsWith("/raaga-connect/info") -> {
                    val status = getStatus()
                    val jsonStr = json.encodeToString(status)
                    writeResponse(writer, 200, "OK", jsonStr)
                }

                method == "POST" && path.startsWith("/raaga-connect/transfer") -> {
                    try {
                        val payload = json.decodeFromString<ConnectPlaybackTransfer>(body)
                        onTransfer(payload)
                        writeResponse(writer, 200, "OK", """{"success":true}""")
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                method == "POST" && path.startsWith("/raaga-connect/control") -> {
                    try {
                        val payload = json.decodeFromString<ConnectControlCommand>(body)
                        onControl(payload)
                        writeResponse(writer, 200, "OK", """{"success":true}""")
                    } catch (e: Exception) {
                        writeResponse(writer, 400, "Bad Request", """{"error":"${e.message}"}""")
                    }
                }

                else -> {
                    writeResponse(writer, 404, "Not Found", """{"error":"Not Found"}""")
                }
            }
        }
    }

    private fun writeResponse(writer: OutputStreamWriter, code: Int, message: String, jsonBody: String) {
        val bytes = jsonBody.toByteArray(StandardCharsets.UTF_8)
        writer.write("HTTP/1.1 $code $message\r\n")
        writer.write("Content-Type: application/json; charset=utf-8\r\n")
        writer.write("Content-Length: ${bytes.size}\r\n")
        writer.write("Access-Control-Allow-Origin: *\r\n")
        writer.write("Connection: close\r\n\r\n")
        writer.write(jsonBody)
        writer.flush()
    }
}
