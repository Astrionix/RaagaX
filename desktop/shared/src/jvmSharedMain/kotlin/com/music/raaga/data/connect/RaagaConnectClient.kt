package com.music.raaga.data.connect

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/**
 * HTTP client for communicating with remote Raaga Connect receivers.
 */
object RaagaConnectClient {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    suspend fun transferPlayback(
        device: ConnectDevice,
        transfer: ConnectPlaybackTransfer,
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val url = URL("http://${device.host}:${device.port}/raaga-connect/transfer")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 4000
                readTimeout = 4000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
            }

            val body = json.encodeToString(transfer)
            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            conn.disconnect()
            responseCode in 200..299
        }
    }

    suspend fun sendControl(
        device: ConnectDevice,
        command: ConnectControlCommand,
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val url = URL("http://${device.host}:${device.port}/raaga-connect/control")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 3000
                readTimeout = 3000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
            }

            val body = json.encodeToString(command)
            OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(body) }

            val responseCode = conn.responseCode
            conn.disconnect()
            responseCode in 200..299
        }
    }

    suspend fun queryStatus(device: ConnectDevice): Result<ConnectDeviceStatus> = withContext(Dispatchers.IO) {
        runCatching {
            val url = URL("http://${device.host}:${device.port}/raaga-connect/info")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 3000
                readTimeout = 3000
                setRequestProperty("Accept", "application/json")
            }

            val responseCode = conn.responseCode
            if (responseCode !in 200..299) {
                conn.disconnect()
                error("Status query failed with HTTP $responseCode")
            }

            val body = BufferedReader(InputStreamReader(conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
            conn.disconnect()
            json.decodeFromString<ConnectDeviceStatus>(body)
        }
    }
}
