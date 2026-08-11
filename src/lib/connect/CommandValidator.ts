import { ConnectCommand } from './types';
import { CommandSequencer } from './CommandSequencer';

export class CommandValidator {
  private static instance: CommandValidator;
  
  // Track highest sequence seen per source device to prevent replays
  private highestSequenceByDevice: Map<string, number> = new Map();
  private currentRevision: number = 0;
  private processedCommandIds: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): CommandValidator {
    if (!CommandValidator.instance) {
      CommandValidator.instance = new CommandValidator();
    }
    return CommandValidator.instance;
  }

  /**
   * Validates an incoming command against epoch, revision, and sequence ordering rules.
   * Returns true if valid, false if stale, duplicate, or out-of-order.
   */
  public validate(command: ConnectCommand): boolean {
    // 1. Idempotency Check
    if (this.processedCommandIds.has(command.commandId)) {
      console.warn(`[CommandValidator] Duplicate command ignored: ${command.commandId}`);
      return false;
    }

    const sequencer = CommandSequencer.getInstance();
    const currentEpoch = sequencer.getEpoch();

    // 2. Epoch Validation
    if (command.epoch < currentEpoch) {
      console.warn(`[CommandValidator] Rejected stale epoch. Command epoch ${command.epoch} < current ${currentEpoch}`);
      return false;
    }
    
    // Only adopt a newer epoch if it comes from an explicit TRANSFER_COMMIT or HANDOFF command
    if (command.epoch > currentEpoch) {
      if (command.type === 'TRANSFER_COMMIT' || command.type === 'HANDOFF') {
        console.log(`[CommandValidator] Adopting authoritative epoch ${command.epoch} from ${command.type}`);
        sequencer.setEpoch(command.epoch);
        this.highestSequenceByDevice.clear();
      } else {
        console.warn(`[CommandValidator] Rejected unauthorized epoch promotion attempt from ${command.type}`);
        return false;
      }
    }

    // 3. Revision Validation
    if (command.revision && command.revision < this.currentRevision) {
      console.warn(`[CommandValidator] Rejected stale revision ${command.revision} < current ${this.currentRevision}`);
      return false;
    }

    // 4. Sequence Validation per Source Device
    const lastSeenSeq = this.highestSequenceByDevice.get(command.sourceDeviceId) || 0;
    if (command.sequence <= lastSeenSeq) {
      console.warn(`[CommandValidator] Rejected stale sequence from ${command.sourceDeviceId}. Seq ${command.sequence} <= last ${lastSeenSeq}`);
      return false;
    }

    // Mark as processed
    this.highestSequenceByDevice.set(command.sourceDeviceId, command.sequence);
    if (command.revision && command.revision > this.currentRevision) {
      this.currentRevision = command.revision;
    }

    this.processedCommandIds.add(command.commandId);
    if (this.processedCommandIds.size > 500) {
      const firstKey = this.processedCommandIds.values().next().value;
      if (firstKey) this.processedCommandIds.delete(firstKey);
    }
    
    return true;
  }

  public setRevision(revision: number): void {
    this.currentRevision = revision;
  }
}
