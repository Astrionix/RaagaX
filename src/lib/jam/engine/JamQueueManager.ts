import { WebRtcLanTransport } from '../transport/WebRtcLanTransport';
import { JamTrack, JamQueueMessage } from '../types';

export class JamQueueManager {
  private queue: JamTrack[] = [];
  private transport: WebRtcLanTransport | null = null;
  private onQueueUpdate: (queue: JamTrack[]) => void;
  private onSkipTriggered?: () => void;
  private totalMembers: number = 1;

  constructor(
    transport: WebRtcLanTransport | null,
    onQueueUpdate: (queue: JamTrack[]) => void,
    onSkipTriggered?: () => void
  ) {
    this.transport = transport;
    this.onQueueUpdate = onQueueUpdate;
    this.onSkipTriggered = onSkipTriggered;
  }

  public setTransport(transport: WebRtcLanTransport | null) {
    this.transport = transport;
  }

  public setMemberCount(count: number) {
    this.totalMembers = Math.max(1, count);
  }

  // 1. Add song to Jam Queue
  public addTrack(track: JamTrack) {
    this.queue.push(track);
    this.onQueueUpdate([...this.queue]);

    this.transport?.send({
      type: 'QUEUE_ADD',
      track,
    } as any);
  }

  // 2. Vote to Skip Logic (>50% of connected devices agree)
  public voteSkip(trackId: string, userId: string) {
    const track = this.queue.find((t) => t.id === trackId);
    if (!track) return;

    if (!track.votes.includes(userId)) {
      track.votes.push(userId);
    }

    const skipThreshold = Math.ceil(this.totalMembers / 2);
    if (track.votes.length >= skipThreshold) {
      // Threshold reached -> Auto skip to next
      this.removeTrack(trackId);
      if (this.onSkipTriggered) this.onSkipTriggered();
    } else {
      this.onQueueUpdate([...this.queue]);
    }

    this.transport?.send({
      type: 'VOTE_SKIP',
      trackId,
      userId,
    } as any);
  }

  // 3. Remove track
  public removeTrack(trackId: string) {
    this.queue = this.queue.filter((t) => t.id !== trackId);
    this.onQueueUpdate([...this.queue]);

    this.transport?.send({
      type: 'QUEUE_REMOVE',
      trackId,
    } as any);
  }

  // 4. Handle incoming message from peers
  public handleMessage(msg: JamQueueMessage) {
    switch (msg.type) {
      case 'QUEUE_ADD':
        if (!this.queue.some((t) => t.id === msg.track.id)) {
          this.queue.push(msg.track);
          this.onQueueUpdate([...this.queue]);
        }
        break;

      case 'QUEUE_REMOVE':
        this.queue = this.queue.filter((t) => t.id !== msg.trackId);
        this.onQueueUpdate([...this.queue]);
        break;

      case 'VOTE_SKIP': {
        const track = this.queue.find((t) => t.id === msg.trackId);
        if (track && !track.votes.includes(msg.userId)) {
          track.votes.push(msg.userId);
          const skipThreshold = Math.ceil(this.totalMembers / 2);
          if (track.votes.length >= skipThreshold) {
            this.removeTrack(msg.trackId);
            if (this.onSkipTriggered) this.onSkipTriggered();
          } else {
            this.onQueueUpdate([...this.queue]);
          }
        }
        break;
      }
    }
  }

  public getQueue() {
    return this.queue;
  }
}
