/*
 * Copyright (C) 2026 Raaga Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 */

package com.music.raaga.playback.audio.usb

import com.music.raaga.playback.audio.PcmEncoding

/**
 * Evaluates source audio format against attached USB DAC capabilities, determining whether
 * direct bit-perfect transport is viable or if conversion to the DAC's best supported format
 * is required.
 */
data class DacNegotiationResult(
    val sampleRateHz: Int,
    val encoding: PcmEncoding,
    val isExact: Boolean,
    val isDacLimited: Boolean,
    val conversionDetail: String? = null,
)

object DacFormatConverter {

    /**
     * Resolves the optimal playback format for an attached USB DAC based on endpoint bandwidth
     * and supported bit depths.
     *
     * @param sourceSampleRateHz Incoming audio stream sample rate (e.g. 96000).
     * @param sourceBitDepth Incoming audio stream bit depth (e.g. 24).
     * @param probe Active [DirectUsbProbeResult] containing max calculated sample rate and bit depths.
     * @param allowConversion Whether "Convert for Limited DAC" setting is enabled.
     * @return [DacNegotiationResult] with target format, or null if DAC cannot play and conversion is disabled.
     */
    fun resolve(
        sourceSampleRateHz: Int,
        sourceBitDepth: Int,
        probe: DirectUsbProbeResult,
        allowConversion: Boolean,
    ): DacNegotiationResult? {
        val maxDacRate = if (probe.maxCalculatedSampleRate > 0) probe.maxCalculatedSampleRate else 48000
        val supportedDepths = probe.supportedBitDepths.ifEmpty { listOf(16) }

        val rateMatches = sourceSampleRateHz <= maxDacRate
        val depthMatches = supportedDepths.contains(sourceBitDepth)

        // Perfect bit-perfect match
        if (rateMatches && depthMatches) {
            val encoding = if (sourceBitDepth > 16) PcmEncoding.PCM_24BIT_PACKED else PcmEncoding.PCM_16BIT
            return DacNegotiationResult(
                sampleRateHz = sourceSampleRateHz,
                encoding = encoding,
                isExact = true,
                isDacLimited = false,
                conversionDetail = null,
            )
        }

        // Conversion disabled: cannot play bit-perfect on this DAC
        if (!allowConversion) {
            return null
        }

        // Adapt to best available rate/depth without rejection
        val targetRate = if (sourceSampleRateHz > maxDacRate) maxDacRate else sourceSampleRateHz
        val targetDepth = supportedDepths.filter { it <= sourceBitDepth }.maxOrNull()
            ?: supportedDepths.minOrNull() ?: 16

        val targetEncoding = if (targetDepth > 16) PcmEncoding.PCM_24BIT_PACKED else PcmEncoding.PCM_16BIT

        val reason = "Source (${sourceSampleRateHz}Hz/${sourceBitDepth}b) converted to ${targetRate}Hz/${targetDepth}b for DAC limit"

        return DacNegotiationResult(
            sampleRateHz = targetRate,
            encoding = targetEncoding,
            isExact = false,
            isDacLimited = true,
            conversionDetail = reason,
        )
    }
}

