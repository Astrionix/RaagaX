package com.music.raaga.data.listentogether

import android.content.Intent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder

data class ParsedJamInvite(
    val code: String,
    val serverUrl: String? = null,
)

/** Relays a Raaga web or scheme invite from [com.music.raaga.MainActivity] to Compose. */
object JamInviteLink {

    const val ORIGIN = "https://raaga.app"

    private const val EXTRA_CONSUMED = "raaga.jamInviteConsumed"
    private const val HOST = "raaga.app"
    private const val CUSTOM_SCHEME = "raaga"
    private const val CUSTOM_HOST = "party"

    private val _pending = MutableStateFlow<ParsedJamInvite?>(null)
    val pending: StateFlow<ParsedJamInvite?> = _pending.asStateFlow()

    /** Reads a web invite from a cold launch or a new intent on the existing task. */
    fun consume(intent: Intent?): Boolean {
        if (
            intent == null ||
            intent.action != Intent.ACTION_VIEW ||
            intent.getBooleanExtra(EXTRA_CONSUMED, false)
        ) return false

        val invite = parseInvite(intent.dataString) ?: return false
        intent.putExtra(EXTRA_CONSUMED, true)
        _pending.value = invite
        return true
    }

    fun handled() {
        _pending.value = null
    }

    /** Returns the normalized party code only for the public invite URL shape. */
    fun parse(value: String?): String? = parseInvite(value)?.code

    /**
     * Parses an incoming invite:
     * 1. raaga://party/<CODE>?server=<SERVER>
     * 2. https://<HOST>/invite/<CODE>?server=<SERVER>
     * 3. Full message or clipboard containing an invite URL or "party code <CODE>"
     * 4. Direct "CODE@IP" or "CODE@IP:PORT" format
     * 5. Plain 6-character code
     */
    fun parseInvite(value: String?): ParsedJamInvite? {
        val raw = value?.trim().orEmpty()
        if (raw.isBlank()) return null

        // 0. Direct "CODE@IP" or "CODE@IP:PORT" format
        if (raw.contains("@")) {
            val parts = raw.split("@", limit = 2)
            val candidateCode = cleanCode(parts[0])
            if (candidateCode != null) {
                val server = sanitizeServerUrl(parts[1])
                return ParsedJamInvite(code = candidateCode, serverUrl = server)
            }
        }

        // If the text contains multiple words or lines (e.g. shared message), extract URL or code
        if (raw.contains('\n') || raw.contains(' ')) {
            val urlCandidate = EXTRACT_URL_REGEX.find(raw)?.value
            if (urlCandidate != null) {
                val parsed = parseSingleUri(urlCandidate)
                if (parsed != null) return parsed
            }
            val codeMatch = EXTRACT_CODE_REGEX.find(raw)?.groupValues?.getOrNull(1)
            val candidate = codeMatch?.let { cleanCode(it) }
            if (candidate != null) {
                return ParsedJamInvite(code = candidate, serverUrl = null)
            }
            return null
        }

        return parseSingleUri(raw)
    }

    private fun parseSingleUri(raw: String): ParsedJamInvite? {
        val isExplicitUrl = raw.startsWith("http://", ignoreCase = true) ||
            raw.startsWith("https://", ignoreCase = true) ||
            raw.startsWith("raaga://", ignoreCase = true)

        val uri = runCatching { URI(raw) }.getOrNull()
        if (uri == null || uri.scheme.isNullOrBlank()) {
            return if (!isExplicitUrl) cleanCode(raw)?.let { ParsedJamInvite(it) } else null
        }

        val scheme = uri.scheme?.lowercase() ?: return if (!isExplicitUrl) cleanCode(raw)?.let { ParsedJamInvite(it) } else null
        val host = uri.host?.lowercase().orEmpty()
        val query = uri.rawQuery
        val explicitServer = extractQueryParam(query, "server")?.let { sanitizeServerUrl(it) }

        // 1. Custom scheme: raaga://party/<CODE> or raaga://party?code=<CODE>
        if (scheme == CUSTOM_SCHEME && host == CUSTOM_HOST) {
            val pathPart = uri.path.orEmpty().trim('/').takeIf { it.isNotBlank() }
            val candidate = pathPart ?: extractQueryParam(query, "code") ?: return null
            val code = cleanCode(candidate) ?: return null
            return ParsedJamInvite(code = code, serverUrl = explicitServer)
        }

        // 2. HTTP / HTTPS web invite: /invite/<CODE>
        if (isSchemeAllowedForHost(scheme, host)) {
            val match = INVITE_PATH.matchEntire(uri.path.orEmpty())
            if (match != null && isAllowedHost(host, explicitServer != null)) {
                val code = match.groupValues[1].uppercase()
                val isStaticWebFrontend = host == HOST || host == "web.raaga.me" || host == "raaga.me"
                val serverUrl = explicitServer ?: if (!isStaticWebFrontend) {
                    val portPart = if (uri.port != -1 && !(scheme == "http" && uri.port == 80) && !(scheme == "https" && uri.port == 443)) {
                        ":${uri.port}"
                    } else ""
                    "$scheme://$host$portPart"
                } else null

                return ParsedJamInvite(code = code, serverUrl = serverUrl)
            }
        }

        return if (!isExplicitUrl) cleanCode(raw)?.let { ParsedJamInvite(it) } else null
    }

