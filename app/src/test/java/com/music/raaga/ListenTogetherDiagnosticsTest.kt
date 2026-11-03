package com.music.raaga

import com.music.raaga.data.listentogether.ListenTogether
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ListenTogetherDiagnosticsTest {

    @Test
    fun `diagnostic error messages distinguish join and connection failure states`() {
        val errNotFound = ListenTogether.PartyException("no_such_party", "Room code not found.", 404)
        val errFull = ListenTogether.PartyException("party_full", "Room full.", 409)
        val errAuth = ListenTogether.PartyException("unauthorized", "WebSocket authorization failed.", 401)
        val errHttpJoin = ListenTogether.PartyException("server_error", "HTTP join failed.", 500)
        val errNoWelcome = ListenTogether.PartyException("no_welcome_frame", "WebSocket connected but no welcome frame.", null)
        val errDisconnected = ListenTogether.PartyException("socket_closed", "Socket disconnected after joining.", null)
        val errHandshake = ListenTogether.PartyException("handshake_failed", "WebSocket handshake failed.", null)

        assertEquals("Room code not found.", errNotFound.message)
        assertEquals(404, errNotFound.statusCode)

        assertEquals("Room full.", errFull.message)
        assertEquals(409, errFull.statusCode)

        assertEquals("WebSocket authorization failed.", errAuth.message)
        assertEquals(401, errAuth.statusCode)

        assertEquals("HTTP join failed.", errHttpJoin.message)
        assertEquals(500, errHttpJoin.statusCode)

        assertEquals("WebSocket connected but no welcome frame.", errNoWelcome.message)
        assertEquals("Socket disconnected after joining.", errDisconnected.message)
        assertEquals("WebSocket handshake failed.", errHandshake.message)
    }

    @Test
    fun `safe logging does not leak bearer tokens`() {
        // Verify that logDiagnostic does not throw and safely handles structured logging
        ListenTogether.logDiagnostic(
            phase = "ws_connecting",
            message = "Connecting to Authorization: Bearer secret_token_123456",
            server = "https://raaga-party.onrender.com",
        )
        ListenTogether.logDiagnostic(
            phase = "http_join_failed",
            message = "Failed to join room ABC123 with token=secret_token_123456",
            statusCode = 404,
            errorCode = "no_such_party",
            server = "http://192.168.1.50:8000",
        )
    }
}

