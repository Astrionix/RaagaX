/**
 * RaagaX Connect — Session Authorization
 *
 * Implements authorization checks:
 * 1. Same Account (Cloud or LAN): Auto-authorized
 * 2. Same Wi-Fi / LAN (Different Account): Authorized if paired/approved via PairingManager
 * 3. Different Account + Different Network: Denied (Zero authorization)
 */

import { PairingManager } from './PairingManager';
import { ConnectAuthStatus } from '@/types/connect';

export interface AuthContext {
  controllerDeviceId: string;
  controllerAccountId?: string | null;
  targetDeviceId: string;
  targetAccountId?: string | null;
  isSameSubnet?: boolean;
}

export class SessionAuth {
  private static instance: SessionAuth;

  private constructor() {}

  public static getInstance(): SessionAuth {
    if (!SessionAuth.instance) {
      SessionAuth.instance = new SessionAuth();
    }
    return SessionAuth.instance;
  }

  public resolveAuthStatus(ctx: AuthContext): ConnectAuthStatus {
    const { controllerDeviceId, controllerAccountId, targetDeviceId, targetAccountId, isSameSubnet } = ctx;

    // 1. Same Account -> Always Auto-authorized
    if (controllerAccountId && targetAccountId && controllerAccountId === targetAccountId) {
      return 'AUTO_AUTHORIZED';
    }

    // 2. Same Wi-Fi (Local LAN) -> Check pairing
    if (isSameSubnet) {
      if (PairingManager.getInstance().isPaired(controllerDeviceId, targetDeviceId)) {
        return 'PAIRED';
      }
      return 'REQUIRES_PAIRING';
    }

    // 3. Different Account + Different Network -> Denied
    return 'DENIED';
  }

  public isAuthorized(
    controllerId: string,
    targetId: string,
    controllerAccountId?: string | null,
    targetAccountId?: string | null,
    isSameSubnet: boolean = true
  ): boolean {
    if (!controllerId || !targetId) return false;
    const status = this.resolveAuthStatus({
      controllerDeviceId: controllerId,
      controllerAccountId,
      targetDeviceId: targetId,
      targetAccountId,
      isSameSubnet,
    });
    return status === 'AUTO_AUTHORIZED' || status === 'PAIRED';
  }
}
