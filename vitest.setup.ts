// Ensure WebSocket global is available for Supabase Realtime in test environments
if (typeof (globalThis as any).WebSocket === 'undefined') {
  class MockWebSocket {
    public static readonly CONNECTING = 0;
    public static readonly OPEN = 1;
    public static readonly CLOSING = 2;
    public static readonly CLOSED = 3;

    public readyState = 1;
    public onopen: (() => void) | null = null;
    public onclose: (() => void) | null = null;
    public onmessage: ((event: any) => void) | null = null;
    public onerror: ((error: any) => void) | null = null;

    constructor() {
      setTimeout(() => this.onopen?.(), 0);
    }

    public send(): void {}
    public close(): void {
      this.readyState = 3;
      this.onclose?.();
    }
    public addEventListener(): void {}
    public removeEventListener(): void {}
  }

  (globalThis as any).WebSocket = MockWebSocket;
}
