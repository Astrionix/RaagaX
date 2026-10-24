import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Copy, Crown, LogOut, QrCode, Radio, Share2, Sparkles, UserMinus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useSignedIn } from '@/data/music/queries';
import { cleanCode, inviteUrl } from '@/party/invite';
import {
  controlsLocked,
  createParty,
  DEFAULT_SERVER,
  joinParty,
  leaveParty,
  messageOf,
  party,
  partyServer,
  partySettings,
  previewParty,
  savePartySettings,
  useParty,
} from '@/party/listenTogether';
import { usePlayer } from '@/state/player';
import { Toggle } from './IntegrationSettings';
import { settingsUi } from './settingsStyles';

const lede = 'mx-4 mb-4 type-body-tall text-secondary';
const error = 'mx-4 mt-3 type-callout text-red';
const primary = 'flex-none rounded-pill bg-key-bg hover:brightness-110 active:scale-95 px-5 py-2 type-body-emphasized text-white disabled:opacity-45 transition-all shadow-md';
const invite = 'flex flex-col items-center gap-3.5 rounded-2xl glass-material border border-white/10 px-5 py-7 text-center shadow-lg';
const inviteCode = 'type-[700_40px/48px] tracking-[0.2em] font-mono text-primary select-all';

/**
 * Raaga Jam (Collaborative Real-Time Listening):
 * Start a jam session or join by 6-letter room code or invite link.
 * Synchronizes playback across all phones, tablets, and desktop computers in real-time.
 */
export default function ListenTogetherPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const inviteCode = params.code ? cleanCode(params.code) : null;
  const inviteServer = search.get('server');
  const state = useParty();
  const signedIn = useSignedIn();

  return (
    <div className={settingsUi.centered}>
      <PageHeader title="Raaga Jam" />
      <div className={settingsUi.body}>
        {state.code ? (
          <InParty />
        ) : inviteCode ? (
          <InviteCard code={inviteCode} server={inviteServer} signedIn={signedIn} />
        ) : (
          <StartOrJoin signedIn={signedIn} />
        )}
        {state.error && <p className={error}>{state.error}</p>}
      </div>
    </div>
  );
}

function StartOrJoin({ signedIn }: { signedIn: boolean }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [settings, setSettings] = useState(partySettings);
  const autoplay = usePlayer((s) => s.autoplay);
  const nowPlaying = usePlayer((s) => s.nowPlaying);
  const create = useMutation({ mutationFn: () => createParty({ autoplayEnabled: autoplay }) });
  const update = (change: Partial<typeof settings>) => {
    savePartySettings(change);
    setSettings(partySettings());
  };

  return (
    <>
      <div className="mx-4 mb-6 rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-600/15 via-black/40 to-transparent p-5 backdrop-blur-xl shadow-glass">
        <div className="flex items-center gap-2.5 text-red-400 mb-2">
          <Radio size={22} className="animate-pulse" />
          <span className="type-title-3-emphasized text-primary">Collaborative Live Listening</span>
        </div>
        <p className="type-body text-secondary leading-relaxed">
          Start a <strong>Raaga Jam</strong> to listen to the same songs in perfect sync with your friends on mobile, desktop, or tablet. Anyone in the Jam can queue songs, play, pause, or skip!
        </p>
      </div>

      <section className={settingsUi.group}>
        <div className={settingsUi.row}>
          <span className={settingsUi.rowText}>
            <span className="font-semibold text-primary">Start a New Jam</span>
            <span className={settingsUi.rowDetail}>
              {nowPlaying ? `Will start playing "${nowPlaying.title}"` : 'Whatever you’re playing comes with you.'}
            </span>
          </span>
          <button
            className={primary}
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Starting…' : 'Start Jam'}
          </button>
        </div>

        <form
          className={settingsUi.controlRow}
          onSubmit={(e) => {
            e.preventDefault();
            const cleaned = cleanCode(code);
            if (cleaned) navigate(`/jam/${cleaned}`);
          }}
        >
          <span className="font-semibold text-primary">Join with a Code</span>
          <span className="flex items-center gap-2">
            <input
              className="w-[120px] flex-none rounded-xl border border-white/10 bg-quaternary px-3 py-1.5 text-center font-mono type-body tracking-[0.14em] text-primary uppercase focus:border-red-500/50"
              value={code}
              maxLength={7}
              placeholder="ABC123"
              aria-label="Jam code"
              onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
            />
            <button className={primary} type="submit" disabled={!cleanCode(code)}>
              Join
            </button>
          </span>
        </form>
      </section>

      <h2 className={settingsUi.sectionHeader}>Your Profile in Jam</h2>
      <section className={settingsUi.group}>
        <label className={settingsUi.controlRow}>
          <span>Display Name</span>
          <input
            className={settingsUi.input}
            placeholder={signedIn ? 'Your YouTube name' : 'e.g. Rahul, Sneha'}
            value={settings.nickname}
            maxLength={80}
            onChange={(e) => update({ nickname: e.currentTarget.value })}
          />
        </label>
        <label className={settingsUi.controlRow}>
          <span>Jam Server</span>
          <input
            className={settingsUi.input}
            placeholder={new URL(DEFAULT_SERVER).host}
            value={settings.customServer}
            onChange={(e) => update({ customServer: e.currentTarget.value })}
          />
        </label>
      </section>
      <p className={settingsUi.footer}>
        {signedIn
          ? 'You are signed in to YouTube Music. Friends will see your name and avatar.'
          : 'You can join as a guest or sign in for your YouTube Music profile.'}
      </p>
    </>
  );
}

