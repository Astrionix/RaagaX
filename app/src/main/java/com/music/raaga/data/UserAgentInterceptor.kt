package com.music.raaga.data

import coil3.intercept.Interceptor
import coil3.network.NetworkHeaders
import coil3.network.httpHeaders
import coil3.request.ImageResult

/**
 * Ensures all image loads carry a modern browser User-Agent so CDNs
 * (such as Wikimedia Commons) do not reject requests with 403 Forbidden.
 */
class UserAgentInterceptor : Interceptor {
    override suspend fun intercept(chain: Interceptor.Chain): ImageResult {
        val request = chain.request
        val currentUa = request.httpHeaders["User-Agent"]
        val newRequest = if (currentUa.isNullOrBlank()) {
            val headers = NetworkHeaders.Builder(request.httpHeaders)
                .set("User-Agent", BROWSER_USER_AGENT)
                .build()
            request.newBuilder().httpHeaders(headers).build()
        } else {
            request
        }
        return chain.withRequest(newRequest).proceed()
    }

    companion object {
        const val BROWSER_USER_AGENT =
            "Mozilla/5.0 (Android; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"
    }
}

