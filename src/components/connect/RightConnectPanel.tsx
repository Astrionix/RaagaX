"use client";

import React, { useState } from "react";
import { X, Wifi, Smartphone, Download, Volume2, Radio, Bluetooth, ChevronRight, Share2, LogOut } from "lucide-react";
import { DeviceInfo, ConnectionState, PairingRequest, DiagnosticReport } from "@/lib/connect/types";
import { DeviceListItem } from "./DeviceListItem";
import { usePlayerStore } from "@/context/usePlayerStore";
import { DeviceRegistry } from "@/lib/connect/DeviceRegistry";
import { VolumeControl } from "@/components/player/VolumeControl";
import { useJam } from "@/hooks/useJam";
import { JamInviteModal } from "@/components/jam/JamInviteModal";
import { JamJoinModal } from "@/components/jam/JamJoinModal";
import { BluetoothAirPlayModal } from "./BluetoothAirPlayModal";

interface Props {
  thisDevice: DeviceInfo;
  availableDevices: DeviceInfo[];
  activePlayerDeviceId: string;
  isLocalSpeaker: boolean;
  onSwitchPlayback: (deviceId: string) => Promise<boolean>;
  onClose: () => void;
  onRename?: (newName: string) => void | Promise<any>;
  connectionState?: ConnectionState;
  activePairingPin?: string | null;
  incomingPairingRequest?: PairingRequest | null;
  diagnosticReport?: DiagnosticReport;
  onConnectToDevice?: (deviceId: string) => Promise<boolean>;
  onDisconnect?: () => void;
  onGeneratePin?: () => string;
  onSubmitPin?: (pin: string) => Promise<{ success: boolean; reason?: string }>;
  onApprovePairing?: () => void;
  onRejectPairing?: (reason?: string) => void;
}

