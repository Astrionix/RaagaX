import { PlaybackState } from './types';

export class PlaybackStateMachine {
  private currentState: PlaybackState = 'IDLE';

  public getState(): PlaybackState {
    return this.currentState;
  }

  public canTransitionTo(newState: PlaybackState): boolean {
    switch (this.currentState) {
      case 'IDLE':
        return ['LOADING', 'READY', 'PLAYING', 'ERROR', 'TRANSITIONING', 'PAUSED'].includes(newState);
      case 'LOADING':
        return ['READY', 'ERROR', 'IDLE', 'PLAYING', 'TRANSITIONING', 'PAUSED'].includes(newState);
      case 'READY':
        return ['PLAYING', 'PAUSED', 'ERROR', 'IDLE', 'TRANSITIONING', 'LOADING'].includes(newState);
      case 'PLAYING':
        return ['PAUSED', 'INTERRUPTED', 'TRANSITIONING', 'HANDOFF', 'ERROR', 'IDLE', 'READY', 'LOADING'].includes(newState);
      case 'PAUSED':
        return ['PLAYING', 'LOADING', 'READY', 'TRANSITIONING', 'HANDOFF', 'ERROR', 'IDLE'].includes(newState);
      case 'INTERRUPTED':
        return ['PLAYING', 'PAUSED', 'READY', 'LOADING', 'ERROR', 'IDLE'].includes(newState);
      case 'TRANSITIONING':
        return ['PLAYING', 'LOADING', 'READY', 'RETRYING', 'ERROR', 'IDLE', 'PAUSED'].includes(newState);
      case 'RETRYING':
        return ['PLAYING', 'LOADING', 'READY', 'ERROR', 'IDLE'].includes(newState);
      case 'HANDOFF':
        return ['PLAYING', 'PAUSED', 'READY', 'LOADING', 'ERROR', 'IDLE'].includes(newState);
      case 'ERROR':
        return ['IDLE', 'LOADING', 'READY', 'RETRYING', 'TRANSITIONING', 'PAUSED'].includes(newState);
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
