'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Search, Loader2, X, Sparkles } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

interface TVVoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TVVoiceSearchModal({ isOpen, onClose }: TVVoiceSearchModalProps) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { setActiveTab } = usePlayerStore();

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Voice search is not supported on this browser/TV browser engine.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        const text = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setTranscript(text);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        setErrorMessage(`Voice error: ${event.error || 'Please speak clearly'}`);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setErrorMessage(err?.message || 'Failed to start microphone');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setErrorMessage(null);
      startListening();
    }
  }, [isOpen, startListening]);

  const handleSearchSubmit = () => {
    if (!transcript.trim()) return;
    setActiveTab('search');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10030] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-8 select-none animate-in fade-in duration-300">
      <div className="bg-white/10 border border-white/15 backdrop-blur-3xl rounded-3xl p-8 sm:p-12 w-full max-w-2xl text-center space-y-8 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative text-white">
        {/* Close Button */}
        <button
          data-tv-focusable="true"
          onClick={onClose}
          className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all cursor-pointer"
          aria-label="Close Voice Search"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Pulsing Mic Visualizer */}
        <div className="relative flex items-center justify-center">
          <button
            data-tv-focusable="true"
            onClick={startListening}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xl ${
              isListening
                ? 'bg-[#fa233b] text-white scale-110 shadow-red-500/50 animate-pulse'
                : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
          >
            {isListening ? <Mic className="w-14 h-14" /> : <MicOff className="w-14 h-14" />}
          </button>
          {isListening && (
            <div className="absolute -inset-6 rounded-full bg-[#fa233b]/20 blur-3xl -z-10 animate-ping" />
          )}
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {isListening ? 'Listening... Speak Now' : 'Tap Mic to Try Again'}
          </h2>
          <p className="text-sm font-medium text-white/60 mt-1">Say a song, artist, album, or playlist name</p>
        </div>

        {/* Live Transcript Display */}
        <div className="min-h-[60px] bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-center text-xl sm:text-2xl font-bold text-[#fa233b]">
          {transcript ? `"${transcript}"` : <span className="text-white/30 italic">e.g. "Telugu Hit Songs", "Sid Sriram"</span>}
        </div>

        {errorMessage && (
          <p className="text-xs text-rose-400 font-semibold">{errorMessage}</p>
        )}

        {/* Submit Action */}
        <div className="flex justify-center gap-4">
          <button
            data-tv-focusable="true"
            onClick={handleSearchSubmit}
            disabled={!transcript.trim()}
            className="px-8 py-3.5 bg-[#fa233b] hover:bg-[#d91e32] disabled:opacity-40 rounded-2xl font-black text-sm text-white shadow-xl shadow-red-500/30 flex items-center gap-2 cursor-pointer"
          >
            <Search className="w-5 h-5" />
            <span>Search "{transcript || 'Music'}"</span>
          </button>
        </div>
      </div>
    </div>
  );
}
