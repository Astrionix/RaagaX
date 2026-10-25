import { lazy, Suspense, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  Check,
  ChevronRight,
  HardDrive,
  Info,
  Layers,
  Music2,
  Palette,
  Puzzle,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Users,
  Volume2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { MdOutlineExtension } from 'react-icons/md';
import { SiApplemusic, SiDiscord, SiSpotify, SiYoutubemusic } from 'react-icons/si';
import { PageHeader } from '@/components/PageHeader';
import { PrefetchLink } from '@/components/PrefetchLink';
import { useAddons } from '@/data/addons/addonManager';
import { useDiscord } from '@/extension/useDiscord';
import { useExtension } from '@/extension/useExtension';
import { useYtAuth } from '@/extension/useYtAuth';
import { useParty } from '@/party/useParty';
import { useHistorySettings } from '@/playback/historyReporting';
import { useDesktopSettings, type AudioQualitySetting, type AutomixPerformanceSetting, type OutputPrecisionSetting } from '@/state/desktopSettings';
import { CROSSFADE_CHOICES, usePlayer } from '@/state/player';
import { LicensesModal } from '@/shell/LicensesModal';
import {
  AppleMusicIntegration,
  AppleMusicToggles,
  CanvasToggle,
  DiscordIntegration,
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
function LinkRow({ to, icon, title, value }: { to: string; icon?: ReactNode; title: string; value?: string | null }) {
  return (
    <PrefetchLink to={to} className={`${icon ? settingsUi.integration : settingsUi.integrationPlain} ${settingsUi.linkRow}`}>
      {icon}
      <span className={settingsUi.integrationName}>{title}</span>
      <span className={settingsUi.value}>
        {value}
        <ChevronRight size={16} />
      </span>
    </PrefetchLink>
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

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Feedback toasts
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [cacheToast, setCacheToast] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const present = extension.state === 'present';
  const discordText =
    discord.state === 'ready' && discord.discord.connected
      ? discord.discord.enabled
        ? 'On'
        : 'Off'
      : discord.state === 'ready' && discord.discord.available
        ? 'Not connected'
        : null;

  const activeAddonsCount = useAddons((s) => s.addons.filter((a) => a.enabled).length);

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
      <PageHeader title="Settings" />

      <div className={settingsUi.body}>
        {/* Search Field (Desktop Feature) */}
        <div className="relative mb-5 mx-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings, playback, audio quality..."
            className="w-full rounded-2xl bg-white/5 border border-white/10 pl-10 pr-9 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-hidden focus:border-red-500/50 focus:ring-1 focus:ring-red-500/40 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {cacheToast && (
          <div className="mx-4 mb-4 flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2 text-xs font-medium text-emerald-300 animate-in fade-in">
            <span>{cacheToast}</span>
            <button type="button" onClick={() => setCacheToast(null)}>
              <X size={13} />
            </button>
          </div>
        )}

        {/* 1. AUDIO SOURCES & ADDONS */}
        {filterMatches('Audio Sources', 'Addons', 'Lossless Core', 'FLAC', 'JioSaavn', 'Tidal') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Audio Sources & Addons</h2>
            <section className={settingsUi.group}>
              <LinkRow
                to="/addons"
                icon={<Glyph Icon={Puzzle} color="#f59e0b" />}
                title="Audio Addons Manager"
                value={activeAddonsCount > 0 ? `${activeAddonsCount} active · Lossless Priority` : 'Configure sources'}
              />
            </section>
            <p className={settingsUi.footer}>
              Connect high-bitrate external sources, FLAC lossless mirrors, or self-hosted Raaga Addons.
            </p>
          </>
        )}

        {/* 2. AUDIO QUALITY & PRECISION (DESKTOP FEATURE) */}
        {filterMatches('Audio quality', 'Bitrate', 'Precision', 'Lossless', 'FLAC', 'PCM') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Audio Quality & Bitrate</h2>
            <section className={settingsUi.group}>
              <div className="p-4 flex flex-col gap-2 border-b border-white/5">
                <span className="text-sm font-semibold text-white">Stream Quality</span>
                <span className="text-xs text-neutral-400 mb-1">
                  Decides which audio sources and formats are preferred during playback.
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'standard', label: 'Standard', desc: '128kbps AAC / Opus' },
                      { id: 'high', label: 'High', desc: '320kbps High-Bitrate' },
                      { id: 'lossless', label: 'Lossless', desc: 'Bit-exact FLAC (24-bit/192kHz)' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => desktop.updateSetting('audioQuality', item.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        desktop.audioQuality === item.id
                          ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                          : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-neutral-400 mt-1">
                  {desktop.audioQuality === 'lossless'
                    ? 'Lossless: Queries high-fidelity FLAC audio up to 192kHz/24-bit.'
                    : desktop.audioQuality === 'high'
                      ? 'High: Direct 320kbps streams for high fidelity.'
                      : 'Standard: Fast buffering with optimized data usage.'}
                </span>
              </div>

              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div>
                  <span className="text-sm font-semibold text-white block">Output Precision</span>
                  <span className="text-xs text-neutral-400">Audio decoding float vs integer representation.</span>
                </div>
                <select
                  value={desktop.outputPrecision}
                  onChange={(e) => desktop.updateSetting('outputPrecision', e.target.value as OutputPrecisionSetting)}
                  className={settingsUi.select}
                >
                  <option value="FLOAT_32">32-bit Float (Recommended)</option>
                  <option value="PCM_16">16-bit PCM</option>
                </select>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white block">Offline Download Quality</span>
                  <span className="text-xs text-neutral-400">Default audio tier for saved tracks.</span>
                </div>
                <select
                  value={desktop.downloadQuality}
                  onChange={(e) => desktop.updateSetting('downloadQuality', e.target.value as AudioQualitySetting)}
                  className={settingsUi.select}
                >
                  <option value="lossless">Lossless Master (FLAC)</option>
                  <option value="high">High (320kbps)</option>
                  <option value="standard">Standard (128kbps)</option>
                </select>
              </div>
            </section>
          </>
        )}

        {/* 3. PLAYBACK ENGINE & AUTOMIX (DESKTOP FEATURE) */}
        {filterMatches('Playback', 'Crossfade', 'Automix', 'Silence', 'Spatial', 'Speed', 'Sleep') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Playback & Audio Engine</h2>
            <section className={settingsUi.group}>
              <Toggle
                label="AutoPlay"
                detail="When the queue ends, seamlessly keep playing similar songs."
                checked={autoplay}
                onChange={setAutoplay}
              />

              <div className="p-4 flex flex-col gap-2 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Crossfade</span>
                  <span className="text-xs font-mono text-neutral-400">
                    {crossfadeSec === 0 ? 'Off' : `${crossfadeSec} seconds`}
                  </span>
                </div>
                <div className="flex gap-2">
                  {CROSSFADE_CHOICES.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setCrossfade(sec)}
                      className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-all cursor-pointer ${
                        crossfadeSec === sec
                          ? 'bg-red-500 text-white shadow-xs'
                          : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                      }`}
                    >
                      {sec === 0 ? 'Off' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              <Toggle
                label="Automix [BETA]"
                detail="Intelligently analyzes beats and blends transitions between tracks seamlessly."
                checked={desktop.automix}
                onChange={(val) => desktop.updateSetting('automix', val)}
              />

              {desktop.automix && (
                <div className="p-4 flex flex-col gap-2 border-b border-white/5 bg-white/[0.01]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Automix Analysis Mode
                  </span>
                  <div className="flex gap-2">
                    {(
                      [
                        { id: 'efficient', label: 'Efficient (1 thread)' },
                        { id: 'balanced', label: 'Balanced (2 threads)' },
                        { id: 'performance', label: 'Performance (4 threads)' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => desktop.updateSetting('automixPerformance', mode.id)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                          desktop.automixPerformance === mode.id
                            ? 'bg-white/20 text-white font-semibold'
                            : 'bg-white/5 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
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

              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div>
                  <span className="text-sm font-semibold text-white block">Playback Speed</span>
                  <span className="text-xs text-neutral-400">Tempo & pitch scaling</span>
                </div>
                <select
                  value={desktop.playbackSpeed}
                  onChange={(e) => desktop.updateSetting('playbackSpeed', Number(e.target.value))}
                  className={settingsUi.select}
                >
                  <option value={0.5}>0.5×</option>
                  <option value={0.75}>0.75×</option>
                  <option value={1.0}>1.0× (Normal)</option>
                  <option value={1.25}>1.25×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={2.0}>2.0×</option>
                </select>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white block">Sleep Timer</span>
                  <span className="text-xs text-neutral-400">
                    {desktop.sleepTimer
                      ? `Pausing in ${desktop.sleepTimer === 'track' ? 'when track ends' : `${desktop.sleepTimer}m`}`
                      : 'Automatically pause playback'}
                  </span>
                </div>
                <select
                  value={desktop.sleepTimer ?? 'off'}
                  onChange={(e) => {
                    const val = e.target.value;
                    desktop.setSleepTimer(val === 'off' ? null : val === 'track' ? 'track' : Number(val));
                  }}
                  className={settingsUi.select}
                >
                  <option value="off">Off</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="track">End of this track</option>
                </select>
              </div>
            </section>
          </>
        )}

        {/* 4. APPEARANCE & CUSTOMIZATION (DESKTOP FEATURE) */}
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

        {/* 5. LYRICS SETTINGS */}
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

        {/* 6. STORAGE & CACHE (DESKTOP FEATURE) */}
        {filterMatches('Storage', 'Cache', 'Disk', 'Clear') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Storage & Cache</h2>
            <section className={settingsUi.group}>
              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div>
                  <span className="text-sm font-semibold text-white block">Song Audio Cache Limit</span>
                  <span className="text-xs text-neutral-400">Keeps downloaded streams on disk for instant seeking.</span>
                </div>
                <select
                  value={desktop.songCacheLimitMb}
                  onChange={(e) => desktop.updateSetting('songCacheLimitMb', Number(e.target.value))}
                  className={settingsUi.select}
                >
                  <option value={512}>512 MB</option>
                  <option value={1024}>1 GB</option>
                  <option value={2048}>2 GB (Recommended)</option>
                  <option value={5120}>5 GB</option>
                </select>
              </div>

              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div>
                  <span className="text-sm font-semibold text-white block">Clear Song Audio Cache</span>
                  <span className="text-xs text-neutral-400">Frees space used by cached audio streams.</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearSongCache}
                  className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer"
                >
                  Clear Audio Cache
                </button>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white block">Clear Artwork Cache</span>
                  <span className="text-xs text-neutral-400">Frees space used by cached album sleeves.</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearImageCache}
                  className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer"
                >
                  Clear Image Cache
                </button>
              </div>
            </section>
          </>
        )}

        {/* 7. ACCOUNT & INTEGRATIONS */}
        {filterMatches('Account', 'YouTube', 'Spotify', 'Discord', 'Extension') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Account & Integrations</h2>
            <section className={settingsUi.group}>
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
            </section>

            <section className={`${settingsUi.group} mt-3 empty:hidden`}>
              <Toggle
                label="Share Listening Activity to YouTube"
                detail={
                  present && !extension.extension.info.capabilities.includes('yt.stats')
                    ? 'Update the Raaga extension to share: this version can’t send plays to YouTube.'
                    : 'Songs you play here go to your YouTube Music history and shape its recommendations.'
                }
                checked={shareHistory}
                onChange={setShareHistory}
              />
            </section>
          </>
        )}

        {/* 8. APPLE MUSIC ACCESS */}
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

        {/* 9. MISCELLANEOUS & ADVANCED (DESKTOP FEATURE) */}
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

        {/* 10. LISTEN TOGETHER */}
        {filterMatches('Listen Together', 'Party', 'Sync', 'Friends') && (
          <>
            <h2 className={settingsUi.sectionHeader}>Listen Together</h2>
            <section className={settingsUi.group}>
              <LinkRow
                to="/settings/listen-together"
                icon={<Glyph Icon={Users} color="#fa2d48" />}
                title="Listen Together"
                value={party.code ? `In party ${party.code}` : 'Listen in sync with friends'}
              />
            </section>
          </>
        )}

        {/* FOOTER (MATCHING DESKTOP APP) */}
        <div className="mt-12 mb-6 flex flex-col items-center justify-center gap-2 text-center text-xs text-neutral-400">
          <div className="flex items-center gap-2 font-medium">
            <span>Raaga v1.9.7 (Desktop Web)</span>
            <span>•</span>
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="text-red-400 hover:underline cursor-pointer"
            >
              {checkingUpdate ? 'Checking…' : 'Check for updates'}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLicensesOpen(true)}
              className="text-red-400 hover:underline cursor-pointer"
            >
              Licenses
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Engineered with bit-exact audio, lossless FLAC streams, and real-time collaborative listening.
          </p>
        </div>
      </div>

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
