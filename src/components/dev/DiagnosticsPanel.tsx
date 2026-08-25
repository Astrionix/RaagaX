'use client';
/**
 * DiagnosticsPanel — developer-only diagnostics overlay.
 * Activation: append ?diagnostics=1 to any URL.
 */

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function DiagnosticsPanel() {
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const currentSong = usePlayerStore(s => s.currentSong);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const currentTime = usePlayerStore(s => s.currentTime);
  const duration = usePlayerStore(s => s.duration);
  const volume = usePlayerStore(s => s.volume);
  const activeRenderer = usePlayerStore(s => s.activeRenderer);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('diagnostics') === '1') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 99999,
        background: 'rgba(10, 10, 18, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        padding: minimized ? '6px 12px' : 16,
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#e2e8f0',
        maxWidth: minimized ? 'auto' : 320,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: minimized ? 0 : 8 }}>
        <span style={{ fontWeight: 'bold', color: '#10b981' }}>● AUDIO DIAGNOSTICS</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setMinimized(m => !m)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 10 }}
          >
            {minimized ? '▲' : '▼'}
          </button>
          <button
            onClick={() => setVisible(false)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 10 }}
          >
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div><strong style={{ color: '#94a3b8' }}>Song:</strong> {currentSong?.title || 'None'}</div>
          <div><strong style={{ color: '#94a3b8' }}>Status:</strong> {isPlaying ? 'Playing' : 'Paused'}</div>
          <div><strong style={{ color: '#94a3b8' }}>Time:</strong> {currentTime.toFixed(1)}s / {duration.toFixed(1)}s</div>
          <div><strong style={{ color: '#94a3b8' }}>Renderer:</strong> {activeRenderer}</div>
          <div><strong style={{ color: '#94a3b8' }}>Volume:</strong> {Math.round(volume * 100)}%</div>
        </div>
      )}
    </div>
  );
}
