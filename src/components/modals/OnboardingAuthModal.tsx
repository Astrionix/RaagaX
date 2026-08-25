'use client';

import React, { useState, useEffect } from 'react';
import { Disc3, Mail, Lock, Eye, EyeOff, ChevronLeft, Loader2, X, Check, ArrowRight, User } from 'lucide-react';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { supabase } from '@/lib/supabase';
import { RecommendationEngine } from '@/lib/recommendationEngine';
import { Song } from '@/types/music';

import { UserLifecycleManager } from '@/lib/lifecycle/UserLifecycleManager';

const TOP_LANGUAGES = ['Telugu', 'Hindi', 'Tamil', 'Malayalam', 'Kannada', 'English'];
const TOP_MOODS = [
  { name: 'Melodies', icon: '🎵' },
  { name: 'Mass', icon: '🔥' },
  { name: 'Party', icon: '💃' },
  { name: 'Love', icon: '❤️' },
  { name: 'Devotional', icon: '🙏' },
  { name: 'Lofi', icon: '🌙' },
  { name: 'Workout', icon: '🏋️' },
  { name: 'Sad', icon: '😢' },
  { name: 'Indie', icon: '🎸' },
  { name: 'Movie Songs', icon: '🎬' }
];
const ARTISTS_BY_LANGUAGE: Record<string, Array<{ name: string; img: string }>> = {
  Telugu: [
    { name: 'Thaman S', img: 'https://c.saavncdn.com/artists/S_Thaman_002_20200810103759_500x500.jpg' },
    { name: 'Devi Sri Prasad', img: 'https://c.saavncdn.com/artists/Devi_Sri_Prasad_002_20200810103445_500x500.jpg' },
    { name: 'Sid Sriram', img: 'https://c.saavncdn.com/artists/Sid_Sriram_003_20230104093817_500x500.jpg' },
    { name: 'Anirudh Ravichander', img: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_002_20230104094030_500x500.jpg' },
    { name: 'M. M. Keeravani', img: 'https://c.saavncdn.com/artists/M_M_Keeravani_002_20230315061618_500x500.jpg' },
    { name: 'Ram Miriyala', img: 'https://c.saavncdn.com/artists/Ram_Miriyala_000_20211027110123_500x500.jpg' }
  ],
  Hindi: [
    { name: 'Arijit Singh', img: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg' },
    { name: 'Pritam', img: 'https://c.saavncdn.com/artists/Pritam_Chakraborty-20170711073326_500x500.jpg' },
    { name: 'A.R. Rahman', img: 'https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg' },
    { name: 'Shreya Ghoshal', img: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_003_20230104093405_500x500.jpg' },
    { name: 'Badshah', img: 'https://c.saavncdn.com/artists/Badshah_005_20230605090710_500x500.jpg' },
    { name: 'Sachin-Jigar', img: 'https://c.saavncdn.com/artists/Sachin_Jigar_003_20230104094119_500x500.jpg' }
  ],
  Tamil: [
    { name: 'Anirudh Ravichander', img: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_002_20230104094030_500x500.jpg' },
    { name: 'A.R. Rahman', img: 'https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg' },
    { name: 'Harris Jayaraj', img: 'https://c.saavncdn.com/artists/Harris_Jayaraj_002_20200810103649_500x500.jpg' },
    { name: 'Yuvan Shankar Raja', img: 'https://c.saavncdn.com/artists/Yuvan_Shankar_Raja_003_20230104093845_500x500.jpg' },
    { name: 'G.V. Prakash Kumar', img: 'https://c.saavncdn.com/artists/G_V_Prakash_Kumar_002_20200810103551_500x500.jpg' },
    { name: 'Santhosh Narayanan', img: 'https://c.saavncdn.com/artists/Santhosh_Narayanan_002_20200810103723_500x500.jpg' }
  ],
  Malayalam: [
    { name: 'Sushin Shyam', img: 'https://c.saavncdn.com/artists/Sushin_Shyam_000_20200305072044_500x500.jpg' },
    { name: 'Gopi Sundar', img: 'https://c.saavncdn.com/artists/Gopi_Sundar_002_20200810103606_500x500.jpg' },
    { name: 'Hesham Abdul Wahab', img: 'https://c.saavncdn.com/artists/Hesham_Abdul_Wahab_000_20220119102434_500x500.jpg' },
    { name: 'Shaan Rahman', img: 'https://c.saavncdn.com/artists/Shaan_Rahman_002_20200810103732_500x500.jpg' },
    { name: 'Vidyasagar', img: 'https://c.saavncdn.com/artists/Vidyasagar_002_20200810103957_500x500.jpg' },
    { name: 'K.S. Chithra', img: 'https://c.saavncdn.com/artists/K_S_Chithra_002_20200810103816_500x500.jpg' }
  ],
  Kannada: [
    { name: 'Arjun Janya', img: 'https://c.saavncdn.com/artists/Arjun_Janya_002_20200810103507_500x500.jpg' },
    { name: 'B. Ajaneesh Loknath', img: 'https://c.saavncdn.com/artists/B_Ajaneesh_Loknath_000_20221003112836_500x500.jpg' },
    { name: 'Charan Raj', img: 'https://c.saavncdn.com/artists/Charan_Raj_000_20191101083416_500x500.jpg' },
    { name: 'V. Harikrishna', img: 'https://c.saavncdn.com/artists/V_Harikrishna_002_20200810103949_500x500.jpg' },
    { name: 'Vijay Prakash', img: 'https://c.saavncdn.com/artists/Vijay_Prakash_002_20200810104008_500x500.jpg' },
    { name: 'Sanjith Hegde', img: 'https://c.saavncdn.com/artists/Sanjith_Hegde_000_20200326084012_500x500.jpg' }
  ],
  English: [
    { name: 'Taylor Swift', img: 'https://c.saavncdn.com/artists/Taylor_Swift_004_20230628080644_500x500.jpg' },
    { name: 'Ed Sheeran', img: 'https://c.saavncdn.com/artists/Ed_Sheeran_003_20230504062402_500x500.jpg' },
    { name: 'The Weeknd', img: 'https://c.saavncdn.com/artists/The_Weeknd_003_20230303080721_500x500.jpg' },
    { name: 'Dua Lipa', img: 'https://c.saavncdn.com/artists/Dua_Lipa_003_20230303080630_500x500.jpg' },
    { name: 'Billie Eilish', img: 'https://c.saavncdn.com/artists/Billie_Eilish_003_20230303080608_500x500.jpg' },
    { name: 'Drake', img: 'https://c.saavncdn.com/artists/Drake_003_20230303080619_500x500.jpg' }
  ]
};

export function OnboardingAuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, user } = useAuthStore();
  const { setPreferredLanguage } = usePlayerStore();
  
  // Progression States: 'login' | 'register-credentials' | 'register-language' | 'register-moods' | 'register-artists'
  const [mode, setMode] = useState<'login' | 'register-credentials' | 'register-language' | 'register-moods' | 'register-artists'>('login');
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>(['Melodies', 'Love']);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || !isAuthModalOpen) return null;

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Incorrect email or password. If you do not have an account yet, click "Create account" below.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMsg('Please confirm your email address before logging in.');
        } else {
          setErrorMsg(error.message);
        }
        return;
      }
      if (data?.session) {
        useAuthStore.setState({
          session: data.session,
          user: data.session.user,
          isLoading: false,
        });
      }
      localStorage.setItem('raagax_onboarding_done', 'true');
      setAuthModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setMode('register-language');
  };

  const handleRegisterLanguage = () => {
    if (selectedLanguages.length === 0) {
      setErrorMsg('Please select at least one language to continue.');
      return;
    }
    setErrorMsg('');
    setMode('register-moods');
  };

  const handleRegisterMoods = () => {
    setMode('register-artists');
  };

  const handleFinalizeRegister = async () => {
    setErrorMsg('');
    setIsLoading(true);
    
    if (selectedLanguages.length > 0) {
      setPreferredLanguage(selectedLanguages[0]);
    }

    // Bootstrap recommendation engine & lifecycle manager
    UserLifecycleManager.getInstance().bootstrapFromOnboarding(selectedLanguages, selectedMoods, selectedArtists);
    const { ListeningDnaEngine } = await import('@/lib/lifecycle/ListeningDnaEngine');
    ListeningDnaEngine.getInstance().setInitialLanguages(selectedLanguages);
    
    selectedArtists.forEach(artist => {
      RecommendationEngine.getInstance().trackEngagement({
        id: `bootstrap_${artist}`,
        title: 'Bootstrap',
        artist: artist,
        genre: '',
        category: '',
        coverUrl: '',
        duration: 180,
        provider: 'local'
      } as unknown as Song, 'complete', 180, 1.0, 'onboarding');
    });

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail && password) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { full_name: username || 'RaagaX Listener' } }
          });
          if (error) {
            if (error.message.includes('already registered')) {
              setErrorMsg('An account with this email already exists. Please Sign In.');
              setMode('login');
              return;
            } else {
              setErrorMsg(error.message);
              return;
            }
          }
          if (data?.session) {
            useAuthStore.setState({
              session: data.session,
              user: data.session.user,
              isLoading: false,
            });
          }
        } catch (authEx: any) {
          console.warn('[Onboarding] Cloud auth error:', authEx);
        }
      }
      localStorage.setItem('raagax_onboarding_done', 'true');
      localStorage.setItem('raagax_preferred_language', selectedLanguages[0] || 'Telugu');
      localStorage.setItem('raagax_preferred_artists', JSON.stringify(selectedArtists));
      localStorage.setItem('raagax_preferred_moods', JSON.stringify(selectedMoods));
      setAuthModalOpen(false);
    } catch (err: any) {
      console.warn('[Onboarding] Finalize fallback:', err);
      localStorage.setItem('raagax_onboarding_done', 'true');
      setAuthModalOpen(false);
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
              {mode === 'register-moods' && 'What music moves you?'}
              {mode === 'register-artists' && 'Pick some favorites'}
            </h1>
            <p className="text-[14px] text-[#9AA0AE] font-medium">
              {mode === 'login' && 'Your music is waiting.'}
              {mode === 'register-credentials' && 'Your music. Your library. Everywhere.'}
              {mode === 'register-language' && 'Select all languages you enjoy.'}
              {mode === 'register-moods' && 'We\'ll tailor your initial discovery queue.'}
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
              <form 
                onSubmit={mode === 'login' ? handleLogin : handleRegisterCredentials}
                className="space-y-4"
              >
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
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[56px] mt-4 rounded-[16px] bg-[#F51B3D] text-white font-bold text-[15px] hover:bg-gradient-to-r hover:from-[#F51B3D] hover:to-[#FF2347] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> {mode === 'login' ? 'Signing in...' : 'Processing...'}</>
                  ) : (
                    <>{mode === 'login' ? 'Sign In' : 'Continue'} <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" /></>
                  )}
                </button>
              </form>
            )}

            {/* --- REGISTER LANGUAGES (Multi-Select) --- */}
            {mode === 'register-language' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TOP_LANGUAGES.map(lang => {
                    const isSelected = selectedLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        onClick={() => {
                          if (isSelected) {
                            if (selectedLanguages.length > 1) {
                              setSelectedLanguages(prev => prev.filter(l => l !== lang));
                            }
                          } else {
                            setSelectedLanguages(prev => [...prev, lang]);
                          }
                        }}
                        className={`h-[56px] rounded-[16px] border ${isSelected ? 'bg-[#F51B3D]/10 border-[#F51B3D] text-white font-bold' : 'bg-[#101116] border-[#272A33] text-[#9AA0AE] hover:border-[#F51B3D]/50 hover:text-white'} text-[15px] font-semibold transition-all flex items-center justify-center gap-2`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-[#F51B3D]" />}
                        {lang}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleRegisterLanguage}
                  className="w-full h-[56px] mt-8 rounded-[16px] bg-[#F51B3D] text-white font-bold text-[15px] hover:bg-gradient-to-r hover:from-[#F51B3D] hover:to-[#FF2347] hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                >
                  Continue <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            )}

            {/* --- REGISTER MOODS / GENRES --- */}
            {mode === 'register-moods' && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TOP_MOODS.map(mood => {
                    const isSelected = selectedMoods.includes(mood.name);
                    return (
                      <button
                        key={mood.name}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMoods(prev => prev.filter(m => m !== mood.name));
                          } else {
                            setSelectedMoods(prev => [...prev, mood.name]);
                          }
                        }}
                        className={`h-[56px] px-3 rounded-[16px] border ${isSelected ? 'bg-[#F51B3D]/10 border-[#F51B3D] text-white font-bold' : 'bg-[#101116] border-[#272A33] text-[#9AA0AE] hover:border-[#F51B3D]/50 hover:text-white'} text-[14px] transition-all flex items-center justify-start gap-2.5`}
                      >
                        <span className="text-xl">{mood.icon}</span>
                        <span className="truncate">{mood.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#F51B3D] ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleRegisterMoods}
                  className="w-full h-[56px] mt-8 rounded-[16px] bg-[#F51B3D] text-white font-bold text-[15px] hover:bg-gradient-to-r hover:from-[#F51B3D] hover:to-[#FF2347] hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                >
                  Continue <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            )}

            {/* --- REGISTER ARTISTS --- */}
            {mode === 'register-artists' && (() => {
              const activeArtists = (() => {
                const map = new Map<string, { name: string; img: string }>();
                selectedLanguages.forEach(lang => {
                  const list = ARTISTS_BY_LANGUAGE[lang] || ARTISTS_BY_LANGUAGE['Telugu'];
                  list.forEach(a => { if (!map.has(a.name)) map.set(a.name, a); });
                });
                if (map.size === 0) {
                  ARTISTS_BY_LANGUAGE['Telugu'].forEach(a => map.set(a.name, a));
                }
                return Array.from(map.values()).slice(0, 9);
              })();

              return (
                <div className="animate-in slide-in-from-right-4 duration-300 pb-20 md:pb-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {activeArtists.map(artist => {
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
                        className="flex flex-col items-center gap-2 group outline-none cursor-pointer"
                      >
                        <div className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 transition-all duration-300 ${isSelected ? 'border-[#F51B3D] scale-105 shadow-lg shadow-red-500/20' : 'border-transparent group-hover:border-[#272A33]'}`}>
                          <img 
                            src={artist.img || '/app-icon.png'} 
                            alt={artist.name} 
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                            className="w-full h-full object-cover bg-slate-800" 
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Check className="w-8 h-8 text-white stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span className={`text-[12px] font-semibold text-center transition-colors ${isSelected ? 'text-white font-bold' : 'text-[#9AA0AE] group-hover:text-white'}`}>
                          {artist.name}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Sticky Continue / Done Button */}
                <div className="sticky bottom-0 left-0 right-0 pt-3 pb-4 bg-gradient-to-t from-[#07080C] via-[#07080C]/95 to-transparent z-20">
                  <button
                    onClick={handleFinalizeRegister}
                    disabled={isLoading}
                    className="w-full h-[56px] rounded-[16px] bg-[#F51B3D] hover:bg-[#d91e32] text-white font-bold text-[15px] shadow-lg shadow-red-500/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    {isLoading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Finalizing Setup...</>
                    ) : (
                      <>{selectedArtists.length > 0 ? `Continue (${selectedArtists.length} Selected)` : 'Finish Setup'} <ArrowRight className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" /></>
                    )}
                  </button>
                </div>
              </div>
              );
            })()}

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
