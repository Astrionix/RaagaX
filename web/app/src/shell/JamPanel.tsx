import { useState, useCallback, useEffect } from 'react';
import {
  Check,
  Copy,
  Crown,
  Headphones,
  ListMusic,
  LogOut,
  Play,
  Pause,
  Radio,
  RotateCw,
  Share2,
  Shield,
  ShieldAlert,
  SkipForward,
  UserMinus,
  Users,
  Wifi,
  Zap,
  X,
} from 'lucide-react';
import { Artwork } from '@/components/music/Artwork';
import { JamIcon } from '@/components/icons/JamIcon';
import {
  cleanCode,
  inviteUrl,
  isLocalAddress,
  parseCodeAndServer,
} from '@/party/invite';
import {
  controlsLocked,
  createParty,
  joinParty,
  leaveParty,
  party,
  partyServer,
  useNearbyJams,
  useParty,
  DEFAULT_SERVER,
  probeLocalJam,
  type LocalJamInfo,
  type NearbyJam,
} from '@/party/listenTogether';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';
import { useYtAuth } from '@/extension/useYtAuth';

export function JamPanel() {
  const closeSidePanel = useUi((s) => s.closeSidePanel);
  const partyState = useParty();
  const inParty = Boolean(partyState.code);

  return (
    <div className="flex h-full flex-col select-none overflow-hidden text-primary">
      {/* Top Header Bar */}
      <div className="flex h-14 flex-none items-center justify-between border-b border-quaternary px-5">
        <div className="flex items-center gap-2.5">
          <div
            className={`grid size-8 place-items-center rounded-lg transition-colors ${
              inParty ? 'bg-green/15 text-green' : 'bg-key/10 text-key'
            }`}
          >
            <JamIcon size={18} />
          </div>
          <div>
            <h3 className="type-title-3-emphasized leading-none text-primary">
              {inParty ? 'Live Jam' : 'Start a Jam'}
            </h3>
            <p className="text-[11px] text-secondary mt-0.5 leading-none">
              {inParty
                ? `${partyState.members.length} ${partyState.members.length === 1 ? 'person' : 'people'} listening`
                : 'Listen together with friends'}
            </p>
          </div>
        </div>
        <button
          className="grid size-8 place-items-center rounded-lg text-secondary hover:bg-quaternary hover:text-primary active:scale-95 transition-all cursor-pointer"
          aria-label="Close Jam panel"
          onClick={closeSidePanel}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-width:thin]">
        {inParty ? <ActiveJamView state={partyState} /> : <IdleJamView />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STATE 1: IDLE JAM (Start or Join)
// ---------------------------------------------------------------------------

function IdleJamView() {
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local Wi-Fi Nearby Discovery Store
  const nearbyJams = useNearbyJams((s) => s.nearbyJams);
  const isScanningNearby = useNearbyJams((s) => s.isScanning);
  const scanNearby = useNearbyJams((s) => s.scan);

  // Auto-scan for nearby Jams on local Wi-Fi when panel is opened
  useEffect(() => {
    void scanNearby();
    const timer = setInterval(() => void scanNearby(), 20_000);
    return () => clearInterval(timer);
  }, [scanNearby]);



  const autoplay = usePlayer((s) => s.autoplay);
  const authStatus = useYtAuth();
  const signedIn = authStatus.state === 'ready' && authStatus.auth.signedIn;
  const activeAccount = authStatus.state === 'ready' && authStatus.auth.signedIn ? authStatus.auth.active : null;

  const handleStartJam = async () => {
    setIsStarting(true);
    setErrorMessage(null);
    try {
      await createParty({ autoplayEnabled: autoplay });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not start Jam session.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleJoinJam = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCodeAndServer(joinCodeInput);
    const code = parsed.code;
    if (!code) {
      setErrorMessage('Please enter a valid 6-character Jam code.');
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);
    try {
      await joinParty(code, parsed.serverUrl || null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to join Jam. Check code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. NEARBY JAMS ON THIS WI-FI (AVAILABLE DEVICES) */}
      {nearbyJams.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-green/30 bg-green/5 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-75 animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-green" />
              </span>
              <span className="text-[11px] font-bold text-green uppercase tracking-wider">
                Available Jams ({nearbyJams.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => void scanNearby()}
              disabled={isScanningNearby}
              className="text-[10px] text-green/80 font-medium hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Rescan Wi-Fi for Jams"
            >
              <RotateCw size={10} className={isScanningNearby ? 'animate-spin' : ''} />
              <span>{isScanningNearby ? 'Scanning…' : 'Scan'}</span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {nearbyJams.map((jam) => (
              <div
                key={`${jam.host}-${jam.code}`}
                className="flex flex-col gap-2 rounded-xl border border-quaternary/60 bg-quinary/90 p-3 hover:border-green/40 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="grid size-7 flex-none place-items-center rounded-lg bg-green/15 text-green">
                      <JamIcon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-primary">{jam.hostName}</p>
                      <p className="text-[10px] text-secondary">
                        {jam.members} {jam.members === 1 ? 'person' : 'people'} listening
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-green/15 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-green">
                    {jam.code}
                  </span>
                </div>

                {jam.title && (
                  <div className="flex items-center gap-2.5 rounded-lg bg-page/70 p-1.5 border border-quaternary/30">
                    <div className="size-8 flex-none rounded overflow-hidden bg-quaternary">
                      {jam.thumbnailUrl ? (
                        <Artwork src={jam.thumbnailUrl} displayWidth={32} radius="4px" />
                      ) : (
                        <div className="grid size-full place-items-center text-secondary">
                          <Headphones size={12} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-primary">{jam.title}</p>
                      <p className="truncate text-[10px] text-secondary">{jam.artist || 'Unknown'}</p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    setIsJoining(true);
                    setErrorMessage(null);
                    try {
                      await joinParty(jam.code, jam.host);
                    } catch (err: any) {
                      setErrorMessage(err?.message || 'Could not join nearby Jam.');
                    } finally {
                      setIsJoining(false);
                    }
                  }}
                  disabled={isJoining}
                  className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-green font-bold text-xs text-black shadow-sm hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  <Zap size={12} className="fill-current" />
                  <span>Join {jam.hostName}'s Jam</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero Visual Card */}
      <div className="relative overflow-hidden rounded-2xl border border-quaternary bg-quinary/80 p-5 text-center shadow-sm">
        <div className="mx-auto mb-3.5 grid size-13 place-items-center rounded-xl bg-key/10 text-key shadow-sm">
          <JamIcon size={26} />
        </div>

        <h4 className="type-title-2-emphasized text-primary mb-1.5 font-bold">Listen together</h4>
        <p className="type-callout text-secondary leading-relaxed max-w-[240px] mx-auto mb-4">
          Queue songs, invite friends, and listen in synchronized real-time across phones and computers.
        </p>

        {/* Start Button */}
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-key px-4 font-semibold text-white shadow-md shadow-key/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          onClick={handleStartJam}
          disabled={isStarting}
        >
          {isStarting && (
            <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          <span>{isStarting ? 'Starting session…' : 'Start a Jam'}</span>
        </button>
      </div>

      {/* Join with a Code Section */}
      <div className="rounded-2xl border border-quaternary bg-quinary/80 p-4 shadow-sm">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Radio size={13} className="text-secondary" />
          <h5 className="type-callout-emphasized text-secondary uppercase tracking-wider text-[11px]">
            Join a Friend's Jam
          </h5>
        </div>

        <form onSubmit={handleJoinJam} className="flex gap-2">
          <input
            type="text"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
            placeholder="CODE (e.g. ABC123)"
            className="flex-1 min-w-0 h-10 rounded-xl border border-quaternary bg-page px-3 text-center font-mono text-[13px] font-bold tracking-widest uppercase text-primary placeholder:text-secondary/40 placeholder:font-sans placeholder:tracking-normal placeholder:text-xs placeholder:font-normal focus:border-key focus:ring-1 focus:ring-key focus:outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!joinCodeInput.trim() || isJoining}
            className="h-10 px-4 rounded-xl bg-primary text-page font-semibold text-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none shrink-0 cursor-pointer"
          >
            {isJoining ? 'Joining…' : 'Join'}
          </button>
        </form>
      </div>

      {/* Feature Highlights */}
      <div className="rounded-2xl border border-quaternary bg-quinary/50 p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-7 flex-none place-items-center rounded-lg bg-quaternary/70 text-primary">
            <Headphones size={14} />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Real-time sync</p>
            <p className="text-[11px] text-secondary">Synchronized audio down to milliseconds</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="grid size-7 flex-none place-items-center rounded-lg bg-quaternary/70 text-primary">
            <ListMusic size={14} />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Shared queue</p>
            <p className="text-[11px] text-secondary">Friends can add their favorite tracks</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="grid size-7 flex-none place-items-center rounded-lg bg-quaternary/70 text-primary">
            <Users size={14} />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary">Cross-platform</p>
            <p className="text-[11px] text-secondary">Works across web, desktop, and mobile</p>
          </div>
        </div>
      </div>

      {/* Account Info Badge */}
      {signedIn && activeAccount && (
        <div className="flex items-center gap-2.5 rounded-xl border border-quaternary bg-quinary/50 px-3 py-2 text-xs text-secondary">
          {activeAccount.avatarUrl ? (
            <img src={activeAccount.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
          ) : (
            <span className="grid size-6 place-items-center rounded-full bg-quaternary font-bold text-primary">
              {activeAccount.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate">
            Jams as <strong className="text-primary font-semibold">{activeAccount.name}</strong>
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl bg-red/10 border border-red/25 px-3 py-2.5 text-xs text-red">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STATE 2: ACTIVE JAM SESSION
// ---------------------------------------------------------------------------

function ActiveJamView({ state }: { state: ReturnType<typeof useParty.getState> }) {
  const [copied, setCopied] = useState(false);
  const [copiedLan, setCopiedLan] = useState(false);
  const player = usePlayer();
  const you = state.you;
  const isHost = you?.isHost === true;
  const locked = controlsLocked(state);

  const server = partyServer();
  const isLan = Boolean(
    server &&
      (isLocalAddress(new URL(server.startsWith('http') ? server : `http://${server}`).hostname) ||
        server.includes('localhost') ||
        server.includes('127.0.0.1'))
  );
  const isLocal = !server || server === DEFAULT_SERVER || server.includes('localhost') || server.includes('127.0.0.1');
  const custom = isLocal && !isLan ? null : server;
  const link = state.code ? inviteUrl(state.code, custom) : '';

  const copyInvite = useCallback(() => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [link]);

  const copyLanCode = useCallback(() => {
    if (!state.code || !server) return;
    try {
      const url = new URL(server.startsWith('http') ? server : `http://${server}`);
      const hostWithPort = `${url.hostname}:${url.port || 8890}`;
      navigator.clipboard.writeText(`${state.code}@${hostWithPort}`);
      setCopiedLan(true);
      setTimeout(() => setCopiedLan(false), 2000);
    } catch {
      // fallback
    }
  }, [state.code, server]);

  const toggleHostOnly = () => {
    party.setHostOnlyControl(!state.hostOnlyControl);
  };

  const statusText =
    state.connection === 'live'
      ? state.clockSynced
        ? `In sync · ${state.roundTripMs} ms latency`
        : 'Synchronizing clock…'
      : state.connection === 'connecting'
        ? 'Reconnecting…'
        : 'Offline';

  const currentTrack = state.playback.track || (player.nowPlaying ? {
    videoId: player.nowPlaying.videoId,
    title: player.nowPlaying.title,
    artist: player.nowPlaying.artist,
    thumbnailUrl: player.nowPlaying.artworkUrl,
  } : null);

  return (
    <div className="flex flex-col gap-4">
      {/* Session Code & Share Box */}
      <div className="relative overflow-hidden rounded-2xl border border-green/30 bg-green/5 p-4 text-center shadow-sm">

        <p className="text-[11px] font-semibold tracking-wider text-green uppercase">Session Code</p>
        <p className="my-1.5 type-large-title-emphasized font-mono tracking-[0.25em] text-primary select-all">
          {state.code}
        </p>
        <p className="text-[11px] text-secondary mb-3">{statusText}</p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-quaternary bg-quaternary/70 px-3.5 text-xs font-semibold text-primary hover:bg-quaternary active:scale-95 transition-all cursor-pointer"
            onClick={copyInvite}
          >
            {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
            <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </button>
          {isLan && (
            <button
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-green/30 bg-green/10 px-3 text-xs font-semibold text-green hover:bg-green/20 active:scale-95 transition-all cursor-pointer"
              onClick={copyLanCode}
              title="Copy direct CODE@IP format for friends on same Wi-Fi"
            >
              {copiedLan ? <Check size={13} /> : <Zap size={13} />}
              <span>{copiedLan ? 'LAN Code Copied!' : 'Copy LAN Code'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Now Playing in Jam */}
      {currentTrack && (
        <div className="rounded-2xl border border-quaternary bg-quinary/80 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Now Playing</span>
            {state.playback.startedByName && (
              <span className="text-[11px] text-secondary truncate max-w-[150px]">
                queued by {state.playback.startedByName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="size-10 flex-none rounded-[6px] overflow-hidden bg-quaternary">
              <Artwork src={currentTrack.thumbnailUrl} displayWidth={40} radius="var(--radius-artwork-small)" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate type-callout-emphasized text-primary">{currentTrack.title}</p>
              <p className="truncate text-[11px] text-secondary">{currentTrack.artist}</p>
            </div>
            {!locked && (
              <div className="flex items-center gap-1">
                <button
                  className="grid size-8 place-items-center rounded-lg bg-quaternary hover:bg-quaternary/80 text-primary active:scale-90 transition-all cursor-pointer"
                  onClick={() => (state.playback.isPlaying ? party.pause() : party.play())}
                  aria-label={state.playback.isPlaying ? 'Pause' : 'Play'}
                >
                  {state.playback.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  className="grid size-8 place-items-center rounded-lg bg-quaternary hover:bg-quaternary/80 text-primary active:scale-90 transition-all cursor-pointer"
                  onClick={() => party.next()}
                  aria-label="Next song"
                >
                  <SkipForward size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members Section */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Users size={13} />
            Listeners ({state.members.length} of {state.maxMembers})
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-quaternary bg-quinary/60 p-2 shadow-sm">
          {state.members.map((m) => {
            const isSelf = m.memberId === you?.memberId;
            return (
              <div
                key={m.memberId}
                className="flex items-center justify-between rounded-xl px-2.5 py-1.5 hover:bg-quaternary/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" className="size-6 rounded-full object-cover flex-none" />
                  ) : (
                    <span className="grid size-6 flex-none place-items-center rounded-full bg-quaternary text-[11px] font-bold text-primary">
                      {m.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="truncate type-callout text-primary">
                    {m.displayName}
                    {isSelf && <span className="text-secondary text-[11px] font-normal"> (you)</span>}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-none">
                  {m.isHost && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded-md">
                      <Crown size={12} />
                      Host
                    </span>
                  )}
                  <span
                    className={`size-2 rounded-full ${m.connected ? 'bg-green shadow-[0_0_6px_#22c55e]' : 'bg-secondary/40'}`}
                    title={m.connected ? 'Connected' : 'Reconnecting'}
                  />
                  {isHost && !isSelf && (
                    <button
                      className="grid size-6 place-items-center rounded-md text-secondary hover:text-red hover:bg-red/10 active:scale-90 transition-all cursor-pointer"
                      title={`Remove ${m.displayName}`}
                      onClick={() => party.kick(m.memberId)}
                    >
                      <UserMinus size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Host DJ Permissions */}
      {isHost && (
        <div className="rounded-2xl border border-quaternary bg-quinary/60 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-quaternary/70 text-primary">
                {state.hostOnlyControl ? (
                  <ShieldAlert size={15} className="text-amber-500" />
                ) : (
                  <Shield size={15} className="text-green" />
                )}
              </div>
              <div>
                <p className="type-callout-emphasized text-primary">Host-only controls</p>
                <p className="text-[11px] text-secondary">
                  {state.hostOnlyControl
                    ? 'Only you can pause, skip, and pick songs'
                    : 'Collaborative: anyone in the Jam can DJ'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleHostOnly}
              className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
                state.hostOnlyControl ? 'bg-key' : 'bg-quaternary'
              }`}
              role="switch"
              aria-checked={state.hostOnlyControl}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
                  state.hostOnlyControl ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Leave / End Jam Button */}
      <div className="pt-1">
        <button
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red/30 bg-red/10 text-xs font-semibold text-red hover:bg-red/20 active:scale-[0.98] transition-all cursor-pointer"
          onClick={() => void leaveParty()}
        >
          <LogOut size={14} />
          <span>{isHost ? 'End Jam for Everyone' : 'Leave Jam'}</span>
        </button>
      </div>
    </div>
  );
}
