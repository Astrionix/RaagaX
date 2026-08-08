'use client';

import React, { useState, useEffect } from 'react';
import { Disc3, Check, Globe, User, X, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/context/useAuthStore';
import { supabase } from '@/lib/supabase';

export function OnboardingAuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, user } = useAuthStore();
  const [selectedLanguage, setSelectedLanguage] = useState<'Telugu' | 'English' | 'Hindi' | 'Tamil'>('Telugu');
  
  // mode: 'welcome' | 'login' | 'register'
  const [mode, setMode] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check if onboarding was completed previously (for auto-popup)
  useEffect(() => {
    const hasCompleted = localStorage.getItem('raagax_onboarding_done');
    if (!hasCompleted && !user) {
      setAuthModalOpen(true);
    }
  }, [user, setAuthModalOpen]);

  // If user is logged in successfully, close modal
  useEffect(() => {
    if (user && isAuthModalOpen) {
      setAuthModalOpen(false);
    }
  }, [user, isAuthModalOpen, setAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleGuestContinue = () => {
    localStorage.setItem('raagax_onboarding_done', 'true');
    localStorage.setItem('raagax_lang', selectedLanguage);
    setAuthModalOpen(false);
  };

  const handleAuth = async () => {
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // On success, Supabase might require email confirmation, but usually signs them in immediately if disabled
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      
      localStorage.setItem('raagax_onboarding_done', 'true');
      localStorage.setItem('raagax_lang', selectedLanguage);
      // Let the onAuthStateChange in useAuthStore handle the closing and reloading
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 text-white select-none animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#161618] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
        <button
          onClick={() => setAuthModalOpen(false)}
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
            320kbps Lossless Audio • AI DJ • Cross-Device Sync
          </p>
        </div>

        {mode === 'welcome' && (
          <div className="space-y-6">
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

            <div className="space-y-3 pt-2">
              <button
                onClick={() => setMode('register')}
                className="w-full py-3.5 rounded-2xl bg-[#EF233C] text-white font-extrabold text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Create Free Account
              </button>
              <button
                onClick={() => setMode('login')}
                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 font-bold text-xs border border-white/10 transition-colors"
              >
                Log In
              </button>
              <button
                onClick={handleGuestContinue}
                className="w-full text-center text-xs font-medium text-slate-500 hover:text-white pt-2 transition-colors"
              >
                Continue as Guest
              </button>
            </div>
          </div>
        )}

        {(mode === 'login' || mode === 'register') && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-[#EF233C]" /> {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h3>
            
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-medium text-center">
                {errorMsg}
              </div>
            )}

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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-3 px-4 bg-[#1C1C1E] border border-white/10 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#EF233C]"
            />

            <button
              onClick={handleAuth}
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-[#EF233C] text-white font-extrabold text-sm shadow-xl hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>

            <button
              onClick={() => setMode('welcome')}
              className="w-full text-center text-xs font-medium text-slate-400 hover:text-white pt-2"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
