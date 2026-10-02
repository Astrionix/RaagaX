"use client";

import React, { useState } from "react";
import { 
  Users, Server, Laptop, Smartphone, Tablet, 
  Wifi, Clock, Activity, Zap, Play, ArrowRight, 
  Check, RefreshCw, Layers, ListMusic, Plus, Trash2, ArrowUpDown
} from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

export const ListenTogether: React.FC = () => {
  // Interactive Latency Slider State
  const [latencyScenario, setLatencyScenario] = useState<40 | 120 | 300>(120);

  // Clock Sync Ping/Pong Interactive Simulator
  const [pingStats, setPingStats] = useState({
    rtt: 48,
    offset: -14,
    status: "Synchronized",
  });

  const simulatePing = () => {
    const randomRtt = Math.floor(Math.random() * 30) + 35;
    const randomOffset = Math.floor(Math.random() * 20) - 25;
    setPingStats({
      rtt: randomRtt,
      offset: randomOffset,
      status: "Calculated via NTP Ping/Pong",
    });
  };

  // Queue Sync Simulation
  const [queue, setQueue] = useState([
    { id: 1, title: "01 Midnight Echoes", artist: "Kavinsky", duration: "3:45" },
    { id: 2, title: "02 Solar Drift", artist: "Tycho", duration: "4:12" },
    { id: 3, title: "03 Neon Velocity", artist: "Gunship", duration: "3:58" },
    { id: 4, title: "04 Cybernetic Calm", artist: "Lorn", duration: "4:30" },
    { id: 5, title: "05 Astral Pulse", artist: "Com Truise", duration: "3:20" },
  ]);

  const [lastMutation, setLastMutation] = useState<string>("PARTY_QUEUE_INIT");

  const moveFirstToEnd = () => {
    if (queue.length < 2) return;
    const newQueue = [...queue];
    const item = newQueue.shift()!;
    newQueue.push(item);
    setQueue(newQueue);
    setLastMutation(`QUEUE_MOVE { fromIndex: 0, toIndex: ${newQueue.length - 1} } — 18 bytes`);
  };

  const removeTop = () => {
    if (queue.length <= 1) return;
    const newQueue = queue.slice(1);
    setQueue(newQueue);
    setLastMutation(`QUEUE_REMOVE { songId: "${queue[0].id}" } — 14 bytes`);
  };

  const addSong = () => {
    const nextId = queue.length + 1;
    const newSong = {
      id: nextId,
      title: `0${nextId} Quantum Resonance`,
      artist: "Astrionix",
      duration: "3:50",
    };
    setQueue([...queue, newSong]);
    setLastMutation(`QUEUE_APPEND { id: ${nextId}, title: "Quantum..." } — 24 bytes`);
  };

  return (
    <section id="listen-together" className="relative py-28 border-t border-white/[0.06] bg-[#030509]">
      
      {/* Background Decorative Ambient Radial Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-red-600/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* Section Heading & Core Philosophy */}
        <div className="max-w-3xl space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
              The Engineering Centerpiece
            </span>
            <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Listening together is a distributed systems problem.
          </h2>

          <p className="text-lg text-zinc-400 leading-relaxed">
            Instead of telling every device to &ldquo;play now&rdquo;, RaagaX synchronizes
            playback using a shared server-time anchor. Network delays can vary by hundreds
            of milliseconds across cellular towers — but a time-anchored playhead converges
            authoritatively.
          </p>
        </div>

        {/* 1. ARCHITECTURE VISUALIZATION: Phone -> Go WS Server -> Client Devices */}
        <div className="p-8 sm:p-10 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-red-400" />
                <span>Listen Together Mesh Topology</span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                Go WebSocket Hub • Single-port Render Cluster • In-Memory Party State
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Configured party capacity: <strong>{RAAGAX_CONFIG.stats.maxPartyCapacity} devices</strong></span>
            </div>
          </div>

          {/* Interactive Topology Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Host Controller Device */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Host Controller</h4>
                <p className="text-[11px] font-mono text-zinc-400">Android Client (Phone A)</p>
              </div>
              <div className="text-[10px] font-mono text-emerald-400 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                Authoritative Token Holder
              </div>
            </div>

            {/* Central Go Server Hub */}
            <div className="p-6 rounded-2xl bg-red-600/[0.05] border border-red-500/30 text-center space-y-3 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-red-600 text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                State Anchor Hub
              </div>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-lg">
                <Server className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Go Party Hub</h4>
                <p className="text-[11px] font-mono text-zinc-300">WebSocket /ws/parties/&#123;code&#125;</p>
              </div>
              <div className="text-[10px] font-mono text-zinc-400 bg-black/40 p-2 rounded-lg border border-white/10">
                Monotonic Server Clock (Zero NTP Steps)
              </div>
            </div>

            {/* Listener Renderers */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center space-y-3">
              <div className="flex justify-center gap-2 text-zinc-400">
                <Laptop className="w-6 h-6 text-purple-400" />
                <Smartphone className="w-6 h-6 text-cyan-400" />
                <Tablet className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Member Renderers</h4>
                <p className="text-[11px] font-mono text-zinc-400">Up to 4 additional joined clients</p>
              </div>
              <div className="text-[10px] font-mono text-purple-400 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                Independent Playhead Calculus
              </div>
            </div>

          </div>
        </div>

        {/* 2. SYNCHRONIZATION VISUALIZATION & THE MATHEMATICAL PROOF */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left: The Conceptual Equation */}
          <div className="lg:col-span-6 p-8 rounded-3xl glass-panel border border-white/[0.1] space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-mono uppercase text-red-400 font-semibold tracking-wider">
                The Playhead Formula
              </span>
              <h3 className="text-2xl font-bold text-white">
                How every client converges without polling
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Each client calculates where playback should be right now instead of waiting
                for another network packet to arrive. Even if a packet is delayed, the
                server-time anchor guarantees deterministic playhead alignment.
              </p>

              {/* Code / Formula Block */}
              <div className="p-5 rounded-2xl bg-black/60 border border-white/[0.1] font-mono text-xs text-zinc-300 space-y-3">
                <div className="text-zinc-500">// Authoritative State Broadcast from Server:</div>
                <div className="text-red-300">
                  positionMs = 42000;<br />
                  anchorMs   = 1757630001234; <span className="text-zinc-500">// Server timestamp</span><br />
                  isPlaying  = true;
                </div>
                <div className="border-t border-white/[0.08] pt-2 text-zinc-500">// Client-Side Autonomous Resolution:</div>
                <div className="text-emerald-300 font-semibold">
                  serverNow = deviceNow + clockOffset;<br />
                  playhead  = positionMs + max(0, serverNow - anchorMs);
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] font-mono text-zinc-400">
              ⚡ Designed to minimize playback drift across diverse mobile networks.
            </div>
          </div>

          {/* Right: Latency Simulation Playground */}
          <div className="lg:col-span-6 p-8 rounded-3xl glass-panel border border-white/[0.1] space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h4 className="text-base font-bold text-white">Network Latency Drift Simulator</h4>
                <p className="text-xs text-zinc-400 font-mono">Test packet delay impact on audio playhead</p>
              </div>
              <Wifi className="w-4 h-4 text-cyan-400" />
            </div>

            {/* Latency Presets */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-zinc-400">Select packet transit delay:</span>
              <div className="grid grid-cols-3 gap-2">
                {([40, 120, 300] as const).map((ms) => (
                  <button
                    key={ms}
                    onClick={() => setLatencyScenario(ms)}
                    className={`py-2 px-3 rounded-xl text-xs font-mono font-semibold border transition-all ${
                      latencyScenario === ms
                        ? "bg-red-500/20 border-red-500/50 text-white shadow-lg"
                        : "bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {ms} ms Delay
                  </button>
                ))}
              </div>
            </div>

            {/* Convergence Output Box */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Packet Transit Time:</span>
                <span className="text-amber-400 font-bold">{latencyScenario} ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Arrival Offset vs Anchor:</span>
                <span className="text-zinc-300">+{latencyScenario} ms in the past</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/[0.08] pt-2">
                <span className="text-zinc-300 font-semibold">Calculated Playhead:</span>
                <span className="text-emerald-400 font-bold">
                  {(42000 + latencyScenario).toLocaleString()} ms
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                ✓ Playhead immediately accounts for elapsed time. Both phones play in sync without waiting for a re-transmission!
              </div>
            </div>
          </div>

        </div>

        {/* 3. CLOCK SYNCHRONIZATION & 5S AUTHORITATIVE HEARTBEAT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Clock Synchronization (NTP-Style Ping/Pong) */}
          <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-white/[0.1] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <h4 className="text-base font-bold text-white">NTP-Style Clock Synchronization</h4>
              </div>
              <button
                onClick={simulatePing}
                className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Ping</span>
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Device clocks are never assumed to be identical. Each client measures its
              exact offset: <code>serverMs - (t0 + t1) / 2</code>. Error is bounded by half
              the round-trip time, retaining the sample with the smallest RTT over cellular.
            </p>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-zinc-500">Device Ping RTT:</span><span className="text-purple-300">{pingStats.rtt} ms</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Estimated Clock Offset:</span><span className="text-white">{pingStats.offset} ms</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Clock Offset Status:</span><span className="text-emerald-400">{pingStats.status}</span></div>
            </div>
          </div>

          {/* 5-Second Authoritative Heartbeat */}
          <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-white/[0.1] space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-400" />
              <h4 className="text-base font-bold text-white">5-Second Authoritative Heartbeat</h4>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Lost packets, OS power-save doze cycles, or Wi-Fi to cellular handovers do not
              announce themselves. Every 5 seconds (<code>JAM_STATE_HEARTBEAT_MS</code>), the
              Go party server unprompted re-states the authoritative truth to all members.
            </p>

            {/* Timeline Visualization */}
            <div className="space-y-2 pt-1 font-mono text-xs">
              <span className="text-[11px] text-zinc-500 block uppercase">Continuous Heartbeat Interval:</span>
              <div className="flex items-center justify-between text-center gap-1">
                {["0s", "5s", "10s", "15s", "20s"].map((tick, i) => (
                  <div key={tick} className="flex-1 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-red-400 font-bold">{tick}</span>
                    <span className="text-[9px] text-zinc-500">Sync Check</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* 4. QUEUE SYNCHRONIZATION: LIGHTWEIGHT MUTATIONS */}
        <div className="p-8 sm:p-10 rounded-3xl glass-panel border border-white/[0.1] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-emerald-400" />
                <span>Lightweight Queue Mutation Sync</span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                Delta mutations (Move, Remove, Append) over wire instead of transferring full 500-track arrays
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={moveFirstToEnd}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-zinc-300 flex items-center gap-1.5 transition-colors"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Move 1st to End</span>
              </button>
              <button
                onClick={removeTop}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-zinc-300 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
                <span>Remove Top</span>
              </button>
              <button
                onClick={addSong}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Append Track</span>
              </button>
            </div>
          </div>

          {/* Interactive Queue Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {queue.map((track, i) => (
              <div
                key={track.id}
                className={`p-3.5 rounded-2xl border text-xs font-mono transition-all ${
                  i === 0
                    ? "bg-red-500/10 border-red-500/40 text-white shadow-lg"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                  <span>{i === 0 ? "▶ NOW PLAYING" : `POSITION 0${i + 1}`}</span>
                  <span>{track.duration}</span>
                </div>
                <div className="font-bold text-sm truncate text-white">{track.title}</div>
                <div className="text-[11px] text-zinc-400 truncate">{track.artist}</div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-500">Last Broadcast Protocol Frame:</span>
            <span className="text-emerald-400">{lastMutation}</span>
          </div>
        </div>

      </div>
    </section>
  );
};
