/**
 * RaagaX Connect — Multi-User Session Isolation & Jam Permission Guard
 * Enforces role-based capability matrices across collaborative playback sessions.
 */

import { ClientCommandAction } from './types';

export type JamParticipantRole = 'HOST' | 'CO_HOST' | 'GUEST';

export interface JamParticipant {
  readonly userId: string;
  readonly deviceId: string;
  readonly name: string;
  readonly role: JamParticipantRole;
  readonly joinedAtMs: number;
}

export interface JamSessionPolicy {
  readonly allowGuestControl: boolean; // If false, guests can only add tracks to the queue
  readonly allowGuestSkip: boolean;
  readonly voteSkipThreshold: number; // Ratio of guests required to skip (e.g. 0.5 = 50%)
}

export class JamPermissionGuard {
  private static instance: JamPermissionGuard;
  private participants: Map<string, JamParticipant> = new Map();
  private policy: JamSessionPolicy = {
    allowGuestControl: false,
    allowGuestSkip: false,
    voteSkipThreshold: 0.5,
  };
  private skipVotes: Set<string> = new Set(); // User IDs voting to skip current track

  private constructor() {}

  public static getInstance(): JamPermissionGuard {
    if (!JamPermissionGuard.instance) {
      JamPermissionGuard.instance = new JamPermissionGuard();
    }
    return JamPermissionGuard.instance;
  }

  public registerParticipant(participant: JamParticipant): void {
    this.participants.set(participant.userId, participant);
  }

  public removeParticipant(userId: string): void {
    this.participants.delete(userId);
    this.skipVotes.delete(userId);
  }

  public setPolicy(policy: Partial<JamSessionPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * Validate whether a command action is authorized for the given user
   */
  public canExecuteAction(userId: string, action: ClientCommandAction): { authorized: boolean; reason?: string } {
    const participant = this.participants.get(userId);
    if (!participant) {
      return { authorized: false, reason: 'Participant not in session' };
    }

    if (participant.role === 'HOST') {
      return { authorized: true };
    }

    if (participant.role === 'CO_HOST') {
      // Co-hosts can perform all playback actions except transferring physical sink ownership
      if (action === 'TRANSFER_PLAYBACK') {
        return { authorized: false, reason: 'Only Session Host can transfer physical speaker' };
      }
      return { authorized: true };
    }

    // GUEST Permissions
    switch (action) {
      case 'QUEUE_MUTATE':
        return { authorized: true }; // Guests can always add tracks
      case 'PLAY':
      case 'PAUSE':
      case 'SEEK':
      case 'SET_VOLUME':
        if (this.policy.allowGuestControl) {
          return { authorized: true };
        }
        return { authorized: false, reason: 'Guest playback control disabled by Host' };
      case 'SKIP_NEXT':
      case 'SKIP_PREV':
        if (this.policy.allowGuestSkip) {
          return { authorized: true };
        }
        return { authorized: false, reason: 'Vote-to-skip is active. Cast vote instead of skipping directly.' };
      case 'TRANSFER_PLAYBACK':
        return { authorized: false, reason: 'Guests cannot change playback sink' };
      case 'HEARTBEAT':
      case 'REGISTER_DEVICE':
        return { authorized: true };
      default:
        return { authorized: false, reason: 'Action not permitted for guests' };
    }
  }

  /**
   * Record a vote-to-skip from a guest. Returns true if threshold is met.
   */
  public castSkipVote(userId: string): { voteRegistered: boolean; thresholdReached: boolean; voteCount: number; requiredCount: number } {
    this.skipVotes.add(userId);
    const guestCount = Array.from(this.participants.values()).filter((p) => p.role === 'GUEST').length;
    const required = Math.max(1, Math.ceil(guestCount * this.policy.voteSkipThreshold));
    const reached = this.skipVotes.size >= required;

    if (reached) {
      this.skipVotes.clear();
    }

    return {
      voteRegistered: true,
      thresholdReached: reached,
      voteCount: this.skipVotes.size,
      requiredCount: required,
    };
  }

  public resetTrackVotes(): void {
    this.skipVotes.clear();
  }
}
