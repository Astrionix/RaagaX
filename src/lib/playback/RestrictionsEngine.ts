import { PlayerRestrictions } from './types';
import { Song } from '@/types/music';

export class RestrictionsEngine {
  private static instance: RestrictionsEngine;

  private constructor() {}

  public static getInstance(): RestrictionsEngine {
    if (!RestrictionsEngine.instance) {
      RestrictionsEngine.instance = new RestrictionsEngine();
    }
    return RestrictionsEngine.instance;
  }

  public evaluate(options: {
    queueItems: Song[];
    currentIndex: number;
    isPlaying: boolean;
    isOffline: boolean;
    repeatMode?: string;
  }): PlayerRestrictions {
    const { queueItems, currentIndex, isOffline } = options;

    const disallowSkipNext: string[] = [];
    const disallowSkipPrev: string[] = [];
    const disallowSeek: string[] = [];
    const disallowPause: string[] = [];
    const disallowSetQueue: string[] = [];
    const disallowTransfer: string[] = [];

    // Next track restrictions
    if (queueItems.length === 0) {
      disallowSkipNext.push('EMPTY_QUEUE');
    } else if (currentIndex >= queueItems.length - 1 && options.repeatMode !== 'CONTEXT' && options.repeatMode !== 'TRACK') {
      disallowSkipNext.push('END_OF_QUEUE');
    }

    // Previous track restrictions
    if (queueItems.length === 0) {
      disallowSkipPrev.push('EMPTY_QUEUE');
    } else if (currentIndex <= 0 && options.repeatMode !== 'CONTEXT' && options.repeatMode !== 'TRACK') {
      disallowSkipPrev.push('START_OF_QUEUE');
    }

    // Offline mode restrictions
    if (isOffline) {
      disallowTransfer.push('OFFLINE_MODE');
    }

    return {
      disallowSkipNext,
      disallowSkipPrev,
      disallowSeek,
      disallowPause,
      disallowSetQueue,
      disallowTransfer,
    };
  }
}
