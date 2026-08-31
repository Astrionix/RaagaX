/**
 * RaagaX Connect — Permission Manager
 *
 * Controls role-based permissions (host vs guest controller).
 */

export type ControllerRole = 'HOST' | 'CONTROLLER' | 'LISTENER_ONLY';

export class PermissionManager {
  private static instance: PermissionManager;
  private roles: Map<string, ControllerRole> = new Map();

  private constructor() {}

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  public setRole(deviceId: string, role: ControllerRole): void {
    this.roles.set(deviceId, role);
  }

  public getRole(deviceId: string): ControllerRole {
    return this.roles.get(deviceId) || 'CONTROLLER';
  }

  public canControlPlayback(deviceId: string): boolean {
    const role = this.getRole(deviceId);
    return role === 'HOST' || role === 'CONTROLLER';
  }
}
