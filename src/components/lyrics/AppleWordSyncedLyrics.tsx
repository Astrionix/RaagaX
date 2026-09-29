'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Languages,
  RotateCcw,
  Sparkles,
  Loader2,
  Check,
  ChevronDown,
  Volume2,
} from 'lucide-react';
import { useLyricsStore } from '@/context/useLyricsStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LyricsLine } from '@/lib/lyrics/LyricsTypes';
import {
  LyricsTranslationClient,
  SUPPORTED_LANGUAGES,
} from '@/lib/lyrics/LyricsTranslationClient';
import { ParticleDriftCanvas } from './ParticleDriftCanvas';

interface AppleWordSyncedLyricsProps {
  className?: string;
  isExpandedView?: boolean;
}

export function AppleWordSyncedLyrics({
  className = '',
  isExpandedView = true,
}: AppleWordSyncedLyricsProps) {
  const { lines, status, currentLineIndex } = useLyricsStore();
  const { currentSong, currentTime, duration, setCurrentTime, setSeekTarget, isPlaying } = usePlayerStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isManualScroll, setIsManualScroll] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Translation State
  const [isTranslated, setIsTranslated] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedLines, setTranslatedLines] = useState<LyricsLine[]>([]);
  const [sourceLang, setSourceLang] = useState('auto');
  const [particleTrigger, setParticleTrigger] = useState(0);

  // Active lines to display (original or translated)
  const displayLines = useMemo(() => {
    if (isTranslated && translatedLines.length > 0) {
      return translatedLines;
    }
    return lines;
  }, [isTranslated, translatedLines, lines]);

  // Reset translation when song changes
  useEffect(() => {
    setIsTranslated(false);
    setTranslatedLines([]);
    setSourceLang('auto');
  }, [currentSong?.id]);

  // Handle translation fetch
  const handleToggleTranslation = async (langCode: string = selectedLang) => {
    if (isTranslated && langCode === selectedLang) {
      // Toggle back to original with particle burst
      setParticleTrigger((prev) => prev + 1);
      setIsTranslated(false);
      return;
    }

    if (lines.length === 0) return;

    setTranslating(true);
    setParticleTrigger((prev) => prev + 1);

    const rawTexts = lines.map((l) => l.text);
    const result = await LyricsTranslationClient.getInstance().translateLyrics(
      rawTexts,
      langCode,
      sourceLang === 'auto' ? undefined : sourceLang
    );

    if (result.status === 'success' && result.translatedLines.length > 0) {
      const mapped: LyricsLine[] = lines.map((line, idx) => ({
        ...line,
        text: result.translatedLines[idx] || line.text,
      }));
      setTranslatedLines(mapped);
      setIsTranslated(true);
      setSelectedLang(langCode);
      if (result.sourceLanguage) setSourceLang(result.sourceLanguage);
    }

    setTranslating(false);
  };

  // Center active line smoothly
  useEffect(() => {
    if (isManualScroll || currentLineIndex < 0 || displayLines.length === 0) return;

    const activeEl = document.getElementById(`apple-lyric-line-${currentLineIndex}`);
    if (activeEl && containerRef.current) {
      const container = containerRef.current;
      const elementTop = activeEl.offsetTop;
      const elementHeight = activeEl.clientHeight;
      const containerHeight = container.clientHeight;
      const targetScroll = elementTop - containerHeight / 2 + elementHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [currentLineIndex, isManualScroll, displayLines]);

  // Detect user scroll
  const handleUserScroll = () => {
    setIsManualScroll(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsManualScroll(false);
    }, 3500);
  };

  // Re-sync to active
  const handleSyncToCurrent = () => {
    setIsManualScroll(false);
    if (currentLineIndex >= 0) {
      const activeEl = document.getElementById(`apple-lyric-line-${currentLineIndex}`);
      if (activeEl && containerRef.current) {
        const container = containerRef.current;
        const targetScroll =
          activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      }
    }
  };

  // Line click seek
  const handleLineClick = (line: LyricsLine) => {
    if (line.startMs !== undefined && line.startMs >= 0) {
      const sec = line.startMs / 1000;
      setCurrentTime(sec, true);
      setSeekTarget(sec);
      setIsManualScroll(false);
    }
  };

  const currentMs = currentTime * 1000;

  return (
    <div className={`relative flex flex-col w-full h-full overflow-hidden ${className}`}>
      {/* 540ms Particle Drift Canvas */}
      <ParticleDriftCanvas triggerKey={particleTrigger} durationMs={540} />

      {/* Top Header / Translation Controls Bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-black/20 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full raaga-glass-pill text-xs font-medium text-white/90 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isTranslated ? 'Translated' : 'Original Lyrics'}</span>
            <span className="text-white/40 text-[10px] uppercase font-mono ml-1">
              • Synced
            </span>
          </div>
        </div>

        {/* Translation & Sync Actions */}
        <div className="flex items-center gap-2 relative">
          {/* Snap Back Sync Button */}
          {isManualScroll && (
            <button
              onClick={handleSyncToCurrent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all active:scale-95 shadow-md"
              title="Sync to current playback"
            >
              <RotateCcw className="w-3 h-3 animate-spin-reverse" />
              <span>Sync</span>
            </button>
          )}

          {/* Translation Toggle & Language Menu */}
          <div className="relative">
            <div className="flex items-center rounded-full bg-white/10 border border-white/15 p-0.5 shadow-sm">
              <button
                onClick={() => handleToggleTranslation(selectedLang)}
                disabled={translating || lines.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  isTranslated
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {translating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )}
                <span>{isTranslated ? 'Original' : 'Translate'}</span>
              </button>

              <button
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="px-1.5 py-1 text-white/60 hover:text-white transition-colors"
                title="Select language"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Language Selector Dropdown */}
            {isLangDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 max-h-64 overflow-y-auto rounded-2xl bg-[#12151E]/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 z-50">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-3 py-1.5">
                  Translate to
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setIsLangDropdownOpen(false);
                      handleToggleTranslation(lang.code);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      selectedLang === lang.code && isTranslated
                        ? 'bg-blue-600/30 text-blue-300 font-semibold'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>
                      {lang.name}{' '}
                      <span className="text-white/40 text-[11px]">({lang.native})</span>
                    </span>
                    {selectedLang === lang.code && isTranslated && (
                      <Check className="w-3.5 h-3.5 text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Lyrics Scroll Area */}
      <div
        ref={containerRef}
        onScroll={handleUserScroll}
        className="flex-1 overflow-y-auto px-6 sm:px-12 py-16 scroll-smooth select-none no-scrollbar"
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-white/60 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-white/80" />
            <p className="text-sm font-medium">Fetching synced lyrics...</p>
          </div>
        )}

        {status !== 'loading' && displayLines.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-white/50 text-center gap-3">
            <Sparkles className="w-10 h-10 text-white/30" />
            <p className="text-base font-semibold text-white/70">No synced lyrics available</p>
            <p className="text-xs text-white/40 max-w-xs">
              Enjoy the rhythm and high-resolution stream of {currentSong?.title || 'this track'}.
            </p>
          </div>
        )}

        {displayLines.map((line, idx) => {
          const isActive = idx === currentLineIndex;
          const isPast = idx < currentLineIndex;
          const isFuture = idx > currentLineIndex;

          // Detect backing vocal (enclosed in parentheses or brackets)
          const isBackingVocal =
            line.text.trim().startsWith('(') && line.text.trim().endsWith(')');

          // Split words for progressive sweep highlight on active line
          const words = line.text.split(/(\s+)/);
          const lineDuration =
            line.endMs && line.endMs > line.startMs
              ? line.endMs - line.startMs
              : 3500;
          const lineProgress = Math.max(
            0,
            Math.min(1, (currentMs - line.startMs) / lineDuration)
          );

          return (
            <div
              key={line.id || `line-${idx}`}
              id={`apple-lyric-line-${idx}`}
              onClick={() => handleLineClick(line)}
              className={`group relative cursor-pointer my-4 sm:my-6 transition-all duration-500 ease-out origin-left ${
                isBackingVocal ? 'pl-6 sm:pl-8 text-[0.88em]' : ''
              } ${
                isActive
                  ? 'scale-[1.03] opacity-100 z-10'
                  : isPast
                  ? 'opacity-40 hover:opacity-85 blur-[0.4px] hover:blur-none'
                  : 'opacity-30 hover:opacity-75 blur-[0.6px] hover:blur-none'
              }`}
            >
              <p
                className={`font-bold tracking-tight leading-relaxed transition-all duration-300 ${
                  isExpandedView
                    ? isBackingVocal
                      ? 'text-xl sm:text-2xl italic font-semibold text-white/70'
                      : 'text-2xl sm:text-4xl text-white'
                    : 'text-lg sm:text-xl text-white'
                }`}
              >
                {isActive ? (
                  // Progressive word-by-word karaoke sweep on the active line
                  words.map((chunk, cIdx) => {
                    const wordProgressThreshold = cIdx / words.length;
                    const isSung = lineProgress >= wordProgressThreshold;

                    return (
                      <span
                        key={cIdx}
                        className={`transition-all duration-200 inline-block ${
                          isSung
                            ? 'text-white lyric-sweep-glow font-extrabold'
                            : 'text-white/45 font-medium'
                        }`}
                      >
                        {chunk}
                      </span>
                    );
                  })
                ) : (
                  <span>{line.text}</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