    private fun isSchemeAllowedForHost(scheme: String, host: String): Boolean {
        if (scheme == "https") return true
        if (scheme == "http" && isLocalHost(host)) return true
        return false
    }

    private fun isAllowedHost(host: String, hasExplicitServerParam: Boolean): Boolean {
        if (host.isBlank()) return false
        if (host == HOST || host == "web.raaga.me" || host == "raaga.me") return true
        if (host.endsWith(".onrender.com") || host == "onrender.com") return true
        if (isLocalHost(host)) return true
        if (hasExplicitServerParam) return true
        for (server in ListenTogether.defaultServers) {
            val sUri = runCatching { URI(server) }.getOrNull()
            if (sUri?.host?.equals(host, ignoreCase = true) == true) return true
        }
        val custom = ListenTogether.configuredCustomServer()
        if (custom.isNotBlank()) {
            val cUri = runCatching { URI(custom) }.getOrNull()
            if (cUri?.host?.equals(host, ignoreCase = true) == true) return true
        }
        return false
    }

    private fun isLocalHost(host: String): Boolean {
        val h = host.lowercase()
        return h == "localhost" ||
            h == "127.0.0.1" ||
            h == "0.0.0.0" ||
            h == "::1" ||
            h.startsWith("192.168.") ||
            h.startsWith("10.") ||
            Regex("""^172\.(1[6-9]|2[0-9]|3[0-1])\.""").containsMatchIn(h)
    }

    fun url(code: String, customServer: String? = null): String {
        val base = customServer?.trim()?.trimEnd('/')
        return if (!base.isNullOrBlank() && !base.equals(ORIGIN, ignoreCase = true)) {
            "$base/invite/${code.uppercase()}"
        } else {
            "$ORIGIN/invite/${code.uppercase()}"
        }
    }

    fun schemeUrl(code: String, customServer: String? = null): String {
        val normalizedCode = code.uppercase()
        val base = customServer?.trim()?.trimEnd('/')
        return if (!base.isNullOrBlank()) {
            val encoded = runCatching { URLEncoder.encode(base, "UTF-8") }.getOrDefault(base)
            "raaga://party/$normalizedCode?server=$encoded"
        } else {
            "raaga://party/$normalizedCode"
        }
    }

    private fun cleanCode(raw: String): String? {
        val cleaned = raw.filter { it.isLetterOrDigit() }.uppercase()
        return if (cleaned.length == ListenTogether.CODE_LENGTH) cleaned else null
    }

    private fun extractQueryParam(query: String?, paramName: String): String? {
        if (query.isNullOrBlank()) return null
        return query.split('&').asSequence()
            .map { it.split('=', limit = 2) }
            .firstOrNull { it.isNotEmpty() && it[0].equals(paramName, ignoreCase = true) }
            ?.getOrNull(1)
            ?.let { runCatching { URLDecoder.decode(it, "UTF-8") }.getOrDefault(it) }
    }

    private fun sanitizeServerUrl(raw: String?): String? {
        val trimmed = raw?.trim()?.trimEnd('/') ?: return null
        if (trimmed.isBlank()) return null
        val withScheme = if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
            trimmed
        } else {
            "https://$trimmed"
        }
        val uri = runCatching { URI(withScheme) }.getOrNull() ?: return null
        if (uri.host.isNullOrBlank()) return null
        return withScheme
    }

    private val INVITE_PATH = Regex("""/invite/([A-Za-z0-9]{${ListenTogether.CODE_LENGTH}})""")
    private val EXTRACT_URL_REGEX = Regex("""(?i)\b(?:https?://[^\s]+|raaga://[^\s]+)""")
    private val EXTRACT_CODE_REGEX = Regex("""(?i)(?:party\s+code\s*[:—\-]?\s*|code\s*[:—\-]?\s*)\b([A-Za-z0-9]{${ListenTogether.CODE_LENGTH}})\b""")
}
