'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Flame, Calendar, Clock, ChevronRight, Sparkles, Award } from 'lucide-react';
import { RecapEngine, MusicRecapData } from '@/lib/recap/RecapEngine';
import { RecapStoryModal } from '@/components/modals/RecapStoryModal';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';

export function RecapHistoryView() {
  const { setActiveTab } = usePlayerStore();
  const { user } = useAuthStore();
  
  const [historyGroups, setHistoryGroups] = useState<{ year: number; recaps: MusicRecapData[] }[]>([]);
  const [selectedRecap, setSelectedRecap] = useState<MusicRecapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    RecapEngine.getInstance()
      .getAllRecapsHistory(user?.id || 'guest')
      .then((res) => {
        setHistoryGroups(res);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [user?.id]);

  return (
    <div className="space-y-6 pb-12 select-none pt-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveTab('profile')}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Flame className="w-6 h-6 text-[#fa233b]" /> Music Recaps & Wrapped
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Your personal listening journeys across weeks, months, quarters, and years.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-3xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : historyGroups.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No Completed Recaps Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Recaps are generated automatically at the end of completed weeks, months, quarters, and years. Keep listening to build your story!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {historyGroups.map((group) => (
            <div key={group.year} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="text-lg font-black text-white tracking-tight">{group.year}</span>
                <span className="text-xs font-semibold text-slate-500">• {group.recaps.length} recaps</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.recaps.map((recap) => (
                  <div
                    key={recap.id}
                    onClick={() => setSelectedRecap(recap)}
                    className="p-4 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 hover:border-[#fa233b]/40 hover:shadow-lg transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[#fa233b]/15 border border-[#fa233b]/30 flex items-center justify-center flex-shrink-0 text-[#fa233b] group-hover:scale-105 transition-transform">
                        {recap.type === 'yearly' ? (
                          <Award className="w-6 h-6" />
                        ) : (
                          <Clock className="w-6 h-6" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] font-bold uppercase tracking-wider text-slate-300">
                          {recap.type}
                        </span>
                        <h4 className="text-sm font-bold text-white truncate mt-1 group-hover:text-[#fa233b] transition-colors">
                          {recap.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {recap.periodLabel} • {recap.totalListeningDisplay}
                        </p>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-[#fa233b] text-slate-400 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRecap && (
        <RecapStoryModal
          recap={selectedRecap}
          isOpen={Boolean(selectedRecap)}
          onClose={() => setSelectedRecap(null)}
        />
      )}
    </div>
  );
}
