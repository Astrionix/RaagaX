import React, { useEffect, useState } from 'react';
import { useDownloadStore } from '@/context/useDownloadStore';
import { Download, Check, Settings, X, HardDrive } from 'lucide-react';

export function OfflineStorageSetupModal({ 
  isOpen, 
  onClose, 
  onComplete 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onComplete: () => void; 
}) {
  const { setOfflineStorageEnabled } = useDownloadStore();
  const [step, setStep] = useState(1);
  const [storageAvailable, setStorageAvailable] = useState('...');
  const [setupProgress, setSetupProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSetupProgress(0);
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((estimate) => {
          const quota = estimate.quota || 0;
          if (quota > 0) {
            setStorageAvailable((quota / (1024 ** 3)).toFixed(1) + ' GB');
          }
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnable = () => {
    setStep(2);
    // Simulate setup tasks
    setTimeout(() => setSetupProgress(33), 400); // Checking device storage
    setTimeout(() => setSetupProgress(66), 900); // Preparing offline library
    setTimeout(() => setSetupProgress(100), 1400); // Checking available capacity
    setTimeout(() => {
      setStep(3);
    }, 1800);
  };

  const handleFinish = () => {
    setOfflineStorageEnabled(true);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="bg-[#161618] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        
        {step === 1 && (
          <div className="p-6 flex flex-col gap-6">
            <div className="w-12 h-12 bg-[#fa233b]/10 rounded-full flex items-center justify-center self-center mb-2">
              <Download className="w-6 h-6 text-[#fa233b]" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Offline Music</h2>
              <p className="text-sm text-slate-400">
                Take your music with you. Download songs, albums and playlists for listening without an internet connection.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2 uppercase tracking-wider">
                <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> Device Storage</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-sm font-bold text-white">Available</span>
                <span className="text-sm text-slate-300 ml-auto">{storageAvailable}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                RaagaX will use storage only for music you explicitly choose to download.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <button
                onClick={handleEnable}
                className="w-full py-3.5 rounded-full bg-white text-black font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
              >
                Enable Offline Storage
              </button>
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-full text-slate-400 hover:text-white font-bold text-sm transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 flex flex-col gap-6 items-center text-center">
            <h2 className="text-lg font-bold text-white mb-2">Setting up offline storage...</h2>
            
            <div className="w-full space-y-4 text-sm font-medium text-slate-400 text-left px-4">
              <div className="flex items-center justify-between">
                <span>Checking device storage</span>
                {setupProgress >= 33 && <Check className="w-4 h-4 text-emerald-500" />}
              </div>
              <div className="flex items-center justify-between">
                <span>Preparing offline library</span>
                {setupProgress >= 66 && <Check className="w-4 h-4 text-emerald-500" />}
              </div>
              <div className="flex items-center justify-between">
                <span>Checking available capacity</span>
                {setupProgress >= 100 && <Check className="w-4 h-4 text-emerald-500" />}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 flex flex-col gap-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center self-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Offline listening is ready</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                You can now download music and listen without an internet connection.
              </p>
            </div>

            <button
              onClick={handleFinish}
              className="w-full mt-4 py-3.5 rounded-full bg-[#fa233b] text-white font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
            >
              Start Downloading
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
