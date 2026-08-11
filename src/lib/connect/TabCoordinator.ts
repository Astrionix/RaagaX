export class TabCoordinator {
  private static instance: TabCoordinator;
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private isMasterTab: boolean = false;
  private tabIdList: Set<string> = new Set();

  private constructor() {
    this.tabId = 'tab_' + Math.random().toString(36).substring(2, 9);
    this.initChannel();
  }

  public static getInstance(): TabCoordinator {
    if (!TabCoordinator.instance) {
      TabCoordinator.instance = new TabCoordinator();
    }
    return TabCoordinator.instance;
  }

  private initChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    this.channel = new BroadcastChannel('raagax_tab_coordination');
    this.tabIdList.add(this.tabId);

    this.channel.onmessage = (event) => {
      const { type, senderTabId } = event.data || {};

      if (type === 'PING_TAB') {
        this.tabIdList.add(senderTabId);
        this.postMessage({ type: 'PONG_TAB', senderTabId: this.tabId });
      } else if (type === 'PONG_TAB') {
        this.tabIdList.add(senderTabId);
      } else if (type === 'CLAIM_MASTER') {
        if (senderTabId !== this.tabId) {
          this.isMasterTab = false;
        }
      }
    };

    // Announce presence
    this.postMessage({ type: 'PING_TAB', senderTabId: this.tabId });
    this.electMaster();
  }

  private postMessage(msg: any) {
    if (this.channel) {
      this.channel.postMessage(msg);
    }
  }

  private electMaster() {
    // Smallest lexicographical tab ID becomes primary tab
    const sorted = Array.from(this.tabIdList).sort();
    if (sorted[0] === this.tabId) {
      this.isMasterTab = true;
      this.postMessage({ type: 'CLAIM_MASTER', senderTabId: this.tabId });
    }
  }

  public isPrimaryTab(): boolean {
    return this.isMasterTab;
  }

  public getTabId(): string {
    return this.tabId;
  }
}
