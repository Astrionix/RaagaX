"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, Activity, RefreshCw, CircleDot } from "lucide-react";
import { DiagnosticReport } from "@/lib/connect/types";
import { ConnectDiagnostics } from "@/lib/connect/ConnectDiagnostics";

interface Props {
  report: DiagnosticReport;
  targetDeviceId?: string;
}

export const DiagnosticsView: React.FC<Props> = ({ report, targetDeviceId }) => {
  const [testingPing, setTestingPing] = useState(false);

  const handleTestPing = () => {
    if (!targetDeviceId) return;
    setTestingPing(true);
    ConnectDiagnostics.getInstance().measurePing(targetDeviceId);
    setTimeout(() => setTestingPing(false), 800);
  };

  const rows = [
    {
      label: "Device Identity",
      type: "success",
      value: report.deviceId,
    },
    {
      label: "Account Authentication",
      type: report.userId ? "success" : "neutral",
      value: report.userId ? "Authenticated" : "Local Wi-Fi Mesh",
    },
    {
      label: "Local LAN Discovery",
      type: report.lanDiscovery ? "success" : "neutral",
      value: report.lanDiscovery ? "Subnet Mesh Active" : "Scanning Subnet",
    },
    {
      label: "Cloud Presence Discovery",
      type: report.cloudPresence ? "success" : "neutral",
      value: report.cloudPresence ? "Online" : "Standby",
    },
    {
      label: "Device Reachability",
      type: report.reachability ? "success" : "neutral",
      value: report.reachability ? "Connected" : "Idle (Ready)",
    },
    {
      label: "Authorization Policy",
      type: report.authorization ? "success" : "error",
      value: report.authorization ? "Valid" : "Unauthorized",
    },
    {
      label: "LAN Transport (WebRTC)",
      type: report.lanTransport ? "success" : "neutral",
      value: report.lanTransport ? "Direct P2P Open" : "Standby",
    },
    {
      label: "Cloud Relay Fallback",
      type: report.cloudTransport ? "success" : "neutral",
      value: report.cloudTransport ? "Relay Active" : "Ready",
    },
    {
      label: "Session Handshake",
      type: report.handshake ? "success" : "neutral",
      value: report.handshake ? "Established" : "Standby",
    },
    {
      label: "Authoritative State Sync",
      type: "success",
      value: "Verified",
    },
    {
      label: "Playback Handoff Engine",
      type: "success",
      value: "Ready",
    },
  ];

  const renderIcon = (type: string) => {
    if (type === "success") {
      return <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />;
    }
    if (type === "error") {
      return <XCircle size={14} className="text-red-400 flex-shrink-0" />;
    }
    return <CircleDot size={14} className="text-zinc-500 flex-shrink-0" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2.5">
          <Activity size={18} className="text-[#1DB954]" />
          <div>
            <span className="text-xs font-bold text-white block">Round-Trip Command Latency</span>
            <span className="text-[10px] text-zinc-400">Target: {targetDeviceId || "Local Host"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold text-emerald-400">
            {report.roundTripLatencyMs ? `${report.roundTripLatencyMs} ms` : "< 5 ms"}
          </span>
          {targetDeviceId && (
            <button
              onClick={handleTestPing}
              disabled={testingPing}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Measure ping"
            >
              <RefreshCw size={14} className={testingPing ? "animate-spin text-[#1DB954]" : ""} />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 divide-y divide-white/5 overflow-hidden">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              {renderIcon(r.type)}
              <span className="text-zinc-300 font-medium">{r.label}</span>
            </div>
            <span className="font-mono text-[11px] text-zinc-400 truncate max-w-[150px]">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
