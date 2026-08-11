import { Renderer } from '@/types/music';
import { PlaybackRenderer } from './PlaybackRenderer';
import { PlaybackSource } from '../../offline/types';
import { DownloadStorage } from '../../offline/DownloadStorage';

export abstract class BaseRenderer implements PlaybackRenderer {
  public abstract readonly type: Renderer;
  protected element: HTMLMediaElement | null = null;
  protected isPrepared: boolean = false;

  public attach(element: HTMLMediaElement): void {
    this.element = element;
  }

  public detach(): void {
    this.element = null;
    this.isPrepared = false;
  }

  public async prepare(source: PlaybackSource): Promise<void> {
    if (source.type === 'offline') {
      const storage = DownloadStorage.getInstance();
      const url = await storage.getMediaUrl(source.localId);
      if (!url) throw new Error('Local media not found');
      return this.prepareImplementation(url);
    } else {
      return this.prepareImplementation(source.url);
    }
  }

  public async prepareImplementation(sourceUri: string): Promise<void> {
    if (!this.element) throw new Error(`[${this.type}Renderer] Element not attached`);

    return new Promise((resolve, reject) => {
      if (!this.element) return reject(new Error('Element detached during prepare'));

      const onCanPlay = () => {
        this.element?.removeEventListener('canplay', onCanPlay);
        this.element?.removeEventListener('error', onError);
        this.isPrepared = true;
        resolve();
      };

      const onError = (e: Event) => {
        this.element?.removeEventListener('canplay', onCanPlay);
        this.element?.removeEventListener('error', onError);
        this.isPrepared = false;
        reject(new Error(`[${this.type}Renderer] Failed to load source: ${sourceUri}`));
      };

      if (!this.element.src.includes(sourceUri)) {
        this.element.src = sourceUri;
        this.element.load();
      }

      if (this.element.readyState >= 3) {
        onCanPlay();
      } else {
        this.element.addEventListener('canplay', onCanPlay);
        this.element.addEventListener('error', onError);
      }
    });
  }

  public async seekCanonical(positionMs: number): Promise<void> {
    if (!this.element) return;
    this.element.currentTime = positionMs / 1000;
  }

  public getCanonicalPositionMs(): number {
    return this.element ? this.element.currentTime * 1000 : 0;
  }

  public async play(): Promise<void> {
    if (this.element) {
      await this.element.play();
    }
  }

  public pause(): void {
    if (this.element) {
      this.element.pause();
    }
  }

  public setVolume(volume: number): void {
    if (this.element) {
      this.element.volume = Math.max(0, Math.min(1, volume));
    }
  }

  public isReady(): boolean {
    return this.isPrepared && this.element !== null && this.element.readyState >= 3;
  }

  public isPlaying(): boolean {
    return this.element !== null && !this.element.paused;
  }

  public destroy(): void {
    if (this.element) {
      this.element.pause();
      this.element.src = '';
    }
    this.detach();
  }
}
