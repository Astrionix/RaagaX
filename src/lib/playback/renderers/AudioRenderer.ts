import { Renderer } from '@/types/music';
import { BaseRenderer } from './BaseRenderer';

export class AudioRenderer extends BaseRenderer {
  public readonly type: Renderer = 'audio';
}
