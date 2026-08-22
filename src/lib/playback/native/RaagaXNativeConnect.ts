'use client';

import { LANDeviceAdvertisement, LANMessage } from '@/lib/connect/lan/types';

export class RaagaXNativeConnect {
  private static messageListener: ((msg: LANMessage) => void) | null = null;

  public static isNative(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
  }

  public static async requestLocalNetworkPermissions(): Promise<boolean> {
    if (!this.isNative()) return true;

    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.RaagaXConnectPlugin?.requestPermissions) {
        const res = await cap.Plugins.RaagaXConnectPlugin.requestPermissions();
        return res?.granted !== false;
      }
    } catch (e) {
      console.warn('[RaagaXNativeConnect] Permission request warning:', e);
    }
    return true;
  }

  public static async startLocalServer(preferredPort: number = 47104): Promise<number> {
    if (!this.isNative()) return preferredPort;

    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.RaagaXConnectPlugin?.startServer) {
        const res = await cap.Plugins.RaagaXConnectPlugin.startServer({ port: preferredPort });
        return res?.port || preferredPort;
      }
    } catch (e) {
      console.warn('[RaagaXNativeConnect] Native startServer error:', e);
    }
    return preferredPort;
  }

  public static async registerNsdService(advertisement: LANDeviceAdvertisement): Promise<boolean> {
    if (!this.isNative()) return false;

    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.RaagaXConnectPlugin?.registerNsdService) {
        await cap.Plugins.RaagaXConnectPlugin.registerNsdService({
          serviceName: `RaagaX-${advertisement.deviceId}`,
          serviceType: '_raagax-connect._tcp.',
          port: advertisement.port,
          attributes: {
            deviceId: advertisement.deviceId,
            deviceName: advertisement.deviceName,
            platform: advertisement.platform,
            userId: advertisement.userId || '',
          },
        });
        return true;
      }
    } catch (e) {
      console.warn('[RaagaXNativeConnect] registerNsdService error:', e);
    }
    return false;
  }

  public static async startNsdDiscovery(onDiscovered: (device: LANDeviceAdvertisement) => void): Promise<boolean> {
    if (!this.isNative()) return false;

    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.RaagaXConnectPlugin?.startNsdDiscovery) {
        cap.Plugins.RaagaXConnectPlugin.addListener('onNsdDeviceFound', (device: any) => {
          if (device && device.deviceId) {
            onDiscovered({
              deviceId: device.deviceId,
              deviceName: device.deviceName || 'Android Device',
              deviceType: 'mobile',
              platform: 'android',
              protocolVersion: '2.0.0',
              host: device.host || '127.0.0.1',
              port: device.port || 47104,
              capabilities: ['playback', 'remote_control'],
              userId: device.userId,
              currentActivity: device.currentActivity || 'idle',
              timestamp: Date.now(),
            });
          }
        });

        await cap.Plugins.RaagaXConnectPlugin.startNsdDiscovery({
          serviceType: '_raagax-connect._tcp.',
        });
        return true;
      }
    } catch (e) {
      console.warn('[RaagaXNativeConnect] startNsdDiscovery error:', e);
    }
    return false;
  }

  public static setIncomingMessageListener(listener: (msg: LANMessage) => void) {
    this.messageListener = listener;
  }
}
