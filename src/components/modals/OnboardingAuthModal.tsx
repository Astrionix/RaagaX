'use client';

import React, { useState, useEffect } from 'react';
import { Disc3, Mail, Lock, Eye, EyeOff, ChevronLeft, Loader2, X, Check, ArrowRight, User } from 'lucide-react';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { supabase } from '@/lib/supabase';
import { PersonalizationEngine } from '@/lib/recommendation/PersonalizationEngine';
import { Song } from '@/types/music';

import { UserLifecycleManager } from '@/lib/lifecycle/UserLifecycleManager';
import { AccountIsolationGuard } from '@/lib/auth/AccountIsolationGuard';

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
  ],
  Punjabi: [
    { name: 'Diljit Dosanjh', img: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_004_20221006184545_500x500.jpg' },
    { name: 'AP Dhillon', img: 'https://c.saavncdn.com/artists/AP_Dhillon_000_20210212084451_500x500.jpg' },
    { name: 'Sidhu Moose Wala', img: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_003_20220601072949_500x500.jpg' },
    { name: 'Karan Aujla', img: 'https://c.saavncdn.com/artists/Karan_Aujla_002_20230818105747_500x500.jpg' },
    { name: 'Shubh', img: 'https://c.saavncdn.com/artists/Shubh_000_20220518115655_500x500.jpg' },
    { name: 'Guru Randhawa', img: 'https://c.saavncdn.com/artists/Guru_Randhawa_002_20230104093933_500x500.jpg' }
  ],
  Bengali: [
    { name: 'Arijit Singh', img: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg' },
    { name: 'Shreya Ghoshal', img: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_003_20230104093405_500x500.jpg' },
    { name: 'Anupam Roy', img: 'https://c.saavncdn.com/artists/Anupam_Roy_002_20200810103504_500x500.jpg' },
    { name: 'Rupam Islam', img: 'https://c.saavncdn.com/artists/Rupam_Islam_002_20200810103720_500x500.jpg' },
    { name: 'Iman Chakraborty', img: 'https://c.saavncdn.com/artists/Iman_Chakraborty_000_20191223122709_500x500.jpg' },
    { name: 'Somlata Acharyya', img: 'https://c.saavncdn.com/artists/Somlata_Acharyya_Chowdhury_002_20200810103819_500x500.jpg' }
  ],
  Marathi: [
    { name: 'Ajay-Atul', img: 'https://c.saavncdn.com/artists/Ajay-Atul_002_20230104093952_500x500.jpg' },
    { name: 'Swapnil Bandodkar', img: 'https://c.saavncdn.com/artists/Swapnil_Bandodkar_002_20200810103823_500x500.jpg' },
    { name: 'Avadhoot Gupte', img: 'https://c.saavncdn.com/artists/Avadhoot_Gupte_002_20200810103513_500x500.jpg' },
    { name: 'Shreya Ghoshal', img: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_003_20230104093405_500x500.jpg' },
    { name: 'Mahesh Kale', img: 'https://c.saavncdn.com/artists/Mahesh_Kale_000_20200311130312_500x500.jpg' },
    { name: 'Bela Shende', img: 'https://c.saavncdn.com/artists/Bela_Shende_002_20200810103516_500x500.jpg' }
  ],
  Gujarati: [
    { name: 'Sachin-Jigar', img: 'https://c.saavncdn.com/artists/Sachin_Jigar_003_20230104094119_500x500.jpg' },
    { name: 'Aditya Gadhvi', img: 'https://c.saavncdn.com/artists/Aditya_Gadhvi_000_20231020063234_500x500.jpg' },
    { name: 'Kinjal Dave', img: 'https://c.saavncdn.com/artists/Kinjal_Dave_000_20200810103820_500x500.jpg' },
    { name: 'Jigarardan Gadhavi', img: 'https://c.saavncdn.com/artists/Jigrra_000_20191024101956_500x500.jpg' },
    { name: 'Geeta Rabari', img: 'https://c.saavncdn.com/artists/Geeta_Rabari_000_20200810103818_500x500.jpg' },
    { name: 'Kirtidan Gadhvi', img: 'https://c.saavncdn.com/artists/Kirtidan_Gadhvi_000_20200810103822_500x500.jpg' }
  ],
  Bhojpuri: [
    { name: 'Pawan Singh', img: 'https://c.saavncdn.com/artists/Pawan_Singh_004_20230605090659_500x500.jpg' },
    { name: 'Khesari Lal Yadav', img: 'https://c.saavncdn.com/artists/Khesari_Lal_Yadav_005_20230605090704_500x500.jpg' },
    { name: 'Shilpi Raj', img: 'https://c.saavncdn.com/artists/Shilpi_Raj_000_20220208115714_500x500.jpg' },
    { name: 'Manoj Tiwari', img: 'https://c.saavncdn.com/artists/Manoj_Tiwari_002_20200810103642_500x500.jpg' },
    { name: 'Arvind Akela Kallu', img: 'https://c.saavncdn.com/artists/Arvind_Akela_Kallu_002_20230104094132_500x500.jpg' },
    { name: 'Kalpana Patowary', img: 'https://c.saavncdn.com/artists/Kalpana_002_20200810103632_500x500.jpg' }
  ]
};

export function OnboardingAuthModal() {
  const { isAuthModalOpen, setAuthModalOpen, user } = useAuthStore();
  const { setPreferredLanguage, selectedLanguages: storeLanguages } = usePlayerStore();
  
  // Progression States: 'login' | 'register-credentials' | 'register-language' | 'register-moods' | 'register-artists'
  const [mode, setMode] = useState<'login' | 'register-credentials' | 'register-language' | 'register-moods' | 'register-artists'>('login');
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('raagax_selected_languages');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return storeLanguages && storeLanguages.length > 0 ? storeLanguages : ['Telugu'];
  });
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
        const loginName = data.session.user?.user_metadata?.full_name || 
                          data.session.user?.user_metadata?.name || 
                          data.session.user?.email?.split('@')[0] || '';
        if (loginName) {
          import('@/lib/connect/auth/DeviceNameResolver').then(({ DeviceNameResolver }) => {
            DeviceNameResolver.getInstance().setAccountDisplayName(loginName);
          }).catch(() => {});
        }
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
    if (username.trim()) {
      import('@/lib/connect/auth/DeviceNameResolver').then(({ DeviceNameResolver }) => {
        DeviceNameResolver.getInstance().setAccountDisplayName(username.trim());
      }).catch(() => {});
    }
    setMode('register-language');
  };

  const handleRegisterLanguage = () => {
    if (selectedLanguages.length === 0) {
      setErrorMsg('Please select at least one language to continue.');
      return;
    }
    setErrorMsg('');
    usePlayerStore.getState().setSelectedLanguages(selectedLanguages);
    setMode('register-moods');
  };

  const handleRegisterMoods = () => {
    setMode('register-artists');
  };

  const handleFinalizeRegister = async () => {
    setErrorMsg('');
    setIsLoading(true);
    
    const validLanguages = selectedLanguages.length > 0 ? selectedLanguages : ['Telugu'];
    usePlayerStore.getState().setSelectedLanguages(validLanguages);

    if (typeof window !== 'undefined') {
      localStorage.setItem('raagax_selected_languages', JSON.stringify(validLanguages));
      localStorage.setItem('raagax_preferred_language', validLanguages[0]);
      localStorage.setItem('raagax_preferred_artists', JSON.stringify(selectedArtists));
      localStorage.setItem('raagax_preferred_moods', JSON.stringify(selectedMoods));
      localStorage.setItem('raagax_onboarding_done', 'true');
      localStorage.setItem('raagax_onboarding_completed', 'true');
    }

    try {
      // Bootstrap recommendation engine & lifecycle manager
      UserLifecycleManager.getInstance().bootstrapFromOnboarding(validLanguages, selectedMoods, selectedArtists);
      const { ListeningDnaEngine } = await import('@/lib/lifecycle/ListeningDnaEngine');
      ListeningDnaEngine.getInstance().setInitialLanguages(validLanguages);
      
      selectedArtists.forEach(artist => {
        PersonalizationEngine.getInstance().trackEngagement({
          id: `bootstrap_${artist}`,
          title: 'Bootstrap',
          artist: artist,
          genre: '',
          category: '',
          coverUrl: '',
          duration: 180,
          provider: 'local'
        } as unknown as Song, 'complete', 180, 1.0, 'onboarding').catch(() => {});
      });
    } catch (bootstrapErr) {
      console.warn('[Onboarding] Bootstrap notice:', bootstrapErr);
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail && password) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { full_name: username.trim() || 'RaagaX Listener' } }
          });
          if (error) {
            if (error.message.includes('already registered')) {
              setErrorMsg('An account with this email already exists. Please Sign In.');
              setMode('login');
              setIsLoading(false);
              return;
            } else {
              setErrorMsg(error.message);
              setIsLoading(false);
              return;
            }
          }
          const effectiveUser = data?.session?.user || data?.user || ({
            id: `usr_${Date.now()}`,
            email: cleanEmail,
            user_metadata: { full_name: username.trim() || 'RaagaX Listener' }
          } as any);

          if (effectiveUser) {
            useAuthStore.setState({
              session: data?.session || ({ user: effectiveUser } as any),
              user: effectiveUser,
              isLoading: false,
              isAuthModalOpen: false,
            });
            AccountIsolationGuard.getInstance().setAuthenticatedUser(effectiveUser.id, 'ONBOARDING_SIGNUP');
          }

          const chosenName = username.trim() || effectiveUser?.user_metadata?.full_name || cleanEmail.split('@')[0];
          if (chosenName) {
            import('@/lib/connect/auth/DeviceNameResolver').then(({ DeviceNameResolver }) => {
              DeviceNameResolver.getInstance().setAccountDisplayName(chosenName);
            }).catch(() => {});
          }
        } catch (authEx: any) {
          console.warn('[Onboarding] Cloud auth error:', authEx);
        }
      } else {
        AccountIsolationGuard.getInstance().setAuthenticatedUser(null, 'GUEST_ONBOARDING');
      }

      setAuthModalOpen(false);
    } catch (err: any) {
      console.warn('[Onboarding] Finalize fallback:', err);
      setAuthModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!user) return; // Strict: No guest mode, authentication is mandatory
    localStorage.setItem('raagax_onboarding_done', 'true');
    setAuthModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#07080C] md:bg-black/80 flex flex-col md:items-center md:justify-center animate-in fade-in duration-300 text-[#F5F5F7] overflow-y-auto">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between p-5 pt-8 sticky top-0 bg-[#07080C] z-10">
        {mode !== 'login' && mode !== 'register-credentials' ? (
          <button
            onClick={() => {
              if (mode === 'register-artists') setMode('register-moods');
              else if (mode === 'register-moods') setMode('register-language');
              else if (mode === 'register-language') setMode('register-credentials');
            }}
            className="p-2 -ml-2 text-[#9AA0AE] hover:text-[#F5F5F7] transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : user ? (
          <button onClick={handleClose} className="p-2 -ml-2 text-[#9AA0AE] hover:text-[#F5F5F7] transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-6" />
        )}
        <div className="flex items-center gap-2 mr-4">
          <Disc3 className="w-5 h-5 text-[#F51B3D]" />
          <span className="font-bold text-lg tracking-tight">RaagaX</span>
        </div>
        <div className="w-6" />
      </div>

      {/* MAIN DESKTOP CONTAINER (Full screen on desktop, takes remaining space on mobile) */}
      <div className="w-full h-full md:h-[80vh] md:max-h-[800px] md:max-w-[1200px] flex flex-col md:flex-row relative flex-grow md:rounded-[32px] overflow-hidden md:border border-[#272A33] md:shadow-2xl bg-[#07080C]">
        
        {/* CLOSE BUTTON FOR DESKTOP — only visible if already authenticated */}
        {user && (
          <button 
            onClick={handleClose}
            title="Close"
            className="hidden md:flex absolute top-6 right-6 z-50 p-2.5 bg-black/20 hover:bg-[#171820] rounded-full text-[#9AA0AE] hover:text-white transition-all border border-transparent hover:border-[#272A33]"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* LEFT COLUMN: FORM */}
        <div className={`relative z-10 w-full ${
          mode === 'register-artists' ? 'md:w-[540px]' : 'md:w-[480px]'
        } p-6 sm:p-8 md:p-12 flex flex-col flex-shrink-0 bg-[#07080C] overflow-y-auto`}>
          
          {mode !== 'login' && mode !== 'register-credentials' && (
            <button
              type="button"
              onClick={() => {
                if (mode === 'register-artists') setMode('register-moods');
                else if (mode === 'register-moods') setMode('register-language');
                else if (mode === 'register-language') setMode('register-credentials');
              }}
              className="hidden md:inline-flex items-center gap-1.5 text-xs text-[#9AA0AE] hover:text-white mb-4 transition-colors cursor-pointer self-start"
            >
              <ChevronLeft className="w-4 h-4" /> Back to {
                mode === 'register-artists' ? 'Moods' : mode === 'register-moods' ? 'Languages' : 'Credentials'
              }
            </button>
          )}

          <div className="space-y-2 mb-8 mt-2 md:mt-4">
            <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight text-white leading-tight">
              {mode === 'login' && <>Welcome <span className="text-[#F51B3D]">back</span></>}
              {mode === 'register-credentials' && 'Join RaagaX'}
              {mode === 'register-language' && 'What languages do you listen to?'}
              {mode === 'register-moods' && 'What music moves you?'}
              {mode === 'register-artists' && 'Pick some favorites'}
            </h1>
            <p className="text-[13px] md:text-[14px] text-[#9AA0AE] font-medium">
              {mode === 'login' && 'Your music is waiting.'}
              {mode === 'register-credentials' && 'Your music. Your library. Everywhere.'}
              {mode === 'register-language' && 'Select all languages you enjoy.'}
              {mode === 'register-moods' && 'We\'ll tailor your initial discovery queue.'}
              {mode === 'register-artists' && 'We\'ll build a profile just for you.'}
            </p>
          </div>

          <div className="space-y-5 w-full flex-grow">
            {errorMsg && mode !== 'register-artists' && (
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
                const langs = selectedLanguages.length > 0 ? selectedLanguages : ['Telugu'];
                langs.forEach(lang => {
                  const list = ARTISTS_BY_LANGUAGE[lang] || ARTISTS_BY_LANGUAGE['Telugu'];
                  list.forEach(a => { if (!map.has(a.name)) map.set(a.name, a); });
                });
                if (map.size === 0) {
                  ARTISTS_BY_LANGUAGE['Telugu'].forEach(a => map.set(a.name, a));
                }
                return Array.from(map.values()).slice(0, 16);
              })();

              return (
                <div className="animate-in slide-in-from-right-4 duration-300 pb-28 md:pb-6">
                  {/* Top hint */}
                  <p className="text-xs text-[#9AA0AE] mb-3">
                    Choose favorite artists across <span className="text-white font-semibold">{selectedLanguages.join(', ')}</span>:
                  </p>

                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                    {activeArtists.map((artist) => {
                      const isSelected = selectedArtists.includes(artist.name);
                      return (
                        <button
                          key={artist.name}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedArtists(prev => prev.filter(a => a !== artist.name));
                            } else {
                              setSelectedArtists(prev => [...prev, artist.name]);
                            }
                          }}
                          className={`relative aspect-square rounded-[14px] overflow-hidden border-2 transition-all cursor-pointer group outline-none select-none ${
                            isSelected
                              ? 'border-[#F51B3D] ring-2 ring-[#F51B3D]/50 shadow-md shadow-red-500/30 scale-[1.02]'
                              : 'border-white/10 hover:border-white/30'
                          }`}
                        >
                          <img
                            src={artist.img || '/app-icon.png'}
                            alt={artist.name}
                            loading="lazy"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-x-0 bottom-0 pt-6 pb-1.5 px-1.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                            <p className={`text-[10px] sm:text-[11px] font-bold text-center truncate transition-colors ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                              {artist.name}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#F51B3D] flex items-center justify-center shadow-md shadow-red-500/50 z-20">
                              <Check className="w-3 h-3 text-white stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Fixed bottom button on mobile, relative on desktop */}
                  <div className="fixed md:relative bottom-0 left-0 right-0 md:bottom-auto px-6 md:px-0 pt-3 pb-6 md:pb-0 bg-gradient-to-t from-[#07080C] via-[#07080C]/98 to-transparent z-30 md:z-auto md:bg-none">
                    {errorMsg && (
                      <div className="mb-2 p-2.5 rounded-xl bg-[#FF4D5E]/15 border border-[#FF4D5E]/40 text-[#FF4D5E] text-xs font-semibold text-center">
                        {errorMsg}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleFinalizeRegister}
                      disabled={isLoading}
                      className={`w-full h-[52px] rounded-[16px] font-bold text-[15px] shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer group ${
                        selectedArtists.length > 0
                          ? 'bg-[#F51B3D] hover:bg-[#d91e32] text-white shadow-red-500/25'
                          : 'bg-[#101116] border border-[#272A33] text-[#9AA0AE] hover:border-[#F51B3D]/40 hover:text-white'
                      }`}
                    >
                      {isLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Setting up your profile...</>
                      ) : selectedArtists.length > 0 ? (
                        <><span>Continue with {selectedArtists.length} Artist{selectedArtists.length > 1 ? 's' : ''}</span> <ArrowRight className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" /></>
                      ) : (
                        <><span>Finish Setup</span> <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-80 group-hover:translate-x-1 transition-all" /></>
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
