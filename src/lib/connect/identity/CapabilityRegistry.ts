/**
 * RaagaX Connect — Capability Registry
 *
 * Defines and validates what specific features each playback target supports
 * (e.g., volume control, gapless playback, lyrics stream, lossless audio).
 */

export interface DeviceCapabilities {
  canPlayAudio: boolean;
  supportsVolume: boolean;
  supportsLossless: boolean;
  queueControl: boolean;
  lyrics: boolean;
  nativePlayback: boolean;
  gaplessPlayback: boolean;
  maxBitrateKbps: number;
}

export const DEFAULT_CAPABILITIES: DeviceCapabilities = {
  canPlayAudio: true,
  supportsVolume: true,
  supportsLossless: true,
  queueControl: true,
  lyrics: true,
  nativePlayback: false,
  gaplessPlayback: true,
  maxBitrateKbps: 320,
};

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private capabilitiesMap: Map<string, DeviceCapabilities> = new Map();

  private constructor() {}

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  public register(deviceId: string, capabilities: Partial<DeviceCapabilities>): void {
    const merged: DeviceCapabilities = {
      ...DEFAULT_CAPABILITIES,
      ...capabilities,
    };
    this.capabilitiesMap.set(deviceId, merged);
  }

  public get(deviceId: string): DeviceCapabilities {
    return this.capabilitiesMap.get(deviceId) || { ...DEFAULT_CAPABILITIES };
  }

  public supports(deviceId: string, capability: keyof DeviceCapabilities): boolean {
    const caps = this.get(deviceId);
    return !!caps[capability];
  }
}
