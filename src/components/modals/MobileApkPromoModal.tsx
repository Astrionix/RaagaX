'use client';

import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export function MobileApkPromoModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if device is Android and if user hasn't dismissed the prompt
    const isAndroid = /Android/i.test(navigator.userAgent);
    const hasDismissed = localStorage.getItem('raagax_apk_dismissed');

    if (isAndroid && !hasDismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('raagax_apk_dismissed', 'true');
    setIsOpen(false);
  };

  const handleDownload = () => {
    // User clicked download, we can also dismiss it for future visits
    localStorage.setItem('raagax_apk_dismissed', 'true');
    setIsOpen(false);
    
    // Trigger download
    // Ensure you place your actual RaagaX.apk in the /public folder or replace this URL
    window.location.href = '/RaagaX.apk'; 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#161618] border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center text-center shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-[#fa233b]/20 text-[#fa233b] rounded-full flex items-center justify-center mb-4">
          <Smartphone className="w-8 h-8" />
        </div>
        
        <h2 className="text-xl font-black text-white mb-2 tracking-tight">Get the RaagaX App</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          For the best, uninterrupted ad-free music experience, download the official RaagaX Android App.
        </p>
        
        <div className="flex flex-col gap-3 w-full">
          <button 
            onClick={handleDownload}
            className="w-full py-3.5 bg-[#fa233b] hover:bg-[#d91e32] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download APK
          </button>
          
          <button 
            onClick={handleDismiss}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
          >
            Continue in Browser
          </button>
        </div>
        
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
