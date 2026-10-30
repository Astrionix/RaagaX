import { create } from 'zustand';
import { ytAuthSnapshot } from '@/extension/useYtAuth';
import { getPlayhead, usePlayer } from '@/state/player';
import type {
  ConnectDevice,
  ConnectDeviceStatus,
  ConnectHandoffPacket,
  ConnectControlCommand,
  ConnectTrack,
  PairedDevice,
} from './types';

const CLOUDFLARE_WS_URL = 'wss://raaga-connect-relay.pekrajareddy.workers.dev/ws';
const SUPABASE_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZnV1dnRubnF1Ymh1cGdhb3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODU5MDEsImV4cCI6MjEwNjk2MTkwMX0.KaHtyBPskoT_I2LZPcKcLfMPbbWO15Q0NaF5rFUitQA';
const SUPABASE_WS_URL = `wss://pufuuvtnnqubhupgaovg.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_API_KEY}&vsn=1.0.0`;

const DEVICE_ID_KEY = 'raaga:connect:deviceId';
const PAIRED_KEY = 'raaga:connect:paired';
const SYNC_KEY = 'raaga:connect:syncKey';

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'web_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getStoredPairedDevices(): PairedDevice[] {
  try {
    const raw = localStorage.getItem(PAIRED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredPairedDevices(list: PairedDevice[]) {
  localStorage.setItem(PAIRED_KEY, JSON.stringify(list));
}

async function sha256Hex(str: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

interface ConnectState {
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
  discoveredDevices: ConnectDevice[];
  pairedDevices: PairedDevice[];
  activeRemoteDevice: ConnectDevice | null;
  remoteStatus: ConnectDeviceStatus | null;
  connectingDeviceId: string | null;
  pairCode: string | null;
  pairCodeExpiresAt: number;
  pairingFeedback: string | null;

  start: () => void;
  stop: () => void;
  transferTo: (device: ConnectDevice) => Promise<void>;
  transferBack: () => void;
  sendControl: (action: ConnectControlCommand['action'], extra?: Partial<ConnectControlCommand>) => void;
  pairDeviceDirectly: (device: ConnectDevice) => void;
  unpairDevice: (id: string) => void;
  generatePairCode: () => string;
  cancelPairCode: () => void;
  submitPairCode: (code: string) => Promise<boolean>;
}

let socket: WebSocket | null = null;
let heartbeatTimer: any = null;
let announceTimer: any = null;
let reconnectTimer: any = null;
let activeChannel: string | null = null;
let usingCloudflare = true;
let lastCloudflareFailureTime = 0;
let temporaryPairCode: string | null = null;
let pairSubmitTimer: any = null;
const pendingHandoffs = new Map<string, (packet: ConnectHandoffPacket) => void>();

export const useConnect = create<ConnectState>()((set, get) => ({
  deviceId: getOrCreateDeviceId(),
  deviceName: `Raaga Web (${navigator.platform?.includes('Win') ? 'Windows' : 'Browser'})`,
  isConnected: false,
  discoveredDevices: [],
  pairedDevices: getStoredPairedDevices(),
  activeRemoteDevice: null,
  remoteStatus: null,
  connectingDeviceId: null,
  pairCode: null,
  pairCodeExpiresAt: 0,
  pairingFeedback: null,

  start: () => {
    connectRelay();
  },

  stop: () => {
    disconnectRelay();
  },

  transferTo: async (target: ConnectDevice) => {
    const { deviceId, deviceName } = get();
    const player = usePlayer.getState();
    const nowPlaying = player.nowPlaying;

    if (!nowPlaying) {
      set({ activeRemoteDevice: target });
      return;
    }

    set({ connectingDeviceId: target.id });

    try {
      const handoffId = 'hnd_' + Math.random().toString(36).substring(2, 12);
      const sessionId = 'ses_' + Math.random().toString(36).substring(2, 10);
      const playhead = getPlayhead();
      const positionMs = Math.round(playhead ? playhead.sec * 1000 : 0);

      const preparePacket: ConnectHandoffPacket = {
        handoffId,
        phase: 'PREPARE',
        protocolVersion: 2,
        sessionId,
        sourceDeviceId: deviceId,
        sourceDeviceName: deviceName,
        targetDeviceId: target.id,
        track: {
          videoId: nowPlaying.videoId,
          title: nowPlaying.title,
          artist: nowPlaying.artist,
          thumbnailUrl: nowPlaying.artworkUrl,
          durationText: `${Math.floor(nowPlaying.durationSec / 60)}:${String(Math.floor(nowPlaying.durationSec % 60)).padStart(2, '0')}`,
        },
        positionMs,
        isPlaying: player.status === 'playing',
        volume: player.volume,
        queue: player.queue.slice(player.index, player.index + 20).map((e) => ({
          videoId: e.track.videoId,
          title: e.track.title,
          artist: e.track.artists?.map((a) => a.name).join(', ') ?? '',
          thumbnailUrl: e.track.thumbnail ?? null,
        })),
        queueIndex: 0,
        bufferReadyDurationMs: 0,
        timestampMs: Date.now(),
        syncKey: localStorage.getItem(SYNC_KEY),
      };

      // 1. Send PREPARE and await READY
      const readyPacket = await sendHandoffWithReply(target.id, preparePacket, 6000);
      if (!readyPacket || readyPacket.phase !== 'READY') {
        throw new Error(readyPacket?.errorMessage || 'Target device failed to prepare playback');
      }

      // 2. Send COMMIT and await CONFIRMED
      const commitPacket: ConnectHandoffPacket = {
        ...preparePacket,
        phase: 'COMMIT',
        scheduledStartEpochMs: Date.now() + 150,
      };

      const confirmedPacket = await sendHandoffWithReply(target.id, commitPacket, 5000);
      if (!confirmedPacket || confirmedPacket.phase !== 'CONFIRMED') {
        throw new Error(confirmedPacket?.errorMessage || 'Target device failed to confirm playback');
      }

      // 3. Cutover: pause web player and activate remote controller
      player.togglePlay();
      if (player.status === 'playing') {
        // Ensure pause
        usePlayer.setState({ status: 'paused' });
      }

      // Auto-pair
      get().pairDeviceDirectly(target);

      set({
        activeRemoteDevice: target,
        connectingDeviceId: null,
      });

      // Poll status
      get().sendControl('QUERY_STATUS');
    } catch (err: any) {
      set({ connectingDeviceId: null });
      throw err;
    }
  },

  transferBack: () => {
    const { activeRemoteDevice, remoteStatus } = get();
    if (!activeRemoteDevice) return;

    if (remoteStatus?.track) {
      const t = remoteStatus.track;
      usePlayer.getState().playVideo(t.videoId, {
        title: t.title,
        artist: t.artist,
        artworkUrl: t.thumbnailUrl ?? null,
      });
      if (remoteStatus.positionMs > 0) {
        setTimeout(() => {
          usePlayer.getState().seek(remoteStatus.positionMs / 1000);
        }, 400);
      }
    }

    // Stop playback on remote device
    get().sendControl('PAUSE');
    set({ activeRemoteDevice: null, remoteStatus: null });
  },

  sendControl: (action, extra) => {
    const { activeRemoteDevice, deviceId } = get();
    if (!activeRemoteDevice) return;

    const cmd: ConnectControlCommand = {
      action,
      targetDeviceId: activeRemoteDevice.id,
      commandId: 'cmd_' + Math.random().toString(36).substring(2, 10),
      seq: Date.now(),
      protocolVersion: 2,
      senderDeviceId: deviceId,
      syncKey: localStorage.getItem(SYNC_KEY),
      ...extra,
    };

    broadcastToRelay('control', cmd);
  },

  pairDeviceDirectly: (device) => {
    const paired = get().pairedDevices;
    if (paired.some((p) => p.id === device.id)) return;
    const cleanName = device.name.replace(' (Cloud)', '').replace(' (PC)', '');
    const updated = [
      ...paired,
      {
        id: device.id,
        name: cleanName,
        type: device.type,
        pairedAt: Date.now(),
      },
    ];
    saveStoredPairedDevices(updated);
    set({ pairedDevices: updated });
  },

  unpairDevice: (id) => {
    const updated = get().pairedDevices.filter((p) => p.id !== id);
    saveStoredPairedDevices(updated);
    set({
      pairedDevices: updated,
      activeRemoteDevice: get().activeRemoteDevice?.id === id ? null : get().activeRemoteDevice,
    });
  },

  generatePairCode: () => {
    clearInterval(pairSubmitTimer);
    pairSubmitTimer = null;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    temporaryPairCode = code;
    set({
      pairCode: code,
      pairCodeExpiresAt: Date.now() + 5 * 60 * 1000,
      pairingFeedback: null,
    });
    connectRelay();
    return code;
  },

  cancelPairCode: () => {
    clearInterval(pairSubmitTimer);
    pairSubmitTimer = null;
    temporaryPairCode = null;
    set({ pairCode: null, pairingFeedback: null });
    connectRelay();
  },

  submitPairCode: async (code) => {
    const clean = code.trim().replace(/\D/g, '');
    if (clean.length !== 6) {
      set({ pairingFeedback: 'Please enter a valid 6-digit code' });
      return false;
    }

    clearInterval(pairSubmitTimer);
    set({ pairingFeedback: 'Connecting to device...' });
    const { deviceId, deviceName } = get();

    // 1. Join room: `raaga_pair_${clean}`
    temporaryPairCode = clean;
    await connectRelay();

    // 2. Transmit pair_request periodically until answered or 12s timeout
    let attempts = 0;
    pairSubmitTimer = setInterval(() => {
      attempts++;
      if (!temporaryPairCode || attempts > 24) {
        clearInterval(pairSubmitTimer);
        pairSubmitTimer = null;
        if (temporaryPairCode === clean) {
          temporaryPairCode = null;
          connectRelay();
          set({ pairingFeedback: 'Device not found or code expired. Try again.' });
        }
        return;
      }

      const req = {
        code: clean,
        fromDevice: {
          id: deviceId,
          name: deviceName,
          type: 'DESKTOP' as const,
          host: 'cloud',
          port: 0,
          lastSeenTimestamp: Date.now(),
          isCloud: true,
        },
      };

      const pairChannel = `raaga_pair_${clean}`;
      broadcastRawToChannel(pairChannel, 'pair_request', req);
    }, 500);

    return true;
  },
}));

async function computeTargetChannel(): Promise<string> {
  if (temporaryPairCode) {
    return `raaga_pair_${temporaryPairCode}`;
  }

  const auth = ytAuthSnapshot();
  const accountId = auth.active?.id?.trim();
  if (accountId) {
    const hash = (await sha256Hex(accountId)).slice(0, 16);
    return `raaga_acc_${hash}`;
  }

  const sync = localStorage.getItem(SYNC_KEY)?.trim();
  if (sync) {
    const hash = (await sha256Hex(sync)).slice(0, 16);
    return `raaga_sync_${hash}`;
  }

  return 'raaga_cloud_public';
}

function connectRelay(): Promise<void> {
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  clearInterval(announceTimer);

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    computeTargetChannel().then((channel) => {
      activeChannel = channel;
      const state = useConnect.getState();

      const now = Date.now();
      if (!usingCloudflare && now - lastCloudflareFailureTime > 60_000) {
        usingCloudflare = true;
      }

      const url = usingCloudflare
        ? `${CLOUDFLARE_WS_URL}?channel=${channel}&deviceId=${state.deviceId}`
        : SUPABASE_WS_URL;

      try {
        if (socket) {
          try {
            socket.close();
          } catch {}
          socket = null;
        }

        socket = new WebSocket(url);

        socket.onopen = () => {
          useConnect.setState({ isConnected: true });
          if (usingCloudflare) lastCloudflareFailureTime = 0;

          if (!usingCloudflare) {
            // Join Phoenix Supabase topic
            const joinMsg = {
              topic: `realtime:${channel}`,
              event: 'phx_join',
              payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' } } },
              ref: '1',
            };
            socket?.send(JSON.stringify(joinMsg));
          }

          // Heartbeat
          heartbeatTimer = setInterval(() => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }));
            }
          }, 25000);

          // Announcement & Discovery
          sendAnnounce();
          sendDiscover();
          announceTimer = setInterval(sendAnnounce, 25000);
          probeLocalHost();

          finish();
        };

        socket.onmessage = (event) => {
          handleIncomingMessage(event.data);
        };

        socket.onerror = () => {
          if (usingCloudflare) {
            usingCloudflare = false;
            lastCloudflareFailureTime = Date.now();
          }
          finish();
        };

        socket.onclose = () => {
          useConnect.setState({ isConnected: false });
          reconnectTimer = setTimeout(connectRelay, 5000);
          finish();
        };

        // Fallback safety timeout so callers never hang
        setTimeout(finish, 2000);
      } catch {
        reconnectTimer = setTimeout(connectRelay, 5000);
        finish();
      }
    });
  });
}

