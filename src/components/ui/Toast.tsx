'use client';

import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CheckCircle2 } from 'lucide-react';

export function Toast() {
  const { toastMessage, setToastMessage } = usePlayerStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Add a slight delay before clearing the message so it animates out
        setTimeout(() => setToastMessage(null), 300);
      }, 3000); // 3 seconds display
      return () => clearTimeout(timer);
    }
  }, [toastMessage, setToastMessage]);

  if (!toastMessage && !isVisible) return null;

  return (
    <div className="fixed bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 z-[150] pointer-events-none">
      <div 
        className={`bg-[#26262A] text-white px-5 py-3 rounded-full shadow-2xl border border-white/10 flex items-center gap-3 transition-all duration-300 transform ${
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <span className="text-sm font-bold tracking-tight">{toastMessage}</span>
      </div>
    </div>
  );
}
