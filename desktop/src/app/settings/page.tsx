"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sliders,
  Paintbrush,
  PlayCircle,
  Volume2,
  PlaySquare,
  Download,
  User,
  Cpu,
  Check,
  ChevronRight,
  ArrowLeft,
  Trash2,
  RefreshCw,
  LogOut,
  LogIn,
  SlidersHorizontal,
  Sparkles,
  Film,
} from "lucide-react";
import {
  useSettingsStore,
  AudioQualitySetting,
  ThemeModeSetting,
  LiquidGlassMode,
} from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePlayerStore } from "@/stores/player-store";

type CategoryId =
  | "general"
  | "appearance"
  | "playback"
  | "audio"
  | "youtube"
  | "downloads"
  | "account"
  | "advanced";

// ==========================================
// Reusable Settings Components
// ==========================================

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className="rounded-2xl liquid-glass border border-white/10 overflow-hidden divide-y divide-white/[0.05]">
        {children}
      </div>
    </section>
  );
}

interface SettingsRowProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsRow({ icon, title, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-white/[0.03] transition-colors">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-neutral-400 shrink-0">{icon}</div>}
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-white">{title}</h4>
          {description && (
            <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5 max-w-lg leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="self-end sm:self-center shrink-0">{children}</div>
    </div>
  );
}

interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function SettingsToggle({ checked, onChange, disabled }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-raaga-red focus-visible:ring-opacity-75 ${
        checked ? "bg-raaga-red shadow-[0_0_12px_rgba(250,45,72,0.4)]" : "bg-white/15"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface SettingsSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

function SettingsSelect({ value, onChange, options, disabled }: SettingsSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none px-3.5 py-1.5 pr-8 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-white/30 transition cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#18181D] text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
        <ChevronRight className="w-3.5 h-3.5 rotate-90" />
      </div>
    </div>
  );
}

interface SettingsButtonProps {
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}

function SettingsButton({
  onClick,
  variant = "secondary",
  icon,
  children,
  disabled,
}: SettingsButtonProps) {
  const base =
    "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary:
      "bg-gradient-to-r from-raaga-red to-raaga-pink text-white shadow-[0_2px_12px_rgba(250,45,72,0.3)] hover:opacity-90",
    secondary:
      "bg-white/10 hover:bg-white/15 text-white border border-white/10 shadow-sm",
    danger:
      "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

// ==========================================
// SettingsSidebar Component
// ==========================================

interface SettingsSidebarProps {
  categories: { id: CategoryId; name: string; icon: any; summary: string }[];
  activeCategory: CategoryId;
  onSelectCategory: (id: CategoryId) => void;
  mobileHidden: boolean;
}

function SettingsSidebar({
  categories,
  activeCategory,
  onSelectCategory,
  mobileHidden,
}: SettingsSidebarProps) {
  return (
    <aside
      className={`space-y-1 liquid-glass border border-white/10 p-2 rounded-[22px] shadow-lg ${
        mobileHidden ? "hidden md:block" : "block"
      }`}
    >
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isSelected = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 ${
              isSelected
                ? "liquid-glass-nav-active text-white font-semibold shadow-md border border-white/20"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isSelected ? "text-white" : "text-neutral-400"
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium truncate">
                  {cat.name}
                </div>
                <div className="text-[11px] text-neutral-500 hidden lg:block truncate max-w-[170px]">
                  {cat.summary}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-500 md:hidden shrink-0" />
          </button>
        );
      })}
    </aside>
  );
}

// ==========================================
// SettingsDetail Component
// ==========================================

interface SettingsDetailProps {
  activeCategory: CategoryId;
  onBackMobile: () => void;
  mobileOpen: boolean;
}