function disconnectRelay() {
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  clearInterval(announceTimer);
  if (socket) {
    try {
      socket.close();
    } catch {}
    socket = null;
  }
  useConnect.setState({ isConnected: false });
}

function sendAnnounce() {
  const { deviceId, deviceName } = useConnect.getState();
  const payload = {
    id: deviceId,
    name: deviceName,
    type: 'DESKTOP',
    isCloud: true,
  };
  broadcastToRelay('announce', payload);
}

function sendDiscover() {
  const { deviceId } = useConnect.getState();
  broadcastToRelay('discover', { id: deviceId });
}

async function probeLocalHost() {
  for (const port of [8895, 8896, 8894]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/raaga-connect/info`, {
        signal: AbortSignal.timeout(600),
      });
      if (res.ok) {
        const info = await res.json();
        if (info && info.deviceId && info.deviceId !== useConnect.getState().deviceId) {
          const dev: ConnectDevice = {
            id: info.deviceId,
            name: info.deviceName || 'Local Raaga',
            type: info.deviceType || 'DESKTOP',
            host: '127.0.0.1',
            port,
            lastSeenTimestamp: Date.now(),
            isCloud: false,
          };
          const exists = useConnect.getState().discoveredDevices.some((d) => d.id === dev.id);
          if (!exists) {
            useConnect.setState((s) => ({ discoveredDevices: [...s.discoveredDevices, dev] }));
          }
        }
      }
    } catch {}
  }
}

async function probeLocalDevice(id: string, host: string, port: number) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`http://${host}:${port}/raaga-connect/info`, {
      signal: controller.signal,
      mode: 'cors',
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const current = useConnect.getState().discoveredDevices;
      const updated = current.map((d) =>
        d.id === id ? { ...d, isCloud: false, host, port, name: data.deviceName || d.name } : d
      );
      useConnect.setState({ discoveredDevices: updated });
    }
  } catch {}
}

