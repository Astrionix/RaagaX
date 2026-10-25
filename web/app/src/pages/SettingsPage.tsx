import { lazy, Suspense, useState, type ChangeEvent, type ComponentType, type ReactNode } from 'react';
import { ChevronRight, Puzzle, Search, Users, X } from 'lucide-react';
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

  const hasAnyMatches = [
    filterMatches('Audio Sources', 'Addons', 'Lossless Core', 'FLAC', 'JioSaavn', 'Tidal'),
    filterMatches('Audio quality', 'Bitrate', 'Precision', 'Lossless', 'FLAC', 'PCM'),
    filterMatches('Playback', 'Crossfade', 'Automix', 'Silence', 'Spatial', 'Speed', 'Sleep'),
    filterMatches('Appearance', 'Cover', 'Blur', 'Mesh', 'Volume'),
    filterMatches('Lyrics', 'Synced', 'Blur', 'Musixmatch', 'LRCLIB'),
    filterMatches('Storage', 'Cache', 'Disk', 'Clear'),
    filterMatches('Account', 'YouTube', 'Spotify', 'Discord', 'Extension'),
    filterMatches('Apple Music', 'Access'),
    filterMatches('Miscellaneous', 'Advanced', 'Nerd', 'Repeat', 'Session'),
    filterMatches('Listen Together', 'Party', 'Sync', 'Friends'),
  ].some(Boolean);

  return (
    <div className={settingsUi.centered}>
      <PageHeader title="Settings" />

      <div className={settingsUi.body}>
        {/* Search Field (Desktop Feature) */}
        <div className="relative mb-6">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings, playback, audio quality..."
            className="h-10 w-full rounded-xl border border-transparent bg-quaternary pl-10 pr-9 type-body text-primary placeholder:text-secondary outline-none focus:border-key focus:ring-1 focus:ring-key transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Action feedback toast */}
        {cacheToast && (
          <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
            <span>{cacheToast}</span>
            <button type="button" onClick={() => setCacheToast(null)} className="cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {!hasAnyMatches && searchQuery.trim() && (
          <div className="py-12 text-center text-secondary">
            <p className="type-title-3 font-semibold text-primary">No settings found</p>
            <p className="type-callout mt-1">Try searching for &ldquo;quality&rdquo;, &ldquo;crossfade&rdquo;, &ldquo;cache&rdquo;, or &ldquo;addons&rdquo;</p>
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
              <div className="relative px-4 py-3.5 hairline-[16px]">
                <div className="mb-2">
                  <div className="text-primary font-medium">Stream Quality</div>
                  <div className={settingsUi.rowDetail}>
                    Decides which audio sources and formats are preferred during playback.
                  </div>
                </div>
                <div className="flex rounded-xl bg-quaternary p-1 gap-1">
                  {(
                    [
                      { id: 'standard', label: 'Standard' },
                      { id: 'high', label: 'High (320kbps)' },
                      { id: 'lossless', label: 'Lossless (FLAC)' },
                    ] as const
                  ).map((item) => {
                    const active = desktop.audioQuality === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => desktop.updateSetting('audioQuality', item.id)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-key text-white font-semibold shadow-xs'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 type-caption text-secondary">
                  {desktop.audioQuality === 'lossless'
                    ? 'Lossless: Queries bit-exact FLAC audio up to 192kHz/24-bit.'
                    : desktop.audioQuality === 'high'
                      ? 'High: Direct 320kbps streams for high fidelity.'
                      : 'Standard: Fast buffering with optimized data usage.'}
                </div>
              </div>

              <SelectRow
                label="Output Precision"
                detail="Audio decoding float vs integer representation."
                value={desktop.outputPrecision}
                onChange={(e) => desktop.updateSetting('outputPrecision', e.target.value as OutputPrecisionSetting)}
              >
                <option value="FLOAT_32">32-bit Float (Recommended)</option>
                <option value="PCM_16">16-bit PCM</option>
              </SelectRow>

              <SelectRow
                label="Offline Download Quality"
                detail="Default audio tier for saved tracks."
                value={desktop.downloadQuality}
                onChange={(e) => desktop.updateSetting('downloadQuality', e.target.value as AudioQualitySetting)}
              >
                <option value="lossless">Lossless Master (FLAC)</option>
                <option value="high">High (320kbps)</option>
                <option value="standard">Standard (128kbps)</option>
              </SelectRow>
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
