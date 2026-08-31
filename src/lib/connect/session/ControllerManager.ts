/**
 * RaagaX Connect — Controller Manager
 *
 * Tracks connected controller devices for an active playback session.
 * Handles DISCONNECT: removes controller WITHOUT stopping audio playback.
 */

export class ControllerManager {
  private static instance: ControllerManager;
  private activeControllers: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): ControllerManager {
    if (!ControllerManager.instance) {
      ControllerManager.instance = new ControllerManager();
    }
    return ControllerManager.instance;
  }

  public registerController(controllerId: string): void {
    this.activeControllers.add(controllerId);
  }

  public removeController(controllerId: string): void {
    this.activeControllers.delete(controllerId);
    console.log(`[CONNECT_DISCONNECT]\ncontrollerId=${controllerId}\nplaybackContinues=true`);
  }

  public getControllers(): string[] {
    return Array.from(this.activeControllers);
  }

  public isControllerConnected(controllerId: string): boolean {
    return this.activeControllers.has(controllerId);
  }
}