function broadcastToRelay(eventName: string, payload: any) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !activeChannel) return;
  broadcastRawToChannel(activeChannel, eventName, payload);
}

function broadcastRawToChannel(channel: string, eventName: string, payload: any) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const topic = usingCloudflare ? channel : `realtime:${channel}`;
  const msg = {
    topic,
    event: 'broadcast',
    payload: {
      type: 'broadcast',
      event: eventName,
      payload,
    },
    ref: Math.random().toString(36).substring(2, 8),
  };
  try {
    socket.send(JSON.stringify(msg));
  } catch {}
}

function handleIncomingMessage(text: string) {
  try {
    const data = JSON.parse(text);
    if (data.event !== 'broadcast') return;
    const broadcastEvent = data.payload?.event;
    const payload = data.payload?.payload;
    if (!broadcastEvent || !payload) return;

    const { deviceId } = useConnect.getState();

    switch (broadcastEvent) {
      case 'announce': {
        if (payload.id === deviceId) return;
        const devices = useConnect.getState().discoveredDevices;
        const existing = devices.find((d) => d.id === payload.id);
        const host = payload.host || 'cloud';
        const port = Number(payload.port) || 0;
        const updatedDev: ConnectDevice = {
          id: payload.id,
          name: payload.name || 'Remote Device',
          type: payload.type || 'PHONE',
          host,
          port,
          lastSeenTimestamp: Date.now(),
          isCloud: existing ? existing.isCloud : true,
        };
        const nextDevices = existing
          ? devices.map((d) => (d.id === payload.id ? updatedDev : d))
          : [...devices, updatedDev];
        useConnect.setState({ discoveredDevices: nextDevices });

        if (host && host !== 'cloud' && port > 0) {
          probeLocalDevice(payload.id, host, port);
        }
        break;
      }

      case 'discover': {
        if (payload.id === deviceId) return;
        sendAnnounce();
        break;
      }

      case 'handoff': {
        const packet = payload as ConnectHandoffPacket;
        if (packet.targetDeviceId && packet.targetDeviceId !== deviceId) return;

        // Pending response resolver
        const resolver = pendingHandoffs.get(packet.handoffId);
        if (resolver && (packet.phase === 'READY' || packet.phase === 'CONFIRMED')) {
          resolver(packet);
          return;
        }

        // Handle incoming transfer to Web player
        if (packet.phase === 'PREPARE') {
          handleIncomingPrepare(packet);
        } else if (packet.phase === 'COMMIT') {
          handleIncomingCommit(packet);
        }
        break;
      }

      case 'control': {
        const cmd = payload as ConnectControlCommand;
        if (cmd.targetDeviceId && cmd.targetDeviceId !== deviceId) return;
        handleIncomingControl(cmd);
        break;
      }

      case 'status': {
        const status = payload as ConnectDeviceStatus;
        const active = useConnect.getState().activeRemoteDevice;
        if (active && (status.deviceId === active.id || !status.deviceId)) {
          useConnect.setState({ remoteStatus: status });
        }
        break;
      }

      case 'pair_request': {
        // If we have an active pair code matching the request
        const currentCode = useConnect.getState().pairCode;
        if (currentCode && payload.code === currentCode && payload.fromDevice) {
          const incomingDev = payload.fromDevice;
          let syncKey = localStorage.getItem(SYNC_KEY);
          if (!syncKey) {
            syncKey = 'sync_' + Math.random().toString(36).substring(2, 12);
            localStorage.setItem(SYNC_KEY, syncKey);
          }

          const resp = {
            code: currentCode,
            success: true,
            message: `Paired with ${useConnect.getState().deviceName}`,
            fromDevice: {
              id: deviceId,
              name: useConnect.getState().deviceName,
              type: 'DESKTOP' as const,
              host: 'cloud',
              port: 0,
              lastSeenTimestamp: Date.now(),
              isCloud: true,
            },
            targetDeviceId: incomingDev.id,
            syncKey,
          };

          const pairChannel = `raaga_pair_${currentCode}`;
          broadcastRawToChannel(pairChannel, 'pair_response', resp);
          setTimeout(() => broadcastRawToChannel(pairChannel, 'pair_response', resp), 200);

          useConnect.getState().pairDeviceDirectly(incomingDev);
          useConnect.setState({
            pairingFeedback: `Successfully paired with ${incomingDev.name}!`,
            pairCode: null,
          });

          temporaryPairCode = null;
          setTimeout(() => {
            connectRelay();
            setTimeout(sendAnnounce, 400);
          }, 600);
        }
        break;
      }

      case 'pair_response': {
        const state = useConnect.getState();
        const incomingDev = payload.fromDevice || payload.device;
        if (payload.targetDeviceId === state.deviceId && payload.success && incomingDev) {
          clearInterval(pairSubmitTimer);
          pairSubmitTimer = null;
          if (payload.syncKey) {
            localStorage.setItem(SYNC_KEY, payload.syncKey);
          }
          state.pairDeviceDirectly(incomingDev);
          useConnect.setState({
            pairingFeedback: `Successfully paired with ${incomingDev.name}!`,
            pairCode: null,
          });

          // Finished pairing; revert temporary pair code and reconnect to permanent synced channel
          temporaryPairCode = null;
          setTimeout(() => {
            connectRelay();
            setTimeout(sendAnnounce, 400);
          }, 600);
        } else if (payload.targetDeviceId === state.deviceId && !payload.success) {
          clearInterval(pairSubmitTimer);
          pairSubmitTimer = null;
          useConnect.setState({
            pairingFeedback: payload.message || 'Pairing code mismatch or expired',
          });
          temporaryPairCode = null;
          connectRelay();
        }
        break;
      }
    }
  } catch {}
}

