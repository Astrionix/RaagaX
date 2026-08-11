import { PlaybackState } from './types';

export class PlaybackStateMachine {
  private currentState: PlaybackState = 'IDLE';

  public getState(): PlaybackState {
    return this.currentState;
  }

  public canTransitionTo(newState: PlaybackState): boolean {
    switch (this.currentState) {
      case 'IDLE':
        return ['LOADING', 'READY', 'PLAYING', 'ERROR', 'TRANSITIONING'].includes(newState);
      case 'LOADING':
        return ['READY', 'ERROR', 'IDLE', 'PLAYING', 'TRANSITIONING'].includes(newState);
      case 'READY':
        return ['PLAYING', 'PAUSED', 'ERROR', 'IDLE', 'TRANSITIONING'].includes(newState);
      case 'PLAYING':
        return ['PAUSED', 'INTERRUPTED', 'TRANSITIONING', 'HANDOFF', 'ERROR', 'IDLE'].includes(newState);
      case 'PAUSED':
        return ['PLAYING', 'LOADING', 'TRANSITIONING', 'HANDOFF', 'ERROR', 'IDLE'].includes(newState);
      case 'INTERRUPTED':
        return ['PLAYING', 'PAUSED', 'ERROR', 'IDLE'].includes(newState);
      case 'TRANSITIONING':
        return ['PLAYING', 'LOADING', 'READY', 'RETRYING', 'ERROR', 'IDLE', 'PAUSED'].includes(newState);
      case 'RETRYING':
        return ['PLAYING', 'LOADING', 'ERROR', 'IDLE'].includes(newState);
      case 'HANDOFF':
        return ['PLAYING', 'PAUSED', 'ERROR', 'IDLE'].includes(newState);
      case 'ERROR':
        return ['IDLE', 'LOADING', 'RETRYING', 'TRANSITIONING'].includes(newState);
      default:
        return false;
    }
  }

  public transitionTo(newState: PlaybackState): boolean {
    if (this.currentState === newState) return true;
    if (this.canTransitionTo(newState)) {
      this.currentState = newState;
      return true;
    }
    console.warn(`[PlaybackStateMachine] Invalid transition from ${this.currentState} to ${newState}`);
    return false;
  }
}
