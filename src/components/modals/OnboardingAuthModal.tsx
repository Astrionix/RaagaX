'use client';

import React, { useState, useEffect } from 'react';
import { Disc3, Mail, Lock, Eye, EyeOff, ChevronLeft, Loader2, X, Check, ArrowRight, User } from 'lucide-react';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { supabase } from '@/lib/supabase';
import { RecommendationEngine } from '@/lib/recommendationEngine';
import { Song } from '@/types/music';

const TOP_LANGUAGES = ['Telugu', 'Hindi', 'Tamil', 'Malayalam', 'Kannada', 'English'];
const TOP_ARTISTS = [
  { name: 'Anirudh Ravichander', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop' },
  { name: 'Thaman S', img: 'https://images.unsplash.com/photo-1493225457124-a1a2a5956093?w=150&h=150&fit=crop' },
  { name: 'A.R. Rahman', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&h=150&fit=crop' },
  { name: 'Sid Sriram', img: 'https://images.unsplash.com/photo-1520872024865-3ff2805d8bb3?w=150&h=150&fit=crop' },
  { name: 'Devi Sri Prasad', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop' },
  { name: 'Harris Jayaraj', img: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=150&h=150&fit=crop' },
];

export function OnboardingAuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, user } = useAuthStore();
  const { setPreferredLanguage } = usePlayerStore();
  
  // Progression States: 'login' | 'register-credentials' | 'register-language' | 'register-artists' | 'loading'
  const [mode, setMode] = useState<'login' | 'register-credentials' | 'register-language' | 'register-artists'>('login');
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [selectedLanguage, setSelectedLanguage] = useState('Telugu');
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Prevent background scrolling when open
  useEffect(() => {
    if (isAuthModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isAuthModalOpen]);

  // If user logs in successfully elsewhere, close modal
  useEffect(() => {
    if (user && isAuthModalOpen) {
      setAuthModalOpen(false);
    }
  }, [user, isAuthModalOpen, setAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleLogin = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      localStorage.setItem('raagax_onboarding_done', 'true');
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterCredentials = async () => {
    setErrorMsg('');
    if (!username) return setErrorMsg('Username is required');
    if (!email) return setErrorMsg('Email is required');
    if (password !== confirmPassword) return setErrorMsg('Passwords do not match');
    if (password.length < 6) return setErrorMsg('Password must be at least 6 characters');
    setMode('register-language');
  };

  const handleRegisterLanguage = () => {
    setPreferredLanguage(selectedLanguage);
    setMode('register-artists');
  };

  const handleFinalizeRegister = async () => {
    setErrorMsg('');
    setIsLoading(true);
    
    // Bootstrap recommendation engine with selected artists
    selectedArtists.forEach(artist => {
      RecommendationEngine.getInstance().trackPlay({
        id: `bootstrap_${artist}`,
        title: 'Bootstrap',
        artist: artist,
        genre: '',
        category: '',
        coverUrl: '',
        duration: 180,
        provider: 'local'
      } as Song);
    });

    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: username } }
      });
      if (error) throw error;
      localStorage.setItem('raagax_onboarding_done', 'true');
      setAuthModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
      setMode('register-credentials'); // Go back if error
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    localStorage.setItem('raagax_onboarding_done', 'true');
    setAuthModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#07080C] md:bg-black/80 flex flex-col md:items-center md:justify-center animate-in fade-in duration-300 text-[#F5F5F7] overflow-y-auto">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between p-5 pt-8 sticky top-0 bg-[#07080C] z-10">
        <button onClick={handleClose} className="p-2 -ml-2 text-[#9AA0AE] hover:text-[#F5F5F7] transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 mr-4">
          <Disc3 className="w-5 h-5 text-[#F51B3D]" />
          <span className="font-bold text-lg tracking-tight">RaagaX</span>
        </div>
        <div className="w-6" />
      </div>

      {/* MAIN DESKTOP CONTAINER (Full screen on desktop, takes remaining space on mobile) */}
      <div className="w-full h-full md:h-[80vh] md:max-h-[800px] md:max-w-[1200px] flex flex-col md:flex-row relative flex-grow md:rounded-[32px] overflow-hidden md:border border-[#272A33] md:shadow-2xl bg-[#07080C]">
        
        {/* CLOSE BUTTON FOR DESKTOP */}
        <button 
          onClick={handleClose}
          title="Close"
          className="hidden md:flex absolute top-6 right-6 z-50 p-2.5 bg-black/20 hover:bg-[#171820] rounded-full text-[#9AA0AE] hover:text-white transition-all border border-transparent hover:border-[#272A33]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LEFT COLUMN: FORM */}
        <div className="relative z-10 w-full md:w-[480px] p-6 sm:p-8 md:p-14 flex flex-col flex-shrink-0 bg-[#07080C] overflow-y-auto">
          
          <div className="space-y-2 mb-10 mt-4 md:mt-10">
            <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight text-white leading-tight">
              {mode === 'login' && <>Welcome <span className="text-[#F51B3D]">back</span></>}
              {mode === 'register-credentials' && 'Join RaagaX'}
              {mode === 'register-language' && 'What languages do you listen to?'}
              {mode === 'register-artists' && 'Pick some favorites'}
            </h1>
            <p className="text-[14px] text-[#9AA0AE] font-medium">
              {mode === 'login' && 'Your music is waiting.'}
              {mode === 'register-credentials' && 'Your music. Your library. Everywhere.'}
              {mode === 'register-language' && 'This helps us personalize your discovery.'}
              {mode === 'register-artists' && 'We\'ll build a profile just for you.'}
            </p>
          </div>

          <div className="space-y-5 w-full flex-grow">
            {errorMsg && (
              <div className="p-4 rounded-xl bg-[#FF4D5E]/10 border border-[#FF4D5E]/30 text-[#FF4D5E] text-[13px] font-semibold">
                {errorMsg}
              </div>
            )}

            {/* --- LOGIN & REGISTER CREDENTIALS --- */}
            {(mode === 'login' || mode === 'register-credentials') && (
              <>
                {mode === 'register-credentials' && (
                  <div className="space-y-1.5">
                    <label className="text-[14px] font-semibold text-[#9AA0AE] ml-1">Username</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#6F7482] group-focus-within:text-[#F51B3D] transition-colors" />
                      <input
                        type="text"
                        placeholder="Choose a username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full h-[56px] pl-11 pr-4 bg-[#101116] border border-[#272A33] rounded-[16px] text-[15px] text-white placeholder-[#6F7482] focus:outline-none focus:border-[#F51B3D] focus:shadow-[0_0_15px_rgba(245,27,61,0.15)] transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#9AA0AE] ml-1">Email address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#6F7482] group-focus-within:text-[#F51B3D] transition-colors" />
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-[56px] pl-11 pr-4 bg-[#101116] border border-[#272A33] rounded-[16px] text-[15px] text-white placeholder-[#6F7482] focus:outline-none focus:border-[#F51B3D] focus:shadow-[0_0_15px_rgba(245,27,61,0.15)] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#9AA0AE] ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#6F7482] group-focus-within:text-[#F51B3D] transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-[56px] pl-11 pr-11 bg-[#101116] border border-[#272A33] rounded-[16px] text-[15px] text-white placeholder-[#6F7482] focus:outline-none focus:border-[#F51B3D] focus:shadow-[0_0_15px_rgba(245,27,61,0.15)] transition-all"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6F7482] hover:text-[#9AA0AE] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                {mode === 'register-credentials' && (
                  <div className="space-y-1.5">
                    <label className="text-[14px] font-semibold text-[#9AA0AE] ml-1">Confirm Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#6F7482] group-focus-within:text-[#F51B3D] transition-colors" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full h-[56px] pl-11 pr-11 bg-[#101116] border border-[#272A33] rounded-[16px] text-[15px] text-white placeholder-[#6F7482] focus:outline-none focus:border-[#F51B3D] focus:shadow-[0_0_15px_rgba(245,27,61,0.15)] transition-all"
                      />
                      <button
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6F7482] hover:text-[#9AA0AE] transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'login' && (
                  <div className="flex justify-end pt-1">
                    <button className="text-[13px] font-semibold text-[#F51B3D] hover:text-[#FF2347] transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  onClick={mode === 'login' ? handleLogin : handleRegisterCredentials}
                  disabled={isLoading}
                  className="w-full h-[56px] mt-4 rounded-[16px] bg-[#F51B3D] text-white font-bold text-[15px] hover:bg-gradient-to-r hover:from-[#F51B3D] hover:to-[#FF2347] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</>
                  ) : (
                    <>{mode === 'login' ? 'Sign In' : 'Continue'} <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" /></>
                  )}
                </button>
              </>
            )}

            {/* --- REGISTER LANGUAGES --- */}
            {mode === 'register-language' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TOP_LANGUAGES.map(lang => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`h-[56px] rounded-[16px] border ${selectedLanguage === lang ? 'bg-[#F51B3D]/10 border-[#F51B3D] text-white' : 'bg-[#101116] border-[#272A33] text-[#9AA0AE] hover:border-[#F51B3D]/50 hover:text-white'} text-[15px] font-semibold transition-all flex items-center justify-center`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleRegisterLanguage}
                  className="w-full h-[56px] mt-8 rounded-[16px] bg-[#F51B3D] text-white font-bold text-[15px] hover:bg-gradient-to-r hover:from-[#F51B3D] hover:to-[#FF2347] hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                >
                  Continue <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            )}

            {/* --- REGISTER ARTISTS --- */}
            {mode === 'register-artists' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {TOP_ARTISTS.map(artist => {
                    const isSelected = selectedArtists.includes(artist.name);
                    return (
                      <button
                        key={artist.name}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedArtists(prev => prev.filter(a => a !== artist.name));
                          } else {
                            setSelectedArtists(prev => [...prev, artist.name]);
                          }
                        }}
                        className="flex flex-col items-center gap-2 group outline-none"
                      >
                        <div className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 transition-all duration-300 ${isSelected ? 'border-[#F51B3D] scale-105' : 'border-transparent group-hover:border-[#272A33]'}`}>
                          <img src={artist.img} alt={artist.name} className="w-full h-full object-cover" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Check className="w-8 h-8 text-white" />
                            </div>
                          )}
                        </div>
                        <span className={`text-[12px] font-semibold text-center transition-colors ${isSelected ? 'text-white' : 'text-[#9AA0AE] group-hover:text-white'}`}>
                          {artist.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={handleFinalizeRegister}
                  disabled={isLoading}
                  className="w-full h-[56px] mt-8 rounded-[16px] bg-[#F51B3D] text-white font-bold text-[15px] hover:bg-gradient-to-r hover:from-[#F51B3D] hover:to-[#FF2347] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Creating Account...</>
                  ) : (
                    <>{selectedArtists.length > 0 ? 'Finish Setup' : 'Skip & Finish'} <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" /></>
                  )}
                </button>
              </div>
            )}

            {/* TOGGLE MODE */}
            {(mode === 'login' || mode === 'register-credentials') && (
              <div className="text-center text-[14px] font-medium text-[#9AA0AE] mt-8 pb-8 md:pb-0">
                {mode === 'login' ? "New to RaagaX? " : "Already have an account? "}
                <button 
                  onClick={() => setMode(mode === 'login' ? 'register-credentials' : 'login')}
                  className="text-white font-bold hover:text-[#F51B3D] transition-colors"
                >
                  {mode === 'login' ? 'Create account' : 'Sign In'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: MUSIC ATMOSPHERE (Desktop Only) */}
        <div className="hidden md:flex flex-1 relative bg-[#07080C] overflow-hidden flex-col items-center justify-center p-12">
          
          {/* Abstract Waveform Effect */}
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30">
            <div className="w-[150%] h-[400px] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPgo8cGF0aCBkPSJNMCA1MCBRIDI1IDMwLCA1MCA1MCBUIDEwMCA1MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI0NSwgMjcsIDYxLCAwLjQpIiBzdHJva2Utd2lkdGg9IjEiIC8+Cjwvc3ZnPg==')] bg-repeat-x animate-pulse opacity-20" />
          </div>
          
          {/* Subtle Glows */}
          <div className="absolute top-1/4 -right-1/4 w-[600px] h-[600px] bg-[#F51B3D]/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-[#F51B3D]/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
          
          {/* Blurred Album Art representation */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center blur-md mix-blend-luminosity" />

          {/* Foreground Branding Elements */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <div className="flex items-center gap-3">
              <Disc3 className="w-10 h-10 text-[#F51B3D] animate-[spin_10s_linear_infinite]" />
              <span className="font-black text-4xl tracking-tighter text-white">RaagaX</span>
            </div>
            
            <div className="space-y-2 mt-8">
              <h2 className="text-3xl font-bold text-white tracking-tight">Your music. Your world.</h2>
              <p className="text-[#9AA0AE] text-lg font-medium">Discover • Listen • Connect</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