export const RightConnectPanel: React.FC<Props> = ({
  thisDevice,
  availableDevices,
  activePlayerDeviceId: propActivePlayerId,
  onSwitchPlayback,
  onClose,
  onRename,
}) => {
  const { isLocalPlayback, activePlaybackDeviceId: storeActivePlayerId, volume, isMuted } = usePlayerStore();
  const { isInJam, isHost, roomPin, participantCount, inviteUrl, isInviteModalOpen, setIsInviteModalOpen, startJam, joinJam, leaveJam, allowGuestControl, setAllowGuestControl } = useJam();
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const otherDevices = availableDevices.filter((d) => d.deviceId !== thisDevice.deviceId);

  // If there are NO other devices found on the network, this local device is definitively the active player!
  const isLocalActive = otherDevices.length === 0 || (isLocalPlayback && (!storeActivePlayerId || storeActivePlayerId === thisDevice.deviceId));
  const activeRemoteId = !isLocalActive && storeActivePlayerId ? storeActivePlayerId : propActivePlayerId;

  // Find active remote device if remote is playing
  const activeRemoteDevice = !isLocalActive
    ? otherDevices.find((d) => d.deviceId === activeRemoteId) ||
      (activeRemoteId ? DeviceRegistry.getInstance().getDevice(activeRemoteId) : null) ||
      (otherDevices.length > 0 ? otherDevices[0] : null)
    : null;

  return (
    <aside className="flex-1 flex flex-col text-white text-xs select-none p-4 h-full overflow-hidden bg-[#121212]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 mb-2 flex-shrink-0">
        <h2 className="text-base font-bold text-white tracking-tight">Connect</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close Connect Panel"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Spotify Jam Interactive Section */}
      {!isInJam ? (
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-[#1ed760]/15 to-white/5 border border-[#1ed760]/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1ed760]/20 flex items-center justify-center flex-shrink-0">
              <Radio size={16} className="text-[#1ed760]" />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">Start a Jam</p>
              <p className="text-[10px] text-zinc-400">Listen together in real time</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => startJam()}
              className="px-3 py-1.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] active:scale-95 text-black font-bold text-[11px] transition-transform cursor-pointer"
            >
              Start
            </button>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-[11px] transition-transform cursor-pointer"
            >
              Join
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3 p-3 rounded-xl bg-[#1ed760]/10 border border-[#1ed760]/30 flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
              <span className="text-[11px] font-bold text-[#1ed760]">Jam Active • {roomPin}</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-medium">{participantCount} listening</span>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <Share2 size={12} />
              <span>Invite Friends</span>
            </button>
            <button
              onClick={leaveJam}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Leave Jam"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <div className="space-y-0.5">
          {/* If Local Device (This web browser) is Active */}
          {isLocalActive ? (
            <>
              <DeviceListItem
                device={thisDevice}
                isSelf={true}
                isActivePlayer={true}
                onSwitchPlayback={() => onSwitchPlayback(thisDevice.deviceId)}
                onRename={onRename}
              />
              {otherDevices.map((dev) => (
                <DeviceListItem
                  key={dev.deviceId}
                  device={dev}
                  isSelf={false}
                  isActivePlayer={false}
                  onSwitchPlayback={(id) => onSwitchPlayback(id)}
                />
              ))}
            </>
          ) : (
            /* If Remote Device (e.g. Android Device) is Active */
            <>
              {activeRemoteDevice && (
                <DeviceListItem
                  key={activeRemoteDevice.deviceId}
                  device={activeRemoteDevice}
                  isSelf={false}
                  isActivePlayer={true}
                  onSwitchPlayback={() => {}}
                />
              )}
              <DeviceListItem
                device={thisDevice}
                isSelf={true}
                isActivePlayer={false}
                onSwitchPlayback={() => onSwitchPlayback(thisDevice.deviceId)}
                onRename={onRename}
              />
              {otherDevices
                .filter((d) => d.deviceId !== activeRemoteDevice?.deviceId)
                .map((dev) => (
                  <DeviceListItem
                    key={dev.deviceId}
                    device={dev}
                    isSelf={false}
                    isActivePlayer={false}
                    onSwitchPlayback={(id) => onSwitchPlayback(id)}
                  />
                ))}
            </>
          )}

          {/* Empty Helper Section when no other devices found (matches Spotify Screenshot 1) */}
          {otherDevices.length === 0 && !activeRemoteDevice && (
            <div className="pt-6 space-y-5">
              <h3 className="text-xs font-bold text-white tracking-tight">
                No other devices found
              </h3>

              <div className="space-y-4 text-zinc-400">
                <div className="flex items-start gap-3">
                  <Wifi size={18} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">Check your WiFi</p>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Connect the devices you're using to the same WiFi.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Smartphone size={18} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">Play from another device</p>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      It will automatically appear here.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Download size={18} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">Switch to the RaagaX app</p>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      The app can detect more devices.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── AIRPLAY OR BLUETOOTH ROW (Spotify Connect Design) ── */}
      <div className="pt-2 pb-1 border-t border-white/5 flex-shrink-0">
        <button
          onClick={() => setIsBluetoothModalOpen(true)}
          className="w-full flex items-center justify-between py-2 px-2 rounded-xl hover:bg-white/5 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors">
              <Bluetooth size={14} className="text-zinc-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <span className="text-xs font-medium">AirPlay or Bluetooth</span>
          </div>
          <ChevronRight size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        </button>
      </div>

      {/* ── SPOTIFY CONNECT DEDICATED SPEAKER VOLUME FOOTER ── */}
      <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1.5 flex-shrink-0">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span className="font-semibold text-white/80 flex items-center gap-1.5">
            <Volume2 size={13} className={!isLocalActive ? "text-[#1ed760]" : "text-white/70"} />
            {!isLocalActive && activeRemoteDevice ? `${activeRemoteDevice.deviceName} Volume` : "Device Volume"}
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {isMuted ? "Muted" : `${Math.round(volume * 100)}%`}
          </span>
        </div>
        <VolumeControl className="w-full px-1" />
      </div>

      {/* Jam Invite & Share Modal */}
      <JamInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomPin={roomPin}
        inviteUrl={inviteUrl}
        participantCount={participantCount}
        onLeaveJam={leaveJam}
        isHost={isHost}
        allowGuestControl={allowGuestControl}
        onToggleGuestControl={setAllowGuestControl}
      />

      {/* Jam Join Modal */}
      <JamJoinModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={joinJam}
      />

      {/* Bluetooth / AirPlay Modal */}
      <BluetoothAirPlayModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
      />
    </aside>
  );
};
