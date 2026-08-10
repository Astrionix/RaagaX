'use client';

import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

const CURRENT_APP_VERSION = '1.0.0'; // Change this when building a new APK

export function AppUpdateModal() {
  const [updateData, setUpdateData] = useState<{
    latestVersion: string;
    downloadUrl: string;
    releaseNotes: string;
    forceUpdate: boolean;
  } | null>(null);
  
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only check for updates if we are likely inside the Android App (e.g., standalone PWA/TWA mode)
    // or just check on mobile devices.
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    // Check once on mount
    if (isAndroid || isStandalone) {
      fetch('/api/app-update')
        .then(res => res.json())
        .then(data => {
          if (data && data.latestVersion && data.latestVersion > CURRENT_APP_VERSION) {
            setUpdateData(data);
            setIsOpen(true);
          }
        })
        .catch(console.error);
    }
  }, []);

  if (!isOpen || !updateData) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#161618] border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center text-center shadow-2xl animate-in fade-in zoom-in duration-300 relative">
        
        <div className="w-16 h-16 bg-[#fa233b]/20 text-[#fa233b] rounded-full flex items-center justify-center mb-4">
          <RefreshCw className="w-8 h-8 animate-spin-slow" />
        </div>
        
        <h2 className="text-xl font-black text-white mb-1 tracking-tight">Update Available!</h2>
        <div className="bg-white/5 text-slate-300 text-xs font-bold px-2 py-1 rounded-md mb-4">
          Version {updateData.latestVersion}
        </div>
        
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          {updateData.releaseNotes}
        </p>
        
        <div className="flex flex-col gap-3 w-full">
          <button 
            onClick={() => {
              window.location.href = updateData.downloadUrl;
            }}
            className="w-full py-3.5 bg-[#fa233b] hover:bg-[#d91e32] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download Update
          </button>
          
          {!updateData.forceUpdate && (
            <button 
              onClick={() => setIsOpen(false)}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
            >
              Later
            </button>
          )}
        </div>
        
        {!updateData.forceUpdate && (
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