function SettingsDetail({
  activeCategory,
  onBackMobile,
  mobileOpen,
}: SettingsDetailProps) {
  const settings = useSettingsStore();
  const { user, signOut } = useAuthStore();
  const { setEqualizerOpen, setAuthModalOpen, currentSong } = usePlayerStore();

  return (
    <main
      className={`liquid-glass border border-white/10 p-5 sm:p-6 rounded-[24px] shadow-2xl space-y-6 ${
        mobileOpen ? "block" : "hidden md:block"
      }`}
    >
      {/* Mobile Back Button */}
      <div className="flex items-center gap-3 md:hidden pb-3 border-b border-white/[0.08]">
        <button
          onClick={onBackMobile}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Categories</span>
        </button>
      </div>

      {/* Category 1: General */}
      {activeCategory === "general" && (
        <SettingsSection
          title="General Preferences"
          description="Application launch options, session memory, and system behavior"
        >
          <SettingsRow
            title="Restore Last Session"
            description="Automatically resume the last played song and queue on desktop startup"
          >
            <SettingsToggle
              checked={true}
              onChange={() => {}}
            />
          </SettingsRow>

          <SettingsRow
            title="Confirm Before Closing"
            description="Show a desktop dialog if audio is currently playing before closing window"
          >
            <SettingsToggle
              checked={false}
              onChange={() => {}}
            />
          </SettingsRow>

          <SettingsRow
            title="Desktop Notifications"
            description="Show native OS banner when track changes or queue advances"
          >
            <SettingsToggle
              checked={true}
              onChange={() => {}}
            />
          </SettingsRow>
        </SettingsSection>
      )}

      {/* Category 2: Appearance */}
      {activeCategory === "appearance" && (
        <div className="space-y-6">
          <SettingsSection
            title="Ambient Lighting & Visual Effects"
            description="Mesh gradient backdrop and dynamic illumination options"
          >
            <SettingsRow
              title="Dynamic Artwork Lighting"
              description="Extract vibrant colors from active album art to illuminate the background"
            >
              <SettingsToggle
                checked={settings.meshGradientBackdrop}
                onChange={(val) => settings.setMeshGradientBackdrop(val)}
              />
            </SettingsRow>

            <SettingsRow
              title="Spotify Canvas Loops"
              description="Stream vertical looping visual canvases instead of static album art when available"
            >
              <SettingsToggle
                checked={settings.animatedCanvas}
                onChange={(val) => settings.setAnimatedCanvas(val)}
              />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection
            title="Theme & Liquid Glass"
            description="Base contrast mode and glass surface materials"
          >
            <SettingsRow
              title="Liquid Glass Material"
              description="Transparent refraction styling for floating navigation and player panels"
            >
              <div className="flex items-center gap-2">
                {(["normal", "dark", "frosted"] as LiquidGlassMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => settings.setLiquidGlassMode(mode)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                      settings.liquidGlassMode === mode
                        ? "bg-white text-black shadow"
                        : "bg-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow
              title="Base Theme"
              description="Select background charcoal / OLED black level"
            >
              <div className="flex items-center gap-2">
                {(["oled", "dark", "system"] as ThemeModeSetting[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => settings.setThemeMode(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                      settings.themeMode === m
                        ? "bg-white text-black shadow"
                        : "bg-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </SettingsRow>
          </SettingsSection>
        </div>
      )}

      {/* Category 3: Playback */}
      {activeCategory === "playback" && (
        <SettingsSection
          title="Playback Controls"
          description="Crossfading, autoplay queue, and loudness normalization"
        >
          <SettingsRow
            title="Audio Crossfade"
            description="Smoothly blend between ending and next track"
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={settings.crossfadeSeconds}
                onChange={(e) => settings.setCrossfadeSeconds(parseInt(e.target.value, 10))}
                className="w-28 accent-raaga-red"
              />
              <span className="text-xs font-mono text-neutral-300 w-8">
                {settings.crossfadeSeconds}s
              </span>
            </div>
          </SettingsRow>

          <SettingsRow
            title="Autoplay Radio"
            description="Automatically queue similar YouTube tracks when current playlist ends"
          >
            <SettingsToggle
              checked={settings.dontRepeatSuggestions}
              onChange={(val) => settings.setDontRepeatSuggestions(val)}
            />
          </SettingsRow>

          <SettingsRow
            title="Volume Normalization"
            description="Equalize loudness across different YouTube music uploads"
          >
            <SettingsToggle
              checked={settings.loudnessNormalization}
              onChange={(val) => settings.setLoudnessNormalization(val)}
            />
          </SettingsRow>
        </SettingsSection>
      )}

      {/* Category 4: Audio */}
      {activeCategory === "audio" && (
        <SettingsSection
          title="Audio Engine & Quality"
          description="Hi-Res fidelity, streaming bitrate, and hardware equalizer"
        >
          <SettingsRow
            title="Streaming Fidelity"
            description="Optimal playback resolution from YouTube audio stream"
          >
            <SettingsSelect
              value={settings.wifiQuality}
              onChange={(val) => settings.setWifiQuality(val as AudioQualitySetting)}
              options={[
                { value: "lossless", label: "High Definition (256kbps Opus/AAC)" },
                { value: "high", label: "Standard (160kbps)" },
                { value: "medium", label: "Data Saver (128kbps)" },
              ]}
            />
          </SettingsRow>

          <SettingsRow
            title="Parametric Equalizer"
            description="Launch 10-band hardware equalizer with bass boost presets"
          >
            <SettingsButton
              onClick={() => setEqualizerOpen(true)}
              variant="secondary"
              icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            >
              Open Equalizer
            </SettingsButton>
          </SettingsRow>
        </SettingsSection>
      )}

      {/* Category 5: YouTube */}
      {activeCategory === "youtube" && (
        <SettingsSection
          title="YouTube Streaming & Lyrics"
          description="Official IFrame API streaming engine and lyrics synchronized services"
        >
          <SettingsRow
            title="Content Source"
            description="Exclusive provider for all search, playlists, albums, and IFrame audio playback"
          >
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              Active (Official IFrame API)
            </span>
          </SettingsRow>

          <SettingsRow
            title="Primary Lyrics Source"
            description="Source for real-time synchronized karaoke lyrics"
          >
            <SettingsSelect
              value={settings.primaryLyricsSource}
              onChange={(val) => settings.setPrimaryLyricsSource(val as any)}
              options={[
                { value: "lrclib", label: "LRCLIB (Default Synchronized)" },
                { value: "musixmatch", label: "Musixmatch" },
                { value: "kugou", label: "KuGou Music" },
              ]}
            />
          </SettingsRow>
        </SettingsSection>
      )}

      {/* Category 6: Downloads */}
      {activeCategory === "downloads" && (
        <SettingsSection
          title="Downloads & Local Cache"
          description="Manage disk space, offline track cache, and artwork buffers"
        >
          <SettingsRow
            title="Audio Cache Limit"
            description="Maximum local cache size for smooth playback without re-fetching"
          >
            <span className="text-xs font-mono text-white px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">
              {settings.audioCacheLimitMb} MB
            </span>
          </SettingsRow>

          <SettingsRow
            title="Wipe Offline Cache"
            description="Free up disk space by clearing local audio buffers and artwork thumbnails"
          >
            <SettingsButton
              onClick={() => {
                localStorage.removeItem("raaga_search_history");
                alert("Local cache cleared.");
              }}
              variant="secondary"
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Clear Cache
            </SettingsButton>
          </SettingsRow>
        </SettingsSection>
      )}

      {/* Category 7: Account */}
      {activeCategory === "account" && (
        <SettingsSection
          title="Account & Sync"
          description="Connect your Google account to sync YouTube playlists, liked videos, and history"
        >
          {user?.isGuest !== false ? (
            <div className="p-5 space-y-3">
              <h4 className="text-sm font-semibold text-white">Public Mode (No Login)</h4>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-lg">
                You can freely browse YouTube, search, play tracks, and create local playlists without an account.
                To sync your personal YouTube library, connect your Google account.
              </p>
              <SettingsButton
                onClick={() => setAuthModalOpen(true)}
                variant="primary"
                icon={<LogIn className="w-4 h-4" />}
              >
                Sign In with Google
              </SettingsButton>
            </div>
          ) : (
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-raaga-red to-raaga-pink flex items-center justify-center font-bold text-white text-sm shadow">
                  {user.name?.[0] || "U"}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{user.name}</h4>
                  <p className="text-xs text-neutral-400">{user.email}</p>
                </div>
              </div>
              <SettingsButton
                onClick={() => signOut()}
                variant="danger"
                icon={<LogOut className="w-3.5 h-3.5" />}
              >
                Sign Out
              </SettingsButton>
            </div>
          )}
        </SettingsSection>
      )}

      {/* Category 8: Advanced */}
      {activeCategory === "advanced" && (
        <SettingsSection
          title="Advanced & Diagnostics"
          description="Developer tools, Discord Rich Presence, and factory reset"
        >
          <SettingsRow
            title="Discord Rich Presence"
            description="Broadcast currently playing YouTube song, artwork, and elapsed progress to Discord desktop client"
          >
            <SettingsToggle
              checked={settings.discordRpcEnabled}
              onChange={(val) => settings.setDiscordRpcEnabled(val)}
            />
          </SettingsRow>

          {/* Interactive Discord Rich Presence Profile Card Preview */}
          <div className="p-5 bg-black/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Discord Presence Preview
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  settings.discordRpcEnabled
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {settings.discordRpcEnabled ? "Active & Broadcasting" : "Disabled"}
              </span>
            </div>

            {/* Discord Dark Theme Mini Activity Card */}
            <div className="max-w-md rounded-2xl bg-[#1e1f22] border border-[#2b2d31] p-4 text-white shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-400 uppercase tracking-wide">
                <span>Listening to Raaga</span>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-900 shrink-0 border border-white/10 shadow-md">
                  <img
                    src={
                      currentSong?.thumbnailUrl ||
                      "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80"
                    }
                    alt="Album Art"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-lg bg-[#5865F2] flex items-center justify-center text-[9px] font-bold text-white shadow">
                    R
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <h4 className="text-sm font-bold text-white truncate">
                    {currentSong?.title || "Starboy (feat. Daft Punk)"}
                  </h4>
                  <p className="text-xs text-neutral-300 truncate">
                    by {currentSong?.artist || "The Weeknd, Daft Punk"}
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate">
                    on {currentSong?.albumName || "Starboy"}
                  </p>
                  <p className="text-[10px] text-neutral-500 font-mono pt-0.5">
                    01:42 left
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-xs font-semibold text-neutral-200 transition text-center truncate"
                >
                  Listen on YouTube
                </button>
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-xs font-semibold text-neutral-200 transition text-center truncate"
                >
                  Get Raaga
                </button>
              </div>
            </div>
          </div>

          <SettingsRow
            title="Reset All Preferences"
            description="Revert all settings, audio presets, and theme values to defaults"
          >
            <SettingsButton
              onClick={() => settings.resetToDefaults()}
              variant="danger"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Reset to Defaults
            </SettingsButton>
          </SettingsRow>
        </SettingsSection>
      )}
    </main>
  );
}

// ==========================================
// Settings Page Component
// ==========================================

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialCategory = (searchParams.get("tab") as CategoryId) || "general";

  const [activeCategory, setActiveCategory] = useState<CategoryId>(initialCategory);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const categories: { id: CategoryId; name: string; icon: any; summary: string }[] = [
    { id: "general", name: "General", icon: Sliders, summary: "Startup, session, notifications" },
    { id: "appearance", name: "Appearance", icon: Paintbrush, summary: "Liquid glass modes, colors" },
    { id: "playback", name: "Playback", icon: PlayCircle, summary: "Autoplay, crossfade, gapless" },
    { id: "audio", name: "Audio", icon: Volume2, summary: "Fidelity, volume normalization, EQ" },
    { id: "youtube", name: "YouTube", icon: PlaySquare, summary: "IFrame engine, synchronized lyrics" },
    { id: "downloads", name: "Downloads", icon: Download, summary: "Offline cache, storage limit" },
    { id: "account", name: "Account", icon: User, summary: "Google login, sync, playlists" },
    { id: "advanced", name: "Advanced", icon: Cpu, summary: "Discord presence, reset defaults" },
  ];

  return (
    <div className="max-w-[1400px] mx-auto select-none space-y-6 animate-in fade-in duration-200 pb-20">
      {/* Settings Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
          Configure native desktop player behavior, Liquid Glass shader, and playback engine
        </p>
      </div>

      {/* Master-Detail Split Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] gap-6 items-start">
        <SettingsSidebar
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={(id) => {
            setActiveCategory(id);
            setMobileDetailOpen(true);
          }}
          mobileHidden={mobileDetailOpen}
        />

        <SettingsDetail
          activeCategory={activeCategory}
          onBackMobile={() => setMobileDetailOpen(false)}
          mobileOpen={mobileDetailOpen}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-400">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

