import { ConnectCommand } from './types';
import { CommandSequencer } from './CommandSequencer';

export class CommandValidator {
  private static instance: CommandValidator;
  
  // Track highest sequence seen per source device to prevent replays
  private highestSequenceByDevice: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): CommandValidator {
    if (!CommandValidator.instance) {
      CommandValidator.instance = new CommandValidator();
    }
    return CommandValidator.instance;
  }

  /**
   * Validates an incoming command against epoch and sequence ordering rules.
   * Returns true if valid, false if stale or out-of-order.
   */
  public validate(command: ConnectCommand): boolean {
    const sequencer = CommandSequencer.getInstance();
    const currentEpoch = sequencer.getEpoch();

    // 1. Epoch Validation
    if (command.epoch < currentEpoch) {
      console.warn(`[CommandValidator] Rejected stale epoch. Command epoch ${command.epoch} < current ${currentEpoch}`);
      return false;
    }
    
    // If command brings a strictly newer epoch (e.g. from a successful transfer), we must adopt it.
    if (command.epoch > currentEpoch) {
      console.log(`[CommandValidator] Adopting newer epoch ${command.epoch} from command.`);
      sequencer.setEpoch(command.epoch);
      // Reset sequence trackers on new epoch
      this.highestSequenceByDevice.clear();
    }

    // 2. Sequence Validation
    const lastSeenSeq = this.highestSequenceByDevice.get(command.sourceDeviceId) || 0;
    if (command.sequence <= lastSeenSeq) {
      console.warn(`[CommandValidator] Rejected stale sequence from ${command.sourceDeviceId}. Seq ${command.sequence} <= last ${lastSeenSeq}`);
      return false;
    }

    // Update highest sequence
    this.highestSequenceByDevice.set(command.sourceDeviceId, command.sequence);
    
    return true;
  }
}
