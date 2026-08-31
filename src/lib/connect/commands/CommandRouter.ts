/**
 * RaagaX Connect — Command Router
 *
 * Directs commands through Local LAN transport or Cloud fallback
 * based on live transport health.
 */

import { ConnectCommand } from '@/types/connect';
import { LocalLanTransport } from '../transport/LocalLanTransport';
import { CloudTransport } from '../transport/CloudTransport';

export class CommandRouter {
  private static instance: CommandRouter;

  private constructor() {}

  public static getInstance(): CommandRouter {
    if (!CommandRouter.instance) {
      CommandRouter.instance = new CommandRouter();
    }
    return CommandRouter.instance;
  }

  public async route(command: ConnectCommand): Promise<boolean> {
    const lan = LocalLanTransport.getInstance();
    const health = lan.getHealth();

    if (health === 'HEALTHY' || health === 'DEGRADED') {
      const ok = await lan.sendCommand(command);
      if (ok) return true;
    }

    // Fallback to cloud relay if LAN fails
    return CloudTransport.getInstance().sendCommand(command);
  }
}
