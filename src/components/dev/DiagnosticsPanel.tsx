'use client';
/**
 * DiagnosticsPanel — developer-only diagnostics overlay.
 *
 * Activation: append ?diagnostics=1 to any URL.
 * Hidden in production from normal users.
 *
 * Shows:
 *   - Active renderer device
 *   - Live transport scores (LAN RTT, loss, score vs Cloud)
 *   - Session revision + epoch
 *   - Last 10 command traces with latency
 *   - Transport health trend
 */

import React, { useEffect, useState } from 'react';
import { ConnectivityRouter } from '@/lib/connect/ConnectivityRouter';
import { TransportScorer } from '@/lib/connect/TransportScorer';
import { TransportHealthMonitor } from '@/lib/connect/TransportHealthMonitor';
import { CommandObservabilityStore, CommandTrace } from '@/lib/connect/CommandObservabilityStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';
import { ConnectManager } from '@/lib/connect/ConnectManager';

function useDiagnostics() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const scores = TransportScorer.getInstance().getAllScores();
  const health = ConnectivityRouter.getInstance().getTransportHealth();
  const trend = TransportHealthMonitor.getInstance().getTrend();
  const activeTransport = ConnectivityRouter.getInstance().getActiveTransport();
  const traces = CommandObservabilityStore.getInstance().getLastN(10);
  const summary = CommandObservabilityStore.getInstance().getSummary();
  const store = usePlayerStore.getState();
  const epoch = CommandSequencer.getInstance().getEpoch();
  const sessionId = ConnectManager.getInstance().getSessionId();

  return { scores, health, trend, activeTransport, traces, summary, store, epoch, sessionId };
}

function scoreBar(score: number, max: number = 150): string {
  const filled = Math.round((score / max) * 10);
  return '█'.repeat(Math.min(filled, 10)) + '░'.repeat(Math.max(0, 10 - filled));
}

function healthColor(health: string): string {
  if (health.includes('LAN_CONNECTED')) return '#4ade80';
  if (health.includes('DEGRADED')) return '#fb923c';
  if (health.includes('LOST')) return '#f87171';
  if (health.includes('CLOUD')) return '#60a5fa';
  return '#94a3b8';
}

export function DiagnosticsPanel() {
  const { scores, health, trend, activeTransport, traces, summary, store, epoch, sessionId } = useDiagnostics();

  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('diagnostics') !== '1') return null;

  const trendIcon = trend === 'STABLE' ? '🟢' : trend === 'DEGRADING' ? '🟡' : '🔵';

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 9999,
      background: 'rgba(10,10,20,0.96)',
      color: '#e2e8f0',
      fontFamily: 'monospace',
      fontSize: 11,
      borderRadius: 10,
      padding: '14px 16px',
      minWidth: 320,
      maxWidth: 360,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(8px)',
      maxHeight: '80vh',
      overflowY: 'auto',
    }}>
      <div style={{ color: '#7c3aed', fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: '0.05em' }}>
        ◈ RaagaX Cross-Device Diagnostics
      </div>

      {/* Session */}
      <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Row label="Renderer" value={store.activeDeviceId || '—'} />
        <Row label="Session" value={sessionId ? sessionId.slice(0, 16) + '...' : '—'} />
        <Row label="Epoch" value={String(epoch)} />
        <Row label="Revision" value={String(store.localPlaybackRevision || 0)} />
      </div>

      {/* Transport */}
      <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Row label="Active" value={activeTransport} valueColor="#a78bfa" />
        <Row label="Health" value={health} valueColor={healthColor(health)} />
        <Row label="LAN Trend" value={`${trendIcon} ${trend}`} />
      </div>

      {/* Transport Scores */}
      <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: '#94a3b8', marginBottom: 4 }}>Transport Scores</div>
        {scores.map(s => (
          <div key={s.mode} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, opacity: s.isAvailable ? 1 : 0.35 }}>
            <span style={{ color: s.mode === activeTransport ? '#7c3aed' : '#cbd5e1' }}>
              {s.mode === 'LOCAL_DIRECT' ? 'LAN' : s.mode === 'HOTSPOT_DIRECT' ? 'Hotspot' : 'Cloud'}
              {s.mode === activeTransport ? ' ◀' : ''}
            </span>
            <span style={{ color: '#64748b', fontSize: 10 }}>{scoreBar(s.score)}</span>
            <span style={{ color: '#94a3b8' }}>
              {s.isAvailable ? `${s.rttMs.toFixed(0)}ms · ${(s.lossRate * 100).toFixed(0)}%` : 'offline'}
            </span>
          </div>
        ))}
      </div>

      {/* Command trace */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ color: '#94a3b8', marginBottom: 4 }}>
          Last {traces.length} Commands
          <span style={{ float: 'right', color: '#64748b' }}>
            avg {summary.avgLatencyMs}ms · {summary.successRate}% ok
          </span>
        </div>
        {traces.length === 0 && <div style={{ color: '#475569' }}>No commands yet</div>}
        {traces.map(t => (
          <div key={t.commandId} style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 2,
            opacity: t.result === 'PENDING' ? 0.6 : 1
          }}>
            <span style={{ color: t.result === 'APPLIED' ? '#4ade80' : t.result === 'PENDING' ? '#fb923c' : '#f87171' }}>
              {t.type.replace(/_/g, ' ')}
            </span>
            <span style={{ color: '#64748b', fontSize: 10 }}>
              {t.transport === 'LOCAL_DIRECT' ? 'LAN' : t.transport === 'HOTSPOT_DIRECT' ? 'Hotspot' : 'Cloud'}
            </span>
            <span style={{ color: '#94a3b8' }}>
              {t.latencyMs !== undefined ? `${t.latencyMs}ms` : t.result}
            </span>
          </div>
        ))}
      </div>

      <div style={{ color: '#334155', fontSize: 10, marginTop: 8, textAlign: 'center' }}>
        DEV ONLY · ?diagnostics=1
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: valueColor || '#e2e8f0', fontWeight: 500, maxWidth: 200, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
