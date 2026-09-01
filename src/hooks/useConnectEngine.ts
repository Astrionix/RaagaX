'use client';

/**
 * useConnectEngine — Real-Time Connect Engine Hook
 *
 * Handles WebSocket & Broadcast connectivity, device cluster registration under
 * the same User Account, NTP clock synchronization for sub-millisecond drift
 * compensation, and hardware audio gating (active speaker vs remote controller).
 */

import { useEffect, useRef, useCallback } from 'react';
import { useConnectStore } from '@/context/useConnectStore';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { ConnectServerEngine } from '@/lib/connect/ConnectServerEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';

export function useConnectEngine(wsUrl?: string) {
  const wsRef = useRef<WebSocket | null>(null);

  const {
    userId,
    localDeviceId,
    localDeviceName,
    remoteSession,
    speakerSession,
    setClockOffset,
    isSpeaker,
    isController,
  } = useConnectStore();

  // 1. NTP Clock Sync and WebSocket Channel
  useEffect(() => {
    if (typeof window === 'undefined' || !wsUrl) return;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(`${wsUrl}?userId=${encodeURIComponent(userId || 'guest')}&deviceId=${encodeURIComponent(localDeviceId)}`);
      wsRef.current = socket;

      socket.onopen = () => {
        // Step A: NTP Clock Synchronization
        socket?.send(
          JSON.stringify({
            type: 'NTP_PING',
            clientTime: performance.now(),
          })
        );

        // Step B: Register device in user cluster
        socket?.send(
          JSON.stringify({
            type: 'REGISTER_DEVICE',
            device: {
              id: localDeviceId,
              name: localDeviceName,
              type: 'browser',
              lastSeen: Date.now(),
            },
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'NTP_PONG': {
              const rtt = performance.now() - msg.clientTime;
              const serverTimeCalculated = msg.serverReceive + rtt / 2;
              setClockOffset(serverTimeCalculated - Date.now());
              break;
            }

            case 'SESSION_STATE_SYNC': {
              if (msg.session) {
                ConnectClientManager.getInstance().handleIncomingSession(msg.session);
              }
              break;
            }

            case 'EXECUTE_SPEAKER_ACTION': {
              executeAudioCommand(msg.action);
              break;
            }
          }
        } catch {}
      };
    } catch {}

    const executeAudioCommand = async (action: any) => {
      if (!isSpeaker()) return;
      const pb = PlaybackService.getInstance();
      const audio = pb.getActiveAudio();
      if (!audio) return;

      switch (action.type) {
        case 'PLAY':
          pb.resume();
          break;
        case 'PAUSE':
          pb.pause();
          break;
        case 'SEEK':
          if (typeof action.positionMs === 'number') {
            pb.seek(action.positionMs / 1000);
          }
          break;
        case 'VOLUME':
          if (typeof action.volume === 'number') {
            audio.volume = Math.max(0, Math.min(1, action.volume / 100));
          }
          break;
      }
    };

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [userId, localDeviceId, localDeviceName, wsUrl]);

  // Dispatchers available to UI components
  const sendCommand = useCallback(
    async (cmd: any) => {
      // 1. If WebSocket is connected, dispatch over WS
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'COMMAND',
            payload: cmd,
            expectedRevision: (remoteSession || speakerSession)?.revision || 1,
          })
        );
        return true;
      }

      // 2. Fallback to Local BroadcastChannel & HTTP RPC via ConnectClientManager / ConnectServerEngine
      if (cmd.type === 'TRANSFER_PLAYBACK') {
        const { useConnectStore } = await import('@/context/useConnectStore');
        const targetDevice = useConnectStore.getState().devices.find((d) => d.deviceId === cmd.targetDeviceId);
        if (targetDevice) {
          return useConnectStore.getState().transferPlayback(targetDevice);
        }
      } else if (cmd.type === 'SPEAKER_DETACH_CONTROLLER') {
        const { useConnectStore } = await import('@/context/useConnectStore');
        return useConnectStore.getState().disconnectRemoteControllerFromSpeaker();
      } else if (cmd.type === 'PLAY') {
        return ConnectClientManager.getInstance().sendCommand('PLAY');
      } else if (cmd.type === 'PAUSE') {
        return ConnectClientManager.getInstance().sendCommand('PAUSE');
      } else if (cmd.type === 'SEEK') {
        return ConnectClientManager.getInstance().sendCommand('SEEK', { positionMs: cmd.positionMs });
      } else if (cmd.type === 'VOLUME') {
        return ConnectClientManager.getInstance().sendCommand('SET_VOLUME', { volume: cmd.volume / 100 });
      }

      return false;
    },
    [remoteSession, speakerSession]
  );

  return {
    sendCommand,
    isSpeaker,
    isController,
  };
}
