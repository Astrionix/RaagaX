"use client";

import React, { useState } from "react";
import { Server, Terminal, Radio, Code2, Globe, Send, Check } from "lucide-react";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

export const BackendDeepDive: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("GET /api/time");

  const endpoints = [
    {
      method: "GET",
      path: "/healthz",
      type: "REST",
      desc: "Liveness probe verifying Go runtime and WebSocket hub concurrency status.",
      response: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "activeParties": 14,
  "connectedClients": 42,
  "uptimeSeconds": 864200
}`,
    },
    {
      method: "GET",
      path: "/api/time",
      type: "REST",
      desc: "Instant monotonic server clock reading providing mobile clients a bootstrap time anchor before upgrading to a WebSocket.",
      response: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "serverMs": 1757630042120,
  "monotonicNanoseconds": 9482018402120
}`,
    },
    {
      method: "POST",
      path: "/api/parties",
      type: "REST",
      desc: "Creates a new 6-character party room in memory without requiring database writes.",
      response: `HTTP/1.1 201 Created
Content-Type: application/json

{
  "partyCode": "X7K9P2",
  "hostToken": "tok_9f8a81bc42018e",
  "maxCapacity": 5,
  "createdAtMs": 1757630045000
}`,
    },
    {
      method: "POST",
      path: "/api/parties/{code}/join",
      type: "REST",
      desc: "Registers a client device into an existing party code, minting an unguessable member token.",
      response: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "joined": true,
  "memberId": "mem_d9812a",
  "displayName": "Chandra",
  "isHost": false,
  "currentTrack": "Ethereal Echoes"
}`,
    },
    {
      method: "WS",
      path: "/ws/parties/{code}",
      type: "WebSocket",
      desc: "Persistent full-duplex WebSocket stream carrying real-time state broadcasts, NTP pings, and delta queue mutations.",
      response: `// Bidirectional JSON Frame Sequence:
1. CLIENT -> SERVER: {"type":"ping", "clientMs":1757630050100}
2. SERVER -> CLIENT: {"type":"pong", "clientMs":1757630050100, "serverMs":1757630050148}
3. SERVER -> CLIENT: {
     "type": "state",
     "positionMs": 42000,
     "anchorMs": 1757630050000,
     "isPlaying": true,
     "trackId": "raaga_9042"
   }
4. CLIENT -> SERVER: {"type":"control", "action":"seek", "seekToMs":64000}`,
    },
  ];

  const activeEp = endpoints.find((e) => `${e.method} ${e.path}` === selectedEndpoint) || endpoints[0];

  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#030509]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              Go Jam Hub Backend
            </span>
            <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Small backend. Serious synchronization.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            The party server is written in Go: one WebSocket per device, in-memory room state,
            zero database overhead, and sub-millisecond execution. Deployed as a single high-throughput
            service designed to keep up to five signed-in devices in perfect lockstep.
          </p>
        </div>

        {/* Interactive API & WebSocket Explorer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Endpoints List (Left Column) */}
          <div className="lg:col-span-5 space-y-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest block mb-2">
              REST &amp; WebSocket Endpoints:
            </span>

            {endpoints.map((ep) => {
              const key = `${ep.method} ${ep.path}`;
              const isSelected = selectedEndpoint === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedEndpoint(key)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between font-mono text-xs ${
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500/40 text-white shadow-lg"
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ep.method === "GET"
                          ? "bg-blue-500/20 text-blue-400"
                          : ep.method === "POST"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-purple-500/20 text-purple-400"
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="truncate">{ep.path}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{ep.type}</span>
                </button>
              );
            })}
          </div>

          {/* Code Output Viewer (Right Column) */}
          <div className="lg:col-span-7">
            <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono text-white font-bold">
                    {activeEp.method} {activeEp.path}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-400">
                  {activeEp.type}
                </span>
              </div>

              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                {activeEp.desc}
              </p>

              {/* Terminal Frame */}
              <div className="p-4 rounded-2xl bg-black/80 border border-white/[0.08] overflow-x-auto">
                <pre className="font-mono text-xs text-emerald-300 leading-relaxed whitespace-pre">
                  {activeEp.response}
                </pre>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>Go 1.22 Runtime • Zero Alloc Protocol Parser</span>
                <span>Render Single-Port Deploy</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
