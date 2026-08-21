'use client';

import React, { useState, useEffect } from 'react';
import { 
  Check, ArrowRight, Sparkles, Music, Radio, 
  Flame, Tv, Heart, ShieldCheck, ChevronLeft, Disc3,
  User, Lock, Sparkle, Layers
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { haptics } from '@/lib/haptics/HapticEngine';

export interface LanguageOption {
  id: string;
  name: string;
  nativeName: string;
}

export const MUSIC_LANGUAGES: LanguageOption[] = [
  { id: 'Telugu', name: 'Telugu', nativeName: 'తెలుగు' },
  { id: 'Hindi', name: 'Hindi', nativeName: 'हिन्दी' },
  { id: 'Tamil', name: 'Tamil', nativeName: 'தமிழ்' },
  { id: 'Kannada', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { id: 'Malayalam', name: 'Malayalam', nativeName: 'മലയാളം' },
  { id: 'English', name: 'English', nativeName: 'Global' },
  { id: 'Punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { id: 'Bengali', name: 'Bengali', nativeName: 'বাংলা' },
  { id: 'Marathi', name: 'Marathi', nativeName: 'मराठी' },
  { id: 'Gujarati', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { id: 'Bhojpuri', name: 'Bhojpuri', nativeName: 'भोजपुरी' },
];

export const MUSIC_INTERESTS = [
  { id: 'Songs', label: 'Songs', icon: '🎵', desc: 'Trending hits, melodies & movie OSTs' },
  { id: 'Radio', label: 'Radio', icon: '📻', desc: 'Live authentic artist & mood web-stations' },
  { id: 'Music Videos', label: 'Music Videos', icon: '🎬', desc: 'Cinema visuals matched directly to audio' },
  { id: 'New Releases', label: 'New Releases', icon: '🔥', desc: 'Fresh daily drops & new artist albums' },
  { id: 'Personalized Music', label: 'Personalized Music', icon: '❤️', desc: 'Made For You mixes & recommendations' },
];

export function LanguageOnboardingModal() {
  const [mounted, setMounted] = useState(false);

  const { 
    isOnboardingOpen, 
    completeOnboarding,
    selectedLanguages: storeLanguages,
    musicInterests: storeInterests,
    setToastMessage
  } = usePlayerStore();

  const { setAuthModalOpen } = useAuthStore();

  // 4 Onboarding Steps: 1 = Welcome, 2 = Languages, 3 = Interests, 4 = Account Choice
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(() => storeLanguages.length > 0 ? storeLanguages : ['Telugu']);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() =>
    storeInterests.length > 0 ? storeInterests : ['Songs', 'Radio', 'New Releases', 'Personalized Music']
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOnboardingOpen) return null;

  const toggleLang = (id: string) => {
    haptics.lightImpact();
    if (selectedLangs.includes(id)) {
      if (selectedLangs.length === 1) {
        setToastMessage('Please select at least 1 language');
        return;
      }
      setSelectedLangs(selectedLangs.filter(l => l !== id));
    } else {
      setSelectedLangs([...selectedLangs, id]);
    }
  };

  const toggleInterest = (id: string) => {
    haptics.lightImpact();
    if (selectedInterests.includes(id)) {
      if (selectedInterests.length === 1) {
        setToastMessage('Please select at least 1 interest');
        return;
      }
      setSelectedInterests(selectedInterests.filter(i => i !== id));
    } else {
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const handleContinueAsGuest = () => {
    haptics.mediumImpact();
    completeOnboarding(selectedLangs, selectedInterests);
    setToastMessage(`Welcome to RaagaX! Exploring as Guest with local library.`);
  };

  const handleSignUpLogin = () => {
    haptics.mediumImpact();
    completeOnboarding(selectedLangs, selectedInterests);
    setAuthModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300 select-none">
      {/* Dynamic Ambient Background Illumination */}
      <div className="absolute w-96 h-96 rounded-full bg-[#FA233B]/20 blur-[130px] pointer-events-none -top-10 -left-10" />
      <div className="absolute w-96 h-96 rounded-full bg-purple-600/20 blur-[130px] pointer-events-none -bottom-10 -right-10" />

      {/* Main Glassmorphic Container Card */}
      <div className="relative w-full max-w-xl lens-crystal border border-white/18 rounded-[36px] shadow-[0_30px_100px_rgba(0,0,0,0.95)] flex flex-col max-h-[92dvh] overflow-hidden text-white z-10 animate-in zoom-in-95 duration-200">
        
        {/* Specular Edge Line */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

        {/* Step Indicator Header */}
        <div className="px-6 pt-5 pb-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => (s - 1) as any)}
                className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Back to Previous Step"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    step >= i ? 'bg-[#FA233B]' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider ml-1">
              Step {step} of 4
            </span>
          </div>

          <span className="text-xs font-bold text-[#FA233B] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> RaagaX Setup
          </span>
        </div>

        {/* ── STEP 1: WELCOME SCREEN ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 flex flex-col justify-center items-center text-center animate-in fade-in">
            {/* 3D Glass Logo Icon */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-white/15 via-white/5 to-white/0 border border-white/25 shadow-[0_12px_40px_rgba(250,35,59,0.35)] flex items-center justify-center p-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FA233B] flex items-center justify-center shadow-lg shadow-red-500/40">
                <Disc3 className="w-7 h-7 text-white animate-spin [animation-duration:8s]" />
              </div>
            </div>

            <div className="space-y-2 max-w-md">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome to RaagaX
              </h1>
              <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
                Your music. Your language. <br className="hidden sm:inline" />
                Your way.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full pt-2 text-left">
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-base">💎</span>
                <h4 className="text-xs font-bold text-white mt-1">Lossless Audio</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">High-fidelity 320kbps master quality</p>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-base">⚡</span>
                <h4 className="text-xs font-bold text-white mt-1">Connect Sync</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">0ms cross-device handover</p>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-base">📱</span>
                <h4 className="text-xs font-bold text-white mt-1">Mobile Offline</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Device library with guest merge</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: CHOOSE LANGUAGES ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1 animate-in fade-in">
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                What languages do you listen to?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Select one or more languages to tailor your discovery, albums, and radio.
              </p>
            </div>

            {/* Language Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {MUSIC_LANGUAGES.map((lang) => {
                const isSelected = selectedLangs.includes(lang.id);

                return (
                  <div
                    key={lang.id}
                    onClick={() => toggleLang(lang.id)}
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-22 overflow-hidden group active:scale-[0.98] ${
                      isSelected
                        ? 'bg-gradient-to-br from-white/15 to-white/5 border-[#FA233B] shadow-[0_4px_20px_rgba(250,35,59,0.3)]'
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-white/20 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200">
                        {lang.nativeName}
                      </span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-[#FA233B] text-white shadow-md' 
                          : 'border border-white/30 group-hover:border-white/60'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div>
                      <h3 className={`text-sm font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {lang.name}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 3: CHOOSE INTERESTS ──────────────────────────────────────── */}
        {step === 3 && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1 animate-in fade-in">
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                What do you want to listen to?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Choose the audio experiences you enjoy most to populate your Home feed.
              </p>
            </div>

            {/* Interests List */}
            <div className="space-y-2.5 pt-1">
              {MUSIC_INTERESTS.map((interest) => {
                const isSelected = selectedInterests.includes(interest.id);

                return (
                  <div
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98] ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#FA233B]/20 to-purple-800/20 border-[#FA233B]/70 shadow-[0_4px_20px_rgba(250,35,59,0.25)]'
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-white/20 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{interest.icon}</span>
                      <div className="min-w-0">
                        <h4 className={`text-sm font-black truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {interest.label}
                        </h4>
                        <p className="text-xs text-slate-400 truncate">
                          {interest.desc}
                        </p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0 ml-2 ${
                      isSelected 
                        ? 'bg-[#FA233B] text-white shadow-md' 
                        : 'border border-white/30 group-hover:border-white/60'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 4: ACCOUNT CHOICE (GUEST VS SIGN UP) ────────────────────── */}
        {step === 4 && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 flex flex-col justify-center items-center text-center animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-[#FA233B]/20 border border-[#FA233B]/40 flex items-center justify-center text-[#FA233B]">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-md">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Ready to listen?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Enjoy complete local playback without an account, or create an account for automatic cloud synchronization across your devices.
              </p>
            </div>

            {/* Account Choice Action Buttons */}
            <div className="w-full max-w-sm space-y-3 pt-2">
              <button
                onClick={handleContinueAsGuest}
                className="w-full py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/15 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4 text-slate-300" />
                <span>Continue as Guest</span>
              </button>

              <button
                onClick={handleSignUpLogin}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#FA233B] hover:bg-[#d91e32] text-white font-black text-sm shadow-xl shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Sign Up / Log In</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 max-w-xs leading-tight">
              ⭐ <strong>Guest to Account Merge:</strong> Liked songs, playlists, and history created as a guest will automatically follow you when you log in later.
            </p>
          </div>
        )}

        {/* ── BOTTOM ACTION BAR (Steps 1–3) ────────────────────────────────── */}
        {step < 4 && (
          <div className="px-6 py-4 bg-black/40 border-t border-white/10 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {step === 1 ? (
                <span>RaagaX Core Onboarding</span>
              ) : step === 2 ? (
                <span><strong className="text-white">{selectedLangs.length}</strong> selected</span>
              ) : (
                <span><strong className="text-white">{selectedInterests.length}</strong> selected</span>
              )}
            </div>

            <button
              onClick={() => {
                haptics.mediumImpact();
                setStep((s) => (s + 1) as any);
              }}
              className="px-6 py-2.5 rounded-2xl bg-[#FA233B] hover:bg-[#d91e32] text-white text-xs font-black shadow-lg shadow-red-500/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
