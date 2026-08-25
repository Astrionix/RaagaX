'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 text-white select-none">
      <div className="w-16 h-16 rounded-3xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4 border border-red-500/30 shadow-xl">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-black mb-2">Something went wrong</h2>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        {error.message || 'An unexpected playback or application error occurred.'}
      </p>
      <button
        onClick={() => reset()}
        className="px-5 py-2.5 rounded-2xl bg-[#FA233B] hover:bg-[#d91e32] text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" /> Try Again
      </button>
    </div>
  );
}
