/**
 * RaagaX Connect — Gapless Buffer & ABR Audio Engine
 * Handles sample-accurate encoder delay/padding trimming and Adaptive Bitrate (ABR) step-down.
 */

export interface EncoderTrimMetadata {
  readonly encoderDelaySamples: number; // Samples of leading silence to skip (e.g. 576 or 1152)
  readonly encoderPaddingSamples: number; // Samples of trailing silence to discard
  readonly totalSamples: number;
  readonly sampleRate: number;
}

export type BitrateTier = 320 | 160 | 96;

export class GaplessMediaEngine {
  private static instance: GaplessMediaEngine;
  private currentBitrate: BitrateTier = 320;
  private underrunCount: number = 0;
  private lastUnderrunMs: number = 0;

  private constructor() {}

  public static getInstance(): GaplessMediaEngine {
    if (!GaplessMediaEngine.instance) {
      GaplessMediaEngine.instance = new GaplessMediaEngine();
    }
    return GaplessMediaEngine.instance;
  }

  /**
   * Parse Apple/MP3 iTunSMPB metadata or standard Vorbis comments
   * Format: " 00000000 00000200 00000800 0000000000100000 ..."
   */
  public parseEncoderDelay(iTunSMPB?: string, sampleRate: number = 44100): EncoderTrimMetadata {
    if (!iTunSMPB) {
      // Standard LAME/AAC defaults
      return {
        encoderDelaySamples: 576,
        encoderPaddingSamples: 1152,
        totalSamples: 0,
        sampleRate,
      };
    }

    try {
      const parts = iTunSMPB.trim().split(/\s+/);
      if (parts.length >= 3) {
        const delay = parseInt(parts[1], 16) || 576;
        const padding = parseInt(parts[2], 16) || 1152;
        const total = parts[3] ? parseInt(parts[3], 16) : 0;
        return {
          encoderDelaySamples: delay,
          encoderPaddingSamples: padding,
          totalSamples: total,
          sampleRate,
        };
      }
    } catch {}

    return {
      encoderDelaySamples: 576,
      encoderPaddingSamples: 1152,
      totalSamples: 0,
      sampleRate,
    };
  }

  /**
   * Sample-accurate PCM buffer trimming using Web Audio AudioBuffer
   */
  public trimAudioBuffer(audioContext: AudioContext, rawBuffer: AudioBuffer, meta: EncoderTrimMetadata): AudioBuffer {
    const startSample = Math.min(meta.encoderDelaySamples, rawBuffer.length);
    const endSample = Math.max(startSample, rawBuffer.length - meta.encoderPaddingSamples);
    const trimmedLength = Math.max(1, endSample - startSample);

    const trimmed = audioContext.createBuffer(
      rawBuffer.numberOfChannels,
      trimmedLength,
      rawBuffer.sampleRate
    );

    for (let ch = 0; ch < rawBuffer.numberOfChannels; ch++) {
      const channelData = rawBuffer.getChannelData(ch);
      const subArray = channelData.subarray(startSample, endSample);
      trimmed.copyToChannel(subArray, ch);
    }

    return trimmed;
  }

  /**
   * Adaptive Bitrate (ABR) Controller:
   * Dynamically steps down when buffer starvation is detected.
   */
  public recordBufferStarvation(): BitrateTier {
    const now = Date.now();
    // If underrun occurs within 30s of previous one, step down
    if (now - this.lastUnderrunMs < 30000) {
      this.underrunCount++;
      if (this.currentBitrate === 320) {
        this.currentBitrate = 160;
      } else if (this.currentBitrate === 160) {
        this.currentBitrate = 96;
      }
    } else {
      this.underrunCount = 1;
    }
    this.lastUnderrunMs = now;
    return this.currentBitrate;
  }

  /**
   * Attempt step-up to higher fidelity if stable for 60 seconds
   */
  public maybeRecoverBitrate(): BitrateTier {
    const now = Date.now();
    if (now - this.lastUnderrunMs > 60000) {
      if (this.currentBitrate === 96) {
        this.currentBitrate = 160;
      } else if (this.currentBitrate === 160) {
        this.currentBitrate = 320;
      }
    }
    return this.currentBitrate;
  }

  public getCurrentBitrate(): BitrateTier {
    return this.currentBitrate;
  }
}
