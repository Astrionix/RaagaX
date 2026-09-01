/**
 * RaagaX Connect — Cloud Relay Transport
 *
 * Fallback transport when direct LAN transport is DEGRADED or FAILED.
 */

import { ConnectCommand } from '@/types/connect';
import { getApiUrl } from '@/lib/config/apiConfig';

export class CloudTransport {
  private static instance: CloudTransport;

  private constructor() {}

  public static getInstance(): CloudTransport {
    if (!CloudTransport.instance) {
      CloudTransport.instance = new CloudTransport();
    }
    return CloudTransport.instance;
  }

  public async sendCommand(command: ConnectCommand): Promise<boolean> {
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(getApiUrl('/api/connect/command'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(command),
        });
        return res.ok;
      } catch {
        return false;
      }
    }
    return false;
  }
}
