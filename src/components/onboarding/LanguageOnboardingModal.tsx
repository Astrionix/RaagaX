'use client';

import React, { useState } from 'react';
import { 
  Check, ArrowRight, Sparkles, Music, Compass, 
  Flame, Radio, Heart, ShieldCheck, ChevronLeft 
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface LanguageOption {
  id: string;
  name: string;
  nativeName: string;
  gradient: string;
}

export const MUSIC_LANGUAGES: LanguageOption[] = [
  { id: 'Telugu', name: 'Telugu', nativeName: 'తెలుగు', gradient: 'from-amber-600 to-red-600' },
  { id: 'Hindi', name: 'Hindi', nativeName: 'हिन्दी', gradient: 'from-orange-600 to-rose-600' },
  { id: 'Tamil', name: 'Tamil', nativeName: 'தமிழ்', gradient: 'from-blue-600 to-indigo-600' },
  { id: 'Kannada', name: 'Kannada', nativeName: 'ಕನ್ನಡ', gradient: 'from-yellow-600 to-red-600' },
  { id: 'Malayalam', name: 'Malayalam', nativeName: 'മലയാളം', gradient: 'from-emerald-600 to-teal-600' },
  { id: 'English', name: 'English', nativeName: 'Global', gradient: 'from-purple-600 to-indigo-600' },
  { id: 'Punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', gradient: 'from-rose-600 to-orange-600' },
  { id: 'Bengali', name: 'Bengali', nativeName: 'বাংলা', gradient: 'from-cyan-600 to-blue-600' },
  { id: 'Marathi', name: 'Marathi', nativeName: 'मराठी', gradient: 'from-amber-600 to-orange-600' },
  { id: 'Gujarati', name: 'Gujarati', nativeName: 'ગુજરાતી', gradient: 'from-violet-600 to-purple-600' },
  { id: 'Bhojpuri', name: 'Bhojpuri', nativeName: 'भोजपुरी', gradient: 'from-red-600 to-pink-600' },
];

export const MUSIC_INTERESTS = [
  { id: 'New Releases', label: 'New Releases', icon: '🚀', desc: 'Fresh drops & new albums' },
  { id: 'Trending Hits', label: 'Trending Hits', icon: '🔥', desc: 'Most played right now' },
  { id: 'Movie Soundtracks', label: 'Movie Soundtracks', icon: '🎬', desc: 'Original scores & cinema OSTs' },
  { id: 'Devotional & Spiritual', label: 'Devotional & Spiritual', icon: '🙏', desc: 'Bhajans, stotrams & peace' },
  { id: 'Indie & Pop', label: 'Indie & Pop', icon: '🎸', desc: 'Independent artists & pop hits' },
  { id: 'Classical & Melodies', label: 'Classical & Melodies', icon: '🎻', desc: 'Evergreen melodies & ragas' },
  { id: 'Lo-Fi & Chill', label: 'Lo-Fi & Chill', icon: '☕', desc: 'Study, focus & late nights' },
  { id: 'Party & Dance', label: 'Party & Dance', icon: '💃', desc: 'Club beats & dance anthems' },
  { id: 'Mass Beats & Energy', label: 'Mass Beats & Energy', icon: '⚡', desc: 'High octane workout pump' },
  { id: 'Acoustic Vibes', label: 'Acoustic Vibes', icon: '🌙', desc: 'Unplugged guitar & vocals' },
];

export function LanguageOnboardingModal() {
  const { 
    isOnboardingOpen, 
    completeOnboarding,
    selectedLanguages: storeLanguages,
    musicInterests: storeInterests,
    setToastMessage
  } = usePlayerStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(() => storeLanguages);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() =>
    storeInterests.length > 0 ? storeInterests : ['New Releases', 'Trending Hits', 'Movie Soundtracks']
  );

  if (!isOnboardingOpen) return null;

  const toggleLang = (id: string) => {
    import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact()).catch(() => {});
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
    import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact()).catch(() => {});
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

  const handleNextStep = () => {
    if (selectedLangs.length === 0) {
      setToastMessage('Please choose at least 1 language to continue');
      return;
    }
    import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact()).catch(() => {});
    setStep(2);
  };

  const handleFinish = () => {
    if (selectedInterests.length === 0) {
      setToastMessage('Please choose at least 1 interest to continue');
      return;
    }
    import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact()).catch(() => {});
    completeOnboarding(selectedLangs, selectedInterests);
    setToastMessage(`Personalized Home ready for ${selectedLangs.join(', ')}!`);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300 select-none">
      
      {/* Background Ambient Glow */}
      <div className="absolute w-96 h-96 rounded-full bg-[#FA233B]/20 blur-[120px] pointer-events-none -top-10 -left-10" />
      <div className="absolute w-96 h-96 rounded-full bg-purple-600/20 blur-[120px] pointer-events-none -bottom-10 -right-10" />

      {/* Main Card Container */}
      <div className="relative w-full max-w-xl lens-crystal border border-white/18 rounded-[36px] shadow-[0_30px_100px_rgba(0,0,0,0.95)] flex flex-col max-h-[92dvh] overflow-hidden text-white z-10 animate-in zoom-in-95 duration-200">
        
        {/* Specular Edge */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

        {/* Progress Bar & Steps Header */}
        <div className="px-6 pt-5 pb-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                title="Back to Step 1"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FA233B]" />
              <span className={`w-2.5 h-2.5 rounded-full transition-colors ${step === 2 ? 'bg-[#FA233B]' : 'bg-white/20'}`} />
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider ml-1">
              Step {step} of 2
            </span>
          </div>

          <span className="text-xs font-bold text-[#FA233B] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> First-Time Setup
          </span>
        </div>

        {/* STEP 1: MUSIC LANGUAGES */}
        {step === 1 && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1 animate-in fade-in">
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
                <span>👋 Welcome to RaagaX</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Select the languages you listen to most. You can change this later in Settings.
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
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-24 overflow-hidden group active:scale-[0.98] ${
                      isSelected
                        ? 'bg-gradient-to-br from-white/15 to-white/5 border-[#FA233B] shadow-[0_4px_20px_rgba(250,35,59,0.3)]'
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-white/20 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Top Native Title & Checkbox */}
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

                    {/* Main Language Name */}
                    <div>
                      <h3 className={`text-sm font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {lang.name}
                      </h3>
                    </div>

                    {/* Subtle Glow Accent */}
                    {isSelected && (
                      <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-[#FA233B]/20 rounded-full blur-xl pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>You can select multiple languages. Existing playlists & downloads are never restricted.</span>
            </p>
          </div>
        )}

        {/* STEP 2: MUSIC INTERESTS & VIBES */}
        {step === 2 && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1 animate-in fade-in">
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
                <span>🎵 What do you want to hear?</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Choose your music interests to immediately personalize your Home feed.
              </p>
            </div>

            {/* Interests Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                        <h4 className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {interest.label}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
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

            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>We'll curate your Daily Mixes, New Releases & Recommendations from these vibes.</span>
            </p>
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {step === 1 ? (
              <span><strong className="text-white">{selectedLangs.length}</strong> language{selectedLangs.length === 1 ? '' : 's'} selected</span>
            ) : (
              <span><strong className="text-white">{selectedInterests.length}</strong> interest{selectedInterests.length === 1 ? '' : 's'} selected</span>
            )}
          </div>

          {step === 1 ? (
            <button
              onClick={handleNextStep}
              className="px-6 py-2.5 rounded-2xl bg-[#FA233B] hover:bg-[#d91e32] text-white text-xs font-black shadow-lg shadow-red-500/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#FA233B] via-rose-600 to-purple-600 hover:opacity-90 text-white text-xs font-black shadow-xl shadow-red-500/40 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>Start Listening</span>
              <Sparkles className="w-4 h-4 fill-white" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
