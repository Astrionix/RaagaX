"use client";

import { useState } from "react";
import {
  X,
  Mail,
  Lock,
  User,
  Sparkles,
  LogOut,
  Check,
  ArrowRight,
  Radio,
  KeyRound,
  Layers,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { usePlayerStore } from "@/stores/player-store";

export default function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen } = usePlayerStore();
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    setYouTubeSession,
    signOut,
    isLoading,
  } = useAuthStore();

  const [tab, setTab] = useState<"google" | "cookie" | "email">("google");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cookieText, setCookieText] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isAuthModalOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email) {
      setError("Please enter your email.");
      return;
    }

    if (isSignUp) {
      const res = await signUpWithEmail(email, password);
      if (res.error) setError(res.error);
      else {
        setSuccessMsg("Account created! You are now signed in.");
        setTimeout(() => setAuthModalOpen(false), 1200);
      }
    } else {
      const res = await signInWithEmail(email, password);
      if (res.error) setError(res.error);
      else {
        setSuccessMsg("Welcome back to Raaga!");
        setTimeout(() => setAuthModalOpen(false), 1000);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    // Check if running in Electron Desktop App
    if (typeof window !== "undefined" && (window as any).electronAPI?.openGoogleLogin) {
      setSuccessMsg("Opening Google / YouTube Login window...");
      try {
        const res = await (window as any).electronAPI.openGoogleLogin();
        if (res.success && res.cookie) {
          setYouTubeSession({
            accountId: "yt_" + Date.now(),
            cookie: res.cookie,
            name: res.name || "YouTube Music User",
            email: res.email,
            profiles: [
              {
                profileId: "main",
                name: res.name || "Personal Channel",
              },
            ],
            activeProfileId: "main",
          });
          setSuccessMsg("Signed in to YouTube Music successfully!");
          setTimeout(() => setAuthModalOpen(false), 1200);
        } else if (res.error) {
          setError(res.error);
          setSuccessMsg("");
        }
      } catch (err: any) {
        setError(err.message || "Desktop login error");
        setSuccessMsg("");
      }
      return;
    }

    const res = await signInWithGoogle();
    if (res.error) {
      setError(res.error);
    }
  };

  const handleCookieImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieText.trim()) {
      setError("Please paste your YouTube Music cookie or session JSON.");
      return;
    }

    try {
      if (cookieText.trim().startsWith("{")) {
        const parsed = JSON.parse(cookieText);
        setYouTubeSession({
          accountId: parsed.id || parsed.accountId || "yt_acc_" + Date.now(),
          cookie: parsed.cookie || "",
          name: parsed.name || "YouTube Music User",
          email: parsed.email,
          profiles: parsed.profiles || [
            {
              profileId: "main",
              name: parsed.name || "Personal Channel",
            },
          ],
          activeProfileId: parsed.activeProfileId || "main",
        });
      } else {
        // Raw cookie string
        setYouTubeSession({
          accountId: "yt_cookie_" + Date.now(),
          cookie: cookieText.trim(),
          name: "YouTube Music Session",
          profiles: [
            {
              profileId: "main",
              name: "Personal Channel",
            },
          ],
          activeProfileId: "main",
        });
      }

      setSuccessMsg("YouTube Music Session Connected!");
      setTimeout(() => setAuthModalOpen(false), 1000);
    } catch (err: any) {
      setError("Invalid session format. Please paste valid session cookies.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-raaga-red to-purple-600 flex items-center justify-center text-white font-bold shadow-glow">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">
                {user && !user.isGuest ? "My Account" : "Sign In to Raaga"}
              </h3>
              <p className="text-xs text-neutral-400">
                {user && !user.isGuest
                  ? "Connected YouTube & Raaga Profile"
                  : "Sync YouTube Music library and cross-device playback"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setAuthModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Signed In State */}
        {user && !user.isGuest ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-raaga-red flex items-center justify-center text-white font-bold text-lg">
                {user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-white truncate">{user.name}</h4>
                <p className="text-xs text-neutral-400 truncate">{user.email || "YouTube Music Connected"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-raaga-cyan">
                    <Check className="w-3 h-3" /> Cloud Synced
                  </span>
                  {user.youtubeSession && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-raaga-red bg-raaga-red/10 px-1.5 py-0.5 rounded">
                      YouTube Session Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                signOut();
                setAuthModalOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          /* Sign In Options */
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex items-center p-1 rounded-2xl bg-black/40 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setTab("google");
                  setError("");
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  tab === "google"
                    ? "bg-white text-black shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <span>Google Login</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("cookie");
                  setError("");
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  tab === "cookie"
                    ? "bg-white text-black shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>YouTube Sync</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("email");
                  setError("");
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  tab === "email"
                    ? "bg-white text-black shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <span>Email</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
                {successMsg}
              </div>
            )}

            {/* 1. Google / YouTube Music One-Click OAuth */}
            {tab === "google" && (
              <div className="space-y-3 py-2">
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Sign in with your Google account to automatically connect your YouTube Music listening identity.
                </p>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white hover:bg-neutral-200 text-black font-extrabold text-sm shadow-xl hover:scale-[1.01] transition disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>
            )}

            {/* 2. YouTube Music Session Cookie Sync (App-style) */}
            {tab === "cookie" && (
              <form onSubmit={handleCookieImport} className="space-y-3">
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Import your YouTube Music session cookie or account backup (like in the Android app) to access personal YouTube playlists & brand channels:
                </p>

                <textarea
                  placeholder="Paste YouTube Music session cookie (SAPISID=... or JSON)..."
                  value={cookieText}
                  onChange={(e) => setCookieText(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-2xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-raaga-red"
                />

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-raaga-red hover:bg-raaga-redDark text-white font-bold text-xs shadow-glow transition"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Connect YouTube Music Session</span>
                </button>
              </form>
            )}

            {/* 3. Raaga Email / Password */}
            {tab === "email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:outline-none focus:border-raaga-red"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm focus:outline-none focus:border-raaga-red"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-raaga-red hover:bg-raaga-redDark text-white font-bold text-sm shadow-glow transition disabled:opacity-50"
                >
                  <span>{isLoading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError("");
                    }}
                    className="text-xs text-neutral-400 hover:text-white transition"
                  >
                    {isSignUp
                      ? "Already have an account? Sign in"
                      : "Don't have an account? Sign up"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