function sendHandoffWithReply(
  targetId: string,
  packet: ConnectHandoffPacket,
  timeoutMs: number
): Promise<ConnectHandoffPacket | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingHandoffs.delete(packet.handoffId);
      resolve(null);
    }, timeoutMs);

    pendingHandoffs.set(packet.handoffId, (reply) => {
      clearTimeout(timer);
      pendingHandoffs.delete(packet.handoffId);
      resolve(reply);
    });

    broadcastToRelay('handoff', packet);
  });
}

function handleIncomingPrepare(packet: ConnectHandoffPacket) {
  if (!packet.track) return;
  const player = usePlayer.getState();

  // Pre-load track in background
  player.playVideo(packet.track.videoId, {
    title: packet.track.title,
    artist: packet.track.artist,
    artworkUrl: packet.track.thumbnailUrl ?? null,
  });

  // Reply READY
  const ready: ConnectHandoffPacket = {
    ...packet,
    phase: 'READY',
    targetDeviceId: packet.sourceDeviceId,
    sourceDeviceId: useConnect.getState().deviceId,
    bufferReadyDurationMs: 1500,
  };
  broadcastToRelay('handoff', ready);
}

function handleIncomingCommit(packet: ConnectHandoffPacket) {
  const player = usePlayer.getState();
  if (packet.positionMs > 0) {
    player.seek(packet.positionMs / 1000);
  }
  if (packet.isPlaying && player.status !== 'playing') {
    player.togglePlay();
  }

  // Reply CONFIRMED
  const confirmed: ConnectHandoffPacket = {
    ...packet,
    phase: 'CONFIRMED',
    targetDeviceId: packet.sourceDeviceId,
    sourceDeviceId: useConnect.getState().deviceId,
  };
  broadcastToRelay('handoff', confirmed);
}

