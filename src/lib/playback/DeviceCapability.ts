export interface DeviceCaps {
  canPlayLossless: boolean;
  canPlayHighRes: boolean;
}

export class DeviceCapability {
  private static instance: DeviceCapability;
  private caps: DeviceCaps | null = null;
  private evaluationPromise: Promise<DeviceCaps> | null = null;

  private constructor() {}

  public static getInstance(): DeviceCapability {
    if (!DeviceCapability.instance) {
      DeviceCapability.instance = new DeviceCapability();
    }
    return DeviceCapability.instance;
  }

  public async getCapabilities(): Promise<DeviceCaps> {
    if (this.caps) return this.caps;
    
    if (this.evaluationPromise) {
      return this.evaluationPromise;
    }
    
    this.evaluationPromise = this.evaluate();
    this.caps = await this.evaluationPromise;
    return this.caps;
  }

  private async evaluate(): Promise<DeviceCaps> {
    if (typeof navigator === 'undefined' || !navigator.mediaCapabilities) {
      // Fallback if Media Capabilities API isn't supported
      return { canPlayLossless: false, canPlayHighRes: false };
    }

    try {
      // Check FLAC support
      const flacConfig: MediaDecodingConfiguration = {
        type: 'file',
        audio: {
          contentType: 'audio/flac',
          channels: '2',
          bitrate: 1411200, // CD quality
          samplerate: 44100
        }
      };

      const flacInfo = await navigator.mediaCapabilities.decodingInfo(flacConfig);
      
      const highResConfig: MediaDecodingConfiguration = {
        type: 'file',
        audio: {
          contentType: 'audio/flac',
          channels: '2',
          bitrate: 4608000, // 24-bit 96kHz approx
          samplerate: 96000
        }
      };
      
      const highResInfo = await navigator.mediaCapabilities.decodingInfo(highResConfig);

      return {
        canPlayLossless: flacInfo.supported && flacInfo.smooth,
        canPlayHighRes: highResInfo.supported && highResInfo.smooth
      };
      
    } catch (e) {
      console.warn('Failed to evaluate device capabilities', e);
      return { canPlayLossless: false, canPlayHighRes: false };
    }
  }
}
