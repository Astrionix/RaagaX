/**
 * RaagaX Connect — Command Validator
 *
 * Validates command structure, permissions, and ensures expectedRevision
 * does not conflict with newer server revisions.
 */

import { ConnectCommand } from '@/types/connect';
import { PermissionManager } from '../authorization/PermissionManager';

export interface CommandValidationResult {
  valid: boolean;
  reason?: string;
}

export class CommandValidator {
  private static instance: CommandValidator;

  private constructor() {}

  public static getInstance(): CommandValidator {
    if (!CommandValidator.instance) {
      CommandValidator.instance = new CommandValidator();
    }
    return CommandValidator.instance;
  }

  public validate(command: ConnectCommand, currentRevision: number): CommandValidationResult {
    if (!command || !command.action) {
      return { valid: false, reason: 'Missing command or action' };
    }

    if (!command.senderDeviceId || !command.targetDeviceId) {
      return { valid: false, reason: 'Missing sender or target deviceId' };
    }

    // Permission check
    if (!PermissionManager.getInstance().canControlPlayback(command.senderDeviceId)) {
      return { valid: false, reason: 'Controller lacks permission' };
    }

    // Revision check: reject commands targeted for older revisions
    // Bypass for queue mutations and playback transfer where user intent is cumulative/authoritative
    const bypassRevisionCheck =
      command.action === 'ADD_TO_QUEUE' ||
      command.action === 'SET_QUEUE' ||
      command.action === 'REMOVE_FROM_QUEUE' ||
      command.action === 'PLAY_SONG' ||
      command.action === 'TRANSFER_PLAYBACK' ||
      command.action === 'DISCONNECT_CONTROLLER' ||
      command.action === 'CONTROLLER_DETACH_SELF';

    if (!bypassRevisionCheck && typeof command.expectedRevision === 'number' && command.expectedRevision < currentRevision) {
      return {
        valid: false,
        reason: `Stale revision (expected ${command.expectedRevision} < current ${currentRevision})`,
      };
    }

    return { valid: true };
  }
}
