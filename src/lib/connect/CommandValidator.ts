export interface PlaybackCommand {
  commandId: string;
  sessionId: string;

  epoch: number;
  sequence: number;

  senderDeviceId: string;
  targetDeviceId?: string;

  type:
    | "PLAY"
    | "PAUSE"
    | "SEEK"
    | "NEXT"
    | "PREV"
    | "TRANSFER"
    | "HANDOFF";

  canonicalPositionMs?: number;

  createdAt: number;
}

export type ValidationResult = 'DROP' | 'RECONCILE' | 'APPLY';

export class CommandValidator {
  private static instance: CommandValidator;
  
  private localEpoch = 0;
  private localSequence = 0;
  private processedCommandIds = new Set<string>();

  private constructor() {}

  public static getInstance(): CommandValidator {
    if (!CommandValidator.instance) {
      CommandValidator.instance = new CommandValidator();
    }
    return CommandValidator.instance;
  }

  public setLocalState(epoch: number, sequence: number) {
    this.localEpoch = epoch;
    this.localSequence = sequence;
  }

  public validate(command: PlaybackCommand): ValidationResult {
    // Has this exact command already been processed? (Idempotency)
    if (this.processedCommandIds.has(command.commandId)) {
      console.warn(`[CommandValidator] Dropping duplicate command: ${command.commandId}`);
      return 'DROP';
    }

    // Is the command from a stale generation?
    if (command.epoch < this.localEpoch) {
      console.warn(`[CommandValidator] Dropping stale epoch (local: ${this.localEpoch}, incoming: ${command.epoch})`);
      return 'DROP';
    }

    // Is the command from a future generation?
    if (command.epoch > this.localEpoch) {
      console.warn(`[CommandValidator] Incoming epoch is newer. Triggering reconcile (local: ${this.localEpoch}, incoming: ${command.epoch})`);
      return 'RECONCILE';
    }

    // Same epoch: Is this an old sequence number?
    if (command.sequence <= this.localSequence) {
      console.warn(`[CommandValidator] Dropping stale sequence (local: ${this.localSequence}, incoming: ${command.sequence})`);
      return 'DROP';
    }

    // Command is valid
    return 'APPLY';
  }

  public markProcessed(commandId: string, epoch: number, sequence: number) {
    this.processedCommandIds.add(commandId);
    
    // Update local watermark
    if (epoch > this.localEpoch || (epoch === this.localEpoch && sequence > this.localSequence)) {
      this.localEpoch = epoch;
      this.localSequence = sequence;
    }
    
    // Prevent unbounded memory growth
    if (this.processedCommandIds.size > 1000) {
      const iterator = this.processedCommandIds.values();
      for (let i = 0; i < 500; i++) {
        this.processedCommandIds.delete(iterator.next().value);
      }
    }
  }
}