function handleIncomingControl(cmd: ConnectControlCommand) {
  const player = usePlayer.getState();
  switch (cmd.action) {
    case 'PLAY':
      if (player.status !== 'playing') player.togglePlay();
      break;
    case 'PAUSE':
      if (player.status === 'playing') player.togglePlay();
      break;
    case 'TOGGLE':
      player.togglePlay();
      break;
    case 'NEXT':
      player.next();
      break;
    case 'PREV':
      player.previous();
      break;
    case 'SEEK':
      if (typeof cmd.positionMs === 'number') player.seek(cmd.positionMs / 1000);
      break;
    case 'VOLUME':
      if (typeof cmd.volume === 'number') player.setVolume(cmd.volume);
      break;
    case 'QUERY_STATUS': {
      const nowPlaying = player.nowPlaying;
      const status: ConnectDeviceStatus = {
        deviceId: useConnect.getState().deviceId,
        deviceName: useConnect.getState().deviceName,
        deviceType: 'DESKTOP',
        isPlaying: player.status === 'playing',
        track: nowPlaying
          ? {
              videoId: nowPlaying.videoId,
              title: nowPlaying.title,
              artist: nowPlaying.artist,
              thumbnailUrl: nowPlaying.artworkUrl,
              durationText: `${Math.floor(nowPlaying.durationSec / 60)}:${String(Math.floor(nowPlaying.durationSec % 60)).padStart(2, '0')}`,
            }
          : null,
        positionMs: Math.round(getPlayhead() ? (getPlayhead()?.sec ?? 0) * 1000 : 0),
        durationMs: nowPlaying ? nowPlaying.durationSec * 1000 : 0,
        volume: player.volume,
        playbackSpeed: 1.0,
        anchorMonotonicMs: performance.now(),
        protocolVersion: 2,
        activeSpeakerDeviceId: useConnect.getState().deviceId,
      };
      broadcastToRelay('status', status);
      break;
    }
  }
}
