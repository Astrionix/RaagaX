export class CommandSequencer {
  private static instance: CommandSequencer;
  
  // Managed by lease/epoch system
  private currentEpoch: number = 0;
  
  // Monotonically increasing sequence across lifetime
  private outboundSequence: number = Math.floor(Date.now() / 1000) % 100000;
  
  // Tracks the highest sequence processed by THIS device from the server
  private lastAppliedSequence: number = 0;

  private constructor() {}

  public static getInstance(): CommandSequencer {
    if (!CommandSequencer.instance) {
      CommandSequencer.instance = new CommandSequencer();
    }
    return CommandSequencer.instance;
  }

  public setEpoch(epoch: number) {
    if (epoch > this.currentEpoch) {
      this.currentEpoch = epoch;
      this.lastAppliedSequence = 0;
    }
  }

  public syncWithRevision(revision: number) {
    if (revision > this.outboundSequence) {
      this.outboundSequence = revision;
    }
  }

  public setSequence(seq: number) {
    if (seq > this.lastAppliedSequence) {
      this.lastAppliedSequence = seq;
    }
    if (seq > this.outboundSequence) {
      this.outboundSequence = seq;
    }
  }

  public getLastAppliedSequence(): number {
    return this.lastAppliedSequence;
  }

  public getEpoch(): number {
    return this.currentEpoch;
  }

  public nextSequence(): number {
    return ++this.outboundSequence;
  }

  public reset() {
    this.currentEpoch = 0;
    // Step forward rather than resetting to 0 to prevent stale sequence rejection on remote peers
    this.outboundSequence += 10;
    this.lastAppliedSequence = 0;
  }
}
