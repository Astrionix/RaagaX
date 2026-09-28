package com.music.aether.listentogether

import com.music.aether.data.listentogether.local.LocalJamHostServer
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalJamHostServerTest {

    private val json = Json { ignoreUnknownKeys = true }
    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) { json(json) }
        expectSuccess = false
    }

    @Test
    fun testLocalHostServerLifecycleAndRestEndpoints(): Unit = runBlocking {
        val server = LocalJamHostServer(requestedPort = 0)
        val port = server.start()
        assertTrue("Port should be assigned", port > 0)
        assertTrue("Server should report running", server.isRunning)

        try {
            // 1. Test /healthz
            val healthRes = client.get("http://127.0.0.1:$port/healthz")
            assertTrue("healthz should succeed", healthRes.status.isSuccess())
            val healthBody = json.parseToJsonElement(healthRes.bodyAsText()).jsonObject
            assertEquals(true, healthBody["ok"]?.jsonPrimitive?.content?.toBoolean())

            // 2. Test create party (POST /api/parties)
            val createReq = buildJsonObject {
                put("userId", "user-host-123")
                put("deviceId", "dev-host-123")
                put("displayName", "Host Chandu")
                put("maxMembers", 5)
            }
            val createRes = client.post("http://127.0.0.1:$port/api/parties") {
                contentType(ContentType.Application.Json)
                setBody(createReq.toString())
            }
            assertTrue("POST /api/parties should return 201 Created", createRes.status.value == 201)
            val createBody = json.parseToJsonElement(createRes.bodyAsText()).jsonObject
            val roomCode = createBody["code"]?.jsonPrimitive?.content
            val hostToken = createBody["token"]?.jsonPrimitive?.content
            assertNotNull("Room code must not be null", roomCode)
            assertEquals(6, roomCode!!.length)
            assertNotNull("Token must not be null", hostToken)

            // 3. Test join party (POST /api/parties/{code}/join)
            val joinReq = buildJsonObject {
                put("userId", "user-guest-456")
                put("deviceId", "dev-guest-456")
                put("displayName", "Guest Friend")
            }
            val joinRes = client.post("http://127.0.0.1:$port/api/parties/$roomCode/join") {
                contentType(ContentType.Application.Json)
                setBody(joinReq.toString())
            }
            assertTrue("POST /api/parties/{code}/join should succeed", joinRes.status.isSuccess())
            val joinBody = json.parseToJsonElement(joinRes.bodyAsText()).jsonObject
            assertEquals(roomCode, joinBody["code"]?.jsonPrimitive?.content)
            val guestToken = joinBody["token"]?.jsonPrimitive?.content
            assertNotNull("Guest token must not be null", guestToken)

            // 4. Test preview (GET /api/parties/{code}/preview)
            val previewRes = client.get("http://127.0.0.1:$port/api/parties/$roomCode/preview")
            assertTrue("Preview should succeed", previewRes.status.isSuccess())
            val previewBody = json.parseToJsonElement(previewRes.bodyAsText()).jsonObject
            assertEquals(2, previewBody["memberCount"]?.jsonPrimitive?.content?.toInt())
            assertEquals("Host Chandu", previewBody["hostName"]?.jsonPrimitive?.content)
        } finally {
            server.stop()
            client.close()
        }
    }
}
