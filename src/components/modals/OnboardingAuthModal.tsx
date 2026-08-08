'use client';

import React, { useState, useEffect } from 'react';
import { Disc3, User, Mail, Lock, Eye, EyeOff, ChevronLeft, Music, Heart, MonitorSmartphone, Loader2, X } from 'lucide-react';
import { useAuthStore } from '@/context/useAuthStore';
import { supabase } from '@/lib/supabase';

export function OnboardingAuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, user } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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

  const handleAuth = async () => {
    setErrorMsg('');
    if (mode === 'register') {
      if (!username) return setErrorMsg('Username is required');
      if (password !== confirmPassword) return setErrorMsg('Passwords do not match');
      if (!agreedToTerms) return setErrorMsg('You must agree to the Terms & Privacy Policy');
    }

    setIsLoading(true);
    
    try {
      if (mode === 'register') {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: username } }
        });
        if (error) throw error;
        if (data.user) {
          // Store username in public.users profile if needed, or just proceed
          localStorage.setItem('raagax_onboarding_done', 'true');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        localStorage.setItem('raagax_onboarding_done', 'true');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    localStorage.setItem('raagax_onboarding_done', 'true');
    setAuthModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black md:bg-black/90 md:backdrop-blur-xl flex flex-col md:items-center md:justify-center animate-in fade-in duration-300 text-white overflow-y-auto">
      
      {/* MOBILE HEADER (md:hidden) */}
      <div className="md:hidden flex items-center justify-between p-5 pt-8 sticky top-0 bg-black/80 backdrop-blur-md z-10">
        <button onClick={handleClose} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 mr-4">
          <Disc3 className="w-5 h-5 text-[#EF233C]" />
          <span className="font-black text-lg tracking-tight">RaagaX</span>
        </div>
        <div className="w-6" /> {/* Spacer for centering */}
      </div>

      {/* MAIN CONTAINER */}
      <div className="w-full md:max-w-4xl flex flex-col md:flex-row relative flex-grow md:flex-grow-0 md:rounded-3xl overflow-hidden border-none md:border md:border-white/10 md:shadow-2xl">
        
        {/* DESKTOP BACKGROUND IMAGE LAYER */}
        <div className="hidden md:block absolute inset-0 z-0 bg-[#0B0D13]">
          <div 
            className="absolute right-0 top-0 bottom-0 w-2/3 bg-cover bg-center opacity-40 mix-blend-screen"
            style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1540039155732-68473668f430?q=80&w=3149&auto=format&fit=crop")' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D13] via-[#0B0D13]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-red-900/20 to-transparent mix-blend-color-dodge" />
        </div>

        {/* CLOSE BUTTON FOR DESKTOP */}
        <button 
          onClick={handleClose}
          className="hidden md:flex absolute top-5 right-5 z-20 p-2 bg-black/40 hover:bg-black/60 rounded-full text-slate-400 hover:text-white transition-colors backdrop-blur-md border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* CONTENT AREA */}
        <div className="relative z-10 w-full md:w-[450px] p-6 sm:p-8 md:p-12 flex flex-col">
          
          <div className="md:text-center space-y-2 mb-8">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              {mode === 'login' ? (
                <>Welcome <span className="text-[#EF233C]">back</span></>
              ) : (
                'Create your account'
              )}
            </h1>
            <p className="text-sm text-slate-400 font-medium">
              {mode === 'login' ? 'Sign in to continue your music journey' : 'Start your music journey'}
            </p>
          </div>

          <div className="space-y-4 w-full">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold text-center">
                {errorMsg}
              </div>
            )}

            {/* USERNAME FIELD (Register Only) */}
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full py-3.5 pl-11 pr-4 bg-[#141519] border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#EF233C] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* EMAIL FIELD */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-3.5 pl-11 pr-4 bg-[#141519] border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#EF233C] transition-colors"
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-3.5 pl-11 pr-11 bg-[#141519] border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#EF233C] transition-colors"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD (Register Only) */}
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 ml-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full py-3.5 pl-11 pr-11 bg-[#141519] border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#EF233C] transition-colors"
                  />
                  <button
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* FORGOT PASSWORD (Login Only) */}
            {mode === 'login' && (
              <div className="flex justify-end pt-1">
                <button className="text-xs font-bold text-[#EF233C] hover:text-red-400 transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            {/* TERMS CHECKBOX (Register Only) */}
            {mode === 'register' && (
              <label className="flex items-start gap-3 py-2 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors border ${agreedToTerms ? 'bg-[#EF233C] border-[#EF233C]' : 'border-slate-500 group-hover:border-slate-400'}`} />
                </div>
                <span className="text-xs text-slate-400 leading-tight">
                  I agree to the <button className="text-[#EF233C] hover:underline font-semibold">Terms</button> & <button className="text-[#EF233C] hover:underline font-semibold">Privacy Policy</button>
                </span>
              </label>
            )}

            {/* MAIN ACTION BUTTON */}
            <button
              onClick={handleAuth}
              disabled={isLoading}
              className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-[#EF233C] to-[#D90429] text-white font-extrabold text-sm shadow-xl shadow-red-900/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            {/* OR DIVIDER */}
            <div className="flex items-center gap-3 py-3 opacity-50">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OR</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* TOGGLE MODE */}
            <div className="text-center text-xs font-medium text-slate-400 pb-20 md:pb-0">
              {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-[#EF233C] font-extrabold hover:text-red-400 transition-colors"
              >
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* DESKTOP BOTTOM FOOTER (md:flex) */}
      <div className="hidden md:flex flex-col items-center gap-4 mt-8">
        <div className="flex items-center gap-10 text-xs font-bold text-slate-400">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-[#EF233C]" />
            Millions of songs
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-[#EF233C]" />
            Personalized for you
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-[#EF233C]" />
            Any device, anytime
          </div>
        </div>
        <p className="text-[10px] text-slate-600 font-medium">© {new Date().getFullYear()} RaagaX. All rights reserved.</p>
      </div>

      {/* MOBILE BOTTOM GRAPHIC (md:hidden) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-32 pointer-events-none flex items-end justify-center overflow-hidden z-0">
        <div className="absolute bottom-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#EF233C] to-transparent shadow-[0_0_20px_rgba(239,35,60,0.8)]" />
        
        {/* Abstract Waveform Effect */}
        <div className="absolute bottom-0 w-[200%] h-24 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPgo8cGF0aCBkPSJNMCA1MCBRIDI1IDMwLCA1MCA1MCBUIDEwMCA1MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDIzOSwgMzUsIDYwLCAwLjIpIiBzdHJva2Utd2lkdGg9IjIiIC8+CjwvN3ZnPg==')] bg-repeat-x opacity-50 blur-[1px]" />
        
        {/* Center Glowing Icon */}
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-[#EF233C] blur-xl rounded-full opacity-40 animate-pulse" />
          <div className="w-14 h-14 rounded-full border-2 border-[#EF233C] bg-black flex items-center justify-center relative shadow-[0_0_30px_rgba(239,35,60,0.4)]">
            <Music className="w-6 h-6 text-[#EF233C]" />
          </div>
        </div>
      </div>
      
    </div>
  );
}
