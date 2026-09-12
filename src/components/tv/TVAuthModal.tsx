'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Lock, LogIn, QrCode, Smartphone, RefreshCw, Loader2, CheckCircle2, AlertCircle, Keyboard, Tv } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/context/useAuthStore';
import { TVOnScreenKeyboard } from './TVOnScreenKeyboard';
import { DeviceKeyManager } from '@/lib/connect/auth/DeviceKeyManager';

interface TVAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

type AuthStateMode = 'INITIAL' | 'EMAIL_LOADING' | 'EMAIL_ERROR' | 'PHONE_WAITING' | 'PHONE_CONNECTED' | 'QR_EXPIRED' | 'NETWORK_ERROR';

export function TVAuthModal({ isOpen, onClose }: TVAuthModalProps) {
  const { isAuthModalOpen } = useAuthStore();
  const modalOpen = isOpen || isAuthModalOpen;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthStateMode>('INITIAL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phone QR & Pairing Code state
  const [pairingCode, setPairingCode] = useState<string>('X7K9-P2');
  const [sessionId, setSessionId] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [expiresInSec, setExpiresInSec] = useState<number>(300);

  // Virtual Keyboard state
  const [keyboardField, setKeyboardField] = useState<'email' | 'password' | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Generate dynamic 6-character pairing code (e.g. X7K9-P2)
  const generatePairingCode = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    for (let i = 0; i < 2; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    return `${part1}-${part2}`;
  }, []);

  // Initialize Pairing Session
  const initPairingSession = useCallback(async () => {
    try {
      const code = generatePairingCode();
      const sessId = `tv_sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      setPairingCode(code);
      setSessionId(sessId);
      setExpiresInSec(300);
      setAuthMode('INITIAL');
      setErrorMessage(null);

      const deviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
      const payloadUrl = `https://raaga.me/tv-auth?session=${sessId}&code=${code}&device=${encodeURIComponent('Living Room TV')}&deviceId=${deviceId}`;

      const url = await QRCode.toDataURL(payloadUrl, {
        width: 380,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setQrDataUrl(url);

      // Subscribe to Realtime TV Pairing channel
      const channel = supabase.channel(`tv-pairing:${sessId}`);
      channel
        .on('broadcast', { event: 'TV_AUTH_APPROVED' }, async (payload: any) => {
          if (payload?.payload?.session) {
            setAuthMode('PHONE_CONNECTED');
            // Set session in Supabase auth client
            await supabase.auth.setSession(payload.payload.session).catch(() => {});
            useAuthStore.getState().initializeAuth();
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('[TV Auth] Pairing init warning:', e);
    }
  }, [generatePairingCode]);

  useEffect(() => {
    if (modalOpen) {
      const cleanup = initPairingSession();
      return () => {
        cleanup.then((c) => c && c());
      };
    }
  }, [modalOpen, initPairingSession]);

  // Expiration countdown
  useEffect(() => {
    if (!modalOpen || expiresInSec <= 0) return;
    const timer = setInterval(() => {
      setExpiresInSec((prev) => {
        if (prev <= 1) {
          setAuthMode('QR_EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [modalOpen, expiresInSec]);

  // Direct Email + Password Login (NO OTP, NO Extra Steps)
  const handleEmailSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      setAuthMode('EMAIL_ERROR');
      return;
    }

    setAuthMode('EMAIL_LOADING');
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setErrorMessage('Unable to sign in. Check your email and password and try again.');
        setAuthMode('EMAIL_ERROR');
      } else if (data.session) {
        setAuthMode('PHONE_CONNECTED');
        await useAuthStore.getState().initializeAuth();
      }
    } catch (e: any) {
      setErrorMessage('Unable to connect to RaagaX. Check your internet connection.');
      setAuthMode('NETWORK_ERROR');
    }
  };

  if (!modalOpen) return null;

  return (
    <div className="fixed inset-0 z-[10040] bg-[#07070b] text-white flex flex-col justify-between p-8 sm:p-14 select-none overflow-hidden animate-in fade-in duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* 1. TOP CENTER BRANDING */}
      <div className="flex flex-col items-center justify-center text-center space-y-1">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white">RAAGAX</h1>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#fa233b]">Lossless Music for TV</p>
      </div>

      {/* 2. TWO-COLUMN SIDE-BY-SIDE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 my-auto items-stretch max-w-6xl mx-auto w-full">
        {/* ── LEFT PANEL: EMAIL + PASSWORD LOGIN ── */}
        <div className="lg:col-span-6 bg-white/5 border border-white/12 backdrop-blur-3xl rounded-3xl p-8 sm:p-10 flex flex-col justify-between shadow-[0_30px_90px_rgba(0,0,0,0.6)] space-y-6">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Sign in</h2>
              <span className="text-xs font-semibold text-white/50">Email + Password</span>
            </div>

            <div className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/70 block">Email</label>
                <div 
                  data-tv-focusable="true"
                  onClick={() => setKeyboardField('email')}
                  tabIndex={0}
                  className="w-full bg-black/40 border border-white/15 focus:border-[#fa233b] rounded-2xl px-5 py-4 flex items-center justify-between text-white transition-all cursor-pointer shadow-inner"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-5 h-5 text-white/50 flex-shrink-0" />
                    <span className={`text-base sm:text-lg font-medium truncate ${email ? 'text-white' : 'text-white/30'}`}>
                      {email || 'email@example.com'}
                    </span>
                  </div>
                  <Keyboard className="w-5 h-5 text-white/40" />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/70 block">Password</label>
                <div 
                  data-tv-focusable="true"
                  onClick={() => setKeyboardField('password')}
                  tabIndex={0}
                  className="w-full bg-black/40 border border-white/15 focus:border-[#fa233b] rounded-2xl px-5 py-4 flex items-center justify-between text-white transition-all cursor-pointer shadow-inner"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Lock className="w-5 h-5 text-white/50 flex-shrink-0" />
                    <span className={`text-base sm:text-lg font-mono font-medium truncate ${password ? 'text-white' : 'text-white/30'}`}>
                      {password ? '••••••••••••••••' : 'Password'}
                    </span>
                  </div>
                  <Keyboard className="w-5 h-5 text-white/40" />
                </div>
              </div>
            </div>
          </div>

          {/* Error Message Display */}
          {(authMode === 'EMAIL_ERROR' || authMode === 'NETWORK_ERROR') && errorMessage && (
            <div className="bg-rose-500/15 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3 text-rose-300 text-xs font-semibold animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sign In Button */}
          <button
            data-tv-focusable="true"
            onClick={handleEmailSignIn}
            disabled={authMode === 'EMAIL_LOADING'}
            className="w-full py-4.5 bg-[#fa233b] hover:bg-[#d91e32] disabled:opacity-50 rounded-2xl font-black text-base text-white shadow-2xl shadow-red-500/30 transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            {authMode === 'EMAIL_LOADING' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </div>

        {/* ── RIGHT PANEL: CONNECT WITH PHONE ── */}
        <div className="lg:col-span-6 bg-white/5 border border-white/12 backdrop-blur-3xl rounded-3xl p-8 sm:p-10 flex flex-col justify-between shadow-[0_30px_90px_rgba(0,0,0,0.6)] text-center space-y-6">
          <div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Smartphone className="w-6 h-6 text-[#fa233b]" />
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Connect with Phone</h2>
            </div>

            {authMode === 'QR_EXPIRED' ? (
              /* QR EXPIRED STATE */
              <div className="py-12 space-y-6">
                <div className="p-4 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-2xl text-sm font-bold max-w-sm mx-auto">
                  QR code expired
                </div>
                <button
                  data-tv-focusable="true"
                  onClick={initPairingSession}
                  className="px-8 py-4 bg-[#fa233b] hover:bg-[#d91e32] rounded-2xl font-black text-sm text-white shadow-xl shadow-red-500/30 inline-flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Generate New Code</span>
                </button>
              </div>
            ) : authMode === 'PHONE_CONNECTED' ? (
              /* PHONE CONNECTED STATE */
              <div className="py-12 space-y-4 animate-in zoom-in duration-300">
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
                <h3 className="text-2xl font-black text-emerald-300">Connected successfully</h3>
                <p className="text-xs text-white/60">Loading RaagaX TV Home...</p>
              </div>
            ) : (
              /* NORMAL QR & PAIRING CODE DISPLAY */
              <div className="space-y-6">
                {/* Large QR Code */}
                <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl border-4 border-white/20">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="TV Login QR Code" className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl" />
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-gray-400 font-bold">
                      Loading QR...
                    </div>
                  )}
                </div>

                <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white/80">
                  Scan this QR code with your phone
                </p>

                {/* OR DIVIDER */}
                <div className="flex items-center gap-4 max-w-xs mx-auto my-2">
                  <div className="flex-1 h-px bg-white/20" />
                  <span className="text-xs font-black uppercase text-white/40">OR</span>
                  <div className="flex-1 h-px bg-white/20" />
                </div>

                {/* PAIRING CODE */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Enter this code</p>
                  <div className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-white drop-shadow-[0_10px_20px_rgba(250,35,59,0.5)]">
                    {pairingCode}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Countdown & Status Footer */}
          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs font-mono font-semibold text-white/50">
            <span>Living Room TV</span>
            <span>Expires in {Math.floor(expiresInSec / 60)}:{expiresInSec % 60 < 10 ? '0' : ''}{expiresInSec % 60}</span>
          </div>
        </div>
      </div>

      {/* 3. VIRTUAL TV KEYBOARD MODAL */}
      {keyboardField && (
        <TVOnScreenKeyboard
          value={keyboardField === 'email' ? email : password}
          onChange={(val) => {
            if (keyboardField === 'email') setEmail(val);
            else setPassword(val);
          }}
          onSubmit={() => {
            setKeyboardField(null);
            if (email && password) handleEmailSignIn();
          }}
          onClose={() => setKeyboardField(null)}
          fieldName={keyboardField === 'email' ? 'Email Address' : 'Password'}
          isPassword={keyboardField === 'password'}
        />
      )}
    </div>
  );
}
