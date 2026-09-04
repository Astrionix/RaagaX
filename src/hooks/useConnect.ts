"use client";

import { useEffect, useState, useCallback } from "react";
import { connectEngine } from "@/lib/connect/ConnectEngine";
import { DeviceRegistry } from "@/lib/connect/DeviceRegistry";
import { AuthorizationManager } from "@/lib/connect/AuthorizationManager";
import { TransportManager, TransportType } from "@/lib/connect/TransportManager";
import { ConnectDiagnostics } from "@/lib/connect/ConnectDiagnostics";
import { DeviceInfo, ConnectionState, PairingRequest, DiagnosticReport } from "@/lib/connect/types";
import { usePlayerStore } from "@/context/usePlayerStore";

export function useConnect(userId?: string | null) {
  const { isLocalPlayback, activePlaybackDeviceId: storeActivePlayerId } = usePlayerStore();
  const [thisDevice, setThisDevice] = useState<DeviceInfo>(connectEngine.getThisDevice());
  const [availableDevices, setAvailableDevices] = useState<DeviceInfo[]>([]);
  const [activePlayerDeviceId, setActivePlayerDeviceId] = useState<string>(connectEngine.getActivePlayerDeviceId());
  const [activeControllerDeviceId, setActiveControllerDeviceId] = useState<string | null>(connectEngine.getActiveControllerDeviceId());
  const [connectionState, setConnectionState] = useState<ConnectionState>(connectEngine.getConnectionState());
  const [activeTransport, setActiveTransport] = useState<TransportType>(TransportManager.getInstance().getActiveTransport());
  const [activePairingPin, setActivePairingPin] = useState<string | null>(AuthorizationManager.getInstance().getActivePairingPin());
  const [incomingPairingRequest, setIncomingPairingRequest] = useState<PairingRequest | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport>(ConnectDiagnostics.getInstance().getReport());

  const otherDevices = availableDevices.filter((d) => d.deviceId !== thisDevice.deviceId);
  const effectiveActivePlayerDeviceId = !isLocalPlayback && storeActivePlayerId ? storeActivePlayerId : activePlayerDeviceId;
  const isLocalSpeaker = otherDevices.length === 0 || (isLocalPlayback && (!storeActivePlayerId || storeActivePlayerId === thisDevice.deviceId));

  // Auto-heal local playback if no other remote devices exist on the network
  useEffect(() => {
    if (otherDevices.length === 0 && !isLocalPlayback) {
      const self = connectEngine.getThisDevice();
      usePlayerStore.getState().setActivePlaybackDeviceId(self.deviceId);
      usePlayerStore.setState({ isLocalPlayback: true, activePlaybackDeviceId: self.deviceId });
    }
  }, [otherDevices.length, isLocalPlayback]);

  // Initialize engine on boot
  useEffect(() => {
    connectEngine.init(userId);
    setThisDevice(connectEngine.getThisDevice());
  }, [userId]);

  // Subscribe to device registry
  useEffect(() => {
    const unsub = DeviceRegistry.getInstance().subscribe((all) => {
      const selfId = connectEngine.getThisDevice().deviceId;
      setAvailableDevices(all.filter((d) => d.deviceId !== selfId));
    });
    return unsub;
  }, []);

  // Subscribe to connection state
  useEffect(() => {
    const unsub = connectEngine.onConnectionStateChange((state) => {
      setConnectionState(state);
    });
    return unsub;
  }, []);

  // Subscribe to active player changes
  useEffect(() => {
    const unsub = connectEngine.onActivePlayerChange((playerId) => {
      setActivePlayerDeviceId(playerId);
    });
    return unsub;
  }, []);

  // Subscribe to active controller changes
  useEffect(() => {
    const unsub = connectEngine.onActiveControllerChange((controllerId) => {
      setActiveControllerDeviceId(controllerId);
    });
    return unsub;
  }, []);

  // Subscribe to transport changes
  useEffect(() => {
    const unsub = TransportManager.getInstance().onTransportChange((t) => {
      setActiveTransport(t);
    });
    return unsub;
  }, []);

  // Subscribe to incoming pairing requests
  useEffect(() => {
    AuthorizationManager.getInstance().setIncomingRequestCallback((req) => {
      setIncomingPairingRequest(req);
    });
    return () => {
      AuthorizationManager.getInstance().setIncomingRequestCallback(() => {});
    };
  }, []);

  // Subscribe to live diagnostics
  useEffect(() => {
    const unsub = ConnectDiagnostics.getInstance().subscribe((report) => {
      setDiagnosticReport(report);
    });
    return unsub;
  }, []);

  const connectToDevice = useCallback(async (targetDeviceId: string) => {
    return connectEngine.connectToDevice(targetDeviceId);
  }, []);

  const disconnect = useCallback(() => {
    connectEngine.disconnect();
  }, []);

  const switchPlaybackTo = useCallback(async (targetDeviceId: string) => {
    return connectEngine.switchPlaybackTo(targetDeviceId);
  }, []);

  const generatePairingPin = useCallback(() => {
    const pin = AuthorizationManager.getInstance().generatePairingPin();
    setActivePairingPin(pin);
    return pin;
  }, []);

  const submitPairingPin = useCallback(async (pin: string) => {
    return AuthorizationManager.getInstance().submitPairingPin(pin);
  }, []);

  const approvePairing = useCallback(() => {
    AuthorizationManager.getInstance().approvePairing();
    setIncomingPairingRequest(null);
  }, []);

  const rejectPairing = useCallback((reason?: string) => {
    AuthorizationManager.getInstance().rejectPairing(reason);
    setIncomingPairingRequest(null);
  }, []);

  // Remote Commands
  const sendPlay = useCallback(() => connectEngine.sendRemoteCommand('PLAY'), []);
  const sendPause = useCallback(() => connectEngine.sendRemoteCommand('PAUSE'), []);
  const sendSeek = useCallback((positionMs: number) => connectEngine.sendRemoteCommand('SEEK', { positionMs }), []);
  const sendVolume = useCallback((volume: number) => connectEngine.sendRemoteCommand('SET_VOLUME', { volume }), []);
  const sendNext = useCallback(() => connectEngine.sendRemoteCommand('NEXT'), []);
  const sendPrev = useCallback(() => connectEngine.sendRemoteCommand('PREVIOUS'), []);

  const renameDevice = useCallback(async (newName: string) => {
    await connectEngine.renameDevice(newName);
    setThisDevice(connectEngine.getThisDevice());
  }, []);

  return {
    thisDevice,
    availableDevices,
    activePlayerDeviceId: effectiveActivePlayerDeviceId,
    activeControllerDeviceId,
    isLocalSpeaker,
    connectionState,
    activeTransport,
    activePairingPin,
    incomingPairingRequest,
    diagnosticReport,
    connectToDevice,
    disconnect,
    switchPlaybackTo,
    generatePairingPin,
    submitPairingPin,
    approvePairing,
    rejectPairing,
    renameDevice,
    sendPlay,
    sendPause,
    sendSeek,
    sendVolume,
    sendNext,
    sendPrev,
  };
}
