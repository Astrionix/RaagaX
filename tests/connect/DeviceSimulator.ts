import { ConnectState, ConnectCommand } from '../../src/lib/connect/types';

export class DeviceSimulator {
  public deviceId: string;
  public instanceId: string;
  public role: 'RENDERER' | 'CONTROLLER';
  public networkState: 'ONLINE' | 'OFFLINE' = 'ONLINE';
  public connectState: ConnectState = 'READY';
  public isPlaying: boolean = false;
  public currentTrackId: string | null = null;
  public positionMs: number = 0;
  public leaseId: string | null = null;

  constructor(deviceId: string, role: 'RENDERER' | 'CONTROLLER' = 'CONTROLLER') {
    this.deviceId = deviceId;
    this.instanceId = 'inst_' + deviceId;
    this.role = role;
  }

  public setNetworkState(state: 'ONLINE' | 'OFFLINE') {
    this.networkState = state;
    this.connectState = state === 'ONLINE' ? 'READY' : 'OFFLINE';
  }

  public preparePlayback(trackId: string, positionMs: number) {
    if (this.networkState === 'OFFLINE') {
      throw new Error('Device is offline, cannot prepare playback');
    }
    this.currentTrackId = trackId;
    this.positionMs = positionMs;
  }

  public startPlayback() {
    if (this.networkState === 'OFFLINE') {
      throw new Error('Device is offline, cannot start playback');
    }
    this.isPlaying = true;
  }

  public stopPlayback() {
    this.isPlaying = false;
  }
}
