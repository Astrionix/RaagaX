import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Check,
  ClipboardPaste,
  Copy,
  Crown,
  ExternalLink,
  LogOut,
  Radio,
  Share2,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { cleanCode, inviteUrl } from '@/party/invite';
import {
  createParty,
  DEFAULT_SERVER,
  joinParty,
  leaveParty,
  party,
  partyServer,
  useParty,
} from '@/party/listenTogether';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';

export function RaagaJamPopover() {
  const open = useUi((s) => s.jamOpen);
  const setJamOpen = useUi((s) => s.setJamOpen);
  const popoverRef = useRef<HTMLDivElement>(null);
  const state = useParty();
  const nowPlaying = usePlayer((s) => s.nowPlaying);
  const autoplay = usePlayer((s) => s.autoplay);
  const navigate = useNavigate();

  // Local interaction states
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // Check if the click was on a jam toggle button in the player bar
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-jam-trigger="true"]')) return;
        setJamOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setJamOpen(false);
    }
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, setJamOpen]);

  // Timers for copied checkmarks
  useEffect(() => {
    if (!copiedCode) return;
    const t = setTimeout(() => setCopiedCode(false), 2000);
    return () => clearTimeout(t);
  }, [copiedCode]);

  useEffect(() => {
    if (!copiedLink) return;
    const t = setTimeout(() => setCopiedLink(false), 2000);
    return () => clearTimeout(t);
  }, [copiedLink]);

  if (!open) return null;

  const isHost = state.you?.isHost === true;
  const custom = partyServer() && partyServer() !== DEFAULT_SERVER ? partyServer() : null;
  const currentLink = state.code ? inviteUrl(state.code, custom) : '';

  const handleStartJam = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await createParty({ autoplayEnabled: autoplay });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to start Jam session.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinJam = async (joinCode: string) => {
    const cleaned = cleanCode(joinCode);
    if (!cleaned) {
      setErrorMsg('Please enter a valid 6-character room code.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await joinParty(cleaned);
      setCode('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not join room. Check code and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = cleanCode(text);
      if (cleaned) {
        setCode(cleaned);
        void handleJoinJam(cleaned);
      } else {
        setErrorMsg('No valid 6-character Jam code found on clipboard.');
      }
    } catch {
      setErrorMsg('Unable to access clipboard. Please paste code manually.');
    }
  };

  const handleShare = async () => {
    if (!currentLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Raaga Jam',
          text: `Listen along with me in real-time on Raaga Music! Room code: ${state.code}`,
          url: currentLink,
        });
        return;
      } catch {
        // User cancelled or unsupported, fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(currentLink);
    setCopiedLink(true);
  };

  return (
    <>
      {/* Mobile backdrop scrim */}
      <div
        className="fixed inset-0 z-[calc(var(--z-web-chrome)+10)] bg-black/60 backdrop-blur-xs sm:hidden animate-in fade-in duration-200"
        onClick={() => setJamOpen(false)}
        aria-hidden="true"
      />

      {/* Floating Popover Container: slides up from bottom on mobile, sits above player pill on desktop */}
      <aside
        ref={popoverRef}
        aria-label="Raaga Jam Popover"
        className={[
          'fixed z-[calc(var(--z-web-chrome)+12)] flex flex-col overflow-hidden',
          'border border-white/15 bg-neutral-950/85 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] ring-1 ring-white/10',
          // Mobile style: docked bottom sheet
          'inset-x-2 bottom-20 max-sm:bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] max-sm:rounded-3xl max-sm:max-h-[82vh]',
          // Desktop & Tablet style: elegant floating card above the player bar
          'sm:bottom-[calc(var(--player-bottom-offset)+var(--player-pill-height)+14px)] sm:left-1/2 sm:-translate-x-1/2 sm:w-[460px] sm:rounded-2xl',
          'animate-in fade-in zoom-in-95 duration-200 ease-out',
        ].join(' ')}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Users size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-white">Raaga Jam</span>
                {state.code && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 leading-none mt-0.5">
                {state.code ? `${state.members.length} listening in sync` : 'Real-time collaborative audio'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid size-7 place-items-center rounded-lg text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => {
                setJamOpen(false);
                navigate('/jam');
              }}
              title="Open full page Jam"
            >
              <ExternalLink size={15} />
            </button>
            <button
              type="button"
              className="grid size-7 place-items-center rounded-lg text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => setJamOpen(false)}
              aria-label="Close Jam window"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Popover Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 [scrollbar-width:thin]">
          {errorMsg && (
            <div className="flex items-center justify-between rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-300">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-400 hover:text-white ml-2"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* STATE A: ACTIVE JAM IN PROGRESS */}
          {state.code ? (
            <div className="space-y-4">
              {/* Room Code Showcase Box */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-white/[0.04] to-transparent p-4 border border-emerald-500/20 text-center">
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Radio size={13} className="animate-pulse" />
                    Room Connected
                  </span>
                  <span className="text-[11px]">
                    {state.clockSynced ? `Synced · ${state.roundTripMs}ms ping` : 'Synchronizing clock…'}
                  </span>
                </div>

                <div className="my-2 select-all font-mono text-3xl font-extrabold tracking-[0.22em] text-white">
                  {state.code}
                </div>

                <p className="text-[11px] text-neutral-400 mb-3">
                  Share this code or link with friends to listen together
                </p>

                {/* Quick Action Buttons */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(state.code!);
                      setCopiedCode(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white active:scale-95 transition-all"
                  >
                    {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copiedCode ? 'Code Copied' : 'Copy Code'}
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 active:scale-95 transition-all shadow-sm"
                  >
                    {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                    {copiedLink ? 'Link Copied!' : 'Share Invite'}
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Listeners ({state.members.length}/{state.maxMembers})
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {isHost ? 'You are Host' : 'Synced with Host'}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto [scrollbar-width:thin]">
                  {state.members.map((member) => {
                    const isYou = member.userId === state.you?.userId;
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between rounded-xl bg-white/[0.04] hover:bg-white/[0.07] px-3 py-2 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative">
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.displayName}
                                className="size-7 rounded-full object-cover ring-1 ring-white/20"
                              />
                            ) : (
                              <div className="grid size-7 place-items-center rounded-full bg-emerald-600/30 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/40">
                                {member.displayName.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            {member.isHost && (
                              <div className="absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full bg-amber-400 text-black shadow-xs">
                                <Crown size={9} className="stroke-[2.5]" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-white flex items-center gap-1.5">
                              {member.displayName}
                              {isYou && (
                                <span className="rounded-sm bg-white/10 px-1 py-0.2 text-[9px] text-neutral-400">
                                  You
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {member.isHost ? (
                            <span className="text-[10px] font-semibold text-amber-400">Host</span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Sync
                            </span>
                          )}
                          {isHost && !isYou && (
                            <button
                              type="button"
                              className="text-neutral-500 hover:text-red-400 text-xs ml-1"
                              title={`Remove ${member.displayName}`}
                              onClick={() => void party.kick(member.memberId)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leave Session Bar */}
              <div className="pt-1 flex items-center justify-between border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setJamOpen(false);
                    navigate('/jam');
                  }}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Full Jam Management →
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void leaveParty();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-300 active:scale-95 transition-all"
                >
                  <LogOut size={13} />
                  Leave Jam
                </button>
              </div>
            </div>
          ) : (
            /* STATE B: NOT IN JAM (START OR JOIN) */
            <div className="space-y-4">
              {/* Hero Banner */}
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent p-4 border border-emerald-500/30">
                <div className="flex items-center gap-2 text-emerald-400 mb-1.5">
                  <Sparkles size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Sync Music With Friends</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Start a private Jam room to stream songs together in real-time. Pauses, skips, and queue additions synchronize across all devices.
                </p>

                {/* Now Playing preview if playing */}
                {nowPlaying && (
                  <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-black/40 p-2 border border-white/10">
                    {nowPlaying.artworkUrl && (
                      <img
                        src={nowPlaying.artworkUrl}
                        alt=""
                        className="size-8 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Current Track</p>
                      <p className="truncate text-xs font-semibold text-white">{nowPlaying.title}</p>
                    </div>
                  </div>
                )}

                {/* Start Jam Button */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStartJam}
                  className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] py-2.5 text-xs font-bold text-black transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Zap size={14} className="fill-black" />
                  {loading ? 'Creating Jam Room…' : 'Start a Jam Room'}
                </button>
              </div>

              {/* Join With Code */}
              <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/10 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Join an Existing Jam
                </span>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleJoinJam(code);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={code}
                    maxLength={7}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ENTER 6-DIGIT CODE"
                    className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center font-mono text-sm uppercase tracking-widest text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={!cleanCode(code) || loading}
                    className="flex-none rounded-xl bg-white/15 hover:bg-white/20 active:scale-95 px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-40"
                  >
                    Join
                  </button>
                </form>

                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-emerald-400 transition-colors"
                  >
                    <ClipboardPaste size={12} />
                    Paste code from clipboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
