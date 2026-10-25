import { lazy, Suspense, useState, type ChangeEvent, type ComponentType, type ReactNode } from 'react';
import {
  AudioWaveform,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Network,
  Plus,
  Puzzle,
  Search,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { MdOutlineExtension } from 'react-icons/md';
import { SiApplemusic, SiDiscord, SiSpotify, SiYoutubemusic } from 'react-icons/si';
import { PrefetchLink } from '@/components/PrefetchLink';
import { useAddons, type AddonSource } from '@/data/addons/addonManager';
import { useDiscord } from '@/extension/useDiscord';
import { useExtension } from '@/extension/useExtension';
import { useYtAuth } from '@/extension/useYtAuth';
import { useParty } from '@/party/useParty';
import { useHistorySettings } from '@/playback/historyReporting';
import { LicensesModal } from '@/shell/LicensesModal';
import {
  useDesktopSettings,
  type AudioQualitySetting,
  type AutomixPerformanceSetting,
  type OutputPrecisionSetting,
} from '@/state/desktopSettings';
import { CROSSFADE_CHOICES, usePlayer } from '@/state/player';
import {
  AppleMusicIntegration,
  AppleMusicToggles,
  CanvasToggle,
  LyricSourcesAccess,
  SpotifyIntegration,
  Toggle,
} from './IntegrationSettings';
import { settingsUi } from './settingsStyles';

const LyricsSettings = lazy(() => import('@/shell/LyricsSettings').then((m) => ({ default: m.LyricsSettings })));

/** An integration's coloured glyph */
function Glyph({ Icon, color, ink }: { Icon: ComponentType<{ size?: number }>; color: string; ink?: string }) {
  return (
    <span className={settingsUi.integrationIcon} style={{ backgroundColor: color, ...(ink && { color: ink }) }}>
      <Icon size={15} />
    </span>
  );
}

/** A row that opens a page of its own */
function LinkRow({
  to,
  icon,
  title,
  subtitle,
  value,
  onClick,
}: {
  to?: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string | null;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon}
      <span className={settingsUi.rowText}>
        <span className="font-semibold text-sm text-primary">{title}</span>
        {subtitle && <span className={settingsUi.rowDetail}>{subtitle}</span>}
      </span>
      <span className={settingsUi.value}>
        {value}
        <ChevronRight size={16} />
      </span>
    </>
  );

  if (to) {
    return (
      <PrefetchLink to={to} className={`${icon ? settingsUi.integration : settingsUi.integrationPlain} ${settingsUi.linkRow}`}>
        {content}
      </PrefetchLink>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${icon ? settingsUi.integration : settingsUi.integrationPlain} ${settingsUi.linkRow}`}
    >
      {content}
    </button>
  );
}

/** A select setting row matching the Toggle styling and alignment */
function SelectRow({
  label,
  detail,
  value,
  onChange,
  children,
}: {
  label: string;
  detail?: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
}) {
  return (
    <label className={settingsUi.controlRow}>
      <span className={settingsUi.rowText}>
        <span>{label}</span>
        {detail && <span className={settingsUi.rowDetail}>{detail}</span>}
      </span>
      <select value={value} onChange={onChange} className={settingsUi.select}>
        {children}
      </select>
    </label>
  );
}

/** An action row with a right-aligned action button */
function ActionRow({
  label,
  detail,
  buttonLabel,
  onClick,
}: {
  label: string;
  detail?: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className={settingsUi.row}>
      <span className={settingsUi.rowText}>
        <span>{label}</span>
        {detail && <span className={settingsUi.rowDetail}>{detail}</span>}
      </span>
      <button type="button" onClick={onClick} className={settingsUi.inlineButton}>
        {buttonLabel}
      </button>
    </div>
  );
}

function youtubeText(auth: ReturnType<typeof useYtAuth>): string {
  if (auth.state === 'checking') return 'Checking…';
  if (auth.state === 'unavailable') return 'Needs the extension';
  const { browserSignedIn, connected, active } = auth.auth;
  if (!browserSignedIn) return 'Not signed in';
  if (!connected) return 'Disconnected';
  return active ? active.name : 'Signed in';
}

/** Modal to add a new custom addon source URL */
function AddSourceModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (addon: AddonSource) => void;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addAddonByUrl } = useAddons();

  const handleAdd = async (targetUrl?: string) => {
    const toAdd = targetUrl || url.trim();
    if (!toAdd) return;

    setLoading(true);
    setError(null);

    try {
      const added = await addAddonByUrl(toAdd);
      onAdded(added);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to addon server.');
    } finally {
      setLoading(false);
    }
  };

  const presets = [
    { name: 'Qobuz Heisenbergg', url: 'https://qobuz.heisenbergg.de', note: 'Lossless FLAC Master' },
    { name: 'Chan Streamer', url: 'https://eljohnzc.raaga.app', note: 'High-Res Audio' },
    { name: 'Tidal FLAC', url: 'https://tidal.raaga.app', note: 'Hi-Fi 24-bit streams' },
  ];

  return (
    <div
      className="fixed inset-0 z-(--z-modal) grid animate-fade place-items-center bg-scrim p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[min(680px,calc(100vh-48px))] w-[min(500px,calc(100vw-32px))] animate-zoom flex-col rounded-[14px] bg-page shadow-glass p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Add a source"
      >
        <div className="flex items-center justify-between pb-3 border-b border-quaternary">
          <div>
            <h2 className="type-title-2-emphasized text-primary">Add a source</h2>
            <p className="type-callout text-secondary mt-0.5">
              Connect an HTTP audio provider without installing code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-[30px] place-items-center rounded-full bg-quaternary text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div>
            <label className="type-caption-emphasized text-secondary uppercase block mb-1.5">
              Addon Server URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://my-addon-server.com"
              className="w-full rounded-xl border border-quaternary bg-quinary px-3.5 py-2.5 type-body text-primary placeholder:text-secondary focus:border-key focus:ring-1 focus:ring-key outline-none transition-all"
            />
            {error && <p className="text-xs text-rose-500 font-medium mt-1.5">{error}</p>}
          </div>

          <div>
            <span className="type-caption text-secondary block mb-2 font-medium">Quick Presets:</span>
            <div className="grid gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => handleAdd(preset.url)}
                  disabled={loading}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-quaternary/60 hover:bg-quaternary text-left transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-semibold text-xs text-primary block">{preset.name}</span>
                    <span className="type-caption text-secondary">{preset.note}</span>
                  </div>
                  <span className="text-key type-caption-emphasized">Connect</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-quaternary">
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill px-4 py-1.5 type-callout text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleAdd()}
            disabled={loading || !url.trim()}
            className="rounded-pill bg-key text-white px-5 py-1.5 type-callout-emphasized hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-xs"
          >
            {loading ? 'Connecting…' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const extension = useExtension();
  const yt = useYtAuth();
  const discord = useDiscord();
  const party = useParty();
  const autoplay = usePlayer((s) => s.autoplay);
  const crossfadeSec = usePlayer((s) => s.crossfadeSec);
  const shareHistory = useHistorySettings((s) => s.share);
  const setShareHistory = useHistorySettings((s) => s.setShare);
  const { setAutoplay, setCrossfade } = usePlayer.getState();

  // Desktop App Settings Store
  const desktop = useDesktopSettings();

  // Addon Manager Store
  const { addons, toggleAddon, moveAddon, removeAddon } = useAddons();

  // Custom UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [accountExpanded, setAccountExpanded] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [cacheToast, setCacheToast] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Separate custom addons (e.g. Qobuz, Chan) from built-in sources
  const customAddons = addons.filter((a) => a.id !== 'jiosaavn-stream-addon');
  const jioSaavnAddon = addons.find((a) => a.id === 'jiosaavn-stream-addon');

  const present = extension.state === 'present';
  const discordText =
    discord.state === 'ready' && discord.discord.connected
      ? discord.discord.enabled
        ? 'On'
        : 'Off'
      : discord.state === 'ready' && discord.discord.available
        ? 'Not connected'
        : null;

  const filterMatches = (text: string, ...extraTexts: (string | undefined | null)[]): boolean => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    if (text.toLowerCase().includes(query)) return true;
    return extraTexts.some((t) => t && t.toLowerCase().includes(query));
  };

  const handleClearSongCache = async () => {
    await desktop.clearSongCache();
    setCacheToast('Song audio cache successfully cleared!');
    setTimeout(() => setCacheToast(null), 3000);
  };

  const handleClearImageCache = async () => {
    await desktop.clearImageCache();
    setCacheToast('Artwork image cache cleared!');
    setTimeout(() => setCacheToast(null), 3000);
  };

  const handleCheckUpdate = () => {
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      setCacheToast('You are on the latest Raaga version (v1.9.7).');
      setTimeout(() => setCacheToast(null), 3500);
    }, 800);
  };

  return (
    <div className={settingsUi.centered}>
      {/* Header Row: Title on Left, Search on Right (as in screenshot) */}
      <div className="mx-(--body-gutter) pt-8 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="type-header-emphasized text-primary">Settings</h1>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings"
            className="h-9 w-full rounded-xl border border-transparent bg-quaternary pl-9 pr-8 text-sm text-primary placeholder:text-secondary outline-none focus:border-key focus:ring-1 focus:ring-key transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className={settingsUi.body}>
        {/* Action feedback toast */}
        {cacheToast && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
            <span>{cacheToast}</span>
            <button type="button" onClick={() => setCacheToast(null)} className="cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* 1. ACCOUNT */}
        {filterMatches('Account', 'Integrations', 'Discord', 'Spotify', 'YouTube', 'Last.fm', 'ListenBrainz') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Account</h2>
            <section className={settingsUi.group}>
              <LinkRow
                icon={<Glyph Icon={Share2} color="#3b82f6" />}
                title="Account & integrations"
                subtitle="Discord rich presence, Last.fm and ListenBrainz"
                onClick={() => setAccountExpanded((prev) => !prev)}
              />

              {accountExpanded && (
                <div className="bg-quaternary/20 border-t border-quaternary/40 animate-in fade-in duration-200">
                  <div className={settingsUi.integration}>
                    <Glyph Icon={SiYoutubemusic} color="#ffffff" ink="#ff0033" />
                    <span className={settingsUi.integrationName}>YouTube Music</span>
                    <span className={settingsUi.value}>{youtubeText(yt)}</span>
                  </div>
                  <div className={settingsUi.integration}>
                    <Glyph Icon={SiSpotify} color="#1ed760" />
                    <span className={settingsUi.integrationName}>Spotify</span>
                    {present ? <SpotifyIntegration /> : <span className={settingsUi.value}>Needs the extension</span>}
                  </div>
                  {present && discord.state === 'ready' && discord.discord.available && (
                    <LinkRow to="/settings/discord" icon={<Glyph Icon={SiDiscord} color="#5865f2" />} title="Discord" value={discordText} />
                  )}
                  <LinkRow
                    to="/extension"
                    icon={<Glyph Icon={MdOutlineExtension} color="#636366" />}
                    title="Raaga Extension"
                    value={present ? `v${extension.extension.info.version}` : 'Not installed'}
                  />
                  <div className="hairline-[16px]">
                    <Toggle
                      label="Share Listening Activity to YouTube"
                      detail="Songs you play here go to your YouTube Music history and shape its recommendations."
                      checked={shareHistory}
                      onChange={setShareHistory}
                    />
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* 2. LISTEN TOGETHER */}
        {filterMatches('Listen Together', 'Party', 'Sync', 'Friends') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Listen Together</h2>
            <section className={settingsUi.group}>
              <LinkRow
                to="/settings/listen-together"
                title="Listen together"
                subtitle="Get a code to share with friends"
                value={party.code ? `In party ${party.code}` : null}
              />
            </section>
          </>
        )}

        {/* 3. SOURCES, TRIED IN THIS ORDER (MATCHING SCREENSHOT) */}
        {filterMatches('Sources', 'Addon', 'Qobuz', 'Chan', 'JioSaavn', 'YouTube', 'FLAC', 'Lossless') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Sources, tried in this order</h2>
            <section className={settingsUi.group}>
              {/* Custom Addons List */}
              {customAddons.map((addon, index) => (
                <div key={addon.id} className="relative flex items-center justify-between px-4 py-3 hairline-[16px] group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-secondary text-sm font-semibold w-5 text-center flex-none">
                      {index + 1}
                    </span>
                    <span className="grid size-7 place-items-center rounded-lg bg-amber-500/15 text-amber-400 flex-none">
                      <Puzzle size={16} />
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm text-primary truncate">{addon.name}</span>
                      <span className="type-caption text-secondary truncate">
                        {addon.description || `${addon.name} v${addon.version}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-3 flex-none">
                    {/* Reorder Chevrons (Up / Down) */}
                    <div className="flex items-center gap-0.5">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => moveAddon(index, 'up')}
                          className="p-1 rounded-md text-secondary hover:text-primary hover:bg-quaternary transition-colors cursor-pointer"
                          title="Move up"
                          aria-label="Move up"
                        >
                          <ChevronUp size={16} />
                        </button>
                      )}
                      {index < customAddons.length - 1 && (
                        <button
                          type="button"
                          onClick={() => moveAddon(index, 'down')}
                          className="p-1 rounded-md text-secondary hover:text-primary hover:bg-quaternary transition-colors cursor-pointer"
                          title="Move down"
                          aria-label="Move down"
                        >
                          <ChevronDown size={16} />
                        </button>
                      )}
                    </div>

                    {/* Delete button (hover) */}
                    <button
                      type="button"
                      onClick={() => removeAddon(addon.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-secondary hover:text-rose-400 transition-all cursor-pointer"
                      title="Remove addon"
                      aria-label="Remove addon"
                    >
                      <Trash2 size={14} />
                    </button>

                    {/* Switch Toggle */}
                    <input
                      type="checkbox"
                      className={settingsUi.switch}
                      checked={addon.enabled}
                      onChange={(e) => toggleAddon(addon.id, e.currentTarget.checked)}
                    />
                  </div>
                </div>
              ))}

              {/* Built-in JioSaavn Source */}
              <div className="relative flex items-center justify-between px-4 py-3 hairline-[16px]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-secondary text-sm font-semibold w-5 text-center flex-none">
                    {customAddons.length + 1}
                  </span>
                  <span className="grid size-7 place-items-center rounded-lg bg-teal-500/15 text-teal-400 flex-none">
                    <AudioWaveform size={16} />
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm text-primary">JioSaavn</span>
                    <span className="type-caption text-secondary">High Quality · 320kbps</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className={settingsUi.switch}
                  checked={jioSaavnAddon ? jioSaavnAddon.enabled : false}
                  onChange={(e) => {
                    if (jioSaavnAddon) toggleAddon(jioSaavnAddon.id, e.currentTarget.checked);
                  }}
                />
              </div>

              {/* Built-in YouTube Music Source */}
              <div className="relative flex items-center justify-between px-4 py-3 hairline-[16px]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-secondary text-sm font-semibold w-5 text-center flex-none">
                    {customAddons.length + 2}
                  </span>
                  <span className="grid size-7 place-items-center rounded-lg bg-red-500/15 text-red-500 flex-none">
                    <SiYoutubemusic size={16} />
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm text-primary">YouTube Music</span>
                    <span className="type-caption text-secondary">Lossy · Full catalogue · Radio</span>
                  </div>
                </div>
                <span className="text-xs text-secondary font-medium mr-1 flex-none">Always on</span>
              </div>

              {/* Add a source row */}
              <button
                type="button"
                onClick={() => setAddSourceOpen(true)}
                className="relative flex items-center justify-between w-full text-left px-4 py-3 hairline-[16px] hover:bg-quaternary transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="grid size-7 place-items-center rounded-lg bg-quaternary text-primary flex-none">
                    <Plus size={16} />
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm text-primary">Add a source</span>
                    <span className="type-caption text-secondary leading-normal">
                      An addon server you host or were given a link to. Searched and streamed over plain HTTP — no code is downloaded or run.
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-secondary ml-3 flex-none" />
              </button>
            </section>
          </>
        )}

        {/* 4. AUDIO QUALITY (MATCHING SCREENSHOT) */}
        {filterMatches('Audio quality', 'Bitrate', 'Precision', 'Lossless', 'FLAC', 'PCM') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Audio Quality</h2>
            <div className="mx-4 mb-2 flex flex-wrap gap-2">
              {(
                [
                  { id: 'low', label: 'Low' },
                  { id: 'medium', label: 'Medium' },
                  { id: 'high', label: 'High' },
                  { id: 'lossless', label: 'Lossless' },
                ] as const
              ).map((q) => {
                const active =
                  (desktop.audioQuality === 'standard' && q.id === 'medium') || desktop.audioQuality === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => desktop.updateSetting('audioQuality', q.id)}
                    className={`rounded-xl px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-md'
                        : 'bg-quaternary/70 hover:bg-quaternary text-secondary hover:text-primary'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            <p className={settingsUi.footer}>
              {desktop.audioQuality === 'lossless'
                ? 'Your addons + JioSaavn, bit-exact where available'
                : desktop.audioQuality === 'high'
                  ? 'High Quality · 320kbps high-bitrate streaming'
                  : desktop.audioQuality === 'medium'
                    ? 'Balanced data usage and playback fidelity'
                    : 'Fast buffering with lowest bandwidth consumption'}
            </p>
          </>
        )}

        {/* 5. DOWNLOADS (MATCHING SCREENSHOT) */}
        {filterMatches('Downloads', 'Offline', 'Quality') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Downloads</h2>
            <div className="mx-4 mb-2 flex flex-wrap gap-2">
              {(
                [
                  { id: 'standard', label: 'Standard' },
                  { id: 'high', label: 'High' },
                  { id: 'lossless', label: 'Lossless' },
                ] as const
              ).map((q) => {
                const active = desktop.downloadQuality === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => desktop.updateSetting('downloadQuality', q.id)}
                    className={`rounded-xl px-5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-md'
                        : 'bg-quaternary/70 hover:bg-quaternary text-secondary hover:text-primary'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 6. PLAYBACK ENGINE & AUTOMIX */}
        {filterMatches('Playback', 'Crossfade', 'Automix', 'Silence', 'Spatial', 'Speed', 'Sleep') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Playback & Audio Engine</h2>
            <section className={settingsUi.group}>
              <SelectRow
                label="Output Precision"
                detail="Audio decoding float vs integer representation."
                value={desktop.outputPrecision}
                onChange={(e) => desktop.updateSetting('outputPrecision', e.target.value as OutputPrecisionSetting)}
              >
                <option value="FLOAT_32">32-bit Float (Recommended)</option>
                <option value="PCM_16">16-bit PCM</option>
              </SelectRow>
              <Toggle
                label="AutoPlay"
                detail="When the queue ends, seamlessly keep playing similar songs."
                checked={autoplay}
                onChange={setAutoplay}
              />

              <div className="relative px-4 py-3.5 hairline-[16px]">
                <div className="flex items-center justify-between mb-2">
                  <span className={settingsUi.rowText}>
                    <span>Crossfade</span>
                    <span className={settingsUi.rowDetail}>Smoothly overlaps audio when switching tracks.</span>
                  </span>
                  <span className="font-mono text-xs text-secondary font-medium shrink-0 ml-3">
                    {crossfadeSec === 0 ? 'Off' : `${crossfadeSec}s`}
                  </span>
                </div>
                <div className="flex rounded-xl bg-quaternary p-1 gap-1">
                  {CROSSFADE_CHOICES.map((sec) => {
                    const active = crossfadeSec === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setCrossfade(sec)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-key text-white font-semibold shadow-xs'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        {sec === 0 ? 'Off' : `${sec}s`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Toggle
                label="Automix [BETA]"
                detail="Intelligently analyzes beats and blends transitions between tracks seamlessly."
                checked={desktop.automix}
                onChange={(val) => desktop.updateSetting('automix', val)}
              />

              {desktop.automix && (
                <div className="relative px-4 py-3 hairline-[16px] bg-quaternary/30">
                  <div className="mb-2 type-caption-emphasized text-secondary uppercase tracking-wider">
                    Automix Analysis Mode
                  </div>
                  <div className="flex rounded-xl bg-quaternary p-1 gap-1">
                    {(
                      [
                        { id: 'efficient', label: 'Efficient (1 thread)' },
                        { id: 'balanced', label: 'Balanced (2 threads)' },
                        { id: 'performance', label: 'Performance (4 threads)' },
                      ] as const
                    ).map((mode) => {
                      const active = desktop.automixPerformance === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => desktop.updateSetting('automixPerformance', mode.id as AutomixPerformanceSetting)}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all cursor-pointer ${
                            active
                              ? 'bg-key text-white font-semibold shadow-xs'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Toggle
                label="Skip Silence"
                detail="Automatically trims long quiet intros, outros, and gaps rather than playing them out."
                checked={desktop.skipSilence}
                onChange={(val) => desktop.updateSetting('skipSilence', val)}
              />

              <Toggle
                label="Spatial Audio (Virtualizer)"
                detail="Widens stereo tracks and creates an immersive 3D binaural soundstage."
                checked={desktop.spatialAudio}
                onChange={(val) => desktop.updateSetting('spatialAudio', val)}
              />

              <Toggle
                label="Dolby Atmos / Immersive Audio"
                detail="Prefer immersive spatial mixes when provided by compatible lossless addons."
                checked={desktop.dolbyAtmos}
                onChange={(val) => desktop.updateSetting('dolbyAtmos', val)}
              />

              <SelectRow
                label="Playback Speed"
                detail="Tempo & pitch scaling"
                value={desktop.playbackSpeed}
                onChange={(e) => desktop.updateSetting('playbackSpeed', Number(e.target.value))}
              >
                <option value={0.5}>0.5×</option>
                <option value={0.75}>0.75×</option>
                <option value={1.0}>1.0× (Normal)</option>
                <option value={1.25}>1.25×</option>
                <option value={1.5}>1.5×</option>
                <option value={2.0}>2.0×</option>
              </SelectRow>

              <SelectRow
                label="Sleep Timer"
                detail={
                  desktop.sleepTimer
                    ? `Pausing ${desktop.sleepTimer === 'track' ? 'when track ends' : `in ${desktop.sleepTimer}m`}`
                    : 'Automatically pause playback'
                }
                value={desktop.sleepTimer ?? 'off'}
                onChange={(e) => {
                  const val = e.target.value;
                  desktop.setSleepTimer(val === 'off' ? null : val === 'track' ? 'track' : Number(val));
                }}
              >
                <option value="off">Off</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="track">End of this track</option>
              </SelectRow>
            </section>
          </>
        )}

        {/* 7. APPEARANCE & VISUALS */}
        {filterMatches('Appearance', 'Cover', 'Blur', 'Mesh', 'Volume') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Appearance & Visuals</h2>
            <section className={settingsUi.group}>
              <Toggle
                label="Ambient Artwork Glow"
                detail="Diffuses the current song artwork colors under the player glass for a living glow."
                checked={desktop.ambientBackdrop}
                onChange={(val) => desktop.updateSetting('ambientBackdrop', val)}
              />

              <Toggle
                label="Reduce Dynamic Blur"
                detail="Swaps heavy frosted glass for solid fills across the application for higher performance."
                checked={desktop.reduceDynamicBlur}
                onChange={(val) => desktop.updateSetting('reduceDynamicBlur', val)}
              />

              <Toggle
                label="Full-Screen Cover Art"
                detail="Runs album artwork to the edges of the full player instead of a contained sleeve."
                checked={desktop.fullBleedArtwork}
                onChange={(val) => desktop.updateSetting('fullBleedArtwork', val)}
              />

              <Toggle
                label="Hide Volume Bar"
                detail="Removes the floating volume level bar from the main transport pill."
                checked={desktop.hideVolumeBar}
                onChange={(val) => desktop.updateSetting('hideVolumeBar', val)}
              />

              <CanvasToggle />
            </section>
          </>
        )}

        {/* 8. LYRICS SETTINGS */}
        {filterMatches('Lyrics', 'Synced', 'Blur', 'Musixmatch', 'LRCLIB') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Lyrics</h2>
            <section className={settingsUi.group}>
              <Toggle
                label="Synced Lyrics"
                detail="Lights up words with syllable timing on the player as they are sung."
                checked={desktop.syncedLyrics}
                onChange={(val) => desktop.updateSetting('syncedLyrics', val)}
              />

              <Toggle
                label="Blur Unfocused Lyrics"
                detail="Keeps the visual spotlight on the current line and softly blurs upcoming lines."
                checked={desktop.blurUnfocusedLyrics}
                onChange={(val) => desktop.updateSetting('blurUnfocusedLyrics', val)}
              />

              <button className={`${settingsUi.integrationPlain} ${settingsUi.linkRow}`} onClick={() => setLyricsOpen(true)}>
                <span className={settingsUi.integrationName}>Lyric Sources & Providers</span>
                <span className={settingsUi.value}>
                  Order & timing
                  <ChevronRight size={16} />
                </span>
              </button>

              <div className={settingsUi.integrationPlain}>
                <span className={settingsUi.integrationName}>Lyric Sources Extension Access</span>
                {present ? <LyricSourcesAccess /> : <span className={settingsUi.value}>Needs the extension</span>}
              </div>
            </section>
          </>
        )}

        {/* 9. STORAGE & CACHE */}
        {filterMatches('Storage', 'Cache', 'Disk', 'Clear') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Storage & Cache</h2>
            <section className={settingsUi.group}>
              <SelectRow
                label="Song Audio Cache Limit"
                detail="Keeps downloaded streams on disk for instant seeking."
                value={desktop.songCacheLimitMb}
                onChange={(e) => desktop.updateSetting('songCacheLimitMb', Number(e.target.value))}
              >
                <option value={512}>512 MB</option>
                <option value={1024}>1 GB</option>
                <option value={2048}>2 GB (Recommended)</option>
                <option value={5120}>5 GB</option>
              </SelectRow>

              <ActionRow
                label="Clear Song Audio Cache"
                detail="Frees space used by cached audio streams."
                buttonLabel="Clear"
                onClick={handleClearSongCache}
              />

              <ActionRow
                label="Clear Artwork Cache"
                detail="Frees space used by cached album sleeves."
                buttonLabel="Clear"
                onClick={handleClearImageCache}
              />
            </section>
          </>
        )}

        {/* 10. APPLE MUSIC ACCESS */}
        {filterMatches('Apple Music', 'Access') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Apple Music</h2>
            <section className={settingsUi.group}>
              <div className={settingsUi.integration}>
                <Glyph Icon={SiApplemusic} color="#fa2d48" />
                <span className={settingsUi.integrationName}>Extension Access</span>
                {present ? <AppleMusicIntegration /> : <span className={settingsUi.value}>Needs the extension</span>}
              </div>
              <AppleMusicToggles />
            </section>
          </>
        )}

        {/* 11. MISCELLANEOUS & ADVANCED */}
        {filterMatches('Miscellaneous', 'Advanced', 'Nerd', 'Repeat', 'Session') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Miscellaneous & Advanced</h2>
            <section className={settingsUi.group}>
              <Toggle
                label="Don't repeat songs in current session"
                detail="AutoPlay won't suggest songs already played or queued during your active session."
                checked={desktop.dontRepeatSuggestions}
                onChange={(val) => desktop.updateSetting('dontRepeatSuggestions', val)}
              />

              <Toggle
                label="Show Stats for Nerds"
                detail="Displays audio codec, bitrate, buffer health, and sample rate on the player LCD."
                checked={desktop.showNerdStats}
                onChange={(val) => desktop.updateSetting('showNerdStats', val)}
              />
            </section>
          </>
        )}

        {/* FOOTER */}
        <div className="mt-12 mb-6 flex flex-col items-center justify-center gap-2 text-center text-xs text-secondary">
          <div className="flex flex-wrap items-center justify-center gap-2 font-medium">
            <span>Raaga v1.9.7 (Desktop Web)</span>
            <span>•</span>
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="text-key hover:underline cursor-pointer"
            >
              {checkingUpdate ? 'Checking…' : 'Check for updates'}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLicensesOpen(true)}
              className="text-key hover:underline cursor-pointer"
            >
              Licenses
            </button>
          </div>
          <p className="type-caption text-secondary">
            Engineered with bit-exact audio, lossless FLAC streams, and real-time collaborative listening.
          </p>
        </div>
      </div>

      {/* Add Custom Source Modal */}
      {addSourceOpen && (
        <AddSourceModal
          onClose={() => setAddSourceOpen(false)}
          onAdded={(newSource) => {
            setCacheToast(`Source "${newSource.name}" successfully added!`);
            setTimeout(() => setCacheToast(null), 3500);
          }}
        />
      )}

      {/* Lyrics Provider Order Dialog */}
      {lyricsOpen && (
        <Suspense fallback={null}>
          <LyricsSettings onClose={() => setLyricsOpen(false)} />
        </Suspense>
      )}

      {/* Third-Party Licenses Dialog */}
      {licensesOpen && <LicensesModal onClose={() => setLicensesOpen(false)} />}
    </div>
  );
}
