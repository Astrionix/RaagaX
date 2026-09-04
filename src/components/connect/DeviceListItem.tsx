"use client";

import React, { useState } from "react";
import { Laptop, Smartphone, Tablet, Speaker, Loader2, Pencil, Check, X, Volume2 } from "lucide-react";
import { DeviceInfo } from "@/lib/connect/types";

interface Props {
  device: DeviceInfo;
  isSelf: boolean;
  isActivePlayer: boolean;
  onSwitchPlayback: (deviceId: string) => void | Promise<any>;
  onRename?: (newName: string) => void | Promise<any>;
}

export const DeviceListItem: React.FC<Props> = ({
  device,
  isSelf,
  isActivePlayer,
  onSwitchPlayback,
  onRename,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(device.deviceName || "This web browser");
  const [isSaving, setIsSaving] = useState(false);

  const renderIcon = () => {
    const iconClass = `w-5 h-5 flex-shrink-0 transition-colors ${
      isActivePlayer ? "text-[#1ed760]" : "text-white group-hover:text-white"
    }`;
    switch (device.deviceType) {
      case "phone":
        return <Smartphone className={iconClass} strokeWidth={1.8} />;
      case "tablet":
        return <Tablet className={iconClass} strokeWidth={1.8} />;
      case "desktop":
        return <Laptop className={iconClass} strokeWidth={1.8} />;
      default:
        return <Speaker className={iconClass} strokeWidth={1.8} />;
    }
  };

  const displayName = device.deviceName || (isSelf ? "This web browser" : "Remote Device");

  const handleClick = async () => {
    if (isEditing || isActivePlayer || isConnecting) return;
    setIsConnecting(true);
    try {
      await Promise.resolve(onSwitchPlayback(device.deviceId));
    } catch (err) {
      console.error("[DeviceListItem] Playback switch failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveRename = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = editName.trim();
    if (!trimmed || trimmed === device.deviceName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const { connectEngine } = await import("@/lib/connect/ConnectEngine");
      await connectEngine.renameDevice(trimmed);
      if (onRename) {
        await Promise.resolve(onRename(trimmed));
      }
      setIsEditing(false);
    } catch (err) {
      console.error("[DeviceListItem] Rename failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className={`w-full group text-left flex items-center justify-between px-3 py-3 rounded-lg transition-colors select-none ${
        isActivePlayer
          ? "cursor-default"
          : "hover:bg-white/10 active:bg-white/15 cursor-pointer"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {renderIcon()}

        {isEditing ? (
          <form
            onSubmit={handleSaveRename}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 flex-1 min-w-0"
          >
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditName(device.deviceName || "This web browser");
                }
              }}
              autoFocus
              maxLength={32}
              className="bg-black/60 border border-[#1ed760] rounded px-2 py-0.5 text-xs text-white focus:outline-none flex-1 min-w-0"
              placeholder="Enter device name..."
            />
            <button
              type="button"
              onClick={handleSaveRename}
              disabled={isSaving}
              className="p-1 text-[#1ed760] hover:bg-white/10 rounded transition-colors"
              title="Save name"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(false);
                setEditName(device.deviceName || "This web browser");
              }}
              className="p-1 text-zinc-400 hover:bg-white/10 rounded transition-colors"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={`text-sm font-semibold truncate transition-colors ${
                  isActivePlayer ? "text-[#1ed760]" : "text-white"
                }`}
              >
                {displayName}
              </span>

              {isSelf && (
                <span className="text-[10px] font-medium text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded flex-shrink-0">
                  This Device
                </span>
              )}

              {isSelf && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditName(device.deviceName || "This web browser");
                    setIsEditing(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-white transition-opacity rounded"
                  title="Rename device"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-medium leading-none pt-0.5">
              {isActivePlayer ? (
                <span className="text-[#1ed760] flex items-center gap-1">
                  <Volume2 size={11} className="flex-shrink-0" />
                  <span>{isSelf ? "Listening on this device" : "Playing on this device"}</span>
                </span>
              ) : (
                <span className="text-zinc-400">
                  {device.source === 'CLOUD'
                    ? 'RaagaX Connect • Cloud (Account)'
                    : device.source === 'BOTH'
                    ? 'RaagaX Connect • Wi-Fi & Account'
                    : 'RaagaX Connect • Local Wi-Fi'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Side: Animated Equalizer Wave Bars if Active, Loader if Connecting */}
      <div className="flex items-center flex-shrink-0 pl-2">
        {isActivePlayer ? (
          <span className="flex items-end gap-[2px] h-3.5">
            <span className="w-0.5 bg-[#1ed760] h-full animate-[pulse_0.7s_ease-in-out_infinite]" />
            <span className="w-0.5 bg-[#1ed760] h-2/3 animate-[pulse_0.5s_ease-in-out_infinite_0.15s]" />
            <span className="w-0.5 bg-[#1ed760] h-4/5 animate-[pulse_0.8s_ease-in-out_infinite_0.3s]" />
          </span>
        ) : isConnecting ? (
          <Loader2 size={15} className="animate-spin text-[#1ed760]" />
        ) : null}
      </div>
    </div>
  );
};
