import { JamCommand, JamCommandResponse, JamEvent } from '@/types/jam';
import {
  JamTransport,
  JamTransportType,
  JamAuthCredentials,
  JamEventListener,
  TransportHealth,
  TransportState,
} from './JamTransport';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/config/apiConfig';
import { RealtimeChannel } from '@supabase/supabase-js';

export class CloudRealtimeTransport implements JamTransport {
  public readonly type: JamTransportType = 'CLOUD_REALTIME';

  private channel: RealtimeChannel | null = null;
  private jamId: string | null = null;
  private auth: JamAuthCredentials | null = null;
  private listeners: Set<JamEventListener> = new Set();

  private _isConnected = false;
  private state: TransportState = 'DISCONNECTED';
  private rttHistory: number[] = [45, 48, 42];
  private lastHeartbeatAt = Date.now();
  private lastMessageAt = Date.now();
  private failureCount = 0;
  private reconnectCount = 0;
  private heartbeatInterval: any = null;

  public get isConnected(): boolean {
    return this._isConnected;
  }

  public async connect(jamId: string, auth: JamAuthCredentials): Promise<boolean> {
    this.jamId = jamId;
    this.auth = auth;
    this.state = 'CONNECTING';

    try {
      if (this.channel) {
        try { await supabase.removeChannel(this.channel); } catch {}
        this.channel = null;
      }

      const channelName = `jam:${jamId}`;
      const rawChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
      const channels = Array.isArray(rawChannels) ? rawChannels : [];
      const existing = channels.find((c: any) => c.topic === `realtime:${channelName}` || c.topic === channelName);
      if (existing) {
        try { await supabase.removeChannel(existing); } catch {}
      }

      this.channel = supabase.channel(channelName, {
        config: { broadcast: { self: true } },
      });

      this.channel
        .on('broadcast', { event: 'jam_event' }, (payload: any) => {
          if (payload?.payload) {
            this.handleIncomingEvent(payload.payload);
          }
        })
        .on('broadcast', { event: 'JAM_EVENT' }, (payload: any) => {
          if (payload?.payload) {
            this.handleIncomingEvent(payload.payload);
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            this._isConnected = true;
            this.state = 'CONNECTED';
            this.failureCount = 0;
            this.lastMessageAt = Date.now();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this._isConnected = false;
            this.state = status === 'CLOSED' ? 'DISCONNECTED' : 'DEGRADED';
            this.failureCount++;
          }
        });

      this.startHeartbeat();
      this._isConnected = true;
      this.state = 'CONNECTED';
      return true;
    } catch (err) {
      console.warn('[CloudRealtimeTransport] Connection error:', err);
      this._isConnected = false;
      this.state = 'FAILED';
      this.failureCount++;
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (this.channel) {
      try {
        await supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }
    this._isConnected = false;
    this.state = 'DISCONNECTED';
    this.jamId = null;
    this.auth = null;
  }

  public async sendCommand(command: JamCommand): Promise<JamCommandResponse> {
    const startTime = Date.now();
    try {
      const res = await fetch(getApiUrl(`/api/jam/${command.jamId}/command`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });

      const rtt = Date.now() - startTime;
      this.recordRTT(rtt);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        this.failureCount++;
        return {
          success: false,
          error: errJson?.error || `HTTP ${res.status}`,
          revision: 0,
        };
      }

      const data: JamCommandResponse = await res.json();
      this.lastMessageAt = Date.now();
      this.failureCount = 0;
      return data;
    } catch (err: any) {
      this.failureCount++;
      return {
        success: false,
        error: err?.message || 'Network error on Cloud command',
        revision: 0,
      };
    }
  }

  public subscribe(listener: JamEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private handleIncomingEvent(event: JamEvent) {
    this.lastMessageAt = Date.now();
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[CloudRealtimeTransport] Listener error:', err);
      }
    }
  }

  private recordRTT(rttMs: number) {
    this.rttHistory.push(Math.max(1, rttMs));
    if (this.rttHistory.length > 20) {
      this.rttHistory.shift();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      if (!this._isConnected || !this.jamId) return;
      const start = Date.now();
      try {
        const res = await fetch(getApiUrl('/api/time'), { method: 'GET' });
        if (res.ok) {
          const rtt = Date.now() - start;
          this.recordRTT(rtt);
          this.lastHeartbeatAt = Date.now();
          if (this.state === 'DEGRADED') {
            this.state = 'CONNECTED';
          }
        } else {
          this.failureCount++;
        }
      } catch {
        this.failureCount++;
        if (this.failureCount >= 3) {
          this.state = 'DEGRADED';
        }
      }
    }, 4000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public getHealth(): TransportHealth {
    const sorted = [...this.rttHistory].sort((a, b) => a - b);
    const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 45;
    const latest = this.rttHistory[this.rttHistory.length - 1] || 45;

    let jitter = 5;
    if (this.rttHistory.length >= 2) {
      let sum = 0;
      for (let i = 1; i < this.rttHistory.length; i++) {
        sum += Math.abs(this.rttHistory[i] - this.rttHistory[i - 1]);
      }
      jitter = Math.round(sum / (this.rttHistory.length - 1));
    }

    const packetLoss = Math.min(100, this.failureCount * 15);
    let quality: TransportHealth['quality'] = 'GOOD';
    if (!this._isConnected || this.state === 'FAILED') quality = 'OFFLINE';
    else if (median < 60 && jitter < 15 && packetLoss === 0) quality = 'EXCELLENT';
    else if (median < 150 && packetLoss < 5) quality = 'GOOD';
    else if (median < 350) quality = 'FAIR';
    else quality = 'POOR';

    return {
      transport: this.type,
      state: this.state,
      rttMs: latest,
      rttMedianMs: median,
      jitterMs: jitter,
      packetLoss,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastMessageAt: this.lastMessageAt,
      failureCount: this.failureCount,
      reconnectCount: this.reconnectCount,
      quality,
    };
  }

  public isHealthy(): boolean {
    return this._isConnected && this.state === 'CONNECTED' && this.failureCount < 3;
  }
}
