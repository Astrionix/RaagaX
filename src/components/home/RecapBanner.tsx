'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, X, Flame } from 'lucide-react';
import { RecapEngine, MusicRecapData } from '@/lib/recap/RecapEngine';
import { RecapStoryModal } from '@/components/modals/RecapStoryModal';
import { useAuthStore } from '@/context/useAuthStore';

export function RecapBanner() {
  const { user } = useAuthStore();
  const [activeRecap, setActiveRecap] = useState<MusicRecapData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    RecapEngine.getInstance()
      .getActiveRecapBanner(user?.id || 'guest')
      .then((recap) => {
        if (!isCancelled && recap && recap.hasData) {
          setActiveRecap(recap);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  if (!activeRecap || !activeRecap.hasData || isDismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    RecapEngine.getInstance().markAsDismissed(activeRecap.id);
  };

  return (
    <>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="group relative overflow-hidden rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-red-50/90 via-white to-purple-50/90 dark:from-[#1b0d18] dark:via-[#161224] dark:to-[#0d1424] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-2xl transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#fa233b]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] transition-colors z-20 cursor-pointer"
          aria-label="Dismiss recap banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 pr-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#fa233b] to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/20 border border-white/20">
              <Flame className="w-5 h-5 text-white" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#fa233b]/15 border border-[#fa233b]/30 text-[9px] font-extrabold uppercase tracking-wider text-[#fa233b]">
                  {activeRecap.type.toUpperCase()} RECAP
                </span>
                <span className="text-[11px] font-semibold text-[var(--text-muted)] truncate">
                  {activeRecap.periodLabel}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)] tracking-tight mt-0.5">
                {activeRecap.bannerTitle}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-bold text-[var(--text-muted)] hidden md:inline">
              {activeRecap.totalListeningDisplay} listened
            </span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#fa233b] hover:bg-[#d91e32] text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span>View Story</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <RecapStoryModal
          recap={activeRecap}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
