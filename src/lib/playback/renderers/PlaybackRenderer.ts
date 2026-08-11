import { Renderer } from '@/types/music';

export interface PlaybackRenderer {
  readonly type: Renderer;

  attach(element: HTMLMediaElement): void;
  detach(): void;

  prepare(sourceUri: string): Promise<void>;

  seekCanonical(positionMs: number): Promise<void>;

  getCanonicalPositionMs(): number;

  play(): Promise<void>;
  pause(): void;

  setVolume(volume: number): void;

  isReady(): boolean;
  isPlaying(): boolean;

  destroy(): void;
}
