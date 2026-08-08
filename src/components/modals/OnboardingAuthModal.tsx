'use client';

import React, { useState } from 'react';
import { Disc3, Check, Globe, Sparkles, Shield, User, X } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function OnboardingAuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'Telugu' | 'English' | 'Hindi' | 'Tamil'>('Telugu');
  const [mode, setMode] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');

  // Check if onboarding was completed previously
  React.useEffect(() => {
    const hasCompleted = localStorage.getItem('raagax_onboarding_done');
    if (!hasCompleted) {
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleComplete = () => {
    localStorage.setItem('raagax_onboarding_done', 'true');
    localStorage.setItem('raagax_lang', selectedLanguage);
    if (userName) {
      localStorage.setItem('raagax_username', userName);
    }
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 text-white select-none animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#161618] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
        <button
          onClick={handleComplete}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-3 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-[#EF233C] flex items-center justify-center mx-auto shadow-xl shadow-red-500/20">
            <Disc3 className="w-8 h-8 text-white animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Welcome to RaagaX</h2>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
            320kbps Lossless Audio • AI DJ • Immersive 3D Spatial Sound
          </p>
        </div>

        {mode === 'welcome' && (
          <div className="space-y-6">
            {/* Preferred Language Selection */}
            <div className="space-y-3">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#EF233C]" /> Select Preferred Music Language
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['Telugu', 'English', 'Hindi', 'Tamil'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`py-3 px-4 rounded-2xl font-extrabold text-xs flex items-center justify-between transition-all border ${
                      selectedLanguage === lang
                        ? 'bg-[#EF233C] text-white border-red-400 shadow-lg shadow-red-500/20 scale-102'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                    }`}
                  >
                    <span>{lang}</span>
                    {selectedLanguage === lang && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Guest / Login Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleComplete}
                className="w-full py-3.5 rounded-2xl bg-[#EF233C] text-white font-extrabold text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Start Listening (Guest Mode)
              </button>
              <button
                onClick={() => setMode('login')}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs border border-white/10 transition-colors"
              >
                Sign In to RaagaX Account
              </button>
            </div>
          </div>
        )}

        {mode === 'login' && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-[#EF233C]" /> Sign In
            </h3>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full py-3 px-4 bg-[#1C1C1E] border border-white/10 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#EF233C]"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full py-3 px-4 bg-[#1C1C1E] border border-white/10 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#EF233C]"
            />

            <button
              onClick={handleComplete}
              className="w-full py-3.5 rounded-2xl bg-[#EF233C] text-white font-extrabold text-sm shadow-xl hover:scale-[1.02] transition-transform"
            >
              Sign In
            </button>

            <button
              onClick={() => setMode('welcome')}
              className="w-full text-center text-xs text-slate-400 hover:text-white pt-2"
            >
              ← Back to Language Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