/** An invite: who's in it, then a tap to join */
function InviteCard({ code, server, signedIn }: { code: string; server: string | null; signedIn: boolean }) {
  const preview = useQuery({ queryKey: ['party', 'preview', code, server], queryFn: () => previewParty(code, server), retry: false });
  const join = useMutation({ mutationFn: () => joinParty(code, server) });
  const data = preview.data;

  return (
    <div className={invite}>
      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full text-xs font-semibold">
        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        Live Raaga Jam
      </div>
      <p className={inviteCode}>{code}</p>
      {preview.isPending && <p className={settingsUi.footer}>Connecting to Jam…</p>}
      {preview.isError && <p className={error}>{messageOf(preview.error)}</p>}
      {data && (
        <>
          <p className={lede}>
            {data.hostName ? `${data.hostName}’s Jam` : 'Raaga Jam Session'}
            {data.memberCount ? ` · ${data.memberCount} of ${data.maxMembers} listening` : ''}
          </p>
          <div className="flex -space-x-2 overflow-hidden py-1">
            {data.members.map((m, i) => (
              <Avatar key={i} name={m.displayName} url={m.avatarUrl} large />
            ))}
          </div>
        </>
      )}
      <button
        className="mt-2 flex-none rounded-pill bg-key-bg hover:brightness-110 active:scale-95 px-8 py-2.5 type-title-3-emphasized text-white disabled:opacity-45 transition-all shadow-lg"
        disabled={join.isPending || data?.isFull || preview.isError}
        onClick={() => join.mutate()}
      >
        {data?.isFull ? 'This Jam is full' : join.isPending ? 'Joining…' : 'Tap to Join Jam'}
      </button>
    </div>
  );
}

function Avatar({ name, url, large = false }: { name: string; url: string | null; large?: boolean }) {
  const className = `grid place-items-center rounded-full bg-quaternary border-2 border-black/50 object-cover type-callout-emphasized shadow-sm ${large ? 'size-10' : 'size-7'}`;
  return url ? (
    <img className={className} src={url} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className={className}>{name ? name.slice(0, 1).toUpperCase() : 'J'}</span>
  );
}

