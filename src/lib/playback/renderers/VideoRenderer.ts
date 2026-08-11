import { Renderer } from '@/types/music';
import { BaseRenderer } from './BaseRenderer';

export class VideoRenderer extends BaseRenderer {
  public readonly type: Renderer = 'video';
}
