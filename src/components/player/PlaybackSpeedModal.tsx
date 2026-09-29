'use client';

import React from 'react';
import { X, Gauge, Check } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';

interface PlaybackSpeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export function PlaybackSpeedModal({ isOpen, onClose }: PlaybackSpeedModalProps) {
  const [currentSpeed, setCurrentSpeed] = React.useState(1.0);

  React.useEffect(() => {
    try {
      const audio = PlaybackService.getInstance().getActiveAudio();
      if (audio && audio.playbackRate) {
        setCurrentSpeed(audio.playbackRate);
      }
    } catch {}
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectSpeed = (speed: number) => {
    setCurrentSpeed(speed);
    try {
      const audio = PlaybackService.getInstance().getActiveAudio();
      if (audio) {
        audio.playbackRate = speed;
      }
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xs rounded-3xl bg-[#10121A]/95 border border-white/15 p-5 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Playback Speed</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-1.5">
          {SPEED_OPTIONS.map((spd) => (
            <button
              key={spd}
              onClick={() => handleSelectSpeed(spd)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                currentSpeed === spd
                  ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{spd === 1.0 ? '1.0x (Normal)' : `${spd}x`}</span>
              {currentSpeed === spd && <Check className="w-3.5 h-3.5 text-purple-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
