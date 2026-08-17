'use client';

import React from 'react';
import Link from 'next/link';
import { Music, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 text-white select-none">
      <div className="w-16 h-16 rounded-3xl bg-[#FA233B]/20 text-[#FA233B] flex items-center justify-center mb-4 border border-[#FA233B]/30 shadow-xl">
        <Music className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-black mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        The track, playlist, or view you are looking for does not exist or has been moved.
      </p>
      <Link 
        href="/"
        className="px-5 py-2.5 rounded-2xl bg-[#FA233B] hover:bg-[#d91e32] text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>
    </div>
  );
}
