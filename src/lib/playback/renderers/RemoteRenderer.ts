import { Renderer } from '@/types/music';
import { PlaybackRenderer } from './PlaybackRenderer';

import { PlaybackSource } from '../../offline/types';

export class RemoteRenderer implements PlaybackRenderer {
  public readonly type: Renderer = 'remote';
  private positionMs: number = 0;
  private playing: boolean = false;

  public attach(element: HTMLMediaElement): void {}
  public detach(): void {}

  public async prepare(source: PlaybackSource): Promise<void> {
    console.log('[RemoteRenderer] Preparing remote stream:', source);
  }

  public async seekCanonical(positionMs: number): Promise<void> {
    this.positionMs = positionMs;
  }

  public getCanonicalPositionMs(): number {
    return this.positionMs;
  }

  public async play(): Promise<void> {
    this.playing = true;
  }

  public pause(): void {
    this.playing = false;
  }

  public setVolume(volume: number): void {}

  public isReady(): boolean {
    return true;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public destroy(): void {
    this.playing = false;
  }
}