function InParty() {
  const state = useParty();
  const navigate = useNavigate();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const isHost = state.you?.isHost === true;
  const locked = controlsLocked(state);
  const custom = partyServer() && partyServer() !== DEFAULT_SERVER ? partyServer() : null;
  const link = inviteUrl(state.code!, custom);

  useEffect(() => {
    if (!copiedLink) return;
    const t = setTimeout(() => setCopiedLink(false), 2000);
    return () => clearTimeout(t);
  }, [copiedLink]);

  useEffect(() => {
    if (!copiedCode) return;
    const t = setTimeout(() => setCopiedCode(false), 2000);
    return () => clearTimeout(t);
  }, [copiedCode]);

  const status =
    state.connection === 'live'
      ? state.clockSynced
        ? `In Sync · ${state.roundTripMs} ms latency`
        : 'Measuring clock sync…'
      : state.connection === 'connecting'
        ? 'Reconnecting to Jam…'
        : 'Offline';

  return (
    <>
      <div className={invite}>
        <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          {status}
        </div>

        <div>
          <span className="text-xs uppercase tracking-widest text-secondary font-medium">Jam Room Code</span>
          <p className={inviteCode}>{state.code}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-pill bg-quaternary hover:bg-quinary px-3.5 py-1.5 type-callout-emphasized text-primary active:scale-95 transition-all"
            onClick={() => void navigator.clipboard.writeText(state.code!).then(() => setCopiedCode(true))}
            title="Copy 6-letter Room Code"
          >
            {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copiedCode ? 'Code Copied' : 'Copy Code'}
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-pill bg-key-bg hover:brightness-110 px-4 py-1.5 type-callout-emphasized text-white active:scale-95 transition-all shadow-sm"
            onClick={() => void navigator.clipboard.writeText(link).then(() => setCopiedLink(true))}
            title={link}
          >
            {copiedLink ? <Check size={14} /> : <Share2 size={14} />}
            {copiedLink ? 'Link Copied!' : 'Share Jam Link'}
          </button>

          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 type-callout-emphasized transition-all active:scale-95 ${
              showQr ? 'bg-white text-black' : 'bg-quaternary hover:bg-quinary text-primary'
            }`}
            onClick={() => setShowQr(!showQr)}
            title="Scan QR Code to join on phone"
          >
            <QrCode size={14} />
            {showQr ? 'Hide QR' : 'Scan QR'}
          </button>
        </div>

        {showQr && (
          <div className="mt-2 flex flex-col items-center gap-2 rounded-2xl bg-black/50 p-4 border border-white/10 shadow-inner">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}&color=ffffff&bgcolor=18181b`}
              alt="Scan to join Jam"
              className="size-40 rounded-xl object-contain shadow-md"
              loading="lazy"
            />
            <p className="text-xs text-secondary">Scan with your phone camera to join instantly</p>
          </div>
        )}
      </div>

      <h2 className={settingsUi.sectionHeader}>
        Listening in Jam · {state.members.length} of {state.maxMembers}
      </h2>
      <section className={settingsUi.group}>
        {state.members.map((m) => (
          <div key={m.memberId} className={settingsUi.integrationPlain}>
            <Avatar name={m.displayName} url={m.avatarUrl} />
            <span className={settingsUi.integrationName}>
              {m.displayName}
              {m.memberId === state.you?.memberId && <span className="text-secondary font-medium"> (you)</span>}
            </span>
            <span className={settingsUi.value}>
              {m.isHost && (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                  <Crown size={14} /> Host
                </span>
              )}
              <span
                className="size-2 rounded-full bg-quaternary data-on:bg-emerald-400"
                data-on={m.connected || undefined}
                title={m.connected ? 'Connected' : 'Reconnecting'}
              />
              {isHost && m.memberId !== state.you?.memberId && (
                <button
                  className={settingsUi.inlineButton}
                  onClick={() => party.kick(m.memberId)}
                  title="Remove from the Jam"
                >
                  <UserMinus size={13} />
                </button>
              )}
            </span>
          </div>
        ))}
      </section>

      <h2 className={settingsUi.sectionHeader}>Jam Controls</h2>
      <section className={settingsUi.group}>
        <Toggle
          label="AutoPlay"
          detail="Keep the Jam going with matching music when the queue runs out."
          checked={state.playback.autoplayEnabled}
          onChange={(on) => !locked && party.setAutoplay(on)}
        />
        {isHost && (
          <Toggle
            label="Host Only Control"
            detail="Only you can play, pause, seek, or change songs. Others can listen."
            checked={state.hostOnlyControl}
            onChange={party.setHostOnlyControl}
          />
        )}
      </section>
      {locked && (
        <p className={settingsUi.footer}>
          The host has locked playback controls. You can still pause your own local speaker.
        </p>
      )}

      {state.activity.length > 0 && (
        <>
          <h2 className={settingsUi.sectionHeader}>Recent Activity</h2>
          <section className={settingsUi.group}>
            {state.activity.slice(0, 8).map((a, i) => (
              <div key={i} className={settingsUi.row}>
                <span className={settingsUi.rowText}>
                  <span>
                    <strong>{a.by}</strong> · {a.action}
                  </span>
                  {a.detail && <span className={settingsUi.rowDetail}>{a.detail}</span>}
                </span>
                <span className={settingsUi.rowDetail}>
                  {new Date(a.atMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      <button
        className="mx-4 mt-6 inline-flex items-center gap-2 type-body-emphasized text-red hover:text-red-400 transition-colors"
        onClick={() => void leaveParty().then(() => navigate('/jam'))}
      >
        <LogOut size={16} />
        Leave Jam Session
      </button>
    </>
  );
}
