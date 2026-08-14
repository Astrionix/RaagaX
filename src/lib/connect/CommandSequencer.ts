export class CommandSequencer {
  private static instance: CommandSequencer;
  
  // Managed by lease/epoch system
  private currentEpoch: number = 0;
  
  // Increments for every command sent by THIS device in the current epoch
  private outboundSequence: number = 0;
  
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
      this.outboundSequence = 0; // Reset seq on new epoch
      this.lastAppliedSequence = 0;
    }
  }

  public setSequence(seq: number) {
    if (seq > this.lastAppliedSequence) {
      this.lastAppliedSequence = seq;
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
    this.outboundSequence = 0;
    this.lastAppliedSequence = 0;
  }
}
