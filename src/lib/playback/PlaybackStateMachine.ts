import { PlaybackState } from './types';

export class PlaybackStateMachine {
  private currentState: PlaybackState = 'IDLE';

  public getState(): PlaybackState {
    return this.currentState;
  }

  public canTransitionTo(newState: PlaybackState): boolean {
    switch (this.currentState) {
      case 'IDLE':
        return ['LOADING', 'ERROR'].includes(newState);
      case 'LOADING':
        return ['READY', 'ERROR', 'IDLE'].includes(newState);
      case 'READY':
        return ['PLAYING', 'ERROR', 'IDLE'].includes(newState);
      case 'PLAYING':
        return ['PAUSED', 'INTERRUPTED', 'HANDOFF', 'ERROR', 'IDLE'].includes(newState);
      case 'PAUSED':
        return ['PLAYING', 'LOADING', 'HANDOFF', 'ERROR', 'IDLE'].includes(newState);
      case 'INTERRUPTED':
        return ['PLAYING', 'PAUSED', 'ERROR', 'IDLE'].includes(newState);
      case 'HANDOFF':
        return ['PLAYING', 'PAUSED', 'ERROR', 'IDLE'].includes(newState);
      case 'ERROR':
        return ['IDLE', 'LOADING'].includes(newState);
      default:
        return false;
    }
  }

  public transitionTo(newState: PlaybackState): boolean {
    if (this.canTransitionTo(newState)) {
      this.currentState = newState;
      return true;
    }
    console.warn(`[PlaybackStateMachine] Invalid transition from ${this.currentState} to ${newState}`);
    return false;
  }
}
